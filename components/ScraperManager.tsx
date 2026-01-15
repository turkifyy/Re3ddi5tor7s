
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { Search, StopCircle, Zap, Target, Filter, Clock, ExternalLink, ArrowLeft, AlignLeft, Hash, AlertTriangle } from 'lucide-react';
import { RedditService } from '../services/redditService';
import { DatabaseService } from '../services/databaseService';
import { MarketingCategory, SearchTimeframe } from '../types';
import { logger } from '../services/logger';

// Expanded Category Mapping
const CATEGORY_MAP: Record<string, string[]> = {
    MOVIES: ['movies', 'filmmakers', 'cinema', 'TrueFilm', 'boxoffice', 'MovieSuggestions'],
    SERIES: ['television', 'netflix', 'hbo', 'series', 'televisionsuggestions', 'DisneyPlus'],
    MATCHES: ['soccer', 'football', 'sports', 'premierleague', 'nba', 'ChampionsLeague'],
    RECIPES: ['recipes', 'cooking', 'food', 'baking', 'EatCheapAndHealthy', 'GifRecipes'],
    GAMES: ['gaming', 'pcgaming', 'games', 'playstation', 'xbox', 'NintendoSwitch'],
    APPS: ['androidapps', 'ios', 'apps', 'productivity', 'software', 'technology']
};

