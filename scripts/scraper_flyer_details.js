const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const args = process.argv.slice(2);
    const flyerUrl = args[0];

    if (!flyerUrl || !flyerUrl.startsWith('http')) {
        console.log(JSON.stringify({ pages: [], products: [], error: 'Invalid or missing Flyer URL' }));
        process.exit(0);
    }

    // Create cache directory
    const cacheDir = path.resolve('./public/flyer-cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    const urlParts = flyerUrl.split('/');
    const flyerSlug = urlParts[urlParts.length - 1] || 'unknown';
    const flyerCacheDir = path.join(cacheDir, flyerSlug);
    if (!fs.existsSync(flyerCacheDir)) {
        fs.mkdirSync(flyerCacheDir, { recursive: true });
    }

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1400, height: 900 });

    let result = { pages: [], products: [] };

    // Collect page image URLs from network responses
    const capturedImageBuffers = new Map();

    page.on('response', async response => {
        const url = response.url();
        // Capture page images as the browser loads them
        if (url.includes('/pages/images/') && response.status() === 200) {
            try {
                const buffer = await response.buffer();
                if (buffer && buffer.length > 5000) {
                    capturedImageBuffers.set(url, buffer);
                }
            } catch (e) { }
        }
    });

    try {
        await page.goto(flyerUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    } catch (e) { }

    // CRITICAL: Accept cookie consent dialog
    try {
        // Try multiple selectors for the accept button
        const acceptSelectors = [
            'button:has-text("Accetto")',
            '.qc-cmp2-summary-buttons button:last-child',
            'button[mode="primary"]',
            '[class*="accept"]',
            '#onetrust-accept-btn-handler'
        ];

        for (const selector of acceptSelectors) {
            try {
                const btn = await page.$(selector);
                if (btn) {
                    await btn.click();
                    await new Promise(r => setTimeout(r, 2000));
                    break;
                }
            } catch (e) { }
        }

        // Also try XPath for "Accetto" text
        const accettoBtn = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.textContent.trim() === 'Accetto') || null;
        });
        if (accettoBtn && accettoBtn.asElement()) {
            await accettoBtn.asElement().click();
            await new Promise(r => setTimeout(r, 2000));
        }

        // Also try "Continua senza accettare" link
        const continuaLink = await page.evaluateHandle(() => {
            const links = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]'));
            return links.find(l => l.textContent.includes('Continua senza accettare')) || null;
        });
        if (continuaLink && continuaLink.asElement()) {
            await continuaLink.asElement().click();
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) { }

    // Wait for flyer viewer to fully load after consent
    await new Promise(r => setTimeout(r, 3000));

    // The viewer is interactive (1/24 pages) — we need to navigate through pages
    // Click the right arrow to go through all pages and trigger image loading
    const totalPagesText = await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/(\d+)\s*\/\s*(\d+)/);
        return match ? parseInt(match[2]) : 0;
    });

    const totalPages = totalPagesText || 24;

    // Navigate through each page to trigger image loading
    for (let i = 0; i < totalPages; i++) {
        try {
            // Click the right/next arrow
            const nextBtn = await page.evaluateHandle(() => {
                // Look for next button in the flyer viewer
                const arrows = document.querySelectorAll('[class*="arrow"], [class*="next"], [class*="right"], svg, .swiper-button-next');
                for (const el of arrows) {
                    const rect = el.getBoundingClientRect();
                    // Right side arrow
                    if (rect.x > window.innerWidth * 0.7 && rect.width > 10 && rect.height > 10) {
                        return el;
                    }
                }
                return null;
            });

            if (nextBtn && nextBtn.asElement()) {
                await nextBtn.asElement().click();
            } else {
                // Try keyboard navigation
                await page.keyboard.press('ArrowRight');
            }
            await new Promise(r => setTimeout(r, 800));
        } catch (e) { }
    }

    // Wait for all image downloads to complete
    await new Promise(r => setTimeout(r, 5000));

    // Now save all captured images
    const sortedUrls = [...capturedImageBuffers.keys()].sort((a, b) => {
        // Extract page number from URL (e.g., page1.webp, page2.webp)
        const numA = parseInt(a.match(/page(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/page(\d+)/)?.[1] || '0');
        return numA - numB;
    });

    for (let i = 0; i < sortedUrls.length; i++) {
        const url = sortedUrls[i];
        const buffer = capturedImageBuffers.get(url);
        if (buffer && buffer.length > 5000) {
            const ext = url.includes('.webp') ? 'webp' : 'jpg';
            const filename = `page_${i}.${ext}`;
            const localPath = path.join(flyerCacheDir, filename);
            fs.writeFileSync(localPath, buffer);
            result.pages.push({
                id: `page_${i}`,
                image: `/flyer-cache/${flyerSlug}/${filename}`,
                order: i
            });
        }
    }

    // Fallback: if network capture didn't work, try extracting from DOM
    if (result.pages.length === 0) {
        const domImages = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs
                .filter(img => img.src && img.src.includes('/pages/images/'))
                .map(img => ({
                    src: img.src,
                    width: img.naturalWidth,
                    height: img.naturalHeight
                }))
                .filter(img => img.width > 100);
        });

        // Also check background-image styles
        const bgImages = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('[style*="background-image"]'));
            return elements
                .map(el => {
                    const style = el.getAttribute('style') || '';
                    const match = style.match(/url\(['"]?(.*?)['"]?\)/);
                    return match ? match[1] : null;
                })
                .filter(url => url && url.includes('/pages/images/'));
        });

        // If we found DOM/bg images, use the proxy approach
        const allImageUrls = [
            ...domImages.map(i => i.src),
            ...bgImages
        ];
        const uniqueImageUrls = [...new Set(allImageUrls)].sort((a, b) => {
            const numA = parseInt(a.match(/page(\d+)/)?.[1] || '0');
            const numB = parseInt(b.match(/page(\d+)/)?.[1] || '0');
            return numA - numB;
        });

        // Try to get these from in-page fetch
        for (let i = 0; i < uniqueImageUrls.length; i++) {
            try {
                const base64Data = await page.evaluate(async (url) => {
                    const res = await fetch(url, { credentials: 'include' });
                    if (!res.ok) return null;
                    const blob = await res.blob();
                    return new Promise(resolve => {
                        const r = new FileReader();
                        r.onloadend = () => resolve(r.result);
                        r.readAsDataURL(blob);
                    });
                }, uniqueImageUrls[i]);

                if (base64Data && base64Data.startsWith('data:')) {
                    const base64 = base64Data.split(',')[1];
                    const buffer = Buffer.from(base64, 'base64');
                    if (buffer.length > 5000) {
                        const ext = uniqueImageUrls[i].includes('.webp') ? 'webp' : 'jpg';
                        const filename = `page_${i}.${ext}`;
                        fs.writeFileSync(path.join(flyerCacheDir, filename), buffer);
                        result.pages.push({
                            id: `page_${i}`,
                            image: `/flyer-cache/${flyerSlug}/${filename}`,
                            order: i
                        });
                    }
                }
            } catch (e) { }
        }
    }

    console.log(JSON.stringify(result));
    await browser.close();
})();
