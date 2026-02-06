
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { Search, StopCircle, Zap, Target, Filter, ExternalLink, ArrowRight, Eye, X, Terminal, AlertTriangle, Youtube, ArrowUp, ArrowDown, Database, Settings, Check } from 'lucide-react';
import { MarketingCategory, SearchTimeframe, ScrapedLead, ViewState } from '../types';
import { RedditService } from '../services/redditService';
import { YouTubeService } from '../services/youtubeService';
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
    // Mode State
    const [scrapeMode, setScrapeMode] = useState<'REDDIT' | 'YOUTUBE'>('YOUTUBE');
    
    // Config State
    const [selectedCategory, setSelectedCategory] = useState<MarketingCategory>('MOVIES');
    const [customSubreddits, setCustomSubreddits] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [timeframe, setTimeframe] = useState<SearchTimeframe>('24h');
    const [keywords, setKeywords] = useState('');
    const [limitPreset, setLimitPreset] = useState<number>(10);
    
    // Runtime
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState('System Ready');
    const [results, setResults] = useState<ScrapedLead[]>([]);
    const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
    const [filterQuery, setFilterQuery] = useState('');
    
    // Preview Modal State
    const [previewItem, setPreviewItem] = useState<ScrapedLead | null>(null);
    
    // Execution Logs (Proof of Work)
    const [executionLogs, setExecutionLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);
    
    // API Key State
    const [hasYtKey, setHasYtKey] = useState(false);
    
    const abortRef = useRef(false);
    const { addToast } = useToast();

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [executionLogs]);

    // UX FIX: Reset results and logs when switching modes to avoid confusion
    // Also check for API Key existence
    useEffect(() => {
        setResults([]);
        setExecutionLogs([]);
        setStatusMsg('System Ready');
        setProgress(0);
        
        if (scrapeMode === 'YOUTUBE') {
            setHasYtKey(!!YouTubeService.getApiKey());
        }
    }, [scrapeMode]);

    const addLog = (msg: string, type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO') => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        setExecutionLogs(prev => {
            const newLogs = [...prev, `[${timestamp}] [${type}] ${msg}`];
            // Keep last 100 logs for performance
            if (newLogs.length > 100) return newLogs.slice(-100);
            return newLogs;
        });
    };

    // SAFETY FIX: Safe Regex matching that doesn't crash on invalid/null input
    const matchKeyword = (content: string | undefined | null, keyword: string): boolean => {
        if (!content || !keyword) return false;
        try {
            // Escape characters if regex fails, fallback to simple include
            return new RegExp(keyword, 'i').test(content);
        } catch (e) {
            return content.toLowerCase().includes(keyword.toLowerCase());
        }
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

        // --- YOUTUBE MODE ---
        if (scrapeMode === 'YOUTUBE') {
            if (!hasYtKey) {
                addToast('error', 'YouTube API Key is missing. Check Configuration.');
                setIsRunning(false);
                return;
            }

            // SAFEGUARD: Trim URL
            const videoId = YouTubeService.extractVideoId(youtubeUrl.trim());
            if (!videoId) {
                addToast('error', 'Invalid YouTube URL');
                setIsRunning(false);
                return;
            }

            try {
                addLog(`Targeting Video ID: ${videoId}`, 'INFO');
                setStatusMsg(`Fetching Comments for ${videoId}...`);
                
                // UX FIX: Respect the user's limit selection strictly
                const comments = await YouTubeService.fetchVideoComments(videoId, limitPreset);
                addLog(`Fetched ${comments.length} comments. Analyzing...`, 'SUCCESS');
                
                // ROBUST SPLIT: Support Newlines AND Commas
                const keywordList = keywords.split(/[\n,]+/).map(k => k.trim()).filter(k => k);
                let matchesFound = 0;

                for (const comment of comments) {
                    if (abortRef.current) break;

                    // COMPREHENSIVE SEARCH: Check Content AND Author
                    const searchableContent = `${comment.content} ${comment.author}`;
                    const match = keywordList.find(k => matchKeyword(searchableContent, k));

                    if (match) {
                        addLog(`MATCH: "${match}" from ${comment.author}`, 'SUCCESS');
                        
                        // FIX: Only add ellipsis if title is actually truncated
                        const maxTitleLen = 60; 
                        const titleClean = comment.videoTitle.length > maxTitleLen 
                            ? `${comment.videoTitle.substring(0, maxTitleLen)}...` 
                            : comment.videoTitle;

                        const newLead: ScrapedLead = {
                            id: comment.id,
                            type: 'COMMENT',
                            subreddit: `YouTube: ${titleClean}`,
                            author: comment.author,
                            content: comment.content, // Now clean text from YouTubeService
                            matchedKeyword: match,
                            permalink: `/watch?v=${videoId}&lc=${comment.id}`, // Specific comment link
                            scrapedAt: new Date().toISOString(),
                            status: 'NEW',
                            score: comment.likes
                        };

                        if (!results.find(l => l.id === newLead.id)) {
                             await DatabaseService.addScrapedLead(newLead);
                             setResults(prev => [...prev, newLead]);
                             matchesFound++;
                        }
                    }
                }
                
                setStatusMsg('YouTube Scan Complete.');
                addLog(`YouTube Session End. Found ${matchesFound} leads.`, 'SUCCESS');
                
                if (matchesFound > 0) {
                    addToast('success', `Found ${matchesFound} relevant comments.`);
                } else {
                    addToast('info', 'No matching comments found.');
                }

            } catch (e: any) {
                addLog(`YouTube Error: ${e.message}`, 'ERROR');
                addToast('error', e.message);
            } finally {
                setIsRunning(false);
                return;
            }
        }

        // --- REDDIT MODE ---
        let targets = selectedCategory === 'CUSTOM' ? 
            customSubreddits.split(',').map(s => s.trim().replace('r/', '')) : 
            CATEGORY_MAP[selectedCategory];

        targets = targets?.filter(t => t.length > 0) || [];

        if (targets.length === 0) {
            addToast('error', 'No valid subreddits selected');
            setIsRunning(false);
            return;
        }

        const keywordList = keywords.split(/[\n,]+/).map(k => k.trim()).filter(k => k);
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
                
                addLog(`Targeting r/${sub}...`, 'INFO');

                try {
                    const start = performance.now();
                    const posts = await RedditService.fetchSubredditPosts(sub, 'new', limitPreset, apiTimeframe, undefined);
                    const latency = Math.round(performance.now() - start);
                    
                    addLog(`HTTP 200 OK (${latency}ms). Parsed ${posts.length} objects.`, 'SUCCESS');
                    
                    let subLeads = 0;
                    for (const post of posts) {
                        // COMPREHENSIVE SEARCH: Check Title, Body, AND Author
                        const fullContent = `${post.title} ${post.selftext || ''} ${post.author}`;
                        const displayContent = `${post.title} ${post.selftext || ''}`;
                        const match = keywordList.find(k => matchKeyword(fullContent, k));

                        if (match) {
                            addLog(`MATCH: "${match}" in ${post.id}`, 'SUCCESS');
                            
                            const newLead: ScrapedLead = {
                                id: post.name,
                                type: 'POST',
                                subreddit: sub,
                                author: post.author,
                                content: displayContent, 
                                matchedKeyword: match,
                                permalink: post.permalink,
                                scrapedAt: new Date().toISOString(),
                                status: 'NEW',
                                score: post.score
                            };

                            if (!leadsFound.find(l => l.id === newLead.id)) {
                                await DatabaseService.addScrapedLead(newLead);
                                leadsFound.push(newLead);
                                setResults(prev => [...prev, newLead]);
                                subLeads++;
                            }
                        }
                    }
                    
                    if (subLeads === 0) addLog(`No matches in r/${sub}.`, 'INFO');
                    
                    await new Promise(r => setTimeout(r, 1500)); // Polite delay

                } catch (err: any) {
                    addLog(`API ERROR: ${err.message}`, 'ERROR');
                    logger.error('SCRAPER', `Failed to scrape r/${sub}: ${err.message}`);
                    if (err.message.includes('Network Grid Down')) {
                        addToast('error', 'All proxies failed. Check internet connection.');
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

        } catch(e: any) {
            addToast('error', 'Critical Scraper Error');
            addLog(`CRITICAL FAILURE: ${e.message}`, 'ERROR');
        } finally {
            setIsRunning(false);
        }
    };

    // PERFORMANCE OPTIMIZATION: Memoized Sorting & Filtering
    const sortedResults = useMemo(() => {
        return results
            .filter(lead => {
                if (!filterQuery) return true;
                const q = filterQuery.toLowerCase();
                const content = lead.content?.toLowerCase() || '';
                const author = lead.author?.toLowerCase() || '';
                const sub = lead.subreddit?.toLowerCase() || '';
                const keyword = lead.matchedKeyword?.toLowerCase() || '';
                
                return (
                    content.includes(q) || 
                    author.includes(q) || 
                    sub.includes(q) || 
                    keyword.includes(q)
                );
            })
            .sort((a, b) => {
                const scoreA = a.score || 0;
                const scoreB = b.score || 0;
                return sortOrder === 'DESC' ? scoreB - scoreA : scoreA - scoreB;
            });
    }, [results, filterQuery, sortOrder]);

    return (
        <div className="container-fluid p-0 position-relative">
            {/* PREVIEW MODAL */}
            {previewItem && (
                <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
                     style={{zIndex: 1050, background: 'rgba(0,0,0,0.8)'}}>
                    <div className="card border-info animate-fade-in" style={{width: '90%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 50px rgba(0,243,255,0.1)'}}>
                        <div className="card-header bg-dark border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 fw-bold text-white">Lead Details</h5>
                            <button className="btn btn-sm btn-link text-muted" onClick={() => setPreviewItem(null)}><X size={20}/></button>
                        </div>
                        <div className="card-body bg-dark overflow-auto custom-scrollbar">
                            <div className="mb-3">
                                {previewItem.subreddit.startsWith('YouTube:') ? 
                                    <span 
                                        className="badge bg-danger text-truncate" 
                                        style={{maxWidth: '100%', verticalAlign: 'bottom'}}
                                        title={previewItem.subreddit.replace('YouTube:', '').trim()}
                                    >
                                        <Youtube size={12} className="me-1"/> {previewItem.subreddit.replace('YouTube:', '').trim()}
                                    </span> 
                                    : 
                                    <span className="badge bg-secondary">r/{previewItem.subreddit}</span>
                                }
                                <span className="badge bg-info text-black ms-2">Match: {previewItem.matchedKeyword}</span>
                            </div>
                            <div className="p-3 bg-black bg-opacity-25 rounded border border-secondary border-opacity-10 mb-3">
                                <h6 className="text-white fw-bold mb-2" style={{whiteSpace: 'pre-wrap'}}>{previewItem.content}</h6>
                            </div>
                            <div className="text-muted small mb-3">
                                Author: {previewItem.author} • Score/Likes: {previewItem.score}
                            </div>
                            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                                <a href={previewItem.type === 'COMMENT' ? `https://youtube.com${previewItem.permalink}` : `https://reddit.com${previewItem.permalink}`} target="_blank" className="btn btn-outline-light btn-sm">
                                    <ExternalLink size={16} className="me-2"/> Open Source
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
                            
                            {/* MODE SELECTION TOGGLE */}
                            <div className="mb-4">
                                <label className="form-label text-muted d-block">Source Platform</label>
                                <div className="btn-group w-100" role="group">
                                    <input type="radio" className="btn-check" name="scrapeMode" id="modeReddit" autoComplete="off" checked={scrapeMode === 'REDDIT'} onChange={() => setScrapeMode('REDDIT')} />
                                    <label className={`btn d-flex align-items-center justify-content-center ${scrapeMode === 'REDDIT' ? 'btn-info text-black fw-bold' : 'btn-outline-secondary'}`} htmlFor="modeReddit">
                                        <Target size={16} className="me-2"/> Reddit
                                    </label>

                                    <input type="radio" className="btn-check" name="scrapeMode" id="modeYoutube" autoComplete="off" checked={scrapeMode === 'YOUTUBE'} onChange={() => setScrapeMode('YOUTUBE')} />
                                    <label className={`btn d-flex align-items-center justify-content-center ${scrapeMode === 'YOUTUBE' ? 'btn-danger text-white fw-bold' : 'btn-outline-secondary'}`} htmlFor="modeYoutube">
                                        <Youtube size={16} className="me-2"/> YouTube
                                    </label>
                                </div>
                            </div>

                            {/* REDDIT: Category Selector */}
                            {scrapeMode === 'REDDIT' && (
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
                            )}

                            {/* REDDIT: Custom Subreddits */}
                            {scrapeMode === 'REDDIT' && selectedCategory === 'CUSTOM' && (
                                <div className="mb-3">
                                    <label className="form-label text-muted">Subreddits (comma separated)</label>
                                    <input type="text" className="form-control" placeholder="e.g. technology, startups" value={customSubreddits} onChange={e => setCustomSubreddits(e.target.value)} />
                                </div>
                            )}

                            {/* YOUTUBE: URL Input */}
                            {scrapeMode === 'YOUTUBE' && (
                                <div className="mb-3">
                                    <label className="form-label text-white"><Youtube size={14} className="text-danger me-1"/> Video URL</label>
                                    <input type="text" className="form-control border-danger text-white" placeholder="https://youtube.com/watch?v=..." value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} />
                                    
                                    {!hasYtKey ? (
                                        <div className="alert alert-danger bg-danger bg-opacity-10 border-danger border-opacity-25 d-flex align-items-center mt-2 p-2 small text-danger">
                                            <AlertTriangle size={16} className="me-2 flex-shrink-0"/>
                                            <div className="flex-grow-1 fw-bold">YouTube API Key Missing</div>
                                            <Button size="sm" variant="danger" onClick={() => onNavigate?.('SETTINGS')} className="px-3 py-0" style={{minHeight: '28px'}}>Configure</Button>
                                        </div>
                                    ) : (
                                        <div className="form-text text-secondary d-flex justify-content-between align-items-center mt-2">
                                            <span><Check size={12} className="text-success me-1"/> System Ready (Shorts & Live supported)</span>
                                            <button className="btn btn-link btn-sm text-muted p-0 text-decoration-none" onClick={() => onNavigate?.('SETTINGS')} style={{fontSize: '0.75rem'}}>
                                                <Settings size={12} className="me-1"/> Update Key
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* REDDIT: Timeframe */}
                            {scrapeMode === 'REDDIT' && (
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
                            )}

                            <div className="mb-3">
                                <label className="form-label text-muted">Keywords (Regex Supported)</label>
                                <textarea 
                                    className="form-control font-monospace" 
                                    value={keywords} 
                                    onChange={e => setKeywords(e.target.value)} 
                                    style={{minHeight: '100px'}}
                                    // UX FIX: Dynamic placeholder for better user guidance
                                    placeholder={scrapeMode === 'YOUTUBE' ? "Enter keywords to find in comments\ne.g.\nbest moment\nfunny\nlink" : "Enter one keyword per line\ne.g.\nbest app for\nhow to.*fix"}
                                ></textarea>
                                <div className="form-text text-secondary">Case-insensitive matching. Supports commas.</div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label text-muted">{scrapeMode === 'YOUTUBE' ? 'Max Comments' : 'Max Posts'}</label>
                                <select className="form-select" value={limitPreset} onChange={e => setLimitPreset(parseInt(e.target.value))}>
                                     <option value="10">Scan 10 {scrapeMode === 'YOUTUBE' ? 'Comments' : 'Posts'}</option>
                                     <option value="25">Scan 25 {scrapeMode === 'YOUTUBE' ? 'Comments' : 'Posts'}</option>
                                     <option value="50">Scan 50 {scrapeMode === 'YOUTUBE' ? 'Comments' : 'Posts'}</option>
                                     <option value="100">Scan 100 {scrapeMode === 'YOUTUBE' ? 'Comments' : 'Posts'} (Slow)</option>
                                 </select>
                            </div>

                            <div className="d-grid">
                                {!isRunning ? (
                                    <Button onClick={handleRunSmartSearch}>
                                        {scrapeMode === 'YOUTUBE' ? <Youtube size={16} className="me-2"/> : <Zap size={16} className="me-2"/>}
                                        {scrapeMode === 'YOUTUBE' ? 'Start Video Scan' : 'Start Subreddit Scraping'}
                                    </Button>
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
                         <div className="card-header border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <span className="fw-bold"><Target size={18} className="me-2 text-info"/> Live Results</span>
                            <div className="d-flex align-items-center gap-2">
                                
                                {/* SEARCH BAR */}
                                <div className="input-group input-group-sm" style={{maxWidth: '220px'}}>
                                    <span className="input-group-text bg-dark border-secondary border-end-0 text-muted"><Search size={14}/></span>
                                    <input 
                                        type="text" 
                                        className="form-control bg-dark border-secondary border-start-0 border-end-0 text-white shadow-none" 
                                        placeholder="Filter results..." 
                                        value={filterQuery}
                                        onChange={e => setFilterQuery(e.target.value)}
                                    />
                                    {filterQuery && (
                                        <button className="btn btn-outline-secondary border-secondary border-start-0 bg-dark text-secondary" onClick={() => setFilterQuery('')} type="button" style={{zIndex: 0}}>
                                            <X size={14} className="text-white"/>
                                        </button>
                                    )}
                                </div>

                                <button 
                                    className="btn btn-sm btn-dark border-secondary text-secondary d-flex align-items-center" 
                                    onClick={() => setSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC')}
                                    title={`Sort by Score: ${sortOrder === 'DESC' ? 'High to Low' : 'Low to High'}`}
                                >
                                    {sortOrder === 'DESC' ? <ArrowDown size={14} className="me-1"/> : <ArrowUp size={14} className="me-1"/>}
                                    Score
                                </button>
                                {results.length > 0 && (
                                    <span className="badge bg-success">{sortedResults.length}</span>
                                )}
                            </div>
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
                        {/* VISUAL FIX: Added dir="ltr" to ensure English logs display correctly in Arabic interface */}
                        <div className="p-3 bg-black border-bottom border-secondary border-opacity-25" dir="ltr" style={{height: '150px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem'}}>
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
                            {results.length > 0 && sortedResults.length === 0 ? (
                                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                                    <div className="rounded-circle bg-secondary bg-opacity-10 p-4 mb-3">
                                        <Filter size={32} className="opacity-50"/>
                                    </div>
                                    <h6 className="text-secondary">Hidden by Filter</h6>
                                    <p className="small text-muted mb-3">No matches found for "{filterQuery}"</p>
                                    <button className="btn btn-sm btn-outline-info" onClick={() => setFilterQuery('')}>
                                        Clear Search Criteria
                                    </button>
                                </div>
                            ) : sortedResults.length > 0 ? (
                                <div className="list-group list-group-flush">
                                    {sortedResults.map((lead, idx) => (
                                        <div key={`${lead.id}-${idx}`} className="list-group-item bg-transparent text-white border-secondary border-opacity-25 py-3">
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div className="flex-grow-1 me-3">
                                                    <div className="mb-1">
                                                        {lead.subreddit.startsWith('YouTube:') ? 
                                                            <span 
                                                                className="badge bg-danger me-2" 
                                                                style={{maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle'}}
                                                                title={lead.subreddit.replace('YouTube:', '').trim()}
                                                            >
                                                                <Youtube size={10} className="me-1"/> {lead.subreddit.replace('YouTube:', '').trim()}
                                                            </span> :
                                                            <span className="badge bg-secondary me-2">r/{lead.subreddit}</span>
                                                        }
                                                        <span className="text-warning small font-monospace">{lead.matchedKeyword}</span>
                                                    </div>
                                                    <h6 className="mb-1 text-truncate" style={{maxWidth: '450px'}}>{lead.content}</h6>
                                                    <small className="text-muted">by {lead.author} • {lead.score} likes/score</small>
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <button className="btn btn-sm btn-outline-info" onClick={() => setPreviewItem(lead)} title="Quick View">
                                                        <Eye size={14}/>
                                                    </button>
                                                    <a href={lead.type === 'COMMENT' ? `https://youtube.com${lead.permalink}` : `https://reddit.com${lead.permalink}`} target="_blank" className="btn btn-sm btn-dark border-secondary text-secondary">
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
                                        {executionLogs.length > 0 && executionLogs.some(l => l.includes('ERROR')) ? (
                                            <div className="text-center text-danger">
                                                <AlertTriangle size={64} className="mb-3"/>
                                                <p>Scraping halted due to network errors.</p>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <Search size={64} className="mb-3"/>
                                                <p>No results yet. Start a scan.</p>
                                            </div>
                                        )}
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
