import { NextResponse } from 'next/server';
import { newPromoQuiClient, errorResponse } from '@/lib/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return errorResponse('Flyer URL is required', null, 400);
    }

    if (!url.startsWith('https://www.promoqui.it/')) {
        return errorResponse('Flyer URL must be a PromoQui URL', null, 400);
    }

    try {
        return NextResponse.json(await newPromoQuiClient().getFlyerPages(url));
    } catch (err) {
        return errorResponse('Failed to fetch flyer details', err);
    }
}
