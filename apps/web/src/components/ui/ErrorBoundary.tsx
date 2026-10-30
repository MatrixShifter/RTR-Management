import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  referenceId: string | null;
  retryCount: number;
}

/**
 * Production-Safe Application Error Boundary.
 * 
 * In production:
 * - Completely hides raw exception messages, stack traces, component traces, internal file paths,
 *   and database details.
 * - Displays a clean, professional, non-sensitive error page with Try Again and Reload App actions.
 * - Displays a random reference ID (e.g. ref_...) for support diagnostics.
 * - Completely self-contained: works both inside and outside of React Router context.
 * - Prevents infinite retry loops by tracking retry count.
 */
export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    referenceId: null,
    retryCount: 0
  };

  public static getDerivedStateFromError(_error: Error): State {
    const referenceId = `ref_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    return { hasError: true, referenceId, retryCount: 0 };
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
        // Developer diagnostics in console without leaking secrets
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
    if (this.state.retryCount >= 3) {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      return;
    }

    if (this.props.onReset) {
      this.props.onReset();
    }

    this.setState(prev => ({
      hasError: false,
      referenceId: null,
      retryCount: prev.retryCount + 1
    }));
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

      // If it's an isolated section error (e.g. within a panel or table)
      if (this.props.sectionTitle) {
        return (
          <div 
            role="alert" 
            aria-live="assertive"
            className="p-6 rounded-2xl bg-white border border-[#DCE4EC] shadow-xs text-center my-4 space-y-4"
          >
            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-red-600 font-bold">
              !
            </div>
            <div>
              <h2 className="text-base font-bold text-[#102A4C]">
                Unable to load {this.props.sectionTitle}
              </h2>
              <p className="text-xs text-[#5A6E85] mt-1">
                A rendering issue occurred in this section. Other parts of the workspace remain functional.
              </p>
            </div>
            {this.state.referenceId && (
              <span className="text-[11px] font-mono text-[#8A9BAE] bg-[#F1F5F9] px-2.5 py-1 rounded-md">
                Ref: {this.state.referenceId}
              </span>
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-[#168BFF] hover:bg-[#0E7BE5] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Retry Section
              </button>
            </div>
          </div>
        );
      }

      // Self-contained full-screen fallback with zero router dependencies
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
