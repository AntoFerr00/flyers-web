const puppeteer = require('puppeteer');

const BASE_URL = 'https://www.promoqui.it';
const COUNTRY = 'it_it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function hasCoords(lat, lon) {
    return Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lon));
}

// Opens promoqui.it in a headless browser, positioned at lat/lon when given
// (otherwise PromoQui falls back to a position guessed from the IP address).
async function openPromoQui(lat, lon, city) {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    if (hasCoords(lat, lon)) {
        await setLocation(page, lat, lon, city);
    }
    return { browser, page };
}

// PromoQui stores the user's position in a server-side cookie, written through
// /api/cookie by its own location picker. Pages loaded afterwards (offers,
// search) are rendered for that position.
async function setLocation(page, lat, lon, city) {
    const ll = [parseFloat(lat), parseFloat(lon)];
    await page.evaluate(async (content) => {
        await fetch('/api/cookie', {
            method: 'POST',
            body: JSON.stringify({ content, options: { merge: true } })
        });
    }, { ll, rawll: ll, city: city || '', locationSource: 'user', locationStatus: 'confirmed' });
}

// Loads a PromoQui page and returns the data it was server-rendered with.
async function getPageProps(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    return page.evaluate(() => {
        const el = document.getElementById('__NEXT_DATA__');
        return el ? JSON.parse(el.textContent).props.pageProps : null;
    });
}

// Calls one of the JSON endpoints the PromoQui frontend uses; they only
// answer requests made from a page on the site.
async function fetchInternalApi(page, endpoint, params) {
    return page.evaluate(async (endpoint, params) => {
        const res = await fetch(`/api/internal/${endpoint}?${new URLSearchParams(params)}`);
        return res.ok ? res.json() : null;
    }, endpoint, params);
}

function parseNextData(html) {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    return match ? JSON.parse(match[1]).props.pageProps : null;
}

// PromoQui distances are kilometres as strings; -1 means unknown.
function parseDistanceKm(value) {
    const km = parseFloat(value);
    return Number.isFinite(km) && km >= 0 ? km : 0;
}

module.exports = {
    BASE_URL,
    COUNTRY,
    USER_AGENT,
    hasCoords,
    openPromoQui,
    getPageProps,
    fetchInternalApi,
    parseNextData,
    parseDistanceKm
};
