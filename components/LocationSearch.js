'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function LocationSearch({ onLocationSelect }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchTimeout = useRef(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = (e) => {
        const val = e.target.value;
        setQuery(val);

        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (val.length < 3) {
            setResults([]);
            setShowResults(false);
            return;
        }

        setLoading(true);
        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/geocode?q=${encodeURIComponent(val)}`);
                const data = await res.json();
                setResults(data);
                setShowResults(true);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }, 500);
    };

    const getUserLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // Reverse geocoding optional, but we pass coords directly
                onLocationSelect({
                    lat: latitude,
                    lon: longitude,
                    display_name: 'My Location'
                });
                setLoading(false);
            },
            () => {
                alert('Unable to retrieve your location');
                setLoading(false);
            }
        );
    };

    const selectLocation = (loc) => {
        setQuery(loc.display_name.split(',')[0]); // Shorten name for display
        setResults([]);
        setShowResults(false);
        onLocationSelect({
            lat: loc.lat,
            lon: loc.lon,
            display_name: loc.display_name
        });
    };

    return (
        <div className="w-full max-w-md mx-auto relative z-50" ref={wrapperRef}>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Search size={20} />
                </div>
                <input
                    type="text"
                    className="w-full pl-10 pr-12 py-3 bg-white/90 backdrop-blur-md border border-gray-200 rounded-full shadow-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your address..."
                    value={query}
                    onChange={handleSearch}
                    onFocus={() => results.length > 0 && setShowResults(true)}
                />
                <button
                    onClick={getUserLocation}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-500 hover:text-blue-600 transition-colors"
                    title="Use my location"
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <MapPin size={20} />}
                </button>
            </div>

            <AnimatePresence>
                {showResults && results.length > 0 && (
                    <motion.ul
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto"
                    >
                        {results.map((item) => (
                            <li
                                key={item.place_id}
                                onClick={() => selectLocation(item)}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 border-b border-gray-50 last:border-0"
                            >
                                <MapPin size={16} className="text-gray-400 shrink-0" />
                                <span className="text-sm text-gray-700 clamp-1">{item.display_name}</span>
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
