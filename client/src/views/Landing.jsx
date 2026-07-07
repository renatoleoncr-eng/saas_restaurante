import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, BarChart3, Smartphone, Shield, Zap, Globe, ArrowRight, Check, Gift, Star, Clock, Users, ShieldCheck } from 'lucide-react';

export default function Landing() {
    const navigate = useNavigate();

    const features = [
        { icon: <Clock size={24} />, title: 'Atiende 3x Más Rápido', desc: 'Elimina las esperas. Toma pedidos y envíalos directo a cocina en segundos, sin errores.' },
        { icon: <BarChart3 size={24} />, title: 'Control Total de tu Dinero', desc: 'No más cuadres de caja con faltantes. Conoce tus ganancias y gastos en tiempo real.' },
        { icon: <Smartphone size={24} />, title: 'Experiencia VIP para Clientes', desc: 'Menú digital QR con publicidad y pagos rápidos. Moderniza la imagen de tu local.' },
        { icon: <ShieldCheck size={24} />, title: 'Cero Multas con SUNAT', desc: 'Facturación electrónica 100% automatizada. Olvídate del estrés fiscal y contable.' },
        { icon: <Zap size={24} />, title: 'Evita Robos y Mermas', desc: 'Control estricto de inventario y recetas. Protege tus insumos y aumenta tu rentabilidad.' },
        { icon: <Globe size={24} />, title: 'Presencia Digital Profesional', desc: 'Tu propio dominio web listo para recibir a tus clientes e incrementar tu visibilidad.' },
    ];

    const benefits = [
        "Sin tarjetas de crédito",
        "Configuración en 2 min",
        "Soporte prioritario",
        "Acceso desde cualquier equipo"
    ];

    return (
        <div className="h-full w-full overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-blue-50/50 text-slate-800 font-sans">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm transition-all">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
                            <ChefHat size={18} />
                        </div>
                        <span className="font-extrabold text-xl text-slate-900 tracking-tight">MakSuites</span>
                        <span className="text-blue-700 font-bold ml-1 text-[10px] bg-blue-100/80 px-2 py-0.5 rounded-full uppercase tracking-widest hidden sm:block">Restaurante</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/registro')}
                            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full font-bold text-sm transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 active:scale-95"
                        >
                            Comenzar Gratis
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative pt-32 pb-16 px-6 overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-blue-300/20 rounded-full blur-[120px]"></div>
                    <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-indigo-300/20 rounded-full blur-[100px]"></div>
                </div>

                <div className="relative max-w-5xl mx-auto text-center">
                    {/* Social Proof & Curiosity Badge */}
                    <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-full text-amber-700 text-sm font-bold mb-8 shadow-sm hover:shadow-md transition-shadow cursor-default">
                        <Star size={16} className="text-amber-500 fill-amber-500" />
                        <span>La forma más inteligente de gestionar tu restaurante. ¡100% Gratis!</span>
                    </div>

                    {/* Anchoring & Loss Aversion Headline */}
                    <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.1] mb-6 text-slate-900 tracking-tight">
                        No dejes que el desorden <br className="hidden md:block" />
                        <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent relative inline-block">
                            frene tu crecimiento
                            {/* Underline decoration */}
                            <svg className="absolute w-full h-3 -bottom-1 left-0 text-blue-400/40" viewBox="0 0 100 10" preserveAspectRatio="none">
                                <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="3" />
                            </svg>
                        </span>
                    </h1>

                    <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
                        Un sistema moderno, fácil de usar y sin costos ocultos. Toma el control total de tus mesas, inventario y facturación en <strong>menos de 2 minutos</strong>.
                    </p>

                    {/* Frictionless CTA */}
                    <div className="flex flex-col items-center justify-center gap-4">
                        <button
                            onClick={() => navigate('/registro')}
                            className="group relative px-8 py-5 sm:px-12 sm:py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full font-extrabold text-xl sm:text-2xl transition-all duration-300 shadow-[0_10px_40px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_60px_rgba(37,99,235,0.5)] hover:-translate-y-1 flex items-center gap-3 overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                Crear mi Cuenta Gratis
                                <ArrowRight size={28} className="group-hover:translate-x-1 transition-transform" />
                            </span>
                            {/* Shine effect */}
                            <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out"></div>
                        </button>
                        
                        <p className="text-sm font-bold text-slate-500 mt-2 flex items-center gap-2">
                            <ShieldCheck size={18} className="text-green-500" /> Cero compromisos. Seguro y confiable.
                        </p>
                    </div>

                    {/* Trust Indicators (Social Proof / Bandwagon) */}
                    <div className="mt-16 pt-8 border-t border-slate-200/60 max-w-4xl mx-auto">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Beneficios inmediatos:</p>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-4">
                            {benefits.map((benefit, i) => (
                                <div key={i} className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-100 hover:border-blue-200 transition-colors cursor-default">
                                    <div className="bg-green-100 p-1 rounded-full"><Check size={14} className="text-green-600 stroke-[3]" /></div>
                                    <span className="text-sm font-bold text-slate-700">{benefit}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Social Proof / Numbers Section */}
            <section className="bg-white py-12 border-y border-slate-100">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100">
                    <div className="py-4">
                        <div className="text-5xl font-extrabold text-blue-600 mb-2">100%</div>
                        <div className="text-slate-500 font-bold text-sm uppercase tracking-wider">En la Nube</div>
                    </div>
                    <div className="py-4">
                        <div className="text-5xl font-extrabold text-blue-600 mb-2">S/ 0</div>
                        <div className="text-slate-500 font-bold text-sm uppercase tracking-wider">Costo de Instalación</div>
                    </div>
                    <div className="py-4">
                        <div className="text-5xl font-extrabold text-blue-600 mb-2">2 min</div>
                        <div className="text-slate-500 font-bold text-sm uppercase tracking-wider">Para Empezar</div>
                    </div>
                </div>
            </section>

            {/* Value Proposition (Framing Effect) */}
            <section className="py-24 px-6 relative z-10 bg-slate-50/50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-slate-900 tracking-tight">Todo lo que necesitas para triunfar</h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto font-medium">
                            Olvídate de sistemas complicados y caros. Hemos diseñado cada herramienta pensando en tu tranquilidad y rentabilidad.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feat, i) => (
                            <div
                                key={i}
                                className="group relative p-8 bg-white border border-slate-200 hover:border-blue-400 rounded-[2rem] transition-all duration-300 shadow-sm hover:shadow-2xl hover:shadow-blue-900/10 hover:-translate-y-2 overflow-hidden"
                            >
                                {/* Background accent */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-50/50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                <div className="relative z-10 w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                                    {feat.icon}
                                </div>
                                <h3 className="relative z-10 text-xl font-extrabold mb-3 text-slate-900 leading-snug">{feat.title}</h3>
                                <p className="relative z-10 text-slate-600 leading-relaxed font-medium">{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Zeigarnik Effect (Steps to success) */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-slate-900 tracking-tight">A solo 3 pasos de tu tranquilidad</h2>
                        <p className="text-xl text-slate-600 font-medium">Es tan intuitivo que no necesitarás manuales de instrucciones.</p>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between relative gap-12 md:gap-0">
                        {/* Connecting line */}
                        <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-1 bg-slate-100 rounded-full z-0">
                            <div className="h-full bg-blue-200 w-full rounded-full"></div>
                        </div>

                        {[
                            { num: 1, title: 'Regístrate Gratis', desc: 'Ingresa los datos de tu restaurante en segundos.' },
                            { num: 2, title: 'Crea tu Menú', desc: 'Añade tus platos, mesas y zonas rápidamente.' },
                            { num: 3, title: 'Empieza a Vender', desc: 'Atiende clientes y mira cómo crecen tus ganancias.' }
                        ].map((step, i) => (
                            <div key={i} className="relative z-10 flex flex-col items-center text-center max-w-[280px] mx-auto group">
                                <div className="w-24 h-24 bg-white border-[6px] border-blue-50 rounded-full flex items-center justify-center text-4xl font-black text-blue-600 mb-6 shadow-xl shadow-blue-900/5 group-hover:border-blue-100 group-hover:scale-110 transition-all duration-300">
                                    {step.num}
                                </div>
                                <h3 className="text-2xl font-extrabold text-slate-900 mb-3">{step.title}</h3>
                                <p className="text-slate-600 font-medium text-lg leading-relaxed">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA / Urgency / Loss Aversion */}
            <section className="py-24 px-6">
                <div className="max-w-5xl mx-auto text-center">
                    <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 rounded-[3rem] p-10 md:p-20 text-white shadow-2xl shadow-blue-900/40 relative overflow-hidden">
                        {/* Abstract background shapes for premium feel */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-400/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>
                        
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-5 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-sm font-extrabold mb-8 border border-white/20 uppercase tracking-widest">
                                <Gift size={16} className="text-yellow-300" /> Promoción por tiempo limitado
                            </div>
                            <h2 className="text-4xl md:text-6xl font-extrabold mb-8 tracking-tight leading-tight">
                                ¿Vas a seguir perdiendo tiempo y dinero?
                            </h2>
                            <p className="text-blue-100 mb-10 max-w-2xl mx-auto text-xl md:text-2xl font-medium leading-relaxed">
                                Toma la decisión inteligente hoy. Únete a MakSuites y usa el sistema <strong className="text-white bg-blue-500/30 px-2 rounded">totalmente gratis</strong>.
                            </p>
                            <button
                                onClick={() => navigate('/registro')}
                                className="group relative px-10 py-5 sm:px-14 sm:py-6 bg-white text-blue-700 hover:text-blue-800 rounded-full font-black text-xl sm:text-2xl transition-all duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)] hover:-translate-y-2 flex items-center gap-3 mx-auto overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    Crear Cuenta Gratis Ahora
                                    <ArrowRight size={28} className="group-hover:translate-x-2 transition-transform" />
                                </span>
                                {/* Hover color fill */}
                                <div className="absolute inset-0 bg-blue-50 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            </button>
                            <p className="mt-8 text-blue-200 text-sm font-bold tracking-wide">
                                SIN TARJETA DE CRÉDITO • CANCELA CUANDO QUIERAS
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-200 py-12 px-6 bg-slate-50 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3 text-slate-800 font-black text-xl tracking-tight">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-md">
                            <ChefHat size={22} />
                        </div>
                        MakSuites Restaurante
                    </div>
                    <p className="text-slate-500 font-bold text-sm">
                        Potenciando restaurantes peruanos. © {new Date().getFullYear()}
                    </p>
                </div>
            </footer>
        </div>
    );
}
