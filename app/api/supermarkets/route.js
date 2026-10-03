import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import { isValidLatLon } from '@/lib/coordinates';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
        return NextResponse.json({ error: 'Latitude and Longitude required' }, { status: 400 });
    }

    if (!isValidLatLon(lat, lon)) {
        return NextResponse.json({ error: 'Invalid latitude or longitude' }, { status: 400 });
    }

    try {
        // Reverse Geocode
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
            headers: { 'User-Agent': 'FlyersWeb/1.0' }
        });
        const geoData = await geoRes.json();

        const address = geoData.address || {};
        // Prioritize city -> town -> village -> county
        const city = address.city || address.town || address.village || address.municipality || 'roma'; // Default if fail

        // Execute Scraper
        const scriptPath = path.resolve('./scripts/scraper_flyers.js');

        return new Promise((resolve) => {
            // Pass city, lat, and lon to scraper
            // execFile passes arguments directly to node, no shell is involved
            execFile(process.execPath, [scriptPath, city, lat, lon], (error, stdout, stderr) => {
                if (error) {
                    console.error('Scraper error:', stderr);
                    // Fallback to empty list or error
                    return resolve(NextResponse.json({ error: 'Failed to fetch flyers', details: stderr }, { status: 500 }));
                }

                try {
                    const data = JSON.parse(stdout);
                    // Inject lat/lon into the results to fake "nearby" status if needed for sorting?
                    // Actually, let's just return what we have.
                    // Frontend might need distance. Let's calculate distance from user to... 0?
                    // Let's just pass the data.
                    resolve(NextResponse.json(data));
                } catch (e) {
                    console.error('Parse error:', e);
                    resolve(NextResponse.json({ error: 'Invalid data format from scraper' }, { status: 500 }));
                }
            });
        });

    } catch (err) {
        console.error('Geocode error:', err);
        return NextResponse.json({ error: 'Failed to determine location' }, { status: 500 });
    }
}
