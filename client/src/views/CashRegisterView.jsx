import React, { useState } from 'react';
import { ArrowLeftRight, FileText, LayoutList } from 'lucide-react';
import CashFlowTab from '../components/CashFlowTab';
import SessionsHistoryTab from '../components/SessionsHistoryTab';
import AccountsHistoryTab from '../components/AccountsHistoryTab';
import MobileTabMenu from '../components/MobileTabMenu';

export default function CashRegisterView() {
    const [activeTab, setActiveTab] = useState('cashflow'); // 'cashflow' | 'sessions' | 'accounts'

    return (
        <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
            {/* Header and Tabs */}
            <div className="bg-white border-b shrink-0 pt-2 px-4 sm:px-6">
                
                {/* Desktop Tabs */}
                <div className="hidden sm:flex overflow-x-auto custom-scrollbar -mb-px">
                    <div className="flex gap-5 sm:gap-8 min-w-max text-sm sm:text-base pr-4">
                        <button
                            onClick={() => setActiveTab('cashflow')}
                            className={`pb-3 font-bold transition-colors relative flex items-center gap-2 whitespace-nowrap px-1 ${
                                activeTab === 'cashflow' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <ArrowLeftRight size={18} />
                            Ingresos/Egresos
                            {activeTab === 'cashflow' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
                        </button>
                        
                        <button
                            onClick={() => setActiveTab('sessions')}
                            className={`pb-3 font-bold transition-colors relative flex items-center gap-2 whitespace-nowrap px-1 ${
                                activeTab === 'sessions' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <FileText size={18} />
                            Cierres de turno
                            {activeTab === 'sessions' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
                        </button>

                        <button
                            onClick={() => setActiveTab('accounts')}
                            className={`pb-3 font-bold transition-colors relative flex items-center gap-2 whitespace-nowrap px-1 ${
                                activeTab === 'accounts' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <LayoutList size={18} />
                            Historial de cuentas
                            {activeTab === 'accounts' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
                        </button>
                    </div>
                </div>

                {/* Mobile Dropdown Menu */}
                <div className="sm:hidden mb-3">
                    <MobileTabMenu
                        tabs={[
                            { id: 'cashflow', label: 'Ingresos/Egresos', icon: ArrowLeftRight },
                            { id: 'sessions', label: 'Cierres de turno', icon: FileText },
                            { id: 'accounts', label: 'Historial de cuentas', icon: LayoutList }
                        ]}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                </div>
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'cashflow' && <CashFlowTab />}
                {activeTab === 'sessions' && <div className="p-3 sm:p-6"><SessionsHistoryTab /></div>}
                {activeTab === 'accounts' && <AccountsHistoryTab />}
            </div>
        </div>
    );
}
