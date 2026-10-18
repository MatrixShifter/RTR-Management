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
    <div className={`bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          {title && <h3 className="font-semibold text-slate-800 text-sm tracking-tight">{title}</h3>}
          {action && <div>{action}</div>}
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
  variant?: 'default' | 'alert' | 'highlight';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  trend,
  variant = 'default'
}) => {
  const borderStyles = {
    default: 'border-slate-200/80',
    alert: 'border-amber-300 bg-amber-50/20',
    highlight: 'border-crimpston-electric/40 bg-blue-50/10'
  };

  return (
    <div className={`bg-white rounded-xl p-5 border shadow-sm ${borderStyles[variant]}`}>
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {trend && <span className="text-xs font-medium text-slate-600">{trend}</span>}
      </div>
      {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
    </div>
  );
};
