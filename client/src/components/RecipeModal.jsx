import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ChefHat, Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';

export default function RecipeModal({ product, onClose }) {
    const [ingredients, setIngredients] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [expandedSections, setExpandedSections] = useState({}); // { "Base": true, "Variant 1": false }

    // Form states per section (keyed by presentation name or "Base")
    const [forms, setForms] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [ingRes, recipeRes] = await Promise.all([
                axios.get('/api/stock/ingredients'),
                axios.get(`/api/stock/recipes/${product.id}`)
            ]);
            setIngredients(ingRes.data);
            setRecipes(recipeRes.data);
        } catch (error) {
            console.error(error);
        }
    };

    const presentations = useMemo(() => {
        try {
            if (product.presentations) {
                const parsed = typeof product.presentations === 'string' ? JSON.parse(product.presentations) : product.presentations;
                return Array.isArray(parsed) ? parsed : [];
            }
            return [];
        } catch { return []; }
    }, [product]);

    // Sections: Base + Variants
    const sections = useMemo(() => {
        const isMenuOption = ['daily_entry', 'daily_main', 'daily_option'].includes(product.type);
        const baseName = isMenuOption ? 'Ingredientes' : 'Base';
        const list = [];

        // ONLY add Base if there are NO variants/presentations
        if (presentations.length === 0) {
            list.push({ name: baseName, price: product.price, isBase: true, hidePrice: isMenuOption });
        }

        presentations.forEach(p => {
            list.push({ name: p.name || `Variante ${p.price}`, price: p.price, isBase: false, rawName: p.name, hidePrice: false });
        });
        return list;
    }, [product, presentations]);

    // Update form state helper
    const updateForm = (sectionName, field, value) => {
        setForms(prev => ({
            ...prev,
            [sectionName]: { ...prev[sectionName], [field]: value }
        }));
    };

    const toggleSection = (name) => {
        setExpandedSections(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const addIngredient = async (section) => {
        const form = forms[section.name] || {};
        if (!form.ingredientId || !form.quantity) return;

        try {
            await axios.post('/api/stock/recipes', {
                productId: product.id,
                ingredientId: form.ingredientId,
                quantity: parseFloat(form.quantity),
                presentation: section.isBase ? null : (section.rawName || section.name) // Send specific presentation name or null for base
            });

            // Clear form
            updateForm(section.name, 'quantity', '');
            updateForm(section.name, 'ingredientId', '');
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const removeIngredient = async (id) => {
        try {
            await axios.delete(`/api/stock/recipes/${id}`);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <ChefHat className="text-orange-600" /> Receta: {product.name}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <p className="text-sm text-gray-500 mb-4">
                        Define los ingredientes para cada presentación. Cuando se venda una presentación específica, se descontarán sus ingredientes correspondientes.
                    </p>

                    <div className="flex flex-col gap-4">
                        {sections.map((section, idx) => {
                            const sectionName = section.name;
                            const isExpanded = expandedSections[sectionName] ?? true; // Default open
                            const sectionRecipes = recipes.filter(r => {
                                if (section.isBase) return !r.presentation; // Base has null presentation
                                return r.presentation === (section.rawName || section.name);
                            });

                            return (
                                <div key={idx} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                    <button
                                        onClick={() => toggleSection(sectionName)}
                                        className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b"
                                    >
                                        <div className="flex items-center gap-2 font-bold text-gray-800">
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            {section.name}
                                            {!section.hidePrice && (
                                                <span className="text-gray-500 font-normal">(S/ {Number(parseFloat(section.price).toFixed(1))})</span>
                                            )}
                                        </div>
                                        <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600 font-bold">
                                            {sectionRecipes.length} Insumos
                                        </span>
                                    </button>

                                    {isExpanded && (
                                        <div className="p-4 bg-white animate-in slide-in-from-top-2">
                                            {/* LIST */}
                                            {sectionRecipes.length > 0 ? (
                                                <table className="w-full text-sm mb-4">
                                                    <thead>
                                                        <tr className="text-gray-500 border-b">
                                                            <th className="text-left py-2">Insumo</th>
                                                            <th className="text-left py-2">Cantidad</th>
                                                            <th className="text-right py-2"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sectionRecipes.map(r => (
                                                            <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 group">
                                                                <td className="py-2">{r.Ingredient?.name}</td>
                                                                <td className="py-2 font-bold">{r.quantity} {r.Ingredient?.unit}</td>
                                                                <td className="py-2 text-right">
                                                                    <button onClick={() => removeIngredient(r.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <p className="text-center text-gray-400 italic text-sm py-4 mb-4">No hay ingredientes configurados para esta variante.</p>
                                            )}

                                            {/* ADD FORM */}
                                            <div className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-dashed border-gray-300">
                                                <select
                                                    className="border p-1.5 rounded flex-1 text-sm outline-none focus:border-orange-500"
                                                    value={forms[sectionName]?.ingredientId || ''}
                                                    onChange={e => updateForm(sectionName, 'ingredientId', e.target.value)}
                                                >
                                                    <option value="">+ Agregar Insumo...</option>
                                                    {ingredients.map(ing => (
                                                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Cant."
                                                    className="border p-1.5 rounded w-20 text-sm outline-none focus:border-orange-500"
                                                    value={forms[sectionName]?.quantity || ''}
                                                    onChange={e => updateForm(sectionName, 'quantity', e.target.value)}
                                                />
                                                <button
                                                    onClick={() => addIngredient(section)}
                                                    className="bg-orange-600 text-white p-1.5 rounded hover:bg-orange-700 transition-colors"
                                                    disabled={!forms[sectionName]?.ingredientId}
                                                >
                                                    <Plus size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
