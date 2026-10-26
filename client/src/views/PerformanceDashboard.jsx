import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, AreaChart, Area, LabelList
} from 'recharts';
import {
    TrendingUp, Calendar, Users, RefreshCw, AlertCircle, Award
} from 'lucide-react';
import { useRestaurant } from '../contexts/RestaurantContext';

export default function PerformanceDashboard() {
    const { user } = useRestaurant();

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [startDay, setStartDay] = useState(1);
    const [endDay, setEndDay] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [productivityTab, setProductivityTab] = useState('orders'); // 'orders' | 'payments'

    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const daysInMonth = useMemo(() => {
        return new Date(year, month, 0).getDate();
    }, [year, month]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/performance/stats', {
                params: { year, month, startDay, endDay },
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setData(res.data);
            setError(null);
        } catch (err) {
            console.error("Error fetching performance stats:", err);
            setError(err.response?.data?.error || "Error al cargar las estadísticas de rendimiento.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [year, month, startDay, endDay]);

    const handleMonthChange = (newMonth) => {
        const m = parseInt(newMonth, 10);
        setMonth(m);
        const maxDays = new Date(year, m, 0).getDate();
        if (startDay > maxDays) setStartDay(1);
        if (endDay > maxDays || endDay === daysInMonth) setEndDay(maxDays);
    };

    const setRangeAll = () => {
        setStartDay(1);
        setEndDay(daysInMonth);
    };

    const setRangeQ1 = () => {
        setStartDay(1);
        setEndDay(Math.min(15, daysInMonth));
    };

    const setRangeQ2 = () => {
        setStartDay(16);
        setEndDay(daysInMonth);
    };

    const kpis = data?.kpis || {};
    const availableYears = data?.availableYears || [now.getFullYear()];
    const isFullMonth = startDay <= 1 && endDay >= daysInMonth;
    const rangeText = isFullMonth ? '' : ` (Días ${startDay} - ${endDay})`;

    const formatCurrency = (val) => {
        return `S/ ${Number(val || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
            {/* Header: visible en desktop, limpio en móvil para ganar espacio */}
            <header className="mb-4 md:mb-8 hidden md:flex items-center justify-between">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <TrendingUp className="text-blue-600" />
                    Performance del Restaurante
                </h1>
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </header>

            {/* Selectores (Estilo Gestión Mak) */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 mb-6 md:mb-8 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 items-end">
                <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Año</label>
                    <div className="relative">
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10))}
                            className="w-full pl-3 pr-8 py-1.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <Calendar className="absolute right-2.5 top-2 md:top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Mes</label>
                    <div className="relative">
                        <select
                            value={month}
                            onChange={(e) => handleMonthChange(e.target.value)}
                            className="w-full pl-3 pr-8 py-1.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
                        >
                            {months.map((m, i) => (
                                <option key={i + 1} value={i + 1}>{m}</option>
                            ))}
                        </select>
                        <Calendar className="absolute right-2.5 top-2 md:top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                <div className="col-span-2 md:col-span-1">
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs md:text-sm font-medium text-gray-700">Rango del Día (de - a)</label>
                        <div className="flex items-center gap-1.5 text-[11px] bg-gray-100 px-2 py-0.5 rounded-md">
                            <button
                                type="button"
                                onClick={setRangeAll}
                                className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                title="Mes completo"
                            >
                                Todo
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                type="button"
                                onClick={setRangeQ1}
                                className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                title="Primera quincena (1 - 15)"
                            >
                                1ª Q
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                type="button"
                                onClick={setRangeQ2}
                                className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                title={`Segunda quincena (16 - ${daysInMonth})`}
                            >
                                2ª Q
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            min="1"
                            max={daysInMonth}
                            value={startDay}
                            onChange={(e) => setStartDay(Math.max(1, Math.min(parseInt(e.target.value, 10) || 1, daysInMonth)))}
                            className="w-1/2 px-3 py-1.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="number"
                            min={startDay}
                            max={daysInMonth}
                            value={endDay}
                            onChange={(e) => setEndDay(Math.max(startDay, Math.min(parseInt(e.target.value, 10) || daysInMonth, daysInMonth)))}
                            className="w-1/2 px-3 py-1.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-8 border border-red-100 flex items-center gap-2">
                    <AlertCircle size={18} />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* KPI Cards (Exacto diseño y proporciones de Gestión Mak) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
                {/* 1. Ingresos */}
                <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="p-2 md:p-3 bg-indigo-50 rounded-lg flex items-center justify-center w-9 h-9 md:w-12 md:h-12 shrink-0">
                            <span className="text-indigo-600 font-bold text-base md:text-lg">S/</span>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Ingresos</p>
                            <h4 className="text-lg md:text-2xl font-bold text-gray-800 truncate">
                                {(kpis.ingresos || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </h4>
                        </div>
                    </div>
                </div>

                {/* 2. Ocupación Mesas */}
                <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="p-2 md:p-3 bg-blue-50 rounded-lg flex items-center justify-center w-9 h-9 md:w-12 md:h-12 shrink-0">
                            <Users className="text-blue-600 h-5 w-5 md:h-6 md:w-6" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Ocupación</p>
                            <h4 className="text-lg md:text-2xl font-bold text-gray-800 truncate">
                                {Number(kpis.occupancyRate || 0).toFixed(1)}%
                            </h4>
                        </div>
                    </div>
                </div>

                {/* 3. Ticket Promedio */}
                <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="p-2 md:p-3 bg-green-50 rounded-lg flex items-center justify-center w-9 h-9 md:w-12 md:h-12 shrink-0">
                            <span className="text-green-600 font-bold text-base md:text-lg">S/</span>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">TICKET PROM.</p>
                            <h4 className="text-lg md:text-2xl font-bold text-gray-800 truncate">
                                {(kpis.avgTicket || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </h4>
                        </div>
                    </div>
                </div>

                {/* 4. Cuentas del Mes */}
                <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="p-2 md:p-3 bg-orange-50 rounded-lg flex items-center justify-center w-9 h-9 md:w-12 md:h-12 shrink-0">
                            <TrendingUp className="text-orange-600 h-5 w-5 md:h-6 md:w-6" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Cuentas</p>
                            <h4 className="text-lg md:text-2xl font-bold text-gray-800 truncate">
                                {kpis.totalAccounts || 0}
                            </h4>
                        </div>
                    </div>
                </div>
            </div>

            {/* FILA 1: EVOLUTIVOS ANUALES (2 columnas) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Evolutivo Mensual: Ingresos vs Gastos */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 border-l-8 border-emerald-400 pl-4 uppercase tracking-tight">
                        Evolutivo Mensual {year}
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart data={data?.evolution || []}>
                                <defs>
                                    <linearGradient id="colorIncRest" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpRest" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `S/ ${val}`} />
                                <Tooltip
                                    formatter={(val, name) => [formatCurrency(val), name]}
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload[0]?.payload?.fullName) {
                                            return `${payload[0].payload.fullName} ${year}`;
                                        }
                                        return label;
                                    }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Area
                                    type="monotone"
                                    name="Ingresos Reales"
                                    dataKey="ingresos"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorIncRest)"
                                />
                                <Area
                                    type="monotone"
                                    name="Gastos Operativos"
                                    dataKey="gastos"
                                    stroke="#f43f5e"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorExpRest)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Evolutivo de % de Ocupación */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 border-l-8 border-teal-500 pl-4 uppercase tracking-tight">
                        Evolutivo de % de Ocupación {year}
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart data={data?.evolution || []}>
                                <defs>
                                    <linearGradient id="colorOccRest" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    domain={[0, 100]}
                                    tickFormatter={(val) => `${val}%`}
                                />
                                <Tooltip
                                    formatter={(val) => [`${Number(val || 0).toFixed(1)}%`, 'Tasa de Ocupación']}
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload[0]?.payload?.fullName) {
                                            return `${payload[0].payload.fullName} ${year}`;
                                        }
                                        return label;
                                    }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Area
                                    type="monotone"
                                    name="% Ocupación"
                                    dataKey="ocupacion"
                                    stroke="#0d9488"
                                    strokeWidth={2.5}
                                    dot={{ r: 3, fill: '#0d9488', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 6, fill: '#0d9488' }}
                                    fillOpacity={1}
                                    fill="url(#colorOccRest)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* FILA 2: MÉTRICAS DIARIAS (2 columnas) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                {/* Comparativo Diario de Ingresos */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 border-l-8 border-blue-400 pl-4 uppercase tracking-tight">
                        Comparativo Diario{rangeText}
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                            <LineChart data={data?.dailyComparison || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    label={{ value: 'Día del Mes', position: 'insideBottom', offset: -5 }}
                                />
                                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `S/ ${val}`} />
                                <Tooltip
                                    formatter={(val, name) => [
                                        formatCurrency(val),
                                        name === 'current' || name === 'Mes Seleccionado' ? 'Mes Seleccionado' : 'Mes Anterior'
                                    ]}
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload[0]) {
                                            return `Día ${label} (${payload[0].payload.label})`;
                                        }
                                        return `Día ${label}`;
                                    }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Line
                                    type="monotone"
                                    name="Mes Seleccionado"
                                    dataKey="current"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    name="Mes Anterior"
                                    dataKey="previous"
                                    stroke="#d1d5db"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Mesas Ocupadas por Día */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 border-l-8 border-cyan-400 pl-4 uppercase tracking-tight">
                        Mesas Ocupadas por Día{rangeText}
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart data={data?.dailyVolumeData || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip
                                    formatter={(val) => [`${val} mesas`, 'Ocupadas']}
                                    labelFormatter={(label) => `Día ${label}`}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="mesas" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="mesas" position="top" fill="#6b7280" fontSize={12} formatter={(val) => val > 0 ? val : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* FILA 3: PREFERENCIAS DE MESAS & DISTRIBUCIÓN DE VENTAS (2 columnas amplias) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                {/* Preferencias de Mesas */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 border-l-8 border-cyan-500 pl-4 uppercase tracking-tight">
                        Preferencias de Mesas{rangeText}
                    </h3>
                    <div className="h-[380px]">
                        <ResponsiveContainer width="99%" height="100%">
                            <BarChart
                                data={(data?.topTables || []).map(t => ({
                                    ...t,
                                    displayName: `Mesa ${t.tableNumber} (${t.areaName})`
                                }))}
                                layout="vertical"
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="displayName"
                                    type="category"
                                    width={125}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#4b5563' }}
                                />
                                <Tooltip
                                    formatter={(val, name, item) => [
                                        `${val} cuentas atendidas (${formatCurrency(item.payload.total)})`,
                                        'Cuentas'
                                    ]}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="count" fill="#0284c7" radius={[0, 4, 4, 0]} barSize={32}>
                                    <LabelList dataKey="count" position="right" fill="#6b7280" fontSize={12} formatter={(val) => `${val} c.`} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribución de Ventas (Top Productos) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 border-l-8 border-orange-500 pl-4 uppercase tracking-tight">
                        Distribución de Ventas{rangeText}
                    </h3>
                    <div className="h-[380px]">
                        <ResponsiveContainer width="99%" height="100%">
                            <BarChart data={data?.topProducts || []} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={140}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#4b5563' }}
                                />
                                <Tooltip
                                    formatter={(val, name, item) => [
                                        `${val} unidades (${formatCurrency(item.payload.total)})`,
                                        'Cantidad'
                                    ]}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="quantity" fill="#f97316" radius={[0, 4, 4, 0]} barSize={32}>
                                    <LabelList dataKey="quantity" position="right" fill="#6b7280" fontSize={12} formatter={(val) => `${val} u.`} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* FILA 4: PRODUCTIVIDAD & MÉTODOS DE PAGO (2 columnas amplias) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                {/* Ranking de Productividad */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6 border-l-8 border-indigo-400 pl-4">
                        <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight">
                            Productividad por Usuario
                        </h3>
                        <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
                            <button
                                onClick={() => setProductivityTab('orders')}
                                className={`px-2.5 py-1 rounded-md transition ${productivityTab === 'orders' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                Mozos
                            </button>
                            <button
                                onClick={() => setProductivityTab('payments')}
                                className={`px-2.5 py-1 rounded-md transition ${productivityTab === 'payments' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                Cobros
                            </button>
                        </div>
                    </div>

                    <div className="h-[280px]">
                        {productivityTab === 'orders' ? (
                            <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                                <BarChart
                                    data={data?.userProductivity?.byOrders || []}
                                    layout="vertical"
                                    margin={{ right: 40 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563' }} />
                                    <Tooltip
                                        formatter={(val, name, item) => [
                                            `${formatCurrency(val)} (${item.payload.ordersCount || 0} órdenes)`,
                                            'Ventas'
                                        ]}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="total" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={30}>
                                        <LabelList dataKey="total" position="right" fill="#6b7280" fontSize={11} formatter={(v) => `S/ ${Number(v || 0).toLocaleString('es-PE', { minimumFractionDigits: 0 })}`} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                                <BarChart
                                    data={data?.userProductivity?.byPayments || []}
                                    layout="vertical"
                                    margin={{ right: 40 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563' }} />
                                    <Tooltip
                                        formatter={(val, name, item) => [
                                            `${formatCurrency(val)} (${item.payload.paymentCount || 0} pagos)`,
                                            'Cobrado'
                                        ]}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="total" fill="#a78bfa" radius={[0, 4, 4, 0]} barSize={30}>
                                        <LabelList dataKey="total" position="right" fill="#6b7280" fontSize={11} formatter={(v) => `S/ ${Number(v || 0).toLocaleString('es-PE', { minimumFractionDigits: 0 })}`} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Métodos de Pago */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 border-l-8 border-violet-400 pl-4 uppercase tracking-tight">
                        Métodos de Pago{rangeText}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {(data?.paymentMethods || []).map((pm, idx) => (
                            <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between">
                                <span className="text-xs font-bold text-gray-500 uppercase">{pm.method}</span>
                                <h4 className="text-lg md:text-xl font-bold text-gray-800 mt-2">{formatCurrency(pm.total)}</h4>
                                <span className="text-[11px] text-gray-400 font-medium mt-1">{pm.count} transacciones</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
