import React from 'react';
import CharCount from './CharCount';

export default function CharInput({
    label,
    maxLength,
    value = '',
    onChange,
    className = '',
    containerClassName = '',
    labelClassName = '',
    showCount = true,
    dark = false,
    id,
    ...props
}) {
    const inputId = id || (label ? `char-input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
        <div className={`flex flex-col ${containerClassName}`}>
            {(label || (showCount && maxLength)) && (
                <div className="flex justify-between items-center mb-1">
                    {label && (
                        <label
                            htmlFor={inputId}
                            className={`text-sm font-bold text-gray-700 ${labelClassName}`}
                        >
                            {label}
                        </label>
                    )}
                    {showCount && maxLength && (
                        <CharCount current={value?.length || 0} max={maxLength} dark={dark} />
                    )}
                </div>
            )}
            <input
                id={inputId}
                {...props}
                value={value}
                maxLength={maxLength}
                onChange={onChange}
                className={className}
            />
        </div>
    );
}
