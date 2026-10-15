import React from 'react';

/**
 * Indicador visual y contador de caracteres con umbrales de alerta:
 * - <80%: Color neutro (gris sutil)
 * - 80% - 99%: Ámbar (aviso de proximidad)
 * - >=100%: Rojo y negrita (límite alcanzado)
 */
export default function CharCount({ value, current, max, className = '', dark = false }) {
    if (!max) return null;
    let len = 0;
    if (value !== undefined && value !== null) {
        len = typeof value === 'string' ? value.length : String(value).length;
    } else if (current !== undefined && current !== null) {
        len = typeof current === 'string' ? current.length : (Number(current) || 0);
    }
    const ratio = max > 0 ? len / max : 0;

    let colorClass = dark ? 'text-slate-400' : 'text-gray-400';
    if (ratio >= 1) {
        colorClass = 'text-red-500 font-bold';
    } else if (ratio >= 0.8) {
        colorClass = 'text-amber-500 font-semibold';
    }

    return (
        <span
            className={`text-[11px] font-mono tabular-nums select-none transition-colors duration-150 ${colorClass} ${className}`}
            title={`${len} de ${max} caracteres`}
        >
            {len}/{max}
        </span>
    );
}
