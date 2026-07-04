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

// Wrapper to protect routes
const PrivateRoute = ({ children }) => {
    const { user } = useRestaurant();
    return user ? children : <Navigate to="/login" />;
};

// Main app — routes based on whether we're on landing or tenant subdomain
function AppRoutes() {
    const { isLanding, tenantSlug, tenantInfo } = useRestaurant();

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
