import React, { useState } from 'react';
import { ArrowLeftRight, FileText, LayoutList } from 'lucide-react';
import CashFlowTab from '../components/CashFlowTab';
import SessionsHistoryTab from '../components/SessionsHistoryTab';
import AccountsHistoryTab from '../components/AccountsHistoryTab';

export default function CashRegisterView() {
    const [activeTab, setActiveTab] = useState('cashflow'); // 'cashflow' | 'sessions' | 'accounts'

    return (
        <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
            {/* Header and Tabs */}
            <div className="bg-white border-b shrink-0 pt-2 px-4 sm:px-6">
                
                {/* Mobile-friendly Tabs */}
                <div className="flex overflow-x-auto custom-scrollbar -mb-px">
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
