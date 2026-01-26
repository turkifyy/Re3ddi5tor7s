
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { Search, StopCircle, Zap, Target, Filter, ExternalLink, ArrowRight, Eye, X, Terminal } from 'lucide-react';
import { MarketingCategory, SearchTimeframe, ScrapedLead, ViewState } from '../types';
import { RedditService } from '../services/redditService';
import { DatabaseService } from '../services/databaseService';
import { logger } from '../services/logger';

const CATEGORY_MAP: Record<string, string[]> = {
    MOVIES: ['movies', 'filmmakers', 'cinema', 'TrueFilm', 'boxoffice'],
    SERIES: ['television', 'netflix', 'hbo', 'series', 'television'],
    MATCHES: ['soccer', 'football', 'sports', 'premierleague', 'nba'],
    RECIPES: ['recipes', 'cooking', 'food', 'baking', 'EatCheapAndHealthy'],
    GAMES: ['gaming', 'pcgaming', 'games', 'playstation', 'xbox', 'nintendo'],
    APPS: ['androidapps', 'ios', 'apps', 'productivity', 'startups']
};

interface ScraperManagerProps {
    onNavigate?: (view: ViewState) => void;
}

export const ScraperManager: React.FC<ScraperManagerProps> = ({ onNavigate }) => {
    const [selectedCategory, setSelectedCategory] = useState<MarketingCategory>('MOVIES');
    const [customSubreddits, setCustomSubreddits] = useState('');
    const [timeframe, setTimeframe] = useState<SearchTimeframe>('24h');
    const [keywords, setKeywords] = useState('');
    const [limitPreset, setLimitPreset] = useState<number>(10);
    
    // Runtime
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState('System Ready');
    const [results, setResults] = useState<ScrapedLead[]>([]);
    
    // Preview Modal State
    const [previewItem, setPreviewItem] = useState<ScrapedLead | null>(null);
    
    // Execution Logs (Proof of Work)
    const [executionLogs, setExecutionLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);
    
    const abortRef = useRef(false);
    const { addToast } = useToast();

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [executionLogs]);

    const addLog = (msg: string, type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO') => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        setExecutionLogs(prev => [...prev.slice(-49), `[${timestamp}] [${type}] ${msg}`]);
    };

    const handleRunSmartSearch = async () => {
        if (!keywords) { addToast('error', 'Keywords required (Regex supported)'); return; }
        
        setIsRunning(true);
        abortRef.current = false;
        setProgress(0);
        setResults([]);
        setExecutionLogs([]); 
        setStatusMsg('Initializing Search Protocols...');
        addLog('--- STARTING SESSION V6.0 ---', 'INFO');

        let targets = selectedCategory === 'CUSTOM' ? 
            customSubreddits.split(',').map(s => s.trim().replace('r/', '')) : 
            CATEGORY_MAP[selectedCategory];

        targets = targets.filter(t => t.length > 0);

        if (targets.length === 0) {
            addToast('error', 'No valid subreddits selected');
            setIsRunning(false);
            return;
        }

        const keywordList = keywords.split('\n').map(k => k.trim()).filter(k => k);
        addLog(`Loaded ${keywordList.length} keyword patterns.`, 'INFO');
        
        const leadsFound: ScrapedLead[] = [];
        const apiTimeframe = timeframe === '24h' ? 'day' : timeframe;

        try {
            const totalSteps = targets.length;
            
            for (let i = 0; i < targets.length; i++) {
                if (abortRef.current) {
                    addLog('ABORT SIGNAL RECEIVED.', 'WARN');
                    break;
                }
                
                const sub = targets[i];
                setStatusMsg(`Scanning r/${sub} (${i + 1}/${totalSteps})...`);
                setProgress(Math.round(((i) / totalSteps) * 100));
                
                addLog(`Connecting to https://oauth.reddit.com/r/${sub}/new...`, 'INFO');

                try {
                    const start = performance.now();
                    const posts = await RedditService.fetchSubredditPosts(sub, 'new', limitPreset, apiTimeframe);
                    const latency = Math.round(performance.now() - start);
                    
                    addLog(`HTTP 200 OK (${latency}ms). Parsed ${posts.length} objects.`, 'SUCCESS');
                    
                    let subLeads = 0;
                    for (const post of posts) {
                        const content = `${post.title} ${post.selftext}`.toLowerCase();
                        
                        const match = keywordList.find(k => {
                            try { return new RegExp(k, 'i').test(content); } 
                            catch(e) { return content.includes(k.toLowerCase()); }
                        });

                        if (match) {
                            addLog(`MATCH FOUND: "${match}" in ${post.name}`, 'SUCCESS');
                            
                            const fullContent = post.title + (post.selftext ? `\n\n${post.selftext}` : '');
                            const newLead: ScrapedLead = {
                                id: post.name,
                                type: 'POST',
                                subreddit: sub,
                                author: post.author,
                                content: fullContent, 
                                matchedKeyword: match,
                                permalink: post.permalink,
                                scrapedAt: new Date().toISOString(),
                                status: 'NEW',
                                score: post.score
                            };

                            await DatabaseService.addScrapedLead(newLead);
                            leadsFound.push(newLead);
                            setResults(prev => [...prev, newLead]);
                            subLeads++;
                        }
                    }
                    
                    if (subLeads === 0) addLog(`No matches in r/${sub}.`, 'INFO');
                    
                    await new Promise(r => setTimeout(r, 1200)); // Respect Rate Limits

                } catch (err: any) {
                    addLog(`API ERROR: ${err.message}`, 'ERROR');
                    logger.error('SCRAPER', `Failed to scrape r/${sub}: ${err.message}`);
                    if (err.message.includes('AUTH_FAIL')) {
                        addToast('error', 'Authentication Failed. Check Credentials.');
                        abortRef.current = true;
                        break;
                    }
                }
            }

            if (!abortRef.current) {
                setProgress(100);
                setStatusMsg('Scan Complete.');
                addLog(`SESSION COMPLETE. Total Leads: ${leadsFound.length}`, 'SUCCESS');
                if (leadsFound.length > 0) {
                    addToast('success', `Found & Saved ${leadsFound.length} new leads.`);
                } else {
                    addToast('info', 'No matches found with current keywords.');
                }
            } else {
                setStatusMsg('Aborted by User.');
            }

        } catch(e) {
            addToast('error', 'Critical Scraper Error');
            addLog(`CRITICAL FAILURE: ${e}`, 'ERROR');
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="container-fluid p-0 position-relative">
            {/* PREVIEW MODAL */}
            {previewItem && (
                <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
                     style={{zIndex: 1050, background: 'rgba(0,0,0,0.8)'}}>
                    <div className="card border-info" style={{width: '90%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column'}}>
                        <div className="card-header bg-dark border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 fw-bold text-white">Lead Details</h5>
                            <button className="btn btn-sm btn-link text-muted" onClick={() => setPreviewItem(null)}><X size={20}/></button>
                        </div>
                        <div className="card-body bg-dark overflow-auto custom-scrollbar">
                            <div className="mb-3">
                                <span className="badge bg-secondary">r/{previewItem.subreddit}</span>
                                <span className="badge bg-info text-black ms-2">Match: {previewItem.matchedKeyword}</span>
                            </div>
                            <div className="p-3 bg-black bg-opacity-25 rounded border border-secondary border-opacity-10 mb-3">
                                <h6 className="text-white fw-bold mb-2" style={{whiteSpace: 'pre-wrap'}}>{previewItem.content}</h6>
                            </div>
                            <div className="text-muted small mb-3">
                                Author: u/{previewItem.author} • Score: {previewItem.score}
                            </div>
                            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                                <a href={`https://reddit.com${previewItem.permalink}`} target="_blank" className="btn btn-outline-light btn-sm">
                                    <ExternalLink size={16} className="me-2"/> Open on Reddit
                                </a>
                                <Button onClick={() => onNavigate?.('INBOX')}>
                                    Go to Inbox to Reply <ArrowRight size={16} className="ms-2"/>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="row">
                {/* Configuration Panel */}
                <div className="col-lg-4 mb-4">
                    <div className="card h-100">
                        <div className="card-body">
                            <h5 className="card-title fw-bold mb-4"><Filter size={20} className="me-2"/> Configuration</h5>
                            
                            <div className="mb-3">
                                <label className="form-label text-muted">Target Category</label>
                                <select className="form-select" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value as any)}>
                                    <option value="MOVIES">Movies</option>
                                    <option value="SERIES">Series</option>
                                    <option value="GAMES">Games</option>
                                    <option value="APPS">Apps</option>
                                    <option value="MATCHES">Sports</option>
                                    <option value="RECIPES">Food & Cooking</option>
                                    <option value="CUSTOM">Custom List</option>
                                </select>
                            </div>

                            {selectedCategory === 'CUSTOM' && (
                                <div className="mb-3">
                                    <label className="form-label text-muted">Subreddits (comma separated)</label>
                                    <input type="text" className="form-control" placeholder="e.g. technology, startups" value={customSubreddits} onChange={e => setCustomSubreddits(e.target.value)} />
                                </div>
                            )}

                            <div className="mb-3">
                                <label className="form-label text-muted">Timeframe</label>
                                <select className="form-select" value={timeframe} onChange={e => setTimeframe(e.target.value as any)}>
                                    <option value="hour">Past Hour</option>
                                    <option value="24h">Last 24h</option>
                                    <option value="week">Past Week</option>
                                    <option value="month">Past Month</option>
                                    <option value="all">All Time</option>
                                </select>
                            </div>

                            <div className="mb-3">
                                <label className="form-label text-muted">Keywords (Regex Supported)</label>
                                <textarea 
                                    className="form-control font-monospace" 
                                    value={keywords} 
                                    onChange={e => setKeywords(e.target.value)} 
                                    style={{minHeight: '100px'}}
                                    placeholder="Enter one keyword per line&#10;e.g.&#10;best app for&#10;how to.*fix"
                                ></textarea>
                                <div className="form-text text-secondary">Case-insensitive matching.</div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label text-muted">Max Posts per Subreddit</label>
                                <select className="form-select" value={limitPreset} onChange={e => setLimitPreset(parseInt(e.target.value))}>
                                     <option value="10">Scan 10 Posts</option>
                                     <option value="25">Scan 25 Posts</option>
                                     <option value="50">Scan 50 Posts</option>
                                     <option value="100">Scan 100 Posts (Slow)</option>
                                 </select>
                            </div>

                            <div className="d-grid">
                                {!isRunning ? (
                                    <Button onClick={handleRunSmartSearch}><Zap size={16} className="me-2"/> Start Scraping</Button>
                                ) : (
                                    <Button variant="danger" onClick={() => abortRef.current = true}><StopCircle size={16} className="me-2"/> Stop Operation</Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results & Logs Panel */}
                <div className="col-lg-8 mb-4">
                    <div className="card h-100 bg-dark bg-opacity-75 d-flex flex-column">
                         <div className="card-header border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                            <span className="fw-bold"><Target size={18} className="me-2 text-info"/> Live Results</span>
                            {results.length > 0 && (
                                <span className="badge bg-success">{results.length} Leads Found</span>
                            )}
                         </div>
                        
                        {/* Progress */}
                        {isRunning && (
                            <div className="p-3 bg-black bg-opacity-40 border-bottom border-secondary border-opacity-25">
                                <div className="d-flex justify-content-between mb-1">
                                    <small className="text-info font-monospace">{statusMsg}</small>
                                    <small className="text-muted">{progress}%</small>
                                </div>
                                <div className="progress bg-dark" style={{height: '4px'}}>
                                    <div className="progress-bar bg-info" style={{width: `${progress}%`}}></div>
                                </div>
                            </div>
                        )}

                        {/* LIVE EXECUTION LOG TERMINAL */}
                        <div className="p-3 bg-black border-bottom border-secondary border-opacity-25" style={{height: '150px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem'}}>
                            <div className="text-muted mb-2 d-flex align-items-center"><Terminal size={12} className="me-2"/> LIVE EXECUTION LOG</div>
                            {executionLogs.length === 0 ? (
                                <div className="text-muted opacity-25">Waiting for command...</div>
                            ) : (
                                executionLogs.map((log, idx) => (
                                    <div key={idx} className={log.includes('ERROR') ? 'text-danger' : log.includes('SUCCESS') ? 'text-success' : log.includes('WARN') ? 'text-warning' : 'text-secondary'}>
                                        {log}
                                    </div>
                                ))
                            )}
                            <div ref={logsEndRef}/>
                        </div>

                        {/* Results List */}
                        <div className="flex-grow-1 overflow-auto p-0" style={{minHeight: '250px'}}>
                            {results.length > 0 ? (
                                <div className="list-group list-group-flush">
                                    {results.map((lead, idx) => (
                                        <div key={`${lead.id}-${idx}`} className="list-group-item bg-transparent text-white border-secondary border-opacity-25 py-3">
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div className="flex-grow-1 me-3">
                                                    <div className="mb-1">
                                                        <span className="badge bg-secondary me-2">r/{lead.subreddit}</span>
                                                        <span className="text-warning small font-monospace">{lead.matchedKeyword}</span>
                                                    </div>
                                                    <h6 className="mb-1 text-truncate" style={{maxWidth: '450px'}}>{lead.content}</h6>
                                                    <small className="text-muted">by u/{lead.author} • {lead.score} upvotes</small>
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <button className="btn btn-sm btn-outline-info" onClick={() => setPreviewItem(lead)} title="Quick View">
                                                        <Eye size={14}/>
                                                    </button>
                                                    <a href={`https://reddit.com${lead.permalink}`} target="_blank" className="btn btn-sm btn-dark border-secondary text-secondary">
                                                        <ExternalLink size={14}/>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                !isRunning && (
                                    <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted opacity-50">
                                        <Search size={64} className="mb-3"/>
                                        <p>No results yet. Start a scan.</p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
