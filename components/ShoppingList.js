'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, X, Trash2, Search, ShoppingCart, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'flyerfinder-shopping-list';

export default function ShoppingList({ onSearchAll, isSearching }) {
    const [items, setItems] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef(null);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setItems(JSON.parse(stored));
        } catch (e) { }
    }, []);

    // Save to localStorage on change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (e) { }
    }, [items]);

    const addItem = () => {
        const trimmed = inputValue.trim();
        if (!trimmed) return;
        // Avoid duplicates (case-insensitive)
        if (items.some(i => i.toLowerCase() === trimmed.toLowerCase())) {
            setInputValue('');
            return;
        }
        setItems(prev => [...prev, trimmed]);
        setInputValue('');
        inputRef.current?.focus();
    };

    const removeItem = (index) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const clearAll = () => {
        setItems([]);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        }
    };

    const handleSearchAll = () => {
        if (items.length === 0) return;
        onSearchAll(items);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg text-white">
                        <ShoppingCart size={18} />
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg">Shopping List</h3>
                    {items.length > 0 && (
                        <span className="ml-1 text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                            {items.length} {items.length === 1 ? 'item' : 'items'}
                        </span>
                    )}
                </div>
                {items.length > 0 && (
                    <button
                        onClick={clearAll}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors font-medium"
                    >
                        <Trash2 size={14} />
                        Clear All
                    </button>
                )}
            </div>

            {/* Input Row */}
            <div className="px-5 pb-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Add an item (e.g. Milk, Pasta, Bread...)"
                            className="w-full pl-4 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-all text-sm"
                        />
                    </div>
                    <button
                        onClick={addItem}
                        disabled={!inputValue.trim()}
                        className="px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold text-sm hover:from-violet-600 hover:to-purple-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
                    >
                        <Plus size={16} />
                        Add
                    </button>
                </div>
            </div>

            {/* Item Chips */}
            <div className="px-5 pb-4">
                {items.length === 0 ? (
                    <div className="text-center py-6 text-gray-400">
                        <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Your shopping list is empty.</p>
                        <p className="text-xs mt-1">Add items above, then search for the best deals!</p>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 mb-4">
                        <AnimatePresence>
                            {items.map((item, index) => (
                                <motion.span
                                    key={item}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="shopping-chip inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-full text-sm font-medium text-violet-700"
                                >
                                    {item}
                                    <button
                                        onClick={() => removeItem(index)}
                                        className="p-0.5 hover:bg-violet-200 rounded-full transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </motion.span>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {/* Search All Button */}
                {items.length > 0 && (
                    <button
                        onClick={handleSearchAll}
                        disabled={isSearching}
                        className="w-full py-3.5 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 text-white rounded-xl font-bold text-sm hover:from-violet-600 hover:via-purple-600 hover:to-indigo-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                    >
                        {isSearching ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                Searching {items.length} items...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                Find Best Deals for {items.length} {items.length === 1 ? 'Item' : 'Items'}
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
