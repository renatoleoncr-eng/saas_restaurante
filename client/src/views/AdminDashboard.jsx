import React from 'react';
import AdminLayoutManager from '../components/AdminLayoutManager';

export default function AdminDashboard({ onGoToSection }) {
    return (
        <div className="bg-gray-50 flex flex-col min-h-screen">
            <main className="flex-1">
                <AdminLayoutManager onGoToSection={onGoToSection} />
            </main>
        </div>
    );
}
