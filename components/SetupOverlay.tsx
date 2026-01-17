
import React, { useState } from 'react';
import { Cpu, Power, LogIn } from 'lucide-react';
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
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{zIndex: 9999, background: 'rgba(2, 4, 10, 0.8)', backdropFilter: 'blur(10px)'}}>
        <div className="card border-info" style={{maxWidth: '450px', width: '90%', boxShadow: '0 0 50px rgba(0, 243, 255, 0.15)'}}>
            <div className="card-body p-5 text-center">
                
                <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4" style={{
                    width: '80px', height: '80px', 
                    background: 'linear-gradient(135deg, rgba(0,243,255,0.1), rgba(188,19,254,0.1))',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <Cpu size={40} className="text-info" />
                </div>

                <h3 className="fw-bold mb-4 text-white" style={{letterSpacing: '2px'}}>
                    REDDIT<span className="text-info">OPS</span>
                </h3>
                
                <div className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 mb-4 p-2">
                    {isSystemConfigured ? 'SECURE ACCESS' : 'INITIALIZING CORE'}
                </div>

                {error && <div className="alert alert-danger mb-4">{error}</div>}

                {!isSystemConfigured ? (
                    <div className="text-start animate-fade-in">
                        <p className="text-center text-muted mb-4 small">Establish Firebase Uplink</p>
                        <div className="mb-3">
                            <label className="form-label small text-muted">Project ID</label>
                            <input className="form-control" type="text" value={projectId} onChange={e => setProjectId(e.target.value)}/>
                        </div>
                        <div className="mb-3">
                            <label className="form-label small text-muted">Web API Key</label>
                            <input className="form-control" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}/>
                        </div>
                        <div className="mb-3">
                            <label className="form-label small text-muted">Admin Email</label>
                            <input className="form-control" type="email" value={email} onChange={e => setEmail(e.target.value)}/>
                        </div>
                        <div className="mb-4">
                            <label className="form-label small text-muted">Admin Password</label>
                            <input className="form-control" type="password" value={password} onChange={e => setPassword(e.target.value)}/>
                        </div>
                        <Button className="w-100 btn-lg" onClick={handleBootstrap} isLoading={isLoading}>
                            <Power size={18} className="me-2"/> Initialize System
                        </Button>
                    </div>
                ) : (
                    <div className="text-start animate-fade-in">
                        <div className="mb-3">
                            <label className="form-label small text-muted">Identity</label>
                            <input className="form-control" type="email" value={email} onChange={e => setEmail(e.target.value)}/>
                        </div>
                        <div className="mb-4">
                            <label className="form-label small text-muted">Passcode</label>
                            <input className="form-control" type="password" value={password} onChange={e => setPassword(e.target.value)}/>
                        </div>
                        <Button className="w-100 btn-lg mb-4" onClick={handleLogin} isLoading={isLoading}>
                            <LogIn size={18} className="me-2"/> Authenticate
                        </Button>
                        <div className="text-center">
                            <a href="#!" className="text-danger small text-decoration-none opacity-50" onClick={() => {localStorage.clear(); window.location.reload();}}>Reset Uplink Configuration</a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
