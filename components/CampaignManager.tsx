
import React, { useState, useEffect, useRef } from 'react';
import { Campaign } from '../types';
import { Button } from './Button';
import { deepseekService } from '../services/deepseekService';
import { DatabaseService } from '../services/databaseService';
import { AnalyticsEngine } from '../services/analyticsEngine'; 
import { useToast } from './ToastProvider';
import { Cpu, History, Target, Plus, Bot, Zap, Save, Activity, Layers } from 'lucide-react';

declare const window: any;

export const CampaignManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'LAB' | 'HISTORY'>('LIST');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const { addToast } = useToast();
  const tabsRef = useRef<HTMLUListElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // States
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

  // Init Materialize Components correctly with checks
  useEffect(() => {
    if (window.M) {
        if (tabsRef.current) window.M.Tabs.init(tabsRef.current);
        if (selectRef.current) window.M.FormSelect.init(selectRef.current);
        window.M.updateTextFields();
    }
  }, [activeTab, isCreating]);

  // Re-init select specifically when tone changes to ensure UI updates
  useEffect(() => {
      if (window.M && selectRef.current) {
          window.M.FormSelect.init(selectRef.current);
      }
  }, [tone]);

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
    <div className="section">
      {/* Modern Tabs */}
      <div className="row">
          <div className="col s12">
              <ul className="tabs tabs-fixed-width glass-panel" ref={tabsRef} style={{borderRadius: '50px', height: '50px', overflow: 'hidden'}}>
                  <li className="tab col s3"><a href="#list" className={activeTab==='LIST'?'active':''} onClick={() => setActiveTab('LIST')}><Target size={14} style={{verticalAlign: 'middle', marginRight: '6px'}}/> Targets</a></li>
                  <li className="tab col s3"><a href="#lab" className={activeTab==='LAB'?'active':''} onClick={() => setActiveTab('LAB')}><Cpu size={14} style={{verticalAlign: 'middle', marginRight: '6px'}}/> DeepSeek Lab</a></li>
                  <li className="tab col s3"><a href="#history" className={activeTab==='HISTORY'?'active':''} onClick={() => setActiveTab('HISTORY')}><History size={14} style={{verticalAlign: 'middle', marginRight: '6px'}}/> Logs</a></li>
              </ul>
          </div>
      </div>

      {/* LIST TAB */}
      <div id="list" className="col s12 mt-4" style={{display: activeTab === 'LIST' ? 'block' : 'none'}}>
          {!isCreating && (
              <div className="row mb-0">
                  <div className="col s12 right-align">
                      <Button onClick={() => setIsCreating(true)} className="btn-large"><Plus size={18} style={{verticalAlign: 'middle', marginRight: '8px'}}/> Create Campaign</Button>
                  </div>
              </div>
          )}

          {isCreating && (
              <div className="card glass-panel animate-float mb-4">
                  <div className="card-content white-text">
                      <span className="card-title bold">New Campaign</span>
                      <div className="row">
                          <div className="input-field col s12 m6">
                              <input id="c_name" type="text" value={newCampName} onChange={e => setNewCampName(e.target.value)} />
                              <label htmlFor="c_name">Campaign Name</label>
                          </div>
                          <div className="input-field col s12 m6">
                              <input id="c_subs" type="text" value={newSubreddit} onChange={e => setNewSubreddit(e.target.value)} />
                              <label htmlFor="c_subs">Target Subreddits (comma separated)</label>
                          </div>
                          <div className="input-field col s12">
                              <Bot size={20} className="prefix cyan-text"/>
                              <input id="c_keys" type="text" value={newKeywords} onChange={e => setNewKeywords(e.target.value)} />
                              <label htmlFor="c_keys">Auto-Hunt Keywords (Optional)</label>
                          </div>
                      </div>
                  </div>
                  <div className="card-action right-align transparent border-none">
                      <Button variant="ghost" onClick={() => setIsCreating(false)} style={{marginRight: '10px'}}>Cancel</Button>
                      <Button onClick={handleCreateCampaign}>Launch</Button>
                  </div>
              </div>
          )}

          <div className="row mt-4">
              {campaigns.map(c => (
                  <div className="col s12 m6 l4" key={c.id}>
                      <div className="card glass-panel hoverable" style={{border: '1px solid rgba(0, 229, 255, 0.1)'}}>
                          <div className="card-content white-text">
                              <div className="flex-between">
                                  <span className="card-title truncate bold" style={{fontSize: '1.2rem', margin: 0}}>{c.name}</span>
                                  <div className="modern-chip chip-glow-green">{c.status}</div>
                              </div>
                              <p className="grey-text mt-2 truncate font-mono" style={{fontSize: '0.8rem'}}>
                                  {c.targetSubreddits.join(', ')}
                              </p>
                              {c.keywords?.length > 0 && (
                                  <div className="mt-2 p-2 rounded" style={{background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)'}}>
                                      <small className="cyan-text valign-wrapper"><Bot size={12} style={{marginRight: '5px'}}/> Auto-Hunt Active</small>
                                  </div>
                              )}
                              
                              <div className="divider grey darken-3 my-4" style={{opacity: 0.2}}></div>
                              
                              <div className="row mb-0">
                                  <div className="col s4 center-align">
                                      <small className="grey-text text-darken-1 block uppercase" style={{fontSize: '0.65rem'}}>Engaged</small>
                                      <span className="white-text font-bold">{c.postsEngaged}</span>
                                  </div>
                                  <div className="col s4 center-align">
                                      <small className="grey-text text-darken-1 block uppercase" style={{fontSize: '0.65rem'}}>Generated</small>
                                      <span className="white-text font-bold">{c.commentsGenerated}</span>
                                  </div>
                                  <div className="col s4 center-align">
                                      <small className="grey-text text-darken-1 block uppercase" style={{fontSize: '0.65rem'}}>ROI</small>
                                      <span className={c.roi > 100 ? "green-text font-bold" : "white-text"}>{c.roi}%</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* LAB TAB */}
      <div id="lab" className="col s12 mt-4" style={{display: activeTab === 'LAB' ? 'block' : 'none'}}>
          <div className="row">
              <div className="col s12 l6">
                  <div className="card-panel glass-panel">
                      <h5 className="white-text mb-4" style={{fontWeight: 700}}><Zap size={22} className="orange-text" style={{verticalAlign: 'bottom'}}/> Generator Core (DeepSeek)</h5>
                      <div className="input-field">
                          <textarea className="materialize-textarea white-text" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} style={{minHeight: '150px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: 'none'}}></textarea>
                          <label>Prompt / Context / URL</label>
                      </div>
                      <div className="input-field mt-4">
                          <select ref={selectRef} value={tone} onChange={e => setTone(e.target.value)}>
                              <option>Professional & Insightful</option>
                              <option>Casual & Friendly</option>
                              <option>Witty & Humorous</option>
                              <option>Direct & Concise</option>
                          </select>
                          <label>Tone of Voice</label>
                      </div>
                      <Button className="width-100 mt-4 btn-large" onClick={handleGenerate} isLoading={isGenerating}>Run Synthesis <Zap size={16} style={{marginLeft: '8px'}}/></Button>
                  </div>
              </div>

              <div className="col s12 l6">
                  <div className="card-panel glass-panel" style={{minHeight: '400px', display: 'flex', flexDirection: 'column'}}>
                      <h5 className="white-text mb-4"><Activity size={22} className="cyan-text" style={{verticalAlign: 'bottom'}}/> Analysis Output</h5>
                      {generatedContent ? (
                          <div className="animate-fade-in flex-1">
                              <div className="p-4 rounded z-depth-1 mb-4" style={{background: 'rgba(0,0,0,0.3)', borderLeft: '3px solid #00e5ff'}}>
                                  <p className="white-text" style={{whiteSpace: 'pre-wrap', lineHeight: '1.6'}}>{generatedContent}</p>
                              </div>
                              {viralityScore && (
                                  <div className="row mb-0">
                                      <div className="col s6 center-align">
                                          <h2 className={`${viralityScore.color.replace('text-', '')}-text m-0`} style={{fontWeight: 800}}>{viralityScore.score}</h2>
                                          <small className="grey-text uppercase tracking-widest">Virality Score</small>
                                      </div>
                                      <div className="col s6 center-align">
                                          <div className="modern-chip chip-glow-purple mt-4">{viralityScore.rating}</div>
                                      </div>
                                  </div>
                              )}
                              <div className="divider grey darken-2 my-4" style={{opacity: 0.2}}></div>
                              <div className="flex-between">
                                  <Button variant="secondary" onClick={() => setGeneratedContent('')}>Discard</Button>
                                  <Button onClick={handleDeploy} isLoading={isDeploying}><Save size={16} style={{marginRight: '6px'}}/> Deploy</Button>
                              </div>
                          </div>
                      ) : (
                          <div className="center-align grey-text text-darken-1 flex-1 valign-wrapper justify-center flex-col">
                              <Layers size={64} style={{opacity: 0.1}}/>
                              <h5 style={{opacity: 0.5}}>Ready</h5>
                              <p>Enter context to generate content</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* HISTORY TAB */}
      <div id="history" className="col s12 mt-4" style={{display: activeTab === 'HISTORY' ? 'block' : 'none'}}>
          <div className="card glass-panel">
              <div className="card-content">
                  <span className="card-title bold"><History size={20} style={{verticalAlign: 'middle', marginRight: '10px'}}/> Deployment Log</span>
                  <ul className="collection border-none">
                      {historyLogs.map(log => (
                          <li key={log.id} className="collection-item avatar" style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                              <i className="material-icons circle green accent-4 black-text">check</i>
                              <span className="title font-bold white-text">Deployed to {log.subreddit}</span>
                              <p className="grey-text text-lighten-1 truncate" style={{maxWidth: '80%', fontSize: '0.9rem'}}>{log.content}</p>
                              <span className="secondary-content grey-text text-darken-1" style={{fontSize: '0.75rem'}}>
                                  {log.deployedAt?.seconds ? new Date(log.deployedAt.seconds * 1000).toLocaleTimeString() : 'Just now'}
                              </span>
                          </li>
                      ))}
                      {historyLogs.length === 0 && <li className="collection-item center-align p-4">No history found.</li>}
                  </ul>
              </div>
          </div>
      </div>
    </div>
  );
};
