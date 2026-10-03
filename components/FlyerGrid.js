'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, X, Calendar } from 'lucide-react';
import clsx from 'clsx';

export default function FlyerGrid({ supermarkets }) {
    const [selectedSupermarket, setSelectedSupermarket] = useState(null);
    const [flyerDetails, setFlyerDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        if (selectedSupermarket && selectedSupermarket.flyer.url) {
            setLoadingDetails(true);
            setFlyerDetails(null);

            fetch(`/api/flyers/${selectedSupermarket.flyer.id}?url=${encodeURIComponent(selectedSupermarket.flyer.url)}`)
                .then(res => res.json())
                .then(data => {
                    setFlyerDetails(data);
                    setLoadingDetails(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoadingDetails(false);
                });
        } else {
            setFlyerDetails(null);
            setLoadingDetails(false);
        }
    }, [selectedSupermarket]);

    if (!supermarkets || supermarkets.length === 0) {
        return (
            <div className="text-center py-20 text-gray-400">
                <p>No supermarkets found nearby.</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
                {supermarkets.map((sm, index) => (
                    <motion.div
                        key={sm.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden cursor-pointer group"
                        onClick={() => setSelectedSupermarket(sm)}
                    >
                        <div
                            className="h-32 flex items-center justify-center relative overflow-hidden"
                            style={{ backgroundColor: sm.color || '#eee' }}
                        >
                            {sm.logo ? (
                                <img src={sm.logo} alt={sm.name} className="h-full w-full object-contain p-8" />
                            ) : (
                                <h3 className="text-3xl font-black text-white tracking-tighter drop-shadow-md z-10 relative">
                                    {sm.name}
                                </h3>
                            )}
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                        </div>

                        <div className="p-5">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{sm.address}</p>
                                    <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                                        <Calendar size={12} />
                                        <span>Valid until {new Date(sm.flyer.endDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full py-2 bg-gray-50 text-gray-700 font-semibold rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                                View Flyer
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            <AnimatePresence>
                {selectedSupermarket && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedSupermarket(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-full max-w-6xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b flex justify-between alignItems-center bg-gray-50">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedSupermarket.name}</h2>
                                    <p className="text-gray-500 text-sm">Valid until {new Date(selectedSupermarket.flyer.endDate).toLocaleDateString()}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedSupermarket(null)}
                                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-6 bg-gray-100/50 flex-1">
                                {loadingDetails ? (
                                    <div className="flex flex-col items-center justify-center h-64">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                                        <p className="text-gray-500">Loading flyer pages...</p>
                                    </div>
                                ) : flyerDetails && flyerDetails.pages ? (
                                    <div className="flex flex-col gap-4 items-center">
                                        {flyerDetails.pages.map((page) => (
                                            <div key={page.id} className="relative w-full max-w-4xl shadow-lg rounded-lg overflow-hidden">
                                                <img
                                                    src={page.image}
                                                    alt={`Page ${page.order + 1}`}
                                                    className="w-full h-auto"
                                                    loading="lazy"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-20 text-gray-400">
                                        <p>No pages found for this flyer.</p>
                                        {!selectedSupermarket.flyer.url && <p className="text-xs mt-2 text-red-400">Error: Missing Flyer URL</p>}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
