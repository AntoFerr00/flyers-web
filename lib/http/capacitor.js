import { CapacitorHttp } from '@capacitor/core';

// Response header names keep the server's casing on some Android versions.
function headerValues(headers, name) {
    const values = [];
    for (const [key, value] of Object.entries(headers || {})) {
        if (key.toLowerCase() !== name) continue;
        if (Array.isArray(value)) values.push(...value);
        // Several Set-Cookie headers can arrive joined with commas; split only
        // before something that looks like the start of a new "name=" pair.
        else values.push(...String(value).split(/,(?=\s*[^;,=\s]+=)/));
    }
    return values;
}

// `http` function for lib/promoqui.js and lib/nominatim.js inside the Android
// app. Requests go through Android's native HTTP stack, which is not bound by
// the browser's cross-origin rules.
export async function capacitorHttp({ url, method, headers, body }) {
    const res = await CapacitorHttp.request({
        url,
        method,
        headers,
        data: body,
        responseType: 'text'
    });
    return {
        status: res.status,
        setCookies: headerValues(res.headers, 'set-cookie'),
        text: typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    };
}
