import { NextResponse } from 'next/server';
import { createPromoQuiClient } from '@/lib/promoqui';
import { nodeHttp } from '@/lib/http/node';

// Each request gets its own PromoQui session: the position is stored in it,
// so sharing one across users would mix up their searches.
export function newPromoQuiClient() {
    return createPromoQuiClient(nodeHttp);
}

export function errorResponse(message, err, status = 500) {
    if (err) console.error(message, err);
    return NextResponse.json({ error: message }, { status });
}
