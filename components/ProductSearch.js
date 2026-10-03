'use client';

import { Search, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ProductSearch({ onSearch }) {
    const [term, setTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            onSearch(term);
            setIsSearching(false);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [term]);

    const handleChange = (e) => {
        setTerm(e.target.value);
        setIsSearching(true);
    };

    return (
        <div className="relative w-full max-w-lg mx-auto mb-8">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </div>
            <input
                type="text"
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all text-lg"
                placeholder="Search for products (e.g., Milk, Pasta)..."
                value={term}
                onChange={handleChange}
            />
        </div>
    );
}
