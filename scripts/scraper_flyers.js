const puppeteer = require('puppeteer');

(async () => {
    const args = process.argv.slice(2);
    const city = args[0] || 'roma';
    const lat = args[1];
    const lon = args[2];
    const slug = city.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const flyers = [];
    const retailers = {};

    await page.setRequestInterception(true);

    page.on('request', request => {
        request.continue();
    });

    page.on('response', async response => {
        const url = response.url();
        if (url.includes('graphql')) {
            try {
                const text = await response.text();
                const json = JSON.parse(text);
                if (json.data) {
                    // Store retailers by id
                    if (json.data.Retailers && json.data.Retailers.data) {
                        json.data.Retailers.data.forEach(r => {
                            if (r.id !== undefined && r.id !== null) {
                                retailers[r.id] = r;
                            }
                        });
                    }
                    // Collect OfferContainers (flyers)
                    if (json.data.OfferContainers && json.data.OfferContainers.data) {
                        json.data.OfferContainers.data.forEach(container => {
                            if (container.type === 'Leaflet' || container.type === 'ClickToStoreLeaflet') {
                                flyers.push(container);
                            }
                        });
                    }
                }
            } catch (e) { }
        }
    });

    // Use lat/lon based URL if available, otherwise city slug
    let url = `https://www.promoqui.it/volantini/${slug}`;
    if (lat && lon && lat !== 'undefined' && lon !== 'undefined') {
        url = `https://www.promoqui.it/volantini?lat=${lat}&lng=${lon}`;
    }

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

        // Scroll to trigger lazy loading
        await page.evaluate(async () => {
            for (let i = 0; i < 15; i++) {
                window.scrollBy(0, 600);
                await new Promise(r => setTimeout(r, 300));
            }
        });

        // Wait for additional GraphQL responses
        await new Promise(r => setTimeout(r, 8000));
    } catch (e) {
    }

    const results = flyers.map(f => {
        // Priority: inline retailer > retailer dict lookup > fallback
        // retailer_id is often undefined, so we prefer inline retailer data
        let retailer = f.retailer || {};
        if (f.retailer_id && retailers[f.retailer_id]) {
            retailer = retailers[f.retailer_id];
        }

        let name = retailer.name || f.name || 'Sconosciuto';

        // Build logo URL
        let logo = null;
        if (retailer.logo) {
            logo = `https://data.promoqui.it/${retailer.logo.replace(':FORMAT', 'medium_webp')}`;
        }

        // Build flyer URL
        let flyerUrl = null;
        if (retailer.slug && f.slug) {
            flyerUrl = `https://www.promoqui.it/volantino/${retailer.slug}/${f.slug}`;
        }

        // Extract distance if available (e.g. "1.7 km" or "850 m")
        let distance = 0;
        if (f.distance) {
            // Check if f.distance is a string like "1.7 km"
            if (typeof f.distance === 'string') {
                const kmMatch = f.distance.match(/(\d+[.,]?\d*)\s*km/i);
                const mMatch = f.distance.match(/(\d+)\s*m/i);
                if (kmMatch) {
                    distance = parseFloat(kmMatch[1].replace(',', '.'));
                } else if (mMatch) {
                    distance = parseFloat(mMatch[1]) / 1000;
                }
            } else if (typeof f.distance === 'number') {
                // PromoQui returns distance in meters as a number (e.g. 1812 for 1.8km)
                distance = f.distance / 1000;
            }
        }
        // Fallback: check retailer object distance
        if (distance === 0 && retailer.distance) {
            if (typeof retailer.distance === 'string') {
                const kmMatch = retailer.distance.match(/(\d+[.,]?\d*)\s*km/i);
                const mMatch = retailer.distance.match(/(\d+)\s*m/i);
                if (kmMatch) {
                    distance = parseFloat(kmMatch[1].replace(',', '.'));
                } else if (mMatch) {
                    distance = parseFloat(mMatch[1]) / 1000;
                }
            } else if (typeof retailer.distance === 'number') {
                distance = retailer.distance / 1000;
            }
        }

        return {
            id: `sm-${f.id}`,
            name: name,
            logo: logo,
            color: retailer.color || '#3b82f6',
            address: `Zone: ${city}`,
            distance: distance,
            flyer: {
                id: `fl-${f.id}`,
                title: f.name || name,
                url: flyerUrl,
                slug: f.slug,
                startDate: f.start_date,
                endDate: f.end_date,
                products: []
            }
        };
    });

    // Deduplicate by retailer name (keep first flyer per retailer)
    // IMPORTANT: Sort by distance first so we keep the nearest one
    results.sort((a, b) => {
        // treating 0 (unknown) as larger than any known distance for sorting preference
        const distA = a.distance || 999999;
        const distB = b.distance || 999999;
        return distA - distB;
    });

    const uniqueResults = [];
    const seen = new Set();
    results.forEach(r => {
        if (r.name && !seen.has(r.name)) {
            uniqueResults.push(r);
            seen.add(r.name);
        }
    });

    console.log(JSON.stringify(uniqueResults));

    await browser.close();
})();
