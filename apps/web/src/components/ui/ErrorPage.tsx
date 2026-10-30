import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Ban,
  Lock,
  ServerOff,
  ArrowLeft,
  LayoutDashboard,
  LogIn,
  RotateCcw,
  HelpCircle
} from 'lucide-react';

export type HttpStatusCode = 400 | 401 | 403 | 404 | 408 | 409 | 422 | 429 | 500 | 502 | 503 | 504;

export interface ErrorAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  disabled?: boolean;
}

export interface ErrorPageConfig {
  statusCode: HttpStatusCode;
  badge: string;
  title: string;
  description: string;
  guidance?: string;
  category: 'client' | 'auth' | 'permission' | 'notFound' | 'conflict' | 'rateLimit' | 'server' | 'timeout';
  defaultPrimaryActionLabel?: string;
  defaultSecondaryActionLabel?: string;
}

export const ERROR_STATUS_CONFIGS: Record<HttpStatusCode, ErrorPageConfig> = {
  400: {
    statusCode: 400,
    badge: 'HTTP 400 • Bad Request',
    title: 'Bad Request',
    description: 'The request could not be processed because the submitted information is invalid.',
    guidance: 'Please verify that your input data is correctly formatted and try submitting the request again.',
    category: 'client',
    defaultPrimaryActionLabel: 'Try Again',
    defaultSecondaryActionLabel: 'Go Back'
  },
  401: {
    statusCode: 401,
    badge: 'HTTP 401 • Unauthorized',
    title: 'Session Expired',
    description: 'Your session has expired or you need to sign in to continue.',
    guidance: 'To protect your wholesale records and store data, please sign in with your credentials.',
    category: 'auth',
    defaultPrimaryActionLabel: 'Sign In',
    defaultSecondaryActionLabel: 'Return to Home'
  },
  403: {
    statusCode: 403,
    badge: 'HTTP 403 • Forbidden',
    title: 'Access Denied',
    description: "You don't have permission to access this resource.",
    guidance: 'This area is restricted to authorized roles. If you believe this is an error, please contact your system administrator.',
    category: 'permission',
    defaultPrimaryActionLabel: 'Go to Dashboard',
    defaultSecondaryActionLabel: 'Go Back'
  },
  404: {
    statusCode: 404,
    badge: 'Error 404 • Page Not Found',
    title: 'Page Not Found',
    description: "The page you're looking for doesn't exist, may have been moved, or is no longer available.",
    guidance: 'Please double-check the URL or use the navigation links below to return to your wholesale records.',
    category: 'notFound',
    defaultPrimaryActionLabel: 'Go to Dashboard',
    defaultSecondaryActionLabel: 'Go Back'
  },
  408: {
    statusCode: 408,
    badge: 'HTTP 408 • Request Timeout',
    title: 'Request Timed Out',
    description: 'The request took too long to complete.',
    guidance: 'Your network connection may be slow or the server is processing high traffic. Duplicate submissions are automatically prevented.',
    category: 'timeout',
    defaultPrimaryActionLabel: 'Retry Request',
    defaultSecondaryActionLabel: 'Go to Dashboard'
  },
  409: {
    statusCode: 409,
    badge: 'HTTP 409 • Conflict',
    title: 'Request Conflict',
    description: 'This action conflicts with the current state of the record.',
    guidance: 'Another update to this delivery or stock balance occurred concurrently. Please refresh the data before trying again.',
    category: 'conflict',
    defaultPrimaryActionLabel: 'Refresh Data',
    defaultSecondaryActionLabel: 'Review Latest Record'
  },
  422: {
    statusCode: 422,
    badge: 'HTTP 422 • Validation Error',
    title: 'Unable to Process Request',
    description: 'Some submitted information needs correction.',
    guidance: 'One or more fields failed validation checks. Please review your entries and correct any highlighted issues.',
    category: 'client',
    defaultPrimaryActionLabel: 'Review Form',
    defaultSecondaryActionLabel: 'Go Back'
  },
  429: {
    statusCode: 429,
    badge: 'HTTP 429 • Rate Limited',
    title: 'Too Many Attempts',
    description: 'Too many requests have been made. Please wait before trying again.',
    guidance: 'Rate limiting is active to protect system security and prevent automated abuse. Please observe the cooldown timer below.',
    category: 'rateLimit',
    defaultPrimaryActionLabel: 'Retry',
    defaultSecondaryActionLabel: 'Go to Dashboard'
  },
  500: {
    statusCode: 500,
    badge: 'HTTP 500 • Server Error',
    title: 'Something Went Wrong',
    description: 'An unexpected server error occurred.',
    guidance: 'Our operations team has been notified with the diagnostic reference below. Your underlying data remains safe.',
    category: 'server',
    defaultPrimaryActionLabel: 'Try Again',
    defaultSecondaryActionLabel: 'Go to Dashboard'
  },
  502: {
    statusCode: 502,
    badge: 'HTTP 502 • Bad Gateway',
    title: 'Service Temporarily Unavailable',
    description: 'The server received an invalid response from an upstream service.',
    guidance: 'The backend proxy or database gateway was momentarily unreachable. Please retry your request.',
    category: 'server',
    defaultPrimaryActionLabel: 'Retry',
    defaultSecondaryActionLabel: 'Go to Dashboard'
  },
  503: {
    statusCode: 503,
    badge: 'HTTP 503 • Service Unavailable',
    title: 'Temporarily Unavailable',
    description: 'The service is temporarily unavailable. Please try again later.',
    guidance: 'Routine maintenance or capacity optimization is currently in progress. Service will resume shortly.',
    category: 'server',
    defaultPrimaryActionLabel: 'Check Status & Retry',
    defaultSecondaryActionLabel: 'Go to Dashboard'
  },
  504: {
    statusCode: 504,
    badge: 'HTTP 504 • Gateway Timeout',
    title: 'Server Timeout',
    description: 'The server took too long to respond.',
    guidance: 'The upstream service took too long to return a result. Non-idempotent financial transactions are safe and have not been repeated.',
    category: 'timeout',
    defaultPrimaryActionLabel: 'Retry Safely',
    defaultSecondaryActionLabel: 'Go to Dashboard'
  }
};

