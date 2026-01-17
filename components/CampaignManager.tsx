
import React, { useState, useEffect } from 'react';
import { Campaign } from '../types';
import { Button } from './Button';
import { deepseekService } from '../services/deepseekService';
import { DatabaseService } from '../services/databaseService';
import { AnalyticsEngine } from '../services/analyticsEngine'; 
import { useToast } from './ToastProvider';
import { Cpu, History, Target, Plus, Bot, Zap, Save, Activity, Layers } from 'lucide-react';

export const CampaignManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'LAB' | 'HISTORY'>('LIST');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const { addToast } = useToast();

  const [targetUrl, setTargetUrl] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [tone, setTone] = useState('Professional & Insightful');
  const [viralityScore, setViralityScore] = useState<{score: number, rating: string, color: string} | null>(null);

  const [newCampName, setNewCampName] = useState('');
  const [newSubreddit, setNewSubreddit] = useState('');
  const [newKeywords, setNewKeywords] = useState(''); 
  const [isCreating, setIsCreating] = useState(false);

  const fetchCampaigns = async () => {
      try {
        const data = await DatabaseService.getCampaigns();
        const processed = data.map(c => ({
            ...c,
            roi: AnalyticsEngine.calculateCampaignROI(c.postsEngaged, c.commentsGenerated)
        }));
        setCampaigns(processed);
      } catch (e) {
        addToast('error', 'Failed to load campaigns');
      }
  };

  const fetchHistory = async () => {
      try {
          const logs = await DatabaseService.getDeploymentHistory(20);
          setHistoryLogs(logs);
      } catch(e) { addToast('error', 'Failed to load history'); }
  };

  useEffect(() => { fetchCampaigns(); }, []);
  useEffect(() => { if (activeTab === 'HISTORY') fetchHistory(); }, [activeTab]);

  const handleCreateCampaign = async () => {
    if(!newCampName) { addToast('error', 'Name required'); return; }
    try {
        await DatabaseService.addCampaign({
            name: newCampName,
            targetSubreddits: newSubreddit.split(',').map(s => s.trim()).filter(s => s),
            keywords: newKeywords.split(',').map(k => k.trim()).filter(k => k), 
            status: 'RUNNING',
            postsEngaged: 0,
            commentsGenerated: 0,
            roi: 0
        });
        addToast('success', 'Campaign Started');
        await fetchCampaigns();
        setIsCreating(false);
    } catch (e) { addToast('error', 'Creation Failed'); }
  };

  const handleGenerate = async () => {
    if (!targetUrl) return;
    setIsGenerating(true);
    const finalPrompt = AnalyticsEngine.enhancePromptContext(targetUrl, tone);
    const result = await deepseekService.generateComment(finalPrompt, tone);
    
    if (!result.startsWith("Error") && !result.startsWith("System Error")) {
        const prediction = AnalyticsEngine.predictVirality(result);
        setViralityScore(prediction);
    } else {
        addToast('error', result);
    }
    setGeneratedContent(result);
    setIsGenerating(false);
  };

  const handleDeploy = async () => {
      if(!generatedContent) return;
      setIsDeploying(true);
      await DatabaseService.deployCampaignContent('manual_lab', generatedContent, "r/ManualDeploy");
      addToast('success', 'Content Deployed');
      setGeneratedContent('');
      setViralityScore(null);
      setIsDeploying(false);
  };

  return (
    <div className="container-fluid p-0">
      {/* Bootstrap Tabs */}
      <ul className="nav nav-pills nav-fill mb-4 bg-dark rounded p-2 border border-secondary border-opacity-25">
          <li className="nav-item">
              <button className={`nav-link ${activeTab === 'LIST' ? 'active' : 'text-secondary'}`} onClick={() => setActiveTab('LIST')}>
                  <Target size={16} className="me-2"/> Targets
              </button>
          </li>
          <li className="nav-item">
              <button className={`nav-link ${activeTab === 'LAB' ? 'active' : 'text-secondary'}`} onClick={() => setActiveTab('LAB')}>
                  <Cpu size={16} className="me-2"/> DeepSeek Lab
              </button>
          </li>
          <li className="nav-item">
              <button className={`nav-link ${activeTab === 'HISTORY' ? 'active' : 'text-secondary'}`} onClick={() => setActiveTab('HISTORY')}>
                  <History size={16} className="me-2"/> Logs
              </button>
          </li>
      </ul>

      {/* LIST TAB */}
      {activeTab === 'LIST' && (
          <div className="animate-fade-in">
              {!isCreating && (
                  <div className="text-end mb-4">
                      <Button onClick={() => setIsCreating(true)} size="lg"><Plus size={18} className="me-2"/> Create Campaign</Button>
                  </div>
              )}

              {isCreating && (
                  <div className="card mb-4 border-info">
                      <div className="card-body">
                          <h5 className="card-title fw-bold mb-3">New Campaign</h5>
                          <div className="row g-3">
                              <div className="col-md-6">
                                  <label className="form-label">Campaign Name</label>
                                  <input type="text" className="form-control" value={newCampName} onChange={e => setNewCampName(e.target.value)} />
                              </div>
                              <div className="col-md-6">
                                  <label className="form-label">Target Subreddits (comma separated)</label>
                                  <input type="text" className="form-control" value={newSubreddit} onChange={e => setNewSubreddit(e.target.value)} />
                              </div>
                              <div className="col-12">
                                  <label className="form-label"><Bot size={16} className="text-info me-1"/> Auto-Hunt Keywords</label>
                                  <input type="text" className="form-control" value={newKeywords} onChange={e => setNewKeywords(e.target.value)} />
                              </div>
                          </div>
                          <div className="text-end mt-4">
                              <Button variant="secondary" onClick={() => setIsCreating(false)} className="me-2">Cancel</Button>
                              <Button onClick={handleCreateCampaign}>Launch</Button>
                          </div>
                      </div>
                  </div>
              )}

              <div className="row">
                  {campaigns.map(c => (
                      <div className="col-md-6 col-xl-4 mb-4" key={c.id}>
                          <div className="card h-100">
                              <div className="card-body">
                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                      <h5 className="card-title fw-bold text-truncate">{c.name}</h5>
                                      <span className="badge bg-success bg-opacity-10 text-success">{c.status}</span>
                                  </div>
                                  <p className="text-muted small font-monospace text-truncate">{c.targetSubreddits.join(', ')}</p>
                                  
                                  {c.keywords?.length > 0 && (
                                      <div className="bg-dark p-2 rounded mb-3 border border-secondary border-opacity-25">
                                          <small className="text-info d-flex align-items-center"><Bot size={12} className="me-2"/> Auto-Hunt Active</small>
                                      </div>
                                  )}
                                  
                                  <hr className="border-secondary opacity-25" />
                                  
                                  <div className="row text-center g-0">
                                      <div className="col-4 border-end border-secondary border-opacity-25">
                                          <small className="text-muted d-block text-uppercase" style={{fontSize: '0.65rem'}}>Engaged</small>
                                          <span className="fw-bold">{c.postsEngaged}</span>
                                      </div>
                                      <div className="col-4 border-end border-secondary border-opacity-25">
                                          <small className="text-muted d-block text-uppercase" style={{fontSize: '0.65rem'}}>Generated</small>
                                          <span className="fw-bold">{c.commentsGenerated}</span>
                                      </div>
                                      <div className="col-4">
                                          <small className="text-muted d-block text-uppercase" style={{fontSize: '0.65rem'}}>ROI</small>
                                          <span className={c.roi > 100 ? "text-success fw-bold" : ""}>{c.roi}%</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* LAB TAB */}
      {activeTab === 'LAB' && (
          <div className="row">
              <div className="col-lg-6 mb-4">
                  <div className="card h-100">
                      <div className="card-body">
                          <h5 className="card-title fw-bold mb-4"><Zap size={22} className="text-warning me-2"/> Generator Core</h5>
                          <div className="mb-3">
                              <label className="form-label text-muted">Prompt / Context / URL</label>
                              <textarea className="form-control" rows={6} value={targetUrl} onChange={e => setTargetUrl(e.target.value)}></textarea>
                          </div>
                          <div className="mb-4">
                              <label className="form-label text-muted">Tone of Voice</label>
                              <select className="form-select" value={tone} onChange={e => setTone(e.target.value)}>
                                  <option>Professional & Insightful</option>
                                  <option>Casual & Friendly</option>
                                  <option>Witty & Humorous</option>
                                  <option>Direct & Concise</option>
                              </select>
                          </div>
                          <Button className="w-100 btn-lg" onClick={handleGenerate} isLoading={isGenerating}>Run Synthesis <Zap size={16} className="ms-2"/></Button>
                      </div>
                  </div>
              </div>

              <div className="col-lg-6 mb-4">
                  <div className="card h-100">
                      <div className="card-body d-flex flex-column">
                          <h5 className="card-title fw-bold mb-4"><Activity size={22} className="text-info me-2"/> Analysis Output</h5>
                          {generatedContent ? (
                              <div className="flex-grow-1">
                                  <div className="p-3 rounded bg-dark border-start border-4 border-info mb-4">
                                      <p className="mb-0" style={{whiteSpace: 'pre-wrap', lineHeight: '1.6'}}>{generatedContent}</p>
                                  </div>
                                  {viralityScore && (
                                      <div className="row text-center mb-4">
                                          <div className="col-6 border-end border-secondary border-opacity-25">
                                              <h2 className={`fw-bold mb-0 ${viralityScore.color.replace('text-', 'text-')}`}>{viralityScore.score}</h2>
                                              <small className="text-muted text-uppercase">Virality Score</small>
                                          </div>
                                          <div className="col-6 d-flex align-items-center justify-content-center">
                                              <span className="modern-chip chip-glow-blue">{viralityScore.rating}</span>
                                          </div>
                                      </div>
                                  )}
                                  <div className="mt-auto d-flex justify-content-between">
                                      <Button variant="secondary" onClick={() => setGeneratedContent('')}>Discard</Button>
                                      <Button onClick={handleDeploy} isLoading={isDeploying}><Save size={16} className="me-2"/> Deploy</Button>
                                  </div>
                              </div>
                          ) : (
                              <div className="text-center text-muted my-auto">
                                  <Layers size={64} className="mb-3 opacity-25"/>
                                  <h5>Ready</h5>
                                  <p>Enter context to generate content</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'HISTORY' && (
          <div className="card">
              <div className="card-body p-0">
                  <div className="list-group list-group-flush">
                      {historyLogs.map(log => (
                          <div key={log.id} className="list-group-item bg-transparent text-white border-secondary border-opacity-25 py-3">
                              <div className="d-flex align-items-center">
                                  <div className="rounded-circle bg-success p-1 me-3 text-black d-flex align-items-center justify-content-center" style={{width: '24px', height: '24px'}}>
                                      <i className="bi bi-check"></i>
                                  </div>
                                  <div className="flex-grow-1">
                                      <div className="fw-bold">Deployed to {log.subreddit}</div>
                                      <p className="text-muted small mb-0 text-truncate" style={{maxWidth: '80%'}}>{log.content}</p>
                                  </div>
                                  <div className="text-muted small">
                                      {log.deployedAt?.seconds ? new Date(log.deployedAt.seconds * 1000).toLocaleTimeString() : 'Just now'}
                                  </div>
                              </div>
                          </div>
                      ))}
                      {historyLogs.length === 0 && <div className="p-4 text-center text-muted">No history found.</div>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
