import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  AlertCircle, 
  Check,
  Mail,
  ShieldCheck,
  Store,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import { 
  getRememberedUsername, 
  setRememberedUsername 
} from '../../services/rememberUsername.js';
import { 
  type AuthUser, 
  signIn, 
  requestEmployeeOtp, 
  verifyEmployeeOtp,
  EMPLOYEE_OTP_CONFIRMATION_MSG,
  INVALID_OTP_MSG
} from '../../services/auth.js';

const INCORRECT_CREDENTIALS_MSG = "Incorrect username or password. Please try again.";

interface LoginProps {
  onLoginSuccess: (user: AuthUser) => void;
  onNavigateToForgot?: () => void;
  initialTab?: 'owner' | 'employee' | string;
}

export const Login: React.FC<LoginProps> = ({ 
  onLoginSuccess, 
  onNavigateToForgot,
  initialTab
}) => {
  const [activeTab, setActiveTab] = useState<'owner' | 'employee'>(() => {
    return initialTab === 'employee' ? 'employee' : 'owner';
  });

  // Owner Login state
  const [username, setUsername] = useState(() => getRememberedUsername());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(getRememberedUsername()));

  // Employee Passwordless Login state
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status & Feedback
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
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Resend cooldown timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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

  const handleEmployeeRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = employeeEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMsg('Please enter a valid employee email address.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const msg = await requestEmployeeOtp(cleanEmail);
      setOtpSent(true);
      setResendCooldown(60);
      setSuccessMsg(msg || EMPLOYEE_OTP_CONFIRMATION_MSG);
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = employeeEmail.trim().toLowerCase();
    const cleanToken = otpToken.trim();

    if (!cleanToken) {
      setErrorMsg('Please enter the verification code.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const user = await verifyEmployeeOtp(cleanEmail, cleanToken);
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(err?.message || INVALID_OTP_MSG);
      setOtpToken('');
      if (otpInputRef.current) {
        otpInputRef.current.focus();
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
          Welcome to RTR Wholesale Management
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          Sign in to access your workspace.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 sm:py-8 px-4 sm:px-10 shadow-sm border border-slate-200/90 rounded-2xl">
          {/* Two-Tab Navigation */}
          <div className="flex border-b border-slate-200 mb-6" role="tablist" aria-label="Login options">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'owner'}
              aria-controls="owner-login-panel"
              id="owner-tab"
              onClick={() => {
                setActiveTab('owner');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'owner'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Owner Login</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'employee'}
              aria-controls="employee-login-panel"
              id="employee-tab"
              onClick={() => {
                setActiveTab('employee');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'employee'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Employee Login</span>
            </button>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div 
              role="status" 
              className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs animate-fade-in font-medium"
            >
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div 
              role="alert" 
              className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs animate-fade-in font-medium"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* 1. Business Owner Login Panel */}
          {activeTab === 'owner' && (
            <div role="tabpanel" id="owner-login-panel" aria-labelledby="owner-tab">
              <div className="mb-5 pb-2">
                <h2 className="text-sm font-bold text-[#102A4C]">
                  Business Owner Sign In
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your email or username and password
                </p>
              </div>

              <form className="space-y-4 sm:space-y-5" onSubmit={handleOwnerSubmit} noValidate>
                {/* Username / Email Field */}
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
          )}

          {/* 2. Shop Employee Passwordless Login Panel */}
          {activeTab === 'employee' && (
            <div role="tabpanel" id="employee-login-panel" aria-labelledby="employee-tab">
              <div className="mb-5 pb-2">
                <h2 className="text-sm font-bold text-[#102A4C]">
                  Shop Employee Passwordless Login
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign in securely with your assigned email and a one-time code
                </p>
              </div>

              {!otpSent ? (
                /* Step 1: Email Entry */
                <form className="space-y-4 sm:space-y-5" onSubmit={handleEmployeeRequestOtp} noValidate>
                  <div className="space-y-1">
                    <label htmlFor="employee-email-input" className="block text-xs font-semibold text-slate-700">
                      Assigned Employee Email
                    </label>
                    <div className="relative rounded-xl shadow-2xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="employee-email-input"
                        name="employeeEmail"
                        type="email"
                        autoComplete="email"
                        value={employeeEmail}
                        onChange={e => {
                          setEmployeeEmail(e.target.value);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        placeholder="employee@rtrmobiles.com"
                        required
                        disabled={isLoading}
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 pt-0.5">
                      Enter your assigned employee email. We will send a secure verification code to your inbox.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading || !employeeEmail.trim()}
                      className="w-full bg-[#168BFF] hover:bg-[#0E7BE5] active:bg-[#0766C2] disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Sending Code...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          <span>Send Verification Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Step 2: Verification Code (OTP) Entry */
                <form className="space-y-4 sm:space-y-5" onSubmit={handleEmployeeVerifyOtp} noValidate>
                  {/* Email summary badge with change option */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div className="flex items-center gap-2 text-slate-700 truncate">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium truncate">{employeeEmail}</span>
                    </div>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setOtpSent(false);
                        setOtpToken('');
                        setErrorMsg(null);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline shrink-0 ml-2 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="otp-input" className="block text-xs font-semibold text-slate-700">
                      Verification Code
                    </label>
                    <div className="relative rounded-xl shadow-2xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        ref={otpInputRef}
                        id="otp-input"
                        name="otpToken"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otpToken}
                        onChange={e => {
                          setOtpToken(e.target.value);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        placeholder="000000"
                        required
                        disabled={isLoading}
                        className="w-full pl-9 pr-3.5 py-2.5 text-center text-sm font-semibold tracking-widest bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 pt-0.5">
                      Enter the 6-digit verification code received in your email.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading || !otpToken.trim()}
                      className="w-full bg-[#168BFF] hover:bg-[#0E7BE5] active:bg-[#0766C2] disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Verifying Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify &amp; Sign In</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Resend Cooldown Option */}
                  <div className="text-center pt-1">
                    {resendCooldown > 0 ? (
                      <span className="text-xs text-slate-400 font-medium">
                        Resend code in {resendCooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleEmployeeRequestOtp()}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Resend verification code</span>
                      </button>
                    )}
                  </div>
                </form>
              )}
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

export default Login;
