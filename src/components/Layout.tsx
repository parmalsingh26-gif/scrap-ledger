import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import type { ReactNode } from 'react';
import { GlobalSearch } from './GlobalSearch';
import { useAuth } from './AuthProvider';

const navItems = [
  { name: 'Dashboard', path: '/', icon: 'dashboard' },
  { name: 'Inward Entry', path: '/inward', icon: 'login' },
  { name: 'Outward Entry', path: '/outward', icon: 'logout' },
  { name: 'Total Scrap Position', path: '/total-scrap', icon: 'analytics' },
  { name: 'BVP Scrap Position', path: '/bvp-scrap', icon: 'precision_manufacturing' },
  { name: 'Admin Settings', path: '/admin', icon: 'admin_panel_settings' },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAdmin, logout, login, logoutApp } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);

  const handleAuthToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAdmin) {
      logout();
    } else {
      const pin = prompt('Enter Admin PIN (Default: 1234):');
      if (pin) {
        if (!login(pin)) {
           alert('Incorrect PIN');
        }
      }
    }
  };

  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);
  const toggleDesktopSidebar = () => setIsDesktopSidebarOpen(!isDesktopSidebarOpen);

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen antialiased flex selection:bg-primary-container selection:text-white overflow-hidden">
      {/* Background Ambient Gradients */}
      <div className="fixed inset-0 z-[-1] pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-1/2 h-1/2 bg-primary-fixed-dim rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-1/2 h-1/2 bg-secondary-fixed-dim rounded-full blur-[120px]"></div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-40 md:hidden"
          onClick={closeMobileSidebar}
        ></div>
      )}

      {/* SideNavBar */}
      <nav className={cn(
        "h-screen w-64 fixed left-0 top-0 flex-col bg-white/70 dark:bg-inverse-surface/70 backdrop-blur-md border-r border-white/20 dark:border-outline-variant/10 shadow-sm z-50 transition-transform duration-300 md:flex",
        isMobileSidebarOpen ? "translate-x-0 flex" : "-translate-x-full",
        isDesktopSidebarOpen ? "md:translate-x-0" : "md:-translate-x-full"
      )}>
        <div className="p-lg border-b border-white/20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>widgets</span>
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md font-extrabold tracking-tight text-primary dark:text-inverse-primary text-[20px] leading-tight">Scrap Ledger</h1>
              <p className="font-label-md text-label-md text-outline">Industrial Inventory</p>
            </div>
          </div>
          <button className="md:hidden text-outline hover:text-on-surface" onClick={closeMobileSidebar}>
             <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="flex flex-col h-full p-lg overflow-y-auto gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMobileSidebar}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl font-label-md text-label-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95',
                  isActive 
                    ? 'bg-primary/10 dark:bg-primary-container/20 text-primary dark:text-inverse-primary font-bold border-r-4 border-primary' 
                    : 'text-on-surface-variant dark:text-outline-variant hover:text-on-surface dark:hover:text-inverse-on-surface hover:bg-white/40 dark:hover:bg-white/5'
                )}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                  {item.icon}
                </span>
                {item.name}
                {(!isAdmin && (item.path === '/outward' || item.path === '/admin')) && (
                  <span className="material-symbols-outlined ml-auto text-[16px] opacity-50">lock</span>
                )}
              </Link>
            );
          })}
          
          <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-surface-variant">
            <button 
              onClick={handleAuthToggle}
              className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-error transition-all duration-200 hover:-translate-y-0.5 rounded-xl font-label-md text-label-md w-full text-left"
            >
              <span className="material-symbols-outlined text-sm">
                {isAdmin ? 'lock_open' : 'lock'}
              </span>
              <span>{isAdmin ? 'Lock Admin' : 'Unlock Admin'}</span>
            </button>
            <button 
              onClick={() => { if(confirm('Are you sure you want to logout?')) logoutApp(); }}
              className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-error transition-all duration-200 hover:-translate-y-0.5 rounded-xl font-label-md text-label-md w-full text-left"
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>power_settings_new</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* TopNavBar */}
      <header className={cn(
        "fixed top-0 right-0 h-16 z-30 bg-surface/80 dark:bg-inverse-surface/80 backdrop-blur-xl border-b border-white/20 dark:border-outline-variant/10 shadow-sm flex justify-between items-center px-margin-mobile md:px-margin-desktop transition-all duration-300 w-full",
        isDesktopSidebarOpen ? "md:w-[calc(100%-256px)]" : "md:w-full"
      )}>
        <div className="flex items-center gap-4">
          <button className="md:hidden text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-white/50" onClick={() => setIsMobileSidebarOpen(true)}>
             <span className="material-symbols-outlined">menu</span>
          </button>
          <button className="hidden md:block text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-white/50" onClick={toggleDesktopSidebar}>
             <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="font-headline-md text-headline-md font-bold text-primary dark:text-inverse-primary md:hidden">Scrap Ledger</span>
          <nav className="hidden md:flex gap-6 h-full items-center">
            <a href="#" className="text-primary dark:text-inverse-primary font-bold border-b-2 border-primary pb-1 font-label-md text-label-md h-full flex items-center">Live Ledger</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <GlobalSearch />
          </div>
          <button className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-white/50">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="h-8 w-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm shadow-sm cursor-pointer" onClick={handleAuthToggle}>
            {isAdmin ? 'AD' : 'G'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={cn(
        "pt-20 pb-12 px-margin-mobile md:px-margin-desktop min-h-screen w-full transition-all duration-300 overflow-x-hidden",
        isDesktopSidebarOpen ? "md:ml-64" : "md:ml-0"
      )}>
        <div className="max-w-[1440px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
