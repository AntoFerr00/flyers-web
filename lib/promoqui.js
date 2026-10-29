// Reads flyers and offers from promoqui.it with plain HTTP requests.
//
// The same code runs on the Next.js server (lib/http/node.js) and inside the
// Android app (lib/http/capacitor.js); each passes in an `http` function:
//   http({ url, method, headers, body }) -> { status, setCookies: string[], text }

const BASE_URL = 'https://www.promoqui.it';
const COUNTRY = 'it_it';
const PUBLICATION_API = 'https://api-viewer-zmags.shopfully.cloud';
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// PromoQui categories holding grocery flyers: "Iper e super" and "Discount".
const GROCERY_CATEGORY_IDS = ['5', '6'];
const FLYERS_PAGE_SIZE = 50;
const FLYERS_MAX_PAGES = 4;
// Flyer page images come in several sizes; use the one closest to this width.
const TARGET_PAGE_WIDTH = 900;

function parseNextData(html) {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    return match ? JSON.parse(match[1]).props.pageProps : null;
}

// PromoQui distances are kilometres as strings; -1 means unknown.
function parseDistanceKm(value) {
    const km = parseFloat(value);
    return Number.isFinite(km) && km >= 0 ? km : 0;
}

function parsePrice(value) {
    if (!value) return null;
    const price = parseFloat(String(value).replace(/[^\d.,]/g, '').replace(',', '.'));
    return Number.isFinite(price) ? price : null;
}

