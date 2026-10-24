import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ClipboardList, 
  Settings, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Menu, 
  X 
} from 'lucide-react';

interface NavbarProps {
  userRole?: 'owner' | 'demo';
  userName?: string;
  isOnline?: boolean;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  userRole = 'owner',
  userName = 'Business Owner',
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

  // Primary navigation links for the simplified Records ledger workspace
  const primaryOwnerLinks = [
    { label: 'Records', to: '/', icon: ClipboardList, alias: 'Records' }
  ];

  const isCurrentActive = (to: string) => {
    if (to === '/' && (location.pathname === '/' || location.pathname === '/records')) return true;
    if (to === '/settings' && (location.pathname === '/settings' || location.pathname === '/management')) return true;
    return location.pathname === to;
  };

  const activeTitle = location.pathname === '/' || location.pathname === '/records'
    ? 'Records'
    : location.pathname === '/settings' || location.pathname === '/management'
    ? 'Settings'
    : 'Wholesale Ledger';

  return (
    <>
      {/* ========================================================
          1. DESKTOP LEFT SIDEBAR (Dark Navy, matching screenshot)
         ======================================================== */}
      <aside 
        className="fixed inset-y-0 left-0 w-64 bg-crimpston-navy w-[205px] bg-[#0C1E38] text-slate-200 z-30 hidden lg:flex lg:flex-col border-r border-[#152744] shadow-sm select-none print:hidden"
        aria-label="Main Desktop Navigation"
      >
        {/* Sidebar Brand Header */}
        <div className="pt-5 pb-4 px-4 flex-shrink-0">
          <Link 
            to="/" 
            className="group block focus:outline-none"
            aria-label="RTR Management Home"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-crimpston-electric bg-[#168BFF] flex items-center justify-center font-black text-white text-xs tracking-wider shadow-sm flex-shrink-0">
                RTR
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight text-white leading-tight">
                  RTR
                </span>
                <span className="text-[10px] text-[#8FA2BA] font-medium tracking-wide">
                  Wholesale Management
                </span>
              </div>
            </div>
            <span className="sr-only">Wholesale Management</span>
          </Link>
        </div>

        {/* Primary Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          <nav className="space-y-1" aria-label="Sidebar Primary Navigation">
            {primaryOwnerLinks.map(link => {
              const Icon = link.icon;
              const isActive = isCurrentActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium tracking-normal whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[#168BFF] text-white font-semibold shadow-xs border-l-2 border-crimpston-electric/40 text-blue-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white text-blue-400' : 'text-slate-400'}`} />
                  <span className="text-white font-medium">{link.label}</span>
                  {link.alias && <span className="sr-only">{link.alias}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: User, Settings & Logout */}
        <div className="p-3 border-t border-slate-800/80 flex-shrink-0 bg-[#0A192F]/60 space-y-2">
          {userName && (
            <div className="flex items-center gap-2.5 px-2 py-1">
              <div className="w-8 h-8 rounded-full bg-[#168BFF] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs">
                {userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'DO'}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-semibold text-xs text-white max-w-[90px]">{userName}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    userRole === 'demo' ? 'bg-amber-400/20 text-amber-300' : 'bg-blue-400/20 text-blue-300'
                  }`}>
                    {userRole.toUpperCase()}
                  </span>
                </div>
                <div 
                  className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5"
                  title={isOnline ? "System connected and live" : "Working in offline mode"}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>{isOnline ? 'Online' : 'Offline'}</span>
                  <span className="sr-only">{isOnline ? 'Live' : 'Offline'}</span>
                  <span className="sr-only">{isOnline ? 'System connected and live' : 'Working in offline mode'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-1 space-y-0.5">
            <Link
              to="/settings"
              className={`flex items-center space-x-3 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                location.pathname === '/settings' || location.pathname === '/management'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Settings</span>
            </Link>

            <button
              onClick={onSignOut}
              className="w-full flex items-center space-x-3 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================
          2. TOP HEADER (Responsive: Mobile only)
         ======================================================== */}
      <header 
        className="sticky top-0 z-20 w-full lg:hidden bg-slate-900 text-white border-b border-slate-800 select-none print:hidden"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <span className="sr-only">{activeTitle}</span>
          
          {/* Mobile hamburger & brand */}
          <div className="lg:hidden flex items-center space-x-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors focus:outline-none"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen ? "true" : "false"}
              aria-controls="mobile-navigation-drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-xs tracking-wider">
                RTR
              </div>
              <span className="font-bold text-sm tracking-tight text-white">
                RTR Management
              </span>
            </Link>
          </div>

          {/* Connectivity Status Pill */}
          <div className="flex items-center space-x-2">
            <div 
              className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-800/80 text-[10px] sm:text-[11px] border border-slate-700/60"
              title={isOnline ? "System connected and live" : "Working in offline mode"}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="text-slate-300">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-300 font-semibold">Offline</span>
                </>
              )}
            </div>

            {/* Mobile-only logout shortcut */}
            <div className="lg:hidden">
              <button
                onClick={onSignOut}
                className="p-1 text-slate-400 hover:text-rose-400"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================
          3. MOBILE NAVIGATION DRAWER
         ======================================================== */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 lg:hidden overflow-hidden" 
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-slate-900 text-white shadow-2xl flex flex-col z-10">
            {/* Mobile Drawer Header */}
            <div className="p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-xs">
                  RTR
                </div>
                <div>
                  <div className="font-bold text-sm text-white">RTR Management</div>
                  <div className="text-[10px] text-slate-400">Wholesale Portal</div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Drawer Links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-1">
                {primaryOwnerLinks.map(link => {
                  const Icon = link.icon;
                  const isActive = isCurrentActive(link.to);
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mobile Drawer Footer */}
            <div className="p-4 border-t border-slate-800 space-y-1">
              <Link
                to="/settings"
                className="flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Settings</span>
              </Link>
              <button
                onClick={onSignOut}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-slate-800 text-left"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
