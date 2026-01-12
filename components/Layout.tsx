import React, { useState } from 'react';
import { ViewState, UserProfile } from '../types';
import { LayoutDashboard, Users, Target, Terminal, Settings, LogOut, Cpu, Radio, Menu, X, ShieldCheck, User } from 'lucide-react';
import { TerminalLog } from './TerminalLog';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onReset: () => void;
  userProfile: UserProfile;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, onReset, userProfile }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'DASHBOARD', label: 'لوحة القيادة', icon: LayoutDashboard },
    { id: 'ACCOUNTS', label: 'مصفوفة الهويات', icon: Users },
    { id: 'CAMPAIGNS', label: 'العمليات المستهدفة', icon: Target },
    { id: 'LOGS', label: 'نواة النظام', icon: Terminal },
  ];

  const handleNavClick = (view: ViewState) => {
      onNavigate(view);
      setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-[#020617] text-slate-200 font-sans selection:bg-primary-500/30 overflow-hidden relative" dir="rtl">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary-500/5 rounded-full blur-[150px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[150px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar - HUD Style (Right Side for RTL) */}
      <aside className={`
          w-80 border-l border-white/5 flex flex-col bg-[#020617]/95 backdrop-blur-xl fixed right-0 h-full z-50 shadow-[-5px_0_30px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-8 border-b border-white/5 relative overflow-hidden bg-noise flex justify-between items-center">
            {/* Holographic Header */}
            <div className="relative z-10 flex items-center gap-4">
                <div className="relative group cursor-pointer">
                    <div className="absolute inset-0 bg-primary-400 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <div className="relative w-12 h-12 bg-gradient-to-bl from-slate-800 to-slate-900 rounded-xl border border-white/10 flex items-center justify-center shadow-inner">
                        <Cpu className="text-primary-400 w-7 h-7 animate-pulse" />
                    </div>
                </div>
                <div>
                   <h1 className="font-black text-xl tracking-tighter text-white leading-none">
                     REDDIT<span className="text-transparent bg-clip-text bg-gradient-to-l from-primary-400 to-violet-500">OPS</span>
                   </h1>
                   <div className="flex items-center gap-2 mt-1.5">
                       <span className="w-1.5 h-1.5 bg-success-500 rounded-full animate-blink"></span>
                       <span className="text-[10px] text-primary-500/80 font-mono tracking-[0.2em]">متصل_V4.5</span>
                   </div>
                </div>
            </div>
            {/* Mobile Close Button */}
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
            </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-mono text-slate-600 px-4 mb-2 tracking-widest uppercase">وحدة الملاحة</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id as ViewState)}
                className={`relative w-full flex items-center gap-4 px-4 py-4 rounded-lg text-sm font-bold tracking-wide transition-all duration-200 group overflow-hidden border border-transparent
                  ${isActive 
                    ? 'bg-primary-500/5 text-white border-primary-500/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' 
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5 hover:border-white/5'
                  }`}
              >
                {isActive && (
                    <div className="absolute right-0 top-0 h-full w-0.5 bg-primary-400 shadow-[0_0_10px_#00f0ff]"></div>
                )}
                
                <Icon className={`w-5 h-5 relative z-10 transition-all duration-300 ${isActive ? 'text-primary-400 drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]' : 'group-hover:text-primary-400/70'}`} />
                <span className="relative z-10">{item.label}</span>
                
                {isActive && <div className="absolute left-4 w-1.5 h-1.5 bg-primary-400 rounded-full shadow-[0_0_5px_#00f0ff]"></div>}
              </button>
            );
          })}
        </nav>

        {/* User HUD (Dynamic) */}
        <div className="p-6 border-t border-white/5 bg-[#0a0f1e]/50 relative">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 p-[1px] ring-2 ring-primary-500/20 relative">
                     <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                        {userProfile.role === 'ADMIN' ? (
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="Admin" className="w-full h-full opacity-80" />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full text-slate-500 font-bold text-xs bg-slate-900">U</div>
                        )}
                     </div>
                     <div className="absolute bottom-0 left-0 w-3 h-3 bg-success-500 rounded-full border-2 border-slate-900"></div>
                </div>
                <div className="overflow-hidden">
                    <div className="text-xs font-bold text-white truncate w-32" title={userProfile.email}>
                        {userProfile.email.split('@')[0]}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-primary-500/60 font-mono mt-0.5">
                        {userProfile.role === 'ADMIN' ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {userProfile.role === 'ADMIN' ? 'مسؤول_نظام' : 'مستخدم'}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => handleNavClick('SETTINGS')}
                    className={`flex items-center justify-center gap-2 py-2 rounded text-[10px] font-bold transition-colors border ${currentView === 'SETTINGS' ? 'bg-primary-500/20 text-white border-primary-500/30' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10'}`}
                >
                    <Settings className="w-3 h-3" /> الإعدادات
                </button>
                <button 
                    onClick={onReset}
                    className="flex items-center justify-center gap-2 py-2 rounded bg-red-500/5 hover:bg-red-500/10 text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors border border-red-500/10"
                >
                    <LogOut className="w-3 h-3" /> خروج
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content Area - Margin Right for Sidebar on Desktop */}
      <main className="lg:mr-80 w-full flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        
        {/* Top Status Bar (HUD) */}
        <header className="h-16 border-b border-white/5 bg-[#020617]/90 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20 shadow-lg">
           <div className="flex items-center gap-4 lg:gap-6">
              <button 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="lg:hidden p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/10"
              >
                  <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/5 shadow-inner">
                <Radio className="w-3 h-3 text-success-500 animate-pulse" />
                <span className="text-[10px] font-mono text-slate-400 font-bold tracking-wider hidden sm:inline">
                    الاتصال: <span className="text-success-500">مستقر</span>
                </span>
              </div>
              
              <div className="hidden sm:block h-4 w-[1px] bg-white/10"></div>
              
              <div className="text-[10px] font-mono text-slate-500 tracking-wider hidden sm:block">
                زمن الاستجابة: <span className="text-primary-400">24ms</span>
              </div>
           </div>
           
           {/* Date/Time Display */}
           <div className="font-mono text-xs text-slate-500 flex gap-4">
                <span className="hidden sm:inline">الحالة: <span className="text-white">نشط</span></span>
                <span className="text-primary-500/50 hidden sm:inline">|</span>
                <span className="text-slate-300 font-sans">{new Date().toLocaleDateString('ar-EG')}</span>
           </div>
        </header>

        {/* Dynamic Viewport */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth bg-grid-pattern bg-[length:40px_40px]">
           {children}
        </div>

        {/* Persistent Terminal */}
        <TerminalLog />
      </main>
    </div>
  );
};