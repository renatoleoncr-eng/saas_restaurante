/**
 * useSuperAdmin hook
 * Manages super admin authentication and all tenant management API calls.
 * Uses a separate token stored as 'saas_admin_token' in localStorage.
 */

import { useState, useCallback } from 'react';

const API_BASE = '/api/superadmin';

export function useSuperAdmin() {
    const [token, setToken] = useState(() => localStorage.getItem('saas_admin_token') || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const isAuthenticated = !!token;

    // ── Helpers ──────────────────────────────────────────────────────────────

    const authHeaders = useCallback(() => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
    }), [token]);

    const handleResponse = async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    };

    // ── Auth ─────────────────────────────────────────────────────────────────

    const login = useCallback(async (apiKey) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey })
            });
            const data = await handleResponse(res);
            localStorage.setItem('saas_admin_token', data.token);
            setToken(data.token);
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('saas_admin_token');
        setToken(null);
    }, []);

    // ── Tenants ──────────────────────────────────────────────────────────────

    const fetchTenants = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/tenants`, { headers: authHeaders() });
            return await handleResponse(res);
        } catch (err) {
            setError(err.message);
            if (err.message.includes('401') || err.message.includes('Autenticación')) {
                logout();
            }
            throw err;
        } finally {
            setLoading(false);
        }
    }, [authHeaders, logout]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/stats`, { headers: authHeaders() });
            return await handleResponse(res);
        } catch (err) {
            // Non-critical, silently fail
            return null;
        }
    }, [authHeaders]);

    const updateStatus = useCallback(async (tenantId, status) => {
        const res = await fetch(`${API_BASE}/tenants/${tenantId}/status`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ status })
        });
        return handleResponse(res);
    }, [authHeaders]);

    const updatePlan = useCallback(async (tenantId, plan) => {
        const res = await fetch(`${API_BASE}/tenants/${tenantId}/plan`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ plan })
        });
        return handleResponse(res);
    }, [authHeaders]);

    const updateStorage = useCallback(async (tenantId, storageLimitMb) => {
        const res = await fetch(`${API_BASE}/tenants/${tenantId}/storage`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ storageLimitMb })
        });
        return handleResponse(res);
    }, [authHeaders]);

    const updateNotes = useCallback(async (tenantId, internalNotes) => {
        const res = await fetch(`${API_BASE}/tenants/${tenantId}/notes`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ internalNotes })
        });
        return handleResponse(res);
    }, [authHeaders]);

    const resetAdminPassword = useCallback(async (tenantId, newPassword) => {
        const res = await fetch(`${API_BASE}/tenants/${tenantId}/reset-admin-password`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ newPassword })
        });
        return handleResponse(res);
    }, [authHeaders]);

    const deleteTenant = useCallback(async (tenantId) => {
        const res = await fetch(`${API_BASE}/tenants/${tenantId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        return handleResponse(res);
    }, [authHeaders]);

    return {
        isAuthenticated,
        loading,
        error,
        login,
        logout,
        fetchTenants,
        fetchStats,
        updateStatus,
        updatePlan,
        updateStorage,
        updateNotes,
        resetAdminPassword,
        deleteTenant
    };
}
