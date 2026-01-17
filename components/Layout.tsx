
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

// CINEMATIC WALLPAPERS
const BACKGROUND_IMAGES = [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1535868463750-c78d9543614f?q=80&w=2076&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop"
];

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, onReset, userProfile }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const sidenavRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    // 1. Connection Monitoring
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Materialize Init (Safe Check)
    if (sidenavRef.current && window.M) {
        window.M.Sidenav.init(sidenavRef.current, {
            edge: 'left',
            draggable: true
        });
    }

    // 3. BACKGROUND ROTATION
    const bgInterval = setInterval(() => {
        setCurrentBgIndex(prev => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 20000); 

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(bgInterval);
    };
  }, []);

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
          {/* Fallback color */}
          <div style={{
              position: 'absolute', inset: 0, zIndex: -1, 
              background: 'linear-gradient(135deg, #02040a 0%, #0f172a 100%)'
          }}></div>
      </div>
      
      {/* --- OVERLAYS --- */}
      <div className="bg-overlay"></div>
      <div className="tech-grid-overlay"></div>

      {/* --- TOP NAVBAR --- */}
      <div className="navbar-fixed">
        <nav className="z-depth-0">
          <div className="nav-wrapper container" style={{width: '98%', maxWidth: '1800px'}}>
            {/* Mobile Hamburger */}
            <a href="#" data-target="mobile-demo" className="sidenav-trigger left"><Menu className="cyan-text" /></a>

            <a href="#!" className="brand-logo center hide-on-large-only">
              R<span>OPS</span>
            </a>
            <a href="#!" className="brand-logo left hide-on-med-and-down" style={{fontSize: '1.5rem', marginLeft: '10px'}}>
              REDDIT<span>OPS</span> <span style={{fontSize: '0.8rem', color: '#94a3b8', marginLeft: '10px'}}>PROD V6.0</span>
            </a>

            <ul className="right hide-on-med-and-down">
               <li>
                   <div className="modern-chip" style={{
                       background: isOnline ? 'rgba(0,255,157,0.1)' : 'rgba(255,0,85,0.1)', 
                       border: '1px solid ' + (isOnline ? '#00ff9d' : '#ff0055')
                   }}>
                       {isOnline ? <Radio size={14} className="green-text accent-4" style={{marginRight: '8px'}} /> : <WifiOff size={14} className="red-text" style={{marginRight: '8px'}} />}
                       <span style={{color: isOnline ? '#00ff9d' : '#ff0055'}}>{isOnline ? 'SYSTEM ONLINE' : 'OFFLINE'}</span>
                   </div>
               </li>
               <li style={{marginLeft: '15px'}}>
                   <a href="#!" onClick={onReset} className="tooltipped" data-tooltip="Logout">
                       <LogOut size={20} className="red-text text-accent-2" />
                   </a>
               </li>
            </ul>
          </div>
        </nav>
      </div>

      {/* --- SIDEBAR (SIDENAV) --- */}
      <ul className="sidenav sidenav-fixed" id="mobile-demo" ref={sidenavRef}>
        <li>
            <div className="user-view" style={{padding: '32px 32px 0 32px', marginBottom: '10px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px'}}>
                    <div className="pulse" style={{
                        width: '48px', height: '48px', borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #00f3ff, #bc13fe)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Cpu size={28} color="#000"/>
                    </div>
                    <div style={{overflow: 'hidden'}}>
                        <span className="white-text name bold truncate" style={{fontSize: '1rem', letterSpacing: '0.5px'}}>{userProfile.email.split('@')[0]}</span>
                        <span className="cyan-text text-accent-2 email" style={{fontSize: '0.75rem'}}>Admin Access</span>
                    </div>
                </div>
            </div>
            <div className="divider" style={{margin: '0 20px', opacity: 0.1}}></div>
        </li>
        
        {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
                <li key={item.id} className={active ? 'active' : ''}>
                    <a href="#!" onClick={() => onNavigate(item.id as ViewState)} className="waves-effect white-text" style={{
                        display: 'flex', alignItems: 'center', paddingLeft: '32px', height: '54px'
                    }}>
                        <Icon size={20} style={{marginRight: '16px', color: active ? '#00f3ff' : '#64748b', opacity: active ? 1 : 0.7}} />
                        <span style={{fontWeight: active ? '700' : '400', letterSpacing: '0.5px'}}>{item.label}</span>
                        {active && <div style={{marginLeft: 'auto', marginRight: '20px', width: '6px', height: '6px', borderRadius: '50%', background: '#00f3ff', boxShadow: '0 0 8px #00f3ff'}}></div>}
                    </a>
                </li>
            );
        })}
      </ul>

      {/* --- MAIN CONTENT AREA --- */}
      {/* The padding-left is handled by the media queries in index.html now */}
      <main style={{transition: '0.3s', paddingBottom: '220px'}}> 
         <div className="container" style={{width: '95%', maxWidth: '1600px', paddingTop: '20px'}}>
             {children}
         </div>
      </main>

      {/* --- FOOTER TERMINAL --- */}
      <footer style={{
          position: 'fixed', bottom: 0, left: 0, width: '100%', 
          zIndex: 890, /* Below sidebar on mobile, pushed by padding on desktop */
          borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
         <TerminalLog />
      </footer>
    </>
  );
};
