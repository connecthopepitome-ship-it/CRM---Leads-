import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SaleSphere ErrorBoundary caught an unhandled error:', error, errorInfo);

    // If chunk failed to load due to deployment cache discrepancy, auto reload once
    const msg = error?.message || '';
    const isChunkError = 
      msg.includes('dynamically imported module') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('Unexpected token');

    if (isChunkError) {
      const refreshed = sessionStorage.getItem('ss-chunk-retry');
      if (!refreshed) {
        sessionStorage.setItem('ss-chunk-retry', '1');
        window.location.reload();
      }
    }
  }

  private handleReset = () => {
    sessionStorage.removeItem('ss-chunk-retry');
    window.location.reload();
  };

  private handleGoHome = () => {
    sessionStorage.removeItem('ss-chunk-retry');
    window.location.href = '/';
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.';

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-[#DCE7D9] bg-white/95 p-8 text-center shadow-lg backdrop-blur-md">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F9F2] text-[#3D7952] border border-[#DCE7D9]">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[#202820]">
              Unable to load this section
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#778477]">
              SaleSphere encountered an issue while rendering this page. A recent update or cached file might need to refresh.
            </p>

            <div className="mt-4 rounded-xl bg-[#F5F9F2] p-3 text-left border border-[#DCE7D9]">
              <p className="text-[11px] font-mono text-[#778477] line-clamp-3 select-all">
                {errorMessage}
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3D7952] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#233D2D] transition-colors"
              >
                <RefreshCw size={14} />
                <span>Reload Page</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCE7D9] bg-white px-4 py-2.5 text-xs font-semibold text-[#202820] hover:bg-[#F5F9F2] transition-colors"
              >
                <Home size={14} />
                <span>Go to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

