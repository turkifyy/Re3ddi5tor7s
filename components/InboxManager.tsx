
import React, { useState, useEffect } from 'react';
import { RedditComment } from '../types';
import { RedditService } from '../services/redditService';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { MessageCircle, RefreshCw, Send, User, ExternalLink, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';

export const InboxManager: React.FC = () => {
    const [comments, setComments] = useState<RedditComment[]>([]);
    const [selectedComment, setSelectedComment] = useState<RedditComment | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const { addToast } = useToast();

    const fetchInbox = async () => {
        setIsLoading(true);
        try {
            const data = await RedditService.getInbox();
            setComments(data);
            if (data.length > 0 && !selectedComment) {
                setSelectedComment(data[0]);
            }
        } catch (e) {
            addToast('error', 'فشل جلب الرسائل من Reddit API.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInbox();
    }, []);

    const handleSelectComment = (comment: RedditComment) => {
        setSelectedComment(comment);
        setReplyText('');
    };

    const handleSendReply = async () => {
        if (!selectedComment || !replyText) return;
        
        setIsSending(true);
        try {
            await RedditService.postReply(selectedComment.id, replyText, selectedComment.author);
            addToast('success', 'تم إرسال الرد بنجاح ونشره على Reddit.');
            
            // Update local state to show "Replied"
            setComments(prev => prev.map(c => 
                c.id === selectedComment.id ? { ...c, isReplied: true } : c
            ));
            setSelectedComment(prev => prev ? { ...prev, isReplied: true } : null);
            setReplyText('');

        } catch (e) {
            addToast('error', 'خطأ في النشر: لم يتمكن النظام من الوصول إلى خوادم Reddit.');
        } finally {
            setIsSending(false);
        }
    };

    const getTimeAgo = (timestamp: number) => {
        const seconds = Math.floor(Date.now() / 1000 - timestamp);
        if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
        if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
        return `منذ ${Math.floor(seconds / 86400)} يوم`;
    };

    return (
        <div className="h-[calc(100vh-140px)] animate-in fade-in duration-500 flex flex-col md:flex-row gap-6">
            
            {/* LEFT: Comment List */}
            <div className="w-full md:w-1/3 glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5">
                <div className="p-4 border-b border-white/5 bg-[#0f172a]/50 flex justify-between items-center">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-primary-400" />
                        الوارد (Reddit Inbox)
                    </h3>
                    <button onClick={fetchInbox} className="text-slate-400 hover:text-white transition-colors">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {comments.map(comment => (
                        <div 
                            key={comment.id}
                            onClick={() => handleSelectComment(comment)}
                            className={`p-4 rounded-xl cursor-pointer transition-all border ${
                                selectedComment?.id === comment.id 
                                ? 'bg-primary-500/10 border-primary-500/30' 
                                : 'bg-white/5 border-transparent hover:bg-white/10'
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
                </div>
            </div>

            {/* RIGHT: Detail & Reply Area */}
            <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5 relative">
                {selectedComment ? (
                    <>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {/* Context Header */}
                            <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                    <MessageSquare className="w-4 h-4" />
                                    <span>في الرد على المنشور:</span>
                                    <span className="text-primary-400 font-bold truncate max-w-[300px]">{selectedComment.postTitle}</span>
                                    <a href="#" className="ml-auto flex items-center gap-1 hover:text-white transition-colors">
                                        <ExternalLink className="w-3 h-3" /> فتح في Reddit
                                    </a>
                                </div>
                                <h2 className="text-white text-lg font-bold leading-relaxed mb-4">
                                    "{selectedComment.body}"
                                </h2>
                                <div className="flex gap-4 text-xs font-mono text-slate-500">
                                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedComment.author}</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(selectedComment.createdUtc * 1000).toLocaleString('ar-EG')}</span>
                                    <span className={`px-2 rounded-full ${
                                        selectedComment.sentiment === 'Positive' ? 'text-green-400 bg-green-500/10' :
                                        selectedComment.sentiment === 'Negative' ? 'text-red-400 bg-red-500/10' :
                                        'text-slate-400 bg-slate-500/10'
                                    }`}>
                                        تحليل: {selectedComment.sentiment}
                                    </span>
                                </div>
                            </div>

                            {/* Conversation Thread Visualizer (Mock) */}
                            {selectedComment.isReplied && (
                                <div className="flex flex-col items-end mb-8 animate-in slide-in-from-bottom-2">
                                    <div className="bg-primary-600/20 border border-primary-500/30 p-4 rounded-2xl rounded-tr-sm max-w-[80%]">
                                        <p className="text-sm text-slate-200">
                                            (الرد المؤرشف) شكراً على تعليقك! نحن نستخدم React و Tailwind لبناء هذه الواجهة.
                                        </p>
                                    </div>
                                    <span className="text-[10px] text-slate-500 mt-1 mr-2">تم الإرسال عبر RedditOps</span>
                                </div>
                            )}
                        </div>

                        {/* Reply Input Area */}
                        <div className="p-6 bg-[#020617] border-t border-white/10 relative z-10">
                            <div className="relative">
                                <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="اكتب ردك هنا... سيتم نشره مباشرة باسم الحساب النشط."
                                    className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 pr-4 pl-12 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none min-h-[120px] resize-none transition-all placeholder:text-slate-600 shadow-inner"
                                    disabled={selectedComment.isReplied}
                                />
                                <div className="absolute bottom-4 left-4 flex gap-2">
                                     <Button 
                                        size="sm" 
                                        onClick={handleSendReply} 
                                        disabled={!replyText || isSending || selectedComment.isReplied}
                                        isLoading={isSending}
                                        className={selectedComment.isReplied ? 'opacity-50 grayscale' : ''}
                                     >
                                        <Send className="w-4 h-4 ml-2" />
                                        {selectedComment.isReplied ? 'تم الرد' : 'نشر الرد'}
                                     </Button>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                متصل بـ Reddit Gateway API. الردود فورية.
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                            <MessageSquare className="w-8 h-8 opacity-50" />
                        </div>
                        <p>اختر تعليقاً من القائمة لبدء الرد</p>
                    </div>
                )}
            </div>
        </div>
    );
};