export const ScraperManager: React.FC = () => {
    // Marketing Configuration
    const [selectedCategory, setSelectedCategory] = useState<MarketingCategory>('MOVIES');
    const [customSubreddits, setCustomSubreddits] = useState('');
    const [timeframe, setTimeframe] = useState<SearchTimeframe>('24h');
    
    // Custom Date State
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const [keywords, setKeywords] = useState('');
    
    // Result Limit State (Preset + Custom)
    const [limitPreset, setLimitPreset] = useState<number>(10);
    const [customLimit, setCustomLimit] = useState<string>('');

    // Runtime State
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState('جاهز للبحث الذكي');
    const [errorCount, setErrorCount] = useState(0);
    
    // Safety & Network Control
    const abortRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const isMounted = useRef(true);
    
    // Session Stats
    const [sessionLeads, setSessionLeads] = useState<number>(0);
    
    const { addToast } = useToast();

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            // Kill any active network requests on unmount
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const handleStopScraper = () => {
        if (isRunning) {
            abortRef.current = true;
            // Trigger Network Abort immediately
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            setStatusMsg('جاري الإيقاف القسري للشبكة...');
            addToast('info', 'تم قطع الاتصال بالخادم.');
        }
    };

    const getFinalLimit = () => {
        if (customLimit && !isNaN(parseInt(customLimit))) {
            return parseInt(customLimit);
        }
        return limitPreset;
    };

    const handleRunSmartSearch = async () => {
        if (!keywords) {
            addToast('error', 'يجب إدخال الكلمات الدلالية المستهدفة.');
            return;
        }
        
        let targets: string[] = [];
        if (selectedCategory === 'CUSTOM') {
             targets = customSubreddits.split(',').map(s => s.trim()).filter(s => s);
             if (targets.length === 0) {
                 addToast('error', 'يجب إدخال Subreddits في الوضع المخصص.');
                 return;
             }
        } else {
             targets = CATEGORY_MAP[selectedCategory] || [];
        }

        const keywordList = keywords.split('\n').map(k => k.trim().toLowerCase()).filter(k => k);
        if (keywordList.length === 0) {
            addToast('error', 'يرجى إدخال كلمة دلالية واحدة على الأقل.');
            return;
        }

        const targetLimit = getFinalLimit();

        // Initialize Production State
        setIsRunning(true);
        abortRef.current = false;
        abortControllerRef.current = new AbortController(); // New Signal
        const signal = abortControllerRef.current.signal;

        setProgress(0);
        setSessionLeads(0);
        setErrorCount(0);
        setStatusMsg('تهيئة بوتات البحث...');
        
        let totalFound = 0;

        try {
            let apiTime = 'all';
            let cutoffDateStart = 0; 
            let cutoffDateEnd = Date.now();
            
            const now = Date.now();
            switch(timeframe) {
                case '24h': apiTime = 'day'; break;
                case 'week': apiTime = 'week'; break;
                case 'month': apiTime = 'month'; break;
                case '3months': 
                    apiTime = 'year'; 
                    cutoffDateStart = now - (90 * 24 * 60 * 60 * 1000); 
                    break;
                case 'year': apiTime = 'year'; break;
                case 'custom':
                    apiTime = 'all';
                    if (customStartDate) cutoffDateStart = new Date(customStartDate).getTime();
                    if (customEndDate) cutoffDateEnd = new Date(customEndDate).getTime() + 86400000; 
                    break;
                case 'all': apiTime = 'all'; break;
                default: apiTime = 'month';
            }

            const limitPerSub = Math.ceil(targetLimit / targets.length);

            for (let tIdx = 0; tIdx < targets.length; tIdx++) {
                const sub = targets[tIdx];
                
                if (abortRef.current || signal.aborted) break;
                setStatusMsg(`جاري المسح في r/${sub}...`);

                try {
                    // Pass signal to Service for real network abort
                    const posts = await RedditService.fetchSubredditPosts(sub, 'new', limitPerSub, apiTime, signal);
                    
                    if (!posts || posts.length === 0) continue;

                    for (let i = 0; i < posts.length; i++) {
                        if (abortRef.current || signal.aborted) break;
                        
                        try {
                            const post = posts[i];
                            const postTime = post.created_utc * 1000;
                            
                            if (timeframe === '3months' && postTime < cutoffDateStart) continue;
                            if (timeframe === 'custom' && (postTime < cutoffDateStart || postTime > cutoffDateEnd)) continue;

                            const postText = (post.title + " " + (post.selftext || "")).toLowerCase();
                            const match = keywordList.find(k => postText.includes(k));

                            if (match) {
                                await DatabaseService.addScrapedLead({
                                    id: post.name,
                                    type: 'POST',
                                    subreddit: sub,
                                    author: post.author,
                                    content: post.title,
                                    matchedKeyword: match,
                                    permalink: post.permalink,
                                    scrapedAt: new Date().toISOString(),
                                    status: 'NEW',
                                    score: post.score
                                });
                                totalFound++;
                                setSessionLeads(prev => prev + 1);
                            }

                            if (totalFound < targetLimit) { 
                                // Pass signal here too
                                const comments = await RedditService.fetchPostComments(post.name, 20, signal);
                                for (const comment of comments) {
                                    if (abortRef.current || signal.aborted) break;
                                    const commentTime = comment.created_utc * 1000;
                                    if (timeframe === '3months' && commentTime < cutoffDateStart) continue;
                                    if (timeframe === 'custom' && (commentTime < cutoffDateStart || commentTime > cutoffDateEnd)) continue;

                                    const commentText = (comment.body || "").toLowerCase();
                                    const cMatch = keywordList.find(k => commentText.includes(k));
                                    if (cMatch) {
                                        await DatabaseService.addScrapedLead({
                                            id: comment.name,
                                            type: 'COMMENT',
                                            subreddit: sub,
                                            author: comment.author,
                                            content: comment.body,
                                            matchedKeyword: cMatch,
                                            permalink: comment.permalink || post.permalink,
                                            scrapedAt: new Date().toISOString(),
                                            status: 'NEW',
                                            score: comment.score
                                        });
                                        totalFound++;
                                        setSessionLeads(prev => prev + 1);
                                    }
                                }
                            }

                            const globalProgress = Math.floor(((tIdx * posts.length) + i) / (targets.length * posts.length) * 100);
                            setProgress(globalProgress);

                        } catch (innerErr) {
                            continue; 
                        }
                    }
                    
                    await new Promise(r => setTimeout(r, 1500));

                } catch (e: any) {
                    if (e.message === 'ABORTED' || e.name === 'AbortError') break;

                    logger.warn('SCRAPER', `Recovering from error in r/${sub}: ${e.message}`);
                    setErrorCount(prev => prev + 1);
                    if (e.message.includes('RATE_LIMIT')) {
                         setStatusMsg('تم تجاوز الحدود، انتظار 5 ثوانٍ...');
                         await new Promise(r => setTimeout(r, 5000));
                    }
                }
            }
            
            if (isMounted.current && !signal.aborted) {
                setProgress(100);
                setStatusMsg('اكتمل البحث.');
                addToast('success', `تم العثور على ${totalFound} عميل محتمل وتم ترحيلهم لقائمة الرد.`);
            }

        } catch (e: any) {
            if (isMounted.current) {
                if (e.message !== 'ABORTED' && e.name !== 'AbortError') {
                     addToast('error', `خطأ غير متوقع: ${e.message}`);
                     setStatusMsg('توقف.');
                } else {
                     setStatusMsg('تم الإيقاف.');
                }
            }
        } finally {
            if (isMounted.current) {
                setIsRunning(false);
                abortRef.current = false;
                abortControllerRef.current = null;
            }
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                    <Search className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">نظام الاستحواذ الذكي (Lead Acquisition)</h2>
                    <p className="text-slate-400 text-sm mt-1 font-mono">البحث الحي وتخزين العملاء المحتملين لقسم الرد المباشر</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Configuration Panel */}
                <div className="glass-panel rounded-2xl p-8 border border-white/5 h-fit relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-bl-full pointer-events-none"></div>
                    
                    <h3 className="text-white font-bold text-lg mb-8 flex items-center gap-2 relative z-10">
                        <Filter className="w-5 h-5 text-primary-400" />
                        تكوين معلمات البحث (Advanced Search)
                    </h3>

                    <div className="space-y-6 relative z-10">
                        {/* 1. Category Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                <Target className="w-3 h-3" /> الفئة المستهدفة
                            </label>
                            <select 
                                value={selectedCategory}
                                onChange={(e: any) => setSelectedCategory(e.target.value)}
                                disabled={isRunning}
                                className="w-full bg-[#0b0f19] border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none"
                            >
                                <option value="MOVIES">الأفلام (Movies & Cinema)</option>
                                <option value="SERIES">المسلسلات (Series & TV)</option>
                                <option value="MATCHES">المباريات (Sports & Matches)</option>
                                <option value="RECIPES">الوصفات (Cooking & Food)</option>
                                <option value="GAMES">الألعاب (Gaming)</option>
                                <option value="APPS">التطبيقات (Apps & Tech)</option>
                                <option value="CUSTOM">تخصيص يدوي (Custom)</option>
                            </select>
                        </div>

                        {selectedCategory === 'CUSTOM' && (
                             <div className="space-y-2 animate-in fade-in">
                                <label className="text-xs font-bold text-slate-400 uppercase">Subreddits (مفصولة بفاصلة)</label>
                                <input 
                                    value={customSubreddits}
                                    onChange={e => setCustomSubreddits(e.target.value)}
                                    placeholder="marketing, startups, saas"
                                    className="w-full bg-[#0b0f19] border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none"
                                />
                             </div>
                        )}

                        {/* 2. Timeframe Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                <Clock className="w-3 h-3" /> النطاق الزمني
                            </label>
                            <select 
                                value={timeframe}
                                onChange={(e: any) => setTimeframe(e.target.value)}
                                disabled={isRunning}
                                className="w-full bg-[#0b0f19] border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none"
                            >
                                <option value="24h">آخر 24 ساعة</option>
                                <option value="week">الأسبوع الماضي</option>
                                <option value="month">الشهر الماضي</option>
                                <option value="3months">آخر 3 أشهر</option>
                                <option value="custom">مخصص (Start - End)</option>
                            </select>
                            {timeframe === 'custom' && (
                                <div className="flex gap-2 animate-in fade-in">
                                    <div className="relative flex-1">
                                        <input 
                                            type="date" 
                                            value={customStartDate}
                                            onChange={e => setCustomStartDate(e.target.value)}
                                            disabled={isRunning} 
                                            className="w-full bg-[#0b0f19] border border-white/10 rounded-lg p-2 text-white text-xs" 
                                        />
                                    </div>
                                    <div className="relative flex-1">
                                        <input 
                                            type="date" 
                                            value={customEndDate}
                                            onChange={e => setCustomEndDate(e.target.value)}
                                            disabled={isRunning} 
                                            className="w-full bg-[#0b0f19] border border-white/10 rounded-lg p-2 text-white text-xs" 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. Keywords (Multiline) */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                <AlignLeft className="w-3 h-3" /> الكلمات الدلالية (كلمة في كل سطر)
                            </label>
                            <textarea 
                                value={keywords}
                                onChange={e => setKeywords(e.target.value)}
                                placeholder={`netflix suggestion\nbest movie\napp request`}
                                disabled={isRunning}
                                className="w-full h-32 bg-[#0b0f19] border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none resize-none font-mono leading-relaxed"
                            />
                            <p className="text-[10px] text-slate-500">يدعم المطابقة التامة (Exact Match). أقصى حد: 50 كلمة.</p>
                        </div>

                        {/* 4. Results Limit */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                <Hash className="w-3 h-3" /> حد النتائج
                            </label>
                            <div className="flex gap-2">
                                <select 
                                    value={limitPreset}
                                    onChange={(e: any) => { setLimitPreset(parseInt(e.target.value)); setCustomLimit(''); }}
                                    disabled={isRunning}
                                    className="flex-[2] bg-[#0b0f19] border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none font-mono"
                                >
                                    {[2, 10, 50, 150, 1000, 5000, 10000, 15000, 20000].map(val => (
                                        <option key={val} value={val}>{val.toLocaleString('en-US')}</option>
                                    ))}
                                </select>
                                <input 
                                    type="number" 
                                    placeholder="مخصص"
                                    value={customLimit}
                                    onChange={e => setCustomLimit(e.target.value)}
                                    disabled={isRunning}
                                    className="flex-1 bg-[#0b0f19] border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none text-center font-mono"
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-6 pt-4 border-t border-white/5">
                            {!isRunning ? (
                                <Button onClick={handleRunSmartSearch} className="flex-1 py-4 shadow-[0_0_20px_rgba(59,130,246,0.3)] group relative overflow-hidden">
                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]"></div>
                                    <Zap className="w-4 h-4 ml-2 fill-current" />
                                    بدء البحث الذكي
                                </Button>
                            ) : (
                                <Button onClick={handleStopScraper} variant="danger" className="flex-1 animate-pulse">
                                    <StopCircle className="w-4 h-4 ml-2" />
                                    إيقاف البحث
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status & Output Panel */}
                <div className="flex flex-col gap-6">
                    {/* Live Status Card */}
                    <div className="glass-panel rounded-2xl p-8 border border-white/5 flex flex-col justify-center items-center text-center relative overflow-hidden flex-1">
                        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                        
                        {isRunning ? (
                            <div className="space-y-6 relative z-10 w-full max-w-sm">
                                <div className="w-20 h-20 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto relative">
                                     <div className="absolute inset-0 rounded-full border-2 border-primary-500 border-t-transparent animate-spin"></div>
                                     <Zap className="w-8 h-8 text-primary-400 animate-pulse" />
                                </div>
                                
                                <div>
                                    <h3 className="text-white text-xl font-bold mb-2 animate-pulse">{statusMsg}</h3>
                                    <p className="text-slate-400 text-sm font-mono">جاري الزحف عبر Reddit API (Realtime)...</p>
                                    {errorCount > 0 && (
                                        <div className="text-orange-400 text-xs mt-2 flex items-center justify-center gap-1 font-bold">
                                            <AlertTriangle className="w-3 h-3" />
                                            تم تجاوز {errorCount.toLocaleString('en-US')} خطأ تلقائياً
                                        </div>
                                    )}
                                </div>

                                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-white/5">
                                    <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="flex justify-between text-xs text-slate-500 font-mono">
                                    <span>التقدم: {progress.toLocaleString('en-US')}%</span>
                                    <span>تم العثور على: {sessionLeads.toLocaleString('en-US')}</span>
                                </div>
                            </div>
                        ) : sessionLeads > 0 ? (
                            <div className="space-y-6 relative z-10 animate-in zoom-in">
                                <div className="w-20 h-20 rounded-full bg-success-500/10 flex items-center justify-center mx-auto border border-success-500/20">
                                     <Target className="w-10 h-10 text-success-500" />
                                </div>
                                
                                <div>
                                    <h3 className="text-white text-2xl font-black mb-2">اكتملت المهمة!</h3>
                                    <p className="text-slate-300 text-sm">تم العثور على <span className="text-success-400 font-bold text-lg mx-1">{sessionLeads.toLocaleString('en-US')}</span> عميل محتمل.</p>
                                    <p className="text-slate-500 text-xs mt-2">تم حفظ النتائج تلقائياً في قاعدة البيانات.</p>
                                </div>

                                <Button size="lg" onClick={() => window.location.reload()} className="bg-success-600 hover:bg-success-500 border-success-400/30">
                                    <ArrowLeft className="w-4 h-4 ml-2" />
                                    انتقل للرد المباشر (Inbox)
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4 relative z-10 opacity-50">
                                <div className="w-24 h-24 bg-white/5 rounded-full mx-auto flex items-center justify-center">
                                    <Search className="w-10 h-10 text-slate-500" />
                                </div>
                                <h3 className="text-slate-500 font-bold">النظام في وضع الخمول (Idle)</h3>
                                <p className="text-xs text-slate-600 max-w-xs mx-auto">
                                    قم بضبط الإعدادات واضغط "بدء البحث" لتفعيل الروبوتات.
                                </p>
                            </div>
                        )}
                    </div>
                    
                    {/* Info Card */}
                    <div className="p-6 bg-blue-500/5 rounded-2xl border border-blue-500/10 flex items-start gap-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <ExternalLink className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h4 className="text-white font-bold text-sm mb-1">دورة العمل (Production Workflow)</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                النتائج التي يتم العثور عليها هنا تنتقل تلقائياً إلى قسم <strong>"قائمة الاستهداف"</strong> في صفحة الرد المباشر (Inbox).
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
