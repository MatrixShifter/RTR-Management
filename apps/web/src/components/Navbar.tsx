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

  // Active page title for the desktop top header
  const currentLink = links.find(l => l.to === location.pathname);
  const activeTitle = currentLink ? currentLink.label : 'Wholesale Portal';

  return (
    <>
      {/* ========================================================
          1. DESKTOP LEFT SIDEBAR (Visible on lg: 1024px and up)
         ======================================================== */}
      <aside 
        className="fixed inset-y-0 left-0 w-64 bg-crimpston-navy text-white z-30 hidden lg:flex lg:flex-col border-r border-slate-800 shadow-xl select-none print:hidden"
        aria-label="Main Desktop Navigation"
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-800 flex-shrink-0">
          <Link 
            to="/" 
            className="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-crimpston-electric rounded-lg p-1 group"
            aria-label="RTR Wholesale Management Home"
          >
            <div className="w-8 h-8 rounded-lg bg-crimpston-electric flex items-center justify-center font-black text-white text-xs tracking-wider shadow-sm flex-shrink-0 group-hover:bg-crimpston-electric-hover transition-colors">
              RTR
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                RTR
              </span>
              <span className="text-[10px] tracking-wider text-slate-400 uppercase font-medium mt-0.5 whitespace-nowrap">
                Wholesale Management
              </span>
            </div>
          </Link>
        </div>

        {/* Vertical Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3.5 py-5 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Menu Navigation
          </div>
          <nav className="space-y-1" aria-label="Sidebar Navigation Links">
            {links.map(link => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'bg-crimpston-electric/20 text-blue-400 border border-crimpston-electric/40 shadow-xs font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer User Card */}
        <div className="p-4 border-t border-slate-800/90 flex-shrink-0 bg-slate-900/40">
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 border border-slate-700/80 flex-shrink-0 font-bold text-xs"
              title={userName}
            >
              {userName ? userName.charAt(0).toUpperCase() : <UserCircle className="w-5 h-5 text-slate-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-white truncate block" title={userName}>
                  {userName}
                </span>
                <Badge variant={userRole === 'owner' ? 'info' : 'neutral'} size="sm">
                  {userRole.toUpperCase()}
                </Badge>
              </div>
              {assignedShopName && (
                <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                  📍 {assignedShopName}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================
          2. TOP HEADER BAR (Positioned alongside sidebar on desktop)
         ======================================================== */}
      <header 
        className="sticky top-0 z-20 w-full lg:pl-64 bg-crimpston-navy text-white border-b border-slate-800 shadow-sm select-none print:hidden"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Left on Desktop: Page Title & Context */}
          <div className="hidden lg:flex items-center space-x-2">
            <h1 className="text-base font-bold text-white tracking-tight">
              {activeTitle}
            </h1>
            <span className="text-xs text-slate-400 font-normal">
              • Wholesale Portal
            </span>
          </div>

          {/* Left on Mobile / Tablet (< 1024px): Hamburger & Brand */}
          <div className="lg:hidden flex items-center space-x-2.5 sm:space-x-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link 
              to="/" 
              className="flex items-center space-x-2 focus:outline-none rounded-lg p-0.5"
              aria-label="RTR Wholesale Management Home"
            >
              <div className="w-7 h-7 rounded-lg bg-crimpston-electric flex items-center justify-center font-black text-white text-xs tracking-wider shadow-sm flex-shrink-0">
                RTR
              </div>
              <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap">
                RTR Wholesale
              </span>
            </Link>
          </div>

          {/* Right on all viewports: Live Status, Profile, and Sign Out */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 flex-shrink-0">
            
            {/* Live / Offline Status Indicator */}
            <div 
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/90 text-[11px] border border-slate-700/80 flex-shrink-0"
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

            {/* User Profile Info (Compact on mobile, expanded on desktop) */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800 flex-shrink-0">
              <div 
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 border border-slate-700/80 flex-shrink-0 font-bold text-xs"
                title={userName}
              >
                {userName ? userName.charAt(0).toUpperCase() : <UserCircle className="w-5 h-5 text-slate-400" />}
              </div>
              <div className="hidden sm:flex items-center space-x-1.5">
                <span className="text-xs font-semibold text-white whitespace-nowrap max-w-[130px] truncate" title={userName}>
                  {userName}
                </span>
                <Badge variant={userRole === 'owner' ? 'info' : 'neutral'} size="sm">
                  {userRole.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Logout Action */}
            <button
              onClick={onSignOut}
              title="Sign Out"
              aria-label="Sign out of RTR Wholesale Management"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50 flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* ========================================================
          3. RESPONSIVE MOBILE & TABLET DRAWER (< 1024px)
         ======================================================== */}
      {mobileMenuOpen && (
        <div className="lg:hidden">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 transition-opacity animate-fade-in" 
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out Left Drawer */}
          <aside 
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
            className="fixed inset-y-0 left-0 w-72 max-w-[80vw] bg-crimpston-navy text-white z-50 shadow-2xl flex flex-col border-r border-slate-800 animate-slide-in-left select-none"
          >
            {/* Drawer Brand Header */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-crimpston-electric flex items-center justify-center font-black text-white text-xs tracking-wider shadow-sm flex-shrink-0">
                  RTR
                </div>
                <span className="font-bold text-sm tracking-tight text-white">
                  RTR Wholesale
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer User Card */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 border border-slate-700 font-bold text-sm">
                  {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-white truncate block">{userName}</span>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <Badge variant={userRole === 'owner' ? 'info' : 'neutral'} size="sm">
                      {userRole.toUpperCase()}
                    </Badge>
                    {assignedShopName && (
                      <span className="text-[11px] text-slate-400 truncate block">
                        📍 {assignedShopName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Navigation Links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Menu Navigation
              </div>
              <nav className="space-y-1" aria-label="Mobile Drawer Links">
                {links.map(link => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-crimpston-electric/20 text-blue-400 font-bold border border-crimpston-electric/40 shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span className="whitespace-nowrap">{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Footer with Live Status & Sign Out */}
            <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                {isOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300">Offline</span>
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
          </aside>
        </div>
      )}
    </>
  );
};
