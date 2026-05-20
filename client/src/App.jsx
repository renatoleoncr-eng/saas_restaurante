import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { RestaurantProvider, useRestaurant } from './contexts/RestaurantContext'
import Dashboard from './views/Dashboard'
import Login from './views/Login'
import QrDisplay from './views/QrDisplay'
import ErrorBoundary from './components/ErrorBoundary'

// Wrapper to protect routes
const PrivateRoute = ({ children }) => {
    const { user } = useRestaurant();
    return user ? children : <Navigate to="/login" />;
};

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/qr-display" element={<QrDisplay />} />
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
