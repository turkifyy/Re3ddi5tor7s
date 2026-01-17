
import React, { useEffect, useState } from 'react';
import { RedditAccount, AccountStatus } from '../types';
import { Button } from './Button';
import { DatabaseService } from '../services/databaseService';
import { AnalyticsEngine } from '../services/analyticsEngine'; 
import { useToast } from './ToastProvider';
import { Shield, RefreshCw, Trash2, Plus, Brain, UserPlus, X } from 'lucide-react';
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

  useEffect(() => { fetchAccounts(); }, []);

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
    <div className="container-fluid p-0">
       {/* Modal for Analysis */}
       {analysisId && (
           <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1050}}>
               <div className="modal-dialog modal-dialog-centered">
                   <div className="modal-content bg-dark border border-secondary">
                       <div className="modal-header border-secondary">
                           <h5 className="modal-title text-white"><Brain size={24} className="text-purple me-2"/> DeepSeek Audit</h5>
                           <button type="button" className="btn-close btn-close-white" onClick={() => setAnalysisId(null)}></button>
                       </div>
                       <div className="modal-body">
                           <p className="text-muted">Paste recent comment text to analyze account alignment.</p>
                           <textarea 
                            className="form-control bg-black text-white border-secondary" 
                            rows={5}
                            value={analysisText}
                            onChange={e => setAnalysisText(e.target.value)}
                            placeholder="Paste content here..."
                           ></textarea>
                       </div>
                       <div className="modal-footer border-secondary">
                           <Button variant="secondary" onClick={() => setAnalysisId(null)}>Cancel</Button>
                           <Button onClick={executeAnalysis} isLoading={isAnalyzing}>Run Analysis</Button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       <div className="d-flex justify-content-between align-items-center mb-4">
           <div>
               <h3 className="fw-bold text-white mb-0"><Shield size={28} className="text-info me-2"/> Identity Matrix</h3>
               <p className="text-muted ms-5 mb-0">Manage {accounts.length} active nodes</p>
           </div>
           <div>
               <Button variant="secondary" onClick={fetchAccounts} className="me-2"><RefreshCw size={16}/></Button>
               <Button onClick={() => setIsAdding(!isAdding)}><UserPlus size={16} className="me-2"/> Deploy Node</Button>
           </div>
       </div>

       {isAdding && (
           <div className="card mb-4 border-info">
               <div className="card-body">
                   <div className="row g-3 align-items-end">
                       <div className="col-md-5">
                           <label className="form-label text-muted">Reddit Username</label>
                           <input type="text" className="form-control" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                       </div>
                       <div className="col-md-5">
                           <label className="form-label text-muted">Proxy IP</label>
                           <input type="text" className="form-control" value={newProxy} onChange={e => setNewProxy(e.target.value)} />
                       </div>
                       <div className="col-md-2">
                           <Button onClick={handleAddAccount} isLoading={isLoading} className="w-100">Initialize</Button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       <div className="card">
           <div className="card-body p-0">
               <div className="table-responsive">
                   <table className="table table-dark table-hover mb-0 align-middle">
                       <thead className="bg-secondary bg-opacity-10 text-secondary text-uppercase fs-7">
                           <tr>
                               <th className="ps-4 py-3">Identity</th>
                               <th>Daily Quota</th>
                               <th>Karma</th>
                               <th>Sentiment</th>
                               <th>Trust Score</th>
                               <th className="text-end pe-4">Actions</th>
                           </tr>
                       </thead>
                       <tbody>
                           {accounts.map(acc => {
                               const usage = getUsageStats(acc.username);
                               return (
                                   <tr key={acc.id}>
                                       <td className="ps-4">
                                           <div className="d-flex align-items-center">
                                                <div className="rounded-circle bg-info text-black fw-bold d-flex align-items-center justify-content-center me-3" style={{width: '32px', height: '32px'}}>
                                                    {acc.username[2].toUpperCase()}
                                                </div>
                                                <span className="font-monospace text-white">{acc.username}</span>
                                           </div>
                                       </td>
                                       <td>
                                           <div style={{width: '120px'}}>
                                                <div className="d-flex justify-content-between small mb-1">
                                                    <span className={usage.daily >= 100 ? "text-danger" : "text-muted"}>{usage.daily}/100</span>
                                                    <span className="text-muted">{Math.round((usage.daily/100)*100)}%</span>
                                                </div>
                                                <div className="progress" style={{height: '4px'}}>
                                                    <div className={`progress-bar ${usage.daily >= 100 ? 'bg-danger' : 'bg-success'}`} style={{width: `${usage.daily}%`}}></div>
                                                </div>
                                           </div>
                                       </td>
                                       <td><span className="font-monospace">{acc.karma.toLocaleString()}</span></td>
                                       <td>
                                           {acc.sentiment ? (
                                               <span className={`modern-chip ${acc.sentiment.label === 'Positive' ? 'chip-glow-green' : acc.sentiment.label === 'Negative' ? 'chip-glow-red' : 'chip-glow-blue'}`}>
                                                   {acc.sentiment.label}
                                               </span>
                                           ) : <span className="text-muted">-</span>}
                                       </td>
                                       <td>
                                            <span className={`fw-bold ${acc.healthScore > 80 ? 'text-success' : 'text-warning'}`}>{acc.healthScore}%</span>
                                       </td>
                                       <td className="text-end pe-4">
                                           <button className="btn btn-sm btn-link p-0 me-3" onClick={() => setAnalysisId(acc.id)}>
                                                <Brain size={16} className="text-purple"/>
                                           </button>
                                           <button className="btn btn-sm btn-link p-0" onClick={() => {if(confirm('Delete?')) DatabaseService.deleteAccount(acc.id)}}>
                                                <Trash2 size={16} className="text-danger"/>
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
    </div>
  );
};
