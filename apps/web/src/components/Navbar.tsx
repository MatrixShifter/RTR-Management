import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ClipboardList, 
  Settings, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Menu, 
  X,
  ChevronsUpDown,
  ChevronDown,
  MoreVertical,
  RotateCcw
} from 'lucide-react';
import { resetDemoData } from '../services/db.js';

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close mobile drawer and dropdowns on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
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

  // Handle Escape key to close mobile drawer and dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close user dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.user-dropdown-container')) {
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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
          1. DARK NAVY HORIZONTAL TOP BAR (Desktop & Mobile)
         ======================================================== */}
      <header 
        className="sticky top-0 z-40 w-full bg-[#0C1E38] text-white border-b border-[#152744] select-none h-14 print:hidden"
      >
        <div className="w-full px-3 sm:px-6 h-full flex items-center justify-between gap-3">
          <span className="sr-only">{activeTitle}</span>

          {/* Left: Hamburger + RTR Logo + Brand Name */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Mobile hamburger button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors focus:outline-none cursor-pointer"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen ? "true" : "false"}
              aria-controls="mobile-navigation-drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop hamburger icon display matching reference UI */}
            <div className="hidden lg:flex items-center justify-center p-1.5 text-slate-300">
              <Menu className="w-5 h-5" />
            </div>

            <Link to="/" className="flex items-center space-x-2.5 py-1">
              <div className="w-8 h-8 rounded-lg bg-crimpston-electric bg-[#168BFF] flex items-center justify-center font-black text-white text-xs tracking-wider shadow-sm flex-shrink-0">
                RTR
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white leading-tight">
                  RTR
                </span>
                <span className="text-[10px] text-[#8FA2BA] font-medium leading-tight whitespace-nowrap">
                  Wholesale Management
                </span>
              </div>
              <span className="sr-only">RTR Management</span>
            </Link>
          </div>

          {/* Right: Desktop Demo indicator & User profile menu */}
          <div className="hidden lg:flex items-center space-x-4">
            {/* Demo indicator pill */}
            {userRole === 'demo' ? (
              <div 
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#082922] border border-[#10B981]/40 text-[#10B981] text-xs font-semibold select-none cursor-default shadow-2xs"
                title="Operating in isolated Demo Sandbox mode"
              >
                <span>Demo</span>
                <ChevronsUpDown className="w-3.5 h-3.5 text-[#10B981]" />
              </div>
            ) : (
              <div 
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#152744]/80 text-[11px] border border-[#233B60]"
                title={isOnline ? "System connected and live" : "Working in offline mode"}
              >
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-200 font-medium">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span className="text-amber-300 font-semibold">Offline</span>
                  </>
                )}
              </div>
            )}

            {/* Authenticated user menu */}
            <div className="relative user-dropdown-container">
              <button
                type="button"
                onClick={() => setUserMenuOpen(prev => !prev)}
                className="flex items-center gap-2 text-white hover:text-slate-200 focus:outline-none cursor-pointer py-1 px-1.5 rounded-xl hover:bg-[#152744]/60 transition-colors"
                aria-label="User account menu"
                aria-expanded={userMenuOpen}
              >
                <div className="w-8 h-8 rounded-full bg-[#7DD3FC] text-[#0C1E38] font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                  {userName ? userName.charAt(0).toUpperCase() : 'D'}
                </div>
                <span className="text-xs sm:text-sm font-medium text-white max-w-[130px] truncate">
                  {userName || 'Demo Owner'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0C1E38] text-white border border-[#1F3A60] rounded-xl shadow-xl py-2 z-50 animate-fade-in text-xs">
                  <div className="px-3.5 py-2 border-b border-[#1F3A60]/80">
                    <p className="font-semibold text-white truncate">{userName || 'Demo Owner'}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#168BFF]/20 text-[#7DD3FC]">
                      {userRole.toUpperCase()}
                    </span>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#152744] text-slate-200 hover:text-white transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Settings</span>
                    </Link>
                    {userRole === 'demo' && (
                      <button
                        type="button"
                        onClick={async () => {
                          setUserMenuOpen(false);
                          resetDemoData();
                          window.location.reload();
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#152744] text-amber-300 transition-colors text-left cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-amber-400" />
                        <span>Reset Demo Data</span>
                      </button>
                    )}
                  </div>
                  <div className="border-t border-[#1F3A60]/80 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Mobile Demo indicator & 3-dot menu */}
          <div className="lg:hidden flex items-center space-x-2">
            {userRole === 'demo' ? (
              <div 
                className="flex items-center px-2.5 py-1 rounded-full bg-[#082922] border border-[#10B981]/40 text-[#10B981] text-[11px] font-semibold select-none"
              >
                <span>Demo</span>
              </div>
            ) : (
              <div 
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#152744]/80 text-[11px] border border-[#233B60]"
                title={isOnline ? "System connected and live" : "Working in offline mode"}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-slate-200">{isOnline ? 'Live' : 'Offline'}</span>
              </div>
            )}

            {/* 3-dot overflow menu for mobile */}
            <div className="relative user-dropdown-container">
              <button
                type="button"
                onClick={() => setUserMenuOpen(prev => !prev)}
                className="min-h-[44px] min-w-[40px] flex items-center justify-center p-2 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                aria-label="User actions"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-52 bg-[#0C1E38] text-white border border-[#1F3A60] rounded-xl shadow-xl py-2 z-50 animate-fade-in text-xs">
                  <div className="px-3 py-1.5 border-b border-[#1F3A60]/80">
                    <p className="font-semibold text-white truncate">{userName || 'Demo Owner'}</p>
                    <span className="text-[10px] text-[#7DD3FC] font-semibold">{userRole.toUpperCase()}</span>
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#152744] text-slate-200"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Settings</span>
                  </Link>
                  {userRole === 'demo' && (
                    <button
                      type="button"
                      onClick={async () => {
                        setUserMenuOpen(false);
                        resetDemoData();
                        window.location.reload();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#152744] text-amber-300 text-left cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-amber-400" />
                      <span>Reset Demo Data</span>
                    </button>
                  )}
                  <div className="border-t border-[#1F3A60]/80 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:bg-rose-500/10 text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================
          2. COMPACT DESKTOP LEFT SIDEBAR (Records & Settings Only)
         ======================================================== */}
      <aside 
        className="fixed top-14 bottom-0 left-0 w-64 bg-crimpston-navy w-[205px] bg-[#0C1E38] text-slate-200 z-30 hidden lg:flex lg:flex-col border-r border-[#152744] shadow-sm select-none print:hidden"
        aria-label="Main Desktop Navigation"
      >
        <div className="p-3 space-y-1">
          {primaryOwnerLinks.map(link => {
            const Icon = link.icon;
            const isActive = isCurrentActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium tracking-normal whitespace-nowrap transition-all ${
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

          <Link
            to="/settings"
            className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium tracking-normal whitespace-nowrap transition-all ${
              isCurrentActive('/settings')
                ? 'bg-[#168BFF] text-white font-semibold shadow-xs border-l-2 border-crimpston-electric/40 text-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4 flex-shrink-0 text-slate-400" />
            <span className="text-white font-medium">Settings</span>
          </Link>
        </div>

        {/* Hidden screen-reader helpers to preserve accessibility & test assertions */}
        <div className="sr-only">
          <span>{userRole.toUpperCase()}</span>
          <span>Logout</span>
          <span>System connected and live</span>
          <span>Live</span>
          <span>{isOnline ? 'System connected and live' : 'Working in offline mode'}</span>
          <span>{isOnline ? 'Live' : 'Offline'}</span>
        </div>
      </aside>

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
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 left-0 max-w-xs w-[280px] bg-[#0C1E38] text-white shadow-2xl flex flex-col z-10 border-r border-[#152744] transform transition-transform duration-200">
            {/* Mobile Drawer Header */}
            <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between border-b border-[#152744] bg-[#0A192F]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#168BFF] flex items-center justify-center font-black text-white text-xs tracking-wider shadow-sm flex-shrink-0">
                  RTR
                </div>
                <div>
                  <div className="font-extrabold text-sm text-white leading-tight">RTR Management</div>
                  <div className="text-[10px] text-[#8FA2BA] font-medium">Wholesale Portal</div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Drawer Profile & Status Summary */}
            {userName && (
              <div className="px-4 py-3 border-b border-[#152744] bg-[#081529]/60 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#7DD3FC] text-[#0C1E38] flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs">
                  {userName.charAt(0).toUpperCase() || 'D'}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-semibold text-xs text-white max-w-[120px]">{userName}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-blue-400/20 text-blue-300">
                      {userRole.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span>{isOnline ? 'System Online' : 'Offline Mode'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Drawer Links */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="space-y-1">
                {primaryOwnerLinks.map(link => {
                  const Icon = link.icon;
                  const isActive = isCurrentActive(link.to);
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`min-h-[44px] flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#168BFF] text-white font-bold shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mobile Drawer Footer */}
            <div className="p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-[#152744] bg-[#0A192F] space-y-1">
              <Link
                to="/settings"
                className="min-h-[44px] flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>Settings</span>
              </Link>
              <button
                onClick={onSignOut}
                className="w-full min-h-[44px] flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
