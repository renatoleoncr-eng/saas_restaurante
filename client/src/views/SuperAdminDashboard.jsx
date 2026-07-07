import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdmin } from '../hooks/useSuperAdmin';

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function PlanBadge({ plan }) {
    const styles = {
        demo: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)', label: 'DEMO' },
        pago: { bg: 'rgba(52,211,153,0.15)', color: '#34d399', border: 'rgba(52,211,153,0.3)', label: 'PAGO' }
    };
    const s = styles[plan] || styles.demo;
    return (
        <span style={{
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
            borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: '700',
            letterSpacing: '0.5px'
        }}>
            {s.label}
        </span>
    );
}

function StatusBadge({ status }) {
    const isActive = status === 'active';
    return (
        <span style={{
            background: isActive ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)',
            color: isActive ? '#34d399' : '#f87171',
            border: `1px solid ${isActive ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: '700',
            letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: '4px'
        }}>
            <span style={{ fontSize: '7px' }}>●</span>
            {isActive ? 'ACTIVO' : 'SUSPENDIDO'}
        </span>
    );
}

// ── Modal base ─────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)'
        }} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '480px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 }}>{title}</h3>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                        width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px'
                    }}>✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}

function ModalButton({ onClick, disabled, color = '#667eea', children }) {
    return (
        <button onClick={onClick} disabled={disabled} style={{
            padding: '10px 20px', background: color, border: 'none', borderRadius: '10px',
            color: '#fff', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1, fontSize: '14px', transition: 'opacity 0.2s'
        }}>{children}</button>
    );
}

function inputStyle(error) {
    return {
        width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.08)',
        border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none',
        boxSizing: 'border-box', fontFamily: 'inherit'
    };
}

function labelStyle() {
    return { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px', fontWeight: '600' };
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
    const navigate = useNavigate();
    const {
        isAuthenticated, logout,
        fetchTenants, fetchStats,
        updateStatus, updatePlan, updateStorage, updateNotes,
        resetAdminPassword, deleteTenant
    } = useSuperAdmin();

    const [tenants, setTenants] = useState([]);
    const [stats, setStats] = useState(null);
    const [loadingData, setLoadingData] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', msg }
    const [search, setSearch] = useState('');

    // Modals state
    const [modal, setModal] = useState(null); // { type, tenant }
    const [modalValues, setModalValues] = useState({});

    // Redirect if not authenticated
    useEffect(() => {
        if (!isAuthenticated) navigate('/login');
    }, [isAuthenticated, navigate]);

    const loadData = useCallback(async () => {
        setLoadingData(true);
        try {
            const [tenantsData, statsData] = await Promise.all([fetchTenants(), fetchStats()]);
            setTenants(tenantsData.tenants || []);
            setStats(statsData?.platform || null);
        } catch (err) {
            showFeedback('error', 'Error cargando datos: ' + err.message);
        } finally {
            setLoadingData(false);
        }
    }, [fetchTenants, fetchStats]);

    useEffect(() => { loadData(); }, [loadData]);

    function showFeedback(type, msg) {
        setFeedback({ type, msg });
        setTimeout(() => setFeedback(null), 4000);
    }

    function openModal(type, tenant) {
        setModal({ type, tenant });
        if (type === 'notes') setModalValues({ notes: tenant.internalNotes || '' });
        if (type === 'storage') setModalValues({ mb: tenant.storageLimitMb || 50 });
        if (type === 'resetPass') setModalValues({ pass: '' });
    }

    async function handleAction(action) {
        setActionLoading(true);
        try {
            let result;
            const { tenant } = modal;
            switch (action) {
                case 'toggleStatus':
                    result = await updateStatus(tenant.id, tenant.status === 'active' ? 'suspended' : 'active');
                    break;
                case 'setPlan':
                    result = await updatePlan(tenant.id, modalValues.plan);
                    break;
                case 'saveNotes':
                    result = await updateNotes(tenant.id, modalValues.notes);
                    break;
                case 'saveStorage':
                    result = await updateStorage(tenant.id, parseInt(modalValues.mb));
                    break;
                case 'resetPass':
                    result = await resetAdminPassword(tenant.id, modalValues.pass);
                    break;
                case 'delete':
                    result = await deleteTenant(tenant.id);
                    break;
                default: break;
            }
            showFeedback('success', result?.message || 'Acción completada');
            setModal(null);
            await loadData();
        } catch (err) {
            showFeedback('error', err.message);
        } finally {
            setActionLoading(false);
        }
    }

    // Filter tenants by search
    const filtered = tenants.filter(t =>
        t.slug.includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.ownerEmail.toLowerCase().includes(search.toLowerCase())
    );

    const css = {
        page: {
            minHeight: '100vh',
            background: '#0d0d1a',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            color: '#e2e8f0'
        },
        header: {
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '64px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backdropFilter: 'blur(10px)'
        },
        main: { padding: '32px', maxWidth: '1400px', margin: '0 auto' }
    };

    return (
        <div style={css.page}>
            {/* Header */}
            <header style={css.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '36px', height: '36px',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        borderRadius: '10px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '18px'
                    }}>⚙️</div>
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '16px', color: '#fff' }}>MakSuites Admin</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Panel de Control SaaS</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        id="admin-refresh"
                        onClick={loadData}
                        style={{
                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff', padding: '8px 14px', borderRadius: '10px',
                            cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                        }}
                    >
                        🔄 Actualizar
                    </button>
                    <button
                        id="admin-logout"
                        onClick={() => { logout(); navigate('/login'); }}
                        style={{
                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171', padding: '8px 14px', borderRadius: '10px',
                            cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                        }}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </header>

            <main style={css.main}>
                {/* Feedback toast */}
                {feedback && (
                    <div style={{
                        position: 'fixed', top: '80px', right: '24px', zIndex: 2000,
                        background: feedback.type === 'success' ? 'rgba(52,211,153,0.95)' : 'rgba(239,68,68,0.95)',
                        color: '#fff', padding: '12px 20px', borderRadius: '12px',
                        fontSize: '14px', fontWeight: '500', boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                        maxWidth: '360px', animation: 'slideIn 0.3s ease'
                    }}>
                        {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.msg}
                    </div>
                )}

                {/* Stats cards */}
                {stats && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '16px', marginBottom: '32px'
                    }}>
                        {[
                            { label: 'Total Restaurantes', value: stats.totalTenants, icon: '🍽️', color: '#667eea' },
                            { label: 'Activos', value: stats.activeTenants, icon: '✅', color: '#34d399' },
                            { label: 'Plan Demo', value: stats.demoPlan, icon: '🆓', color: '#fbbf24' },
                            { label: 'Plan Pago', value: stats.pagoPlan, icon: '💎', color: '#a78bfa' },
                            { label: 'Total Órdenes', value: stats.totalOrders.toLocaleString(), icon: '📋', color: '#38bdf8' },
                            { label: 'Total Usuarios', value: stats.totalUsers, icon: '👥', color: '#fb923c' },
                        ].map((card) => (
                            <div key={card.label} style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '16px', padding: '20px',
                                borderTop: `3px solid ${card.color}`
                            }}>
                                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{card.icon}</div>
                                <div style={{ fontSize: '26px', fontWeight: '800', color: card.color }}>{card.value}</div>
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{card.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Search + Table */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '20px', overflow: 'hidden'
                }}>
                    {/* Table header */}
                    <div style={{
                        padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                        flexWrap: 'wrap'
                    }}>
                        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 }}>
                            Restaurantes ({filtered.length})
                        </h2>
                        <input
                            placeholder="Buscar por nombre, slug o email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                ...inputStyle(false),
                                width: 'auto', minWidth: '280px',
                                padding: '8px 14px', fontSize: '13px'
                            }}
                        />
                    </div>

                    {/* Table */}
                    {loadingData ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                            ⏳ Cargando restaurantes...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                            No hay restaurantes
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        {['Restaurante', 'Subdominio', 'Email', 'Plan', 'Estado', 'Storage', 'Órdenes', 'Usuarios', 'Desde', 'Acciones'].map(h => (
                                            <th key={h} style={{
                                                padding: '12px 16px', textAlign: 'left',
                                                fontSize: '11px', fontWeight: '700',
                                                color: 'rgba(255,255,255,0.4)',
                                                letterSpacing: '0.5px', whiteSpace: 'nowrap'
                                            }}>{h.toUpperCase()}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((tenant, idx) => (
                                        <tr key={tenant.id} style={{
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                            transition: 'background 0.15s'
                                        }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(102,126,234,0.08)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                                        >
                                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                                <div style={{ fontWeight: '600', color: '#fff', fontSize: '14px' }}>
                                                    {tenant.name}
                                                </div>
                                                {tenant.internalNotes && (
                                                    <div style={{ fontSize: '11px', color: 'rgba(251,191,36,0.7)', marginTop: '2px' }}>
                                                        📝 {tenant.internalNotes.substring(0, 40)}{tenant.internalNotes.length > 40 ? '...' : ''}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                                <a
                                                    href={`https://${tenant.slug}.maksuites.com.pe`}
                                                    target="_blank" rel="noreferrer"
                                                    style={{ color: '#818cf8', fontSize: '13px', textDecoration: 'none' }}
                                                >
                                                    {tenant.slug} ↗
                                                </a>
                                            </td>
                                            <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                {tenant.ownerEmail}
                                            </td>
                                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                                <PlanBadge plan={tenant.plan} />
                                            </td>
                                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                                <StatusBadge status={tenant.status} />
                                            </td>
                                            <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                {tenant.storageLimitMb} MB
                                            </td>
                                            <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', textAlign: 'center' }}>
                                                {tenant.stats?.orders?.toLocaleString() || 0}
                                            </td>
                                            <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', textAlign: 'center' }}>
                                                {tenant.stats?.users || 0}
                                            </td>
                                            <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                {formatDate(tenant.createdAt)}
                                            </td>
                                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    {/* Toggle status */}
                                                    <button
                                                        title={tenant.status === 'active' ? 'Suspender' : 'Activar'}
                                                        onClick={() => openModal('confirmStatus', tenant)}
                                                        style={{
                                                            background: tenant.status === 'active'
                                                                ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.15)',
                                                            border: tenant.status === 'active'
                                                                ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(52,211,153,0.3)',
                                                            color: tenant.status === 'active' ? '#f87171' : '#34d399',
                                                            padding: '6px 10px', borderRadius: '8px',
                                                            cursor: 'pointer', fontSize: '14px'
                                                        }}
                                                    >
                                                        {tenant.status === 'active' ? '⏸' : '▶'}
                                                    </button>
                                                    {/* Change plan */}
                                                    <button
                                                        title="Cambiar Plan"
                                                        onClick={() => openModal('changePlan', tenant)}
                                                        style={{
                                                            background: 'rgba(167,139,250,0.15)',
                                                            border: '1px solid rgba(167,139,250,0.3)',
                                                            color: '#a78bfa', padding: '6px 10px',
                                                            borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
                                                        }}
                                                    >
                                                        💎
                                                    </button>
                                                    {/* Storage */}
                                                    <button
                                                        title="Límite de almacenamiento"
                                                        onClick={() => openModal('storage', tenant)}
                                                        style={{
                                                            background: 'rgba(56,189,248,0.15)',
                                                            border: '1px solid rgba(56,189,248,0.3)',
                                                            color: '#38bdf8', padding: '6px 10px',
                                                            borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
                                                        }}
                                                    >
                                                        💾
                                                    </button>
                                                    {/* Notes */}
                                                    <button
                                                        title="Notas internas"
                                                        onClick={() => openModal('notes', tenant)}
                                                        style={{
                                                            background: 'rgba(251,191,36,0.15)',
                                                            border: '1px solid rgba(251,191,36,0.3)',
                                                            color: '#fbbf24', padding: '6px 10px',
                                                            borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
                                                        }}
                                                    >
                                                        📝
                                                    </button>
                                                    {/* Reset password */}
                                                    <button
                                                        title="Resetear contraseña admin"
                                                        onClick={() => openModal('resetPass', tenant)}
                                                        style={{
                                                            background: 'rgba(251,146,60,0.15)',
                                                            border: '1px solid rgba(251,146,60,0.3)',
                                                            color: '#fb923c', padding: '6px 10px',
                                                            borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
                                                        }}
                                                    >
                                                        🔑
                                                    </button>
                                                    {/* Delete */}
                                                    {tenant.slug !== 'makala' && (
                                                        <button
                                                            title="Eliminar restaurante"
                                                            onClick={() => openModal('delete', tenant)}
                                                            style={{
                                                                background: 'rgba(239,68,68,0.15)',
                                                                border: '1px solid rgba(239,68,68,0.3)',
                                                                color: '#f87171', padding: '6px 10px',
                                                                borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
                                                            }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* ── MODALS ──────────────────────────────────────────────────── */}

            {/* Confirm Status Change */}
            {modal?.type === 'confirmStatus' && (
                <Modal title="Cambiar Estado" onClose={() => setModal(null)}>
                    <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px' }}>
                        ¿{modal.tenant.status === 'active' ? 'Suspender' : 'Activar'} el restaurante{' '}
                        <strong style={{ color: '#fff' }}>{modal.tenant.name}</strong>?
                        {modal.tenant.status === 'active' && (
                            <span style={{ display: 'block', color: '#f87171', fontSize: '13px', marginTop: '8px' }}>
                                ⚠️ Los usuarios no podrán ingresar mientras esté suspendido.
                            </span>
                        )}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setModal(null)} style={{
                            padding: '10px 20px', background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                            color: '#fff', cursor: 'pointer', fontSize: '14px'
                        }}>Cancelar</button>
                        <ModalButton
                            onClick={() => handleAction('toggleStatus')}
                            disabled={actionLoading}
                            color={modal.tenant.status === 'active' ? '#ef4444' : '#34d399'}
                        >
                            {actionLoading ? '⏳' : (modal.tenant.status === 'active' ? '⏸ Suspender' : '▶ Activar')}
                        </ModalButton>
                    </div>
                </Modal>
            )}

            {/* Change Plan */}
            {modal?.type === 'changePlan' && (
                <Modal title="Cambiar Plan" onClose={() => setModal(null)}>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '16px', fontSize: '14px' }}>
                        Plan actual: <PlanBadge plan={modal.tenant.plan} />
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginTop: '6px' }}>
                            El límite de almacenamiento se ajustará automáticamente (Demo: 50 MB, Pago: 500 MB).
                        </span>
                    </p>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                        {['demo', 'pago'].map(p => (
                            <button key={p} onClick={() => setModalValues({ plan: p })} style={{
                                flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer',
                                fontSize: '14px', fontWeight: '600', border: '2px solid',
                                borderColor: modalValues.plan === p ? '#667eea' : 'rgba(255,255,255,0.1)',
                                background: modalValues.plan === p ? 'rgba(102,126,234,0.2)' : 'rgba(255,255,255,0.04)',
                                color: '#fff', transition: 'all 0.2s'
                            }}>
                                {p === 'demo' ? '🆓 Demo' : '💎 Pago'}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setModal(null)} style={{
                            padding: '10px 20px', background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                            color: '#fff', cursor: 'pointer', fontSize: '14px'
                        }}>Cancelar</button>
                        <ModalButton
                            onClick={() => handleAction('setPlan')}
                            disabled={actionLoading || !modalValues.plan || modalValues.plan === modal.tenant.plan}
                        >
                            {actionLoading ? '⏳' : '💾 Guardar Plan'}
                        </ModalButton>
                    </div>
                </Modal>
            )}

            {/* Storage limit */}
            {modal?.type === 'storage' && (
                <Modal title="Límite de Almacenamiento" onClose={() => setModal(null)}>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '16px', fontSize: '14px' }}>
                        Límite actual: <strong style={{ color: '#38bdf8' }}>{modal.tenant.storageLimitMb} MB</strong>
                        <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px' }}>
                            Controla el espacio máximo para subida de archivos (imágenes, logos, etc.)
                        </span>
                    </p>
                    <label style={labelStyle()}>NUEVO LÍMITE (MB)</label>
                    <input
                        type="number" min="1" max="10000"
                        value={modalValues.mb}
                        onChange={(e) => setModalValues({ mb: e.target.value })}
                        style={{ ...inputStyle(false), marginBottom: '24px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                        {[50, 100, 200, 500, 1000].map(v => (
                            <button key={v} onClick={() => setModalValues({ mb: v })} style={{
                                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                background: modalValues.mb == v ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${modalValues.mb == v ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.1)'}`,
                                color: modalValues.mb == v ? '#38bdf8' : 'rgba(255,255,255,0.6)',
                                fontSize: '13px'
                            }}>{v} MB</button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setModal(null)} style={{
                            padding: '10px 20px', background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                            color: '#fff', cursor: 'pointer', fontSize: '14px'
                        }}>Cancelar</button>
                        <ModalButton onClick={() => handleAction('saveStorage')} disabled={actionLoading} color="#38bdf8">
                            {actionLoading ? '⏳' : '💾 Guardar'}
                        </ModalButton>
                    </div>
                </Modal>
            )}

            {/* Internal Notes */}
            {modal?.type === 'notes' && (
                <Modal title="Notas Internas" onClose={() => setModal(null)}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '12px' }}>
                        Visible solo para ti (super admin). El restaurante no las verá.
                    </p>
                    <label style={labelStyle()}>NOTAS</label>
                    <textarea
                        value={modalValues.notes}
                        onChange={(e) => setModalValues({ notes: e.target.value })}
                        rows={5}
                        placeholder="Ejemplo: Cliente VIP, pago pendiente, contacto: +51..."
                        style={{
                            ...inputStyle(false),
                            resize: 'vertical', minHeight: '100px',
                            marginBottom: '24px'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setModal(null)} style={{
                            padding: '10px 20px', background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                            color: '#fff', cursor: 'pointer', fontSize: '14px'
                        }}>Cancelar</button>
                        <ModalButton onClick={() => handleAction('saveNotes')} disabled={actionLoading} color="#fbbf24">
                            {actionLoading ? '⏳' : '📝 Guardar Notas'}
                        </ModalButton>
                    </div>
                </Modal>
            )}

            {/* Reset Admin Password */}
            {modal?.type === 'resetPass' && (
                <Modal title="Resetear Contraseña Admin" onClose={() => setModal(null)}>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '16px', fontSize: '14px' }}>
                        Se cambiará la contraseña del usuario <strong style={{ color: '#fff' }}>admin</strong> de{' '}
                        <strong style={{ color: '#fb923c' }}>{modal.tenant.name}</strong>.
                    </p>
                    <label style={labelStyle()}>NUEVA CONTRASEÑA (mínimo 6 caracteres)</label>
                    <input
                        type="text"
                        value={modalValues.pass}
                        onChange={(e) => setModalValues({ pass: e.target.value })}
                        placeholder="Nueva contraseña..."
                        style={{ ...inputStyle(false), marginBottom: '24px', fontFamily: 'monospace' }}
                    />
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setModal(null)} style={{
                            padding: '10px 20px', background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                            color: '#fff', cursor: 'pointer', fontSize: '14px'
                        }}>Cancelar</button>
                        <ModalButton
                            onClick={() => handleAction('resetPass')}
                            disabled={actionLoading || !modalValues.pass || modalValues.pass.length < 6}
                            color="#fb923c"
                        >
                            {actionLoading ? '⏳' : '🔑 Resetear Contraseña'}
                        </ModalButton>
                    </div>
                </Modal>
            )}

            {/* Delete Tenant */}
            {modal?.type === 'delete' && (
                <Modal title="⚠️ Eliminar Restaurante" onClose={() => setModal(null)}>
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '12px', padding: '16px', marginBottom: '20px'
                    }}>
                        <p style={{ color: '#fca5a5', fontSize: '14px', margin: 0 }}>
                            Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente:
                        </p>
                        <ul style={{ color: '#fca5a5', fontSize: '13px', marginTop: '8px', paddingLeft: '20px' }}>
                            <li>Todos los datos del restaurante ({modal.tenant.stats?.orders || 0} órdenes)</li>
                            <li>Todos los usuarios ({modal.tenant.stats?.users || 0})</li>
                            <li>Productos, menús, catálogos completos</li>
                            <li>Historial de ventas y movimientos</li>
                        </ul>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px', fontSize: '14px' }}>
                        ¿Confirmas la eliminación de <strong style={{ color: '#f87171' }}>{modal.tenant.name}</strong>{' '}
                        (<code style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            {modal.tenant.slug}.maksuites.com.pe
                        </code>)?
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setModal(null)} style={{
                            padding: '10px 20px', background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                            color: '#fff', cursor: 'pointer', fontSize: '14px'
                        }}>Cancelar</button>
                        <ModalButton
                            onClick={() => handleAction('delete')}
                            disabled={actionLoading}
                            color="#ef4444"
                        >
                            {actionLoading ? '⏳ Eliminando...' : '🗑️ Eliminar Todo'}
                        </ModalButton>
                    </div>
                </Modal>
            )}
        </div>
    );
}
