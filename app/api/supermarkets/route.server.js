import { NextResponse } from 'next/server';
import { isValidLatLon } from '@/lib/coordinates';
import { getCityName } from '@/lib/nominatim';
import { nodeHttp } from '@/lib/http/node';
import { newPromoQuiClient, errorResponse } from '@/lib/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
        return errorResponse('Latitude and Longitude required', null, 400);
    }

    if (!isValidLatLon(lat, lon)) {
        return errorResponse('Invalid latitude or longitude', null, 400);
    }

    try {
        const city = await getCityName(nodeHttp, lat, lon);
        return NextResponse.json(await newPromoQuiClient().getNearbyFlyers({ lat, lon, city }));
    } catch (err) {
        return errorResponse('Failed to fetch flyers', err);
    }
}
