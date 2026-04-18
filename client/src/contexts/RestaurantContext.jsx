import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const RestaurantContext = createContext();

export const useRestaurant = () => useContext(RestaurantContext);

export const RestaurantProvider = ({ children }) => {
    const [config, setConfig] = useState(null);
    const [areas, setAreas] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [socket, setSocket] = useState(null);
    const [user, setUser] = useState(() => {
        try {
            const item = localStorage.getItem('user');
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error("Error parsing user from localstorage", e);
            return null;
        }
    });

    const refreshData = () => setRefreshTrigger(prev => prev + 1);

    // Initial Socket Connection
    useEffect(() => {
        // Direct connection to backend port (3003)
        // In development, connect directly to avoid Vite proxy issues with WebSocket
        const socketUrl = `http://localhost:3003`;
        console.log("Connecting socket to:", socketUrl);

        const newSocket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        newSocket.on('connect', () => {
            console.log("Socket connected:", newSocket.id);
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
    }, []);

    const login = async (username, password) => {
        try {
            const res = await axios.post('/api/login', { username, password });
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
    };

    // Initial Config Load
    useEffect(() => {
        axios.get('/api/config')
            .then(res => setConfig(res.data))
            .catch(err => console.error("Error loading config:", err));
    }, [refreshTrigger]);

    // Initial Areas Load
    useEffect(() => {
        if (user) {
            axios.get('/api/areas')
                .then(res => setAreas(res.data))
                .catch(err => console.error("Error loading areas:", err));
        }
    }, [refreshTrigger, user]);

    const updateConfig = async (newConfig) => {
        await axios.put('/api/config', newConfig);
        refreshData();
    };

    const [reservations, setReservations] = useState([]);

    // ...

    // Initial Reservations Load
    useEffect(() => {
        axios.get('/api/reservations?status=confirmed')
            .then(res => setReservations(res.data))
            .catch(err => console.error("Error loading reservations:", err));
    }, [refreshTrigger]);

    // ...

    return (
        <RestaurantContext.Provider value={{ config, areas, refreshData, refreshTrigger, updateConfig, user, login, logout, socket, reservations }}>
            {children}
        </RestaurantContext.Provider>
    );
};
