
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { Search, StopCircle, Zap, Target, Filter, ExternalLink, ArrowRight, Eye, X, Terminal, AlertTriangle, Youtube, ArrowUp, ArrowDown, Database, Settings, Check, ListFilter, CalendarClock, Globe, Flame, Bot, MessageSquare, User, ThumbsUp, Sparkles } from 'lucide-react';
import { MarketingCategory, SearchTimeframe, ScrapedLead, ViewState } from '../types';
import { RedditService } from '../services/redditService';
import { YouTubeService } from '../services/youtubeService';
import { deepseekService } from '../services/deepseekService';
import { DatabaseService } from '../services/databaseService';
import { logger } from '../services/logger';

const CATEGORY_MAP: Record<string, string[]> = {
    // REDDIT & GENERAL
    MOVIES: ['movies', 'filmmakers', 'cinema', 'TrueFilm', 'boxoffice', 'full movie', 'movie review', 'trailer'],
    SERIES: ['television', 'netflix', 'hbo', 'series', 'series review', 'tv show', 'full episode'],
    MATCHES: ['soccer', 'football', 'sports', 'premierleague', 'nba', 'football highlights', 'live match', 'sports commentary'],
    RECIPES: ['recipes', 'cooking', 'food', 'baking', 'EatCheapAndHealthy', 'cooking tutorial', 'easy recipe', 'street food'],
    GAMES: ['gaming', 'pcgaming', 'games', 'playstation', 'xbox', 'nintendo', 'gameplay', 'game review'],
    APPS: ['androidapps', 'ios', 'apps', 'productivity', 'startups', 'best apps', 'app review'],
    
    // YOUTUBE SPECIFIC EXTENSIONS (Viral Niches)
    APPS_MOD: ['mod apk download', 'premium unlocked apk', 'android mod', 'cracked apps', 'pro apk free'],
    GAMES_MOD: ['game mod menu', 'unlimited money game', 'game cheat code', 'hacked games apk', 'modded games android'],
    EARN_MONEY: ['make money online', 'passive income', 'work from home', 'crypto trading', 'affiliate marketing', 'earn money app'],
    ECOMMERCE: ['product review', 'unboxing', 'best amazon products', 'dropshipping', 'gadget review', 'top 10 products'],
    COURSE: ['full course tutorial', 'educational video', 'learn programming', 'digital marketing course', 'free certification', 'tutorial for beginners'],
    SERVICE: ['freelancing tips', 'digital agency', 'consulting services', 'fiverr gig', 'upwork tutorial', 'professional services'],
    DATING: ['dating advice', 'relationship tips', 'pickup lines', 'how to date', 'dating app review'],
    MUSIC: ['music video', 'new song', 'remix', 'lofi hip hop', 'download music', 'copyright free music', 'mp3 download']
};

