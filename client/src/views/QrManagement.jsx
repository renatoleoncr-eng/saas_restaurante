import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { 
    QrCode, Tv, Gamepad, Plus, Trash2, Edit2, Save, RefreshCw, Copy, Check,
    Play, Square, Volume2, Lock, Unlock, Settings, DollarSign, User, Calendar, 
    ArrowUpRight, ArrowDownLeft, Sliders, ToggleLeft, ToggleRight, List, Image,
    Eye, X, ArrowUp, ArrowDown, ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, Gift, History
} from 'lucide-react';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

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
    const [qrSubTab, setQrSubTab] = useState('config'); // 'config' | 'movements'

    
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
    // Ads sub-view: 'groups' = list of groups, 'slides' = managing images of selectedGroupId
    const [adsView, setAdsView] = useState('groups');
    // Track current slide index per group for carousel preview
    const [slideIndexMap, setSlideIndexMap] = useState({});

    // --- Tab 3: Roulette State ---
    const [rouletteConfig, setRouletteConfig] = useState({
        is_active: false,
        visits_required: 1,
        categories: []
    });
    const [rouletteLogs, setRouletteLogs] = useState([]); // Real-time notification of spins
    const [selectedWinnerId, setSelectedWinnerId] = useState('random');

    useModalBackHandler(showQrModal, () => setShowQrModal(false));
    useModalBackHandler(showAdjustModal, () => setShowAdjustModal(false));
    useModalBackHandler(showGroupModal, () => setShowGroupModal(false));
    useModalBackHandler(showSlideModal, () => setShowSlideModal(false));

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

    const reorderGroup = async (index, direction) => {
        const newIndex = direction === 'prev' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= promoGroups.length) return;
        const updated = [...promoGroups];
        const temp = updated[index];
        updated[index] = updated[newIndex];
        updated[newIndex] = temp;
        const items = updated.map((g, idx) => ({ id: g.id, orderIndex: idx }));
        try {
            await axios.put('/api/promotions/groups/reorder', { items });
            fetchPromoGroups();
        } catch (error) {
            console.error('Error reordering groups:', error);
        }
    };

    const toggleGroupActive = async (group) => {
        try {
            await axios.put(`/api/promotions/groups/${group.id}`, { ...group, isActive: !group.isActive });
            showAlert(`Grupo "${group.name}" ${!group.isActive ? 'activado' : 'desactivado'}`);
            fetchPromoGroups();
        } catch (error) {
            console.error('Error toggling group active:', error);
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
        <div className="flex-1 flex flex-col bg-gray-50 min-h-screen text-gray-800 overflow-x-hidden">
            {/* Toast alert */}
            {alert && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border text-sm font-semibold animate-in slide-in-from-top duration-300
                    ${alert.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                      alert.type === 'danger'  ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {alert.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    {alert.type === 'danger'  && <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {alert.type === 'info'    && <Gift className="w-4 h-4 shrink-0" />}
                    {alert.message}
                </div>
            )}

            {/* Page header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Tv className="w-5 h-5 text-blue-600 shrink-0" /> Pantalla del Cliente
                    </h1>
                    <p className="text-gray-500 text-xs mt-0.5">
                        Gestión integrada de cuentas de pago QR rotativas, banners promocionales y ruleta interactiva de lealtad.
                    </p>
                </div>
                <a
                    href="/qr-display"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm font-semibold shadow-sm"
                >
                    <Eye className="w-4 h-4" /> Abrir Pantalla del Cliente
                    <ChevronRight className="w-4 h-4" />
                </a>
            </div>

            {/* Main tabs: Gestión QR / Publicidad / Ruleta */}
            <div className="bg-white border-b border-gray-200 px-6">
                <div className="flex">
                    {[{id:'qr',label:'Gestión QR'},{id:'ads',label:'Publicidad'},{id:'roulette',label:'Ruleta'}]
                        .filter(t => user?.role === 'admin' || user?.role === 'cashier' || t.id === 'qr')
                        .map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                                activeTab === t.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'qr' && (
                <div className="flex flex-col flex-1">
                    {/* Sub-tabs row: Configuración / Movimientos + Agregar QR button */}
                    <div className="bg-white border-b border-gray-200 px-6 flex items-center justify-between">
                        {user?.role !== 'waiter' ? (
                            <div className="flex">
                                <button
                                    onClick={() => setQrSubTab('config')}
                                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                                        qrSubTab === 'config'
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Configuración
                                </button>
                                <button
                                    onClick={() => setQrSubTab('movements')}
                                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                                        qrSubTab === 'movements'
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Movimientos
                                </button>
                            </div>
                        ) : (
                            <div className="flex px-5 py-3 text-sm font-semibold text-blue-600 border-b-2 border-blue-600">
                                Gestión QR
                            </div>
                        )}
                        {qrSubTab === 'config' && user?.role !== 'waiter' && (
                            <button
                                onClick={openQrCreate}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all text-sm font-semibold my-2"
                            >
                                <Plus className="w-4 h-4" /> QR
                            </button>
                        )}
                    </div>

                    {/* ── SUB-TAB: CONFIGURACIÓN ── */}
                    {qrSubTab === 'config' && (
                        <div className="flex-1 animate-in fade-in duration-200 overflow-x-auto">
                            {qrs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <QrCode className="w-12 h-12 text-gray-300 mb-3" />
                                    <h3 className="text-gray-700 font-semibold text-base">No hay cuentas QR configuradas</h3>
                                    <p className="text-gray-400 text-sm mt-1 max-w-sm">
                                        Registre sus cuentas Yape o Plin para habilitar la facturación.
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                                            <th className="py-3 px-4 w-16">QR</th>
                                            <th className="py-3 px-4">Nombre</th>
                                            <th className="py-3 px-4">Celular</th>
                                            {user?.role !== 'waiter' && (
                                                <>
                                                    <th className="py-3 px-4">Límite</th>
                                                    <th className="py-3 px-4">Acumulado</th>
                                                    <th className="py-3 px-4 text-center">Ilimitado</th>
                                                    <th className="py-3 px-4 text-right">Acciones</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {qrs.map((qr, index) => {
                                            const isExceeded = !qr.isUnlimited && parseFloat(qr.accumulated_month_sum || 0) >= parseFloat(qr.limitAmount || 0);
                                            const activeRotationQr = qrs.find(q => q.isActive && (q.isUnlimited || parseFloat(q.accumulated_month_sum || 0) < parseFloat(q.limitAmount || 0)));
                                            const isVigente = activeRotationQr && activeRotationQr.id === qr.id;

                                            return (
                                                <tr
                                                    key={qr.id}
                                                    className={`hover:bg-blue-50/30 transition-colors ${
                                                        isVigente ? 'border-l-4 border-l-blue-500' : ''
                                                    }`}
                                                >
                                                    {/* QR foto */}
                                                    <td className="py-3 px-4">
                                                        {qr.imageUrl ? (
                                                            <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded-lg overflow-hidden shadow-sm cursor-pointer group">
                                                                <img
                                                                    src={getMediaUrl(qr.imageUrl)}
                                                                    alt={qr.name}
                                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                                                                <QrCode className="w-5 h-5" />
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Nombre */}
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-gray-800">{qr.name}</span>
                                                            {isVigente && (
                                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wide rounded-full">
                                                                    Vigente
                                                                </span>
                                                            )}
                                                            {isExceeded && (
                                                                <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wide rounded-full">
                                                                    Límite Superado
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Celular */}
                                                    <td className="py-3 px-4">
                                                        {qr.phoneNumber ? (
                                                            <div
                                                                className="flex items-center gap-1 cursor-pointer text-gray-600 hover:text-blue-600 transition-colors"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(qr.phoneNumber);
                                                                    setCopiedId(qr.id);
                                                                    setTimeout(() => setCopiedId(null), 2000);
                                                                }}
                                                            >
                                                                <span className="font-mono text-sm">{qr.phoneNumber}</span>
                                                                {copiedId === qr.id
                                                                    ? <Check className="w-3.5 h-3.5 text-green-500" />
                                                                    : <Copy className="w-3.5 h-3.5 text-gray-400" />
                                                                }
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400">—</span>
                                                        )}
                                                    </td>

                                                    {user?.role !== 'waiter' && (
                                                        <>
                                                            {/* Límite */}
                                                            <td className="py-3 px-4">
                                                                <span className="text-gray-700 font-mono">
                                                                    {qr.isUnlimited ? '—' : `S/ ${parseFloat(qr.limitAmount || 0).toFixed(2)}`}
                                                                </span>
                                                            </td>

                                                            {/* Acumulado */}
                                                            <td className="py-3 px-4">
                                                                <div>
                                                                    <span className={`font-bold font-mono text-sm ${
                                                                        isExceeded ? 'text-red-600' : 'text-blue-600'
                                                                    }`}>
                                                                        S/ {parseFloat(qr.accumulated_month_sum || 0).toFixed(2)}
                                                                    </span>
                                                                    {isVigente && !isExceeded && (
                                                                        <div className="text-[10px] text-green-600 font-semibold uppercase">VIGENTE</div>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Ilimitado */}
                                                            <td className="py-3 px-4 text-center">
                                                                {qr.isUnlimited
                                                                    ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">Sí</span>
                                                                    : <span className="text-gray-400">—</span>
                                                                }
                                                            </td>

                                                            {/* Acciones */}
                                                            <td className="py-3 px-4">
                                                                <div className="flex items-center gap-1 justify-end flex-wrap">
                                                                    {/* Flechas orden */}
                                                                    <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white">
                                                                        <button
                                                                            onClick={() => reorderQr(index, 'up')}
                                                                            disabled={index === 0}
                                                                            title="Subir orden"
                                                                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 transition-all"
                                                                        >
                                                                            <ArrowUp className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <div className="w-px h-4 bg-gray-200" />
                                                                        <button
                                                                            onClick={() => reorderQr(index, 'down')}
                                                                            disabled={index === qrs.length - 1}
                                                                            title="Bajar orden"
                                                                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 transition-all"
                                                                        >
                                                                            <ArrowDown className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>

                                                                    {/* +SALDO */}
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedQrForAdjust(qr);
                                                                            setAdjustmentData({ type: 'income', amount: '', description: '' });
                                                                            setShowAdjustModal(true);
                                                                        }}
                                                                        className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-md transition-all"
                                                                    >
                                                                        + SALDO
                                                                    </button>

                                                                    {/* -SALDO */}
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedQrForAdjust(qr);
                                                                            setAdjustmentData({ type: 'expense', amount: '', description: '' });
                                                                            setShowAdjustModal(true);
                                                                        }}
                                                                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-md border border-gray-200 transition-all"
                                                                    >
                                                                        - SALDO
                                                                    </button>

                                                                    {/* Editar */}
                                                                    <button
                                                                        onClick={() => openQrEdit(qr)}
                                                                        title="Editar"
                                                                        className="w-8 h-8 flex items-center justify-center text-blue-500 hover:text-blue-700 hover:bg-blue-50 border border-gray-200 rounded-md transition-all"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </button>

                                                                    {/* Eliminar */}
                                                                    <button
                                                                        onClick={() => deleteQr(qr.id)}
                                                                        title="Eliminar"
                                                                        className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-md transition-all"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* ── SUB-TAB: MOVIMIENTOS ── */}
                    {qrSubTab === 'movements' && (
                        <div className="flex-1 p-6 animate-in fade-in duration-200">
                            {/* Filtros */}
                            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 shadow-sm">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mes</label>
                                        <input
                                            type="month"
                                            value={movementFilters.month}
                                            onChange={(e) => setMovementFilters(prev => ({ ...prev, month: e.target.value }))}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cuenta QR</label>
                                        <select
                                            value={movementFilters.qr_id}
                                            onChange={(e) => setMovementFilters(prev => ({ ...prev, qr_id: e.target.value }))}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="all">Todas</option>
                                            {qrs.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Usuario</label>
                                        <select
                                            value={movementFilters.user_id}
                                            onChange={(e) => setMovementFilters(prev => ({ ...prev, user_id: e.target.value }))}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="all">Todos</option>
                                            {staffUsers.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tipo</label>
                                        <select
                                            value={movementFilters.transaction_type}
                                            onChange={(e) => setMovementFilters(prev => ({ ...prev, transaction_type: e.target.value }))}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500"
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
                                <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-xl">
                                    <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <span className="text-sm">No hay movimientos registrados para este filtro</span>
                                </div>
                            ) : (
                                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm border-collapse">
                                            <thead>
                                                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                                                    <th className="py-3 px-4">Fecha</th>
                                                    <th className="py-3 px-4">Cuenta QR</th>
                                                    <th className="py-3 px-4">Método / Tipo</th>
                                                    <th className="py-3 px-4">Cajero / Operador</th>
                                                    <th className="py-3 px-4">Cliente / Cuenta</th>
                                                    <th className="py-3 px-4">Detalle / Evidencia</th>
                                                    <th className="py-3 px-4 text-right">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {movements.map((m) => {
                                                    const isAdjustment = m.method === 'qr_adjustment';
                                                    let isIncome = true;
                                                    let evidenceText = '';
                                                    if (isAdjustment) {
                                                        try {
                                                            const adjData = JSON.parse(m.evidence);
                                                            isIncome = adjData.type === 'income';
                                                            evidenceText = adjData.description;
                                                        } catch (e) { evidenceText = 'Ajuste'; }
                                                    }
                                                    return (
                                                        <tr key={m.id} className="hover:bg-blue-50/20 transition-colors">
                                                            <td className="py-3 px-4 text-gray-500 font-mono text-xs">{new Date(m.createdAt).toLocaleString()}</td>
                                                            <td className="py-3 px-4 font-semibold text-gray-800">{m.QrAccount?.name || 'Sistema'}</td>
                                                            <td className="py-3 px-4">
                                                                {isAdjustment ? (
                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                                        isIncome ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                                                    }`}>
                                                                        {isIncome ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                                                                        Ajuste
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase">
                                                                        {m.method || 'Pago'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-4 text-gray-500">{m.User?.displayName || 'Autoservicio'}</td>
                                                            <td className="py-3 px-4 font-semibold text-gray-800">
                                                                {m.Account?.customerName
                                                                    ? <span>Cuenta #{m.Account.id} - {m.Account.customerName}</span>
                                                                    : <span className="text-gray-400">—</span>
                                                                }
                                                            </td>
                                                            <td className="py-3 px-4 text-gray-400 max-w-xs truncate text-xs" title={evidenceText}>
                                                                {isAdjustment ? evidenceText : 'Asignación automática por cobro'}
                                                            </td>
                                                            <td className="py-3 px-4 text-right font-bold font-mono">
                                                                <span className={isAdjustment ? (isIncome ? 'text-green-600' : 'text-red-500') : 'text-gray-800'}>
                                                                    {isAdjustment && !isIncome ? '-' : ''}S/ {parseFloat(m.amount).toFixed(2)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'ads' && (
                <div className="flex flex-col flex-1 animate-in fade-in duration-200">

                    {/* ── VISTA: LISTA DE GRUPOS ── */}
                    {adsView === 'groups' && (
                        <>
                            {/* Subheader */}
                            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                <div>
                                    <h2 className="text-base font-bold text-gray-800">Panel de Publicidad (Grupos)</h2>
                                    <p className="text-gray-400 text-xs mt-0.5">Organiza tu publicidad en categorías o grupos</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <a href="/qr-display" target="_blank" rel="noreferrer"
                                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-semibold transition-colors">
                                        <Eye className="w-4 h-4" />
                                        La proyección de la pantalla del cliente está <span className="underline">AQUÍ</span>
                                    </a>
                                    <button
                                        onClick={openGroupCreate}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all text-sm font-semibold"
                                    >
                                        <Plus className="w-4 h-4" /> Nuevo Grupo
                                    </button>
                                </div>
                            </div>

                            {/* Groups grid */}
                            <div className="p-6">
                                {promoGroups.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-gray-200 rounded-xl">
                                        <Image className="w-12 h-12 text-gray-300 mb-3" />
                                        <h3 className="text-gray-700 font-semibold text-base">No hay grupos creados</h3>
                                        <p className="text-gray-400 text-sm mt-1">Crea un grupo para empezar a subir banners publicitarios.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                        {promoGroups.map((group, index) => {
                                            const slides = group.Images || [];
                                            const currentIdx = slideIndexMap[group.id] || 0;
                                            const currentSlide = slides[currentIdx];
                                            const isVideo = currentSlide?.imageUrl?.toLowerCase()?.match(/\.(mp4|webm|ogg)$/);

                                            return (
                                                <div key={group.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                                    {/* Card header */}
                                                    <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <h3 className="font-bold text-gray-800 text-sm truncate">{group.name}</h3>
                                                            <p className="text-gray-400 text-xs mt-0.5">{slides.length} imagen{slides.length !== 1 ? 'es' : ''} cargada{slides.length !== 1 ? 's' : ''}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {/* Order arrows */}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); reorderGroup(index, 'prev'); }}
                                                                disabled={index === 0}
                                                                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 border border-gray-200 rounded disabled:opacity-30 transition-all"
                                                            >
                                                                <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); reorderGroup(index, 'next'); }}
                                                                disabled={index === promoGroups.length - 1}
                                                                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 border border-gray-200 rounded disabled:opacity-30 transition-all"
                                                            >
                                                                <ChevronRight className="w-3.5 h-3.5" />
                                                            </button>
                                                            {/* Active badge toggle */}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); toggleGroupActive(group); }}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                                                                    group.isActive
                                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                {group.isActive ? 'Activo' : 'Inactivo'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Image preview */}
                                                    <div className="relative bg-gray-900 aspect-video mx-4 mt-1 rounded-lg overflow-hidden border border-gray-200">
                                                        {slides.length === 0 ? (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                                                <Image className="w-8 h-8 text-gray-600" />
                                                            </div>
                                                        ) : isVideo ? (
                                                            <div className="w-full h-full flex items-center justify-center text-blue-400 text-xs font-bold bg-blue-950/30">
                                                                ▶ Video
                                                            </div>
                                                        ) : (
                                                            <img
                                                                src={getMediaUrl(currentSlide?.imageUrl)}
                                                                alt={currentSlide?.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        )}
                                                        {/* Slide nav dots */}
                                                        {slides.length > 1 && (
                                                            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                                                                {slides.map((_, i) => (
                                                                    <button
                                                                        key={i}
                                                                        onClick={() => setSlideIndexMap(prev => ({ ...prev, [group.id]: i }))}
                                                                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIdx ? 'bg-white' : 'bg-white/40'}`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {/* Prev/Next arrows on hover */}
                                                        {slides.length > 1 && (
                                                            <>
                                                                <button
                                                                    onClick={() => setSlideIndexMap(prev => ({ ...prev, [group.id]: currentIdx > 0 ? currentIdx - 1 : slides.length - 1 }))}
                                                                    className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all"
                                                                >
                                                                    <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setSlideIndexMap(prev => ({ ...prev, [group.id]: currentIdx < slides.length - 1 ? currentIdx + 1 : 0 }))}
                                                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all"
                                                                >
                                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Proyectar button */}
                                                    <div className="px-4 pt-3">
                                                        <button
                                                            onClick={() => { if (currentSlide) projectMedia(currentSlide, 5); }}
                                                            disabled={!currentSlide}
                                                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all"
                                                        >
                                                            <Play className="w-4 h-4 fill-white" />
                                                        </button>
                                                    </div>

                                                    {/* Card footer actions */}
                                                    <div className="px-4 pt-2 pb-3 flex items-center justify-between">
                                                        {/* Manage images */}
                                                        <button
                                                            onClick={() => { setSelectedGroupId(group.id); setAdsView('slides'); }}
                                                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-all"
                                                            title="Gestionar imágenes"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <div className="flex items-center gap-1">
                                                            {/* Upload images */}
                                                            <button
                                                                onClick={() => { setSelectedGroupId(group.id); openSlideUpload(); }}
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                                                title="Subir imágenes"
                                                            >
                                                                <Image className="w-4 h-4" />
                                                            </button>
                                                            {/* Delete group */}
                                                            <button
                                                                onClick={() => deleteGroup(group.id)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                                title="Eliminar grupo"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── VISTA: GESTIÓN DE IMÁGENES DE UN GRUPO ── */}
                    {adsView === 'slides' && (() => {
                        const group = promoGroups.find(g => g.id === selectedGroupId);
                        const slides = group?.Images || [];
                        return (
                            <>
                                {/* Subheader */}
                                <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setAdsView('groups')}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all"
                                        >
                                            <ChevronDown className="w-4 h-4 rotate-90" />
                                        </button>
                                        <div>
                                            <h2 className="text-base font-bold text-gray-800">Grupo: {group?.name}</h2>
                                            <p className="text-gray-400 text-xs mt-0.5">Gestiona las imágenes de este grupo</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <a href="/qr-display" target="_blank" rel="noreferrer"
                                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-semibold transition-colors">
                                            <Eye className="w-4 h-4" />
                                            La proyección de la pantalla del cliente está <span className="underline">AQUÍ</span>
                                        </a>
                                        <button
                                            onClick={openSlideUpload}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all text-sm font-semibold"
                                        >
                                            <Plus className="w-4 h-4" /> Nueva Imagen/Video
                                        </button>
                                    </div>
                                </div>

                                {/* Slides grid */}
                                <div className="p-6">
                                    {slides.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-gray-200 rounded-xl">
                                            <Image className="w-12 h-12 text-gray-300 mb-3" />
                                            <h3 className="text-gray-700 font-semibold">Este grupo no tiene imágenes</h3>
                                            <p className="text-gray-400 text-sm mt-1">Sube imágenes o videos para empezar.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {slides.map((slide, slideIdx) => {
                                                const isVid = slide.imageUrl?.toLowerCase()?.match(/\.(mp4|webm|ogg)$/);
                                                return (
                                                    <div key={slide.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                                        {/* Image preview */}
                                                        <div className="relative bg-gray-900 aspect-video">
                                                            {isVid ? (
                                                                <div className="w-full h-full flex items-center justify-center text-blue-400 font-bold text-sm">▶ Video</div>
                                                            ) : (
                                                                <img src={getMediaUrl(slide.imageUrl)} alt={slide.name} className="w-full h-full object-cover" />
                                                            )}
                                                            {/* Slide prev/next order */}
                                                            <div className="absolute bottom-2 right-2 flex gap-1">
                                                                <button
                                                                    onClick={() => {/* reorder slide prev */}}
                                                                    disabled={slideIdx === 0}
                                                                    className="w-5 h-5 rounded bg-black/50 hover:bg-black/70 text-white flex items-center justify-center disabled:opacity-30 transition-all"
                                                                >
                                                                    <ChevronDown className="w-3 h-3 rotate-90" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {/* reorder slide next */}}
                                                                    disabled={slideIdx === slides.length - 1}
                                                                    className="w-5 h-5 rounded bg-black/50 hover:bg-black/70 text-white flex items-center justify-center disabled:opacity-30 transition-all"
                                                                >
                                                                    <ChevronRight className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Footer */}
                                                        <div className="px-3 py-2 flex items-center justify-between">
                                                            <button
                                                                onClick={() => toggleSlideActive(slide)}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                                                                    slide.isActive
                                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                {slide.isActive ? 'Activa' : 'Inactiva'}
                                                            </button>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => projectMedia(slide, 5)}
                                                                    title="Proyectar 5 min"
                                                                    className="w-7 h-7 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded transition-all"
                                                                >
                                                                    <Play className="w-3.5 h-3.5 fill-white" />
                                                                </button>
                                                                <button
                                                                    title="Editar"
                                                                    className="w-7 h-7 flex items-center justify-center text-blue-500 hover:text-blue-700 hover:bg-blue-50 border border-gray-200 rounded transition-all"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteSlide(slide.id)}
                                                                    title="Eliminar"
                                                                    className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded transition-all"
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
                            </>
                        );
                    })()}

                    {/* Active projection banner */}
                    {activeProjection && (
                        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-5 py-3 bg-blue-700 text-white rounded-2xl shadow-2xl border border-blue-500 animate-in slide-in-from-bottom duration-300">
                            <div className="flex items-center gap-2">
                                <Tv className="w-4 h-4 animate-pulse" />
                                <span className="font-bold text-sm">Proyectando: {activeProjection.promoName}</span>
                            </div>
                            <button
                                onClick={stopProjection}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-all"
                            >
                                <Square className="w-3 h-3 fill-white" /> Detener
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'roulette' && (
                <div className="flex flex-col flex-1 animate-in fade-in duration-200">
                    {/* Subheader / Action Bar */}
                    <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">Premios y Lealtad</h2>
                            <p className="text-gray-400 text-xs mt-0.5">Configura las reglas de recompensa de la ruleta para incentivar a los clientes.</p>
                        </div>
                        <button
                            onClick={saveRouletteConfig}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all text-sm font-bold"
                        >
                            <Save className="w-4 h-4" /> Guardar Cambios
                        </button>
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* LEFT COLUMN: Configuration */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* Card 1: Reglas Generales */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-150">Reglas Generales</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="flex flex-col">
                                        <label className="text-xs font-bold text-gray-700 mb-1.5">Estado de la Función</label>
                                        <p className="text-[11px] text-gray-400 mb-2">Habilita o deshabilita la ruleta en la pantalla del cliente.</p>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleRouletteConfigChange('is_active', !rouletteConfig.is_active)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                                    rouletteConfig.is_active
                                                        ? 'bg-green-55 text-green-700 border-green-200'
                                                        : 'bg-gray-50 text-gray-500 border-gray-200'
                                                }`}
                                            >
                                                <span className={`w-2.5 h-2.5 rounded-full ${rouletteConfig.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                                {rouletteConfig.is_active ? 'Activo' : 'Apagado'}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-700 mb-1.5 block">Pagos Calificados Requeridos (X)</label>
                                        <p className="text-[11px] text-gray-400 mb-2">Cantidad de pagos con Yape/Plin exitosos para habilitar el giro de ruleta.</p>
                                        <input
                                            type="number"
                                            min="1"
                                            value={rouletteConfig.visits_required || 1}
                                            onChange={(e) => handleRouletteConfigChange('visits_required', parseInt(e.target.value) || 1)}
                                            className="w-full sm:w-48 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-semibold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Opciones / Premios */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-150">
                                    <h3 className="text-sm font-bold text-gray-800">Opciones / Premios ({rouletteConfig.categories?.length || 0})</h3>
                                    <button
                                        onClick={addRouletteCategory}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-55 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold transition-all"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> AÑADIR PREMIO
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-150">
                                                <th className="pb-3 w-16 text-center">Icono</th>
                                                <th className="pb-3 px-3">Premio</th>
                                                <th className="pb-3 px-3 w-28">Peso</th>
                                                <th className="pb-3 px-3 w-16 text-right">% Real</th>
                                                <th className="pb-3 w-24 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {rouletteConfig.categories?.map((cat, idx) => {
                                                const percentage = ((cat.weight || 0) / totalWeights) * 100;
                                                return (
                                                    <tr key={cat.id} className="hover:bg-gray-50/50">
                                                        <td className="py-2.5">
                                                            <input
                                                                type="text"
                                                                value={cat.icon}
                                                                onChange={(e) => handleCategoryFieldChange(idx, 'icon', e.target.value)}
                                                                className="w-12 mx-auto bg-white border border-gray-300 rounded-lg px-1.5 py-1 text-sm text-center text-gray-800 focus:outline-none focus:border-blue-500 font-semibold"
                                                            />
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                            <input
                                                                type="text"
                                                                value={cat.name}
                                                                onChange={(e) => handleCategoryFieldChange(idx, 'name', e.target.value)}
                                                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-sm text-gray-800 focus:outline-none focus:border-blue-500 font-semibold"
                                                            />
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={cat.weight || 0}
                                                                onChange={(e) => handleCategoryWeightChange(idx, e.target.value)}
                                                                className="w-20 bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-sm text-center text-gray-800 focus:outline-none focus:border-blue-500 font-semibold"
                                                            />
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-600">
                                                            {percentage.toFixed(0)}%
                                                        </td>
                                                        <td className="py-2.5 text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <button
                                                                    disabled={idx === 0}
                                                                    onClick={() => {
                                                                        const updated = [...rouletteConfig.categories];
                                                                        const temp = updated[idx];
                                                                        updated[idx] = updated[idx - 1];
                                                                        updated[idx - 1] = temp;
                                                                        handleRouletteConfigChange('categories', updated);
                                                                    }}
                                                                    className="w-6 h-6 flex items-center justify-center border border-gray-200 text-gray-400 hover:text-blue-600 rounded disabled:opacity-30 transition-all"
                                                                >
                                                                    <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                                                                </button>
                                                                <button
                                                                    disabled={idx === rouletteConfig.categories.length - 1}
                                                                    onClick={() => {
                                                                        const updated = [...rouletteConfig.categories];
                                                                        const temp = updated[idx];
                                                                        updated[idx] = updated[idx + 1];
                                                                        updated[idx + 1] = temp;
                                                                        handleRouletteConfigChange('categories', updated);
                                                                    }}
                                                                    className="w-6 h-6 flex items-center justify-center border border-gray-200 text-gray-400 hover:text-blue-600 rounded disabled:opacity-30 transition-all"
                                                                >
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => removeRouletteCategory(idx)}
                                                                    className="w-6 h-6 flex items-center justify-center border border-gray-200 text-gray-400 hover:text-red-550 hover:bg-red-50 rounded transition-all"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">
                                    * El peso de probabilidad es relativo. Un peso de 10 comparado con uno de 1 significa que tiene 10 veces más alcance de salir sorteado en el sistema.
                                </p>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Simulator & Live Logs */}
                        <div className="lg:col-span-4 space-y-6">
                            {/* Card 3: Vista Previa de Ruleta */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col items-center">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-150 w-full text-center">Vista Previa de Ruleta</h3>

                                {rouletteConfig.categories?.length > 0 ? (
                                    <div className="relative w-44 h-44 rounded-full border-4 border-gray-200 shadow-lg overflow-hidden flex items-center justify-center my-4">
                                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                            {(() => {
                                                let currentAngle = 0;
                                                // Palette layout matching Mak Suites preview
                                                const colors = ["#047857", "#d97706", "#ffffff", "#065f46", "#f59e0b", "#f8fafc"];
                                                return rouletteConfig.categories.map((cat, idx) => {
                                                    const portion = (cat.weight || 0) / totalWeights;
                                                    const angle = portion * 360;

                                                    // SVG coordinate math
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
                                                            stroke="#cbd5e1"
                                                            strokeWidth="0.5"
                                                        />
                                                    );
                                                });
                                            })()}
                                        </svg>
                                        <div className="absolute w-8 h-8 rounded-full bg-white border border-gray-300 shadow-md flex items-center justify-center">
                                            <div className="w-3.5 h-3.5 bg-blue-600 rounded-full animate-pulse"></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-12 text-gray-400 text-xs text-center">
                                        Agrega opciones para ver la ruleta
                                    </div>
                                )}

                                {/* Simulation controls */}
                                <div className="w-full border-t border-gray-150 pt-4 mt-2 space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Forzar Ganador Simulado</label>
                                        <select
                                            value={selectedWinnerId}
                                            onChange={(e) => setSelectedWinnerId(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1"
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
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                        >
                                            <Play className="w-3.5 h-3.5 fill-white" /> Proyectar Giro
                                        </button>
                                        <button
                                            onClick={stopProjectRoulette}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold transition-all"
                                        >
                                            <X className="w-3.5 h-3.5" /> Quitar Ruleta
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: Live logs */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col h-[200px]">
                                <h3 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-150">Historial de Giros en Vivo</h3>
                                {rouletteLogs.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center text-center py-6 text-gray-400 text-xs border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                        Esperando ganadores en directo...
                                    </div>
                                ) : (
                                    <div className="overflow-y-auto space-y-2 flex-1 pr-1 font-mono text-[11px]">
                                        {rouletteLogs.map(log => (
                                            <div key={log.id} className="p-2 bg-gray-50 border border-gray-150 rounded-lg flex justify-between items-start gap-2">
                                                <div>
                                                    <span className="text-green-700 font-bold">🏆 {log.customerName}</span>
                                                    <div className="text-gray-800 font-bold text-xs mt-0.5">{log.prize}</div>
                                                </div>
                                                <span className="text-[10px] text-gray-400">{log.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
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
