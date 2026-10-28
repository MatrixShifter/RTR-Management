import React, { useState, useRef } from 'react';
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  AlertCircle, 
  Sparkles, 
  Check, 
  Copy, 
  ShieldCheck 
} from 'lucide-react';
import { 
  signIn, 
  getRememberedUsername, 
  setRememberedUsername, 
  INCORRECT_CREDENTIALS_MSG,
  DEMO_USERNAME,
  DEMO_PASSWORD_PLACEHOLDER,
  type AuthUser 
} from '../../services/auth.js';

interface LoginProps {
  initialTab?: 'owner' | 'demo';
  onLoginSuccess: (user: AuthUser) => void;
  onNavigateToForgot?: () => void;
}

export const Login: React.FC<LoginProps> = ({ 
  initialTab = 'owner',
  onLoginSuccess, 
  onNavigateToForgot 
}) => {
  const [activeTab, setActiveTab] = useState<'owner' | 'demo'>(initialTab);
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

  // Demo Sandbox Form State
  const [demoUsername, setDemoUsername] = useState(DEMO_USERNAME);
  const [demoPassword, setDemoPassword] = useState(DEMO_PASSWORD_PLACEHOLDER);
  const [showDemoPassword, setShowDemoPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = (text: string, field: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const user = await signIn(username, password);
      // Save or clear remembered username preference
      setRememberedUsername(username, rememberMe);
      onLoginSuccess(user);
    } catch (err: any) {
      const message = err?.message || INCORRECT_CREDENTIALS_MSG;
      setErrorMsg(message);

      // Keep username entered, clear password, and refocus password input
      setPassword('');
      if (passwordInputRef.current) {
        passwordInputRef.current.focus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const user = await signIn(demoUsername, demoPassword);
      onLoginSuccess(user);
    } catch (err: any) {
      const message = err?.message || INCORRECT_CREDENTIALS_MSG;
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Header */}
        <div className="w-14 h-14 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-black text-xl mx-auto shadow-md border border-slate-700 tracking-tight">
          RTR
        </div>
        <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          RTR Wholesale Management
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          Owner Portal &bull; Mobile Accessories Distribution &amp; Settlement Ledger
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200/90 rounded-2xl">
          {/* Option Selector: Business Owner Login vs Try Demo */}
          <div className="flex border-b border-slate-200 mb-6" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'owner'}
              onClick={() => { setActiveTab('owner'); setErrorMsg(null); }}
              className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 text-center transition-colors cursor-pointer ${
                activeTab === 'owner'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Business Owner Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'demo'}
              onClick={() => { setActiveTab('demo'); setErrorMsg(null); }}
              className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'demo'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Try Demo</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-md bg-amber-100 text-amber-800">
                Sandbox
              </span>
            </button>
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

          {activeTab === 'owner' ? (
            /* ========================================================
               1. BUSINESS OWNER LOGIN FORM
               ======================================================== */
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
                  className="w-full bg-[#2563EB] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
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

              {/* Presentation / Demo Teaser */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2.5 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-slate-600">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Presenting to a client?</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('demo'); setErrorMsg(null); }}
                    className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    Try Demo &rarr;
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-2.5 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span>Demo User: <code className="font-mono text-slate-800 font-bold">{DEMO_USERNAME}</code></span>
                  <span className="text-[10px] text-slate-400">Password: <code className="font-mono text-slate-600">{DEMO_PASSWORD_PLACEHOLDER}</code></span>
                </div>
              </div>
            </form>
          ) : (
            /* ========================================================
               2. TRY DEMO / PRESENTATION SANDBOX PANEL
               ======================================================== */
            <div className="space-y-4">
              {/* Credentials Panel */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl shadow-xs border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Demo Credentials
                    </span>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                    Isolated Sandbox
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-medium">Username</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <code className="text-emerald-400 font-mono font-bold text-xs">{DEMO_USERNAME}</code>
                      <button
                        type="button"
                        onClick={() => handleCopy(DEMO_USERNAME, 'user')}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                        title="Copy demo username"
                      >
                        {copiedField === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-medium">Password</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <code className="text-emerald-400 font-mono font-bold text-xs truncate max-w-[125px]" title={DEMO_PASSWORD_PLACEHOLDER}>
                        {DEMO_PASSWORD_PLACEHOLDER}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(DEMO_PASSWORD_PLACEHOLDER, 'pass')}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                        title="Copy demo password"
                      >
                        {copiedField === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-snug">
                  Configured for client showcase. Restricts all operations to disposable sandbox storage; real customer shops and financial records remain untouched.
                </p>
              </div>

              {/* Demo Sign In Form */}
              <form onSubmit={handleDemoSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="demo-username-input" className="block text-xs font-semibold text-slate-700">
                    Demo Username
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="demo-username-input"
                      name="demo-username"
                      type="text"
                      value={demoUsername}
                      onChange={e => setDemoUsername(e.target.value)}
                      required
                      disabled={isLoading}
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="demo-password-input" className="block text-xs font-semibold text-slate-700">
                    Demo Password
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="demo-password-input"
                      name="demo-password"
                      type={showDemoPassword ? 'text' : 'password'}
                      value={demoPassword}
                      onChange={e => setDemoPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDemoPassword(prev => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                      aria-label={showDemoPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showDemoPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || !demoUsername.trim() || !demoPassword}
                    className="w-full bg-[#0F172A] hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Launching Demo Sandbox...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Explore Demo Sandbox</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Security badge footer */}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Protected by Supabase Auth with Row Level Security &bull; RTR Wholesale
        </p>
      </div>
    </div>
  );
};
