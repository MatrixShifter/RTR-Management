import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Button } from './Button.js';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const iconConfig = {
    danger: { Icon: AlertCircle, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    warning: { Icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    primary: { Icon: Info, color: 'text-blue-600 bg-blue-50 border-blue-200' }
  }[variant] || { Icon: AlertCircle, color: 'text-rose-600 bg-rose-50 border-rose-200' };

  const IconComponent = iconConfig.Icon;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
        onClick={() => { if (!isLoading) onClose(); }} 
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transform transition-all animate-fade-in">
          <div className="p-6">
            <div className="flex items-start space-x-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${iconConfig.color}`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{description}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isLoading}
              >
                {cancelText}
              </Button>
              <Button
                variant={variant === 'danger' ? 'danger' : 'primary'}
                size="sm"
                onClick={onConfirm}
                isLoading={isLoading}
              >
                {confirmText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
