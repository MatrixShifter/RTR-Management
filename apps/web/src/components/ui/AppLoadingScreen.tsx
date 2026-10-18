import React from 'react';

interface AppLoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  message = 'Loading RTR Wholesale Management...',
  subMessage = 'Verifying session and workspace state'
}) => {
  return (
    <div 
      role="status" 
      aria-live="polite"
      className="min-h-screen bg-crimpston-navy flex flex-col items-center justify-center p-6 text-white"
    >
      <div className="flex flex-col items-center space-y-6 max-w-sm text-center">
        {/* Brand Icon with Pulse Glow */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-crimpston-blue flex items-center justify-center shadow-lg shadow-blue-500/30 animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-blue-500/20 filter blur-sm -z-10 animate-ping"></div>
        </div>

        {/* Brand Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-white">RTR Wholesale Management</h1>
          <p className="text-xs font-medium text-slate-400 tracking-wider uppercase">Wholesale Accessories Distribution</p>
        </div>

        {/* Spinner & Progress Indicator */}
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
      </div>
    </div>
  );
};
