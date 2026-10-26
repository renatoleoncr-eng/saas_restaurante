import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, AreaChart, Area, LabelList
} from 'recharts';
import {
    TrendingUp, Calendar, Users, DollarSign, Utensils,
    Receipt, LayoutGrid, CreditCard, RefreshCw, AlertCircle, Award
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

    // Manejar cambio de mes
    const handleMonthChange = (newMonth) => {
        const m = parseInt(newMonth, 10);
        setMonth(m);
        const maxDays = new Date(year, m, 0).getDate();
        if (startDay > maxDays) setStartDay(1);
        if (endDay > maxDays || endDay === daysInMonth) setEndDay(maxDays);
    };

    // Accesos directos de rango
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
    const rangeSubtitle = isFullMonth ? '' : ` (Días ${startDay} al ${endDay})`;

    // Formateador de moneda en soles
    const formatCurrency = (val) => {
        return `S/ ${Number(val || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatCurrencyShort = (val) => {
        return `S/ ${Number(val || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    return (
        <div className="p-3 sm:p-6 lg:p-8 bg-gray-50 min-h-screen overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-800 flex items-center gap-2">
                        <TrendingUp className="text-blue-600 h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
                        Performance del Restaurante
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        Analítica gerencial, rotación de mesas, evolución de ventas y productividad operativa
                    </p>
                </div>
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {/* Selectores y Filtros */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 sm:mb-8 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 items-end">
                {/* Selector de Año */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Año</label>
                    <div className="relative">
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10))}
                            className="w-full pl-3 pr-8 py-2 text-sm font-medium border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white cursor-pointer"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <Calendar className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {/* Selector de Mes */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Mes</label>
                    <div className="relative">
                        <select
                            value={month}
                            onChange={(e) => handleMonthChange(e.target.value)}
                            className="w-full pl-3 pr-8 py-2 text-sm font-medium border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white cursor-pointer"
                        >
                            {months.map((m, i) => (
                                <option key={i + 1} value={i + 1}>{m}</option>
                            ))}
                        </select>
                        <Calendar className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {/* Selector de Rango de Días */}
                <div className="col-span-2 md:col-span-1">
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">Rango de Días</label>
                        <div className="flex items-center gap-1.5 text-[11px] bg-gray-100 px-2 py-0.5 rounded-md font-medium">
                            <button
                                type="button"
                                onClick={setRangeAll}
                                className={`transition hover:text-blue-700 ${isFullMonth ? 'text-blue-600 font-bold' : 'text-gray-600'}`}
                            >
                                Todo
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                type="button"
                                onClick={setRangeQ1}
                                className={`transition hover:text-blue-700 ${startDay === 1 && endDay === 15 ? 'text-blue-600 font-bold' : 'text-gray-600'}`}
                            >
                                1ª Q
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                type="button"
                                onClick={setRangeQ2}
                                className={`transition hover:text-blue-700 ${startDay === 16 && endDay === daysInMonth ? 'text-blue-600 font-bold' : 'text-gray-600'}`}
                            >
                                2ª Q
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <input
                            type="number"
                            min="1"
                            max={daysInMonth}
                            value={startDay}
                            onChange={(e) => setStartDay(Math.max(1, Math.min(parseInt(e.target.value, 10) || 1, daysInMonth)))}
                            className="w-1/2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-gray-400 text-xs font-bold">a</span>
                        <input
                            type="number"
                            min={startDay}
                            max={daysInMonth}
                            value={endDay}
                            onChange={(e) => setEndDay(Math.max(startDay, Math.min(parseInt(e.target.value, 10) || daysInMonth, daysInMonth)))}
                            className="w-1/2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-3">
                    <AlertCircle className="shrink-0 h-5 w-5" />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* KPI Cards Superiores */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 sm:mb-8">
                {/* Ingresos Totales */}
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4 transition hover:shadow-md">
                    <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 shrink-0 font-bold text-base sm:text-lg">
                        S/
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Ingresos</p>
                        <h4 className="text-base sm:text-xl lg:text-2xl font-black text-gray-800 truncate">
                            {formatCurrency(kpis.ingresos)}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-medium">Ventas reales del periodo</span>
                    </div>
                </div>

                {/* % Ocupación de Mesas */}
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4 transition hover:shadow-md">
                    <div className="p-2.5 sm:p-3 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                        <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Ocupación Mesas</p>
                        <h4 className="text-base sm:text-xl lg:text-2xl font-black text-gray-800 truncate">
                            {Number(kpis.occupancyRate || 0).toFixed(1)}%
                        </h4>
                        <span className="text-[10px] text-gray-400 font-medium">Capacidad diaria usada</span>
                    </div>
                </div>

                {/* Ticket Promedio */}
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4 transition hover:shadow-md">
                    <div className="p-2.5 sm:p-3 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 shrink-0 font-bold text-base sm:text-lg">
                        S/
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Ticket Promedio</p>
                        <h4 className="text-base sm:text-xl lg:text-2xl font-black text-gray-800 truncate">
                            {formatCurrency(kpis.avgTicket)}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-medium">Consumo por cuenta</span>
                    </div>
                </div>

                {/* Cantidad de Cuentas */}
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4 transition hover:shadow-md">
                    <div className="p-2.5 sm:p-3 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                        <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Cuentas del Mes</p>
                        <h4 className="text-base sm:text-xl lg:text-2xl font-black text-gray-800 truncate">
                            {kpis.totalAccounts || 0}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-medium">Cuentas atendidas</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 1: EVOLUTIVOS ANUALES (Ingresos vs Gastos & Ocupación) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
                {/* Evolutivo Mensual: Ingresos vs Gastos */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 sm:mb-6 border-l-4 sm:border-l-8 border-emerald-500 pl-3 sm:pl-4 uppercase tracking-tight flex items-center justify-between">
                        <span>Evolutivo Mensual {year}</span>
                        <span className="text-xs font-medium text-gray-400 normal-case">Ene - Dic</span>
                    </h3>
                    <div className="h-[280px] sm:h-[320px]">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart data={data?.evolution || []}>
                                <defs>
                                    <linearGradient id="colorIncRest" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpRest" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(val) => `S/ ${val}`} />
                                <Tooltip
                                    formatter={(val) => [formatCurrency(val), '']}
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload[0]?.payload?.fullName) {
                                            return `${payload[0].payload.fullName} ${year}`;
                                        }
                                        return label;
                                    }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
                                />
                                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                                <Area
                                    type="monotone"
                                    name="Ingresos Reales"
                                    dataKey="ingresos"
                                    stroke="#10b981"
                                    strokeWidth={2.5}
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

                {/* Evolutivo de % de Ocupación de Mesas */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 sm:mb-6 border-l-4 sm:border-l-8 border-teal-500 pl-3 sm:pl-4 uppercase tracking-tight flex items-center justify-between">
                        <span>Evolutivo de % Ocupación {year}</span>
                        <span className="text-xs font-medium text-gray-400 normal-case">Rotación mesas</span>
                    </h3>
                    <div className="h-[280px] sm:h-[320px]">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart data={data?.evolution || []}>
                                <defs>
                                    <linearGradient id="colorOccRest" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(val) => `${val}%`} />
                                <Tooltip
                                    formatter={(val) => [`${Number(val || 0).toFixed(1)}%`, 'Tasa Ocupación']}
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload[0]?.payload?.fullName) {
                                            return `${payload[0].payload.fullName} ${year}`;
                                        }
                                        return label;
                                    }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
                                />
                                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                                <Area
                                    type="monotone"
                                    name="% Ocupación Mesas"
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

            {/* SECCIÓN 2: MÉTRICAS DIARIAS (Comparativo Diario vs Mes Anterior & Volumen Diario) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
                {/* Comparativo Diario de Ingresos */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 sm:mb-6 border-l-4 sm:border-l-8 border-blue-500 pl-3 sm:pl-4 uppercase tracking-tight flex items-center justify-between">
                        <span>Comparativo Diario de Ingresos</span>
                        <span className="text-xs font-medium text-gray-400 normal-case">vs Mes Anterior</span>
                    </h3>
                    <div className="h-[280px] sm:h-[320px]">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                            <LineChart data={data?.dailyComparison || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(val) => `S/ ${val}`} />
                                <Tooltip
                                    formatter={(val, name) => [
                                        formatCurrency(val),
                                        name === 'current' ? 'Mes Seleccionado' : 'Mes Anterior'
                                    ]}
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload[0]) {
                                            return `Día ${label} (${payload[0].payload.label})`;
                                        }
                                        return `Día ${label}`;
                                    }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
                                />
                                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                                <Line
                                    type="monotone"
                                    name="Mes Seleccionado"
                                    dataKey="current"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: '#3b82f6' }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    name="Mes Anterior"
                                    dataKey="previous"
                                    stroke="#cbd5e1"
                                    strokeWidth={2}
                                    strokeDasharray="4 4"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Volumen Diario: Cuentas y Mesas Atendidas */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 sm:mb-6 border-l-4 sm:border-l-8 border-cyan-500 pl-3 sm:pl-4 uppercase tracking-tight flex items-center justify-between">
                        <span>Cuentas y Mesas por Día{rangeSubtitle}</span>
                        <span className="text-xs font-medium text-gray-400 normal-case">Volumen</span>
                    </h3>
                    <div className="h-[280px] sm:h-[320px]">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart data={data?.dailyVolumeData || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <Tooltip
                                    formatter={(val, name) => [`${val} ${name === 'cuentas' ? 'cuentas' : 'mesas'}`, name === 'cuentas' ? 'Cuentas' : 'Mesas']}
                                    labelFormatter={(label) => `Día ${label}`}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
                                />
                                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                                <Bar dataKey="cuentas" name="Cuentas Atendidas" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="cuentas" position="top" fill="#6b7280" fontSize={10} formatter={(val) => val > 0 ? val : ''} />
                                </Bar>
                                <Bar dataKey="mesas" name="Mesas Ocupadas" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="mesas" position="top" fill="#6b7280" fontSize={10} formatter={(val) => val > 0 ? val : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 3: PREFERENCIAS, PRODUCTIVIDAD Y DISTRIBUCIÓN */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Ranking de Productividad por Usuario */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 lg:col-span-1">
                    <div className="flex items-center justify-between mb-4 sm:mb-6 border-l-4 sm:border-l-8 border-indigo-500 pl-3 sm:pl-4">
                        <h3 className="text-base sm:text-lg font-bold text-gray-800 uppercase tracking-tight">
                            Productividad
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

                    <div className="h-[300px]">
                        {productivityTab === 'orders' ? (
                            <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                                <BarChart
                                    data={data?.userProductivity?.byOrders?.slice(0, 7) || []}
                                    layout="vertical"
                                    margin={{ left: 10, right: 30 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563' }} />
                                    <Tooltip
                                        formatter={(val, name, item) => [
                                            `${formatCurrency(val)} (${item.payload.ordersCount || 0} órdenes)`,
                                            'Ventas'
                                        ]}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
                                    />
                                    <Bar dataKey="total" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={26}>
                                        <LabelList dataKey="total" position="right" fill="#4b5563" fontSize={11} formatter={(v) => formatCurrencyShort(v)} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                                <BarChart
                                    data={data?.userProductivity?.byPayments?.slice(0, 7) || []}
                                    layout="vertical"
                                    margin={{ left: 10, right: 30 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563' }} />
                                    <Tooltip
                                        formatter={(val, name, item) => [
                                            `${formatCurrency(val)} (${item.payload.paymentCount || 0} pagos)`,
                                            'Cobrado'
                                        ]}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
                                    />
                                    <Bar dataKey="total" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={26}>
                                        <LabelList dataKey="total" position="right" fill="#4b5563" fontSize={11} formatter={(v) => formatCurrencyShort(v)} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Preferencia de Mesas */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 lg:col-span-1">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 sm:mb-6 border-l-4 sm:border-l-8 border-sky-500 pl-3 sm:pl-4 uppercase tracking-tight flex items-center justify-between">
                        <span>Preferencia de Mesas</span>
                        <span className="text-xs font-medium text-gray-400 normal-case">Rotación</span>
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart
                                data={(data?.topTables || []).slice(0, 7).map(t => ({
                                    ...t,
                                    displayName: `${t.tableNumber} (${t.areaName})`
                                }))}
                                layout="vertical"
                                margin={{ left: 10, right: 30 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="displayName" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563' }} />
                                <Tooltip
                                    formatter={(val, name, item) => [
                                        `${val} cuentas atendidas (${formatCurrency(item.payload.total)})`,
                                        'Cuentas'
                                    ]}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
                                />
                                <Bar dataKey="count" fill="#0284c7" radius={[0, 6, 6, 0]} barSize={26}>
                                    <LabelList dataKey="count" position="right" fill="#4b5563" fontSize={11} formatter={(v) => `${v} c.`} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribución de Ventas (Top Productos & Métodos de Pago) */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 lg:col-span-1">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 sm:mb-6 border-l-4 sm:border-l-8 border-amber-500 pl-3 sm:pl-4 uppercase tracking-tight flex items-center justify-between">
                        <span>Top Productos Vendidos</span>
                        <span className="text-xs font-medium text-gray-400 normal-case">Unidades</span>
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart
                                data={(data?.topProducts || []).slice(0, 7)}
                                layout="vertical"
                                margin={{ left: 10, right: 30 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563' }} />
                                <Tooltip
                                    formatter={(val, name, item) => [
                                        `${val} unidades (${formatCurrency(item.payload.total)})`,
                                        'Cantidad'
                                    ]}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
                                />
                                <Bar dataKey="quantity" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={26}>
                                    <LabelList dataKey="quantity" position="right" fill="#4b5563" fontSize={11} formatter={(v) => `${v} u.`} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 4: DESGLOSE DE MÉTODOS DE PAGO */}
            {data?.paymentMethods && data.paymentMethods.length > 0 && (
                <div className="mt-6 sm:mt-8 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 border-l-4 sm:border-l-8 border-violet-500 pl-3 sm:pl-4 uppercase tracking-tight">
                        Distribución de Ingresos por Método de Pago
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        {data.paymentMethods.map((pm, idx) => (
                            <div key={idx} className="bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-500 uppercase">{pm.method}</span>
                                <h4 className="text-base sm:text-xl font-black text-gray-800 mt-1">{formatCurrency(pm.total)}</h4>
                                <span className="text-[11px] text-gray-400 font-medium">{pm.count} transacciones</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
