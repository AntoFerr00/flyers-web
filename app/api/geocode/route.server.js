import { NextResponse } from 'next/server';
import { searchAddress } from '@/lib/nominatim';
import { nodeHttp } from '@/lib/http/node';
import { errorResponse } from '@/lib/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) return NextResponse.json([], { status: 400 });

    try {
        return NextResponse.json(await searchAddress(nodeHttp, q));
    } catch (err) {
        return errorResponse('Failed to fetch location', err);
    }
}
