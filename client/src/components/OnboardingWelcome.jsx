import React from 'react';
import { CheckCircle2, ArrowRight, ChefHat, LayoutGrid, Package } from 'lucide-react';

/**
 * OnboardingWelcome
 * Shown to new tenants (onboardingCompleted === false) instead of "Turno Cerrado".
 * Props:
 *   tenantInfo    - { name, slug }
 *   areas         - array of areas
 *   products      - array of products
 *   onGoToSection - function(key) to navigate: 'main' | 'stock'
 *   onOpenSession - function() to open SessionManagerModal
 */
export default function OnboardingWelcome({ tenantInfo, areas, products, onGoToSection, onOpenSession }) {
    const hasSalon = areas && areas.length > 0;
    const hasProducts = products && products.length > 0;

    const steps = [
        {
            id: 'created',
            done: true,
            label: 'Restaurante creado',
            description: `${tenantInfo?.name || 'Tu restaurante'} está registrado y activo.`,
            icon: <ChefHat size={20} />,
            action: null,
        },
        {
            id: 'salon',
            done: hasSalon,
            label: 'Configura tu salón',
            description: hasSalon
                ? `${areas.length} ${areas.length === 1 ? 'área configurada' : 'áreas configuradas'}.`
                : 'Crea tus áreas y mesas para empezar a tomar pedidos.',
            icon: <LayoutGrid size={20} />,
            action: hasSalon ? null : () => onGoToSection('main'),
            actionLabel: 'Ir al Salón',
        },
        {
            id: 'products',
            done: hasProducts,
            label: 'Agrega productos a tu carta',
            description: hasProducts
                ? `${products.length} ${products.length === 1 ? 'producto registrado' : 'productos registrados'}.`
                : 'Registra los platos y bebidas que ofrece tu restaurante.',
            icon: <Package size={20} />,
            action: hasProducts ? null : () => onGoToSection('stock'),
            actionLabel: 'Ir a Carta',
        },
        {
            id: 'shift',
            done: false,
            label: 'Abre tu primer turno y opera',
            description: 'Una vez configurado el salón, abre un turno para empezar a atender mesas.',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" />
                </svg>
            ),
            action: hasSalon ? onOpenSession : null,
            actionLabel: 'Abrir Turno',
            disabled: !hasSalon,
        },
    ];

    const completedCount = steps.filter(s => s.done).length;
    const progress = (completedCount / steps.length) * 100;

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 max-w-lg mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                    <ChefHat size={28} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    ¡Bienvenido, {tenantInfo?.name || 'Restaurante'}!
                </h2>
                <p className="text-gray-500 text-sm">
                    Sigue estos pasos para configurar tu sistema y empezar a operar.
                </p>
            </div>

            {/* Progress bar */}
            <div className="w-full mb-6">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>{completedCount} de {steps.length} completados</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Steps */}
            <div className="w-full space-y-3">
                {steps.map((step, idx) => (
                    <div
                        key={step.id}
                        className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                            step.done
                                ? 'bg-green-50 border-green-200'
                                : step.disabled
                                ? 'bg-gray-50 border-gray-200 opacity-60'
                                : 'bg-white border-blue-100 shadow-sm hover:border-blue-200 hover:shadow-md'
                        }`}
                    >
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                            step.done
                                ? 'bg-green-100 text-green-600'
                                : step.disabled
                                ? 'bg-gray-100 text-gray-400'
                                : 'bg-blue-50 text-blue-600'
                        }`}>
                            {step.done ? <CheckCircle2 size={20} /> : step.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-gray-400">Paso {idx + 1}</span>
                                {step.done && (
                                    <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Listo</span>
                                )}
                            </div>
                            <p className={`font-semibold text-sm ${step.done ? 'text-green-700' : step.disabled ? 'text-gray-400' : 'text-gray-800'}`}>
                                {step.label}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                        </div>

                        {step.action && !step.done && (
                            <button
                                onClick={step.action}
                                disabled={step.disabled}
                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all transform active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {step.actionLabel}
                                <ArrowRight size={12} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <p className="text-xs text-gray-400 mt-6 text-center">
                Esta guia desaparecera cuando abras tu primer turno.
            </p>
        </div>
    );
}
