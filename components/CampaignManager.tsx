
import React, { useState, useEffect } from 'react';
import { Campaign } from '../types';
import { Button } from './Button';
import { deepseekService } from '../services/deepseekService';
import { DatabaseService } from '../services/databaseService';
import { AnalyticsEngine } from '../services/analyticsEngine'; // Import Algo Engine
import { useToast } from './ToastProvider';
import { Cpu, ChevronLeft, MessageSquare, Plus, Target, Zap, Activity, Save, History, FileText, Sparkles, BarChart2 } from 'lucide-react';
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from '../services/firebase';

export const CampaignManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE' | 'HISTORY'>('LIST');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const { addToast } = useToast();
  
  // AI Generation State
  const [targetUrl, setTargetUrl] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [tone, setTone] = useState('Professional & Insightful');
  const [smartContextEnabled, setSmartContextEnabled] = useState(true);

  // Prediction State
  const [viralityScore, setViralityScore] = useState<{score: number, rating: string, color: string} | null>(null);

  // New Campaign State
  const [newCampName, setNewCampName] = useState('');
  const [newSubreddit, setNewSubreddit] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchCampaigns = async () => {
      try {
        const data = await DatabaseService.getCampaigns();
        // Calculate dynamic ROI on fetch using Algorithm
        const processed = data.map(c => ({
            ...c,
            roi: AnalyticsEngine.calculateCampaignROI(c.postsEngaged, c.commentsGenerated)
        }));
        setCampaigns(processed);
      } catch (e) {
        addToast('error', 'فشل تحميل الحملات.');
      }
  };

  const fetchHistory = async () => {
    if (!isFirebaseConfigured()) return;
    try {
        const db = getDb();
        if(!db) return;
        const q = query(collection(db, 'generated_content'), orderBy('deployedAt', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistoryLogs(logs);
    } catch(e) {
        console.error("Failed to fetch history", e);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
        fetchHistory();
    }
  }, [activeTab]);

  const handleCreateCampaign = async () => {
    if(!newCampName) {
        addToast('error', 'اسم الحملة مطلوب.');
        return;
    }
    const newCamp = {
        name: newCampName,
        targetSubreddits: newSubreddit.split(',').map(s => s.trim()).filter(s => s),
        status: 'RUNNING' as const,
        postsEngaged: 0,
        commentsGenerated: 0,
        roi: 0
    };
    
    try {
        await DatabaseService.addCampaign(newCamp);
        addToast('success', 'تم بدء الحملة بنجاح.');
        await fetchCampaigns();
        setIsCreating(false);
        setNewCampName('');
        setNewSubreddit('');
    } catch (e) {
        addToast('error', 'فشل إنشاء الحملة.');
    }
  };

  const handleGenerate = async () => {
    if (!targetUrl) {
        addToast('info', 'يرجى تقديم سياق للعملية.');
        return;
    }
    setIsGenerating(true);
    setViralityScore(null);
    
    // ALGORITHM: Smart Prompt Injection
    let finalPrompt = targetUrl;
    if (smartContextEnabled) {
        finalPrompt = AnalyticsEngine.enhancePromptContext(targetUrl, tone);
        addToast('info', 'تم تحسين السياق: تم حقن معلمات الوقت والنوايا.');
    } else {
        finalPrompt = `Context: ${targetUrl}`;
    }

    const result = await deepseekService.generateComment(finalPrompt, tone);
    
    if (result.startsWith("Error") || result.startsWith("System Error")) {
        addToast('error', 'فشل التوليد عبر DeepSeek. راجع السجلات.');
    } else {
        addToast('success', 'اكتمل التوليد عبر DeepSeek.');
        // ALGORITHM: Virality Prediction
        const prediction = AnalyticsEngine.predictVirality(result);
        setViralityScore(prediction);
    }

    setGeneratedContent(result);
    setIsGenerating(false);

    // Update Stats in Background
    if (campaigns.length > 0 && !result.startsWith("Error")) {
        const targetCampaign = campaigns[0];
        try {
            await DatabaseService.updateCampaignStats(targetCampaign.id, 1, 1);
            fetchCampaigns(); 
        } catch(e) {}
    }
  };

  const handleDeploy = async () => {
      if(!generatedContent) return;
      setIsDeploying(true);
      try {
          await DatabaseService.deployCampaignContent(campaigns[0]?.id, generatedContent, "r/general");
          addToast('success', 'تم النشر: تمت كتابة المحتوى في قاعدة بيانات الإنتاج.');
          setGeneratedContent('');
          setViralityScore(null);
      } catch (e) {
          addToast('error', 'فشل النشر: تعذر الكتابة في قاعدة البيانات.');
      } finally {
          setIsDeploying(false);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl w-fit backdrop-blur-sm border border-white/5">
        <button 
          onClick={() => setActiveTab('LIST')}
          className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${activeTab === 'LIST' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          الأهداف النشطة
        </button>
        <button 
          onClick={() => setActiveTab('CREATE')}
          className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2 ${activeTab === 'CREATE' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <Cpu className="w-4 h-4" />
          مختبر الذكاء الاصطناعي
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')}
          className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <History className="w-4 h-4" />
          سجل النشر
        </button>
      </div>

      {activeTab === 'LIST' && (
        <>
            {!isCreating && (
                <div className="flex justify-end">
                    <Button size="md" onClick={() => setIsCreating(true)}>
                        <Plus className="w-4 h-4 ml-2" /> إطلاق حملة جديدة
                    </Button>
                </div>
            )}

            {isCreating && (
                <div className="glass-panel rounded-2xl p-8 mb-8 border-primary-500/30 animate-in slide-in-from-top-4">
                     <h3 className="text-white font-bold text-lg mb-6">تهيئة عملية جديدة</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">اسم الحملة</label>
                            <input 
                                value={newCampName}
                                onChange={(e) => setNewCampName(e.target.value)}
                                className="w-full bg-[#0b0f19] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Subreddits المستهدفة</label>
                            <input 
                                value={newSubreddit}
                                onChange={(e) => setNewSubreddit(e.target.value)}
                                placeholder="r/tech, r/saas"
                                className="w-full bg-[#0b0f19] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all"
                            />
                        </div>
                     </div>
                     <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsCreating(false)}>إلغاء</Button>
                        <Button onClick={handleCreateCampaign}>تنفيذ الإطلاق</Button>
                     </div>
                </div>
            )}

            {campaigns.length === 0 && !isCreating ? (
                 <div className="text-center py-32 border border-white/5 border-dashed rounded-2xl bg-white/5 backdrop-blur-sm">
                    <Target className="w-16 h-16 text-slate-700 mx-auto mb-6 opacity-50" />
                    <h3 className="text-slate-300 font-bold text-lg">لا توجد عمليات نشطة</h3>
                    <p className="text-slate-500 text-sm mt-2">ابدأ حملة جديدة (تُحفظ في Firestore) للبدء.</p>
                 </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map((campaign) => (
                    <div key={campaign.id} className="glass-card rounded-2xl p-6 group cursor-pointer hover:-translate-y-1 transition-transform">
                    <div className="flex justify-between items-start mb-6">
                        <div className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wide bg-green-500/10 text-green-400 border border-green-500/20`}>
                        {campaign.status}
                        </div>
                        <div className="p-2 rounded-lg bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-primary-500/20 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                        </div>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2 group-hover:text-primary-400 transition-colors">{campaign.name}</h3>
                    <div className="flex flex-wrap gap-2 mb-6">
                        {campaign.targetSubreddits.map((sub, i) => (
                        <span key={i} className="text-[10px] text-slate-400 bg-white/5 px-2 py-1 rounded border border-white/5">{sub}</span>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs pt-4 border-t border-white/5">
                        <div className="space-y-1">
                            <div className="text-slate-500 text-[10px] uppercase">التفاعل</div>
                            <div className="text-white font-mono text-sm">{campaign.postsEngaged}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-slate-500 text-[10px] uppercase">تم التوليد</div>
                            <div className="text-white font-mono text-sm">{campaign.commentsGenerated}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-slate-500 text-[10px] uppercase">العائد (ROI)</div>
                            <div className={`font-mono text-sm ${campaign.roi > 100 ? 'text-success-500' : 'text-slate-300'}`}>{campaign.roi}%</div>
                        </div>
                    </div>
                    </div>
                ))}
                </div>
            )}
        </>
      )}

      {activeTab === 'HISTORY' && (
        <div className="glass-panel rounded-2xl p-8 animate-in slide-in-from-top-4">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <History className="w-5 h-5 text-primary-400" />
                    سجل النشر (الإنتاج)
                </h3>
                <Button size="sm" variant="secondary" onClick={fetchHistory}>تحديث السجل</Button>
             </div>
             
             {historyLogs.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>لا يوجد محتوى منشور حتى الآن.</p>
                </div>
             ) : (
                <div className="space-y-4">
                    {historyLogs.map((log) => (
                        <div key={log.id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary-500/30 transition-colors">
                            <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono">
                                <span>{new Date(log.deployedAt?.seconds * 1000).toLocaleString('ar-EG')}</span>
                                <span className="text-green-400 font-bold">{log.status}</span>
                            </div>
                            <div className="text-white text-sm leading-relaxed p-3 bg-[#020617] rounded-lg border border-white/5 shadow-inner">
                                {log.content}
                            </div>
                            <div className="mt-2 text-xs text-primary-400/70 font-mono">
                                الوجهة: {log.subreddit} | المعرف: {log.id}
                            </div>
                        </div>
                    ))}
                </div>
             )}
        </div>
      )}

      {activeTab === 'CREATE' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-8 h-full">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-primary-500/10 rounded-lg">
                    <Zap className="w-5 h-5 text-primary-400" />
                </div>
                إعدادات DeepSeek المعرفية
              </h3>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">السياق / نص المنشور</label>
                  <textarea 
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="الصق محتوى Reddit أو السياق هنا..." 
                    className="w-full bg-[#0b0f19] border border-white/10 rounded-xl p-4 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none min-h-[160px] resize-none transition-all placeholder:text-slate-600"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">نمط النبرة</label>
                  <div className="relative">
                    <select 
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="w-full bg-[#0b0f19] border border-white/10 rounded-xl p-4 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none appearance-none transition-all"
                    >
                        <option>احترافي وعميق (Professional & Insightful)</option>
                        <option>عفوي وذكي (Casual & Witty)</option>
                        <option>متعاطف وداعم (Empathetic & Supportive)</option>
                        <option>تحليلي ومخالف (Contrarian & Analytical)</option>
                        <option>ساخر (Meme-Centric)</option>
                    </select>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <Activity className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* ALGORITHM CONTROL TOGGLE */}
                <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setSmartContextEnabled(!smartContextEnabled)}>
                    <div className="flex items-center gap-3">
                        <Sparkles className={`w-5 h-5 ${smartContextEnabled ? 'text-violet-400' : 'text-slate-500'}`} />
                        <div>
                            <div className="text-sm font-bold text-white">Smart Context Injection</div>
                            <div className="text-[10px] text-slate-400">تحليل الوقت والنوايا (Time & Intent Analysis)</div>
                        </div>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${smartContextEnabled ? 'bg-violet-600' : 'bg-slate-700'}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${smartContextEnabled ? 'left-1' : 'left-6'}`}></div>
                    </div>
                </div>

                <div className="pt-2">
                  <Button onClick={handleGenerate} isLoading={isGenerating} className="w-full h-12 text-base shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                     <Cpu className="w-5 h-5 ml-2" />
                     تهيئة DeepSeek-V3
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-8 h-full min-h-[500px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="p-2 bg-violet-500/10 rounded-lg">
                        <MessageSquare className="w-5 h-5 text-violet-400" />
                    </div>
                    وحدة المخرجات
                </h3>
                {viralityScore && (
                    <div className="px-3 py-1 rounded-full bg-slate-900 border border-white/10 flex items-center gap-2 animate-in fade-in zoom-in">
                        <BarChart2 className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] text-slate-400">احتمالية الانتشار:</span>
                        <span className={`text-xs font-bold font-mono ${viralityScore.color}`}>{viralityScore.score}/100</span>
                    </div>
                )}
            </div>

            <div className="flex-1 bg-[#0b0f19]/80 backdrop-blur-sm rounded-xl p-6 font-mono text-sm text-slate-300 border border-white/10 overflow-y-auto relative z-10 shadow-inner">
              {generatedContent ? (
                <div className="animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 text-[10px] text-blue-400 mb-4 font-bold tracking-wider opacity-70">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                    DEEPSEEK-CHAT // تدفق البيانات
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap text-right" dir="auto">{generatedContent}</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                   <Cpu className="w-12 h-12 mb-4 animate-pulse duration-[3000ms]" />
                  <span className="text-xs tracking-widest uppercase">بانتظار مدخلات DeepSeek...</span>
                </div>
              )}
            </div>
            {generatedContent && (
               <div className="mt-6 flex gap-4 relative z-10">
                 <Button variant="secondary" size="md" className="flex-1" onClick={() => setGeneratedContent('')}>تجاهل</Button>
                 <Button variant="primary" size="md" className="flex-1" onClick={handleDeploy} isLoading={isDeploying}>
                    <Save className="w-4 h-4 ml-2" />
                    نشر للإنتاج
                 </Button>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
