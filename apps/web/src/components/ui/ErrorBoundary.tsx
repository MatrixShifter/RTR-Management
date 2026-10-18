import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearStorage = () => {
    if (window.confirm('Are you sure you want to clear local cache and reload? This will not affect the remote database.')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          role="alert" 
          aria-live="assertive"
          className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Application Error</h1>
                <p className="text-sm text-slate-500">RTR Wholesale Management</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-700 font-medium">
                An unexpected error occurred while rendering this view.
              </p>
              <p className="text-xs text-slate-500">
                Your database records remain safe. You can retry loading this component, reload the application, or reset the local cache.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                <p className="text-xs font-mono text-slate-800 break-words">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                      View component trace
                    </summary>
                    <pre className="mt-2 text-[10px] text-slate-600 overflow-x-auto p-2 bg-white rounded border border-slate-200 max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-crimpston-navy text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-crimpston-navy"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-crimpston-blue"
              >
                Reload App
              </button>
              <button
                type="button"
                onClick={this.handleClearStorage}
                className="py-2.5 px-3 text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors"
                title="Clears local storage in case of corrupted cache"
              >
                Reset Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
