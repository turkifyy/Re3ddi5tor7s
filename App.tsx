
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AccountManager } from './components/AccountManager';
import { CampaignManager } from './components/CampaignManager';
import { InboxManager } from './components/InboxManager';
import { SettingsManager } from './components/SettingsManager';
import { TerminalLog } from './components/TerminalLog';
import { ToastProvider } from './components/ToastProvider';
import { SetupOverlay } from './components/SetupOverlay';
import { ViewState, UserProfile } from './types';
import { isFirebaseConfigured, getAuthInstance } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthService } from './services/authService';
import { roboticsEngine } from './services/roboticsEngine';
import { cronService } from './services/cronService';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [isConfigured, setIsConfigured] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Check configuration on load
  useEffect(() => {
      setIsConfigured(isFirebaseConfigured());
      setLoadingAuth(false);
      
      // Start Robotics Engine & Cron Scheduler
      roboticsEngine.startEngine();
      cronService.start();

      return () => {
          roboticsEngine.stopEngine();
          cronService.stop();
      };
  }, []);

  // Listen for Auth changes once configured
  useEffect(() => {
      if (!isConfigured) return;

      const auth = getAuthInstance();
      if (!auth) return;

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
              const profile = await AuthService.getCurrentProfile(user.uid);
              if (profile) setCurrentUser(profile);
              else setCurrentUser({ uid: user.uid, email: user.email!, role: 'USER', createdAt: '' }); // Fail-safe
          } else {
              setCurrentUser(null);
          }
      });

      return () => unsubscribe();
  }, [isConfigured]);

  const handleSetupComplete = (profile?: UserProfile) => {
    setIsConfigured(true);
    if (profile) setCurrentUser(profile);
  };

  // Function to handle Logout / Reset from the Settings menu
  const handleSystemReset = async () => {
     if(confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) {
         await AuthService.logout();
         setCurrentView('DASHBOARD');
     }
  };

  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return <Dashboard />;
      case 'ACCOUNTS':
        return <AccountManager />;
      case 'CAMPAIGNS':
        return <CampaignManager />;
      case 'INBOX':
        return <InboxManager />;
      case 'LOGS':
        return (
          <div className="h-full flex flex-col p-4">
            <h2 className="text-2xl font-bold text-white mb-6">سجلات تدقيق النظام</h2>
            <TerminalLog />
          </div>
        );
      case 'SETTINGS':
        return <SettingsManager onLogout={handleSystemReset} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ToastProvider>
        {(!isConfigured || !currentUser) ? (
            <SetupOverlay onComplete={handleSetupComplete} />
        ) : (
            <Layout 
                currentView={currentView} 
                onNavigate={setCurrentView} 
                onReset={handleSystemReset}
                userProfile={currentUser}
            >
                {renderView()}
            </Layout>
        )}
    </ToastProvider>
  );
}

export default App;
