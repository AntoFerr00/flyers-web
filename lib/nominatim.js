// Address search and reverse geocoding with OpenStreetMap Nominatim, through
// the same `http` function as lib/promoqui.js.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
// Nominatim's usage policy asks every client to identify itself.
const USER_AGENT = 'FlyerFinder/1.0 (https://github.com/AntoFerr00/flyers-web)';

async function getJson(http, url) {
    const res = await http({ url, method: 'GET', headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Nominatim request failed (${res.status})`);
    }
    return JSON.parse(res.text);
}

export function searchAddress(http, query) {
    return getJson(http, `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`);
}

// Returns the city, town or village at a position, or '' when unknown.
export async function getCityName(http, lat, lon) {
    try {
        const data = await getJson(http, `${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lon}&format=json`);
        const address = data.address || {};
        return address.city || address.town || address.village || address.municipality || '';
    } catch (err) {
        return '';
    }
}
