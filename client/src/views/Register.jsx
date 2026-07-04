import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChefHat, ArrowLeft, Check, X, Loader2, ExternalLink } from 'lucide-react';

export default function Register() {
    const navigate = useNavigate();

    const [step, setStep] = useState(1); // 1: restaurant info, 2: account info, 3: success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form data
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [ownerName, setOwnerName] = useState('');

    // Slug validation
    const [slugStatus, setSlugStatus] = useState(null); // null, 'checking', 'available', 'taken', 'invalid'
    const [slugMessage, setSlugMessage] = useState('');

    // Success data
    const [successData, setSuccessData] = useState(null);

    // Auto-generate slug from name
    useEffect(() => {
        if (name && !slug) {
            const auto = name
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .substring(0, 30)
                .replace(/^-|-$/g, '');
            setSlug(auto);
        }
    }, [name]);

    // Check slug availability (debounced)
    const checkSlug = useCallback(async (slugValue) => {
        if (!slugValue || slugValue.length < 3) {
            setSlugStatus('invalid');
            setSlugMessage('Mínimo 3 caracteres');
            return;
        }

        setSlugStatus('checking');
        try {
            const res = await axios.get(`/api/tenants/check-slug/${slugValue}`);
            if (res.data.available) {
                setSlugStatus('available');
                setSlugMessage('Disponible');
            } else {
                setSlugStatus('taken');
                setSlugMessage(res.data.reason || 'No disponible');
            }
        } catch (err) {
            setSlugStatus('invalid');
            setSlugMessage('Error verificando');
        }
    }, []);

    useEffect(() => {
        if (!slug) {
            setSlugStatus(null);
            return;
        }
        const timer = setTimeout(() => checkSlug(slug), 500);
        return () => clearTimeout(timer);
    }, [slug, checkSlug]);

    const handleSlugChange = (e) => {
        const val = e.target.value
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 30);
        setSlug(val);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await axios.post('/api/tenants/register', {
                name: name.trim(),
                slug,
                email: email.trim(),
                password,
                ownerName: ownerName.trim()
            });

            setSuccessData(res.data);
            setStep(3);
        } catch (err) {
            setError(err.response?.data?.error || 'Error creando el restaurante. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const canProceed = step === 1
        ? (name.trim().length >= 2 && slug.length >= 3 && slugStatus === 'available')
        : (email.trim().includes('@') && password.length >= 6 && ownerName.trim().length >= 2);

    const slugStatusIcon = {
        checking: <Loader2 size={16} className="animate-spin text-blue-400" />,
        available: <Check size={16} className="text-green-400" />,
        taken: <X size={16} className="text-red-400" />,
        invalid: <X size={16} className="text-amber-400" />,
    };

    const slugStatusColor = {
        checking: 'text-blue-400',
        available: 'text-green-400',
        taken: 'text-red-400',
        invalid: 'text-amber-400',
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-lg">
                {/* Back button */}
                {step < 3 && (
                    <button
                        onClick={() => step === 1 ? navigate('/') : setStep(1)}
                        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors text-sm"
                    >
                        <ArrowLeft size={16} />
                        {step === 1 ? 'Volver al inicio' : 'Paso anterior'}
                    </button>
                )}

                {/* Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
                    {/* Step indicator */}
                    {step < 3 && (
                        <div className="flex items-center gap-3 mb-8">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/40'}`}>1</div>
                            <div className={`flex-1 h-0.5 rounded ${step >= 2 ? 'bg-blue-600' : 'bg-white/10'}`}></div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/40'}`}>2</div>
                        </div>
                    )}

                    {/* STEP 1: Restaurant Info */}
                    {step === 1 && (
                        <>
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                    <ChefHat size={24} className="text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Crea tu Restaurante</h2>
                                <p className="text-slate-400 text-sm mt-1">Paso 1: Información del negocio</p>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-blue-200/80 mb-2">
                                        Nombre del Restaurante
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        placeholder="Ej: Cevichería Don Pedro"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-blue-200/80 mb-2">
                                        Tu Subdominio
                                    </label>
                                    <div className="flex items-stretch">
                                        <input
                                            type="text"
                                            value={slug}
                                            onChange={handleSlugChange}
                                            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-l-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            placeholder="tu-restaurante"
                                        />
                                        <div className="px-4 py-3 bg-white/[0.03] border border-l-0 border-white/10 rounded-r-xl text-slate-500 text-sm flex items-center whitespace-nowrap">
                                            .maksuites.com.pe
                                        </div>
                                    </div>
                                    {slugStatus && (
                                        <div className={`flex items-center gap-1.5 mt-2 text-xs ${slugStatusColor[slugStatus]}`}>
                                            {slugStatusIcon[slugStatus]}
                                            {slugMessage}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setStep(2)}
                                    disabled={!canProceed}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Continuar
                                </button>
                            </div>
                        </>
                    )}

                    {/* STEP 2: Account Info */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit}>
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-white">Tu Cuenta</h2>
                                <p className="text-slate-400 text-sm mt-1">Paso 2: Datos del administrador</p>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-blue-200/80 mb-2">
                                        Tu Nombre
                                    </label>
                                    <input
                                        type="text"
                                        value={ownerName}
                                        onChange={(e) => setOwnerName(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        placeholder="Tu nombre completo"
                                        autoFocus
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-blue-200/80 mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        placeholder="tu@email.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-blue-200/80 mb-2">
                                        Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        placeholder="Mínimo 6 caracteres"
                                        required
                                        minLength={6}
                                    />
                                    {password && password.length < 6 && (
                                        <p className="text-amber-400 text-xs mt-1">Mínimo 6 caracteres</p>
                                    )}
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                                        <p className="text-red-300 text-sm text-center">{error}</p>
                                    </div>
                                )}

                                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                                    <p className="text-slate-400 text-xs">
                                        Al crear tu restaurante, tu usuario administrador será <strong className="text-white">admin</strong> con la contraseña que definas aquí.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!canProceed || loading}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 size={18} className="animate-spin" />
                                            Creando restaurante...
                                        </span>
                                    ) : 'Crear Restaurante'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* STEP 3: Success */}
                    {step === 3 && successData && (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-green-500/25">
                                <Check size={32} className="text-white" />
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-2">
                                ¡Restaurante Creado!
                            </h2>
                            <p className="text-slate-400 mb-8">
                                Tu restaurante <strong className="text-white">{successData.tenant.name}</strong> está listo.
                            </p>

                            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-6 text-left space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-slate-400 text-sm">URL</span>
                                    <span className="text-blue-400 text-sm font-mono">{successData.tenant.slug}.maksuites.com.pe</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 text-sm">Usuario</span>
                                    <span className="text-white text-sm font-mono">admin</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 text-sm">Plan</span>
                                    <span className="text-amber-300 text-sm">Demo</span>
                                </div>
                            </div>

                            <a
                                href={successData.tenant.url}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                Ir a mi Restaurante
                                <ExternalLink size={16} />
                            </a>

                            <p className="text-slate-600 text-xs mt-4">
                                También puedes acceder desde {successData.tenant.slug}.maksuites.com.pe
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
