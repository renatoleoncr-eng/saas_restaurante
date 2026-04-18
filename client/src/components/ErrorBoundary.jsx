import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-10 text-red-600">
                    <h1 className="text-2xl font-bold">Algo salió mal.</h1>
                    <pre className="mt-4 bg-gray-100 p-4 rounded overflow-auto">
                        {this.state.error && this.state.error.toString()}
                    </pre>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                        className="mt-4 bg-red-600 text-white px-4 py-2 rounded"
                    >
                        Borrar Cache y Recargar
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
