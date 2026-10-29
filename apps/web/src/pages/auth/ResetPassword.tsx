import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, ShieldAlert, KeyRound } from 'lucide-react';
import { updatePassword, resolveLoginEmail } from '../../services/auth.js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';

interface ResetPasswordProps {
  onNavigateToLogin?: () => void;
  onNavigateToForgot?: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ 
  onNavigateToLogin, 
  onNavigateToForgot 
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [hasValidRecoverySession, setHasValidRecoverySession] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual OTP verification state (solves email link scanner prefetch)
  const [otpEmail, setOtpEmail] = useState('vinov042007@gmail.com');
  const [otpToken, setOtpToken] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [showOtpForm, setShowOtpForm] = useState(false);

  // Guard against duplicate code/token redemptions across concurrent React effects
  const hasAttemptedExchangeRef = useRef(false);

  // Validate recovery token / session on mount across PKCE, token_hash, and hash flows
  useEffect(() => {
    let isMounted = true;

    async function checkRecoverySession() {
      try {
        setIsVerifyingSession(true);
        setErrorMsg(null);

        if (!isSupabaseConfigured || !supabase) {
          if (isMounted) {
            setHasValidRecoverySession(false);
            setIsVerifyingSession(false);
          }
          return;
        }

        // 1. Check existing active Supabase session first
        // If client's internal URL detector already verified the token/code, accept it immediately
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession?.user) {
          if (isMounted) {
            setHasValidRecoverySession(true);
            setIsVerifyingSession(false);
          }
          return;
        }

        // Parse both query parameters (?code=...) and hash fragment parameters (#access_token=...)
        const searchParams = new URLSearchParams(window.location.search);
        const hashStr = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
        const hashParams = new URLSearchParams(hashStr);

        // 2. Check for error parameters in either URL query or hash fragment (e.g. expired link from Supabase)
        const errorDesc = hashParams.get('error_description') ||
                          searchParams.get('error_description') ||
                          hashParams.get('error') ||
                          searchParams.get('error');
        const errorCode = hashParams.get('error_code') || searchParams.get('error_code');

        if (errorDesc || errorCode) {
          if (isMounted) {
            const raw = errorDesc || errorCode || '';
            const decoded = decodeURIComponent(raw).replace(/\+/g, ' ');
            const isExpired = errorCode === 'otp_expired' || 
                              decoded.toLowerCase().includes('expired') || 
                              decoded.toLowerCase().includes('invalid');
            setErrorMsg(
              isExpired
                ? 'The password reset link is invalid or has expired. If you received a 6-digit recovery code in your email, enter it below, or request a fresh link.'
                : decoded
            );
            if (isExpired) {
              setShowOtpForm(true);
            }
            setHasValidRecoverySession(false);
            setIsVerifyingSession(false);
          }
          return;
        }

        // 3. Handle PKCE authorization code in query string: ?code=...
        const code = searchParams.get('code');
        if (code) {
          if (!hasAttemptedExchangeRef.current) {
            hasAttemptedExchangeRef.current = true;
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              // Re-check getSession in case Supabase's internal client listener already exchanged it
              const { data: { session: postSession } } = await supabase.auth.getSession();
              if (postSession?.user) {
                window.history.replaceState({}, document.title, window.location.pathname);
                if (isMounted) {
                  setHasValidRecoverySession(true);
                  setIsVerifyingSession(false);
                }
                return;
              }

              if (process.env.NODE_ENV !== 'production') {
                console.warn('[Recovery Session Error]', 'PKCE exchange was unsuccessful');
              }
              if (isMounted) {
                setErrorMsg(error.message || 'The password reset link is invalid or has expired.');
                setShowOtpForm(true);
                setHasValidRecoverySession(false);
                setIsVerifyingSession(false);
              }
              return;
            }

            if (data.session) {
              window.history.replaceState({}, document.title, window.location.pathname);
              if (isMounted) {
                setHasValidRecoverySession(true);
                setIsVerifyingSession(false);
              }
              return;
            }
          }
        }

        // 4. Handle Token Hash query string: ?token_hash=...&type=recovery
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type') || hashParams.get('type');
        if (tokenHash && type === 'recovery') {
          if (!hasAttemptedExchangeRef.current) {
            hasAttemptedExchangeRef.current = true;
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'recovery'
            });

            if (error) {
              const { data: { session: postSession } } = await supabase.auth.getSession();
              if (postSession?.user) {
                window.history.replaceState({}, document.title, window.location.pathname);
                if (isMounted) {
                  setHasValidRecoverySession(true);
                  setIsVerifyingSession(false);
                }
                return;
              }

              if (process.env.NODE_ENV !== 'production') {
                console.warn('[Recovery Session Error]', 'OTP token hash verification was unsuccessful');
              }
              if (isMounted) {
                setErrorMsg(error.message || 'The password reset link is invalid or has expired.');
                setShowOtpForm(true);
                setHasValidRecoverySession(false);
                setIsVerifyingSession(false);
              }
              return;
            }

            if (data.session) {
              window.history.replaceState({}, document.title, window.location.pathname);
              if (isMounted) {
                setHasValidRecoverySession(true);
                setIsVerifyingSession(false);
              }
              return;
            }
          }
        }

