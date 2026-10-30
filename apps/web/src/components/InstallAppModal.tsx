import React from 'react';
import { X, Download, Share, MoreVertical, CheckCircle2 } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNativeInstall?: () => void;
  hasNativePrompt?: boolean;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  onNativeInstall,
  hasNativePrompt
}) => {
  if (!isOpen) return null;

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DCE4EC] shadow-xl max-w-md w-full p-6 text-left relative overflow-hidden animate-scale-up">
        {/* Header with App Icon */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#102A4C] p-2 flex items-center justify-center shadow-xs border border-slate-700/60 shrink-0">
              <img
                src="/rtr-logo.png"
                alt="RTR Mobiles logo"
                className="w-full h-full object-contain"
                width="40"
                height="40"
              />
            </div>
            <div>
              <h3 id="install-modal-title" className="text-base font-extrabold text-[#102A4C] tracking-tight">
                Install RTR Management
              </h3>
              <p className="text-xs text-[#637A98] font-medium">
                Wholesale Mobile App &amp; Offline Ledger
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Benefits List */}
        <div className="my-4 space-y-2 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]/80 text-xs text-[#334155]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Standalone full-screen mobile app experience</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Instant offline viewing of cached wholesale records</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Automatic background sync when connection returns</span>
          </div>
        </div>

        {/* Platform Specific Instructions */}
        {hasNativePrompt && onNativeInstall ? (
          <div className="space-y-4">
            <p className="text-xs text-[#637A98]">
              Click the button below to add RTR Management directly to your home screen:
            </p>
            <button
              type="button"
              onClick={() => {
                onNativeInstall();
                onClose();
              }}
              className="w-full bg-[#168BFF] hover:bg-[#0E7BE5] active:bg-[#0766C2] text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Install to Home Screen</span>
            </button>
          </div>
        ) : isIOS ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#102A4C]">
              Install on iPhone or iPad (Safari):
            </p>
            <ol className="text-xs text-[#5A6E85] space-y-2 pl-1">
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#102A4C] bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[11px]">1</span>
                <span>Tap the <Share className="w-3.5 h-3.5 inline mx-1 text-[#168BFF]" /> <strong>Share</strong> button in the Safari toolbar.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#102A4C] bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[11px]">2</span>
                <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#102A4C] bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[11px]">3</span>
                <span>Tap <strong>Add</strong> in the top-right corner to finish.</span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#102A4C]">
              Install on Android (Chrome / Edge / Samsung Internet):
            </p>
            <ol className="text-xs text-[#5A6E85] space-y-2 pl-1">
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#102A4C] bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[11px]">1</span>
                <span>Tap the <MoreVertical className="w-3.5 h-3.5 inline text-[#102A4C]" /> <strong>menu (three dots)</strong> in your browser.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#102A4C] bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[11px]">2</span>
                <span>Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#102A4C] bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[11px]">3</span>
                <span>Tap <strong>Install</strong> to confirm.</span>
              </li>
            </ol>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-[#E2E8F0] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#5A6E85] hover:text-[#102A4C] rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
