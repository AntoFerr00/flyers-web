import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import { isValidCoordinate } from '@/lib/coordinates';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const itemsParam = searchParams.get('items');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!itemsParam) {
        return NextResponse.json({ error: 'Items list is required' }, { status: 400 });
    }

    if ((lat && !isValidCoordinate(lat, 90)) || (lon && !isValidCoordinate(lon, 180))) {
        return NextResponse.json({ error: 'Invalid latitude or longitude' }, { status: 400 });
    }

    const items = itemsParam.split(',').map(i => i.trim()).filter(Boolean);
    if (items.length === 0) {
        return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const scriptPath = path.resolve('./scripts/scraper.js');

    // Search each item in parallel
    const searchPromises = items.map(item => {
        return new Promise((resolve) => {
            // execFile passes arguments directly to node, no shell is involved
            const args = [scriptPath, item];
            if (lat) args.push(lat);
            if (lon) args.push(lon);

            execFile(process.execPath, args, { timeout: 120000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Scraper error for "${item}":`, stderr);
                    resolve({ searchTerm: item, results: [] });
                    return;
                }

                try {
                    const data = JSON.parse(stdout);
                    // Tag each result with the search term it belongs to
                    const tagged = data.map(r => ({
                        ...r,
                        searchTerm: item
                    }));
                    resolve({ searchTerm: item, results: tagged });
                } catch (e) {
                    console.error(`Parse error for "${item}":`, e);
                    resolve({ searchTerm: item, results: [] });
                }
            });
        });
    });

    try {
        const allResults = await Promise.all(searchPromises);

        // Flatten into a single array with searchTerm on each item
        const flatResults = allResults.flatMap(r => r.results);

        // Also include a summary of what was found per term
        const summary = allResults.map(r => ({
            searchTerm: r.searchTerm,
            count: r.results.length
        }));

        return NextResponse.json({
            results: flatResults,
            summary: summary,
            totalFound: flatResults.length
        });
    } catch (err) {
        console.error('Shopping list search error:', err);
        return NextResponse.json({ error: 'Failed to search items' }, { status: 500 });
    }
}
