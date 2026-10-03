const { BASE_URL, openPromoQui, getPageProps } = require('./promoqui');

function toSlug(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parsePrice(value) {
    if (!value) return null;
    const price = parseFloat(String(value).replace(/[^\d.,]/g, '').replace(',', '.'));
    return Number.isFinite(price) ? price : null;
}

(async () => {
    const args = process.argv.slice(2);
    const query = args[0] || 'latte';
    const lat = args[1];
    const lng = args[2];

    const { browser, page } = await openPromoQui(lat, lng);
    const offers = [];

    try {
        // Product category pages (/offerte/<product>) list the offers near the
        // position set above; free-text search covers queries that are not a category.
        const categoryUrl = `${BASE_URL}/offerte/${toSlug(query)}`;
        const urls = [categoryUrl, `${categoryUrl}?page=2`, `${BASE_URL}/search?q=${encodeURIComponent(query)}`];

        for (const url of urls) {
            const props = await getPageProps(page, url).catch(() => null);
            if (!props || (props.pageInfo && props.pageInfo.pageType === 'ERRORPAGE')) {
                if (url === categoryUrl) urls.splice(1, 1); // no category, so no second page either
                continue;
            }
            const resources = props.apiResources || {};
            offers.push(
                ...((resources.flyerGibsData && resources.flyerGibsData.flyerGibs) || []),
                ...((resources.offersTable && resources.offersTable.flyerGibs) || [])
            );
        }
    } catch (e) { }

    const products = offers.map(offer => {
        const settings = offer.settings || {};
        return {
            name: (offer.title || '').trim(),
            subtitle: settings.brand || null,
            price: parsePrice(settings.price_extended ? settings.price_extended.digits : settings.price),
            image: offer.image || settings.image_url || null,
            retailer: offer.retailerName || null,
            discount: settings.sale || null
        };
    });

    // Keep offers naming every word of the query, from a known retailer, with a price
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = products
        .filter(p => {
            const text = `${p.name} ${p.subtitle || ''}`.toLowerCase();
            const hasRelevance = words.every(w => text.includes(w));
            const hasRetailer = p.retailer && p.retailer.trim() !== '';
            return hasRelevance && hasRetailer && p.price !== null;
        })
        .map((p, index) => ({
            supermarket: {
                name: p.retailer,
                id: index
            },
            product: {
                id: `prod-${index}`,
                name: p.name,
                price: p.price,
                image: p.image,
                description: p.subtitle || '',
                unit: '',
                discount: p.discount
            }
        }));

    // Deduplicate: the same product can appear in several sections of a page
    const uniqueResults = [];
    const seenKeys = new Set();
    filtered.forEach(r => {
        const key = `${r.supermarket.name}|${r.product.name}|${r.product.price}`.toLowerCase();
        if (!seenKeys.has(key)) {
            uniqueResults.push(r);
            seenKeys.add(key);
        }
    });

    console.log(JSON.stringify(uniqueResults));

    await browser.close();
})();
