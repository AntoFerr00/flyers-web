import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) return NextResponse.json([], { status: 400 });

    try {
        // Nominatim requires a User-Agent
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`, {
            headers: {
                'User-Agent': 'FlyerFinderWeb/1.0'
            }
        });

        if (!res.ok) throw new Error('Failed to fetch from Nominatim');

        const data = await res.json();
        return NextResponse.json(data);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 });
    }
}