export interface ErrorPageProps {
  statusCode?: HttpStatusCode | number;
  title?: string;
  description?: string;
  guidance?: string;
  badge?: string;
  correlationId?: string | null;
  invalidPath?: string;
  retryAfterSeconds?: number;
  validationDetails?: Array<{ field?: string; message: string }> | string[];
  primaryAction?: ErrorAction;
  secondaryAction?: ErrorAction;
  tertiaryAction?: ErrorAction;
  onRetry?: () => void;
  onGoBack?: () => void;
  onGoToDashboard?: () => void;
  showHomeButton?: boolean;
  showSearchFallback?: boolean;
  isAuthenticated?: boolean;
}

/**
 * Clean Custom Vector SVG Illustrations tailored for RTR Brand Design System
 */
const ErrorIllustration: React.FC<{
  statusCode: HttpStatusCode;
  category: ErrorPageConfig['category'];
}> = ({ statusCode, category }) => {
  if (statusCode === 404) {
    return (
      <div className="relative w-28 h-28 sm:w-36 sm:h-36 mx-auto flex items-center justify-center">
        {/* Decorative background glow rings */}
        <div className="absolute inset-0 rounded-3xl bg-blue-100/60 blur-xl -rotate-6 transform scale-90" />
        <div className="absolute inset-1 rounded-2xl bg-[#EBF4FF] border border-[#BFDBFE] rotate-3 transition-transform" />
        <div className="relative w-full h-full rounded-2xl bg-gradient-to-b from-white to-[#F0F7FF] border border-[#BFDBFE] flex flex-col items-center justify-center p-4 shadow-sm">
          <svg className="w-16 h-16 sm:w-20 sm:h-20" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            {/* Folder / Document Body */}
            <rect x="18" y="24" width="60" height="52" rx="10" fill="#E2E8F0" />
            <path d="M18 34C18 28.4772 22.4772 24 28 24H44L52 32H68C73.5228 32 78 36.4772 78 42V66C78 71.5228 73.5228 76 68 76H28C22.4772 76 18 71.5228 18 66V34Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Cut / Missing Badge */}
            <circle cx="48" cy="52" r="16" fill="#168BFF" />
            {/* Question Mark */}
            <path d="M44.5 46.5C44.5 44.567 46.067 43 48 43C49.933 43 51.5 44.567 51.5 46.5C51.5 48.2 50.2 49.3 49 50.3C48.2 50.9 48 51.5 48 52.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="48" cy="57" r="1.5" fill="white" />
            {/* 404 Accent Badge */}
            <rect x="56" y="16" width="30" height="16" rx="8" fill="#102A4C" />
            <text x="71" y="27.5" fill="#FFFFFF" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">404</text>
          </svg>
        </div>
      </div>
    );
  }

  // Choose icon based on category
  const renderIcon = () => {
    switch (category) {
      case 'auth':
        return <LogIn className="w-10 h-10 sm:w-12 sm:h-12 text-[#168BFF]" strokeWidth={1.75} />;
      case 'permission':
        return <Lock className="w-10 h-10 sm:w-12 sm:h-12 text-[#EA580C]" strokeWidth={1.75} />;
      case 'conflict':
        return <RotateCcw className="w-10 h-10 sm:w-12 sm:h-12 text-[#D97706]" strokeWidth={1.75} />;
      case 'timeout':
        return <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-[#2563EB]" strokeWidth={1.75} />;
      case 'rateLimit':
        return <Ban className="w-10 h-10 sm:w-12 sm:h-12 text-[#DC2626]" strokeWidth={1.75} />;
      case 'server':
        return <ServerOff className="w-10 h-10 sm:w-12 sm:h-12 text-[#E11D48]" strokeWidth={1.75} />;
      case 'client':
      default:
        return <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-[#2563EB]" strokeWidth={1.75} />;
    }
  };

  const badgeBg =
    category === 'permission' || category === 'rateLimit'
      ? 'bg-red-50 border-red-200 text-red-700'
      : category === 'conflict'
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-blue-50 border-blue-200 text-blue-700';

  return (
    <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6 flex items-center justify-center">
      <div className={`absolute inset-0 rounded-2xl sm:rounded-3xl ${badgeBg} opacity-60 rotate-6 transition-transform`} />
      <div className="relative w-full h-full rounded-2xl sm:rounded-3xl bg-gradient-to-b from-white to-[#F8FAFC] border border-[#DCE4EC] flex items-center justify-center shadow-xs">
        {renderIcon()}
      </div>
    </div>
  );
};

export const ErrorPage: React.FC<ErrorPageProps> = ({
  statusCode: propStatus = 404,
  title: propTitle,
  description: propDesc,
  guidance: propGuidance,
  badge: propBadge,
  correlationId,
  invalidPath,
  retryAfterSeconds: initialCooldown,
  validationDetails,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  onRetry,
  onGoBack,
  onGoToDashboard,
  showHomeButton = true,
  showSearchFallback = true,
  isAuthenticated
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Normalize status code to supported map with 500 fallback
  const validStatusCode: HttpStatusCode = (
    propStatus in ERROR_STATUS_CONFIGS ? propStatus : 500
  ) as HttpStatusCode;

  const config = ERROR_STATUS_CONFIGS[validStatusCode];

  // Effective content resolution
  const title = propTitle || config.title;
  const description = propDesc || config.description;
  const guidance = propGuidance || config.guidance;
  const badgeText = propBadge || config.badge;

  // Determine auth status from prop or localStorage safely
  const isAuthed = useMemo(() => {
    if (typeof isAuthenticated === 'boolean') return isAuthenticated;
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
  }, [isAuthenticated]);

  const dashboardPath = isAuthed ? '/records' : '/login';

  // 429 Countdown timer handling
  const [cooldown, setCooldown] = useState<number>(initialCooldown || 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Safe navigation handlers
  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
      return;
    }
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
      navigate(dashboardPath);
    }
  };

  const handleGoToDashboard = () => {
    if (onGoToDashboard) {
      onGoToDashboard();
      return;
    }
    navigate(dashboardPath);
  };

  const handleRetry = () => {
    if (cooldown > 0) return;
    if (onRetry) {
      onRetry();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Safe path rendering for 404 (sanitized against XSS, truncated if excessively long)
  const safeDisplayPath = useMemo(() => {
    const raw = invalidPath || location.pathname;
    if (!raw || raw === '/') return '';
    // Strip control characters and sanitize
    const clean = raw.replace(/[<>"'`]/g, '');
    return clean.length > 60 ? `${clean.substring(0, 57)}...` : clean;
  }, [invalidPath, location.pathname]);

  // Default button configurations based on HTTP category
  const effectivePrimary: ErrorAction = useMemo(() => {
    if (primaryAction) return primaryAction;

    if (validStatusCode === 401) {
      return {
        label: 'Sign In',
        icon: <LogIn className="w-4 h-4" />,
        onClick: () => navigate('/login'),
        variant: 'primary'
      };
    }

    if (validStatusCode === 429) {
      return {
        label: cooldown > 0 ? `Retry in ${cooldown}s` : 'Retry Now',
        icon: <RefreshCw className={`w-4 h-4 ${cooldown > 0 ? 'animate-spin' : ''}`} />,
        onClick: handleRetry,
        disabled: cooldown > 0,
        variant: 'primary'
      };
    }

    if (config.category === 'timeout' || config.category === 'server') {
      return {
        label: config.defaultPrimaryActionLabel || 'Try Again',
        icon: <RotateCcw className="w-4 h-4" />,
        onClick: handleRetry,
        variant: 'primary'
      };
    }

    if (validStatusCode === 409) {
      return {
        label: 'Refresh Data',
        icon: <RefreshCw className="w-4 h-4" />,
        onClick: handleRetry,
        variant: 'primary'
      };
    }

    // Default: Go to Dashboard
    return {
      label: config.defaultPrimaryActionLabel || 'Go to Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      onClick: handleGoToDashboard,
      variant: 'primary'
    };
  }, [primaryAction, validStatusCode, config, cooldown, navigate]);

  const effectiveSecondary: ErrorAction | null = useMemo(() => {
    if (secondaryAction) return secondaryAction;

    if (validStatusCode === 401) {
      if (!showHomeButton) return null;
      return {
        label: 'Return to Home',
        icon: <ArrowLeft className="w-4 h-4" />,
        onClick: () => navigate('/'),
        variant: 'secondary'
      };
    }

    return {
      label: config.defaultSecondaryActionLabel || 'Go Back',
      icon: <ArrowLeft className="w-4 h-4" />,
      onClick: handleGoBack,
      variant: 'secondary'
    };
  }, [secondaryAction, validStatusCode, config, showHomeButton, navigate]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between font-sans text-[#102A4C] selection:bg-[#168BFF]/20 animate-fade-in"
    >
      {/* Brand Header */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between border-b border-[#E2E8F0]/60 sm:border-transparent">
        <Link
          to={dashboardPath}
          className="flex items-center gap-3 group transition-opacity hover:opacity-90 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#168BFF] rounded-xl p-1"
          aria-label="RTR Mobiles Wholesale Management"
        >
          <div className="w-10 h-10 rounded-xl bg-[#102A4C] p-1.5 flex items-center justify-center shadow-xs border border-slate-700/60">
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
            <span className="text-sm font-extrabold tracking-tight text-[#102A4C] group-hover:text-[#168BFF] transition-colors">
              RTR Mobiles
            </span>
            <span className="text-[11px] font-medium text-[#738499] -mt-0.5">
              Wholesale Management System
            </span>
          </div>
        </Link>

        {isAuthed && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#EBF4FF] text-[#168BFF] border border-[#BFDBFE]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#168BFF] animate-pulse" />
            <span>Workspace Active</span>
          </span>
        )}
      </header>

      {/* Main Card Content */}
      <main className="w-full max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-10 my-auto">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DCE4EC] shadow-sm p-6 sm:p-10 text-center relative overflow-hidden">
          {/* Subtle top accent band */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#102A4C] via-[#168BFF] to-[#102A4C]" />

          {/* Icon or SVG Illustration */}
          <ErrorIllustration statusCode={validStatusCode} category={config.category} />

          {/* Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider text-[#168BFF] bg-[#EBF4FF] border border-[#BFDBFE] uppercase mb-3">
            <span>{badgeText}</span>
          </div>

          {/* Title & Description */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102A4C] tracking-tight">
            {title}
          </h1>

          <p className="mt-2.5 text-xs sm:text-sm text-[#5A6E85] max-w-sm mx-auto leading-relaxed">
            {description}
          </p>

          {/* Safe Invalid Path Display for 404 */}
          {validStatusCode === 404 && safeDisplayPath && (
            <div className="mt-3.5 inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] text-xs text-[#475569] font-mono break-all select-all">
              <span className="text-[#94A3B8] font-bold">Path:</span>
              <span>{safeDisplayPath}</span>
            </div>
          )}

          {/* Helpful Guidance or Diagnostic Context */}
          {guidance && (
            <div className="mt-4 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]/80 text-left text-xs text-[#5A6E85] leading-relaxed">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-[#168BFF] shrink-0 mt-0.5" />
                <span>{guidance}</span>
              </div>
            </div>
          )}

          {/* Validation Details List for 422 / 400 */}
          {validationDetails && validationDetails.length > 0 && (
            <div className="mt-4 text-left p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs">
              <p className="font-semibold text-amber-900 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Validation items requiring attention:</span>
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-800">
                {validationDetails.map((item, idx) => (
                  <li key={idx}>
                    {typeof item === 'string' ? item : `${item.field ? `${item.field}: ` : ''}${item.message}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rate Limiting Cooldown Badge for 429 */}
          {validStatusCode === 429 && cooldown > 0 && (
            <div className="mt-4 py-2 px-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 animate-spin text-red-600" />
              <span>Cooldown active: Please wait {cooldown} seconds</span>
            </div>
          )}

          {/* Non-sensitive Correlation / Support Reference for 5xx */}
          {correlationId && (
            <div className="mt-4 py-1.5 px-3 bg-[#F1F5F9] rounded-lg inline-block border border-[#E2E8F0]">
              <p className="text-[11px] text-[#64748B] font-mono tracking-wide select-all">
                Support Ref: <span className="text-[#102A4C] font-semibold">{correlationId}</span>
              </p>
            </div>
          )}

          {/* Primary & Secondary Action Buttons */}
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
            {effectiveSecondary && (
              <button
                type="button"
                onClick={effectiveSecondary.onClick}
                disabled={effectiveSecondary.disabled}
                className="w-full sm:w-auto min-w-[130px] min-h-[44px] border border-[#DCE4EC] hover:border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#334155] font-semibold rounded-xl px-4 py-2.5 text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {effectiveSecondary.icon}
                <span>{effectiveSecondary.label}</span>
              </button>
            )}

            {effectivePrimary && (
              <button
                type="button"
                onClick={effectivePrimary.onClick}
                disabled={effectivePrimary.disabled}
                className="w-full sm:w-auto min-w-[150px] min-h-[44px] bg-[#168BFF] hover:bg-[#0E7BE5] active:bg-[#0766C2] text-white font-semibold rounded-xl px-5 py-2.5 text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {effectivePrimary.icon}
                <span>{effectivePrimary.label}</span>
                {validStatusCode === 404 && <span className="sr-only">Back to Records</span>}
              </button>
            )}
          </div>

          {/* Tertiary Quick Navigation for 404 & general errors */}
          {validStatusCode === 404 && showSearchFallback && (
            <div className="mt-6 pt-5 border-t border-[#E2E8F0] flex flex-wrap items-center justify-center gap-2 text-xs text-[#5A6E85]">
              <span>Quick links:</span>
              <Link
                to="/records"
                className="text-[#168BFF] hover:text-[#0E7BE5] font-semibold underline underline-offset-2 cursor-pointer p-1"
              >
                Records Ledger
              </Link>
              <span>•</span>
              <Link
                to="/settings"
                className="text-[#168BFF] hover:text-[#0E7BE5] font-semibold underline underline-offset-2 cursor-pointer p-1"
              >
                Settings
              </Link>
              <span>•</span>
              <Link
                to="/login"
                className="text-[#168BFF] hover:text-[#0E7BE5] font-semibold underline underline-offset-2 cursor-pointer p-1"
              >
                Sign In
              </Link>
            </div>
          )}

          {tertiaryAction && (
            <div className="mt-4">
              <button
                type="button"
                onClick={tertiaryAction.onClick}
                className="text-xs font-semibold text-[#168BFF] hover:underline cursor-pointer"
              >
                {tertiaryAction.label}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Brand Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 py-5 text-center text-[11px] text-[#8A9BAE] border-t border-[#E2E8F0]/40">
        <p>© {new Date().getFullYear()} RTR Mobiles • Production Wholesale Management System</p>
      </footer>
    </div>
  );
};

export default ErrorPage;
