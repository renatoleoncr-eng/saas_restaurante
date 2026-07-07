import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { RestaurantProvider, useRestaurant } from './contexts/RestaurantContext'
import Dashboard from './views/Dashboard'
import Login from './views/Login'
import Landing from './views/Landing'
import Register from './views/Register'
import QrDisplay from './views/QrDisplay'
import PublicReceipt from './views/PublicReceipt'
import ErrorBoundary from './components/ErrorBoundary'
import SuperAdminLogin from './views/SuperAdminLogin'
import SuperAdminDashboard from './views/SuperAdminDashboard'

// Wrapper to protect restaurant routes
const PrivateRoute = ({ children }) => {
    const { user } = useRestaurant();
    return user ? children : <Navigate to="/login" />;
};

// Wrapper to protect super admin routes
const SuperAdminRoute = ({ children }) => {
    const token = localStorage.getItem('saas_admin_token');
    return token ? children : <Navigate to="/login" />;
};

// Main app — routes based on whether we're on landing, admin, or tenant subdomain
function AppRoutes() {
    const { isLanding, tenantSlug, tenantInfo } = useRestaurant();

    // Super admin panel: admin.maksuites.com.pe
    if (tenantSlug === 'admin') {
        return (
            <Routes>
                <Route path="/login" element={<SuperAdminLogin />} />
                <Route path="/" element={
                    <SuperAdminRoute>
                        <SuperAdminDashboard />
                    </SuperAdminRoute>
                } />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        );
    }

    // Main domain (maksuites.com.pe) — show landing page
    if (isLanding) {
        return (
            <Routes>
                <Route path="/registro" element={<Register />} />
                <Route path="/" element={<Landing />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        );
    }

    // Tenant subdomain (slug.maksuites.com.pe) — show restaurant app
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/qr-display" element={<QrDisplay />} />
            <Route path="/c/:hash" element={<PublicReceipt />} />
            <Route path="/" element={
                <PrivateRoute>
                    <Dashboard />
                </PrivateRoute>
            } />
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <RestaurantProvider>
                <AppRoutes />
            </RestaurantProvider>
        </ErrorBoundary>
    )
}

export default App
