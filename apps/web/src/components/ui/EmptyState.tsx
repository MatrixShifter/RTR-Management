import React from 'react';
import { LucideIcon, PackageOpen } from 'lucide-react';
import { Button } from './Button.js';

export interface EmptyStateProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  actionLabel?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryAction?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  actionLabel,
  actionText,
  onAction,
  secondaryAction
}) => {
  const renderIcon = () => {
    if (!icon) {
      return <PackageOpen className="w-6 h-6" aria-hidden="true" />;
    }

    // If icon is already an instantiated JSX element, e.g. <Store className="..." />
    if (React.isValidElement(icon)) {
      return icon;
    }

    // If icon is a component (function component or forwardRef object from Lucide)
    if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>;
      try {
        return <IconComponent className="w-6 h-6" aria-hidden="true" />;
      } catch {
        return <PackageOpen className="w-6 h-6" aria-hidden="true" />;
      }
    }

    return <PackageOpen className="w-6 h-6" aria-hidden="true" />;
  };

  const effectiveAction = action || ((actionLabel || actionText) && onAction ? (
    <Button variant="outline" size="sm" onClick={onAction}>
      {actionLabel || actionText}
    </Button>
  ) : null);

  return (
    <div className="text-center py-12 px-4 max-w-md mx-auto animate-fade-in">
      <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3.5 border border-slate-200/60 shadow-sm">
        {renderIcon()}
      </div>
      <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 mb-5 leading-relaxed">{description}</p>
      {(effectiveAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {effectiveAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
