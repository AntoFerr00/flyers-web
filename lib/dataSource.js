import { Capacitor } from '@capacitor/core';

// Where the UI gets its data: in the browser from this app's /api routes, in
// the Android app straight from PromoQui and Nominatim (there is no server
// there), using the same lib/promoqui.js code the routes run.

export function isNativeApp() {
    return Capacitor.isNativePlatform();
}

let nativeClient = null;
async function getNative() {
    if (!nativeClient) {
        const [{ createPromoQuiClient }, { capacitorHttp }, nominatim] = await Promise.all([
            import('@/lib/promoqui'),
            import('@/lib/http/capacitor'),
            import('@/lib/nominatim')
        ]);
        nativeClient = { promoqui: createPromoQuiClient(capacitorHttp), http: capacitorHttp, nominatim };
    }
    return nativeClient;
}

async function getApi(path, params) {
    const res = await fetch(`${path}?${new URLSearchParams(params)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

export async function searchAddress(query) {
    if (!isNativeApp()) return getApi('/api/geocode', { q: query });
    const { http, nominatim } = await getNative();
    return nominatim.searchAddress(http, query);
}

export async function fetchNearbyFlyers(lat, lon) {
    if (!isNativeApp()) return getApi('/api/supermarkets', { lat, lon });
    const { promoqui, http, nominatim } = await getNative();
    const city = await nominatim.getCityName(http, lat, lon);
    return promoqui.getNearbyFlyers({ lat, lon, city });
}

export async function fetchFlyerPages(flyerUrl) {
    if (!isNativeApp()) return getApi('/api/flyers/details', { url: flyerUrl });
    const { promoqui } = await getNative();
    return promoqui.getFlyerPages(flyerUrl);
}

export async function searchProducts(query, lat, lon) {
    if (!isNativeApp()) return getApi('/api/products/search', { q: query, lat, lon });
    const { promoqui } = await getNative();
    return promoqui.searchProducts({ query, lat, lon });
}

export async function searchShoppingList(items, lat, lon) {
    if (!isNativeApp()) return getApi('/api/products/shopping-list', { items: items.join(','), lat, lon });
    const { promoqui } = await getNative();
    return promoqui.searchShoppingList({ items, lat, lon });
}
