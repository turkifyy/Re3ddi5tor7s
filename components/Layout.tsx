
import React, { useState, useEffect } from 'react';
import { ViewState, UserProfile } from '../types';
import { LayoutDashboard, Users, Target, Terminal, Settings, LogOut, Cpu, Radio, Menu, MessageCircle, Search, WifiOff, X } from 'lucide-react';
import { TerminalLog } from './TerminalLog';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onReset: () => void;
  userProfile: UserProfile;
}

const BACKGROUND_IMAGES = [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1535868463750-c78d9543614f?q=80&w=2076&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop"
];

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, onReset, userProfile }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
    <div className="d-flex flex-column h-100">
      {/* --- BACKGROUND --- */}
      <div className="cinematic-bg-container">
          {BACKGROUND_IMAGES.map((img, index) => (
              <div 
                key={index} 
                className={`bg-slide ${index === currentBgIndex ? 'active' : ''}`}
                style={{backgroundImage: `url(${img})`}}
              ></div>
          ))}
      </div>
      <div className="bg-overlay"></div>

      {/* --- TOP NAVBAR (Mobile Trigger & Branding) --- */}
      <nav className="navbar navbar-dark fixed-top" style={{background: 'rgba(2,4,10,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
        <div className="container-fluid">
            <div className="d-flex align-items-center">
                <button 
                    className="btn btn-link text-white d-lg-none me-3" 
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
                <a className="navbar-brand fw-bold d-flex align-items-center" href="#">
                   <Cpu className="text-info me-2" />
                   REDDIT<span className="text-info">OPS</span> 
                   <span className="badge bg-dark border border-secondary ms-2 text-muted" style={{fontSize: '0.6rem'}}>PROD V6.0</span>
                </a>
            </div>
            
            <div className="d-flex align-items-center">
                 <div className={`modern-chip me-3 ${isOnline ? 'chip-glow-green' : 'chip-glow-red'}`}>
                     {isOnline ? <Radio size={14} className="me-2" /> : <WifiOff size={14} className="me-2" />}
                     {isOnline ? 'ONLINE' : 'OFFLINE'}
                 </div>
                 <button onClick={onReset} className="btn btn-sm btn-outline-danger d-none d-md-block">
                     <LogOut size={16} />
                 </button>
            </div>
        </div>
      </nav>

      <div className="container-fluid pt-5 mt-4 h-100">
          <div className="row h-100">
              
              {/* --- SIDEBAR --- */}
              <div className={`col-lg-2 col-md-3 bg-dark border-end border-secondary position-fixed h-100 d-flex flex-column p-0 start-0 transition-all ${mobileMenuOpen ? 'd-block' : 'd-none d-md-block'}`} 
                   style={{zIndex: 1040, paddingTop: '1rem', background: 'rgba(5, 8, 15, 0.95)'}}>
                  
                  <div className="px-3 mb-4 mt-3">
                      <div className="d-flex align-items-center p-3 rounded bg-secondary bg-opacity-10 border border-secondary border-opacity-25">
                           <div className="rounded-circle bg-gradient p-2 me-3 d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px', background: 'linear-gradient(45deg, #00f3ff, #bc13fe)'}}>
                               <Cpu size={20} className="text-black"/>
                           </div>
                           <div style={{overflow: 'hidden'}}>
                               <div className="fw-bold text-white text-truncate">{userProfile.email.split('@')[0]}</div>
                               <div className="text-info" style={{fontSize: '0.75rem'}}>Admin Access</div>
                           </div>
                      </div>
                  </div>

                  <ul className="nav flex-column px-2 flex-grow-1">
                      {navItems.map((item) => {
                          const Icon = item.icon;
                          const active = currentView === item.id;
                          return (
                              <li className="nav-item mb-1" key={item.id}>
                                  <a 
                                    href="#" 
                                    onClick={(e) => { e.preventDefault(); onNavigate(item.id as ViewState); setMobileMenuOpen(false); }}
                                    className={`nav-link d-flex align-items-center rounded ${active ? 'bg-primary bg-opacity-25 text-white border border-info border-opacity-25' : 'text-secondary'}`}
                                    style={{transition: '0.2s'}}
                                  >
                                      <Icon size={18} className={`me-3 ${active ? 'text-info' : ''}`} />
                                      {item.label}
                                  </a>
                              </li>
                          );
                      })}
                  </ul>

                  <div className="p-3 border-top border-secondary border-opacity-25 text-center text-muted" style={{fontSize: '0.7rem'}}>
                      &copy; 2024 RedditOps Platinum
                  </div>
              </div>

              {/* --- MAIN CONTENT --- */}
              <main className="col-lg-10 col-md-9 ms-auto px-md-4 py-4 mb-5" style={{paddingBottom: '200px'}}>
                  {children}
              </main>

          </div>
      </div>

      {/* --- FOOTER LOGS --- */}
      <div className="fixed-bottom border-top border-secondary border-opacity-25 bg-dark" style={{zIndex: 1030}}>
          <TerminalLog />
      </div>
    </div>
  );
};
