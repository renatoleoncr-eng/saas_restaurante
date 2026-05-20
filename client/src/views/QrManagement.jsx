import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { 
    QrCode, Tv, Gamepad, Plus, Trash2, Edit2, Save, RefreshCw, Copy, Check,
    Play, Square, Volume2, Lock, Unlock, Settings, DollarSign, User, Calendar, 
    ArrowUpRight, ArrowDownLeft, Sliders, ToggleLeft, ToggleRight, List, Image,
    Eye, X, ArrowUp, ArrowDown, ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, Gift, History
} from 'lucide-react';

const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendUrl = isLocalhost ? 'http://localhost:3003' : window.location.origin;
    return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function QrManagement() {
    const { socket, user } = useRestaurant();
    const [activeTab, setActiveTab] = useState('qr'); // 'qr' | 'ads' | 'roulette'

    
    // Notifications State
    const [alert, setAlert] = useState(null);

    // --- Tab 1: QRs State ---
    const [qrs, setQrs] = useState([]);
    const [showQrModal, setShowQrModal] = useState(false);
    const [editingQr, setEditingQr] = useState(null);
    const [qrFormData, setQrFormData] = useState({
        name: '',
        phoneNumber: '',
        limitAmount: '',
        isUnlimited: false,
        isActive: true,
        orderIndex: 0,
        imageFile: null
    });
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [selectedQrForAdjust, setSelectedQrForAdjust] = useState(null);
    const [adjustmentData, setAdjustmentData] = useState({
        type: 'income', // 'income' | 'expense'
        amount: '',
        description: ''
    });
    const [copiedId, setCopiedId] = useState(null);

    // Movements State
    const [movements, setMovements] = useState([]);
    const [movementFilters, setMovementFilters] = useState({
        month: new Date().toISOString().substring(0, 7), // YYYY-MM Peru default
        qr_id: 'all',
        user_id: 'all',
        transaction_type: 'all'
    });
    const [staffUsers, setStaffUsers] = useState([]);

    // --- Tab 2: Advertising / Slides State ---
    const [promoGroups, setPromoGroups] = useState([]);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [groupFormData, setGroupFormData] = useState({
        name: '',
        isActive: true,
        orderIndex: 0
    });
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [showSlideModal, setShowSlideModal] = useState(false);
    const [slideFormData, setSlideFormData] = useState({
        name: '',
        isActive: true,
        orderIndex: 0,
        imageFiles: null // Supports multiple files upload
    });
    const [activeProjection, setActiveProjection] = useState(null); // Local tracker for manual projections
    const [clientScreenMode, setClientScreenMode] = useState('ads'); // 'ads' | 'qr_fixed' | 'qr_countdown'

    // --- Tab 3: Roulette State ---
    const [rouletteConfig, setRouletteConfig] = useState({
        is_active: false,
        visits_required: 1,
        categories: []
    });
    const [rouletteLogs, setRouletteLogs] = useState([]); // Real-time notification of spins
    const [selectedWinnerId, setSelectedWinnerId] = useState('random');

    const showAlert = (message, type = 'success') => {
        setAlert({ message, type });
        setTimeout(() => setAlert(null), 4000);
    };

    // Initialize all data
    useEffect(() => {
        fetchQrs();
        fetchMovements();
        fetchStaffUsers();
        fetchPromoGroups();
        fetchRouletteConfig();
    }, [activeTab]);

    useEffect(() => {
        if (!socket) return;

        const handleQrConfigChanged = () => {
            fetchQrs();
            fetchMovements();
        };

        const handlePromotionsUpdated = () => {
            fetchPromoGroups();
        };

        const handleScreenModeUpdated = (data) => {
            if (data?.mode) {
                setClientScreenMode(data.mode);
            }
        };

        const handleProjStart = (data) => {
            setActiveProjection(data);
        };

        const handleProjStop = () => {
            setActiveProjection(null);
        };

        const handleWinnerCelebration = (data) => {
            setRouletteLogs(prev => [
                {
                    id: Date.now(),
                    customerName: data.customerName || 'Cliente',
                    prize: data.prize || 'Premio',
                    time: new Date().toLocaleTimeString()
                },
                ...prev.slice(0, 9)
            ]);
            showAlert(`🏆 ¡Ganador! ${data.customerName || 'Cliente'} obtuvo ${data.prize}`, 'info');
        };

        socket.on('qr_config_changed', handleQrConfigChanged);
        socket.on('promotions_updated', handlePromotionsUpdated);
        socket.on('update_client_screen_mode', handleScreenModeUpdated);
        socket.on('client_start_projection', handleProjStart);
        socket.on('client_stop_projection', handleProjStop);
        socket.on('report_roulette_winner', handleWinnerCelebration);

        return () => {
            socket.off('qr_config_changed', handleQrConfigChanged);
            socket.off('promotions_updated', handlePromotionsUpdated);
            socket.off('update_client_screen_mode', handleScreenModeUpdated);
            socket.off('client_start_projection', handleProjStart);
            socket.off('client_stop_projection', handleProjStop);
            socket.off('report_roulette_winner', handleWinnerCelebration);
        };
    }, [socket]);

    // ==========================================
    // --- TABS & GENERAL ACTIONS ---
    // ==========================================

    const fetchQrs = async () => {
        try {
            const res = await axios.get('/api/qrs');
            setQrs(res.data);
        } catch (error) {
            console.error('Error fetching QRs:', error);
            showAlert('No se pudieron cargar las cuentas QR', 'danger');
        }
    };

    const fetchMovements = async () => {
        try {
            const { month, qr_id, user_id, transaction_type } = movementFilters;
            const res = await axios.get('/api/qrs/movements', {
                params: { month, qr_id, user_id, transaction_type }
            });
            setMovements(res.data);
        } catch (error) {
            console.error('Error fetching QR movements:', error);
        }
    };

    const fetchStaffUsers = async () => {
        try {
            const res = await axios.get('/api/users');
            setStaffUsers(res.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchPromoGroups = async () => {
        try {
            const res = await axios.get('/api/promotions/groups');
            setPromoGroups(res.data);
            if (res.data.length > 0 && !selectedGroupId) {
                setSelectedGroupId(res.data[0].id);
            }
        } catch (error) {
            console.error('Error fetching promotion groups:', error);
        }
    };

    const fetchRouletteConfig = async () => {
        try {
            const res = await axios.get('/api/roulette');
            setRouletteConfig(res.data);
        } catch (error) {
            console.error('Error fetching roulette config:', error);
        }
    };

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // ==========================================
    // --- QR ACTIONS ---
    // ==========================================

    const openQrCreate = () => {
        setEditingQr(null);
        setQrFormData({
            name: '',
            phoneNumber: '',
            limitAmount: '',
            isUnlimited: false,
            isActive: true,
            orderIndex: qrs.length,
            imageFile: null
        });
        setShowQrModal(true);
    };

    const openQrEdit = (qr) => {
        setEditingQr(qr);
        setQrFormData({
            name: qr.name,
            phoneNumber: qr.phoneNumber || '',
            limitAmount: qr.limitAmount,
            isUnlimited: qr.isUnlimited,
            isActive: qr.isActive,
            orderIndex: qr.orderIndex,
            imageFile: null
        });
        setShowQrModal(true);
    };

    const saveQr = async (e) => {
        e.preventDefault();
        
        const data = new FormData();
        data.append('name', qrFormData.name);
        data.append('phoneNumber', qrFormData.phoneNumber);
        data.append('limitAmount', qrFormData.isUnlimited ? 0 : qrFormData.limitAmount);
        data.append('isUnlimited', qrFormData.isUnlimited);
        data.append('isActive', qrFormData.isActive);
        data.append('orderIndex', qrFormData.orderIndex);
        if (qrFormData.imageFile) {
            data.append('image', qrFormData.imageFile);
        }

        try {
            if (editingQr) {
                await axios.put(`/api/qrs/${editingQr.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showAlert('Cuenta QR actualizada correctamente');
            } else {
                await axios.post('/api/qrs', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showAlert('Cuenta QR creada con éxito');
            }
            setShowQrModal(false);
            fetchQrs();
        } catch (error) {
            console.error('Error saving QR:', error);
            showAlert('Error al guardar la cuenta QR', 'danger');
        }
    };

    const toggleQrActive = async (qr) => {
        try {
            await axios.put(`/api/qrs/${qr.id}`, { isActive: !qr.isActive });
            showAlert(`QR ${!qr.isActive ? 'activado' : 'desactivado'} correctamente`);
            fetchQrs();
        } catch (error) {
            console.error('Error toggling QR active:', error);
        }
    };

    const deleteQr = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar esta cuenta QR? Se perderá de forma permanente.')) return;
        try {
            await axios.delete(`/api/qrs/${id}`);
            showAlert('Cuenta QR eliminada');
            fetchQrs();
        } catch (error) {
            console.error('Error deleting QR:', error);
            showAlert('No se pudo eliminar el QR', 'danger');
        }
    };

    const reorderQr = async (index, direction) => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= qrs.length) return;

        const updatedQrs = [...qrs];
        const temp = updatedQrs[index];
        updatedQrs[index] = updatedQrs[newIndex];
        updatedQrs[newIndex] = temp;

        const items = updatedQrs.map((item, idx) => ({ id: item.id, orderIndex: idx }));
        try {
            await axios.put('/api/qrs/reorder', { items });
            fetchQrs();
        } catch (error) {
            console.error('Error reordering QRs:', error);
        }
    };

    const openAdjustBalance = (qr) => {
        setSelectedQrForAdjust(qr);
        setAdjustmentData({
            type: 'income',
            amount: '',
            description: ''
        });
        setShowAdjustModal(true);
    };

    const submitAdjustment = async (e) => {
        e.preventDefault();
        const value = parseFloat(adjustmentData.amount || 0);
        if (isNaN(value) || value <= 0) {
            showAlert('Monto inválido', 'danger');
            return;
        }

        const adjustment = adjustmentData.type === 'income' ? value : -value;

        try {
            await axios.post(`/api/qrs/${selectedQrForAdjust.id}/adjust`, {
                adjustment,
                description: adjustmentData.description,
                userId: user?.id
            });
            showAlert('Ajuste de saldo registrado correctamente');
            setShowAdjustModal(false);
            fetchQrs();
            fetchMovements();
        } catch (error) {
            console.error('Error submitting balance adjustment:', error);
            showAlert('Error al registrar el ajuste', 'danger');
        }
    };

    // Apply movement filters
    useEffect(() => {
        fetchMovements();
    }, [movementFilters]);

    // ==========================================
    // --- ADVERTISING ACTIONS ---
    // ==========================================

    const openGroupCreate = () => {
        setEditingGroup(null);
        setGroupFormData({ name: '', isActive: true, orderIndex: promoGroups.length });
        setShowGroupModal(true);
    };

    const openGroupEdit = (group) => {
        setEditingGroup(group);
        setGroupFormData({ name: group.name, isActive: group.isActive, orderIndex: group.orderIndex });
        setShowGroupModal(true);
    };

    const saveGroup = async (e) => {
        e.preventDefault();
        try {
            if (editingGroup) {
                await axios.put(`/api/promotions/groups/${editingGroup.id}`, groupFormData);
                showAlert('Grupo publicitario actualizado');
            } else {
                await axios.post('/api/promotions/groups', groupFormData);
                showAlert('Grupo publicitario creado');
            }
            setShowGroupModal(false);
            fetchPromoGroups();
        } catch (error) {
            console.error('Error saving banner group:', error);
            showAlert('Error al guardar el grupo', 'danger');
        }
    };

    const deleteGroup = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este grupo? Se eliminarán todas las diapositivas asociadas.')) return;
        try {
            await axios.delete(`/api/promotions/groups/${id}`);
            showAlert('Grupo eliminado correctamente');
            if (selectedGroupId === id) {
                setSelectedGroupId(null);
            }
            fetchPromoGroups();
        } catch (error) {
            console.error('Error deleting group:', error);
        }
    };

    const triggerClientScreenMode = (mode) => {
        if (!socket) return;
        socket.emit('set_client_screen_mode', { mode });
        setClientScreenMode(mode);
        showAlert(`Pantalla del cliente cambiada a: ${mode === 'ads' ? 'Publicidad' : mode === 'qr_fixed' ? 'QR Fijo' : 'QR con Contador'}`);
    };

    const triggerQrFlash = () => {
        if (!socket) return;
        socket.emit('trigger_qr_display');
        showAlert('QR proyectado en pantalla por 20 segundos');
    };

    const openSlideUpload = () => {
        setSlideFormData({
            name: '',
            isActive: true,
            orderIndex: 0,
            imageFiles: null
        });
        setShowSlideModal(true);
    };

    const saveSlides = async (e) => {
        e.preventDefault();
        if (!slideFormData.imageFiles || slideFormData.imageFiles.length === 0) {
            showAlert('Por favor seleccione al menos una imagen o video', 'danger');
            return;
        }

        const data = new FormData();
        data.append('name', slideFormData.name);
        data.append('orderIndex', slideFormData.orderIndex);
        data.append('groupId', selectedGroupId);

        for (let i = 0; i < slideFormData.imageFiles.length; i++) {
            data.append('image', slideFormData.imageFiles[i]);
        }

        try {
            await axios.post('/api/promotions', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showAlert('Banners subidos correctamente');
            setShowSlideModal(false);
            fetchPromoGroups();
        } catch (error) {
            console.error('Error uploading slides:', error);
            showAlert('Error al subir banners', 'danger');
        }
    };

    const toggleSlideActive = async (slide) => {
        try {
            await axios.put(`/api/promotions/${slide.id}`, { isActive: !slide.isActive });
            fetchPromoGroups();
        } catch (error) {
            console.error('Error toggling slide active status:', error);
        }
    };

    const deleteSlide = async (id) => {
        if (!window.confirm('¿Eliminar esta diapositiva permanentemente?')) return;
        try {
            await axios.delete(`/api/promotions/${id}`);
            showAlert('Diapositiva eliminada');
            fetchPromoGroups();
        } catch (error) {
            console.error('Error deleting slide:', error);
        }
    };

    const projectMedia = (slide, durationMinutes) => {
        if (!socket) return;
        const durationSecs = durationMinutes * 60;
        
        socket.emit('start_projection', {
            type: 'single',
            duration: durationSecs,
            images: [slide.imageUrl],
            promoName: slide.name,
            promoId: slide.id
        });

        showAlert(`Proyectando "${slide.name}" durante ${durationMinutes} minutos.`);
    };

    const stopProjection = () => {
        if (!socket) return;
        socket.emit('stop_projection');
        showAlert('Proyección detenida.');
    };

    // ==========================================
    // --- ROULETTE ACTIONS ---
    // ==========================================

    const handleRouletteConfigChange = (field, value) => {
        setRouletteConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleCategoryWeightChange = (index, value) => {
        const weight = parseInt(value) || 0;
        const newCats = [...rouletteConfig.categories];
        newCats[index].weight = Math.max(0, weight);
        setRouletteConfig(prev => ({ ...prev, categories: newCats }));
    };

    const handleCategoryFieldChange = (index, field, value) => {
        const newCats = [...rouletteConfig.categories];
        newCats[index][field] = value;
        setRouletteConfig(prev => ({ ...prev, categories: newCats }));
    };

    const addRouletteCategory = () => {
        if (rouletteConfig.categories.length >= 6) {
            showAlert('La ruleta puede tener un máximo de 6 categorías.', 'danger');
            return;
        }
        const nextId = rouletteConfig.categories.reduce((max, cat) => Math.max(max, cat.id), 0) + 1;
        const newCats = [
            ...rouletteConfig.categories,
            { id: nextId, name: 'Nuevo Premio', icon: '🎁', weight: 10 }
        ];
        setRouletteConfig(prev => ({ ...prev, categories: newCats }));
    };

    const removeRouletteCategory = (index) => {
        if (rouletteConfig.categories.length <= 2) {
            showAlert('La ruleta debe tener al menos 2 categorías.', 'danger');
            return;
        }
        const newCats = rouletteConfig.categories.filter((_, idx) => idx !== index);
        setRouletteConfig(prev => ({ ...prev, categories: newCats }));
    };

    const saveRouletteConfig = async () => {
        if (rouletteConfig.categories.length < 2 || rouletteConfig.categories.length > 6) {
            showAlert('La ruleta debe tener entre 2 y 6 categorías.', 'danger');
            return;
        }

        const totalWeight = rouletteConfig.categories.reduce((sum, c) => sum + (c.weight || 0), 0);
        if (totalWeight <= 0) {
            showAlert('El peso total de las categorías debe ser mayor a 0.', 'danger');
            return;
        }

        try {
            const res = await axios.post('/api/roulette', { config: rouletteConfig });
            setRouletteConfig(res.data.config);
            showAlert('Configuración de ruleta guardada con éxito');
        } catch (error) {
            console.error('Error saving roulette config:', error);
            showAlert('Error al guardar la ruleta', 'danger');
        }
    };

    const testProjectRoulette = async () => {
        if (rouletteConfig.categories.length === 0) return;

        let winningIndex = null;
        if (selectedWinnerId === 'random') {
            // Pick based on weights
            const totalWeight = rouletteConfig.categories.reduce((acc, slice) => acc + (slice.weight || 1), 0);
            let randomNum = Math.random() * totalWeight;
            for (let i = 0; i < rouletteConfig.categories.length; i++) {
                if (randomNum < (rouletteConfig.categories[i].weight || 1)) {
                    winningIndex = i;
                    break;
                }
                randomNum -= (rouletteConfig.categories[i].weight || 1);
            }
        } else {
            winningIndex = rouletteConfig.categories.findIndex(c => String(c.id) === String(selectedWinnerId));
        }

        if (winningIndex === -1 || winningIndex === null) winningIndex = 0;

        try {
            await axios.post('/api/roulette/project', {
                isSpinning: true,
                winningIndex,
                categories: rouletteConfig.categories,
                accountId: null
            });
            showAlert(`Simulando giro de ruleta en pantalla. Ganador elegido: ${rouletteConfig.categories[winningIndex].name}`);
        } catch (error) {
            console.error('Error projecting test roulette:', error);
            showAlert('Error al simular ruleta', 'danger');
        }
    };

    const stopProjectRoulette = async () => {
        try {
            await axios.post('/api/roulette/project', { stop: true });
            showAlert('Ruleta quitada de pantalla');
        } catch (error) {
            console.error(error);
        }
    };

    // Helper percentages
    const totalWeights = rouletteConfig?.categories?.reduce((sum, c) => sum + (c.weight || 0), 0) || 1;

    return (
        <div className="flex-1 flex flex-col bg-slate-900 min-h-screen text-slate-100 p-3 md:p-6 overflow-x-hidden relative">
            
            {/* Top Alert Toast */}
            {alert && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border animate-in slide-in-from-top duration-300
                    ${alert.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50' : 
                      alert.type === 'danger' ? 'bg-rose-950/90 text-rose-300 border-rose-500/50' : 
                      'bg-sky-950/90 text-sky-300 border-sky-500/50'}`}>
                    {alert.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                    {alert.type === 'danger' && <AlertTriangle className="w-5 h-5 shrink-0" />}
                    {alert.type === 'info' && <Gift className="w-5 h-5 shrink-0 animate-bounce" />}
                    <span className="font-bold text-sm">{alert.message}</span>
                </div>
            )}

            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        <Tv className="w-8 h-8 text-emerald-400 shrink-0" /> Pantalla del Cliente
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Gestión integrada de cuentas de pago QR rotativas, banners promocionales y ruleta interactiva de lealtad.
                    </p>
                </div>
                
                {/* Visual quick status link to customer view */}
                <a 
                    href="/qr-display" 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 hover:border-slate-600 transition-all text-sm font-bold shadow-md shadow-black/20"
                >
                    <Eye className="w-4 h-4 text-emerald-400" /> Abrir Pantalla del Cliente
                    <ChevronRight className="w-4 h-4" />
                </a>
            </div>

            {/* Premium Glassmorphic Tab Switcher */}
            <div className="flex items-center gap-2 bg-slate-950/60 backdrop-blur-md border border-slate-800 p-1.5 rounded-2xl w-fit mb-6">
                <button
                    onClick={() => setActiveTab('qr')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300
                        ${activeTab === 'qr'
                            ? 'bg-slate-900 border border-slate-700/50 text-white shadow-lg shadow-black/20'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'}`}
                >
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <span>Gestión QR</span>
                </button>
                <button
                    onClick={() => setActiveTab('ads')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300
                        ${activeTab === 'ads'
                            ? 'bg-slate-900 border border-slate-700/50 text-white shadow-lg shadow-black/20'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'}`}
                >
                    <Tv className="w-4 h-4 text-sky-400" />
                    <span>Publicidad</span>
                </button>
                <button
                    onClick={() => setActiveTab('roulette')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300
                        ${activeTab === 'roulette'
                            ? 'bg-slate-900 border border-slate-700/50 text-white shadow-lg shadow-black/20'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'}`}
                >
                    <Gamepad className="w-4 h-4 text-amber-400" />
                    <span>Ruleta</span>
                </button>
            </div>


            {activeTab === 'qr' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {/* QR List Section */}
                    <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        Cuentas Yape y Plin Rotativas
                                    </h2>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                        El sistema rota automáticamente entre los códigos QR según sus límites mensuales y secuencia.
                                    </p>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        onClick={openQrCreate}
                                        className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-600/10 transition-all text-xs font-black"
                                    >
                                        <Plus className="w-4 h-4" /> Agregar Cuenta QR
                                    </button>
                                </div>
                            </div>

                            {qrs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                                    <QrCode className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
                                    <h3 className="text-white font-bold text-base">No hay cuentas QR configuradas</h3>
                                    <p className="text-slate-400 text-xs mt-1 max-w-sm">
                                        Registre sus cuentas Yape o Plin de la empresa para habilitar la facturación e integración en caja.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-300">
                                    {qrs.map((qr, index) => {
                                        const isExceeded = !qr.isUnlimited && parseFloat(qr.accumulated_month_sum || 0) >= parseFloat(qr.limitAmount || 0);
                                        const activeRotationQr = qrs.find(q => q.isActive && (q.isUnlimited || parseFloat(q.accumulated_month_sum || 0) < parseFloat(q.limitAmount || 0)));
                                        const isVigente = activeRotationQr && activeRotationQr.id === qr.id;
                                        const pct = qr.isUnlimited ? 0 : Math.min(100, (parseFloat(qr.accumulated_month_sum || 0) / parseFloat(qr.limitAmount || 1)) * 100);
                                        
                                        return (
                                            <div 
                                                key={qr.id}
                                                className={`bg-slate-950/60 border rounded-3xl p-5 shadow-xl relative overflow-hidden transition-all duration-300 flex flex-col justify-between hover:border-slate-700
                                                    ${isVigente ? 'border-emerald-500/40 shadow-emerald-950/20' : 'border-slate-800'}`}
                                            >
                                                {/* Top badge */}
                                                <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-transparent via-transparent to-transparent">
                                                    {isVigente && <div className="w-full h-full bg-gradient-to-r from-emerald-500 to-teal-500"></div>}
                                                    {isExceeded && <div className="w-full h-full bg-gradient-to-r from-rose-500 to-red-500"></div>}
                                                </div>

                                                <div className="flex justify-between items-start gap-4 mb-4">
                                                    <div className="flex items-center gap-3">
                                                        {qr.imageUrl ? (
                                                            <div className="w-14 h-14 bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-inner shrink-0 group relative cursor-pointer">
                                                                <img 
                                                                    src={getMediaUrl(qr.imageUrl)} 
                                                                    alt={qr.name} 
                                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="w-14 h-14 bg-slate-900 border border-slate-850 rounded-2xl flex items-center justify-center text-slate-500 shrink-0 shadow-inner">
                                                                <QrCode className="w-6 h-6" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <h3 className="text-white font-extrabold text-sm">{qr.name}</h3>
                                                                {isVigente && (
                                                                    <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded-md animate-pulse">
                                                                        Vigente
                                                                    </span>
                                                                )}
                                                                {isExceeded && (
                                                                    <span className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-wider rounded-md">
                                                                        Límite Superado
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {qr.phoneNumber ? (
                                                                <div className="flex items-center gap-1 mt-1 text-slate-400 hover:text-white transition-all cursor-pointer" onClick={() => {
                                                                    navigator.clipboard.writeText(qr.phoneNumber);
                                                                    setCopiedId(qr.id);
                                                                    setTimeout(() => setCopiedId(null), 2000);
                                                                }}>
                                                                    <span className="font-mono text-xs tracking-wide">{qr.phoneNumber}</span>
                                                                    {copiedId === qr.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-500 text-xs mt-1 block">Sin celular</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => toggleQrActive(qr)}
                                                        type="button"
                                                        className="text-slate-400 hover:text-white transition-colors"
                                                    >
                                                        {qr.isActive ? (
                                                            <ToggleRight className="w-8 h-8 text-emerald-400 fill-emerald-950/20" />
                                                        ) : (
                                                            <ToggleLeft className="w-8 h-8 text-slate-600" />
                                                        )}
                                                    </button>
                                                </div>

                                                <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-3.5 mb-4">
                                                    <div className="flex justify-between items-center text-xs mb-2">
                                                        <span className="text-slate-400 font-bold">Acumulado Mes:</span>
                                                        <span className="text-white font-mono font-black text-sm">S/ {parseFloat(qr.accumulated_month_sum || 0).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs mb-2.5">
                                                        <span className="text-slate-400 font-bold">Límite Mensual:</span>
                                                        <span className="text-slate-300 font-mono font-black">
                                                            {qr.isUnlimited ? 'Ilimitado' : `S/ ${parseFloat(qr.limitAmount).toFixed(2)}`}
                                                        </span>
                                                    </div>
                                                    {!qr.isUnlimited && (
                                                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 
                                                                    ${isExceeded ? 'bg-gradient-to-r from-rose-500 to-red-500' : 
                                                                      pct > 80 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 
                                                                      'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex justify-between items-center pt-2 border-t border-slate-900/80 mt-auto">
                                                    <div className="flex items-center gap-1 border border-slate-850 rounded-xl overflow-hidden bg-slate-900/40 p-0.5">
                                                        <button 
                                                            onClick={() => reorderQr(index, 'up')}
                                                            type="button"
                                                            disabled={index === 0}
                                                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-800 transition-all"
                                                        >
                                                            <ArrowUp className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => reorderQr(index, 'down')}
                                                            type="button"
                                                            disabled={index === qrs.length - 1}
                                                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-800 transition-all"
                                                        >
                                                            <ArrowDown className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => openAdjustBalance(qr)}
                                                            type="button"
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-850 hover:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                                        >
                                                            <Sliders className="w-3 h-3" /> Ajustar Saldo
                                                        </button>
                                                        <button
                                                            onClick={() => openQrEdit(qr)}
                                                            type="button"
                                                            className="p-2 bg-slate-900 hover:bg-slate-800 text-sky-400 hover:text-sky-300 border border-slate-850 hover:border-slate-700 rounded-xl transition-all"
                                                            title="Editar Cuenta QR"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteQr(qr.id)}
                                                            type="button"
                                                            className="p-2 bg-slate-900 hover:bg-slate-800 text-rose-500 hover:text-rose-400 border border-slate-850 hover:border-slate-700 rounded-xl transition-all"
                                                            title="Eliminar Cuenta QR"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>


                        {/* QR Auditor / Movements Section */}
                        <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl relative animate-in fade-in duration-300">
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        Auditoría de Movimientos QR
                                    </h2>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                        Detalle del flujo financiero (Yape, Plin y ajustes de saldo) del mes seleccionado.
                                    </p>
                                </div>
                                
                                {/* Filters Bar */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full lg:w-auto">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mes</label>
                                        <input 
                                            type="month"
                                            value={movementFilters.month}
                                            onChange={(e) => setMovementFilters(prev => ({ ...prev, month: e.target.value }))}
                                            className="w-full bg-slate-900 border border-slate-850 hover:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cuenta QR</label>
                                        <select
                                            value={movementFilters.qr_id}
                                            onChange={(e) => setMovementFilters(prev => ({ ...prev, qr_id: e.target.value }))}
                                            className="w-full bg-slate-900 border border-slate-850 hover:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all"
                                        >
                                            <option value="all">Todas</option>
                                            {qrs.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Usuario</label>
                                        <select
                                            value={movementFilters.user_id}
                                            onChange={(e) => setMovementFilters(prev => ({ ...prev, user_id: e.target.value }))}
                                            className="w-full bg-slate-900 border border-slate-850 hover:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all"
                                        >
                                            <option value="all">Todos</option>
                                            {staffUsers.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
                                        <select
                                            value={movementFilters.transaction_type}
                                            onChange={(e) => setMovementFilters(prev => ({ ...prev, transaction_type: e.target.value }))}
                                            className="w-full bg-slate-900 border border-slate-850 hover:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all"
                                        >
                                            <option value="all">Todos</option>
                                            <option value="yape">Yape</option>
                                            <option value="plin">Plin</option>
                                            <option value="qr_adjustment">Ajustes Manuales</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {movements.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 border border-slate-850 rounded-2xl">
                                    <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                    <span className="text-xs">No hay movimientos registrados para este filtro</span>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-850 text-slate-400 font-bold bg-slate-950/20">
                                                <th className="py-3 px-4">Fecha</th>
                                                <th className="py-3 px-4">Cuenta QR</th>
                                                <th className="py-3 px-4">Método / Tipo</th>
                                                <th className="py-3 px-4">Cajero / Operador</th>
                                                <th className="py-3 px-4">Cliente / Cuenta</th>
                                                <th className="py-3 px-4">Detalle / Evidencia</th>
                                                <th className="py-3 px-4 text-right">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-850/60">
                                            {movements.map((m) => {
                                                const isAdjustment = m.method === 'qr_adjustment';
                                                let isIncome = true;
                                                let evidenceText = '';
                                                
                                                if (isAdjustment) {
                                                    try {
                                                        const adjData = JSON.parse(m.evidence);
                                                        isIncome = adjData.type === 'income';
                                                        evidenceText = adjData.description;
                                                    } catch (e) {
                                                        evidenceText = 'Ajuste';
                                                    }
                                                }

                                                return (
                                                    <tr key={m.id} className="hover:bg-slate-900/40 transition-colors">
                                                        <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                                                            {new Date(m.createdAt).toLocaleString()}
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-white">
                                                            {m.QrAccount?.name || 'Sistema'}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {isAdjustment ? (
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider
                                                                    ${isIncome ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                                                                    {isIncome ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                                                                    Ajuste
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 bg-sky-950 text-sky-400 rounded text-[10px] font-black uppercase tracking-wider">
                                                                    {m.method || 'Pago'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-400">
                                                            {m.User?.displayName || 'Autoservicio'}
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-white">
                                                            {m.Account?.customerName ? (
                                                                <span>Cuenta #{m.Account.id} - {m.Account.customerName}</span>
                                                            ) : (
                                                                <span className="text-slate-500">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={evidenceText}>
                                                            {isAdjustment ? evidenceText : 'Asignación automática por cobro'}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-black">
                                                            <span className={isAdjustment ? (isIncome ? 'text-emerald-400' : 'text-rose-400') : 'text-white'}>
                                                                {isAdjustment && !isIncome ? '-' : ''}S/ {parseFloat(m.amount).toFixed(2)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                </div>
            )}

            {activeTab === 'ads' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Active Projection Status Indicator */}
                    {activeProjection && (
                        <div className="bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border border-emerald-500/30 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl animate-pulse">
                                    <Tv className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest animate-pulse">PROYECCIÓN MANUAL ACTIVA</div>
                                    <h3 className="text-white font-bold text-lg mt-0.5">{activeProjection.promoName}</h3>
                                    <p className="text-slate-400 text-xs mt-0.5">Se está proyectando este elemento en la pantalla del cliente.</p>
                                </div>
                            </div>
                            <button
                                onClick={stopProjection}
                                className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/10 transition-all shrink-0 animate-pulse"
                            >
                                <Square className="w-4 h-4 fill-white" /> Detener Proyección
                            </button>
                        </div>
                    )}

                    {/* Banner Groups and Slides configuration */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        {/* LEFT COLUMN: Groups List */}
                        <div className="lg:col-span-4 bg-slate-950/40 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col h-[550px] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-emerald-500"></div>
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <h3 className="font-bold text-white text-base">Grupos Publicitarios</h3>
                                <button
                                    onClick={openGroupCreate}
                                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 rounded-lg transition-all"
                                    title="Nuevo Grupo"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            {promoGroups.length === 0 ? (
                                <div className="text-center py-20 text-slate-600 flex-1 flex flex-col justify-center items-center">
                                    <List className="w-8 h-8 mb-2" />
                                    <span className="text-xs">No hay grupos creados</span>
                                </div>
                            ) : (
                                <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                                    {promoGroups.map((g) => (
                                        <div
                                            key={g.id}
                                            onClick={() => setSelectedGroupId(g.id)}
                                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3
                                                ${selectedGroupId === g.id 
                                                    ? 'bg-slate-900 border-emerald-500/50 shadow-md shadow-emerald-500/5' 
                                                    : 'bg-slate-900/30 border-slate-850 hover:bg-slate-900/40 hover:border-slate-800'}`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-white text-xs truncate">{g.name}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                    Banners: {g.Images?.length || 0} • {g.isActive ? 'Activo' : 'Inactivo'}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => openGroupEdit(g)}
                                                    className="p-1 hover:bg-slate-800 text-blue-400 hover:text-blue-300 rounded"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteGroup(g.id)}
                                                    className="p-1 hover:bg-slate-800 text-rose-500 hover:text-rose-400 rounded"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Slides Grid of Selected Group */}
                        <div className="lg:col-span-8 bg-slate-950/40 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col h-[550px] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
                            
                            {/* Selected Group Header */}
                            {selectedGroupId ? (
                                <>
                                    {(() => {
                                        const group = promoGroups.find(g => g.id === selectedGroupId);
                                        if (!group) return null;
                                        return (
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 shrink-0 pb-3 border-b border-slate-850">
                                                <div>
                                                    <h3 className="font-bold text-white text-base">
                                                        Diapositivas en "{group.name}"
                                                    </h3>
                                                    <p className="text-slate-500 text-[11px] mt-0.5">
                                                        Sube y administra los banners publicitarios que rotan en este canal.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={openSlideUpload}
                                                    className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md transition-all"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Subir Banners / Videos
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {/* Slides Grid */}
                                    {(() => {
                                        const group = promoGroups.find(g => g.id === selectedGroupId);
                                        const slides = group?.Images || [];

                                        if (slides.length === 0) {
                                            return (
                                                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-20 text-center">
                                                    <Image className="w-12 h-12 text-slate-700 mb-2" />
                                                    <span className="text-xs font-bold text-slate-400">Este grupo no tiene banners</span>
                                                    <span className="text-[10px] text-slate-500 mt-0.5">Suba imágenes (.jpg, .png) o videos (.mp4) para empezar.</span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {slides.map((slide) => {
                                                    const isVideo = slide.imageUrl?.toLowerCase()?.match(/\.(mp4|webm|ogg)$/);
                                                    return (
                                                        <div 
                                                            key={slide.id}
                                                            className={`bg-slate-900 border rounded-2xl overflow-hidden flex flex-col group relative
                                                                ${slide.isActive ? 'border-slate-800 hover:border-emerald-500/40' : 'border-slate-850/40 opacity-50'}`}
                                                        >
                                                            {/* Media preview */}
                                                            <div className="aspect-[16/10] w-full bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-850">
                                                                {isVideo ? (
                                                                    <div className="w-full h-full flex items-center justify-center text-xs text-sky-400 font-mono font-bold bg-sky-950/20">
                                                                        [Video - MP4]
                                                                    </div>
                                                                ) : (
                                                                    <img 
                                                                        src={getMediaUrl(slide.imageUrl)} 
                                                                        alt={slide.name} 
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                )}
                                                                
                                                                {/* Floating hover overlays for remote projection */}
                                                                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-1.5 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <span className="text-[10px] font-black tracking-widest text-slate-400 mb-1 uppercase">Proyectar</span>
                                                                    <button 
                                                                        onClick={() => projectMedia(slide, 2)}
                                                                        className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-emerald-400 border border-slate-800 hover:border-emerald-800 rounded font-bold"
                                                                    >
                                                                        2 Minutos
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => projectMedia(slide, 5)}
                                                                        className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-emerald-400 border border-slate-800 hover:border-emerald-800 rounded font-bold"
                                                                    >
                                                                        5 Minutos
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Info footer */}
                                                            <div className="p-3 flex-1 flex flex-col justify-between">
                                                                <div className="text-[11px] font-bold text-white truncate" title={slide.name}>
                                                                    {slide.name}
                                                                </div>

                                                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-850/60">
                                                                    <button
                                                                        onClick={() => toggleSlideActive(slide)}
                                                                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded
                                                                            ${slide.isActive ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/60' : 'bg-slate-800 text-slate-400 border border-slate-750'}`}
                                                                    >
                                                                        {slide.isActive ? 'Activo' : 'Inactivo'}
                                                                    </button>
                                                                    
                                                                    <button
                                                                        onClick={() => deleteSlide(slide.id)}
                                                                        className="p-1 hover:bg-slate-800 text-rose-500 rounded"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center">
                                    <List className="w-12 h-12 text-slate-700 mb-2 animate-bounce" />
                                    <span className="text-xs">Seleccione un grupo a la izquierda para administrar diapositivas</span>
                                </div>
                            )}

                        </div>
                    </div>

                </div>
            )}

            {activeTab === 'roulette' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Ruleta de Premios Settings */}
                    <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-400"></div>
                        <div className="w-full flex items-center justify-between text-left pb-6 border-b border-slate-850">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                                    <Gamepad className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                                        Ruleta de Premios Interactiva
                                    </h3>
                                    <p className="text-slate-400 text-[11px] mt-0.5">
                                        Administra los premios de lealtad, iconos y peso de probabilidad que se muestran al cliente.
                                    </p>
                                </div>
                            </div>
                        </div>
                            <div className="mt-8 pt-6 border-t border-slate-850 animate-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
                    
                    {/* LEFT COLUMN: Categories Editor */}
                    <div className="lg:col-span-8 bg-slate-950/40 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-400"></div>
                        
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-850">
                            <div>
                                <h3 className="font-bold text-white text-base">Configuración de Ruleta</h3>
                                <p className="text-slate-500 text-[11px] mt-0.5">
                                    Defina los premios de lealtad, iconos/emojis y el peso de probabilidad de salida.
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {/* Toggle active switch */}
                                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-850 px-2.5 py-1.5 rounded-xl">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado:</span>
                                    <button 
                                        onClick={() => handleRouletteConfigChange('is_active', !rouletteConfig.is_active)}
                                        className={`p-0.5 rounded-lg text-xs font-bold transition-all
                                            ${rouletteConfig.is_active ? 'text-emerald-400' : 'text-slate-500'}`}
                                    >
                                        {rouletteConfig.is_active ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Config sliders */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Pagos Calificados Requeridos</label>
                                <input 
                                    type="number"
                                    min="1"
                                    value={rouletteConfig.visits_required || 1}
                                    onChange={(e) => handleRouletteConfigChange('visits_required', parseInt(e.target.value) || 1)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                                <span className="text-[10px] text-slate-500 mt-1 block">Cada cuántos pagos con Yape/Plin exitosos se proyecta la ruleta.</span>
                            </div>
                        </div>

                        {/* Table of categories */}
                        <div className="flex-1 overflow-y-auto mb-6 max-h-[300px]">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="py-2.5 px-3">Premio / Categoría</th>
                                        <th className="py-2.5 px-3 w-16 text-center">Icono</th>
                                        <th className="py-2.5 px-3 w-40">Probabilidad (Peso)</th>
                                        <th className="py-2.5 px-3 text-right">% Real</th>
                                        <th className="py-2.5 px-3 w-12 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850/60">
                                    {rouletteConfig.categories?.map((cat, idx) => {
                                        const percentage = ((cat.weight || 0) / totalWeights) * 100;
                                        return (
                                            <tr key={cat.id} className="hover:bg-slate-900/40">
                                                <td className="py-2.5 px-3">
                                                    <input 
                                                        type="text"
                                                        value={cat.name}
                                                        onChange={(e) => handleCategoryFieldChange(idx, 'name', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                                                    />
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <input 
                                                        type="text"
                                                        value={cat.icon}
                                                        onChange={(e) => handleCategoryFieldChange(idx, 'icon', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-center text-white focus:outline-none focus:border-emerald-500 text-lg"
                                                    />
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="range"
                                                            min="1"
                                                            max="100"
                                                            value={cat.weight || 0}
                                                            onChange={(e) => handleCategoryWeightChange(idx, e.target.value)}
                                                            className="flex-1 accent-emerald-500"
                                                        />
                                                        <input 
                                                            type="number"
                                                            value={cat.weight || 0}
                                                            onChange={(e) => handleCategoryWeightChange(idx, e.target.value)}
                                                            className="w-12 bg-slate-900 border border-slate-850 rounded px-1.5 py-0.5 text-center text-xs focus:outline-none"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                                                    {percentage.toFixed(1)}%
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                    <button
                                                        onClick={() => removeRouletteCategory(idx)}
                                                        className="p-1 text-slate-500 hover:text-rose-500 rounded transition-all"
                                                        title="Eliminar Premio"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center shrink-0 border-t border-slate-850 pt-4">
                            <button
                                onClick={addRouletteCategory}
                                className="flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 rounded-xl text-xs font-bold"
                            >
                                <Plus className="w-4 h-4 text-amber-400" /> Añadir Premio
                            </button>
                            <button
                                onClick={saveRouletteConfig}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md"
                            >
                                <Save className="w-4 h-4" /> Guardar Configuración
                            </button>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Wheel Simulator */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* Wheel Preview SVG */}
                        <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col items-center">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-amber-500"></div>
                            <h3 className="font-bold text-white text-sm mb-4">Vista Previa de Ruleta</h3>
                            
                            {rouletteConfig.categories?.length > 0 ? (
                                <div className="relative w-48 h-48 rounded-full border-4 border-slate-700 shadow-2xl overflow-hidden flex items-center justify-center">
                                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                        {(() => {
                                            let currentAngle = 0;
                                            const colors = ["#064E3B", "#D97706", "#F8FAFC", "#065F46", "#F59E0B", "#F1F5F9"];
                                            return rouletteConfig.categories.map((cat, idx) => {
                                                const portion = (cat.weight || 0) / totalWeights;
                                                const angle = portion * 360;
                                                
                                                // SVG Slice coordinate math
                                                const radStart = (currentAngle * Math.PI) / 180;
                                                const radEnd = ((currentAngle + angle) * Math.PI) / 180;
                                                
                                                const x1 = 50 + 50 * Math.cos(radStart);
                                                const y1 = 50 + 50 * Math.sin(radStart);
                                                const x2 = 50 + 50 * Math.cos(radEnd);
                                                const y2 = 50 + 50 * Math.sin(radEnd);
                                                
                                                const largeArcFlag = angle > 180 ? 1 : 0;
                                                const pathData = `M 50,50 L ${x1},${y1} A 50,50 0 ${largeArcFlag} 1 ${x2},${y2} Z`;
                                                
                                                currentAngle += angle;
                                                
                                                return (
                                                    <path 
                                                        key={cat.id} 
                                                        d={pathData} 
                                                        fill={colors[idx % colors.length]} 
                                                        stroke="#1e293b" 
                                                        strokeWidth="0.5" 
                                                    />
                                                );
                                            });
                                        })()}
                                    </svg>
                                    <div className="absolute w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-600 shadow-lg flex items-center justify-center">
                                        <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-10 text-slate-500 text-xs text-center">
                                    Agregue categorías para ver
                                </div>
                            )}

                            {/* Simulation triggers */}
                            <div className="w-full border-t border-slate-850 pt-4 mt-4 space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Forzar Ganador Simulado</label>
                                    <select
                                        value={selectedWinnerId}
                                        onChange={(e) => setSelectedWinnerId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                                    >
                                        <option value="random">Aleatorio (Pesos)</option>
                                        {rouletteConfig.categories?.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={testProjectRoulette}
                                        className="flex items-center justify-center gap-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/10 transition-all"
                                    >
                                        <Play className="w-3.5 h-3.5 fill-white" /> Proyectar Giro
                                    </button>
                                    <button
                                        onClick={stopProjectRoulette}
                                        className="flex items-center justify-center gap-1 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold transition-all"
                                    >
                                        <X className="w-3.5 h-3.5" /> Quitar Ruleta
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Winner Notification Logs */}
                        <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col h-[230px] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-indigo-500"></div>
                            <h3 className="font-bold text-white text-sm mb-3">Historial de Giros en Vivo</h3>
                            
                            {rouletteLogs.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center text-center py-6 text-slate-500 text-xs border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
                                    Esperando ganadores en directo...
                                </div>
                            ) : (
                                <div className="overflow-y-auto space-y-2 flex-1 pr-1 font-mono text-[11px]">
                                    {rouletteLogs.map(log => (
                                        <div key={log.id} className="p-2 bg-slate-900/60 border border-slate-850 rounded-xl flex justify-between items-start gap-2 animate-in fade-in slide-in-from-bottom duration-300">
                                            <div>
                                                <span className="text-emerald-400 font-bold">🏆 {log.customerName}</span>
                                                <div className="text-white font-black text-xs mt-0.5">{log.prize}</div>
                                            </div>
                                            <span className="text-[10px] text-slate-500">{log.time}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

                    </div>
                </div>
            )}
{showQrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-200">
                        
                        <button
                            onClick={() => setShowQrModal(false)}
                            className="absolute top-4 right-4 p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-4">
                            {editingQr ? 'Editar Cuenta QR' : 'Nueva Cuenta QR'}
                        </h3>

                        <form onSubmit={saveQr} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nombre Identificador</label>
                                <input 
                                    type="text"
                                    required
                                    placeholder="Ej: Yape Administrador / Plin Local"
                                    value={qrFormData.name}
                                    onChange={(e) => setQrFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Número de Celular</label>
                                    <input 
                                        type="text"
                                        placeholder="Opcional"
                                        value={qrFormData.phoneNumber}
                                        onChange={(e) => setQrFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Orden de Rotación</label>
                                    <input 
                                        type="number"
                                        min="0"
                                        required
                                        value={qrFormData.orderIndex}
                                        onChange={(e) => setQrFormData(prev => ({ ...prev, orderIndex: parseInt(e.target.value) || 0 }))}
                                        className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-850 space-y-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-xs font-bold text-white">Transacciones Ilimitadas</span>
                                        <p className="text-[10px] text-slate-500">Omite el límite de recaudación mensual</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setQrFormData(prev => ({ ...prev, isUnlimited: !prev.isUnlimited }))}
                                        className={`p-0.5 rounded-lg text-xs transition-all ${qrFormData.isUnlimited ? 'text-emerald-400' : 'text-slate-500'}`}
                                    >
                                        {qrFormData.isUnlimited ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                                    </button>
                                </div>

                                {!qrFormData.isUnlimited && (
                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Monto Límite Mensual (S/)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-xs text-slate-500 font-bold">S/</span>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                min="1"
                                                required={!qrFormData.isUnlimited}
                                                placeholder="Ej: 5000.00"
                                                value={qrFormData.limitAmount}
                                                onChange={(e) => setQrFormData(prev => ({ ...prev, limitAmount: e.target.value }))}
                                                className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none transition-all font-mono font-bold"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Imagen Código QR (.jpg, .png)</label>
                                <input 
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setQrFormData(prev => ({ ...prev, imageFile: e.target.files[0] }))}
                                    className="w-full text-xs text-slate-400 bg-slate-950 border border-slate-850 file:border-0 file:bg-slate-800 file:hover:bg-slate-750 file:text-white file:px-3 file:py-1.5 file:rounded-lg file:text-xs file:font-bold file:cursor-pointer rounded-xl p-1 cursor-pointer"
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-3 border-t border-slate-850/80">
                                <button
                                    type="button"
                                    onClick={() => setShowQrModal(false)}
                                    className="px-4 py-2 bg-slate-955 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex items-center gap-1 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md"
                                >
                                    <Save className="w-4 h-4" /> Guardar Cuenta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Balance Adjustment */}
            {showAdjustModal && selectedQrForAdjust && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
                        
                        <button
                            onClick={() => setShowAdjustModal(false)}
                            className="absolute top-4 right-4 p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-2">
                            Ajustar Saldo Acumulado
                        </h3>
                        <p className="text-slate-400 text-xs mb-4">
                            Modifica manualmente el saldo mensual acumulado de la cuenta <span className="font-bold text-white">"{selectedQrForAdjust.name}"</span>.
                        </p>

                        <form onSubmit={submitAdjustment} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Tipo de Ajuste</label>
                                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-850">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustmentData(prev => ({ ...prev, type: 'income' }))}
                                        className={`py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all
                                            ${adjustmentData.type === 'income' 
                                                ? 'bg-emerald-950 text-emerald-400 font-bold border border-emerald-800/40' 
                                                : 'text-slate-400 hover:text-white'}`}
                                    >
                                        <ArrowUpRight className="w-3.5 h-3.5" /> Sumar (Ingreso)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustmentData(prev => ({ ...prev, type: 'expense' }))}
                                        className={`py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all
                                            ${adjustmentData.type === 'expense' 
                                                ? 'bg-rose-950 text-rose-400 font-bold border border-rose-800/40' 
                                                : 'text-slate-400 hover:text-white'}`}
                                    >
                                        <ArrowDownLeft className="w-3.5 h-3.5" /> Restar (Egreso)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Monto del Ajuste (S/)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-xs text-slate-500 font-bold">S/</span>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        required
                                        placeholder="Ej: 150.00"
                                        value={adjustmentData.amount}
                                        onChange={(e) => setAdjustmentData(prev => ({ ...prev, amount: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none transition-all font-mono font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Descripción / Razón</label>
                                <textarea 
                                    required
                                    placeholder="Ej: Depósito de prueba / Corrección de saldo duplicado"
                                    value={adjustmentData.description}
                                    onChange={(e) => setAdjustmentData(prev => ({ ...prev, description: e.target.value }))}
                                    rows="3"
                                    className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all"
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-3 border-t border-slate-850/80">
                                <button
                                    type="button"
                                    onClick={() => setShowAdjustModal(false)}
                                    className="px-4 py-2 bg-slate-955 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md animate-pulse"
                                >
                                    <Save className="w-4 h-4" /> Aplicar Ajuste
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Promo Group Create / Edit */}
            {showGroupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200">
                        
                        <button
                            onClick={() => setShowGroupModal(false)}
                            className="absolute top-4 right-4 p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-base font-bold text-white mb-4">
                            {editingGroup ? 'Editar Grupo' : 'Nuevo Grupo de Banners'}
                        </h3>

                        <form onSubmit={saveGroup} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nombre del Grupo</label>
                                <input 
                                    type="text"
                                    required
                                    placeholder="Ej: Banners Fin de Semana / Bebidas HH"
                                    value={groupFormData.name}
                                    onChange={(e) => setGroupFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-center bg-slate-950/40 p-2.5 rounded-2xl border border-slate-850">
                                <div>
                                    <span className="text-xs font-bold text-white block">Secuencia</span>
                                    <input 
                                        type="number"
                                        min="0"
                                        required
                                        value={groupFormData.orderIndex}
                                        onChange={(e) => setGroupFormData(prev => ({ ...prev, orderIndex: parseInt(e.target.value) || 0 }))}
                                        className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-center text-white focus:outline-none mt-1"
                                    />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Activo</span>
                                    <button 
                                        type="button"
                                        onClick={() => setGroupFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                                        className={`p-0.5 rounded-lg text-xs transition-all ${groupFormData.isActive ? 'text-emerald-400' : 'text-slate-500'}`}
                                    >
                                        {groupFormData.isActive ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-3 border-t border-slate-850">
                                <button
                                    type="button"
                                    onClick={() => setShowGroupModal(false)}
                                    className="px-3.5 py-1.5 bg-slate-955 hover:bg-slate-800 border border-slate-805 text-slate-300 rounded-xl text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Slide Upload */}
            {showSlideModal && selectedGroupId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
                        
                        <button
                            onClick={() => setShowSlideModal(false)}
                            className="absolute top-4 right-4 p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-base font-bold text-white mb-4">
                            Subir Diapositivas
                        </h3>

                        <form onSubmit={saveSlides} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nombre (Opcional - por defecto toma el nombre del archivo)</label>
                                <input 
                                    type="text"
                                    placeholder="Nombre personalizado"
                                    value={slideFormData.name}
                                    onChange={(e) => setSlideFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-slate-955 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Seleccionar Imágenes o Videos (Permite selección múltiple)</label>
                                <input 
                                    type="file"
                                    required
                                    multiple
                                    accept="image/*,video/*"
                                    onChange={(e) => setSlideFormData(prev => ({ ...prev, imageFiles: e.target.files }))}
                                    className="w-full text-xs text-slate-400 bg-slate-955 border border-slate-850 file:border-0 file:bg-slate-800 file:hover:bg-slate-750 file:text-white file:px-3 file:py-1.5 file:rounded-lg file:text-xs file:font-bold file:cursor-pointer rounded-xl p-1 cursor-pointer"
                                />
                                <span className="text-[9px] text-slate-500 mt-1 block">Puede seleccionar múltiples archivos de golpe (.jpg, .png, .mp4, .webm).</span>
                            </div>

                            <div className="flex gap-3 justify-end pt-3 border-t border-slate-850">
                                <button
                                    type="button"
                                    onClick={() => setShowSlideModal(false)}
                                    className="px-3.5 py-1.5 bg-slate-955 hover:bg-slate-800 border border-slate-805 text-slate-300 rounded-xl text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md animate-bounce"
                                >
                                    Subir Archivos
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
