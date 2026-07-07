import React, { useState, useRef, useEffect } from 'react';
import { useRestaurant } from '../contexts/RestaurantContext';
import AdminDashboard from './AdminDashboard';
import WaiterMap from '../components/WaiterMap';
import StockDashboard from '../components/StockDashboard';
import MenuView from './MenuView';
import CashRegisterView from './CashRegisterView';
import UserManagementModal from '../components/UserManagementModal';
import PasswordChangeModal from '../components/PasswordChangeModal';
import { useNavigate } from 'react-router-dom';
import DrinkPromotionsConfig from '../components/DrinkPromotionsConfig';
import BillingConfigModal from '../components/BillingConfigModal';
import QrManagement from './QrManagement';
import AuditLogView from '../components/AuditLogView';
import { 
    LogOut, LayoutGrid, Utensils, Package, ChevronLeft, ChevronRight, 
    Users, User, ChevronUp, Key, TrendingUp, FileText, Wine, CreditCard, Settings,
    Tv, Menu, ClipboardList
} from 'lucide-react';

export default function Dashboard() {
    const { user, logout, config, tenantInfo } = useRestaurant();
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState(() => {
        return localStorage.getItem('lastView') || 'main';
    });

    useEffect(() => {
        localStorage.setItem('lastView', currentView);
    }, [currentView]);

    // Role-based view protection
    useEffect(() => {
        const restrictedViews = {
            waiter: ['drink_promos', 'audit'],
            cashier: ['drink_promos', 'audit'], 
            kitchen: ['stock', 'menu', 'reports', 'drink_promos', 'qr_management', 'audit']
        };

        if (user && restrictedViews[user.role]?.includes(currentView)) {
            console.warn(`Role ${user.role} attempted to access restricted view: ${currentView}. Redirecting to main.`);
            setCurrentView('main');
        }
    }, [currentView, user.role]);

    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isLocked, setIsLocked] = useState(false);

    // User Menu State
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showMobileUserMenu, setShowMobileUserMenu] = useState(false);
    const [showUserManagement, setShowUserManagement] = useState(false);
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [showBillingConfig, setShowBillingConfig] = useState(false);
    const menuRef = useRef(null);
    const mobileMenuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowUserMenu(false);
                const wrapper = document.getElementById('sidebar-wrapper');
                if (wrapper && !wrapper.contains(event.target) && window.innerWidth >= 768 && !isLocked) {
                    setIsCollapsed(true);
                }
            }
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
                setShowMobileUserMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [isLocked]);

    // --- SWIPE GESTURE LOGIC START ---
    const touchStartRef = useRef(null);
    const touchEndRef = useRef(null);

    // Minimum distance (in px) to be considered a swipe
    const minSwipeDistance = 50;
    // Maximum X coordinate starting point for a "swipe right" to be valid 
    // (Prevents accidental opening when swiping horizontally on tables)
    const maxSwipeRightEdge = 40;

    const onTouchStart = (e) => {
        touchEndRef.current = null; // Reset touch end
        touchStartRef.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e) => {
        touchEndRef.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = () => {
        if (!touchStartRef.current || !touchEndRef.current) return;
        const distance = touchStartRef.current - touchEndRef.current;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (window.innerWidth < 768) {
            if (isLeftSwipe && !isCollapsed) {
                // Swipe Left: Close open menu anywhere
                setIsCollapsed(true);
            } else if (isRightSwipe && isCollapsed && touchStartRef.current <= maxSwipeRightEdge) {
                // Swipe Right: Open menu only if started from the far-left edge
                setIsCollapsed(false);
            }
        }
    };
    // --- SWIPE GESTURE LOGIC END ---

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const renderContent = () => {
        if (currentView === 'stock') {
            return <StockDashboard readOnly={user.role !== 'admin'} user={user} />;
        }
        if (currentView === 'menu') {
            return <MenuView />;
        }
        if (currentView === 'reports') {
            return <CashRegisterView />;
        }
        if (currentView === 'drink_promos') {
            return <DrinkPromotionsConfig />;
        }
        if (currentView === 'qr_management') {
            return <QrManagement />;
        }
        if (currentView === 'audit') {
            return <AuditLogView />;
        }

        switch (user.role) {
            case 'admin':
                return <AdminDashboard onGoToSection={setCurrentView} />;
            case 'waiter':
            case 'cashier':
                return <WaiterMap onGoToSection={setCurrentView} />;
            case 'kitchen':
                return <div className="p-8 text-center text-gray-500">Vista de Cocina Deshabilitada</div>;
            default:
                return <div>Rol desconocido</div>;
        }
    };

    // Close sidebar when clicking outside on mobile
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            const sidebar = document.getElementById('sidebar-nav');
            const toggleButton = document.querySelector('button[title="Expandir"], button[title="Colapsar"]'); // Attempt to target toggle button more specifically if possible

            if (window.innerWidth < 768 && !isCollapsed && sidebar && !sidebar.contains(event.target)) {
                // Check if click is on the toggle button (or its children) to avoid immediate re-closing
                // The toggle button is outside the sidebar now.
                // We can use a ref for the button too, or just check class/id.
                // Or simply: if target is not sidebar AND not toggle button.
                // Let's assume the toggle button click handler handles the toggle, so we only care if it's NOT the toggle button.
                // But finding the toggle button via DOM query might be fragile if there are multiple buttons.
                // Better to check if the click target is the button itself (we can add an ID to the button).
                const isToggle = event.target.closest('#sidebar-toggle');
                if (!isToggle) {
                    setIsCollapsed(true);
                }
            }
        };

        if (!isCollapsed && window.innerWidth < 768) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCollapsed]);

    return (
        <div
            className="flex h-[100dvh] bg-gray-100 overflow-hidden relative"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Sidebar Backdrop for Mobile */}
            {!isCollapsed && (
                <div
                    className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-all duration-300"
                    onClick={() => setIsCollapsed(true)}
                />
            )}

            {/* Sidebar & Toggle Button Wrapper */}
            <div
                id="sidebar-wrapper"
                className={`fixed md:relative top-0 left-0 z-40 transition-all duration-300 h-[100dvh] md:h-full ${isCollapsed ? 'w-0' : 'w-64'}`}
                onMouseEnter={() => { if (window.innerWidth >= 768 && !isLocked) setIsCollapsed(false) }}
                onMouseLeave={() => { if (window.innerWidth >= 768 && !isLocked && !showUserMenu) setIsCollapsed(true) }}
            >
                {/* Toggle Button */}
                <button
                    id="sidebar-toggle"
                    onClick={() => {
                        const nextCollapsed = !isCollapsed;
                        setIsCollapsed(nextCollapsed);
                        setIsLocked(!nextCollapsed);
                    }}
                    className={`absolute transition-all duration-300 z-50 focus:outline-none bg-white border-2 border-gray-200 shadow-md rounded-full text-blue-600 hover:text-blue-800 hidden md:flex items-center justify-center
                        top-1/2 -translate-y-1/2
                        w-8 h-8 md:w-12 md:h-12 p-0
                        left-full -translate-x-1/2
                        ${isCollapsed ? 'ml-8 md:ml-4' : ''}
                    `}
                // left-full places it at the right edge of the wrapper (0 or 64).
                // -translate-x-1/2 centers it on the line.
                // If collapsed (w-0), left is 0. We want it pushed out a bit?
                // Previous logic: left-0 ml-[-1rem] translate-x-8 -> net +1rem (16px) approx?
                // Let's adjust offset to make it visible.
                // width 0. left 0. translate -50% (of button width).
                // if button w-6 (24px). center is at -12px.
                // we want center at +some px.
                // So we need positive margin or translate.
                // ml-4 (16px). center at -12+16 = 4px? Too close?
                // Previous: translate-x-8 (2rem=32px). left-0. ml--1rem (-16px). Net +16px relative to left 0?
                // Let's try simple styling: left-full -translate-x-1/2.
                // Collapsed offset: translate-x-4 (1rem).
                >
                    {isCollapsed ? <ChevronRight className="w-5 h-5 md:w-8 md:h-8" strokeWidth={3} /> : <ChevronLeft className="w-5 h-5 md:w-8 md:h-8" strokeWidth={3} />}
                </button>

                {/* Sidebar Content */}
                <aside
                    id="sidebar-nav"
                    className="w-64 h-[100dvh] md:h-full bg-white shadow-md flex flex-col fixed md:absolute border-r overflow-hidden"
                    // On mobile: fixed h-screen.
                    // On desktop: absolute h-full (filling wrapper). wrapper is relative.
                    // Wait, if wrapper is w-0, inside aside is w-64?
                    // Yes, we want content to be w-64 but masked by wrapper?
                    // No, previously aside itself was w-0 or w-64.
                    // Users want "clean collapse".
                    // If wrapper triggers w-0 to w-64, we need strict overflow hidden on Wrapper?
                    // If wrapper has overflow-hidden, the button (outside) is clipped!
                    // So wrapper CANNOT have overflow-hidden.
                    // So ASIDE must handle the width visual?
                    // But if wrapper handles events, ASIDE must match wrapper width?
                    // If Wrapper is 64, Aside is 64.
                    // If Wrapper is 0, Aside is 0?
                    // Yes. Wrapper controls width. Aside matches parent width.
                    // Aside: w-full.
                    // Wrapper: w-0 / w-64. overflow-visible (for button).
                    // BUT: if wrapper is w-0 and overflow-visible, the Aside content (w-full of 0 is 0) is hidden.
                    // BUT: Sidebar has fixed width content usually?
                    // If Aside becomes w-0, flex contents might squash?
                    // Previous implementation: `w-0 border-none` ... `overflow-hidden`.
                    // So Aside handled the hiding.
                    // Now Wrapper handles width. Aside should utilize that.
                    // Aside class: `w-full h-full overflow-hidden ...`
                    // If wrapper is w-0, Aside is w-0. Overflow hidden hides content. Perfect.
                    style={{ width: isCollapsed && window.innerWidth < 768 ? '0px' : (isCollapsed ? '0px' : '16rem') }}
                // Wait, Wrapper handles width via class. Aside w-full inherits it.
                // However, for mobile `fixed`, it doesn't care about wrapper parent if fixed?
                // If Sidebar is `fixed` on mobile, it breaks out of Wrapper.
                // Wrapper is `md:h-full`.
                // Mobile: Sidebar needs to be independently controlled or Wrapper needs to be fixed?
                // Let's make Wrapper fixed on mobile?
                // `fixed md:relative`.
                // Width classes apply to Wrapper.
                // Aside -> w-full h-full.
                // This unifies logic.
                // Button position works relative to Wrapper.
                >
                    {/* Header */}
                    <div className={`p-6 border-b flex flex-col items-center gap-2 ${isCollapsed ? 'hidden md:flex opacity-0' : 'opacity-100'}`}>
                        {/* Opacity fade for smoother transition? Or just keep hidden logic */}
                        <h1 className="font-bold text-blue-700 text-nowrap text-xl overflow-hidden">
                            Makala
                        </h1>
                    </div>

                    <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
                        <button
                            onClick={() => { setCurrentView('main'); if (window.innerWidth < 768) setIsCollapsed(true); }}
                            title="Panel Principal"
                            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-3 ${currentView === 'main' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'} ${isCollapsed ? 'justify-center px-0' : ''}`}
                        >
                            <LayoutGrid size={20} />
                            {!isCollapsed && <span>Salon</span>}
                        </button>

                        {/* ... (rest of nav items remain same, just ensure they hide icon if collapsed on mobile? No, icons should start hidden if we want "Solo ver la flecha") 
                        Wait, if sidebar width is 0, nav items are hidden by default overflow behavior? 
                        Let's verify strict hiding. 
                    */}

                        {/* Menu Management - Admin & Waiter */}
                        {['admin', 'waiter', 'cashier'].includes(user.role) && (
                            <button
                                onClick={() => { setCurrentView('menu'); if (window.innerWidth < 768) setIsCollapsed(true); }}
                                title="Menú"
                                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-3 ${currentView === 'menu' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'} ${isCollapsed ? 'justify-center px-0' : ''}`}
                            >
                                <Utensils size={20} />
                                {!isCollapsed && <span>Menú</span>}
                            </button>
                        )}

                        {/* Drink Promotions - Admin Only */}
                        {user.role === 'admin' && (
                            <button
                                onClick={() => { setCurrentView('drink_promos'); if (window.innerWidth < 768) setIsCollapsed(true); }}
                                title="Promociones 2x1"
                                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-3 ${currentView === 'drink_promos' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'} ${isCollapsed ? 'justify-center px-0' : ''}`}
                            >
                                <Wine size={20} />
                                {!isCollapsed && <span>Promociones 2x1</span>}
                            </button>
                        )}

                        {/* Inventory - Admin, Waiter, Cashier */}
                        {['admin', 'waiter', 'cashier'].includes(user.role) && (
                            <button
                                onClick={() => { setCurrentView('stock'); if (window.innerWidth < 768) setIsCollapsed(true); }}
                                title="Inventario"
                                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-3 ${currentView === 'stock' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'} ${isCollapsed ? 'justify-center px-0' : ''}`}
                            >
                                <Package size={20} />
                                {!isCollapsed && <span>Inventario</span>}
                            </button>
                        )}

                        {/* Reports - Admin & Cashier */}
                        {['admin', 'cashier', 'waiter'].includes(user.role) && (
                            <button
                                onClick={() => { setCurrentView('reports'); if (window.innerWidth < 768) setIsCollapsed(true); }}
                                title="Caja"
                                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-3 ${currentView === 'reports' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'} ${isCollapsed ? 'justify-center px-0' : ''}`}
                            >
                                <TrendingUp size={20} />
                                {!isCollapsed && <span>Caja</span>}
                            </button>
                        )}

                        {/* Audit - Admin Only */}
                        {user.role === 'admin' && (
                            <button
                                onClick={() => { setCurrentView('audit'); if (window.innerWidth < 768) setIsCollapsed(true); }}
                                title="Auditoría"
                                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-3 ${currentView === 'audit' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'} ${isCollapsed ? 'justify-center px-0' : ''}`}
                            >
                                <ClipboardList size={20} />
                                {!isCollapsed && <span>Auditoría</span>}
                            </button>
                        )}

                        {/* QrManagement option is now in the user popover menu */}
                    </nav>

                    {/* User Menu - Hide on Mobile if Collapsed */}
                    <div className={`p-4 border-t relative ${isCollapsed ? 'hidden md:block' : ''}`} ref={menuRef}>
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className={`w-full flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition cursor-pointer ${isCollapsed ? 'justify-center' : ''}`}
                        >
                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                                {user.displayName.charAt(0)}
                            </div>
                            {!isCollapsed && (
                                <div className="flex-1 text-left overflow-hidden">
                                    <div className="text-sm font-bold text-gray-800 truncate">{user.displayName}</div>
                                    <div className="text-xs text-gray-500 capitalize">{user.role}</div>
                                </div>
                            )}
                            {!isCollapsed && <ChevronUp size={16} className={`text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />}
                        </button>

                        {/* USER MENU DROPDOWN (POPOVER) */}
                        {showUserMenu && (
                            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-xl border overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                                {user.role === 'admin' && (
                                    <button
                                        onClick={() => { setShowUserManagement(true); setShowUserMenu(false); }}
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Users size={16} /> Gestionar Usuarios
                                    </button>
                                )}
                                {['admin', 'waiter', 'cashier'].includes(user.role) && (
                                    <button
                                        onClick={() => { setShowBillingConfig(true); setShowUserMenu(false); }}
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Settings size={16} /> Configuración del Sistema
                                    </button>
                                )}
                                {['admin', 'cashier', 'waiter'].includes(user.role) && (
                                    <button
                                        onClick={() => { setCurrentView('qr_management'); setShowUserMenu(false); }}
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Tv size={16} /> Pantalla Cliente
                                    </button>
                                )}
                                <button
                                    onClick={() => { setShowPasswordChange(true); setShowUserMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <Key size={16} /> Cambiar Contraseña
                                </button>
                                <div className="border-t my-1"></div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <LogOut size={16} /> Cerrar Sesión
                                </button>
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            {/* Main Content - Added overflow-x-hidden */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header Bar */}
                <header className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm shrink-0 z-20">
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                        title="Abrir menú"
                    >
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-gray-800 capitalize text-sm">
                        {currentView === 'main' ? 'Salón' :
                         currentView === 'menu' ? 'Menú' :
                         currentView === 'stock' ? 'Inventario' :
                         currentView === 'reports' ? 'Caja / Reportes' :
                         currentView === 'accounts' ? 'Historial Cuentas' :
                         currentView === 'drink_promos' ? 'Promociones 2x1' :
                         currentView === 'qr_management' ? 'Pantalla Cliente' :
                         currentView === 'audit' ? 'Auditoría' : 'Makala'}
                    </span>
                    <div className="relative" ref={mobileMenuRef}>
                        <button
                            onClick={() => setShowMobileUserMenu(!showMobileUserMenu)}
                            className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs select-none hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            {user?.displayName?.charAt(0) || 'U'}
                        </button>
                        {showMobileUserMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                {user?.role === 'admin' && (
                                    <button
                                        onClick={() => { setShowUserManagement(true); setShowMobileUserMenu(false); }}
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Users size={16} /> Gestionar Usuarios
                                    </button>
                                )}
                                {['admin', 'waiter', 'cashier'].includes(user?.role) && (
                                    <button
                                        onClick={() => { setShowBillingConfig(true); setShowMobileUserMenu(false); }}
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Settings size={16} /> Configuración del Sistema
                                    </button>
                                )}
                                {['admin', 'cashier', 'waiter'].includes(user?.role) && (
                                    <button
                                        onClick={() => { setCurrentView('qr_management'); setShowMobileUserMenu(false); }}
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Tv size={16} /> Pantalla Cliente
                                    </button>
                                )}
                                <button
                                    onClick={() => { setShowPasswordChange(true); setShowMobileUserMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <Key size={16} /> Cambiar Contraseña
                                </button>
                                <div className="border-t my-1"></div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <LogOut size={16} /> Cerrar Sesión
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto relative bg-gray-50 overflow-x-hidden overscroll-contain flex flex-col">
                    {/* Global Onboarding Banner */}
                    {user?.role === 'admin' && tenantInfo && !tenantInfo.onboardingCompleted && currentView !== 'main' && (
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 sm:px-6 sm:py-3 flex items-center justify-between shadow-md z-10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                                    <Utensils size={18} className="text-white" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold">¡Estás configurando tu restaurante!</h4>
                                    <p className="text-xs text-blue-100 hidden sm:block">Aún te faltan pasos para poder abrir tu primer turno.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setCurrentView('main')}
                                className="text-xs bg-white text-blue-700 px-4 py-2 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-sm active:scale-95 flex items-center shrink-0"
                            >
                                Volver a la Guía
                            </button>
                        </div>
                    )}
                    <div className="flex-1 relative">
                        {renderContent()}
                    </div>
                </main>
            </div>

            {/* MODALS */}
            {showUserManagement && <UserManagementModal onClose={() => setShowUserManagement(false)} />}
            {showPasswordChange && <PasswordChangeModal targetUser={user} onClose={() => setShowPasswordChange(false)} />}
            {showBillingConfig && <BillingConfigModal onClose={() => setShowBillingConfig(false)} />}
        </div >
    );
}
