
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { Settings, Server, Wifi, Database, Key, Save, Trash2, UploadCloud, Play } from 'lucide-react';
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

  // Bulk Import
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
    <div className="section">
        <h4 className="white-text"><Settings style={{verticalAlign: 'bottom'}}/> الإعدادات</h4>
        
        <div className="row">
            {/* Firebase Config */}
            <div className="col s12 l6">
                <div className="card blue-grey darken-3">
                    <div className="card-content white-text">
                        <span className="card-title"><Server size={20}/> Cloud Uplink</span>
                        <div className="row">
                            <div className="input-field col s12">
                                <input type="text" value={fbProjectId} onChange={e => setFbProjectId(e.target.value)} />
                                <label className="active">Firebase Project ID</label>
                            </div>
                            <div className="input-field col s12">
                                <input type="password" value={fbApiKey} onChange={e => setFbApiKey(e.target.value)} />
                                <label className="active">Web API Key</label>
                            </div>
                        </div>
                        <Button onClick={handleSaveFb}>Update Connection</Button>
                        <div className="chip right mt-4">
                            Status: {isConnected ? <span className="green-text">Online</span> : <span className="red-text">Offline</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Info */}
            <div className="col s12 l6">
                <div className="card blue-grey darken-3">
                    <div className="card-content white-text">
                        <span className="card-title"><Key size={20}/> DeepSeek API</span>
                         <div className="input-field">
                            <input type="password" value={dsKey} onChange={e => setDsKey(e.target.value)} />
                            <label className="active">API Key (sk-...)</label>
                        </div>
                        <Button onClick={handleSaveDs}>Save Key</Button>
                        <p className="grey-text text-lighten-1 mt-2" style={{fontSize: '0.8rem'}}>
                            Required for Auto-Replies & Sentiment Analysis.
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* Credentials Manager */}
        <div className="row">
            <div className="col s12">
                <div className="card-panel blue-grey darken-3">
                    <h5 className="white-text"><Database size={20}/> Credential Pool</h5>
                    <div className="row">
                        <div className="input-field col s12">
                            <textarea 
                                className="materialize-textarea"
                                placeholder="ClientID,Secret,User,Pass" 
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                            ></textarea>
                            <label className="active">Bulk Import (CSV)</label>
                        </div>
                        <div className="col s12">
                            <Button onClick={handleImport}><UploadCloud size={16}/> Import</Button>
                        </div>
                    </div>

                    <ul className="collection with-header border-none" style={{border: 'none'}}>
                        <li className="collection-header blue-grey darken-4 white-text"><h6>Active Nodes ({credPool.length})</h6></li>
                        {credPool.slice(0, 5).map(c => (
                            <li key={c.id} className="collection-item blue-grey darken-3 white-text avatar">
                                <i className="material-icons circle green">vpn_key</i>
                                <span className="title font-bold">{c.username}</span>
                                <p className="grey-text">Status: {c.status} | Usage: {c.dailyUsage}</p>
                                <a href="#!" className="secondary-content red-text" onClick={() => {credentialManager.removeCredential(c.id); setCredPool([...credentialManager.getPool()])}}>
                                    <Trash2 size={20}/>
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    </div>
  );
};
