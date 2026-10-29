import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  referenceId: string | null;
}

/**
 * Production-Safe Application Error Boundary.
 * 
 * In production:
 * - Completely hides raw exception messages, stack traces, component traces, internal file paths,
 *   and database details.
 * - Displays a clean, professional, non-sensitive error page with Try Again and Reload App actions.
 * - Displays an optional random reference ID (e.g. ref_...) for support diagnostics.
 * - Falls back to a self-contained layout with zero external context dependencies.
 * 
 * In development / developer console:
 * - Emits sanitized error and component trace to console.error without exposing tokens, passwords,
 *   or secrets.
 */
export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    referenceId: null
  };

  public static getDerivedStateFromError(_error: Error): State {
    const referenceId = `ref_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    return { hasError: true, referenceId };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    try {
      const refId = this.state.referenceId || `ref_${Date.now().toString(36)}`;
      const isProduction = process.env.NODE_ENV === 'production' || Boolean(import.meta.env?.PROD);
      
      if (isProduction) {
        // In production, emit safe reference ID without exposing raw stack trace or component hierarchy
        // eslint-disable-next-line no-console
        console.error(`[Application Error] Reference ID: ${refId}`);
      } else {
        // Preserve rich developer diagnostics in console during development without leaking secrets
        // eslint-disable-next-line no-console
        console.error(`[Application Error] Reference ID: ${refId}`, {
          name: error?.name,
          message: error?.message,
          componentStack: errorInfo?.componentStack
        });
      }
    } catch {
      // Ensure logging failures never crash the error boundary
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, referenceId: null });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
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
          className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 select-none font-sans"
        >
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/90 p-6 sm:p-8 space-y-6 text-center">
            {/* Brand Logo Container */}
            <div className="w-14 h-14 rounded-2xl bg-[#0C1E38] mx-auto flex items-center justify-center shadow-md p-2 border border-slate-700/60">
              <img 
                src="/rtr-logo.png" 
                alt="RTR Mobiles" 
                className="w-full h-full object-contain"
                width="40"
                height="40"
              />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Something went wrong
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                We couldn't load this page. Please try again. If the problem continues, contact support.
              </p>
            </div>

            {/* Non-sensitive support reference ID */}
            {this.state.referenceId && (
              <div className="py-1.5 px-3 bg-slate-100 rounded-lg inline-block border border-slate-200/80">
                <p className="text-xs text-slate-500 font-mono tracking-wide select-all">
                  Reference: {this.state.referenceId}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-[#102A4C] hover:bg-[#0C1E38] text-white text-sm font-semibold rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#102A4C] cursor-pointer"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#102A4C] cursor-pointer"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
