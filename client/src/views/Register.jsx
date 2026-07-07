import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChefHat, ArrowLeft, Check, X, Loader2, ExternalLink, User, Phone } from 'lucide-react';

// Username validation: lowercase letters, numbers, underscores, 3-20 chars
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export default function Register() {
    const navigate = useNavigate();

    const [step, setStep] = useState(1); // 1: restaurant info, 2: account info, 3: success
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const loadingMessages = [
        "Preparando tu espacio...",
        "Creando base de datos...",
        "Configurando catálogos...",
        "Creando administrador..."
    ];
    const [error, setError] = useState('');
    const [isSlugEdited, setIsSlugEdited] = useState(false);

    // Form data — Step 1
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');

    // Form data — Step 2
    const [ownerName, setOwnerName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [dataConsent, setDataConsent] = useState(false);

    // Username validation state
    const [usernameError, setUsernameError] = useState('');

    // Slug validation
    const [slugStatus, setSlugStatus] = useState(null); // null, 'checking', 'available', 'taken', 'invalid'
    const [slugMessage, setSlugMessage] = useState('');

    // Success data
    const [successData, setSuccessData] = useState(null);

    // Auto-generate slug from name
    useEffect(() => {
        if (name && !isSlugEdited) {
            const auto = name
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .substring(0, 30)
                .replace(/^-|-$/g, '');
            setSlug(auto);
        } else if (!name && !isSlugEdited) {
            setSlug('');
        }
    }, [name, isSlugEdited]);

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
        setIsSlugEdited(true);
        const val = e.target.value
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 30);
        setSlug(val);
    };

    const handleUsernameChange = (e) => {
        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').substring(0, 20);
        setUsername(val);
        if (val.length === 0) {
            setUsernameError('');
        } else if (val.length < 3) {
            setUsernameError('Mínimo 3 caracteres');
        } else if (!USERNAME_REGEX.test(val)) {
            setUsernameError('Solo letras minúsculas, números y guión bajo');
        } else {
            setUsernameError('');
        }
    };

    const handlePhoneChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').substring(0, 9);
        setPhone(val);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        setLoadingStep(0);

        // Progressively update loading message
        const interval = setInterval(() => {
            setLoadingStep(prev => prev < loadingMessages.length - 1 ? prev + 1 : prev);
        }, 800);

        try {
            // Wait for both the API call AND a minimum 3.2s delay for the progressive UX
            const [res] = await Promise.all([
                axios.post('/api/tenants/register', {
                    name: name.trim(),
                    slug,
                    email: email.trim(),
                    password,
                    ownerName: ownerName.trim(),
                    username: username.trim(),
                    phone: phone.trim()
                }),
                new Promise(resolve => setTimeout(resolve, 3200))
            ]);

            clearInterval(interval);
            setSuccessData(res.data);
            setStep(3);
        } catch (err) {
            clearInterval(interval);
            setError(err.response?.data?.error || 'Error creando el restaurante. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const canProceed = step === 1
        ? (name.trim().length >= 2 && slug.length >= 3 && slugStatus === 'available')
        : (
            ownerName.trim().length >= 2 &&
            USERNAME_REGEX.test(username) &&
            usernameError === '' &&
            password.length >= 6 &&
            email.trim().includes('@') &&
            phone.replace(/\D/g, '').length >= 9 &&
            dataConsent
        );

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
        <div className="h-full w-full overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
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

                            {/* Section: Tu Perfil */}
                            <div className="mb-5">
                                <p className="text-xs font-semibold text-blue-400/70 uppercase tracking-wider mb-3">Tu Perfil</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-blue-200/80 mb-2">
                                            Nombre Completo
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
                                            Usuario
                                        </label>
                                        <div className="relative">
                                            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={handleUsernameChange}
                                                className={`w-full pl-10 pr-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 transition-all ${
                                                    usernameError ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20' :
                                                    (username.length >= 3 && !usernameError) ? 'border-green-500/40 focus:border-green-500/50 focus:ring-green-500/20' :
                                                    'border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20'
                                                }`}
                                                placeholder="ej: juan_garcia"
                                                required
                                            />
                                            {username.length >= 3 && !usernameError && (
                                                <Check size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400" />
                                            )}
                                        </div>
                                        {usernameError ? (
                                            <p className="text-red-400 text-xs mt-1.5">{usernameError}</p>
                                        ) : username.length > 0 && (
                                            <p className="text-slate-500 text-xs mt-1.5">Solo letras minúsculas, números y guión bajo</p>
                                        )}
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
                                            <p className="text-amber-400 text-xs mt-1.5">Mínimo 6 caracteres</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-white/5 mb-5" />

                            {/* Section: Datos de Contacto */}
                            <div className="mb-5">
                                <p className="text-xs font-semibold text-blue-400/70 uppercase tracking-wider mb-3">Datos de Contacto</p>
                                <div className="space-y-4">
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
                                            Celular
                                        </label>
                                        <div className="flex items-stretch">
                                            <div className="px-4 py-3 bg-white/[0.03] border border-r-0 border-white/10 rounded-l-xl text-slate-500 text-sm flex items-center">
                                                <Phone size={14} className="mr-1.5" />+51
                                            </div>
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={handlePhoneChange}
                                                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-r-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                placeholder="999 999 999"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Data consent checkbox */}
                            <label className="flex items-start gap-3 cursor-pointer group mb-5 select-none">
                                <div className={`w-5 h-5 mt-0.5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                                    dataConsent ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-white/20 group-hover:border-blue-400/40'
                                }`}>
                                    {dataConsent && <Check size={12} className="text-white" strokeWidth={3} />}
                                </div>
                                <input type="checkbox" checked={dataConsent} onChange={(e) => setDataConsent(e.target.checked)} className="sr-only" />
                                <span className="text-slate-400 text-xs leading-relaxed">
                                    Acepto el tratamiento de mis datos personales conforme a la{' '}
                                    <a href="https://maksuites.com.pe/privacidad" target="_blank" rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-blue-400 hover:text-blue-300 underline">
                                        Política de Privacidad
                                    </a>{' '}
                                    de Mak Suites. (Ley 29733)
                                </span>
                            </label>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
                                    <p className="text-red-300 text-sm text-center">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!canProceed || loading}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="flex items-center gap-2">
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>{loadingMessages[loadingStep]}</span>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                                            <div
                                                className="h-full bg-white rounded-full transition-all duration-300 ease-out"
                                                style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ) : 'Crear Restaurante'}
                            </button>
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
                                    <span className="text-white text-sm font-mono">{successData.user?.username || username}</span>
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
