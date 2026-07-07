import React, { useState } from 'react';
import axios from 'axios';
import { X, Plus, Trash2, Loader2, LayoutGrid } from 'lucide-react';

export default function OnboardingSalonModal({ onClose, onComplete }) {
    const [areas, setAreas] = useState([
        { name: 'Salón Principal', tables: 5 }
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleAddArea = () => {
        setAreas([...areas, { name: '', tables: 1 }]);
    };

    const handleRemoveArea = (index) => {
        if (areas.length > 1) {
            setAreas(areas.filter((_, i) => i !== index));
        }
    };

    const handleAreaChange = (index, field, value) => {
        const newAreas = [...areas];
        newAreas[index][field] = value;
        setAreas(newAreas);
    };

    const handleSubmit = async () => {
        setError(null);
        
        // Validate
        for (let i = 0; i < areas.length; i++) {
            const area = areas[i];
            if (!area.name.trim()) {
                setError(`El área #${i + 1} debe tener un nombre.`);
                return;
            }
            if (area.tables < 1 || area.tables > 50) {
                setError(`El área "${area.name}" debe tener entre 1 y 50 mesas.`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            for (let i = 0; i < areas.length; i++) {
                const areaData = areas[i];
                
                // 1. Create Area
                const areaRes = await axios.post('/api/areas', { 
                    name: areaData.name.trim(), 
                    sortOrder: i 
                });
                const areaId = areaRes.data.id;

                // 2. Create Tables for this Area
                // We'll create them sequentially to avoid overwhelming the DB/backend
                for (let t = 1; t <= areaData.tables; t++) {
                    await axios.post('/api/tables', { 
                        number: String(t), 
                        AreaId: areaId 
                    });
                }
            }
            
            // Finished successfully
            onComplete();
        } catch (err) {
            console.error('Error creating salon:', err);
            setError('Ocurrió un error al guardar la configuración. Por favor intenta de nuevo.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <LayoutGrid size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Configura tu Salón</h2>
                            <p className="text-sm text-gray-500">Crea tus áreas y la cantidad de mesas iniciales.</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        disabled={isSubmitting}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {areas.map((area, index) => (
                            <div key={index} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                                            Nombre del Área
                                        </label>
                                        <input
                                            type="text"
                                            value={area.name}
                                            onChange={(e) => handleAreaChange(index, 'name', e.target.value)}
                                            placeholder="Ej. Salón Principal"
                                            className="w-full border border-gray-300 px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-shadow"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="sm:w-32">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                                            N° Mesas
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="50"
                                            value={area.tables}
                                            onChange={(e) => handleAreaChange(index, 'tables', parseInt(e.target.value) || '')}
                                            className="w-full border border-gray-300 px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-shadow"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>
                                {areas.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveArea(index)}
                                        className="absolute -right-2 -top-2 w-8 h-8 bg-white border border-gray-200 text-red-500 hover:text-white hover:bg-red-500 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all sm:opacity-100"
                                        title="Eliminar área"
                                        disabled={isSubmitting}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleAddArea}
                        disabled={isSubmitting}
                        className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-xl font-medium text-sm hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={16} />
                        Agregar otra área
                    </button>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-white shrink-0 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            'Guardar Configuración'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
