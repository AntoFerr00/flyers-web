// `http` function for lib/promoqui.js and lib/nominatim.js on the Next.js server.
export async function nodeHttp({ url, method, headers, body }) {
    const res = await fetch(url, { method, headers, body, redirect: 'manual' });
    return {
        status: res.status,
        setCookies: res.headers.getSetCookie(),
        text: await res.text()
    };
}
