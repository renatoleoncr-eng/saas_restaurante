import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { ChefHat, Plus, Trash2, X, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

const SearchableSelect = ({ ingredients, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedIng = ingredients.find(i => String(i.id) === String(value));
    const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div ref={wrapperRef} className="relative w-full sm:flex-1 text-sm">
            <div 
                className={`border p-2 rounded outline-none bg-white cursor-pointer flex justify-between items-center transition-colors h-[38px] ${isOpen ? 'border-orange-500 ring-1 ring-orange-500' : 'hover:border-gray-400'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedIng ? "text-gray-900 truncate font-medium" : "text-gray-500 truncate"}>
                    {selectedIng ? `${selectedIng.name} (Stock: ${selectedIng.stock} ${selectedIng.unit})` : "+ Buscar Insumo..."}
                </span>
                <ChevronDown size={16} className={`text-gray-500 flex-shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded shadow-xl max-h-64 flex flex-col overflow-hidden">
                    <div className="p-2 border-b bg-gray-50 sticky top-0">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="w-full pl-8 pr-2 py-1.5 border rounded outline-none text-sm focus:border-orange-500 bg-white"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto overscroll-contain">
                        {filtered.length === 0 ? (
                            <div className="p-3 text-gray-500 text-center italic text-xs">No se encontraron insumos</div>
                        ) : (
                            filtered.map(ing => (
                                <div
                                    key={ing.id}
                                    className={`p-2 hover:bg-orange-50 cursor-pointer border-b last:border-0 ${String(value) === String(ing.id) ? 'bg-orange-100' : ''}`}
                                    onClick={() => {
                                        onChange(ing.id);
                                        setIsOpen(false);
                                        setSearch("");
                                    }}
                                >
                                    <div className="font-bold text-gray-800 text-xs">{ing.name}</div>
                                    <div className="text-[10px] text-gray-500 font-medium">Stock actual: <span className={ing.stock > 0 ? 'text-green-600' : 'text-red-500'}>{ing.stock}</span> {ing.unit}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function RecipeModal({ product, onClose, apiBase = '/api/stock', recipePostPath = null, recipeGetPath = null, recipeDeletePath = null }) {
    useModalBackHandler(true, onClose);
    const [ingredients, setIngredients] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [expandedSections, setExpandedSections] = useState({}); // { "Base": true, "Variant 1": false }

    // Form states per section (keyed by presentation name or "Base")
    const [forms, setForms] = useState({});

    // Resolve API paths: custom paths override defaults
    const getRecipesUrl = recipeGetPath || `${apiBase}/recipes/${product.id}`;
    const postRecipeUrl = recipePostPath || `${apiBase}/recipes`;
    const deleteRecipeUrl = (id) => recipeDeletePath ? `${recipeDeletePath}/${id}` : `${apiBase}/recipes/${id}`;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [ingRes, recipeRes] = await Promise.all([
                axios.get('/api/stock/ingredients'),
                axios.get(getRecipesUrl)
            ]);
            setIngredients(ingRes.data);
            setRecipes(recipeRes.data);
        } catch (error) {
            console.error(error);
        }
    };

    const presentations = useMemo(() => {
        try {
            if (product._targetVariant) {
                return [product._targetVariant];
            }
            if (product.ProductVariants && product.ProductVariants.length > 0) {
                return product.ProductVariants;
            }
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
            await axios.post(postRecipeUrl, {
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
            await axios.delete(deleteRecipeUrl(id));
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
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }} 
                        className="p-2.5 hover:bg-gray-200 active:bg-gray-300 rounded-full text-gray-500 hover:text-gray-800 transition-all duration-200 relative z-50 cursor-pointer pointer-events-auto shrink-0 flex items-center justify-center -mr-1"
                        aria-label="Cerrar"
                    >
                        <X size={24} />
                    </button>
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
                                                <div className="overflow-x-auto w-full mb-4">
                                                    <table className="w-full text-sm min-w-[300px]">
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
                                                                    <td className="py-2 font-bold whitespace-nowrap">{r.quantity} {r.Ingredient?.unit}</td>
                                                                    <td className="py-2 text-right">
                                                                        <button onClick={() => removeIngredient(r.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <p className="text-center text-gray-400 italic text-sm py-4 mb-4">No hay ingredientes configurados para esta variante.</p>
                                            )}

                                            {/* ADD FORM */}
                                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center bg-gray-50 p-2.5 rounded-lg border border-dashed border-gray-300">
                                                <SearchableSelect 
                                                    ingredients={ingredients}
                                                    value={forms[sectionName]?.ingredientId}
                                                    onChange={val => updateForm(sectionName, 'ingredientId', val)}
                                                />
                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        placeholder="Cant."
                                                        className="border p-1.5 rounded flex-1 sm:w-24 text-sm outline-none focus:border-orange-500 h-[38px]"
                                                        value={forms[sectionName]?.quantity || ''}
                                                        onChange={e => updateForm(sectionName, 'quantity', e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') addIngredient(section);
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => addIngredient(section)}
                                                        className="bg-orange-600 hover:bg-orange-700 text-white p-1.5 rounded transition-colors flex items-center justify-center min-w-[36px]"
                                                    >
                                                        <Plus size={18} />
                                                    </button>
                                                </div>
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
