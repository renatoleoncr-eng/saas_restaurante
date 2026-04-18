import React from 'react';
import AdminLayoutManager from '../components/AdminLayoutManager';

export default function AdminDashboard() {
    return (
        <div className="bg-gray-100 flex flex-col">
            <main className="flex-1">
                <AdminLayoutManager />
            </main>
        </div>
    );
}
