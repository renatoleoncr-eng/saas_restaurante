import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'

console.log("Restoring full app...");

try {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
        <React.StrictMode>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <App />
            </BrowserRouter>
        </React.StrictMode>,
    );
} catch (e) {
    console.error(e);
    document.body.innerHTML = `<h1>React Error</h1><pre>${e.toString()}</pre>`;
}
