import React, { useState } from 'react';
import { Settings, List, History } from 'lucide-react';
import MenuConfig from '../components/MenuConfig';
import StockDashboard from '../components/StockDashboard';
import { useRestaurant } from '../contexts/RestaurantContext';
import MobileTabMenu from '../components/MobileTabMenu';

export default function MenuView() {
    const { user } = useRestaurant();
    const [activeTab, setActiveTab] = useState('config'); // 'config', 'options', 'history'

    const tabs = [
        { id: 'config', label: 'Configuración', icon: Settings },
        { id: 'options', label: 'Opciones Menú', icon: List },
        { id: 'history', label: 'Historial', icon: History }
    ];

    return (
        <div className="bg-gray-50 flex flex-col">
            <div className="p-4 md:hidden">
                <MobileTabMenu tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            {/* Sub-Header Navigation (Desktop) */}
            <div className="hidden md:flex bg-white border-b px-6 py-2 gap-4 shadow-sm">
                <button
                    onClick={() => setActiveTab('config')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors
                    ${activeTab === 'config' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <Settings size={18} /> Configuración
                </button>
                <button
                    onClick={() => setActiveTab('options')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors
                    ${activeTab === 'options' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <List size={18} /> Opciones Menú
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors
                    ${activeTab === 'history' ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <History size={18} /> Historial de Movimientos
                </button>
            </div>

            {/* Content */}
            <main className="flex-1 p-2 md:p-4">
                {activeTab === 'config' && (
                    <div className="animate-in fade-in">
                        <MenuConfig forcedTab="config" showTabs={false} />
                    </div>
                )}

                {activeTab === 'options' && (
                    <div className="animate-in fade-in">
                        <StockDashboard readOnly={user.role !== 'admin' && user.role !== 'waiter'} mode="menu_only" />
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="animate-in fade-in">
                        <MenuConfig forcedTab="movements" showTabs={false} />
                    </div>
                )}
            </main>
        </div>
    );
}
