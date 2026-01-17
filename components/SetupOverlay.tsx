
import React, { useState } from 'react';
import { Shield, Key, Server, Lock, Mail, Power, LogIn, Cpu } from 'lucide-react';
import { initializeFirebase, tryAutoConnect } from '../services/firebase';
import { AuthService } from '../services/authService';
import { Button } from './Button';

interface SetupOverlayProps {
    onComplete: (userProfile?: any) => void;
}

export const SetupOverlay: React.FC<SetupOverlayProps> = ({ onComplete }) => {
  const [projectId, setProjectId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSystemConfigured, setIsSystemConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
      tryAutoConnect().then(connected => setIsSystemConfigured(connected));
  }, []);

  const handleBootstrap = async () => {
      setIsLoading(true); setError('');
      try {
          const success = await initializeFirebase({ apiKey, projectId, authDomain: `${projectId}.firebaseapp.com` });
          if (!success) throw new Error("Invalid Config");
          const profile = await AuthService.register(email, password);
          onComplete(profile);
      } catch (e: any) { setError(e.message || "Setup Failed"); setIsLoading(false); }
  };

  const handleLogin = async () => {
      setIsLoading(true); setError('');
      try {
          const profile = await AuthService.login(email, password);
          onComplete(profile);
      } catch (e: any) { setError("Invalid Credentials"); setIsLoading(false); }
  };

  return (
    <div className="valign-wrapper" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
        background: 'rgba(2, 4, 10, 0.6)', backdropFilter: 'blur(5px)'
    }}>
        <div className="container">
            <div className="row">
                <div className="col s12 m6 offset-m3 l4 offset-l4">
                    <div className="card glass-panel animate-float" style={{
                        border: '1px solid rgba(0, 243, 255, 0.2)',
                        boxShadow: '0 0 50px rgba(0, 243, 255, 0.1)'
                    }}>
                        <div className="card-content white-text center-align" style={{padding: '40px 24px'}}>
                            
                            <div style={{
                                width: '80px', height: '80px', margin: '0 auto 20px', 
                                background: 'linear-gradient(135deg, rgba(0,243,255,0.1), rgba(188,19,254,0.1))',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 0 20px rgba(0,243,255,0.2)'
                            }}>
                                <Cpu size={40} className="cyan-text text-accent-2" />
                            </div>

                            <h4 className="bold mb-4" style={{letterSpacing: '3px', fontSize: '1.8rem'}}>
                                REDDIT<span className="cyan-text text-accent-2">OPS</span>
                            </h4>
                            
                            <div className="modern-chip chip-glow-blue mb-4">
                                {isSystemConfigured ? 'SECURE ACCESS' : 'INITIALIZING CORE'}
                            </div>

                            {error && <div className="card-panel red accent-2 black-text bold mt-4" style={{borderRadius: '8px'}}>{error}</div>}

                            {!isSystemConfigured ? (
                                <div className="left-align mt-4 animate-fade-in">
                                    <h6 className="grey-text center-align mb-4 text-lighten-1" style={{fontSize: '0.8rem'}}>Establish Firebase Uplink</h6>
                                    <div className="input-field">
                                        <input id="pid" type="text" value={projectId} onChange={e => setProjectId(e.target.value)}/>
                                        <label htmlFor="pid">Project ID</label>
                                    </div>
                                    <div className="input-field">
                                        <input id="key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}/>
                                        <label htmlFor="key">Web API Key</label>
                                    </div>
                                    <div className="input-field">
                                        <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}/>
                                        <label htmlFor="email">Admin Email</label>
                                    </div>
                                    <div className="input-field">
                                        <input id="pass" type="password" value={password} onChange={e => setPassword(e.target.value)}/>
                                        <label htmlFor="pass">Admin Password</label>
                                    </div>
                                    <Button className="width-100 btn-large mt-4" onClick={handleBootstrap} isLoading={isLoading}>
                                        <Power size={18} style={{marginRight: '8px'}}/> Initialize System
                                    </Button>
                                </div>
                            ) : (
                                <div className="left-align mt-4 animate-fade-in">
                                    <div className="input-field">
                                        <input id="l_email" type="email" value={email} onChange={e => setEmail(e.target.value)}/>
                                        <label htmlFor="l_email">Identity</label>
                                    </div>
                                    <div className="input-field">
                                        <input id="l_pass" type="password" value={password} onChange={e => setPassword(e.target.value)}/>
                                        <label htmlFor="l_pass">Passcode</label>
                                    </div>
                                    <Button className="width-100 btn-large mt-4" onClick={handleLogin} isLoading={isLoading}>
                                        <LogIn size={18} style={{marginRight: '8px'}}/> Authenticate
                                    </Button>
                                    <div className="center-align mt-4">
                                        <a href="#!" className="red-text text-accent-2 small" onClick={() => {localStorage.clear(); window.location.reload();}} style={{opacity: 0.6}}>Reset Uplink Configuration</a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
