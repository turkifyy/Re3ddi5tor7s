
import React, { useState, useEffect } from 'react';
import { RedditComment, RedditCredential, ScrapedLead } from '../types';
import { RedditService } from '../services/redditService';
import { DatabaseService } from '../services/databaseService';
import { deepseekService } from '../services/deepseekService';
import { credentialManager } from '../services/credentialManager';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { MessageCircle, RefreshCw, Send, User, ExternalLink, Mail, Target, Zap } from 'lucide-react';

declare const window: any;

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

    // Init Select when accounts are loaded or selected item changes
    useEffect(() => {
        if (window.M) {
            setTimeout(() => {
                const elems = document.querySelectorAll('select');
                window.M.FormSelect.init(elems);
                window.M.updateTextFields();
            }, 100);
        }
    }, [linkedAccounts, selectedItem]);

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
        finally { 
            setIsAiGenerating(false); 
            if(window.M) window.M.updateTextFields(); 
        }
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
        <div className="section" style={{height: '80vh', display: 'flex', flexDirection: 'column'}}>
            <div className="row" style={{flex: 1, overflow: 'hidden'}}>
                {/* LEFT SIDEBAR LIST */}
                <div className="col s12 m4 l3 blue-grey darken-4 z-depth-2" style={{height: '100%', overflowY: 'auto', padding: 0, borderRight: '1px solid #37474f'}}>
                    <div className="row mb-0 blue-grey darken-3 p-2 sticky-top" style={{position: 'sticky', top: 0, zIndex: 10, margin: 0, padding: '10px'}}>
                         <div className="col s6">
                             <Button size="sm" variant={activeTab === 'LEADS' ? 'primary' : 'ghost'} onClick={() => handleTabChange('LEADS')} className="width-100">
                                 <Target size={14}/> Leads
                             </Button>
                         </div>
                         <div className="col s6">
                             <Button size="sm" variant={activeTab === 'INBOX' ? 'primary' : 'ghost'} onClick={() => handleTabChange('INBOX')} className="width-100">
                                 <Mail size={14}/> Inbox
                             </Button>
                         </div>
                    </div>

                    <ul className="collection" style={{border: 'none', margin: 0}}>
                        {activeTab === 'LEADS' && leads.map(lead => (
                            <li key={lead.id} 
                                className={`collection-item avatar blue-grey darken-4 white-text ${selectedItem?.id === lead.id ? 'active blue-grey darken-2' : ''}`}
                                onClick={() => setSelectedItem(lead)}
                                style={{cursor: 'pointer', borderBottom: '1px solid #37474f'}}
                            >
                                <span className="circle cyan darken-3">{lead.subreddit[0].toUpperCase()}</span>
                                <span className="title font-bold truncate block">{lead.subreddit}</span>
                                <p className="grey-text text-lighten-1 truncate">{lead.content}</p>
                                <span className="secondary-content orange-text" style={{fontSize: '0.7rem'}}>
                                    {lead.matchedKeyword}
                                </span>
                            </li>
                        ))}
                         {activeTab === 'INBOX' && comments.map(comment => (
                            <li key={comment.id} 
                                className={`collection-item avatar blue-grey darken-4 white-text ${selectedItem?.id === comment.id ? 'active blue-grey darken-2' : ''}`}
                                onClick={() => setSelectedItem(comment)}
                                style={{cursor: 'pointer', borderBottom: '1px solid #37474f'}}
                            >
                                <span className="circle purple darken-3"><User size={16} style={{marginTop: '10px'}}/></span>
                                <span className="title font-bold truncate block">{comment.author}</span>
                                <p className="grey-text text-lighten-1 truncate">{comment.body}</p>
                                {comment.isReplied && <span className="secondary-content green-text"><i className="material-icons">check</i></span>}
                            </li>
                        ))}
                        {((activeTab === 'LEADS' && leads.length === 0) || (activeTab === 'INBOX' && comments.length === 0)) && (
                            <li className="collection-item blue-grey darken-4 white-text center-align p-4">
                                <small className="grey-text">No Items</small>
                            </li>
                        )}
                    </ul>
                </div>

                {/* RIGHT DETAIL VIEW */}
                <div className="col s12 m8 l9 blue-grey darken-3" style={{height: '100%', overflowY: 'auto', position: 'relative'}}>
                    {selectedItem ? (
                        <div className="p-4" style={{padding: '24px'}}>
                            <div className="card-panel blue-grey darken-4 border-light">
                                <div className="flex-between mb-2">
                                    <span className="chip blue-grey white-text">r/{selectedItem.subreddit}</span>
                                    <a href={`https://reddit.com${selectedItem.permalink}`} target="_blank" className="cyan-text flex-center"><ExternalLink size={14}/> Open</a>
                                </div>
                                <h6 className="white-text" style={{lineHeight: '1.6'}}>
                                    "{'body' in selectedItem ? selectedItem.body : selectedItem.content}"
                                </h6>
                                <p className="grey-text right-align mt-2">- u/{selectedItem.author}</p>
                            </div>

                            <div className="card blue-grey darken-2">
                                <div className="card-content">
                                    <div className="row mb-0">
                                        <div className="input-field col s12 m6">
                                            <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                                                <option value="" disabled>Choose Account</option>
                                                {linkedAccounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>u/{acc.username}</option>
                                                ))}
                                            </select>
                                            <label>Reply As</label>
                                        </div>
                                        <div className="col s12 m6 right-align mt-4">
                                            <Button variant="ghost" size="sm" onClick={handleGenerateAiReply} isLoading={isAiGenerating}>
                                                <Zap size={14}/> Generate AI Reply
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="input-field mt-4">
                                        <textarea id="replyArea" className="materialize-textarea white-text" value={replyText} onChange={e => setReplyText(e.target.value)}></textarea>
                                        <label htmlFor="replyArea">Write your reply...</label>
                                    </div>
                                </div>
                                <div className="card-action right-align blue-grey darken-3">
                                    <Button onClick={handleSendReply} isLoading={isSending} disabled={!replyText}>
                                        <Send size={16} style={{marginRight: '5px'}}/> Send Reply
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="valign-wrapper center-align" style={{height: '100%', flexDirection: 'column', justifyContent: 'center'}}>
                            <MessageCircle size={64} className="grey-text text-darken-2"/>
                            <h5 className="grey-text text-darken-1">Select an item to respond</h5>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
