import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Boxes, 
  Truck, 
  ClipboardCheck, 
  Store, 
  Banknote,
  BarChart3,
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

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  // Handle Escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const ownerLinks = [
    { label: 'Overview', to: '/', icon: Boxes },
    { label: 'Deliveries', to: '/deliveries', icon: Truck },
    { label: 'Stock Ledger', to: '/stock-ledger', icon: ClipboardCheck },
    { label: 'Payments', to: '/payments', icon: Banknote },
    { label: 'History & Analytics', to: '/analytics', icon: BarChart3 },
    { label: 'Catalog & Shops', to: '/management', icon: Store }
  ];

  const employeeLinks = [
    { label: 'Daily Report', to: '/employee', icon: ClipboardCheck },
    { label: 'Stock Overview', to: '/stock-ledger', icon: Boxes }
  ];

  const links = userRole === 'owner' ? ownerLinks : employeeLinks;

  return (
    <header className="bg-crimpston-navy text-white sticky top-0 z-40 shadow-md border-b border-slate-800 select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* Brand Section */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 flex-shrink-0">
            <Link 
              to="/" 
              className="flex items-center space-x-2.5 sm:space-x-3 focus:outline-none focus:ring-2 focus:ring-crimpston-electric rounded-lg p-0.5 group"
              aria-label="RTR Wholesale Management Home"
            >
              <div className="w-8 h-8 rounded-lg bg-crimpston-electric flex items-center justify-center font-black text-white text-xs tracking-wider shadow-sm flex-shrink-0 group-hover:bg-crimpston-electric-hover transition-colors">
                RTR
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-bold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                  RTR
                </span>
                <span className="text-[10px] tracking-wider text-slate-400 uppercase font-medium mt-0.5 whitespace-nowrap">
                  Wholesale Management
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links (Visible on lg and larger viewports) */}
          <nav 
            className="hidden lg:flex items-center gap-1 xl:gap-1.5 flex-shrink min-w-0" 
            aria-label="Main Navigation"
          >
            {links.map(link => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'bg-crimpston-electric/15 text-blue-400 border border-crimpston-electric/30 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section, Live Status & Mobile Menu Toggle */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            
            {/* Connectivity Status Badge */}
            <div 
              className="flex items-center space-x-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-800/90 text-[11px] border border-slate-700/80 flex-shrink-0"
              title={isOnline ? "System connected and live" : "Working in offline mode"}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300 hidden sm:inline">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300 font-semibold">Offline</span>
                </>
              )}
            </div>

            {/* User Profile & Badge */}
            <div className="flex items-center space-x-2 pl-1.5 sm:pl-2.5 border-l border-slate-800 flex-shrink-0">
              <div 
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700/80 flex-shrink-0 font-bold text-xs"
                title={userName}
              >
                {userName ? userName.charAt(0).toUpperCase() : <UserCircle className="w-5 h-5 text-slate-400" />}
              </div>
              <div className="hidden xl:flex items-center space-x-2">
                <span className="text-xs font-semibold text-white whitespace-nowrap max-w-[130px] truncate" title={userName}>
                  {userName}
                </span>
                <Badge variant={userRole === 'owner' ? 'info' : 'neutral'} size="sm">
                  {userRole.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={onSignOut}
              title="Sign Out"
              aria-label="Sign out of RTR Wholesale Management"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50 flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger / Close Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-crimpston-electric flex-shrink-0"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Drawer Overlay & Menu (Under 1024px) */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 top-16 bg-slate-950/70 backdrop-blur-xs z-30 lg:hidden transition-opacity" 
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer Panel */}
            <div 
              id="mobile-navigation-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation Menu"
              className="lg:hidden fixed top-16 left-0 right-0 max-h-[calc(100vh-4rem)] overflow-y-auto bg-crimpston-navy border-b border-slate-800 shadow-2xl z-40 animate-fade-in"
            >
              <div className="p-4 space-y-4 max-w-md mx-auto">
                
                {/* User Info Card inside Drawer */}
                <div className="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl border border-slate-800 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 border border-slate-700 font-bold text-sm">
                      {userName ? userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block">{userName}</span>
                      {assignedShopName ? (
                        <span className="text-[11px] text-slate-400 block">📍 {assignedShopName}</span>
                      ) : (
                        <span className="text-[11px] text-slate-400 block">
                          {userRole === 'owner' ? 'Administrator' : 'Store Associate'}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant={userRole === 'owner' ? 'info' : 'neutral'} size="sm">
                    {userRole.toUpperCase()}
                  </Badge>
                </div>

                {/* Mobile Navigation Links */}
                <nav className="space-y-1" aria-label="Mobile Navigation Links">
                  {links.map(link => {
                    const Icon = link.icon;
                    const isActive = location.pathname === link.to;
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-crimpston-electric/15 text-blue-400 font-bold border border-crimpston-electric/30 shadow-xs'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                        }`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                        <span className="whitespace-nowrap">{link.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                {/* Mobile Drawer Footer with Live Status & Sign Out */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    {isOnline ? (
                      <>
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                        <span>System Online & Synced</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-300">Offline Mode</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignOut();
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors border border-rose-500/20"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>

              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