        // 5. Handle URL hash fragment tokens (Implicit flow): #access_token=...&refresh_token=...
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          if (!hasAttemptedExchangeRef.current) {
            hasAttemptedExchangeRef.current = true;
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (error) {
              const { data: { session: postSession } } = await supabase.auth.getSession();
              if (postSession?.user) {
                window.history.replaceState({}, document.title, window.location.pathname);
                if (isMounted) {
                  setHasValidRecoverySession(true);
                  setIsVerifyingSession(false);
                }
                return;
              }

              if (process.env.NODE_ENV !== 'production') {
                console.warn('[Recovery Session Error]', 'Session initialization was unsuccessful');
              }
              if (isMounted) {
                setErrorMsg(error.message || 'The password reset link is invalid or has expired.');
                setShowOtpForm(true);
                setHasValidRecoverySession(false);
                setIsVerifyingSession(false);
              }
              return;
            }

            if (data.session) {
              window.history.replaceState({}, document.title, window.location.pathname);
              if (isMounted) {
                setHasValidRecoverySession(true);
                setIsVerifyingSession(false);
              }
              return;
            }
          }
        }

        // 6. Final session check
        const { data: { session: finalCheck } } = await supabase.auth.getSession();
        if (finalCheck?.user) {
          if (isMounted) {
            setHasValidRecoverySession(true);
            setIsVerifyingSession(false);
          }
          return;
        }

        if (isMounted) {
          setHasValidRecoverySession(false);
          setIsVerifyingSession(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err?.message || 'Failed to verify password recovery session.');
          setHasValidRecoverySession(false);
          setIsVerifyingSession(false);
        }
      }
    }

    checkRecoverySession();

    // Listen to Supabase auth state changes for PASSWORD_RECOVERY or SIGNED_IN events
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          setHasValidRecoverySession(true);
          setIsVerifyingSession(false);
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const cleanInput = otpEmail.trim();
    const resolvedEmail = resolveLoginEmail(cleanInput) || cleanInput;
    const cleanToken = otpToken.trim().replace(/\s+/g, '');

    if (!resolvedEmail || !cleanToken) {
      setOtpError('Please enter your registered username or email and the 6-digit recovery code.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setOtpError('Authentication service is not configured.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: resolvedEmail,
        token: cleanToken,
        type: 'recovery'
      });

      if (error || !data.session) {
        setOtpError(error?.message || 'Invalid or expired recovery code. Please check your email or request a fresh link.');
      } else {
        setHasValidRecoverySession(true);
        setErrorMsg(null);
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Failed to verify recovery code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Password requirements: minimum 8 characters
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(password);
      setPassword('');
      setConfirmPassword('');
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update password. Your recovery link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
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
          Create New Password
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          Set a strong, secure password for your RTR Business Owner account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 sm:py-8 px-4 sm:px-10 shadow-sm border border-slate-200/90 rounded-2xl">
          {isVerifyingSession ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Verifying secure recovery link...</p>
            </div>
          ) : isSuccess ? (
            /* Success State */
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Password Reset Successfully
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your new password is now active. You can safely sign in with your updated credentials.
                </p>
              </div>
              <div className="pt-3">
                {onNavigateToLogin ? (
                  <button
                    type="button"
                    onClick={onNavigateToLogin}
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Sign In With New Password</span>
                  </button>
                ) : (
                  <a
                    href="/login?reset=success"
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Sign In With New Password</span>
                  </a>
                )}
              </div>
            </div>
          ) : !hasValidRecoverySession ? (
            /* Expired / Invalid Link State or Manual OTP verification */
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Invalid or Expired Recovery Link
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
                  {errorMsg || 'This recovery link is invalid, has already been used, or has expired.'}
                </p>
              </div>

              {/* 6-Digit Code Fallback Form */}
              {showOtpForm ? (
                <form className="mt-4 pt-4 border-t border-slate-100 text-left space-y-3.5" onSubmit={handleVerifyOtp} noValidate>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    <span>Enter 6-Digit Recovery Code</span>
                  </div>

                  {otpError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                      {otpError}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="otp-email-input" className="block text-[11px] font-medium text-slate-600">
                      Registered Email or Username
                    </label>
                    <input
                      id="otp-email-input"
                      type="text"
                      value={otpEmail}
                      onChange={e => setOtpEmail(e.target.value)}
                      placeholder="e.g. vinov042007@gmail.com or owner"
                      required
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="otp-token-input" className="block text-[11px] font-medium text-slate-600">
                      6-Digit Code from Email
                    </label>
                    <input
                      id="otp-token-input"
                      type="text"
                      maxLength={8}
                      value={otpToken}
                      onChange={e => setOtpToken(e.target.value)}
                      placeholder="123456"
                      required
                      className="w-full px-3 py-2 text-center text-sm font-bold tracking-widest bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifyingOtp || !otpToken.trim() || !otpEmail.trim()}
                    className="w-full bg-[#2563EB] hover:bg-blue-700 disabled:bg-slate-300 text-white py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <span>Verify Code &amp; Reset Password</span>
                    )}
                  </button>
                </form>
              ) : (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowOtpForm(true)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Have a 6-digit recovery code from your email?</span>
                  </button>
                </div>
              )}

              <div className="pt-2 space-y-2.5">
                {onNavigateToForgot ? (
                  <button
                    type="button"
                    onClick={onNavigateToForgot}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Request New Recovery Link</span>
                  </button>
                ) : (
                  <a
                    href="/forgot-password"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Request New Recovery Link</span>
                  </a>
                )}
                <div>
                  {onNavigateToLogin ? (
                    <button
                      type="button"
                      onClick={onNavigateToLogin}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 mx-auto hover:underline cursor-pointer focus:outline-none pt-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
                    </button>
                  ) : (
                    <a
                      href="/login"
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center justify-center gap-1.5 hover:underline cursor-pointer pt-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Active Password Reset Form */
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                  <span className="font-medium leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {/* 1. New Password */}
              <div className="space-y-1">
                <label htmlFor="new-password-input" className="block text-xs font-semibold text-slate-700">
                  New Password
                </label>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="new-password-input"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Minimum 8 characters"
                    required
                    disabled={isLoading}
                    autoFocus
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 2. Confirm New Password */}
              <div className="space-y-1">
                <label htmlFor="confirm-password-input" className="block text-xs font-semibold text-slate-700">
                  Confirm New Password
                </label>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirm-password-input"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Re-enter new password"
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Requirement Hint */}
              <div className="text-[11px] text-slate-500 space-y-1 pt-1">
                <p className="flex items-center gap-1.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${password.length >= 8 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span>Must be at least 8 characters long</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${confirmPassword && password === confirmPassword ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span>Both passwords must match</span>
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={isLoading || password.length < 8 || password !== confirmPassword}
                  className="w-full bg-[#2563EB] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Set New Password</span>
                  )}
                </button>

                <div className="text-center">
                  {onNavigateToLogin ? (
                    <button
                      type="button"
                      onClick={onNavigateToLogin}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 mx-auto hover:underline cursor-pointer focus:outline-none"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Cancel &amp; Return to Sign In</span>
                    </button>
                  ) : (
                    <a
                      href="/login"
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center justify-center gap-1.5 hover:underline cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Cancel &amp; Return to Sign In</span>
                    </a>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
