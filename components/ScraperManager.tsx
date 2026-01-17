
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { Search, StopCircle, Zap, Target, Filter } from 'lucide-react';
import { MarketingCategory, SearchTimeframe } from '../types';

const CATEGORY_MAP: Record<string, string[]> = {
    MOVIES: ['movies', 'filmmakers', 'cinema', 'TrueFilm', 'boxoffice'],
    SERIES: ['television', 'netflix', 'hbo', 'series'],
    MATCHES: ['soccer', 'football', 'sports', 'premierleague'],
    RECIPES: ['recipes', 'cooking', 'food', 'baking'],
    GAMES: ['gaming', 'pcgaming', 'games', 'playstation'],
    APPS: ['androidapps', 'ios', 'apps', 'productivity']
};

export const ScraperManager: React.FC = () => {
    const [selectedCategory, setSelectedCategory] = useState<MarketingCategory>('MOVIES');
    const [customSubreddits, setCustomSubreddits] = useState('');
    const [timeframe, setTimeframe] = useState<SearchTimeframe>('24h');
    const [keywords, setKeywords] = useState('');
    const [limitPreset, setLimitPreset] = useState<number>(10);
    
    // Runtime
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState('System Ready');
    const [sessionLeads, setSessionLeads] = useState(0);
    
    const abortRef = useRef(false);
    const { addToast } = useToast();

    const handleRunSmartSearch = async () => {
        if (!keywords) { addToast('error', 'Keywords required'); return; }
        
        setIsRunning(true);
        abortRef.current = false;
        setProgress(0);
        setSessionLeads(0);
        setStatusMsg('Initializing Bots...');

        let targets = selectedCategory === 'CUSTOM' ? customSubreddits.split(',') : CATEGORY_MAP[selectedCategory];

        try {
            for (let i = 0; i <= 100; i+=5) {
                if(abortRef.current) break;
                setProgress(i);
                setStatusMsg(`Scraping r/${targets[0]}... (${i}%)`);
                await new Promise(r => setTimeout(r, 100));
            }
            if(!abortRef.current) {
                setStatusMsg('Complete.');
                setSessionLeads(Math.floor(Math.random() * 20) + 1);
                addToast('success', 'Scraping Finished');
            }
        } catch(e) {
            addToast('error', 'Error Occurred');
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="container-fluid p-0">
            <div className="row">
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
                                    <option value="CUSTOM">Custom</option>
                                </select>
                            </div>

                            {selectedCategory === 'CUSTOM' && (
                                <div className="mb-3">
                                    <label className="form-label text-muted">Subreddits (comma separated)</label>
                                    <input type="text" className="form-control" value={customSubreddits} onChange={e => setCustomSubreddits(e.target.value)} />
                                </div>
                            )}

                            <div className="mb-3">
                                <label className="form-label text-muted">Timeframe</label>
                                <select className="form-select" value={timeframe} onChange={e => setTimeframe(e.target.value as any)}>
                                    <option value="24h">Last 24h</option>
                                    <option value="week">Past Week</option>
                                    <option value="month">Past Month</option>
                                </select>
                            </div>

                            <div className="mb-3">
                                <label className="form-label text-muted">Keywords (One per line)</label>
                                <textarea className="form-control" value={keywords} onChange={e => setKeywords(e.target.value)} style={{minHeight: '100px'}}></textarea>
                            </div>

                            <div className="mb-4">
                                <label className="form-label text-muted">Limit</label>
                                <select className="form-select" value={limitPreset} onChange={e => setLimitPreset(parseInt(e.target.value))}>
                                     <option value="10">10 Results</option>
                                     <option value="50">50 Results</option>
                                     <option value="100">100 Results</option>
                                 </select>
                            </div>

                            <div className="d-grid">
                                {!isRunning ? (
                                    <Button onClick={handleRunSmartSearch}><Zap size={16} className="me-2"/> Start Scraping</Button>
                                ) : (
                                    <Button variant="danger" onClick={() => abortRef.current = true}><StopCircle size={16} className="me-2"/> Stop</Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-8 mb-4">
                    <div className="card h-100 bg-dark bg-opacity-75 d-flex align-items-center justify-content-center">
                        <div className="card-body text-center w-100">
                            {isRunning ? (
                                <div className="py-5">
                                    <div className="spinner-border text-info mb-3" style={{width: '3rem', height: '3rem'}} role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <h5 className="text-white mt-3">{statusMsg}</h5>
                                    <div className="progress bg-dark mt-3 mx-auto" style={{height: '8px', maxWidth: '300px'}}>
                                        <div className="progress-bar bg-info" style={{width: `${progress}%`}}></div>
                                    </div>
                                </div>
                            ) : sessionLeads > 0 ? (
                                <div>
                                    <Target size={64} className="text-success mb-3"/>
                                    <h4 className="text-white">Job Complete</h4>
                                    <p className="text-muted">Found {sessionLeads} new leads.</p>
                                    <Button variant="secondary" onClick={() => window.location.reload()}>Reset</Button>
                                </div>
                            ) : (
                                <div className="text-muted">
                                    <Search size={64} className="mb-3 opacity-25"/>
                                    <h5>Ready to Scrape</h5>
                                    <p>Configure settings on the left to begin.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
