import React from 'react';
import { AlertCircle, RefreshCw, LogIn } from 'lucide-react';

interface AppLoadingScreenProps {
  message?: string;
  subMessage?: string;
  error?: string | null;
  onRetry?: () => void;
  onProceedToLogin?: () => void;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  message = 'Loading RTR Wholesale Management...',
  subMessage = 'Verifying session and workspace state',
  error = null,
  onRetry,
  onProceedToLogin
}) => {
  return (
    <div 
      role="status" 
      aria-live="polite"
      className="min-h-screen bg-crimpston-navy flex flex-col items-center justify-center p-6 text-white"
    >
      <div className="flex flex-col items-center space-y-6 max-w-md text-center">
        {/* Brand Icon */}
        <div className="relative">
          <div className="w-20 h-16 rounded-2xl bg-[#0C1E38] p-2 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-[#1F3A60]">
            <img
              src="/rtr-logo.png"
              alt="RTR Mobiles logo"
              className="w-full h-full object-contain"
              width="80"
              height="64"
              loading="eager"
            />
          </div>
          {!error && (
            <div className="absolute -inset-1 rounded-2xl bg-blue-500/20 filter blur-sm -z-10 animate-ping"></div>
          )}
        </div>

        {/* Brand Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-white">RTR Wholesale Management</h1>
          <p className="text-xs font-medium text-slate-400 tracking-wider uppercase">Wholesale Accessories Distribution</p>
        </div>

        {error ? (
          /* Actionable Error State with Retry & Continue */
          <div className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 space-y-4 animate-fade-in shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-center space-x-2 text-amber-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold text-slate-200">Connection Unavailable</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {error}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Connection
                </button>
              )}
              {onProceedToLogin && (
                <button
                  type="button"
                  onClick={onProceedToLogin}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors border border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Go to Login
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Normal Spinner & Progress Indicator */
          <>
            <div className="flex items-center space-x-3 pt-2">
              <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm text-slate-300 font-medium">{message}</span>
            </div>

            {subMessage && (
              <p className="text-xs text-slate-500 font-normal">
                {subMessage}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
