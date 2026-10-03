// Latitude/longitude query params must be plain finite numbers in range;
// anything else is rejected before it reaches a scraper or external URL.
export function isValidCoordinate(value, max) {
    if (!/^-?\d+(\.\d+)?$/.test(value)) return false;
    const n = Number(value);
    return Number.isFinite(n) && Math.abs(n) <= max;
}

export function isValidLatLon(lat, lon) {
    return isValidCoordinate(lat, 90) && isValidCoordinate(lon, 180);
}
