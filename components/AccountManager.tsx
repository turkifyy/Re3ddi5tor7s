
import React, { useEffect, useState } from 'react';
import { RedditAccount, AccountStatus } from '../types';
import { Button } from './Button';
import { DatabaseService } from '../services/databaseService';
import { AnalyticsEngine } from '../services/analyticsEngine'; 
import { useToast } from './ToastProvider';
import { Shield, RefreshCw, Trash2, Plus, Brain, UserPlus } from 'lucide-react';
import { credentialManager } from '../services/credentialManager';
import { deepseekService } from '../services/deepseekService';

export const AccountManager: React.FC = () => {
  const [accounts, setAccounts] = useState<RedditAccount[]>([]);
  const [localPool, setLocalPool] = useState<any[]>([]); 
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();
  
  const [newUsername, setNewUsername] = useState('');
  const [newProxy, setNewProxy] = useState('');

  // Analysis
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      await credentialManager.pullFromCloudVault();
      const data = await DatabaseService.getAccounts();
      const pool = credentialManager.getPool(); 
      setLocalPool(pool);

      const processedData = data.map(acc => ({
          ...acc,
          healthScore: AnalyticsEngine.calculateAccountHealth(acc)
      }));

      setAccounts(processedData);
    } catch (err) {
      addToast('error', 'Sync Failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddAccount = async () => {
    if (!newUsername) return;
    try {
      setIsLoading(true);
      await DatabaseService.addAccount({
        username: newUsername.startsWith('u/') ? newUsername : `u/${newUsername}`,
        proxyIp: newProxy || 'Direct',
        status: AccountStatus.ACTIVE,
        karma: 0,
        accountAgeDays: 0,
        lastActive: 'Now',
        healthScore: 100
      });
      addToast('success', 'Account Added');
      await fetchAccounts();
      setIsAdding(false);
      setNewUsername('');
    } catch (err) {
      addToast('error', 'DB Error');
    } finally {
      setIsLoading(false);
    }
  };

  const executeAnalysis = async () => {
    if (!analysisId || !analysisText) return;
    setIsAnalyzing(true);
    try {
        const result = await deepseekService.analyzeSentiment(analysisText);
        await DatabaseService.updateAccountSentiment(analysisId, result);
        addToast('success', `Sentiment: ${result.label}`);
        await fetchAccounts();
        setAnalysisId(null);
    } catch (e) {
        addToast('error', 'Analysis Failed');
    } finally {
        setIsAnalyzing(false);
    }
  };

  const getUsageStats = (username: string) => {
      const cleanName = username.replace('u/', '');
      const cred = localPool.find(p => p.username === cleanName);
      return cred ? { daily: cred.dailyUsage || 0, max: 100 } : { daily: 0, max: 100 };
  };

  return (
    <div className="section">
       {/* Modal for Analysis */}
       {analysisId && (
           <div className="modal glass-panel" style={{display: 'block', top: '20%', zIndex: 1003, opacity: 1, transform: 'scaleX(1) scaleY(1)', maxWidth: '600px'}}>
               <div className="modal-content">
                   <h4 style={{fontSize: '1.5rem'}}><Brain size={24} className="purple-text" style={{verticalAlign: 'bottom'}}/> AI Sentiment Audit</h4>
                   <p className="grey-text">Paste recent comment text to analyze account alignment.</p>
                   <div className="input-field mt-4">
                       <textarea 
                        className="materialize-textarea white-text" 
                        value={analysisText}
                        onChange={e => setAnalysisText(e.target.value)}
                        placeholder="Paste content here..."
                        style={{minHeight: '120px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: 'none'}}
                       ></textarea>
                   </div>
               </div>
               <div className="modal-footer transparent">
                   <Button variant="ghost" onClick={() => setAnalysisId(null)} style={{marginRight: '10px'}}>Cancel</Button>
                   <Button onClick={executeAnalysis} isLoading={isAnalyzing}>Run Analysis</Button>
               </div>
           </div>
       )}
       {analysisId && <div className="modal-overlay" style={{zIndex: 1002, display: 'block', opacity: 0.7, backdropFilter: 'blur(5px)'}}></div>}

       <div className="row valign-wrapper mb-4">
           <div className="col s12 m6">
               <h4 className="white-text" style={{fontWeight: 800, margin: 0}}><Shield size={28} className="cyan-text" style={{verticalAlign: 'bottom', marginRight: '10px'}}/> Identity Matrix</h4>
               <p className="grey-text text-lighten-1" style={{margin: '5px 0 0 38px'}}>Manage {accounts.length} active nodes</p>
           </div>
           <div className="col s12 m6 right-align">
               <Button variant="secondary" onClick={fetchAccounts} className="glass-panel"><RefreshCw size={16}/></Button>
               <Button onClick={() => setIsAdding(!isAdding)} style={{marginLeft: '10px'}}><UserPlus size={16} style={{marginRight: '8px'}}/> Deploy Node</Button>
           </div>
       </div>

       {isAdding && (
           <div className="card-panel glass-panel animate-float" style={{marginBottom: '30px'}}>
               <div className="row mb-0">
                   <div className="input-field col s12 m5">
                       <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                       <label className="active">Reddit Username</label>
                   </div>
                   <div className="input-field col s12 m5">
                       <input type="text" value={newProxy} onChange={e => setNewProxy(e.target.value)} />
                       <label className="active">Proxy IP (Optional)</label>
                   </div>
                   <div className="col s12 m2" style={{marginTop: '25px'}}>
                       <Button onClick={handleAddAccount} isLoading={isLoading} className="width-100">Initialize</Button>
                   </div>
               </div>
           </div>
       )}

       <div className="card glass-panel" style={{overflowX: 'auto'}}>
           <div className="card-content p-0">
               <table className="highlight centered">
                   <thead>
                       <tr>
                           <th className="left-align pl-4">Identity</th>
                           <th>Daily Quota</th>
                           <th>Karma</th>
                           <th>Sentiment</th>
                           <th>Trust Score</th>
                           <th className="right-align pr-4">Actions</th>
                       </tr>
                   </thead>
                   <tbody>
                       {accounts.map(acc => {
                           const usage = getUsageStats(acc.username);
                           return (
                               <tr key={acc.id} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                   <td className="left-align pl-4">
                                       <div className="valign-wrapper">
                                            <div className="btn-floating btn-small cyan accent-4" style={{marginRight: '10px', color: '#000', fontWeight: 'bold'}}>{acc.username[2].toUpperCase()}</div>
                                            <span className="font-mono white-text" style={{fontSize: '0.9rem'}}>{acc.username}</span>
                                       </div>
                                   </td>
                                   <td>
                                       <div style={{width: '120px', margin: '0 auto'}}>
                                            <div className="flex-between" style={{fontSize: '0.7rem', marginBottom: '4px'}}>
                                                <span className={usage.daily >= 100 ? "red-text" : "grey-text"}>{usage.daily}/100</span>
                                                <span className="grey-text text-darken-1">{Math.round((usage.daily/100)*100)}%</span>
                                            </div>
                                            <div className="progress grey darken-4" style={{height: '4px', borderRadius: '2px', margin: 0}}>
                                                <div className={`determinate ${usage.daily >= 100 ? 'red accent-3' : 'green accent-4'}`} style={{width: `${usage.daily}%`}}></div>
                                            </div>
                                       </div>
                                   </td>
                                   <td><span className="white-text font-mono">{acc.karma.toLocaleString()}</span></td>
                                   <td>
                                       {acc.sentiment ? (
                                           <span className={`modern-chip ${acc.sentiment.label === 'Positive' ? 'chip-glow-green' : acc.sentiment.label === 'Negative' ? 'chip-glow-red' : 'chip-glow-blue'}`}>
                                               {acc.sentiment.label}
                                           </span>
                                       ) : <span className="grey-text">-</span>}
                                   </td>
                                   <td>
                                       <div className="valign-wrapper justify-center">
                                            <span style={{marginRight: '8px', fontWeight: 'bold'}} className={acc.healthScore > 80 ? 'green-text text-accent-4' : 'orange-text'}>{acc.healthScore}%</span>
                                       </div>
                                   </td>
                                   <td className="right-align pr-4">
                                       <button className="btn-floating btn-small transparent z-depth-0" onClick={() => setAnalysisId(acc.id)} style={{marginRight: '5px'}}>
                                            <Brain size={16} className="purple-text text-accent-2"/>
                                       </button>
                                       <button className="btn-floating btn-small transparent z-depth-0" onClick={() => {if(confirm('Delete?')) DatabaseService.deleteAccount(acc.id)}}>
                                            <Trash2 size={16} className="red-text text-accent-2"/>
                                       </button>
                                   </td>
                               </tr>
                           )
                       })}
                   </tbody>
               </table>
           </div>
       </div>
    </div>
  );
};
