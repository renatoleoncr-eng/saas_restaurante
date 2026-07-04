import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const RestaurantContext = createContext();

export const useRestaurant = () => useContext(RestaurantContext);

// =============================================
// TENANT DETECTION
// =============================================
function detectTenantSlug() {
    const hostname = window.location.hostname;
    const mainDomains = ['maksuites.com.pe', 'localhost', '127.0.0.1'];

    for (const domain of mainDomains) {
        if (domain === 'localhost' || domain === '127.0.0.1') continue;
        if (hostname.endsWith('.' + domain)) {
            const slug = hostname.replace('.' + domain, '');
            if (slug && !slug.includes('.')) {
                return slug;
            }
        }
    }

    // Dev mode: check for tenant in URL params
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get('tenant');
    if (tenantParam) return tenantParam;

    return null;
}

function isMainDomain() {
    const hostname = window.location.hostname;
    const mainDomains = ['maksuites.com.pe', 'localhost', '127.0.0.1'];
    // Check if we're on the main domain (no subdomain)
    return mainDomains.includes(hostname) || hostname === 'www.maksuites.com.pe';
}

// =============================================
// AXIOS INTERCEPTORS SETUP
// =============================================
function setupAxiosInterceptors(tenantSlug) {
    // Add tenant header for dev mode
    axios.interceptors.request.use((config) => {
        // Add JWT token to all requests
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Add tenant slug header for dev mode (when not using subdomains)
        if (tenantSlug && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            config.headers['X-Tenant-Slug'] = tenantSlug;
        }

        return config;
    });

    // Handle 401 responses (token expired)
    axios.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                const code = error.response?.data?.code;
                if (code === 'TOKEN_EXPIRED') {
                    // Try to refresh the token
                    return refreshAndRetry(error.config);
                }
            }
            return Promise.reject(error);
        }
    );
}

async function refreshAndRetry(originalRequest) {
    try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            throw new Error('No refresh token');
        }

        const res = await axios.post('/api/auth/refresh', { refreshToken });
        const { token, refreshToken: newRefreshToken } = res.data;

        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', newRefreshToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return axios(originalRequest);
    } catch (err) {
        // Refresh failed — clear auth and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(err);
    }
}

export const RestaurantProvider = ({ children }) => {
    const [config, setConfig] = useState(null);
    const [areas, setAreas] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [socket, setSocket] = useState(null);
    const [tenantSlug] = useState(() => detectTenantSlug());
    const [tenantInfo, setTenantInfo] = useState(null);
    const [isLanding, setIsLanding] = useState(() => isMainDomain() && !detectTenantSlug());
    const [user, setUser] = useState(() => {
        try {
            const item = localStorage.getItem('user');
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error("Error parsing user from localstorage", e);
            return null;
        }
    });

    // Setup axios interceptors once
    useEffect(() => {
        setupAxiosInterceptors(tenantSlug);
    }, [tenantSlug]);

    const refreshData = () => setRefreshTrigger(prev => prev + 1);

    // =============================================
    // TENANT INFO LOADING
    // =============================================
    useEffect(() => {
        if (!tenantSlug) return;

        axios.get('/api/tenants/info')
            .then(res => {
                setTenantInfo(res.data);
                setIsLanding(false);
            })
            .catch(err => {
                console.error("Error loading tenant info:", err);
                // If tenant not found, show landing
                if (err.response?.status === 404) {
                    setIsLanding(true);
                }
            });
    }, [tenantSlug]);

    // =============================================
    // SOCKET CONNECTION (Tenant-Scoped)
    // =============================================
    useEffect(() => {
        if (isLanding) return;

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const socketUrl = isLocalhost ? 'http://localhost:3003' : window.location.origin;
        console.log("Connecting socket to:", socketUrl);

        const newSocket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        newSocket.on('connect', () => {
            console.log("Socket connected:", newSocket.id);

            // Join tenant room for scoped events
            if (tenantInfo?.id) {
                newSocket.emit('join_tenant', tenantInfo.id);
            }

            refreshData();
        });

        newSocket.on('connect_error', (err) => {
            console.error("Socket error:", err);
        });

        // Listen for updates
        newSocket.on('new_order', () => {
            console.log("New Order received!");
            refreshData();
        });

        newSocket.on('order_updated', () => {
            console.log("Order updated!");
            refreshData();
        });

        newSocket.on('product_updated', () => {
            console.log("Products updated! Refreshing data...");
            refreshData();
        });

        newSocket.on('table_updated', (data) => {
            console.log("Table updated! Refreshing data...", data);
            refreshData();
        });

        setSocket(newSocket);
        return () => newSocket.close();
    }, [isLanding, tenantInfo?.id]);

    // =============================================
    // AUTH FUNCTIONS
    // =============================================
    const login = async (username, password) => {
        try {
            const res = await axios.post('/api/login', { username, password });
            const { token, refreshToken, user: userData } = res.data;

            // Store tokens
            localStorage.setItem('token', token);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(userData));

            setUser(userData);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
    };

    // Initial Config Load
    useEffect(() => {
        if (isLanding || !tenantSlug) return;
        axios.get('/api/config')
            .then(res => setConfig(res.data))
            .catch(err => console.error("Error loading config:", err));
    }, [refreshTrigger, isLanding, tenantSlug]);

    // Initial Areas Load
    useEffect(() => {
        if (user && !isLanding && tenantSlug) {
            axios.get('/api/areas')
                .then(res => setAreas(res.data))
                .catch(err => console.error("Error loading areas:", err));
        }
    }, [refreshTrigger, user, isLanding, tenantSlug]);

    const updateConfig = async (newConfig) => {
        await axios.put('/api/config', newConfig);
        refreshData();
    };

    const [reservations, setReservations] = useState([]);

    // ...

    // Initial Reservations Load
    useEffect(() => {
        if (isLanding || !tenantSlug) return;
        axios.get('/api/reservations?status=confirmed')
            .then(res => setReservations(res.data))
            .catch(err => console.error("Error loading reservations:", err));
    }, [refreshTrigger, isLanding, tenantSlug]);

    // ...

    return (
        <RestaurantContext.Provider value={{
            config, areas, refreshData, refreshTrigger, updateConfig,
            user, login, logout, socket, reservations,
            tenantSlug, tenantInfo, isLanding
        }}>
            {children}
        </RestaurantContext.Provider>
    );
};
