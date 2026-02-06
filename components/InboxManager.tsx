
import React, { useState, useEffect } from 'react';
import { RedditComment, RedditCredential, ScrapedLead } from '../types';
import { RedditService } from '../services/redditService';
import { DatabaseService } from '../services/databaseService';
import { deepseekService } from '../services/deepseekService';
import { credentialManager } from '../services/credentialManager';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { Send, User, ExternalLink, Mail, Target, Zap, Youtube, CheckCircle, Copy, Crosshair, Trash2, ShieldAlert, MessageCircle } from 'lucide-react';

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
        if (accounts.length > 0) {
            setSelectedAccountId(accounts[0].id);
        }
        fetchData('LEADS');
    }, []);

    useEffect(() => {
        if (activeTab === 'INBOX' && selectedAccountId) {
            fetchData('INBOX');
        }
    }, [selectedAccountId]);

    // UX FIX: Reset reply text when switching targets to avoid accidental wrong replies
    useEffect(() => {
        setReplyText('');
    }, [selectedItem]);

    const fetchData = async (tab: 'INBOX' | 'LEADS') => {
        setIsLoading(true);
        setSelectedItem(null);
        try {
            if (tab === 'INBOX') {
                 if (selectedAccountId) {
                    const data = await RedditService.getInbox(selectedAccountId);
                    setComments(data);
                 } else {
                    setComments([]);
                 }
            } else {
                const data = await DatabaseService.getPendingLeads();
                setLeads(data);
            }
        } catch (e) { 
            // Silent catch to prevent console spam, handled by UI state
            if (tab === 'INBOX') setComments([]);
            else addToast('error', 'Fetch Failed'); 
        }
        finally { setIsLoading(false); }
    };

    const handleTabChange = (tab: 'INBOX' | 'LEADS') => {
        setActiveTab(tab);
        fetchData(tab);
    };

    // CONSOLE FIX: Added safe checks to prevent "Cannot read properties of undefined"
    const isYouTubeItem = (item: any) => {
        if (!item || typeof item !== 'object') return false;
        
        // Safe access to subreddit property
        const sub = item.subreddit;
        if (!sub) return false;

        return 'type' in item && String(sub).startsWith('YouTube:');
    };

    // CONSOLE FIX: Robust string handling to prevent crashes
    const getFormattedSubName = (name: string | undefined | null) => {
        if (!name) return 'Unknown';
        const strName = String(name); // Force string conversion
        
        if (strName.startsWith('YouTube:')) return strName.replace('YouTube:', '').trim();
        return strName.startsWith('r/') ? strName : `r/${strName}`;
    };

    const handleGenerateAiReply = async () => {
        if (!selectedItem) return;
        setIsAiGenerating(true);
        try {
            const context = 'body' in selectedItem ? selectedItem.body : selectedItem.content;
            const sub = selectedItem.subreddit || 'General'; // Fallback
            let prompt = '';
            
            if (isYouTubeItem(selectedItem)) {
                const videoTitle = String(sub).replace('YouTube:', '').trim();
                prompt = `Write a short, engaging YouTube reply to this comment: "${context}". The video title is: "${videoTitle}".`;
            } else {
                prompt = `Reply to this social media comment: "${context}". Context: ${getFormattedSubName(sub)}.`;
            }
            
            if ('matchedKeyword' in selectedItem) prompt += ` Mention keyword: ${selectedItem.matchedKeyword}`;
            
            const reply = await deepseekService.generateComment(prompt, 'Helpful & Engaging');
            if (!reply.includes('Error')) setReplyText(reply);
            else addToast('error', reply);
        } catch(e) { addToast('error', 'AI Failed'); }
        finally { setIsAiGenerating(false); }
    };

    const handleCopyToClipboard = () => {
        if (!replyText) return;
        navigator.clipboard.writeText(replyText);
        addToast('success', 'Reply copied to clipboard');
    };

    const handleSniperEngage = () => {
        if (!selectedItem) return;
        
        if (replyText) {
            navigator.clipboard.writeText(replyText);
            addToast('success', 'Ammo Loaded (Reply Copied)');
        }

        const link = isYouTubeItem(selectedItem) 
            ? `https://youtube.com${selectedItem.permalink}` 
            : `https://reddit.com${selectedItem.permalink}`;
        
        window.open(link, '_blank');
    };

    const handleManualComplete = async () => {
        if (!selectedItem) return;
        setIsSending(true);
        try {
            if (activeTab === 'LEADS') {
                await DatabaseService.markLeadEngaged(selectedItem.id);
                
                const logContent = replyText.trim() ? replyText : '[Manual Engagement via External Link]';
                
                await DatabaseService.deployCampaignContent(
                    'manual_sniper', 
                    logContent, 
                    selectedItem.subreddit
                );

                setLeads(prev => prev.filter(l => l.id !== selectedItem!.id));
                setSelectedItem(null);
                setReplyText('');
                addToast('success', 'Target neutralized & Logged');
            } else {
                 setComments(prev => prev.map(c => c.id === selectedItem.id ? { ...c, isReplied: true } : c));
                 setSelectedItem(null);
                 setReplyText('');
            }
        } catch(e) {
            addToast('error', 'Failed to update status');
        } finally {
            setIsSending(false);
        }
    };

    const handleDismiss = async () => {
        if (!selectedItem) return;
        if (!confirm('Dismiss this target? It will be removed from the list.')) return;
        
        setIsSending(true);
        try {
             if (activeTab === 'LEADS') {
                await DatabaseService.markLeadDismissed(selectedItem.id);
                setLeads(prev => prev.filter(l => l.id !== selectedItem!.id));
                setSelectedItem(null);
                setReplyText('');
                addToast('info', 'Target Dismissed');
            }
        } catch(e) {
            addToast('error', 'Failed to dismiss');
        } finally {
            setIsSending(false);
        }
    };

    const handleSendReply = async () => {
        if (!selectedItem || !replyText) return;
        setIsSending(true);
        try {
            const thingId = selectedItem.id; 
            
            if (isYouTubeItem(selectedItem)) {
                addToast('error', "Auto-posting disabled for YouTube. Use Manual Sniper Mode.");
                return;
            }

            if (!selectedAccountId) {
                addToast('error', 'Select a Reddit account');
                return;
            }
            const recipient = selectedItem.author;
            await RedditService.postReply(thingId, replyText, recipient, selectedAccountId);
            addToast('success', 'Reddit Reply Sent');
            
            if (activeTab === 'LEADS') {
                await DatabaseService.markLeadEngaged(selectedItem.id);
                setLeads(prev => prev.filter(l => l.id !== selectedItem!.id));
                setSelectedItem(null);
            } else {
                setComments(prev => prev.map(c => c.id === selectedItem!.id ? { ...c, isReplied: true } : c));
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
                    <div className="p-2 border-bottom border-secondary border-opacity-25">
                         <div className="d-flex gap-2 mb-2">
                            <Button size="sm" variant={activeTab === 'LEADS' ? 'primary' : 'secondary'} onClick={() => handleTabChange('LEADS')} className="flex-grow-1">
                                <Target size={14} className="me-2"/> Targets
                            </Button>
                            <Button size="sm" variant={activeTab === 'INBOX' ? 'primary' : 'secondary'} onClick={() => handleTabChange('INBOX')} className="flex-grow-1">
                                <Mail size={14} className="me-2"/> Inbox
                            </Button>
                        </div>
                        
                        {activeTab === 'INBOX' && (
                            <select 
                                className="form-select form-select-sm bg-black text-white border-secondary"
                                value={selectedAccountId}
                                onChange={e => setSelectedAccountId(e.target.value)}
                            >
                                {linkedAccounts.length === 0 && <option>No Accounts</option>}
                                {linkedAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>u/{acc.username}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex-grow-1 overflow-auto custom-scrollbar">
                        <div className="list-group list-group-flush">
                            {activeTab === 'LEADS' && leads.map(lead => (
                                <button key={lead.id} 
                                    className={`list-group-item list-group-item-action bg-transparent text-white border-bottom border-secondary border-opacity-25 py-3 ${selectedItem?.id === lead.id ? 'active bg-primary bg-opacity-25' : ''}`}
                                    onClick={() => setSelectedItem(lead)}
                                >
                                    <div className="d-flex w-100 justify-content-between mb-1">
                                        {isYouTubeItem(lead) ? (
                                            <span 
                                                className="badge bg-danger text-white" 
                                                style={{maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle'}}
                                                title={lead.subreddit ? lead.subreddit.replace('YouTube:', '').trim() : 'Unknown'}
                                            >
                                                <Youtube size={10} className="me-1"/> {lead.subreddit ? lead.subreddit.replace('YouTube:', '').trim() : 'Video'}
                                            </span>
                                        ) : (
                                            <span 
                                                className="badge bg-info text-black"
                                                title={getFormattedSubName(lead.subreddit)}
                                            >
                                                {getFormattedSubName(lead.subreddit)}
                                            </span>
                                        )}
                                        <small className="text-warning font-monospace">{lead.matchedKeyword}</small>
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
                                        <div className="text-truncate">
                                            <span className="fw-bold me-2"><User size={12} className="me-1"/> {comment.author}</span>
                                            <span 
                                                className="badge bg-secondary opacity-75" 
                                                style={{fontSize: '0.6rem'}}
                                                title={getFormattedSubName(comment.subreddit)}
                                            >
                                                {getFormattedSubName(comment.subreddit)}
                                            </span>
                                        </div>
                                        {comment.isReplied && <span className="text-success small"><CheckCircle size={10} className="me-1"/></span>}
                                    </div>
                                    <p className="mb-0 text-truncate small text-secondary">{comment.body}</p>
                                </button>
                            ))}
                            {((activeTab === 'LEADS' && leads.length === 0) || (activeTab === 'INBOX' && comments.length === 0)) && (
                                <div className="p-4 text-center text-muted small">
                                    <Target size={32} className="mb-2 opacity-50"/>
                                    <p>No active items.</p>
                                    {activeTab === 'INBOX' && <small>Check selected account.</small>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT DETAIL VIEW */}
                <div className="col-md-8 col-lg-9 bg-dark bg-opacity-50">
                    {selectedItem ? (
                        <div className="d-flex flex-column h-100">
                            <div className="p-4 border-bottom border-secondary border-opacity-25 flex-grow-1 overflow-auto custom-scrollbar">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    {isYouTubeItem(selectedItem) ? (
                                         <span 
                                            className="badge bg-danger text-truncate" 
                                            style={{maxWidth: '300px', verticalAlign: 'bottom'}}
                                            title={selectedItem.subreddit ? selectedItem.subreddit.replace('YouTube:', '').trim() : 'Video'}
                                         >
                                            <Youtube size={14} className="me-1"/> {selectedItem.subreddit ? selectedItem.subreddit.replace('YouTube:', '').trim() : 'Video'}
                                         </span>
                                    ) : (
                                         <span className="badge bg-secondary">
                                            {getFormattedSubName(selectedItem.subreddit)}
                                         </span>
                                    )}
                                    <div className="text-info small font-monospace d-flex align-items-center border border-info border-opacity-25 px-2 py-1 rounded">
                                        <Crosshair size={14} className="me-2"/> TARGET LOCKED
                                    </div>
                                </div>
                                
                                <div className="card bg-black border-secondary border-opacity-25 mb-4 shadow-lg">
                                    <div className="card-body">
                                        <h5 className="card-text lh-base text-light" style={{whiteSpace: 'pre-wrap'}}>
                                            "{'body' in selectedItem ? selectedItem.body : selectedItem.content}"
                                        </h5>
                                        <div className="text-end text-muted mt-3 small font-monospace">
                                            DETECTED: {selectedItem.author} 
                                            { 'score' in selectedItem && ` • SCORE: ${selectedItem.score}` }
                                        </div>
                                    </div>
                                </div>

                                {/* MANUAL ACTION AREA */}
                                <div className="row g-3">
                                    <div className="col-12">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <label className="text-muted small text-uppercase fw-bold"><Zap size={12} className="me-1"/> 1. Generate Ammo (Response)</label>
                                            <Button variant="ghost" size="sm" onClick={handleGenerateAiReply} isLoading={isAiGenerating} className="text-info">
                                                <Zap size={14} className="me-1"/> Generate with DeepSeek
                                            </Button>
                                        </div>
                                        <div className="position-relative">
                                            <textarea 
                                                className="form-control bg-dark text-white border-secondary font-monospace" 
                                                rows={4} 
                                                placeholder="AI generated response will appear here..." 
                                                value={replyText} 
                                                onChange={e => setReplyText(e.target.value)}
                                                style={{fontSize: '0.9rem', resize: 'none'}}
                                            ></textarea>
                                            <button 
                                                className="btn btn-sm btn-light position-absolute bottom-0 end-0 m-2"
                                                onClick={handleCopyToClipboard}
                                                disabled={!replyText}
                                                title="Copy to Clipboard"
                                            >
                                                <Copy size={14} className="me-1"/> Copy
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER */}
                            <div className="p-4 bg-black border-top border-secondary border-opacity-25">
                                <div className="d-flex flex-column gap-3">
                                    <div className="d-flex gap-2 align-items-center">
                                         <label className="text-muted small text-uppercase fw-bold text-nowrap"><Target size={12} className="me-1"/> 2. Engage</label>
                                         <div className="border-bottom border-secondary border-opacity-25 w-100"></div>
                                    </div>
                                    
                                    <div className="d-flex gap-3">
                                        <Button 
                                            variant="primary" 
                                            onClick={handleSniperEngage} 
                                            className="btn-lg flex-grow-1 d-flex align-items-center justify-content-center shadow-lg"
                                            style={{height: '55px', fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.5px'}}
                                        >
                                            <ExternalLink size={22} className="me-2"/> 
                                            {isYouTubeItem(selectedItem) ? (
                                                <span className="d-flex align-items-center"><Youtube size={22} className="me-2"/> OPEN YOUTUBE</span>
                                            ) : (
                                                <span className="d-flex align-items-center"><MessageCircle size={22} className="me-2"/> OPEN REDDIT</span>
                                            )}
                                        </Button>

                                        <Button 
                                            variant="secondary" 
                                            onClick={handleManualComplete} 
                                            isLoading={isSending}
                                            style={{height: '55px', minWidth: '160px'}}
                                            className="btn-success bg-opacity-25 text-success border-success border-opacity-50"
                                        >
                                            <CheckCircle size={20} className="me-2"/> MARK DONE
                                        </Button>
                                        
                                        <Button 
                                            variant="secondary" 
                                            onClick={handleDismiss} 
                                            isLoading={isSending}
                                            style={{height: '55px', width: '55px'}}
                                            className="btn-danger bg-opacity-10 text-danger border-danger border-opacity-25 p-0 d-flex align-items-center justify-content-center"
                                            title="Dismiss Target"
                                        >
                                            <Trash2 size={20}/>
                                        </Button>
                                    </div>
                                    
                                    <div className="text-center">
                                        {!isYouTubeItem(selectedItem) && (
                                            <div className="dropdown d-inline-block">
                                                <button className="btn btn-sm btn-link text-muted text-decoration-none dropdown-toggle" style={{fontSize: '0.75rem'}} type="button" data-bs-toggle="dropdown">
                                                    Legacy: Use API Bot (Risky)
                                                </button>
                                                <ul className="dropdown-menu bg-dark border-secondary shadow-lg">
                                                    <li className="px-3 py-2">
                                                        <select className="form-select form-select-sm mb-2" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                                                            <option value="" disabled>Choose Account</option>
                                                            {linkedAccounts.map(acc => (
                                                                <option key={acc.id} value={acc.id}>u/{acc.username}</option>
                                                            ))}
                                                        </select>
                                                        <Button size="sm" onClick={handleSendReply} disabled={!replyText} className="w-100 btn-danger">
                                                            <Send size={14} className="me-1"/> Auto-Post (Not Recommended)
                                                        </Button>
                                                    </li>
                                                </ul>
                                            </div>
                                        )}
                                        {isYouTubeItem(selectedItem) && (
                                            <small className="text-muted fst-italic" style={{fontSize: '0.75rem'}}>
                                                <ShieldAlert size={10} className="me-1"/> 
                                                Safe Mode Active: System auto-copies text. You paste and reply manually.
                                            </small>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                            <Crosshair size={64} className="mb-4 opacity-25 text-info"/>
                            <h4 className="text-info fw-bold">SNIPER NEST ACTIVE</h4>
                            <p className="text-secondary mb-4">Select a target from the Radar list to begin engagement.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
