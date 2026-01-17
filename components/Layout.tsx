
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, UserProfile } from '../types';
import { LayoutDashboard, Users, Target, Terminal, Settings, LogOut, Cpu, Radio, Menu, ShieldCheck, User, MessageCircle, Book, Search, WifiOff } from 'lucide-react';
import { TerminalLog } from './TerminalLog';

declare const window: any;

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onReset: () => void;
  userProfile: UserProfile;
}

// PROFESSIONAL 4K WALLPAPERS (Cyberpunk, Abstract Tech, Deep Space)
const BACKGROUND_IMAGES = [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop", // Chip/Processor
    "https://images.unsplash.com/photo-1535868463750-c78d9543614f?q=80&w=2076&auto=format&fit=crop", // Cyber City Neon
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop", // Global Network
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop", // Dark Security Room
    "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?q=80&w=2070&auto=format&fit=crop", // Abstract Neon Curves
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2034&auto=format&fit=crop"  // Server Lights
];

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, onReset, userProfile }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const sidenavRef = useRef<HTMLUListElement>(null);
  const sidenavInstance = useRef<any>(null);

  useEffect(() => {
    // 1. Connection Monitoring
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Materialize Init (Robust)
    if (sidenavRef.current && window.M) {
        sidenavInstance.current = window.M.Sidenav.init(sidenavRef.current, {
            edge: 'left',
            draggable: true
        });
    }

    // 3. BACKGROUND ROTATION ENGINE
    const bgInterval = setInterval(() => {
        setCurrentBgIndex(prev => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 15000); // Rotate every 15 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(bgInterval);
      if (sidenavInstance.current) {
          sidenavInstance.current.destroy();
      }
    };
  }, []);

  const handleNavClick = (view: ViewState) => {
      onNavigate(view);
      // Close sidebar on mobile when clicked
      if (window.innerWidth < 992 && sidenavInstance.current) {
          sidenavInstance.current.close();
      }
  };

  const navItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ACCOUNTS', label: 'Identity Matrix', icon: Users },
    { id: 'CAMPAIGNS', label: 'Campaigns', icon: Target },
    { id: 'SCRAPER', label: 'Lead Scraper', icon: Search },
    { id: 'INBOX', label: 'Direct Inbox', icon: MessageCircle },
    { id: 'LOGS', label: 'Kernel Logs', icon: Terminal },
    { id: 'SETTINGS', label: 'Configuration', icon: Settings },
  ];

  return (
    <>
      {/* --- CINEMATIC BACKGROUND LAYER --- */}
      <div className="cinematic-bg-container">
          {BACKGROUND_IMAGES.map((img, index) => (
              <div 
                key={index} 
                className={`bg-slide ${index === currentBgIndex ? 'active' : ''}`}
                style={{backgroundImage: `url(${img})`}}
              ></div>
          ))}
          {/* Fallback Gradient in case images fail */}
          <div style={{
              position: 'absolute', inset: 0, zIndex: -1, 
              background: 'linear-gradient(135deg, #02040a 0%, #1e1b4b 100%)'
          }}></div>
      </div>
      
      {/* --- LAYERS FOR DEPTH --- */}
      <div className="bg-overlay"></div>
      <div className="tech-grid-overlay"></div>

      {/* Navbar - Floating Glass */}
      <div className="navbar-fixed">
        <nav className="transparent z-depth-0" style={{borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)'}}>
          <div className="nav-wrapper container" style={{width: '95%', maxWidth: '1400px'}}>
            <a href="#!" className="brand-logo left hide-on-med-and-down" style={{fontSize: '1.8rem'}}>
              REDDIT<span>OPS</span>
            </a>
            <a href="#!" className="brand-logo center hide-on-large-only">
              R<span>OPS</span>
            </a>
            
            <a href="#" data-target="mobile-demo" className="sidenav-trigger right"><Menu className="cyan-text" /></a>

            <ul className="right hide-on-med-and-down">
               <li>
                   <div className="modern-chip" style={{
                       background: isOnline ? 'rgba(0,255,157,0.1)' : 'rgba(255,0,85,0.1)', 
                       border: '1px solid ' + (isOnline ? '#00ff9d' : '#ff0055')
                   }}>
                       {isOnline ? <Radio size={14} className="green-text accent-4" style={{marginRight: '8px'}} /> : <WifiOff size={14} className="red-text" style={{marginRight: '8px'}} />}
                       <span style={{fontSize: '0.7rem', fontWeight: 'bold', color: isOnline ? '#00ff9d' : '#ff0055'}}>{isOnline ? 'SYSTEM ONLINE' : 'DISCONNECTED'}</span>
                   </div>
               </li>
               <li style={{marginLeft: '20px'}}>
                   <a href="#!" className="tooltipped" data-position="bottom" data-tooltip={userProfile.email} style={{display: 'flex', alignItems: 'center'}}>
                       <div style={{width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,243,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,243,255,0.3)'}}>
                           <User size={16} className="cyan-text" />
                       </div>
                   </a>
               </li>
               <li>
                   <a href="#!" onClick={onReset}>
                       <LogOut size={18} className="red-text text-accent-2" />
                   </a>
               </li>
            </ul>
          </div>
        </nav>
      </div>

      {/* Sidenav (Sidebar) - Dark Glass */}
      <ul className="sidenav sidenav-fixed glass-panel" id="mobile-demo" ref={sidenavRef} style={{
          top: '70px', 
          height: 'calc(100% - 90px)', 
          width: '280px', 
          margin: '10px',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <li style={{marginBottom: '20px'}}>
            <div className="user-view" style={{padding: '32px 32px 0 32px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px'}}>
                    <div className="pulse" style={{width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(45deg, #00f3ff, #bc13fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(0,243,255,0.3)'}}>
                        <Cpu size={24} color="black"/>
                    </div>
                    <div>
                        <span className="white-text name bold" style={{fontSize: '1rem', letterSpacing: '1px'}}>{userProfile.role}</span>
                        <span className="grey-text text-lighten-1 email" style={{fontSize: '0.75rem', fontFamily: 'monospace'}}>V6.0.0 PROD</span>
                    </div>
                </div>
            </div>
            <div className="divider" style={{margin: '0 20px', opacity: 0.1}}></div>
        </li>
        {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
                <li key={item.id} className={active ? 'active' : ''} style={{margin: '4px 0'}}>
                    <a href="#!" onClick={() => handleNavClick(item.id as ViewState)} className="waves-effect flex-center" style={{
                        justifyContent: 'flex-start', 
                        paddingLeft: '32px', 
                        height: '50px',
                        position: 'relative'
                    }}>
                        <Icon size={20} style={{marginRight: '15px', color: active ? '#00f3ff' : '#94a3b8', transition: '0.3s'}} />
                        <span style={{
                            fontWeight: active ? 'bold' : 'normal', 
                            fontSize: '0.85rem', 
                            letterSpacing: '0.5px',
                            color: active ? '#fff' : '#94a3b8'
                        }}>{item.label}</span>
                        
                        {/* Active Glow Indicator */}
                        {active && <div style={{
                            position: 'absolute', 
                            right: '0', 
                            top: '50%', 
                            transform: 'translateY(-50%)', 
                            width: '4px', 
                            height: '20px', 
                            background: '#00f3ff', 
                            boxShadow: '0 0 10px #00f3ff'
                        }}></div>}
                    </a>
                </li>
            );
        })}
      </ul>

      {/* Main Content - Unified for Mobile/Desktop */}
      {/* We use specific class logic to handle margin shifting */}
      <main className="main-content-wrapper" style={{
          minHeight: '100vh', 
          paddingBottom: '200px', 
          transition: 'all 0.3s'
      }}>
         <div className="container" style={{width: '95%', maxWidth: '1600px', paddingTop: '30px'}}>
             {children}
         </div>
      </main>

      {/* Footer / Terminal */}
      <footer className="page-footer transparent terminal-footer" style={{
          position: 'fixed', bottom: 0, width: '100%', paddingBottom: '10px', zIndex: 999
      }}>
         <TerminalLog />
      </footer>
    </>
  );
};
