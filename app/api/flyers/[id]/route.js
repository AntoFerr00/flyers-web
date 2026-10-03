import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Flyer URL is required' }, { status: 400 });
    }

    if (!url.startsWith('https://www.promoqui.it/')) {
        return NextResponse.json({ error: 'Flyer URL must be a PromoQui URL' }, { status: 400 });
    }

    // In Next.js App Router for dynamic routes ([id]), 'params' is the second argument.
    // But we are passing url as query param for simplicity.

    const scriptPath = path.resolve('./scripts/scraper_flyer_details.js');

    return new Promise((resolve) => {
        // execFile passes arguments directly to node, no shell is involved
        execFile(process.execPath, [scriptPath, url], { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error('Detail Scraper error:', stderr);
                return resolve(NextResponse.json({ error: 'Failed to fetch flyer details', details: stderr }, { status: 500 }));
            }

            try {
                const data = JSON.parse(stdout);
                return resolve(NextResponse.json(data));
            } catch (e) {
                console.error('Parse error:', e);
                return resolve(NextResponse.json({ error: 'Invalid data format from detail scraper' }, { status: 500 }));
            }
        });
    });
}
