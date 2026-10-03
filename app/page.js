'use client';

import { useState, useEffect, useMemo } from 'react';
import LocationSearch from '@/components/LocationSearch';
import FlyerGrid from '@/components/FlyerGrid';
import ProductSearch from '@/components/ProductSearch';
import ShoppingList from '@/components/ShoppingList';
import { MapPin, ShoppingBasket, ArrowLeft, ArrowUpDown, ExternalLink, Navigation, ShoppingCart, Store, Package, List } from 'lucide-react';

export default function Home() {
    const [location, setLocation] = useState(null);
    const [supermarkets, setSupermarkets] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [shoppingResults, setShoppingResults] = useState([]);
    const [shoppingSummary, setShoppingSummary] = useState([]);
    const [viewMode, setViewMode] = useState('initial'); // initial, flyers, products, shopping
    const [shoppingGroupMode, setShoppingGroupMode] = useState('by-shop'); // by-item, by-shop
    const [loading, setLoading] = useState(false);
    const [shoppingLoading, setShoppingLoading] = useState(false);
    const [sortMode, setSortMode] = useState('price-asc');
    const [maxDistance, setMaxDistance] = useState(1000);
    const [activeTab, setActiveTab] = useState('flyers'); // flyers, shopping

    // Filter supermarkets based on distance slider
    const filteredSupermarkets = useMemo(() => {
        return supermarkets.filter(sm => {
            const distKm = sm.distance || 0;
            const distMeters = distKm * 1000;
            return distMeters <= maxDistance;
        });
    }, [supermarkets, maxDistance]);

    // Build a lookup of supermarket distances
    const supermarketDistances = useMemo(() => {
        const map = {};
        filteredSupermarkets.forEach(sm => {
            const key = (sm.name || '').toLowerCase().trim();
            if (key && (map[key] === undefined || (sm.distance && sm.distance < map[key]))) {
                map[key] = sm.distance || null;
            }
        });
        return map;
    }, [filteredSupermarkets]);

    // Enrich single-search results with distance
    const enrichedResults = useMemo(() => {
        const nearbyShopNames = supermarkets.map(sm => (sm.name || '').toLowerCase().trim()).filter(Boolean);
        return searchResults
            .map(item => {
                const shopKey = (item.supermarket.name || '').toLowerCase().trim();
                let distance = supermarketDistances[shopKey];
                if (distance === undefined) {
                    for (const [key, dist] of Object.entries(supermarketDistances)) {
                        if (key.includes(shopKey) || shopKey.includes(key)) {
                            distance = dist;
                            break;
                        }
                    }
                }
                return { ...item, distance: distance ?? null };
            })
            .filter(item => {
                const shopKey = (item.supermarket.name || '').toLowerCase().trim();
                return nearbyShopNames.some(name =>
                    name.includes(shopKey) || shopKey.includes(name)
                );
            });
    }, [searchResults, supermarketDistances, supermarkets]);

    // Enrich shopping results with distance and filter by nearby shops
    const enrichedShoppingResults = useMemo(() => {
        const nearbyShopNames = supermarkets.map(sm => (sm.name || '').toLowerCase().trim()).filter(Boolean);
        return shoppingResults
            .map(item => {
                const shopKey = (item.supermarket.name || '').toLowerCase().trim();
                let distance = supermarketDistances[shopKey];
                if (distance === undefined) {
                    for (const [key, dist] of Object.entries(supermarketDistances)) {
                        if (key.includes(shopKey) || shopKey.includes(key)) {
                            distance = dist;
                            break;
                        }
                    }
                }
                return { ...item, distance: distance ?? null };
            })
            .filter(item => {
                const shopKey = (item.supermarket.name || '').toLowerCase().trim();
                // Keep if the shop is in the nearby list
                return nearbyShopNames.some(name =>
                    name.includes(shopKey) || shopKey.includes(name)
                );
            });
    }, [shoppingResults, supermarketDistances, supermarkets]);

    // Group shopping results by item
    const groupedByItem = useMemo(() => {
        const groups = {};
        enrichedShoppingResults.forEach(item => {
            const term = item.searchTerm || 'Other';
            if (!groups[term]) groups[term] = [];
            groups[term].push(item);
        });
        // Sort each group by price
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => (a.product.price || 999) - (b.product.price || 999));
        });
        return groups;
    }, [enrichedShoppingResults]);

    // Group shopping results by shop — the killer feature
    const groupedByShop = useMemo(() => {
        const shops = {};
        enrichedShoppingResults.forEach(item => {
            const shopName = item.supermarket.name || 'Unknown';
            if (!shops[shopName]) {
                shops[shopName] = {
                    name: shopName,
                    distance: item.distance,
                    items: {},
                    totalPrice: 0,
                    itemCount: 0
                };
            }
            const term = item.searchTerm || 'other';
            // Keep only the cheapest product per search term per shop
            if (!shops[shopName].items[term] || (item.product.price && (!shops[shopName].items[term].product.price || item.product.price < shops[shopName].items[term].product.price))) {
                // If replacing, subtract old price first
                if (shops[shopName].items[term] && shops[shopName].items[term].product.price) {
                    shops[shopName].totalPrice -= shops[shopName].items[term].product.price;
                } else if (!shops[shopName].items[term]) {
                    shops[shopName].itemCount++;
                }
                shops[shopName].items[term] = item;
                shops[shopName].totalPrice += item.product.price || 0;
            }
        });

        // Convert to array and sort
        return Object.values(shops).sort((a, b) => {
            // Shops with more items first, then by total price
            if (b.itemCount !== a.itemCount) return b.itemCount - a.itemCount;
            return (a.totalPrice || 999) - (b.totalPrice || 999);
        });
    }, [enrichedShoppingResults]);

    // Sort single-search results
    const sortedResults = useMemo(() => {
        if (enrichedResults.length === 0) return [];
        return [...enrichedResults].sort((a, b) => {
            switch (sortMode) {
                case 'price-asc': return (a.product.price || 999) - (b.product.price || 999);
                case 'price-desc': return (b.product.price || 0) - (a.product.price || 0);
                case 'name-asc': return (a.supermarket.name || '').localeCompare(b.supermarket.name || '');
                case 'name-desc': return (b.supermarket.name || '').localeCompare(a.supermarket.name || '');
                case 'dist-asc': return (a.distance ?? 9999) - (b.distance ?? 9999);
                case 'dist-desc': return (b.distance ?? 0) - (a.distance ?? 0);
                default: return 0;
            }
        });
    }, [enrichedResults, sortMode]);


    const getGoogleMapsUrl = (shopName) => {
        if (!location) return '#';
        return `https://www.google.com/maps/search/${encodeURIComponent(shopName)}/@${location.lat},${location.lon},15z`;
    };

    const formatDistance = (dist) => {
        if (dist === null || dist === undefined) return null;
        if (dist < 1) return `${Math.round(dist * 1000)} m`;
        return `${dist.toFixed(1)} km`;
    };

    // Fetch supermarkets when location changes
    useEffect(() => {
        if (location) {
            fetchSupermarkets(location.lat, location.lon);
        }
    }, [location]);

    const fetchSupermarkets = async (lat, lon) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/supermarkets?lat=${lat}&lon=${lon}`);
            const data = await res.json();
            setSupermarkets(data);
            setViewMode('flyers');
        } catch (error) {
            console.error("Failed to fetch supermarkets", error);
        } finally {
            setLoading(false);
        }
    };

    const handleProductSearch = async (query) => {
        if (!query || query.length < 2) {
            if (viewMode === 'products') setViewMode('flyers');
            return;
        }

        if (!location) {
            alert("Please select a location first.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&lat=${location.lat}&lon=${location.lon}`);
            const data = await res.json();
            setSearchResults(data);
            setViewMode('products');
        } catch (error) {
            console.error("Failed to search products", error);
        } finally {
            setLoading(false);
        }
    };

    const handleShoppingSearch = async (items) => {
        if (!location) {
            alert("Please select a location first.");
            return;
        }

        setShoppingLoading(true);
        setViewMode('shopping');
        try {
            const itemsParam = items.map(i => encodeURIComponent(i)).join(',');
            const res = await fetch(`/api/products/shopping-list?items=${itemsParam}&lat=${location.lat}&lon=${location.lon}`);
            const data = await res.json();
            setShoppingResults(data.results || []);
            setShoppingSummary(data.summary || []);
        } catch (error) {
            console.error("Failed to search shopping list", error);
            setShoppingResults([]);
            setShoppingSummary([]);
        } finally {
            setShoppingLoading(false);
        }
    };

    const SortButton = ({ mode, label }) => (
        <button
            onClick={() => setSortMode(mode)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${sortMode === mode
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
        >
            {label}
        </button>
    );

    // Compute filtered summary from enriched results (not raw API counts)
    const filteredSummary = useMemo(() => {
        const counts = {};
        enrichedShoppingResults.forEach(item => {
            const term = item.searchTerm || 'other';
            counts[term] = (counts[term] || 0) + 1;
        });
        // Include items with 0 results from the API summary
        return shoppingSummary.map(s => ({
            searchTerm: s.searchTerm,
            totalCount: s.count,
            nearbyCount: counts[s.searchTerm] || 0
        }));
    }, [enrichedShoppingResults, shoppingSummary]);

    // How many unique shopping list items does each shop group have?
    const totalShoppingItems = filteredSummary.length;

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 md:flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 mb-4 md:mb-0 cursor-pointer" onClick={() => setViewMode(location ? 'flyers' : 'initial')}>
                        <div className="bg-blue-600 p-2 rounded-xl text-white">
                            <ShoppingBasket size={24} />
                        </div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                            FlyerFinder
                        </h1>
                    </div>

                    <div className="flex-1 max-w-xl">
                        <LocationSearch onLocationSelect={setLocation} />
                    </div>

                    {location && (
                        <div className="hidden md:flex items-center text-sm text-gray-500 gap-1 bg-gray-100 px-3 py-1 rounded-full">
                            <MapPin size={14} />
                            <span className="truncate max-w-[150px]">{location.display_name}</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {!location ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-blue-100 p-8 rounded-full mb-6 animate-pulse">
                            <MapPin size={64} className="text-blue-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-800 mb-4">Find Offers Near You</h2>
                        <p className="text-xl text-gray-500 max-w-md">
                            Enter your address or use your location to see all supermarket flyers and deals nearby.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Tab Switcher */}
                        <div className="mb-6">
                            <div className="flex gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100 max-w-md">
                                <button
                                    onClick={() => { setActiveTab('flyers'); setViewMode('flyers'); }}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'flyers'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <Package size={16} />
                                    Flyers
                                </button>
                                <button
                                    onClick={() => { setActiveTab('shopping'); setViewMode('shopping'); }}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'shopping'
                                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <ShoppingCart size={16} />
                                    Shopping List
                                </button>
                            </div>
                        </div>

                        {/* Distance Slider + Search (for flyers tab) */}
                        {activeTab === 'flyers' && (
                            <div className="mb-8 space-y-6">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                                            <MapPin size={18} />
                                        </div>
                                        <span className="font-semibold text-gray-700">
                                            Distance Radius: {maxDistance < 1000 ? `${maxDistance} m` : `${(maxDistance / 1000).toFixed(1)} km`}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="100"
                                        max="5000"
                                        step="100"
                                        value={maxDistance}
                                        onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1 font-medium">
                                        <span>100 m</span>
                                        <span>5 km</span>
                                    </div>
                                </div>

                                <ProductSearch onSearch={handleProductSearch} />
                            </div>
                        )}

                        {/* Shopping List Tab Content */}
                        {activeTab === 'shopping' && (
                            <div className="mb-8 space-y-6">
                                {/* Distance slider for shopping too */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-1.5 bg-violet-100 rounded-lg text-violet-600">
                                            <MapPin size={18} />
                                        </div>
                                        <span className="font-semibold text-gray-700">
                                            Distance Radius: {maxDistance < 1000 ? `${maxDistance} m` : `${(maxDistance / 1000).toFixed(1)} km`}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="100"
                                        max="5000"
                                        step="100"
                                        value={maxDistance}
                                        onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1 font-medium">
                                        <span>100 m</span>
                                        <span>5 km</span>
                                    </div>
                                </div>

                                <ShoppingList onSearchAll={handleShoppingSearch} isSearching={shoppingLoading} />
                            </div>
                        )}

                        {/* Content Area */}
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : activeTab === 'flyers' && viewMode === 'products' ? (
                            /* Single product search results */
                            <div>
                                <button
                                    onClick={() => setViewMode('flyers')}
                                    className="mb-6 flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium transition-colors"
                                >
                                    <ArrowLeft size={20} /> Back to Flyers
                                </button>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-800">
                                        Found {sortedResults.length} results
                                    </h2>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <ArrowUpDown size={16} className="text-gray-400" />
                                        <span className="text-sm text-gray-500 font-medium">Sort:</span>
                                        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
                                            <SortButton mode="price-asc" label="Price ↑" />
                                            <SortButton mode="price-desc" label="Price ↓" />
                                            <SortButton mode="dist-asc" label="Nearest" />
                                            <SortButton mode="dist-desc" label="Farthest" />
                                            <SortButton mode="name-asc" label="Shop A→Z" />
                                            <SortButton mode="name-desc" label="Shop Z→A" />
                                        </div>
                                    </div>
                                </div>

                                {sortedResults.length === 0 ? (
                                    <p className="text-gray-500">No products found matching your search.</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {sortedResults.map((item, idx) => (
                                            <div key={`${item.product.id}-${idx}`} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                                                {item.product.image && (
                                                    <div className="relative h-48 mb-3 overflow-hidden rounded-lg bg-gray-50">
                                                        <img
                                                            src={`/api/image-proxy?url=${encodeURIComponent(item.product.image)}`}
                                                            alt={item.product.name}
                                                            className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-300"
                                                            onError={(e) => { e.target.style.display = 'none' }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-start mb-2">
                                                    <a
                                                        href={getGoogleMapsUrl(item.supermarket.name)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-colors truncate max-w-[65%] cursor-pointer"
                                                        title={`View ${item.supermarket.name} on Google Maps`}
                                                    >
                                                        <span className="truncate">{item.supermarket.name}</span>
                                                        <ExternalLink size={10} className="flex-shrink-0 opacity-60" />
                                                    </a>
                                                    {item.product.price && (
                                                        <span className="text-lg font-bold text-blue-600">€{item.product.price.toFixed(2)}</span>
                                                    )}
                                                </div>
                                                {item.distance !== null && (
                                                    <div className="flex items-center gap-1 mb-2">
                                                        <Navigation size={12} className="text-emerald-500" />
                                                        <span className="text-xs font-medium text-emerald-600">
                                                            {formatDistance(item.distance)}
                                                        </span>
                                                    </div>
                                                )}
                                                <h3 className="font-semibold text-gray-800 line-clamp-2 min-h-[3rem]">{item.product.name}</h3>
                                                <p className="text-sm text-gray-500">{item.product.unit}</p>
                                                {item.product.discount && (
                                                    <div className="mt-2 inline-block bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">
                                                        {item.product.discount}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'flyers' && viewMode === 'flyers' ? (
                            /* Flyer grid */
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-6">Nearby Flyers</h2>
                                <FlyerGrid supermarkets={filteredSupermarkets} />
                            </div>
                        ) : activeTab === 'shopping' ? (
                            /* Shopping list results */
                            <div>
                                {shoppingLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mb-4"></div>
                                        <p className="text-gray-500 font-medium">Searching for the best deals...</p>
                                        <p className="text-gray-400 text-sm mt-1">This may take a moment for multiple items</p>
                                    </div>
                                ) : enrichedShoppingResults.length > 0 ? (
                                    <>
                                        {/* Summary Bar */}
                                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <h2 className="text-xl font-bold text-gray-800">
                                                        Results: {enrichedShoppingResults.length} products from {groupedByShop.length} shops
                                                    </h2>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {filteredSummary.map(s => (
                                                            <span key={s.searchTerm} className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.nearbyCount > 0
                                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                                : 'bg-red-50 text-red-600 border border-red-200'
                                                                }`}>
                                                                {s.searchTerm}: {s.nearbyCount} nearby
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Group mode toggle */}
                                                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                                                    <button
                                                        onClick={() => setShoppingGroupMode('by-shop')}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${shoppingGroupMode === 'by-shop'
                                                            ? 'bg-white text-violet-600 shadow-sm'
                                                            : 'text-gray-500 hover:text-gray-700'
                                                            }`}
                                                    >
                                                        <Store size={14} />
                                                        By Shop
                                                    </button>
                                                    <button
                                                        onClick={() => setShoppingGroupMode('by-item')}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${shoppingGroupMode === 'by-item'
                                                            ? 'bg-white text-violet-600 shadow-sm'
                                                            : 'text-gray-500 hover:text-gray-700'
                                                            }`}
                                                    >
                                                        <List size={14} />
                                                        By Item
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* BY SHOP VIEW */}
                                        {shoppingGroupMode === 'by-shop' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                {groupedByShop.map((shop, idx) => (
                                                    <div key={shop.name} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow">
                                                        {/* Shop Header */}
                                                        <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100">
                                                            <div className="flex items-center justify-between">
                                                                <a
                                                                    href={getGoogleMapsUrl(shop.name)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                                                >
                                                                    <div className="p-1.5 bg-violet-100 rounded-lg">
                                                                        <Store size={18} className="text-violet-600" />
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="font-bold text-gray-800 flex items-center gap-1">
                                                                            {shop.name}
                                                                            <ExternalLink size={12} className="text-gray-400" />
                                                                        </h3>
                                                                        {shop.distance !== null && (
                                                                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
                                                                                <Navigation size={10} />
                                                                                {formatDistance(shop.distance)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </a>
                                                                <div className="text-right">
                                                                    <span className="text-xs text-gray-400 font-medium">
                                                                        {shop.itemCount}/{totalShoppingItems} items
                                                                    </span>
                                                                    {/* Coverage bar */}
                                                                    <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all"
                                                                            style={{ width: `${(shop.itemCount / totalShoppingItems) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Items List */}
                                                        <div className="p-4 space-y-2.5">
                                                            {Object.entries(shop.items).map(([term, item]) => (
                                                                <div key={term} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-xs font-bold text-violet-500 uppercase tracking-wider">{term}</span>
                                                                        <p className="text-sm text-gray-700 font-medium truncate">{item.product.name}</p>
                                                                    </div>
                                                                    {item.product.price && (
                                                                        <span className="text-sm font-bold text-gray-800 ml-3 whitespace-nowrap">
                                                                            €{item.product.price.toFixed(2)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Total */}
                                                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                                            <span className="text-sm font-semibold text-gray-600">Estimated Total</span>
                                                            <span className="text-lg font-black text-violet-600">
                                                                €{shop.totalPrice.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* BY ITEM VIEW */}
                                        {shoppingGroupMode === 'by-item' && (
                                            <div className="space-y-8">
                                                {Object.entries(groupedByItem).map(([term, items]) => (
                                                    <div key={term}>
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <span className="text-sm font-bold text-white bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-1 rounded-full uppercase tracking-wider">
                                                                {term}
                                                            </span>
                                                            <span className="text-sm text-gray-400 font-medium">{items.length} results</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                            {items.map((item, idx) => (
                                                                <div key={`${item.product.id}-${idx}`} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                                                                    {item.product.image && (
                                                                        <div className="relative h-40 mb-3 overflow-hidden rounded-lg bg-gray-50">
                                                                            <img
                                                                                src={`/api/image-proxy?url=${encodeURIComponent(item.product.image)}`}
                                                                                alt={item.product.name}
                                                                                className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-300"
                                                                                onError={(e) => { e.target.style.display = 'none' }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <a
                                                                            href={getGoogleMapsUrl(item.supermarket.name)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors truncate max-w-[65%] cursor-pointer"
                                                                        >
                                                                            <span className="truncate">{item.supermarket.name}</span>
                                                                            <ExternalLink size={10} className="flex-shrink-0 opacity-60" />
                                                                        </a>
                                                                        {item.product.price && (
                                                                            <span className="text-lg font-bold text-violet-600">€{item.product.price.toFixed(2)}</span>
                                                                        )}
                                                                    </div>
                                                                    {item.distance !== null && (
                                                                        <div className="flex items-center gap-1 mb-2">
                                                                            <Navigation size={12} className="text-emerald-500" />
                                                                            <span className="text-xs font-medium text-emerald-600">
                                                                                {formatDistance(item.distance)}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    <h3 className="font-semibold text-gray-800 line-clamp-2 text-sm">{item.product.name}</h3>
                                                                    {item.product.discount && (
                                                                        <div className="mt-2 inline-block bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">
                                                                            {item.product.discount}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : !shoppingLoading && viewMode === 'shopping' && shoppingResults.length === 0 && shoppingSummary.length > 0 ? (
                                    <div className="text-center py-16 text-gray-400">
                                        <Package size={48} className="mx-auto mb-4 opacity-30" />
                                        <p className="text-lg font-medium text-gray-500">No products found nearby</p>
                                        <p className="text-sm mt-1">Try increasing the distance radius or modifying your shopping list</p>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </main>
    );
}
