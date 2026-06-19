import React, { useState } from 'react';
import { List, ChevronDown, ChevronUp } from 'lucide-react';

export default function MobileTabMenu({ tabs, activeTab, onTabChange }) {
    const [isOpen, setIsOpen] = useState(false);

    const activeTabObj = tabs.find(t => t.id === activeTab);
    const activeTabLabel = activeTabObj?.label || 'Menú';
    const ActiveIcon = activeTabObj?.icon || List;

    return (
        <div className="md:hidden relative z-10">
            {/* BACKDROP */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/5 z-30"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border rounded-lg shadow-sm p-3 flex justify-between items-center text-gray-800 font-bold relative z-40"
            >
                <div className="flex items-center gap-2">
                    <ActiveIcon size={20} className="text-blue-600 shrink-0" />
                    <span>{activeTabLabel}</span>
                </div>
                {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {isOpen && (
                <div className="mt-2 bg-white rounded-lg shadow-lg border overflow-hidden animate-in fade-in slide-in-from-top-2 absolute z-40 w-full left-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                onTabChange(tab.id);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 border-b last:border-0 flex items-center gap-3 transition-colors
                                ${activeTab === tab.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            {tab.icon && <tab.icon size={18} className="shrink-0" />}
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
