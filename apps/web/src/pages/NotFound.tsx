import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home, Boxes, Truck, Banknote } from 'lucide-react';
import { Button } from '../components/ui/Button.js';

interface NotFoundProps {
  userRole?: 'owner' | 'employee';
}

export const NotFound: React.FC<NotFoundProps> = ({ userRole = 'owner' }) => {
  const homePath = userRole === 'owner' ? '/' : '/employee';
  const homeLabel = userRole === 'owner' ? 'Back to Overview' : 'Back to Daily Report';

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4 shadow-xs">
        <AlertCircle className="w-8 h-8" />
      </div>

      <span className="text-xs font-bold tracking-widest text-amber-600 uppercase font-mono mb-1">
        Error 404
      </span>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
        Page Not Found
      </h1>
      <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
        The requested wholesale management URL does not exist or has been moved. Use the options below to navigate back to active operations.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link to={homePath}>
          <Button variant="primary" size="sm" className="font-medium shadow-xs">
            <Home className="w-3.5 h-3.5 mr-1.5" />
            <span>{homeLabel}</span>
          </Button>
        </Link>
        <Link to="/stock-ledger">
          <Button variant="outline" size="sm" className="font-medium">
            <Boxes className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            <span>Stock Ledger</span>
          </Button>
        </Link>
        {userRole === 'owner' && (
          <>
            <Link to="/deliveries">
              <Button variant="outline" size="sm" className="font-medium">
                <Truck className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <span>Deliveries</span>
              </Button>
            </Link>
            <Link to="/payments">
              <Button variant="outline" size="sm" className="font-medium">
                <Banknote className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <span>Payments</span>
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default NotFound;