function toSlug(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function createPromoQuiClient(http) {
    const cookies = new Map();
    let sessionReady = null;
    let currentPosition = null;

    async function request(url, { method = 'GET', headers = {}, body } = {}) {
        const cookieHeader = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
        const res = await http({
            url,
            method,
            body,
            headers: {
                'User-Agent': USER_AGENT,
                Referer: `${BASE_URL}/`,
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                ...headers
            }
        });
        for (const setCookie of res.setCookies || []) {
            const [pair] = setCookie.split(';');
            const eq = pair.indexOf('=');
            if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
        }
        if (res.status < 200 || res.status >= 300) {
            throw new Error(`PromoQui request failed (${res.status}): ${url}`);
        }
        return res.text;
    }

    // The site's own endpoints only answer requests carrying its session cookie,
    // which the home page sets.
    function ensureSession() {
        if (!sessionReady) {
            sessionReady = request(`${BASE_URL}/`).catch(err => {
                sessionReady = null;
                throw err;
            });
        }
        return sessionReady;
    }

    // PromoQui keeps the user's position in its session, written through
    // /api/cookie by its own location picker. Pages loaded afterwards (offers,
    // search) are rendered for that position.
    async function setPosition(lat, lon, city) {
        await ensureSession();
        const key = `${lat},${lon}`;
        if (currentPosition === key) return;
        const ll = [Number(lat), Number(lon)];
        await request(`${BASE_URL}/api/cookie`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify({
                content: { ll, rawll: ll, city: city || '', locationSource: 'user', locationStatus: 'confirmed' },
                options: { merge: true }
            })
        });
        currentPosition = key;
    }

    async function getPageProps(url) {
        return parseNextData(await request(url));
    }

    async function getNearbyFlyers({ lat, lon, city = '' }) {
        await setPosition(lat, lon, city);
        const flyers = [];

        for (const categoryId of GROCERY_CATEGORY_IDS) {
            for (let page = 1; page <= FLYERS_MAX_PAGES; page++) {
                const params = new URLSearchParams({
                    id: categoryId,
                    type: 'category',
                    ll: `${lat},${lon}`,
                    country: COUNTRY,
                    limit: String(FLYERS_PAGE_SIZE),
                    city: toSlug(city),
                    outsideCountry: 'false',
                    page: String(page)
                });
                const data = JSON.parse(await request(`${BASE_URL}/api/internal/flyers?${params}`, {
                    headers: { Accept: 'application/json' }
                }));
                const batch = (data && data.flyers) || [];
                // Skip brand campaigns, which link out instead of opening a flyer
                flyers.push(...batch.filter(f => f.type === 'flyer' && f.href && f.href.startsWith('/volantino/')));
                if (batch.length < FLYERS_PAGE_SIZE) break;
            }
        }

        const results = flyers.map(f => {
            const name = f.retailerName || f.title || 'Sconosciuto';
            return {
                id: `sm-${f.id}`,
                name,
                logo: f.retailerLogo || null,
                // Logos are small transparent images, shown whole on a white card
                color: f.retailerLogo ? '#ffffff' : '#3b82f6',
                address: city ? `Zone: ${city}` : '',
                distance: parseDistanceKm(f.distance),
                flyer: {
                    id: `fl-${f.id}`,
                    title: f.title || name,
                    url: `${BASE_URL}${f.href}`,
                    slug: String(f.id),
                    startDate: f.start_date,
                    endDate: f.end_date,
                    products: []
                }
            };
        });

        // Keep the nearest flyer per retailer; unknown distances (0) sort last
        results.sort((a, b) => (a.distance || 999999) - (b.distance || 999999));
        const seen = new Set();
        return results.filter(r => !seen.has(r.name) && seen.add(r.name));
    }

    async function searchProducts({ query, lat, lon }) {
        if (lat !== undefined && lon !== undefined) {
            await setPosition(lat, lon);
        } else {
            await ensureSession();
        }

        // Product category pages (/offerte/<product>) list the offers near the
        // position set above; free-text search covers queries that are not a category.
        const categoryUrl = `${BASE_URL}/offerte/${toSlug(query)}`;
        const urls = [categoryUrl, `${categoryUrl}?page=2`, `${BASE_URL}/search?q=${encodeURIComponent(query)}`];
        const offers = [];

        for (const url of urls) {
            const props = await getPageProps(url).catch(() => null);
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

        // Keep offers naming every word of the query, from a known retailer, with a price
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        const seen = new Set();
        const results = [];
        for (const offer of offers) {
            const settings = offer.settings || {};
            const name = (offer.title || '').trim();
            const brand = settings.brand || '';
            const retailer = offer.retailerName || '';
            const price = parsePrice(settings.price_extended ? settings.price_extended.digits : settings.price);
            const text = `${name} ${brand}`.toLowerCase();
            if (!retailer.trim() || price === null || !words.every(w => text.includes(w))) continue;

            // The same product can appear in several sections of a page
            const key = `${retailer}|${name}|${price}`.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);

            const index = results.length;
            results.push({
                supermarket: { name: retailer, id: index },
                product: {
                    id: `prod-${index}`,
                    name,
                    price,
                    image: offer.image || settings.image_url || null,
                    description: brand,
                    unit: '',
                    discount: settings.sale || null
                }
            });
        }
        return results;
    }

    async function searchShoppingList({ items, lat, lon }) {
        // Set the position once, before the searches run in parallel
        if (lat !== undefined && lon !== undefined) await setPosition(lat, lon);

        const perItem = await Promise.all(items.map(async item => {
            try {
                const results = await searchProducts({ query: item, lat, lon });
                return { searchTerm: item, results: results.map(r => ({ ...r, searchTerm: item })) };
            } catch (err) {
                return { searchTerm: item, results: [] };
            }
        }));

        const results = perItem.flatMap(r => r.results);
        return {
            results,
            summary: perItem.map(r => ({ searchTerm: r.searchTerm, count: r.results.length })),
            totalFound: results.length
        };
    }

    async function getFlyerPages(flyerUrl) {
        if (!flyerUrl || !flyerUrl.startsWith(`${BASE_URL}/`)) {
            throw new Error('Flyer URL must be a PromoQui URL');
        }

        // The flyer page names its publication, e.g. http://viewer.zmags.com/publication/it_it_935835
        const props = await getPageProps(flyerUrl);
        const publicationUrl = props && props.apiResources && props.apiResources.flyer && props.apiResources.flyer.publication_url;
        const match = (publicationUrl || '').match(/publication\/([a-z]{2}_[a-z]{2})_(\d+)/);
        if (!match) throw new Error(`No publication found for ${flyerUrl}`);
        const [, country, publicationId] = match;

        // Pages are served in bundles; the first bundle describes where every page lives.
        const bundles = new Map();
        const getBundle = async (bundlePath) => {
            if (!bundles.has(bundlePath)) {
                bundles.set(bundlePath, JSON.parse(await request(`https://${bundlePath}`)));
            }
            return bundles.get(bundlePath);
        };
        const firstBundlePath = `${PUBLICATION_API.replace('https://', '')}/publication_pages/${country}/${publicationId}/1`;
        const descriptor = (await getBundle(firstBundlePath)).publicationDescriptor || {};

        const pages = [];
        const pageDescriptors = descriptor.pageDescriptors || [];
        for (let i = 0; i < pageDescriptors.length; i++) {
            const { bundlePath, bundlePart } = pageDescriptors[i];
            const pageBundle = (await getBundle(bundlePath))[bundlePart] || {};
            const images = (pageBundle.pageRepresentationDescriptors || []).filter(d => d.type === 'image');
            images.sort((a, b) => Math.abs(a.width - TARGET_PAGE_WIDTH) - Math.abs(b.width - TARGET_PAGE_WIDTH));
            // Page images are public CDN files, so they are loaded directly
            if (images.length) {
                pages.push({ id: `page_${i}`, image: `https://${images[0].pageRepresentation.resourcePath}`, order: i });
            }
        }
        return { pages, products: [] };
    }

    return { getNearbyFlyers, searchProducts, searchShoppingList, getFlyerPages };
}
