import React, { useState } from 'react';
import { useRestaurant } from '../contexts/RestaurantContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const { login } = useRestaurant();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = await login(username, password);
        if (success) {
            navigate('/');
        } else {
            setError('Credenciales incorrectas');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-200">
            <div className="bg-white p-8 rounded-lg shadow-xl w-96">
                <h2 className="text-3xl font-bold mb-6 text-center text-blue-800">Bienvenido a Makala</h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-700 font-semibold mb-1">Usuario</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ej. admin"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-semibold mb-1">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="********"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition-colors"
                    >
                        Ingresar
                    </button>
                </form>
            </div>
        </div>
    );
}
