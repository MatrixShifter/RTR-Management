import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  action
}) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="font-semibold text-slate-800 text-sm tracking-tight">{title}</h3>}
          {action && <div className="text-xs">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'alert' | 'highlight' | 'navy';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  trend,
  icon,
  variant = 'default'
}) => {
  const variantStyles = {
    default: 'border-slate-200 bg-white hover:border-slate-300',
    alert: 'border-amber-300 bg-amber-50/30 hover:border-amber-400',
    highlight: 'border-blue-200 bg-blue-50/20 hover:border-blue-300',
    navy: 'border-crimpston-slate bg-crimpston-navy text-white'
  };

  const isNavy = variant === 'navy';

  return (
    <div className={`rounded-xl p-5 border shadow-sm transition-all ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${isNavy ? 'text-slate-300' : 'text-slate-500'}`}>
          {label}
        </span>
        {icon && (
          <div className={`p-2 rounded-lg ${isNavy ? 'bg-slate-800 text-crimpston-electric' : 'bg-slate-50 text-slate-600'}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className={`text-2xl font-bold tracking-tight ${isNavy ? 'text-white' : 'text-slate-900'}`}>
          {value}
        </span>
        {trend && (
          <span className={`text-xs font-medium ${isNavy ? 'text-slate-300' : 'text-slate-600'}`}>
            {trend}
          </span>
        )}
      </div>
      {subtext && (
        <p className={`mt-1.5 text-xs ${isNavy ? 'text-slate-300' : 'text-slate-500'}`}>
          {subtext}
        </p>
      )}
    </div>
  );
};
