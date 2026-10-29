import { NextResponse } from 'next/server';
import { isValidCoordinate } from '@/lib/coordinates';
import { newPromoQuiClient, errorResponse } from '@/lib/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const itemsParam = searchParams.get('items');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!itemsParam) {
        return errorResponse('Items list is required', null, 400);
    }

    if ((lat && !isValidCoordinate(lat, 90)) || (lon && !isValidCoordinate(lon, 180))) {
        return errorResponse('Invalid latitude or longitude', null, 400);
    }

    const items = itemsParam.split(',').map(i => i.trim()).filter(Boolean);
    if (items.length === 0) {
        return errorResponse('At least one item is required', null, 400);
    }

    try {
        const results = await newPromoQuiClient().searchShoppingList({ items, lat: lat || undefined, lon: lon || undefined });
        return NextResponse.json(results);
    } catch (err) {
        return errorResponse('Failed to search items', err);
    }
}
