import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdmin } from '../hooks/useSuperAdmin';

export default function SuperAdminLogin() {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const { login, loading, error } = useSuperAdmin();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(apiKey.trim());
        if (result.success) {
            navigate('/');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            padding: '20px'
        }}>
            <div style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '24px',
                padding: '48px 40px',
                width: '100%',
                maxWidth: '420px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
            }}>
                {/* Logo / Icon */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        fontSize: '28px',
                        boxShadow: '0 8px 25px rgba(102,126,234,0.4)'
                    }}>
                        ⚙️
                    </div>
                    <h1 style={{
                        color: '#fff',
                        fontSize: '24px',
                        fontWeight: '700',
                        margin: '0 0 8px',
                        letterSpacing: '-0.5px'
                    }}>
                        Super Admin
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
                        MakSuites — Panel de Control
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* API Key field */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '13px',
                            fontWeight: '500',
                            marginBottom: '8px',
                            letterSpacing: '0.5px'
                        }}>
                            CLAVE DE ACCESO
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="superadmin-apikey"
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Ingresa tu API Key"
                                autoComplete="off"
                                style={{
                                    width: '100%',
                                    padding: '14px 44px 14px 16px',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: error
                                        ? '1px solid rgba(239,68,68,0.6)'
                                        : '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '12px',
                                    color: '#fff',
                                    fontSize: '15px',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    transition: 'border-color 0.2s',
                                    fontFamily: 'monospace'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'rgba(102,126,234,0.7)'}
                                onBlur={(e) => e.target.style.borderColor = error
                                    ? 'rgba(239,68,68,0.6)'
                                    : 'rgba(255,255,255,0.15)'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'rgba(255,255,255,0.4)',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    padding: '4px'
                                }}
                            >
                                {showKey ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.15)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '10px',
                            padding: '12px 16px',
                            color: '#fca5a5',
                            fontSize: '13px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        id="superadmin-submit"
                        type="submit"
                        disabled={loading || !apiKey.trim()}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: loading || !apiKey.trim()
                                ? 'rgba(102,126,234,0.4)'
                                : 'linear-gradient(135deg, #667eea, #764ba2)',
                            border: 'none',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: loading || !apiKey.trim() ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            letterSpacing: '0.3px'
                        }}
                        onMouseEnter={(e) => {
                            if (!loading && apiKey.trim()) {
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 8px 25px rgba(102,126,234,0.4)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                        }}
                    >
                        {loading ? '⏳ Verificando...' : '🔐 Ingresar al Panel'}
                    </button>
                </form>

                <p style={{
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.2)',
                    fontSize: '11px',
                    marginTop: '24px',
                    marginBottom: 0
                }}>
                    Acceso restringido — Solo administradores de MakSuites
                </p>
            </div>
        </div>
    );
}
