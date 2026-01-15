
import React, { useState, useEffect } from 'react';
import { RedditComment, RedditCredential, ScrapedLead } from '../types';
import { RedditService } from '../services/redditService';
import { DatabaseService } from '../services/databaseService';
import { deepseekService } from '../services/deepseekService';
import { credentialManager } from '../services/credentialManager';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { MessageCircle, RefreshCw, Send, User, ExternalLink, MessageSquare, Clock, CheckCircle2, ChevronDown, Link, Target, Zap, LayoutList, Mail } from 'lucide-react';

export const InboxManager: React.FC = () => {
    // TABS: INBOX (Messages) vs LEADS (Scraped Content)
    const [activeTab, setActiveTab] = useState<'INBOX' | 'LEADS'>('LEADS');
    
    // Data State
    const [comments, setComments] = useState<RedditComment[]>([]);
    const [leads, setLeads] = useState<ScrapedLead[]>([]);
    
    // Selection State
    const [selectedItem, setSelectedItem] = useState<RedditComment | ScrapedLead | null>(null);
    const [replyText, setReplyText] = useState('');
    
    // Loading State
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    
    const { addToast } = useToast();

    // Linked Accounts State
    const [linkedAccounts, setLinkedAccounts] = useState<RedditCredential[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');

    useEffect(() => {
        const accounts = credentialManager.getPool();
        setLinkedAccounts(accounts);
        if (accounts.length > 0) {
            setSelectedAccountId(accounts[0].id);
        }
        // Load initial data based on default tab
        fetchData('LEADS');
    }, []);

    const fetchData = async (tab: 'INBOX' | 'LEADS') => {
        setIsLoading(true);
        setSelectedItem(null);
        setReplyText('');
        
        try {
            if (tab === 'INBOX') {
                 if (!selectedAccountId && linkedAccounts.length > 0) setSelectedAccountId(linkedAccounts[0].id);
                 
                 if (selectedAccountId) {
                    const data = await RedditService.getInbox(selectedAccountId);
                    setComments(data);
                 } else {
                    setComments([]);
                 }
            } else {
                // Fetch Pending Leads from DB
                const data = await DatabaseService.getPendingLeads();
                setLeads(data);
            }
        } catch (e) {
            addToast('error', 'فشل جلب البيانات.');
        } finally {
            setIsLoading(false);
        }
    };

    // Tab Switch Handler
    const handleTabChange = (tab: 'INBOX' | 'LEADS') => {
        setActiveTab(tab);
        fetchData(tab);
    };

    const handleGenerateAiReply = async () => {
        if (!selectedItem) return;
        setIsAiGenerating(true);
        try {
            const context = 'body' in selectedItem ? selectedItem.body : selectedItem.content;
            // Both types have 'subreddit' property, no need for ternary check
            const sub = selectedItem.subreddit;
            
            // Context Awareness for Scraped Leads
            let prompt = `Write a reply to this Reddit post/comment in r/${sub}. Content: "${context}".`;
            
            if ('matchedKeyword' in selectedItem) {
                 prompt += ` The user is interested in "${selectedItem.matchedKeyword}". Be helpful and engaging.`;
            }

            const reply = await deepseekService.generateComment(prompt, 'Professional & Helpful');
            
            if (!reply.includes('Error')) {
                setReplyText(reply);
                addToast('success', 'تم توليد الرد بنجاح.');
            } else {
                addToast('error', 'فشل التوليد.');
            }
        } catch(e) {
            addToast('error', 'خطأ في DeepSeek API.');
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleSendReply = async () => {
        if (!selectedItem || !replyText || !selectedAccountId) {
             addToast('error', 'تأكد من اختيار حساب للرد وكتابة نص.');
             return;
        }
        
        setIsSending(true);
        try {
            // Determine ID to reply to
            const thingId = selectedItem.id; 
            const recipient = selectedItem.author;

            // Real API Call
            await RedditService.postReply(thingId, replyText, recipient, selectedAccountId);
            
            addToast('success', 'تم إرسال الرد بنجاح ونشره على Reddit.');
            
            // Post-Send Cleanup
            if (activeTab === 'LEADS') {
                // Mark lead as engaged in DB so it disappears from queue
                await DatabaseService.markLeadEngaged(selectedItem.id);
                setLeads(prev => prev.filter(l => l.id !== selectedItem.id));
                setSelectedItem(null);
            } else {
                // Update local state for Inbox
                setComments(prev => prev.map(c => 
                    c.id === selectedItem.id ? { ...c, isReplied: true } : c
                ));
            }
            setReplyText('');

        } catch (e) {
            addToast('error', 'خطأ في النشر: تأكد من أن الحساب غير محظور.');
        } finally {
            setIsSending(false);
        }
    };

    const getTimeAgo = (timestamp: number | string) => {
        const timeMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp * 1000;
        const seconds = Math.floor((Date.now() - timeMs) / 1000);
        
        // Force English Numerals
        if (seconds < 60) return 'الآن';
        if (seconds < 3600) return `منذ ${Math.floor(seconds / 60).toLocaleString('en-US')} دقيقة`;
        if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600).toLocaleString('en-US')} ساعة`;
        return `منذ ${Math.floor(seconds / 86400).toLocaleString('en-US')} يوم`;
    };

    const currentAccount = linkedAccounts.find(a => a.id === selectedAccountId);

    return (
        <div className="h-[calc(100vh-140px)] animate-in fade-in duration-500 flex flex-col md:flex-row gap-6">
            
            {/* LEFT: List & Navigation */}
            <div className="w-full md:w-1/3 glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5">
                
                {/* Header & Tabs */}
                <div className="bg-[#0f172a]/80 p-2 grid grid-cols-2 gap-2 border-b border-white/5">
                     <button 
                        onClick={() => handleTabChange('LEADS')}
                        className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'LEADS' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-slate-400 hover:bg-white/5'}`}
                     >
                        <Target className="w-4 h-4" />
                        قائمة الاستهداف ({leads.length.toLocaleString('en-US')})
                     </button>
                     <button 
                        onClick={() => handleTabChange('INBOX')}
                        className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'INBOX' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'text-slate-400 hover:bg-white/5'}`}
                     >
                        <Mail className="w-4 h-4" />
                        بريد Reddit
                     </button>
                </div>

                <div className="p-4 border-b border-white/5 bg-[#0f172a]/50 flex justify-between items-center">
                    <h3 className="text-white text-xs font-bold flex items-center gap-2">
                        {activeTab === 'LEADS' ? 'نتائج البحث الجاهزة للرد' : 'الرسائل الواردة للحساب'}
                    </h3>
                    <button onClick={() => fetchData(activeTab)} className="text-slate-400 hover:text-white transition-colors" title="تحديث">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-[#020617]/30">
                    {/* --- LEADS LIST --- */}
                    {activeTab === 'LEADS' && leads.map(lead => (
                        <div 
                            key={lead.id}
                            onClick={() => { setSelectedItem(lead); setReplyText(''); }}
                            className={`p-4 rounded-xl cursor-pointer transition-all border group ${
                                selectedItem?.id === lead.id 
                                ? 'bg-primary-500/10 border-primary-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]' 
                                : 'bg-[#0f172a] border-white/5 hover:border-primary-500/20'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-mono text-primary-400 bg-primary-500/10 px-1.5 rounded border border-primary-500/20">
                                    {lead.matchedKeyword}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{getTimeAgo(lead.scrapedAt)}</span>
                            </div>
                            <p className="text-sm text-slate-300 line-clamp-2 mb-2 leading-relaxed font-medium">
                                {lead.content}
                            </p>
                            <div className="flex justify-between items-center text-[10px] text-slate-500">
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" /> u/{lead.author}
                                </span>
                                <span>r/{lead.subreddit}</span>
                            </div>
                        </div>
                    ))}

                    {/* --- INBOX LIST --- */}
                    {activeTab === 'INBOX' && comments.map(comment => (
                         <div 
                            key={comment.id}
                            onClick={() => { setSelectedItem(comment); setReplyText(''); }}
                            className={`p-4 rounded-xl cursor-pointer transition-all border ${
                                selectedItem?.id === comment.id 
                                ? 'bg-violet-500/10 border-violet-500/30' 
                                : 'bg-[#0f172a] border-white/5 hover:border-violet-500/20'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                    <User className="w-3 h-3" /> u/{comment.author}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{getTimeAgo(comment.createdUtc)}</span>
                            </div>
                            <p className="text-sm text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                                {comment.body}
                            </p>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-500 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                                    {comment.subreddit}
                                </span>
                                {comment.isReplied && (
                                    <span className="flex items-center gap-1 text-[10px] text-success-500 font-bold">
                                        <CheckCircle2 className="w-3 h-3" /> تم الرد
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {!isLoading && ((activeTab === 'LEADS' && leads.length === 0) || (activeTab === 'INBOX' && comments.length === 0)) && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center">
                                <LayoutList className="w-10 h-10 text-slate-500" />
                            </div>
                            <div>
                                <h4 className="text-slate-400 font-bold">لا توجد بيانات هنا</h4>
                                <p className="text-xs text-slate-600 mt-1 max-w-[200px] mx-auto">
                                    {activeTab === 'LEADS' ? 'قم بتشغيل "البحث الذكي" لجمع عملاء جدد.' : 'صندوق الوارد نظيف تماماً.'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Detail & Action Area */}
            <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5 relative">
                {selectedItem ? (
                    <>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {/* Context Card */}
                            <div className="mb-6 p-6 bg-[#020617]/50 rounded-xl border border-white/10 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary-500/5 to-transparent pointer-events-none"></div>
                                
                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-mono">
                                    <span className="bg-white/5 px-2 py-1 rounded">r/{selectedItem.subreddit}</span>
                                    <span>•</span>
                                    <span className="text-white font-bold">u/{selectedItem.author}</span>
                                    <a href={`https://reddit.com${selectedItem.permalink}`} target="_blank" className="ml-auto flex items-center gap-1 hover:text-primary-400 transition-colors">
                                        <ExternalLink className="w-3 h-3" /> فتح المصدر
                                    </a>
                                </div>
                                
                                <h2 className="text-white text-lg font-medium leading-relaxed mb-4">
                                    "{'body' in selectedItem ? selectedItem.body : selectedItem.content}"
                                </h2>

                                {'matchedKeyword' in selectedItem && (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-[10px] text-yellow-400 font-bold">
                                        <Target className="w-3 h-3" />
                                        سبب الاستهداف: "{selectedItem.matchedKeyword}"
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Reply Controller */}
                        <div className="p-6 bg-[#0b0f19] border-t border-white/10 relative z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                            
                            {/* Account Selector */}
                            <div className="flex justify-between items-center mb-4">
                                <div className="relative w-1/2">
                                    <select 
                                        value={selectedAccountId}
                                        onChange={(e) => setSelectedAccountId(e.target.value)}
                                        className="w-full bg-[#1e293b] border border-white/10 rounded-lg py-2 pl-3 pr-8 text-xs font-mono text-white appearance-none focus:border-primary-500 focus:outline-none cursor-pointer"
                                    >
                                        {linkedAccounts.length === 0 && <option value="">⚠️ لا توجد حسابات (يرجى الربط)</option>}
                                        {linkedAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                الرد باسم: u/{acc.username} ({acc.status})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                </div>
                                
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={handleGenerateAiReply}
                                    isLoading={isAiGenerating}
                                    className="text-xs border-primary-500/30 text-primary-300 hover:text-primary-200"
                                >
                                    <Zap className="w-3 h-3 ml-2 fill-current" />
                                    توليد رد ذكي (DeepSeek)
                                </Button>
                            </div>

                            <div className="relative">
                                <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder={activeTab === 'LEADS' ? "اكتب الرد التسويقي هنا..." : "اكتب ردك هنا..."}
                                    className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none min-h-[120px] resize-none transition-all placeholder:text-slate-600 shadow-inner font-sans"
                                />
                                <div className="absolute bottom-4 left-4">
                                     <Button 
                                        size="md" 
                                        onClick={handleSendReply} 
                                        disabled={!replyText || isSending || !selectedAccountId}
                                        isLoading={isSending}
                                        className="shadow-lg shadow-primary-500/20"
                                     >
                                        <Send className="w-4 h-4 ml-2" />
                                        نشر الرد (Live)
                                     </Button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 bg-grid-pattern bg-[length:20px_20px]">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                            <MessageSquare className="w-8 h-8 opacity-40" />
                        </div>
                        <p className="text-sm font-medium">اختر عنصراً من القائمة للبدء</p>
                    </div>
                )}
            </div>
        </div>
    );
};
