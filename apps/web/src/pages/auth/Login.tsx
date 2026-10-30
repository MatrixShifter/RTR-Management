import React, { useState, useRef } from 'react';
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  AlertCircle, 
  Check 
} from 'lucide-react';
import { 
  getRememberedUsername, 
  setRememberedUsername 
} from '../../services/rememberUsername.js';
import { type AuthUser, signIn } from '../../services/auth.js';

const INCORRECT_CREDENTIALS_MSG = "Incorrect username or password. Please try again.";

interface LoginProps {
  onLoginSuccess: (user: AuthUser) => void;
  onNavigateToForgot?: () => void;
  // Kept for backwards compatibility with tests and callers
  initialTab?: string;
}

export const Login: React.FC<LoginProps> = ({ 
  onLoginSuccess, 
  onNavigateToForgot 
}) => {
  const [username, setUsername] = useState(() => getRememberedUsername());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(getRememberedUsername()));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset') === 'success') {
        return 'Password reset successfully! Please sign in with your new password.';
      }
    }
    return null;
  });

  const passwordInputRef = useRef<HTMLInputElement>(null);

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const user = await signIn(username, password);
      setRememberedUsername(username, rememberMe);
      onLoginSuccess(user);
    } catch (err: any) {
      const message = err?.message || INCORRECT_CREDENTIALS_MSG;
      setErrorMsg(message);

      // Clear password and refocus
      setPassword('');
      if (passwordInputRef.current) {
        passwordInputRef.current.focus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Header */}
        <div className="w-20 h-16 sm:w-24 sm:h-20 rounded-2xl bg-[#0C1E38] p-2 flex items-center justify-center mx-auto shadow-md border border-slate-700/60 tracking-tight">
          <img
            src="/rtr-logo.png"
            alt="RTR Mobiles logo"
            className="w-full h-full object-contain drop-shadow-sm"
            width="96"
            height="80"
            loading="eager"
          />
        </div>
        <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          RTR Wholesale Management
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          Owner Portal &bull; Mobile Accessories Distribution &amp; Settlement Ledger
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 sm:py-8 px-4 sm:px-10 shadow-sm border border-slate-200/90 rounded-2xl">
          <div className="mb-6 pb-3 border-b border-slate-100">
            <h2 className="text-base sm:text-lg font-bold text-[#102A4C]">
              Business Owner Sign In
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your credentials to access your wholesale records
            </p>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div 
              role="status" 
              className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs animate-fade-in font-medium"
            >
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div 
              role="alert" 
              className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs animate-fade-in font-medium"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* Business Owner Login Form */}
          <form className="space-y-4 sm:space-y-5" onSubmit={handleOwnerSubmit} noValidate>
            {/* Username Field */}
            <div className="space-y-1">
              <label htmlFor="username-input" className="block text-xs font-semibold text-slate-700">
                Username or Email
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username-input"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Enter your username or email"
                  required
                  disabled={isLoading}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="password-input" className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                {onNavigateToForgot ? (
                  <button
                    type="button"
                    onClick={onNavigateToForgot}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer focus:outline-none"
                  >
                    Forgot Password?
                  </button>
                ) : (
                  <a
                    href="/forgot-password"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </a>
                )}
              </div>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  ref={passwordInputRef}
                  id="password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="••••••••••••"
                  required
                  disabled={isLoading}
                  className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-xs text-slate-600 font-medium">Remember my username</span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || !username.trim() || !password}
                className="w-full bg-[#168BFF] hover:bg-[#0E7BE5] active:bg-[#0766C2] disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security badge footer */}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Protected by Supabase Auth with Row Level Security &bull; RTR Wholesale
        </p>
      </div>
    </div>
  );
};

export default Login;
