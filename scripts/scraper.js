const puppeteer = require('puppeteer');

(async () => {
    const args = process.argv.slice(2);
    const query = args[0] || 'latte';
    const lat = args[1];
    const lng = args[2];

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Use the correct search URL
    let url = `https://www.promoqui.it/search?q=${encodeURIComponent(query)}`;
    if (lat && lng) {
        url += `&lat=${lat}&lng=${lng}`;
    }

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

        // Scroll to load more products
        await page.evaluate(async () => {
            for (let i = 0; i < 8; i++) {
                window.scrollBy(0, 800);
                await new Promise(r => setTimeout(r, 400));
            }
        });

        await new Promise(r => setTimeout(r, 3000));
    } catch (e) { }

    // Extract product data from the DOM
    const products = await page.evaluate((searchQuery) => {
        const results = [];

        // PromoQui search uses offer grid items with specific class structure
        // Look for elements that have product title and price
        const offerCards = document.querySelectorAll('.leaflets-carousel-item, .offer-grid-item, [class*="offer-item"], .search-result-item');

        offerCards.forEach(card => {
            const titleEl = card.querySelector('[class*="title"], h3, h4');
            const subtitleEl = card.querySelector('[class*="subtitle"]');
            const priceEl = card.querySelector('[class*="price"]');
            const imgEl = card.querySelector('img');
            const retailerEl = card.querySelector('[class*="retailer"], [class*="brand"]');

            if (titleEl) {
                results.push({
                    name: titleEl.textContent.trim(),
                    subtitle: subtitleEl ? subtitleEl.textContent.trim() : null,
                    price: priceEl ? priceEl.textContent.trim() : null,
                    image: imgEl ? (imgEl.src || imgEl.dataset.original) : null,
                    retailer: retailerEl ? retailerEl.textContent.trim() : null
                });
            }
        });

        // Fallback: if no specific card selectors match, try generic extraction
        if (results.length === 0) {
            // Look for contentBody sections that contain offers
            const contentBodies = document.querySelectorAll('.contentBody');
            contentBodies.forEach(body => {
                const items = body.querySelectorAll('a, article, [class*="item"]');
                items.forEach(item => {
                    const text = item.textContent.trim();
                    const img = item.querySelector('img');
                    // Extract price patterns (€ X.XX or X,XX €)
                    const priceMatch = text.match(/(\d+[.,]\d{2})\s*€|€\s*(\d+[.,]\d{2})/);
                    const price = priceMatch ? (priceMatch[1] || priceMatch[2]) : null;

                    if (text.length > 5 && text.length < 200) {
                        results.push({
                            name: text.split('\n')[0].trim(),
                            price: price,
                            image: img ? (img.src || img.dataset.original) : null,
                            retailer: null
                        });
                    }
                });
            });
        }

        // Second fallback: parse from __NEXT_DATA__
        if (results.length === 0) {
            const nextEl = document.getElementById('__NEXT_DATA__');
            if (nextEl) {
                try {
                    const data = JSON.parse(nextEl.textContent);
                    const pp = data.props.pageProps;

                    // Search for offers arrays
                    const findOffers = (obj, depth = 0) => {
                        if (depth > 3 || !obj || typeof obj !== 'object') return;

                        Object.keys(obj).forEach(key => {
                            const val = obj[key];
                            if (Array.isArray(val) && val.length > 0 && val[0] && (val[0].title || val[0].name)) {
                                val.forEach(item => {
                                    const name = item.title || item.name || '';
                                    if (name.toLowerCase().includes(searchQuery.toLowerCase())) {
                                        let imgUrl = null;
                                        if (item.image) {
                                            imgUrl = `https://data.promoqui.it/${item.image.replace(':FORMAT', 'medium')}`;
                                        }
                                        results.push({
                                            name: name,
                                            price: item.price ? String(item.price) : null,
                                            image: imgUrl,
                                            retailer: item.retailer ? item.retailer.name : null
                                        });
                                    }
                                });
                            } else if (typeof val === 'object') {
                                findOffers(val, depth + 1);
                            }
                        });
                    };

                    findOffers(pp);
                } catch (e) { }
            }
        }

        return results;
    }, query);

    // Filter by relevance, exclude unknown retailers and missing prices
    const q = query.toLowerCase();
    const filtered = products
        .filter(p => {
            const name = (p.name || '').toLowerCase();
            const subtitle = (p.subtitle || '').toLowerCase();
            const hasRelevance = name.includes(q) || subtitle.includes(q);
            const hasRetailer = p.retailer && p.retailer.trim() !== '';
            const hasPrice = p.price && p.price.trim() !== '';
            return hasRelevance && hasRetailer && hasPrice;
        })
        .map((p, index) => ({
            supermarket: {
                name: p.retailer,
                id: index
            },
            product: {
                id: `prod-${index}`,
                name: p.name,
                price: parseFloat(p.price.replace(/[^\d.,]/g, '').replace(',', '.')) || null,
                image: p.image,
                description: p.subtitle || '',
                unit: '',
                discount: null
            }
        }));

    // Deduplicate
    const uniqueResults = [];
    const seenNames = new Set();
    filtered.forEach(r => {
        const key = r.product.name.toLowerCase();
        if (!seenNames.has(key)) {
            uniqueResults.push(r);
            seenNames.add(key);
        }
    });

    console.log(JSON.stringify(uniqueResults));

    await browser.close();
})();