// AI INTENT PROMPTS
const AI_INTENT_PROMPTS: Record<string, string> = {
    MOVIES: "We offer a free streaming platform. Identify users who have NOT watched the movie yet and are actively asking for a link, website, or source to watch or download it full and free. Reject users who are just reviewing or discussing the plot because they already watched it.",
    SERIES: "We offer a free streaming platform. Identify users who have NOT watched the show/episode yet and are actively asking for a link, website, or source to watch or download it full and free. Reject users who are just reviewing or discussing the plot.",
    SPORTS: "We offer free live sports streaming. Identify users asking for a link, channel, or website to watch the match live. Reject users just discussing the score or players.",
    RECIPES: "We offer a full recipe and cooking guide platform. Identify users asking for the full recipe, ingredients list, or step-by-step instructions. Reject users just saying the food looks good.",
    APPS_MOD: "We offer modded premium APKs. Identify users asking how to get the premium version for free, looking for a mod, hack, or download link. Reject users just complaining about the app.",
    EARN_MONEY: "We offer online earning methods and jobs. Identify users asking how to make money, looking for work, or asking for a tutorial/guide to start earning. Reject users promoting their own scams.",
    ECOMMERCE: "We sell the product shown in the video. Identify users asking where to buy it, asking for the price, or asking for a store link. Reject users who already bought it or are just saying it looks cool.",
    COURSES: "We offer full educational courses. Identify users asking for a full course, tutorial, or asking where they can learn this skill from scratch. Reject users who are already experts.",
    SERVICES: "We offer professional freelancing services. Identify users saying they need help, are looking to hire someone, or asking for the cost of a service. Reject users offering their own services.",
    DATING: "We offer a dating app/platform. Identify users asking for the best app, site, or place to meet people, or asking for a download link. Reject users just telling personal stories.",
    MUSIC: "We offer free music downloads. Identify users asking for the song name, audio track, or a link to download the music. Reject users just saying 'good song'."
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
    const [customVideoId, setCustomVideoId] = useState('');
    const [timeframe, setTimeframe] = useState<SearchTimeframe>('24h');
    const [limitPreset, setLimitPreset] = useState<number>(10);
    const [targetRegion, setTargetRegion] = useState<string>('US');
    const [targetLanguage, setTargetLanguage] = useState<string>('en');
    const [includeReplies, setIncludeReplies] = useState<boolean>(false);
    const [minCommentLikes, setMinCommentLikes] = useState<number>(0);
    const [aiContext, setAiContext] = useState<string>(AI_INTENT_PROMPTS['MOVIES']);
    
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
    
    // Handle Category Change
    const handleCategoryChange = (newCategory: string) => {
        setSelectedCategory(newCategory as any);
        if (AI_INTENT_PROMPTS[newCategory]) {
            setAiContext(AI_INTENT_PROMPTS[newCategory]);
        }
    };

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [executionLogs]);

    // UX FIX: Reset results, logs, AND Category when switching modes to avoid invalid state
    useEffect(() => {
        setResults([]);
        setExecutionLogs([]);
        setStatusMsg('System Ready');
        setProgress(0);
        
        // CRITICAL FIX: Reset category to a safe default that exists on both platforms
        setSelectedCategory('MOVIES');
        // UX FIX: Clear custom input when switching modes to prevent confusion
        setCustomSubreddits('');
        setCustomVideoId('');
        setIncludeReplies(false);
        setMinCommentLikes(0);
        
        setAiContext('We are looking for people who need a video editing software that is easy to use and fast.');

        if (scrapeMode === 'YOUTUBE') {
            setHasYtKey(!!YouTubeService.getApiKey());
            setTimeframe('24h');
        } else {
            setTimeframe('24h');
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

    // HELPER: Convert Timeframe to RFC 3339 for YouTube
    const getYouTubePublishedAfter = (tf: SearchTimeframe): string | undefined => {
        const now = new Date();
        if (tf === '24h') now.setDate(now.getDate() - 1);
        else if (tf === '48h') now.setDate(now.getDate() - 2);
        else if (tf === '72h') now.setDate(now.getDate() - 3);
        else if (tf === 'week') now.setDate(now.getDate() - 7);
        else if (tf === 'month') now.setMonth(now.getMonth() - 1);
        else if (tf === '3months') now.setMonth(now.getMonth() - 3);
        else if (tf === 'year') now.setFullYear(now.getFullYear() - 1);
        else return undefined; // All time
        return now.toISOString();
    };

    const handleRunSmartSearch = async () => {
        // INPUT HARDENING: Ensure Custom Categories have actual text
        if (selectedCategory === 'CUSTOM' && !customSubreddits.trim()) {
            addToast('error', 'Please enter Search Topics for Custom category.');
            return;
        }
        
        setIsRunning(true);
        abortRef.current = false;
        setProgress(0);
        setResults([]);
        setExecutionLogs([]); 
        setStatusMsg('Initializing Search Protocols...');
        addLog('--- STARTING SESSION V6.4 (SMART TREND ROTATION) ---', 'INFO');

        // --- YOUTUBE MODE (SMART TREND DETECTION) ---
        if (scrapeMode === 'YOUTUBE') {
            const currentKey = YouTubeService.getApiKey();
            if (!currentKey) {
                addToast('error', 'YouTube API Key is missing. Check Configuration.');
                setIsRunning(false);
                return;
            }

            try {
                // Determine Targets (Smart Trend Discovery)
                let videoTargets: {id: string, title: string}[] = [];
                
                if (customVideoId.trim()) {
                    // SMART EXTRACTION: Handle full URLs or raw IDs
                    const rawInput = customVideoId.trim();
                    const extractedId = YouTubeService.extractVideoId(rawInput) || rawInput;
                    
                    addLog(`[PRECISION MODE] Initializing deep scan for target: ${extractedId}`, 'INFO');
                    
                    try {
                        // Fetch rich metadata for validation and context
                        const videoData = await YouTubeService.fetchVideoDetails(extractedId);
                        const title = videoData.snippet.title;
                        const channel = videoData.snippet.channelTitle;
                        const views = parseInt(videoData.statistics.viewCount).toLocaleString();
                        
                        addLog(`Target Locked: "${title}" by ${channel} (${views} views)`, 'SUCCESS');
                        videoTargets = [{ id: extractedId, title: title }];
                    } catch (e: any) {
                        addLog(`Video Validation Warning: ${e.message}. Proceeding with raw ID.`, 'WARN');
                        videoTargets = [{ id: extractedId, title: `Target Video (${extractedId})` }];
                    }
                } else {
                    // DISCOVERY MODE: Fetch Trending Videos
                    const rawSearchTerms = selectedCategory === 'CUSTOM' ? 
                         customSubreddits.split(',') : // Use the custom input as search queries
                         CATEGORY_MAP[selectedCategory];

                    if(!rawSearchTerms || rawSearchTerms.length === 0) {
                        addToast('error', 'No search terms defined for category.'); setIsRunning(false); return;
                    }
                    
                    // Clean inputs
                    const allSearchTerms = rawSearchTerms
                        .map(t => t.trim())
                        .filter(t => t.length > 0);

                    // MAINTENANCE UPDATE: Randomize terms to ensure broad coverage across multiple runs
                    // This prevents scanning the exact same "top 5" terms every single time.
                    const shuffledTerms = [...allSearchTerms].sort(() => 0.5 - Math.random());
                    const searchTerms = shuffledTerms.slice(0, 5);

                    const publishedAfter = getYouTubePublishedAfter(timeframe);
                    addLog(`Trend Radar Active: Scanning ${searchTerms.length} random niches from category...`, 'INFO');
                    
                    for (const term of searchTerms) {
                        if (abortRef.current) break;

                        addLog(`Analyzing Trends for: "${term}" in region ${targetRegion} (Lang: ${targetLanguage})...`, 'INFO');
                        // KEY CHANGE: Sort by 'viewCount' to detect TRENDS, not just recent videos
                        const found = await YouTubeService.searchVideos(term, publishedAfter, 5, 'viewCount', targetRegion, targetLanguage);
                        
                        if (found.length > 0) {
                            addLog(`Detected ${found.length} viral videos for "${term}".`, 'SUCCESS');
                            videoTargets = [...videoTargets, ...found.map(v => ({id: v.videoId, title: v.title}))];
                        }
                        
                        // Tiny delay between search calls
                        await new Promise(r => setTimeout(r, 200));
                    }

                    if (videoTargets.length === 0) {
                        addToast('info', 'No trending videos found matching criteria.');
                        setIsRunning(false);
                        return;
                    }

                    // Remove duplicates
                    videoTargets = videoTargets.filter((v, i, self) => i === self.findIndex((t) => t.id === v.id));

                    // SAFETY CAP: Limit to 20 videos max to prevent quota exhaustion on Comment Threads
                    if (videoTargets.length > 20) {
                        addLog(`Queue Optimization: Limiting to top 20/${videoTargets.length} viral videos to protect API Quota.`, 'WARN');
                        videoTargets = videoTargets.slice(0, 20);
                    }

                    addLog(`Total Trend Queue: ${videoTargets.length} viral videos.`, 'INFO');
                }

                // Process Loop
                let matchesFound = 0;

                for (let i = 0; i < videoTargets.length; i++) {
                     if (abortRef.current) break;
                     const target = videoTargets[i];
                     
                     setStatusMsg(`Scraping Viral Video ${i+1}/${videoTargets.length}: ${target.title.substring(0, 30)}...`);
                     setProgress(Math.round(((i) / videoTargets.length) * 100));

                     try {
                        // SMART FETCH: Pass includeReplies parameter
                        const comments = await YouTubeService.fetchVideoComments(target.id, limitPreset, includeReplies);
                        
                        for (const comment of comments) {
                            // SMART FILTER: Minimum Likes
                            if (minCommentLikes > 0 && (comment.likes || 0) < minCommentLikes) {
                                continue; // Skip low-value comments
                            }

                            // AI INTENT VERIFICATION
                            addLog(`[AI] Analyzing intent for: ${comment.author}...`, 'INFO');
                            const analysis = await deepseekService.analyzeLeadIntent(comment.content, aiContext);
                            
                            if (!analysis.isLead) {
                                addLog(`[AI] Rejected lead from ${comment.author}. Reason: ${analysis.reason}`, 'WARN');
                                continue; // Skip this lead, AI says it's not good
                            }

                            const aiData = {
                                score: analysis.score,
                                intent: analysis.intent,
                                reason: analysis.reason
                            };

                            const typeLabel = comment.isReply ? 'REPLY' : 'COMMENT';
                            addLog(`LEAD FOUND: AI matched intent in ${typeLabel} by ${comment.author} (${comment.likes} likes)`, 'SUCCESS');
                            
                            const maxTitleLen = 60; 
                            const titleClean = comment.videoTitle.length > maxTitleLen 
                                ? `${comment.videoTitle.substring(0, maxTitleLen)}...` 
                                : comment.videoTitle;
    
                            const newLead: ScrapedLead = {
                                id: comment.id,
                                type: 'COMMENT',
                                subreddit: `YouTube: ${titleClean} [${typeLabel}]`,
                                author: comment.author,
                                content: comment.content,
                                matchedKeyword: 'AI Verified',
                                permalink: `/watch?v=${target.id}&lc=${comment.id}`,
                                scrapedAt: new Date().toISOString(),
                                status: 'NEW',
                                score: comment.likes,
                                aiScore: aiData.score,
                                aiIntent: aiData.intent,
                                aiReasoning: aiData.reason
                            };
    
                            if (!results.find(l => l.id === newLead.id)) {
                                 await DatabaseService.addScrapedLead(newLead);
                                 setResults(prev => [...prev, newLead]);
                                 matchesFound++;
                            }
                        }
                     } catch (err: any) {
                         const errorMsg = err.message || '';
                         // CRITICAL FIX: EMERGENCY CIRCUIT BREAKER
                         // If we hit a Quota error or 403, STOP EVERYTHING immediately.
                         if (errorMsg.includes('QUOTA') || errorMsg.includes('403') || errorMsg.includes('429')) {
                             addLog(`CRITICAL STOP: API Limit Reached. Aborting session.`, 'ERROR');
                             addToast('error', 'YouTube API Quota Exceeded. Stopping.');
                             abortRef.current = true;
                             break;
                         }
                         
                         // Gracefully skip videos where comments are disabled or other fetch errors
                         addLog(`Skipped video ${target.id.substring(0,11)}: ${errorMsg}`, 'WARN');
                     }
                     
                     // Small delay to prevent burst limits
                     await new Promise(r => setTimeout(r, 500));
                }

                setStatusMsg('YouTube Trend Scan Complete.');
                addLog(`Trend Session End. Found ${matchesFound} leads.`, 'SUCCESS');
                
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
                    
                    if (posts.length > 0) {
                        addLog(`HTTP 200 OK (${latency}ms). Parsed ${posts.length} objects.`, 'SUCCESS');
                    } else {
                        // VISUAL FIX: Distinguish between "Success but empty" and failures
                        addLog(`Subreddit scanned (${latency}ms) but returned no results (Check filters).`, 'WARN');
                    }
                    
                    let subLeads = 0;
                    for (const post of posts) {
                        const displayContent = `${post.title} ${post.selftext || ''}`;
                        
                        // AI INTENT VERIFICATION
                        addLog(`[AI] Analyzing intent for post by: ${post.author}...`, 'INFO');
                        const analysis = await deepseekService.analyzeLeadIntent(displayContent, aiContext);
                        
                        if (!analysis.isLead) {
                            addLog(`[AI] Rejected lead from ${post.author}. Reason: ${analysis.reason}`, 'WARN');
                            continue; // Skip this lead, AI says it's not good
                        }

                        const aiData = {
                            score: analysis.score,
                            intent: analysis.intent,
                            reason: analysis.reason
                        };

                        addLog(`LEAD FOUND: AI matched intent in ${post.id}`, 'SUCCESS');
                        
                        const newLead: ScrapedLead = {
                            id: post.name,
                            type: 'POST',
                            subreddit: sub,
                            author: post.author,
                            content: displayContent, 
                            matchedKeyword: 'AI Verified',
                            permalink: post.permalink,
                            scrapedAt: new Date().toISOString(),
                            status: 'NEW',
                            score: post.score,
                            aiScore: aiData.score,
                            aiIntent: aiData.intent,
                            aiReasoning: aiData.reason
                        };

                        if (!leadsFound.find(l => l.id === newLead.id)) {
                            await DatabaseService.addScrapedLead(newLead);
                            leadsFound.push(newLead);
                            setResults(prev => [...prev, newLead]);
                            subLeads++;
                        }
                    }
                    
                    if (subLeads === 0 && posts.length > 0) addLog(`No keyword matches in r/${sub}.`, 'INFO');
                    
                    await new Promise(r => setTimeout(r, 1500)); // Polite delay

                } catch (err: any) {
                    // Graceful handling of specific error types
                    const errorMsg = err.message || '';
                    if (errorMsg.includes('INVALID_NAME')) {
                        addLog(`SKIPPED: Invalid subreddit name "${sub}".`, 'WARN');
                    } else {
                        addLog(`API ERROR: ${errorMsg}`, 'ERROR');
                        logger.error('SCRAPER', `Failed to scrape r/${sub}: ${errorMsg}`);
                    }
                    
                    if (errorMsg.includes('Network Grid Down')) {
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
                    addToast('info', 'No matches found with current AI context.');
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
                            
                            {previewItem.aiScore !== undefined && (
                                <div className="mb-4 p-3 bg-dark rounded border border-info border-opacity-25">
                                    <div className="d-flex align-items-center mb-2">
                                        <Bot size={16} className="text-info me-2"/>
                                        <span className="fw-bold text-white me-2">AI Analysis</span>
                                        <span className={`badge ${previewItem.aiScore >= 80 ? 'bg-success' : previewItem.aiScore >= 50 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                                            Score: {previewItem.aiScore}/100
                                        </span>
                                    </div>
                                    <div className="text-info mb-1 fw-bold" style={{fontSize: '0.85rem'}}>Intent: {previewItem.aiIntent}</div>
                                    <div className="text-muted fst-italic" style={{fontSize: '0.85rem'}}>{previewItem.aiReasoning}</div>
                                </div>
                            )}

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

                            {/* --- REDDIT SPECIFIC CONTROLS --- */}
                            {scrapeMode === 'REDDIT' && (
                                <>
                                    <div className="mb-3">
                                        <label className="form-label text-muted"><ListFilter size={14} className="me-1"/> Target Category</label>
                                        <select className="form-select" value={selectedCategory} onChange={e => handleCategoryChange(e.target.value)}>
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
                                        <label className="form-label text-muted"><CalendarClock size={14} className="me-1"/> Timeframe</label>
                                        <select className="form-select" value={timeframe} onChange={e => setTimeframe(e.target.value as any)}>
                                            <option value="hour">Past Hour</option>
                                            <option value="24h">Last 24h</option>
                                            <option value="week">Past Week</option>
                                            <option value="month">Past Month</option>
                                            <option value="all">All Time</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {/* --- YOUTUBE SPECIFIC CONTROLS --- */}
                            {scrapeMode === 'YOUTUBE' && (
                                <>
                                    <div className="mb-4 p-3 border border-info border-opacity-50 rounded bg-dark position-relative shadow-sm">
                                        <label className="form-label text-info fw-bold d-flex align-items-center">
                                            <Target size={16} className="me-2"/> Precision Mode (Target Specific Video)
                                        </label>
                                        <input 
                                            type="text" 
                                            className="form-control border-info bg-black text-white shadow-none" 
                                            placeholder="Paste full YouTube URL or Video ID..." 
                                            value={customVideoId} 
                                            onChange={e => setCustomVideoId(e.target.value)} 
                                            autoComplete="off"
                                        />
                                        <div className="form-text text-info opacity-75 mb-3">Overrides trend search. Extracts leads from a specific video.</div>
                                    </div>

                                    {!customVideoId && (
                                        <>
                                            <div className="p-3 mb-3 bg-danger bg-opacity-10 rounded border border-danger border-opacity-25 text-center">
                                                <Flame size={20} className="text-danger mb-2"/>
                                                <div className="text-white fw-bold small text-uppercase">Smart Trend Detection</div>
                                                <div className="text-muted small" style={{fontSize: '0.75rem'}}>Automatically finds viral videos in selected niche (Randomized).</div>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label text-muted"><Globe size={14} className="me-1"/> Target Region (High CPM)</label>
                                                <select className="form-select" value={targetRegion} onChange={e => setTargetRegion(e.target.value)}>
                                                    <option value="US">United States (US)</option>
                                                    <option value="GB">United Kingdom (GB)</option>
                                                    <option value="CA">Canada (CA)</option>
                                                    <option value="AU">Australia (AU)</option>
                                                    <option value="AE">United Arab Emirates (AE)</option>
                                                    <option value="SA">Saudi Arabia (SA)</option>
                                                    <option value="QA">Qatar (QA)</option>
                                                    <option value="KW">Kuwait (KW)</option>
                                                    <option value="DE">Germany (DE)</option>
                                                    <option value="FR">France (FR)</option>
                                                    <option value="IN">India (IN) - Low CPM</option>
                                                </select>
                                                <div className="form-text text-secondary">Select the geographic region to target for high CPM leads.</div>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label text-muted"><Globe size={14} className="me-1"/> Target Language</label>
                                                <select className="form-select" value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}>
                                                    <option value="en">English (EN)</option>
                                                    <option value="ar">Arabic (AR)</option>
                                                    <option value="fr">French (FR)</option>
                                                    <option value="de">German (DE)</option>
                                                    <option value="es">Spanish (ES)</option>
                                                </select>
                                                <div className="form-text text-secondary">Forces YouTube to return content in this language (Prevents unwanted Indian/Hindi content).</div>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label text-muted"><Globe size={14} className="me-1"/> Content Category</label>
                                                <select className="form-select border-danger" value={selectedCategory} onChange={e => handleCategoryChange(e.target.value)}>
                                                    <option value="MOVIES">Movies & Cinema</option>
                                                    <option value="SERIES">TV Series & Shows</option>
                                                    <option value="MATCHES">Football & Sports</option>
                                                    <option value="RECIPES">Food & Recipes</option>
                                                    <option value="APPS_MOD">Apps Mod (APK)</option>
                                                    <option value="GAMES_MOD">Games Mod (APK)</option>
                                                    <option value="EARN_MONEY">Earn Money / Online Work</option>
                                                    <option value="ECOMMERCE">E-Commerce & Products</option>
                                                    <option value="COURSE">Courses & Education</option>
                                                    <option value="SERVICE">Services & Freelancing</option>
                                                    <option value="DATING">Dating & Relationships</option>
                                                    <option value="MUSIC">Download Music</option>
                                                    <option value="CUSTOM">Custom Search Topics</option>
                                                </select>
                                            </div>

                                            {selectedCategory === 'CUSTOM' && (
                                                <div className="mb-3">
                                                    <label className="form-label text-muted">Search Topics (comma separated)</label>
                                                    <input type="text" className="form-control" placeholder="e.g. AI news, funny cats" value={customSubreddits} onChange={e => setCustomSubreddits(e.target.value)} />
                                                </div>
                                            )}

                                            <div className="mb-3">
                                                <label className="form-label text-muted"><CalendarClock size={14} className="me-1"/> Viral Since</label>
                                                <select className="form-select" value={timeframe} onChange={e => setTimeframe(e.target.value as any)}>
                                                    <option value="24h">Last 24 Hours</option>
                                                    <option value="48h">Past 2 Days</option>
                                                    <option value="72h">Past 3 Days</option>
                                                    <option value="week">Past Week</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {!hasYtKey ? (
                                        <div className="alert alert-danger bg-danger bg-opacity-10 border-danger border-opacity-25 d-flex align-items-center mt-2 p-2 small text-danger">
                                            <AlertTriangle size={16} className="me-2 flex-shrink-0"/>
                                            <div className="flex-grow-1 fw-bold">YouTube API Key Missing</div>
                                            <Button size="sm" variant="danger" onClick={() => onNavigate?.('SETTINGS')} className="px-3 py-0" style={{minHeight: '28px'}}>Configure</Button>
                                        </div>
                                    ) : (
                                        <div className="form-text text-secondary d-flex justify-content-between align-items-center mt-2">
                                            <span><Check size={12} className="text-success me-1"/> API Ready</span>
                                            <button className="btn btn-link btn-sm text-muted p-0 text-decoration-none" onClick={() => onNavigate?.('SETTINGS')} style={{fontSize: '0.75rem'}}>
                                                <Settings size={12} className="me-1"/> Update Key
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* COMMON CONTROLS */}
                            <hr className="border-secondary opacity-25" />
                            
                            {/* Advanced Filters */}
                            <div className="p-3 bg-black rounded border border-secondary border-opacity-25 mb-4">
                                <div className="form-check form-switch mb-3">
                                    <input className="form-check-input bg-info border-info" type="checkbox" id="includeReplies" checked={includeReplies} onChange={e => setIncludeReplies(e.target.checked)} />
                                    <label className="form-check-label text-white small fw-bold" htmlFor="includeReplies">Deep Scrape (Analyze Comment Replies)</label>
                                    <div className="text-muted" style={{fontSize: '0.7rem'}}>Fetches nested replies. Slower, but finds hidden leads.</div>
                                </div>
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <label className="text-white small fw-bold mb-0">Quality Filter (Min. Likes)</label>
                                        <div className="text-muted" style={{fontSize: '0.7rem'}}>Ignore spam/bot comments with 0 likes.</div>
                                    </div>
                                    <input type="number" className="form-control form-control-sm bg-dark text-white border-secondary text-center" value={minCommentLikes} onChange={e => setMinCommentLikes(parseInt(e.target.value) || 0)} min="0" style={{ width: '70px' }} />
                                </div>
                            </div>
                            
                            <div className="p-3 bg-black rounded border border-primary border-opacity-25 mb-4">
                                <label className="form-check-label text-white small fw-bold d-flex align-items-center mb-2">
                                    <Bot size={14} className="me-1 text-primary"/> AI Intent Verification (DeepSeek)
                                </label>
                                <div className="text-muted mb-3" style={{fontSize: '0.7rem'}}>Uses AI to analyze every comment and find genuine leads based on the context below.</div>
                                
                                <div className="p-2 bg-dark rounded border border-primary border-opacity-25">
                                    <label className="text-primary small fw-bold mb-1">Product/Service Context (What are you selling?)</label>
                                    <textarea 
                                        className="form-control form-control-sm bg-black text-white border-secondary" 
                                        rows={4}
                                        placeholder="e.g. We sell a SaaS tool for managing Twitter accounts..."
                                        value={aiContext}
                                        onChange={e => setAiContext(e.target.value)}
                                        style={{ fontSize: '0.8rem' }}
                                    />
                                    <div className="text-muted mt-1" style={{fontSize: '0.65rem'}}>The AI uses this context to determine if the commenter is a genuine lead.</div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label text-muted">{scrapeMode === 'YOUTUBE' ? 'Max Comments per Video' : 'Max Posts per Subreddit'}</label>
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
                                        {scrapeMode === 'YOUTUBE' ? 'Start Trend Scan' : 'Start Subreddit Scraping'}
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
                                                    <small className="text-muted d-block mb-2">by {lead.author} • {lead.score} likes/score</small>
                                                    
                                                    {lead.aiScore !== undefined && (
                                                        <div className="mt-2 p-2 bg-black bg-opacity-50 rounded border border-info border-opacity-25" style={{fontSize: '0.8rem'}}>
                                                            <div className="d-flex align-items-center mb-1">
                                                                <Bot size={12} className="text-info me-1"/>
                                                                <span className="text-info fw-bold me-2">AI Intent: {lead.aiIntent}</span>
                                                                <span className={`badge ${lead.aiScore >= 80 ? 'bg-success' : lead.aiScore >= 50 ? 'bg-warning text-dark' : 'bg-danger'}`} style={{fontSize: '0.65rem'}}>
                                                                    {lead.aiScore}
                                                                </span>
                                                            </div>
                                                            <div className="text-muted fst-italic text-truncate" style={{maxWidth: '400px'}} title={lead.aiReasoning}>{lead.aiReasoning}</div>
                                                        </div>
                                                    )}
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
