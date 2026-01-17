
import React, { useState, useEffect } from 'react';
import { RedditComment, RedditCredential, ScrapedLead } from '../types';
import { RedditService } from '../services/redditService';
import { DatabaseService } from '../services/databaseService';
import { deepseekService } from '../services/deepseekService';
import { credentialManager } from '../services/credentialManager';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { MessageCircle, Send, User, ExternalLink, Mail, Target, Zap } from 'lucide-react';

export const InboxManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'INBOX' | 'LEADS'>('LEADS');
    const [comments, setComments] = useState<RedditComment[]>([]);
    const [leads, setLeads] = useState<ScrapedLead[]>([]);
    const [selectedItem, setSelectedItem] = useState<RedditComment | ScrapedLead | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const { addToast } = useToast();
    const [linkedAccounts, setLinkedAccounts] = useState<RedditCredential[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');

    useEffect(() => {
        const accounts = credentialManager.getPool();
        setLinkedAccounts(accounts);
        if (accounts.length > 0) setSelectedAccountId(accounts[0].id);
        fetchData('LEADS');
    }, []);

    const fetchData = async (tab: 'INBOX' | 'LEADS') => {
        setIsLoading(true);
        setSelectedItem(null);
        try {
            if (tab === 'INBOX') {
                 if (selectedAccountId) {
                    const data = await RedditService.getInbox(selectedAccountId);
                    setComments(data);
                 }
            } else {
                const data = await DatabaseService.getPendingLeads();
                setLeads(data);
            }
        } catch (e) { addToast('error', 'Fetch Failed'); }
        finally { setIsLoading(false); }
    };

    const handleTabChange = (tab: 'INBOX' | 'LEADS') => {
        setActiveTab(tab);
        fetchData(tab);
    };

    const handleGenerateAiReply = async () => {
        if (!selectedItem) return;
        setIsAiGenerating(true);
        try {
            const context = 'body' in selectedItem ? selectedItem.body : selectedItem.content;
            const sub = selectedItem.subreddit;
            let prompt = `Reply to reddit post in r/${sub}: "${context}".`;
            if ('matchedKeyword' in selectedItem) prompt += ` Mention keyword: ${selectedItem.matchedKeyword}`;
            
            const reply = await deepseekService.generateComment(prompt, 'Helpful');
            if (!reply.includes('Error')) setReplyText(reply);
            else addToast('error', reply);
        } catch(e) { addToast('error', 'AI Failed'); }
        finally { setIsAiGenerating(false); }
    };

    const handleSendReply = async () => {
        if (!selectedItem || !replyText || !selectedAccountId) return;
        setIsSending(true);
        try {
            const thingId = selectedItem.id; 
            const recipient = selectedItem.author;
            await RedditService.postReply(thingId, replyText, recipient, selectedAccountId);
            addToast('success', 'Reply Sent');
            
            if (activeTab === 'LEADS') {
                await DatabaseService.markLeadEngaged(selectedItem.id);
                setLeads(prev => prev.filter(l => l.id !== selectedItem.id));
                setSelectedItem(null);
            } else {
                setComments(prev => prev.map(c => c.id === selectedItem.id ? { ...c, isReplied: true } : c));
            }
            setReplyText('');
        } catch (e) { addToast('error', 'Post Failed'); }
        finally { setIsSending(false); }
    };

    return (
        <div className="container-fluid p-0 h-100">
            <div className="row h-100 g-0 border border-secondary border-opacity-25 rounded overflow-hidden" style={{minHeight: '80vh'}}>
                {/* LEFT SIDEBAR LIST */}
                <div className="col-md-4 col-lg-3 bg-dark border-end border-secondary border-opacity-25 d-flex flex-column">
                    <div className="p-2 border-bottom border-secondary border-opacity-25 d-flex gap-2">
                        <Button size="sm" variant={activeTab === 'LEADS' ? 'primary' : 'secondary'} onClick={() => handleTabChange('LEADS')} className="flex-grow-1">
                             <Target size={14} className="me-2"/> Leads
                         </Button>
                         <Button size="sm" variant={activeTab === 'INBOX' ? 'primary' : 'secondary'} onClick={() => handleTabChange('INBOX')} className="flex-grow-1">
                             <Mail size={14} className="me-2"/> Inbox
                         </Button>
                    </div>

                    <div className="flex-grow-1 overflow-auto">
                        <div className="list-group list-group-flush">
                            {activeTab === 'LEADS' && leads.map(lead => (
                                <button key={lead.id} 
                                    className={`list-group-item list-group-item-action bg-transparent text-white border-bottom border-secondary border-opacity-25 py-3 ${selectedItem?.id === lead.id ? 'active bg-primary bg-opacity-25' : ''}`}
                                    onClick={() => setSelectedItem(lead)}
                                >
                                    <div className="d-flex w-100 justify-content-between mb-1">
                                        <span className="badge bg-info text-black">r/{lead.subreddit}</span>
                                        <small className="text-warning">{lead.matchedKeyword}</small>
                                    </div>
                                    <p className="mb-0 text-truncate small text-secondary">{lead.content}</p>
                                </button>
                            ))}
                             {activeTab === 'INBOX' && comments.map(comment => (
                                <button key={comment.id} 
                                    className={`list-group-item list-group-item-action bg-transparent text-white border-bottom border-secondary border-opacity-25 py-3 ${selectedItem?.id === comment.id ? 'active bg-primary bg-opacity-25' : ''}`}
                                    onClick={() => setSelectedItem(comment)}
                                >
                                    <div className="d-flex w-100 justify-content-between mb-1">
                                        <span className="fw-bold"><User size={12} className="me-1"/> {comment.author}</span>
                                        {comment.isReplied && <span className="text-success small">Replied</span>}
                                    </div>
                                    <p className="mb-0 text-truncate small text-secondary">{comment.body}</p>
                                </button>
                            ))}
                            {((activeTab === 'LEADS' && leads.length === 0) || (activeTab === 'INBOX' && comments.length === 0)) && (
                                <div className="p-4 text-center text-muted small">No items found.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT DETAIL VIEW */}
                <div className="col-md-8 col-lg-9 bg-dark bg-opacity-50">
                    {selectedItem ? (
                        <div className="d-flex flex-column h-100">
                            <div className="p-4 border-bottom border-secondary border-opacity-25 flex-grow-1 overflow-auto">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <span className="badge bg-secondary">r/{selectedItem.subreddit}</span>
                                    <a href={`https://reddit.com${selectedItem.permalink}`} target="_blank" className="text-info text-decoration-none small d-flex align-items-center">
                                        <ExternalLink size={14} className="me-1"/> Open Thread
                                    </a>
                                </div>
                                <div className="card bg-dark border-secondary border-opacity-25 mb-3">
                                    <div className="card-body">
                                        <h5 className="card-text lh-base">
                                            "{'body' in selectedItem ? selectedItem.body : selectedItem.content}"
                                        </h5>
                                        <div className="text-end text-muted mt-2 small">- u/{selectedItem.author}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-black bg-opacity-25 border-top border-secondary border-opacity-25">
                                <div className="row g-2 mb-3">
                                    <div className="col-md-6">
                                        <label className="form-label text-muted small">Reply As</label>
                                        <select className="form-select form-select-sm" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                                            <option value="" disabled>Choose Account</option>
                                            {linkedAccounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>u/{acc.username}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-6 text-end d-flex align-items-end justify-content-end">
                                        <Button variant="ghost" size="sm" onClick={handleGenerateAiReply} isLoading={isAiGenerating}>
                                            <Zap size={14} className="me-2"/> Generate AI Reply
                                        </Button>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <textarea className="form-control" rows={3} placeholder="Write your reply..." value={replyText} onChange={e => setReplyText(e.target.value)}></textarea>
                                </div>
                                <div className="text-end">
                                    <Button onClick={handleSendReply} isLoading={isSending} disabled={!replyText}>
                                        <Send size={16} className="me-2"/> Send Reply
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                            <MessageCircle size={64} className="mb-3 opacity-25"/>
                            <h5>Select an item to respond</h5>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
