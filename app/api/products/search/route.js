import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!q) {
        return NextResponse.json({ error: 'Search term is required' }, { status: 400 });
    }

    // In production (Vercel), this won't work easily. 
    // This is for local development demonstration as requested.
    const scriptPath = path.resolve('./scripts/scraper.js');

    return new Promise((resolve) => {
        // Pass lat/lon if available
        const args = [`"${q}"`];
        if (lat) args.push(`"${lat}"`);
        if (lon) args.push(`"${lon}"`);

        exec(`node "${scriptPath}" ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                console.error('Scraper error:', stderr);
                // Fallback to mock data or return error
                return resolve(NextResponse.json({ error: 'Failed to fetch real data', details: stderr }, { status: 500 }));
            }

            try {
                const data = JSON.parse(stdout);
                resolve(NextResponse.json(data));
            } catch (e) {
                console.error('Parse error:', e);
                resolve(NextResponse.json({ error: 'Invalid data format from scraper' }, { status: 500 }));
            }
        });
    });
}
