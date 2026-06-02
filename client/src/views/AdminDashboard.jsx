import React from 'react';
import AdminLayoutManager from '../components/AdminLayoutManager';

export default function AdminDashboard() {
    return (
        <div className="bg-gray-50 flex flex-col min-h-screen">
            <main className="flex-1">
                <AdminLayoutManager />
            </main>
        </div>
    );
}
