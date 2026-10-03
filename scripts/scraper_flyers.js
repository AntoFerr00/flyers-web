const { BASE_URL, COUNTRY, hasCoords, openPromoQui, getPageProps, fetchInternalApi, parseDistanceKm } = require('./promoqui');

// PromoQui categories holding grocery flyers: "Iper e super" and "Discount".
const GROCERY_CATEGORY_IDS = ['5', '6'];
const PAGE_SIZE = 50;
const MAX_PAGES = 4;

(async () => {
    const args = process.argv.slice(2);
    const city = args[0] || 'roma';
    const lat = args[1];
    const lon = args[2];
    const slug = city.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');

    const { browser, page } = await openPromoQui(lat, lon, city);
    const flyers = [];

    try {
        let ll = `${lat},${lon}`;
        if (!hasCoords(lat, lon)) {
            const props = await getPageProps(page, `${BASE_URL}/`);
            const geo = (props && props.geolocation) || {};
            ll = `${geo.latitude},${geo.longitude}`;
        }

        for (const categoryId of GROCERY_CATEGORY_IDS) {
            for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
                const data = await fetchInternalApi(page, 'flyers', {
                    id: categoryId,
                    type: 'category',
                    ll,
                    country: COUNTRY,
                    limit: String(PAGE_SIZE),
                    city: slug,
                    outsideCountry: 'false',
                    page: String(pageNumber)
                });
                const batch = (data && data.flyers) || [];
                // Skip brand campaigns, which link out instead of opening a flyer
                flyers.push(...batch.filter(f => f.type === 'flyer' && f.href && f.href.startsWith('/volantino/')));
                if (batch.length < PAGE_SIZE) break;
            }
        }
    } catch (e) {
    }

    const results = flyers.map(f => {
        const name = f.retailerName || f.title || 'Sconosciuto';

        return {
            id: `sm-${f.id}`,
            name: name,
            logo: f.retailerLogo || null,
            // Logos are small transparent images, shown whole on a white card
            color: f.retailerLogo ? '#ffffff' : '#3b82f6',
            address: `Zone: ${city}`,
            distance: parseDistanceKm(f.distance),
            flyer: {
                id: `fl-${f.id}`,
                title: f.title || name,
                url: f.href ? `${BASE_URL}${f.href}` : null,
                slug: String(f.id),
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
