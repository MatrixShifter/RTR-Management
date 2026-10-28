import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { updatePassword } from '../../services/auth.js';
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

        // 1. Check for error parameters in URL (e.g. expired link from Supabase)
        const urlParams = new URLSearchParams(window.location.search);
        const errorDesc = urlParams.get('error_description') || urlParams.get('error');
        if (errorDesc) {
          if (isMounted) {
            setErrorMsg(decodeURIComponent(errorDesc).replace(/\+/g, ' '));
            setHasValidRecoverySession(false);
            setIsVerifyingSession(false);
          }
          return;
        }

        // 2. Handle PKCE authorization code in query string: ?code=...
        const code = urlParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.warn('[Recovery PKCE Exchange Error]', error.message);
            if (isMounted) {
              setErrorMsg(error.message || 'The password reset link is invalid or has expired.');
              setHasValidRecoverySession(false);
              setIsVerifyingSession(false);
            }
            return;
          }
          if (data.session) {
            // Clean URL query parameters to avoid duplicate code redemption on refresh
            window.history.replaceState({}, document.title, window.location.pathname);
            if (isMounted) {
              setHasValidRecoverySession(true);
              setIsVerifyingSession(false);
            }
            return;
          }
        }

        // 3. Handle Token Hash / OTP query string: ?token_hash=...&type=recovery
        const tokenHash = urlParams.get('token_hash');
        const type = urlParams.get('type');
        if (tokenHash && type === 'recovery') {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery'
          });
          if (error) {
            console.warn('[Recovery OTP Verification Error]', error.message);
            if (isMounted) {
              setErrorMsg(error.message || 'The password reset link is invalid or has expired.');
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

        // 4. Check URL hash fragment (Implicit flow): #access_token=...&type=recovery
        const hash = window.location.hash || '';
        if (hash.includes('access_token=') || hash.includes('type=recovery')) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            if (isMounted) {
              setHasValidRecoverySession(true);
              setIsVerifyingSession(false);
            }
            return;
          }
        }

        // 5. Check existing active Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (isMounted) {
            setHasValidRecoverySession(true);
            setIsVerifyingSession(false);
          }
          return;
        }

        // If none of the above resulted in an active recovery session
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
        <div className="w-14 h-14 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-black text-xl mx-auto shadow-md border border-slate-700 tracking-tight">
          RTR
        </div>
        <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Create New Password
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          Set a strong, secure password for your RTR Business Owner account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200/90 rounded-2xl">
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
            /* Expired / Invalid Link State */
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Invalid or Expired Recovery Link
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
                  {errorMsg || 'This recovery link is invalid, has already been used, or has expired. Please request a new password reset.'}
                </p>
              </div>
              <div className="pt-2 space-y-2.5">
                {onNavigateToForgot ? (
                  <button
                    type="button"
                    onClick={onNavigateToForgot}
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Request New Recovery Link</span>
                  </button>
                ) : (
                  <a
                    href="/forgot-password"
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
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
