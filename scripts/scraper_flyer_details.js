const { USER_AGENT, parseNextData } = require('./promoqui');

const PUBLICATION_API = 'https://api-viewer-zmags.shopfully.cloud';
// Page images come in several sizes; use the one closest to this width.
const TARGET_PAGE_WIDTH = 900;

async function fetchOk(url) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res;
}

function pickPageImage(pageBundle) {
    const images = (pageBundle.pageRepresentationDescriptors || []).filter(d => d.type === 'image');
    images.sort((a, b) => Math.abs(a.width - TARGET_PAGE_WIDTH) - Math.abs(b.width - TARGET_PAGE_WIDTH));
    return images.length ? `https://${images[0].pageRepresentation.resourcePath}` : null;
}

(async () => {
    const args = process.argv.slice(2);
    const flyerUrl = args[0];

    if (!flyerUrl || !flyerUrl.startsWith('http')) {
        console.log(JSON.stringify({ pages: [], products: [], error: 'Invalid or missing Flyer URL' }));
        process.exit(0);
    }

    const result = { pages: [], products: [] };

    try {
        // The flyer page names its publication, e.g. http://viewer.zmags.com/publication/it_it_935835
        const props = parseNextData(await (await fetchOk(flyerUrl)).text());
        const publicationUrl = props && props.apiResources && props.apiResources.flyer && props.apiResources.flyer.publication_url;
        const match = (publicationUrl || '').match(/publication\/([a-z]{2}_[a-z]{2})_(\d+)/);
        if (!match) throw new Error(`No publication found for ${flyerUrl}`);
        const [, country, publicationId] = match;

        // Pages are served in bundles; the first bundle describes where every page lives.
        const bundles = new Map();
        const getBundle = async (bundlePath) => {
            if (!bundles.has(bundlePath)) {
                bundles.set(bundlePath, await (await fetchOk(`https://${bundlePath}`)).json());
            }
            return bundles.get(bundlePath);
        };
        const firstBundlePath = `${PUBLICATION_API.replace('https://', '')}/publication_pages/${country}/${publicationId}/1`;
        const descriptor = (await getBundle(firstBundlePath)).publicationDescriptor || {};

        const pageDescriptors = descriptor.pageDescriptors || [];
        for (let i = 0; i < pageDescriptors.length; i++) {
            const { bundlePath, bundlePart } = pageDescriptors[i];
            // Page images are public CDN files, so the browser loads them directly
            const imageUrl = pickPageImage((await getBundle(bundlePath))[bundlePart] || {});
            if (imageUrl) {
                result.pages.push({ id: `page_${i}`, image: imageUrl, order: i });
            }
        }
    } catch (e) {
        result.error = e.message;
    }

    console.log(JSON.stringify(result));
})();
