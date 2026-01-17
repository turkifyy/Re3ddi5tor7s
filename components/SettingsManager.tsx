
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { Settings, Server, Key, Database, UploadCloud, Trash2 } from 'lucide-react';
import { isFirebaseConfigured, initializeFirebase } from '../services/firebase';
import { credentialManager } from '../services/credentialManager';
import { getDeepSeekKey, setDeepSeekKey } from '../services/deepseekService';

interface SettingsProps { onLogout: () => void; }

export const SettingsManager: React.FC<SettingsProps> = ({ onLogout }) => {
  const { addToast } = useToast();
  const isConnected = isFirebaseConfigured();
  
  const [credPool, setCredPool] = useState(credentialManager.getPool());
  const [fbProjectId, setFbProjectId] = useState('');
  const [fbApiKey, setFbApiKey] = useState('');
  const [dsKey, setDsKey] = useState(getDeepSeekKey());
  const [bulkText, setBulkText] = useState('');

  useEffect(() => {
      const stored = localStorage.getItem('redditops_fb_config');
      if (stored) {
          const c = JSON.parse(stored);
          setFbProjectId(c.projectId);
          setFbApiKey(c.apiKey);
      }
  }, []);

  const handleSaveFb = async () => {
      const success = await initializeFirebase({ apiKey: fbApiKey, projectId: fbProjectId, authDomain: `${fbProjectId}.firebaseapp.com` });
      if (success) {
          addToast('success', 'Firebase Connected');
          window.location.reload();
      } else {
          addToast('error', 'Connection Failed');
      }
  };

  const handleSaveDs = () => {
      if(!dsKey.startsWith('sk-')) {
          addToast('error', 'Invalid Key Format');
          return;
      }
      setDeepSeekKey(dsKey);
      addToast('success', 'DeepSeek Key Saved');
  };

  const handleImport = () => {
      credentialManager.importCredentials(bulkText);
      setCredPool([...credentialManager.getPool()]);
      setBulkText('');
      addToast('success', 'Imported');
  };

  return (
    <div className="container-fluid p-0">
        <h3 className="fw-bold text-white mb-4"><Settings className="me-2"/> Settings</h3>
        
        <div className="row mb-4">
            {/* Firebase Config */}
            <div className="col-lg-6 mb-4">
                <div className="card h-100">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <h5 className="card-title fw-bold"><Server size={20} className="me-2"/> Cloud Uplink</h5>
                            <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'}`}>
                                {isConnected ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <div className="mb-3">
                            <label className="form-label text-muted">Firebase Project ID</label>
                            <input type="text" className="form-control" value={fbProjectId} onChange={e => setFbProjectId(e.target.value)} />
                        </div>
                        <div className="mb-4">
                            <label className="form-label text-muted">Web API Key</label>
                            <input type="password" className="form-control" value={fbApiKey} onChange={e => setFbApiKey(e.target.value)} />
                        </div>
                        <Button onClick={handleSaveFb}>Update Connection</Button>
                    </div>
                </div>
            </div>

            {/* AI Info */}
            <div className="col-lg-6 mb-4">
                <div className="card h-100">
                    <div className="card-body">
                        <h5 className="card-title fw-bold mb-3"><Key size={20} className="me-2"/> DeepSeek API</h5>
                        <div className="mb-3">
                            <label className="form-label text-muted">API Key (sk-...)</label>
                            <input type="password" className="form-control" value={dsKey} onChange={e => setDsKey(e.target.value)} />
                        </div>
                        <Button onClick={handleSaveDs}>Save Key</Button>
                        <div className="text-muted small mt-3">Required for Auto-Replies & Sentiment Analysis.</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Credentials Manager */}
        <div className="card">
            <div className="card-body">
                <h5 className="card-title fw-bold mb-4"><Database size={20} className="me-2"/> Credential Pool</h5>
                <div className="row g-3 align-items-end mb-4">
                    <div className="col-md-10">
                        <label className="form-label text-muted">Bulk Import (CSV: ClientID,Secret,User,Pass)</label>
                        <textarea 
                            className="form-control"
                            rows={2}
                            placeholder="Paste CSV here..." 
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                        ></textarea>
                    </div>
                    <div className="col-md-2">
                        <Button onClick={handleImport} className="w-100"><UploadCloud size={16} className="me-2"/> Import</Button>
                    </div>
                </div>

                <div className="list-group">
                    <div className="list-group-item bg-dark border-secondary border-opacity-25 text-white fw-bold">Active Nodes ({credPool.length})</div>
                    {credPool.slice(0, 5).map(c => (
                        <div key={c.id} className="list-group-item bg-transparent text-white border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-key-fill text-success me-3"></i>
                                <div>
                                    <div className="fw-bold">{c.username}</div>
                                    <small className="text-muted">Status: {c.status} | Usage: {c.dailyUsage}</small>
                                </div>
                            </div>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => {credentialManager.removeCredential(c.id); setCredPool([...credentialManager.getPool()])}}>
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};
