import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft, LayoutDashboard } from 'lucide-react';

export interface NotFoundProps {
  isAuthenticated?: boolean;
  userRole?: 'owner' | 'demo';
}

export const NotFound: React.FC<NotFoundProps> = ({ isAuthenticated }) => {
  const navigate = useNavigate();

  // Determine auth status from prop or local storage fallback
  const isAuthed = isAuthenticated ?? (() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('rtr_current_user');
        const storedExpiry = localStorage.getItem('rtr_session_expiry');
        if (stored && storedExpiry && Date.now() < parseInt(storedExpiry, 10)) {
          const parsed = JSON.parse(stored);
          return Boolean(parsed && (parsed.role === 'owner' || parsed.role === 'demo' || parsed.isDemo));
        }
      }
    } catch {}
    return false;
  })();

  const dashboardPath = isAuthed ? '/records' : '/login';

  const handleGoToDashboard = () => {
    navigate(dashboardPath);
  };

  const handleGoBack = () => {
    if (
      typeof window !== 'undefined' &&
      window.history.state &&
      typeof window.history.state.idx === 'number' &&
      window.history.state.idx > 0
    ) {
      navigate(-1);
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      // Safe fallback when accessed directly or with empty history
      navigate(dashboardPath);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-800 animate-fade-in">
      {/* Brand Header */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
        <Link
          to={dashboardPath}
          className="flex items-center gap-2.5 group transition-opacity hover:opacity-90 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0C1E38] p-1.5 flex items-center justify-center shadow-xs border border-slate-700/60">
            <img
              src="/rtr-logo.png"
              alt="RTR Mobiles logo"
              className="w-full h-full object-contain"
              width="32"
              height="32"
              loading="eager"
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-extrabold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
              RTR Mobiles
            </span>
            <span className="text-[11px] font-medium text-slate-500 -mt-0.5">
              Wholesale Management
            </span>
          </div>
        </Link>

        {isAuthed && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>Workspace Active</span>
          </span>
        )}
      </header>

      {/* Main Card Content */}
      <main className="w-full max-w-lg mx-auto px-4 sm:px-6 py-8 my-auto">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-10 text-center">
          {/* Tasteful Illustration Icon */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-blue-50 border border-blue-100 rotate-6 transition-transform" />
            <div className="relative w-full h-full rounded-2xl sm:rounded-3xl bg-linear-to-b from-blue-50 to-slate-50 border border-blue-200/80 flex items-center justify-center shadow-2xs">
              <FileQuestion className="w-10 h-10 sm:w-12 sm:h-12 text-[#2563EB]" strokeWidth={1.75} />
            </div>
          </div>

          {/* Clear 404 Heading & Title */}
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider text-blue-700 bg-blue-50 border border-blue-100 uppercase mb-3">
            Error 404
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Page Not Found
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            The page you're looking for doesn't exist or may have been moved.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
            <button
              type="button"
              onClick={handleGoBack}
              className="w-full sm:w-auto min-w-[130px] border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl px-4 py-2.5 text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Go Back</span>
            </button>

            <button
              type="button"
              onClick={handleGoToDashboard}
              title="Back to Records Dashboard"
              aria-label="Go to Dashboard (Back to Records)"
              className="w-full sm:w-auto min-w-[160px] bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-xl px-5 py-2.5 text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <LayoutDashboard className="w-4 h-4 text-white/90" />
              <span>Go to Dashboard</span>
              <span className="sr-only">Back to Records</span>
            </button>
          </div>
        </div>
      </main>

      {/* Brand Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 py-6 text-center text-[11px] text-slate-400">
        <p>© {new Date().getFullYear()} RTR Mobiles • Wholesale Management System</p>
      </footer>
    </div>
  );
};

export default NotFound;
