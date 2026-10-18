import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Boxes, 
  Truck, 
  ClipboardCheck, 
  Store, 
  Banknote,
  LogOut, 
  Wifi, 
  WifiOff, 
  UserCircle,
  Menu,
  X
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const ownerLinks = [
    { label: 'Overview', to: '/', icon: Boxes },
    { label: 'Deliveries', to: '/deliveries', icon: Truck },
    { label: 'Stock Ledger', to: '/stock-ledger', icon: ClipboardCheck },
    { label: 'Payments', to: '/payments', icon: Banknote },
    { label: 'Catalog & Shops', to: '/management', icon: Store }
  ];

  const employeeLinks = [
    { label: 'Daily Report', to: '/employee', icon: ClipboardCheck },
    { label: 'Stock Overview', to: '/stock-ledger', icon: Boxes }
  ];

  const links = userRole === 'owner' ? ownerLinks : employeeLinks;

  return (
    <header className="bg-crimpston-navy text-white sticky top-0 z-40 shadow-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-crimpston-electric rounded-lg p-1">
              <div className="w-9 h-9 rounded-lg bg-crimpston-electric flex items-center justify-center font-black text-white text-lg tracking-wider shadow">
                C
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white block leading-none">CRIMPSTON</span>
                <span className="text-[10px] tracking-wider text-slate-400 uppercase font-medium block mt-1">
                  Wholesale Accessories
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1" aria-label="Main Navigation">
            {links.map(link => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                    isActive
                      ? 'bg-crimpston-slate text-crimpston-electric shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-crimpston-slate/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile, Network Status & Mobile Menu Toggle */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Connectivity Status */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 text-[11px] border border-slate-700">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300 hidden sm:inline">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300 font-medium">Offline</span>
                </>
              )}
            </div>

            {/* User Details */}
            <div className="flex items-center space-x-2.5 pl-2 border-l border-slate-700">
              <UserCircle className="w-7 h-7 text-slate-400" />
              <div className="hidden lg:block text-left">
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
              aria-label="Sign out of Crimpston System"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-800 space-y-1 animate-fade-in">
            {links.map(link => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-crimpston-slate text-crimpston-electric font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-crimpston-slate/40'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 px-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
              <span>Signed in as {userName}</span>
              <Badge variant={userRole === 'owner' ? 'info' : 'neutral'} size="sm">
                {userRole.toUpperCase()}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
