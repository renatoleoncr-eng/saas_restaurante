import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurant } from '../contexts/RestaurantContext';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, tenantInfo } = useRestaurant();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        const success = await login(username, password);
        setLoading(false);
        
        if (success) {
            navigate('/');
        } else {
            setError('Credenciales inválidas');
        }
    };

    const restaurantName = tenantInfo?.name || 'Restaurante';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-md">
                {/* Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
                    {/* Logo / Brand */}
                    <div className="text-center mb-8">
                        {tenantInfo?.logoUrl ? (
                            <img src={tenantInfo.logoUrl} alt={restaurantName} className="h-16 mx-auto mb-4" />
                        ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                <span className="text-2xl font-bold text-white">
                                    {restaurantName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <h1 className="text-2xl font-bold text-white mb-1">
                            {restaurantName}
                        </h1>
                        <p className="text-blue-200/60 text-sm">
                            Ingresa tus credenciales para continuar
                        </p>
                        {tenantInfo?.plan === 'demo' && (
                            <span className="inline-block mt-2 px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-medium rounded-full border border-amber-500/30">
                                Plan Demo
                            </span>
                        )}
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-blue-200/80 mb-2">
                                Usuario
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                placeholder="Ingresa tu usuario"
                                autoFocus
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
                                placeholder="Ingresa tu contraseña"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                                <p className="text-red-300 text-sm text-center">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Ingresando...
                                </span>
                            ) : 'Ingresar'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-white/20 text-xs mt-6">
                    Gestión de Restaurante — MakSuites
                </p>
            </div>
        </div>
    );
}
