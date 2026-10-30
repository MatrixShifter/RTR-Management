import React from 'react';
import { Smartphone, Download, X } from 'lucide-react';
import { usePwaInstall } from '../services/usePwaInstall.js';
import { InstallAppModal } from './InstallAppModal.js';

export const InstallAppBanner: React.FC = () => {
  const {
    canInstall,
    isDismissed,
    hasNativePrompt,
    showInstructions,
    setShowInstructions,
    installApp,
    dismissBanner
  } = usePwaInstall();

  if (!canInstall || isDismissed) {
    return (
      <InstallAppModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        onNativeInstall={hasNativePrompt ? installApp : undefined}
        hasNativePrompt={hasNativePrompt}
      />
    );
  }

  return (
    <>
      <div 
        role="region" 
        aria-label="Install mobile app prompt"
        className="w-full bg-linear-to-r from-[#102A4C] via-[#163660] to-[#102A4C] text-white px-4 py-2 text-xs flex items-center justify-between gap-3 shadow-xs border-b border-slate-700/60"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-6 h-6 rounded-md bg-[#168BFF]/20 flex items-center justify-center shrink-0 border border-[#168BFF]/40 text-[#168BFF]">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
          <span className="truncate text-slate-200">
            <strong className="text-white font-semibold">Install RTR App</strong> for instant offline records and full-screen mobile access.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={installApp}
            className="px-3 py-1 bg-[#168BFF] hover:bg-[#0E7BE5] text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            className="p-1 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <InstallAppModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        onNativeInstall={hasNativePrompt ? installApp : undefined}
        hasNativePrompt={hasNativePrompt}
      />
    </>
  );
};
