import React, { useState } from 'react';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { requestPasswordReset, RECOVERY_CONFIRMATION_MSG } from '../../services/auth.js';

interface ForgotPasswordProps {
  onNavigateToLogin?: () => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigateToLogin }) => {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setIsLoading(true);
    try {
      const msg = await requestPasswordReset(identifier);
      setFeedbackMsg(msg || RECOVERY_CONFIRMATION_MSG);
      setIsSubmitted(true);
    } catch {
      // Regardless of error, display neutral confirmation to avoid enumeration
      setFeedbackMsg(RECOVERY_CONFIRMATION_MSG);
      setIsSubmitted(true);
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
          Reset Your Password
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          Enter your registered username or email address to recover your account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200/90 rounded-2xl">
          {isSubmitted ? (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Recovery Request Submitted
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {feedbackMsg || RECOVERY_CONFIRMATION_MSG}
                </p>
              </div>
              <p className="text-[11px] text-slate-400">
                Check your inbox (and spam folder) for the password recovery link.
              </p>
              <div className="pt-2">
                {onNavigateToLogin ? (
                  <button
                    type="button"
                    onClick={onNavigateToLogin}
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Sign In</span>
                  </button>
                ) : (
                  <a
                    href="/login"
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Sign In</span>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1">
                <label htmlFor="identifier-input" className="block text-xs font-semibold text-slate-700">
                  Username or Registered Email
                </label>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="identifier-input"
                    name="identifier"
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="e.g. owner or vino@rtrmobiles.com"
                    required
                    disabled={isLoading}
                    autoFocus
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 pt-0.5">
                  We will resolve your verified account and send password recovery instructions.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={isLoading || !identifier.trim()}
                  className="w-full bg-[#2563EB] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending Instructions...</span>
                    </>
                  ) : (
                    <span>Send Password Reset Link</span>
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
                      <span>Back to Sign In</span>
                    </button>
                  ) : (
                    <a
                      href="/login"
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center justify-center gap-1.5 hover:underline cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
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
