import React from 'react';
import { withTranslation } from 'react-i18next'; // 🟢 Required for Class Components
import { AlertTriangle, RefreshCw } from 'lucide-react';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // 1. Detect ChunkLoadError (Version Mismatch)
        const isChunkLoadError = error?.name === 'ChunkLoadError' ||
            error?.message?.includes('Failed to fetch dynamically imported module');

        if (isChunkLoadError) {
            const hasReloaded = sessionStorage.getItem('chunk_failed_reload');

            if (!hasReloaded) {
                // Auto-reload once to fetch new chunks
                sessionStorage.setItem('chunk_failed_reload', 'true');
                window.location.reload();
            }
        }

        // Optional: Log error to a service like Sentry here
        console.error("Uncaught error:", error, errorInfo);
    }

    handleRefresh = () => {
        sessionStorage.removeItem('chunk_failed_reload');
        window.location.reload();
    };

    render() {
        // 🟢 Extract 't' from props (injected by withTranslation)
        const { t } = this.props;

        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-main text-content px-4 text-center animate-in fade-in duration-500">

                    {/* 🎨 Error Icon Container */}
                    <div className="bg-red-500/10 p-5 rounded-full mb-6 border border-red-500/20 shadow-lg">
                        <AlertTriangle size={50} className="text-red-500" />
                    </div>

                    {/* 📝 Text Content (Localized) */}
                    <h2 className="text-3xl font-bold mb-3 tracking-tight">
                        {t('error.globalTitle', 'Something went wrong!')}
                    </h2>

                    <p className="text-muted mb-8 max-w-md text-lg leading-relaxed">
                        {t('error.globalMessage', 'We encountered an unexpected issue. Please try refreshing the page.')}
                    </p>

                    {/* 🔄 Action Button */}
                    <button
                        onClick={this.handleRefresh}
                        className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                    >
                        <RefreshCw size={20} className="animate-spin-slow" /> // Slow spin for effect
                        {t('error.refreshButton', 'Refresh Page')}
                    </button>

                    <div className="mt-10 text-xs text-muted/50 font-mono">
                        Error Code: 500_CLIENT_CRASH
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// 🟢 Wrap with HOC to enable i18n support in Class Component
export default withTranslation()(GlobalErrorBoundary);