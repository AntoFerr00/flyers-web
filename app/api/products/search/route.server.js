import { NextResponse } from 'next/server';
import { isValidCoordinate } from '@/lib/coordinates';
import { newPromoQuiClient, errorResponse } from '@/lib/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!q) {
        return errorResponse('Search term is required', null, 400);
    }

    if ((lat && !isValidCoordinate(lat, 90)) || (lon && !isValidCoordinate(lon, 180))) {
        return errorResponse('Invalid latitude or longitude', null, 400);
    }

    try {
        const results = await newPromoQuiClient().searchProducts({ query: q, lat: lat || undefined, lon: lon || undefined });
        return NextResponse.json(results);
    } catch (err) {
        return errorResponse('Failed to search products', err);
    }
}
