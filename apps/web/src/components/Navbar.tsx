import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Boxes, 
  Truck, 
  ClipboardCheck, 
  Store, 
  LogOut, 
  Wifi, 
  WifiOff, 
  UserCircle 
} from 'lucide-react';
import { Badge } from './ui/Badge.js';

interface NavbarProps {
  userRole: 'owner' | 'employee';
  userName: string;
  assignedShopName?: string;
  isOnline?: boolean;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  userRole,
  userName,
  assignedShopName,
  isOnline = true,
  onSignOut
}) => {
  const location = useLocation();

  const ownerLinks = [
    { label: 'Overview', to: '/', icon: Boxes },
    { label: 'Deliveries', to: '/deliveries', icon: Truck },
    { label: 'Stock Ledger', to: '/stock-ledger', icon: ClipboardCheck },
    { label: 'Catalog & Shops', to: '/management', icon: Store }
  ];

  const employeeLinks = [
    { label: 'Daily Report', to: '/employee', icon: ClipboardCheck },
    { label: 'Stock Overview', to: '/employee/stock', icon: Boxes }
  ];

  const links = userRole === 'owner' ? ownerLinks : employeeLinks;

  return (
    <header className="bg-crimpston-navy text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-crimpston-electric flex items-center justify-center font-black text-white text-lg tracking-wider shadow">
              C
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block">CRIMPSTON</span>
              <span className="text-[10px] tracking-wider text-slate-400 uppercase font-medium block">
                Wholesale Accessories Management
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {links.map(link => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                    isActive
                      ? 'bg-crimpston-slate text-crimpston-electric'
                      : 'text-slate-300 hover:text-white hover:bg-crimpston-slate/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Network Status */}
          <div className="flex items-center space-x-4">
            {/* Connectivity Status */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 text-[11px]">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300 font-medium">Offline Queue</span>
                </>
              )}
            </div>

            {/* User Details */}
            <div className="flex items-center space-x-2.5 pl-2 border-l border-slate-700">
              <UserCircle className="w-7 h-7 text-slate-400" />
              <div className="hidden sm:block text-left">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-white">{userName}</span>
                  <Badge variant={userRole === 'owner' ? 'info' : 'neutral'} size="sm">
                    {userRole.toUpperCase()}
                  </Badge>
                </div>
                {assignedShopName && (
                  <span className="text-[11px] text-slate-400 block font-normal truncate max-w-[150px]">
                    📍 {assignedShopName}
                  </span>
                )}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
