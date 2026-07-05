import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, BarChart3, Smartphone, Shield, Zap, Globe, ArrowRight, Check } from 'lucide-react';

export default function Landing() {
    const navigate = useNavigate();

    const features = [
        { icon: <ChefHat size={24} />, title: 'Gestión de Mesas y Pedidos', desc: 'Control total de áreas, mesas, cuentas y órdenes en tiempo real.' },
        { icon: <BarChart3 size={24} />, title: 'Reportes y Caja', desc: 'Turnos de caja, reportes diarios, control de gastos y flujo de efectivo.' },
        { icon: <Smartphone size={24} />, title: 'Pantalla Cliente QR', desc: 'Muestra QR de pago, publicidad y ruleta de premios en la TV del local.' },
        { icon: <Shield size={24} />, title: 'Facturación SUNAT', desc: 'Emisión de boletas y facturas electrónicas integrado con la SUNAT.' },
        { icon: <Zap size={24} />, title: 'Stock e Inventario', desc: 'Control de productos, ingredientes, recetas y movimientos de stock.' },
        { icon: <Globe size={24} />, title: 'Tu Propio Subdominio', desc: 'Tu restaurante accesible desde tu-restaurante.maksuites.com.pe' },
    ];

    return (
        <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <ChefHat size={18} />
                        </div>
                        <span className="font-bold text-lg">MakSuites</span>
                        <span className="text-blue-400/60 text-sm font-medium ml-1">Restaurante</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/registro')}
                            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg font-medium text-sm transition-all shadow-lg shadow-blue-500/20"
                        >
                            Crear Restaurante
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative pt-32 pb-20 px-6">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"></div>
                </div>

                <div className="relative max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-300 text-sm mb-8">
                        <Zap size={14} className="text-blue-400" />
                        <span>Listo para usar en menos de 2 minutos</span>
                    </div>

                    <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
                        Gestiona tu restaurante
                        <br />
                        <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            desde la nube
                        </span>
                    </h1>

                    <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Sistema completo de gestión para tu restaurante. Mesas, pedidos, facturación SUNAT, 
                        stock, caja y más. Todo desde tu propio subdominio.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => navigate('/registro')}
                            className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-semibold text-lg transition-all shadow-xl shadow-blue-500/25 flex items-center gap-2"
                        >
                            Crear mi Restaurante Gratis
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-8 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5"><Check size={14} className="text-green-400" /> Sin tarjeta de crédito</span>
                        <span className="flex items-center gap-1.5"><Check size={14} className="text-green-400" /> Plan Demo gratis</span>
                        <span className="flex items-center gap-1.5"><Check size={14} className="text-green-400" /> Activación inmediata</span>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Todo lo que necesitas</h2>
                        <p className="text-slate-400 max-w-xl mx-auto">
                            Un sistema completo de gestión diseñado específicamente para restaurantes peruanos.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feat, i) => (
                            <div
                                key={i}
                                className="group p-6 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/10 rounded-2xl transition-all duration-300"
                            >
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                                    {feat.icon}
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{feat.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-3xl p-12">
                        <h2 className="text-3xl font-bold mb-4">
                            ¿Listo para digitalizar tu restaurante?
                        </h2>
                        <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                            Crea tu cuenta en segundos y empieza a gestionar tu restaurante hoy mismo.
                            Sin compromisos, sin tarjeta de crédito.
                        </p>
                        <button
                            onClick={() => navigate('/registro')}
                            className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-semibold text-lg transition-all shadow-xl shadow-blue-500/25 flex items-center gap-2 mx-auto"
                        >
                            Empezar Ahora
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                            <ChefHat size={12} />
                        </div>
                        MakSuites Restaurante — © {new Date().getFullYear()}
                    </div>
                    <p className="text-slate-600 text-xs">
                        Sistema de gestión para restaurantes en la nube
                    </p>
                </div>
            </footer>
        </div>
    );
}
