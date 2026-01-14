
import React, { useState, useEffect } from 'react';
import { Campaign } from '../types';
import { Button } from './Button';
import { deepseekService } from '../services/deepseekService';
import { DatabaseService } from '../services/databaseService';
import { AnalyticsEngine } from '../services/analyticsEngine'; 
import { useToast } from './ToastProvider';
import { Cpu, ChevronLeft, MessageSquare, Plus, Target, Zap, Activity, Save, History, FileText, Sparkles, BarChart2, Search, Bot, Lightbulb, Share2 } from 'lucide-react';

export const CampaignManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'LAB' | 'HISTORY'>('LIST');
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
  const [newKeywords, setNewKeywords] = useState(''); 
  const [isCreating, setIsCreating] = useState(false);

  const fetchCampaigns = async () => {
      try {
        const data = await DatabaseService.getCampaigns();
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
    try {
        const logs = await DatabaseService.getDeploymentHistory(20);
        setHistoryLogs(logs);
    } catch(e) {
        console.error("Failed to fetch history", e);
        addToast('error', 'فشل تحميل السجل.');
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
        keywords: newKeywords.split(',').map(k => k.trim()).filter(k => k), 
        status: 'RUNNING' as const,
        postsEngaged: 0,
        commentsGenerated: 0,
        roi: 0
    };
    
    try {
        await DatabaseService.addCampaign(newCamp);
        addToast('success', 'تم بدء الحملة وتفعيل بوت البحث التلقائي.');
        await fetchCampaigns();
        setIsCreating(false);
        setNewCampName('');
        setNewSubreddit('');
        setNewKeywords('');
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
        const prediction = AnalyticsEngine.predictVirality(result);
        setViralityScore(prediction);
    }

    setGeneratedContent(result);
    setIsGenerating(false);
  };

  const handleDeploy = async () => {
      if(!generatedContent) return;
      setIsDeploying(true);
      try {
          await DatabaseService.deployCampaignContent(campaigns[0]?.id || 'manual_lab', generatedContent, "r/ManualDeploy");
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
          onClick={() => setActiveTab('LAB')}
          className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2 ${activeTab === 'LAB' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
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

      {/* --- LIST TAB (CAMPAIGNS) --- */}
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
                     <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary-400" />
                        تهيئة عملية جديدة (Auto-Targeting)
                     </h3>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">اسم الحملة</label>
                            <input 
                                value={newCampName}
                                onChange={(e) => setNewCampName(e.target.value)}
                                className="w-full bg-[#0b0f19] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all"
                                placeholder="مثال: حملة التوسع للشركات الناشئة"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Subreddits المستهدفة</label>
                            <input 
                                value={newSubreddit}
                                onChange={(e) => setNewSubreddit(e.target.value)}
                                placeholder="r/tech, r/saas, r/entrepreneur"
                                className="w-full bg-[#0b0f19] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all"
                            />
                        </div>
                        
                        {/* Keyword Section for Auto-Bot */}
                        <div className="md:col-span-2 space-y-3 p-4 bg-primary-500/5 rounded-xl border border-primary-500/10">
                             <div className="flex items-center gap-2 mb-2">
                                <Bot className="w-4 h-4 text-primary-400" />
                                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                                    تكوين بوت الصيد (GitHub Actions Hunter-Killer)
                                </label>
                             </div>
                             
                             <input 
                                value={newKeywords}
                                onChange={(e) => setNewKeywords(e.target.value)}
                                placeholder="SaaS, AI Marketing, Startup growth (مفصولة بفواصل)"
                                className="w-full bg-[#0b0f19] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all"
                            />
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                                سيقوم البوت (Server-Side) بالعمل كل 4 ساعات للبحث عن هذه الكلمات في الـ Subreddits المحددة، 
                                وتوليد ردود ذكية باستخدام DeepSeek-V3 ونشرها تلقائياً باستخدام حسابات Reddit المتاحة.
                            </p>
                        </div>
                     </div>

                     <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
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
                    <div key={campaign.id} className="glass-card rounded-2xl p-6 group cursor-pointer hover:-translate-y-1 transition-transform border border-white/5 hover:border-primary-500/30">
                    <div className="flex justify-between items-start mb-6">
                        <div className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wide flex items-center gap-1.5 ${campaign.status === 'RUNNING' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-500/10 text-slate-400'}`}>
                            {campaign.status === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>}
                            {campaign.status}
                        </div>
                        <div className="p-2 rounded-lg bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-primary-500/20 transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </div>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2 group-hover:text-primary-400 transition-colors">{campaign.name}</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {campaign.targetSubreddits.map((sub, i) => (
                        <span key={i} className="text-[10px] text-slate-400 bg-white/5 px-2 py-1 rounded border border-white/5">{sub}</span>
                        ))}
                    </div>
                    
                    {campaign.keywords && campaign.keywords.length > 0 && (
                        <div className="mb-4 pt-4 border-t border-white/5 bg-[#020617]/50 -mx-6 px-6 py-3 mt-auto">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase mb-2 font-bold">
                                <Bot className="w-3 h-3 text-violet-400" />
                                <span>Auto-Hunt Active (GitHub Bot)</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {campaign.keywords.map((kw, i) => (
                                    <span key={i} className="text-[9px] text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20 font-mono">"{kw}"</span>
                                ))}
                            </div>
                        </div>
                    )}
                    
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

      {/* --- AI LAB TAB (MANUAL GENERATION) --- */}
      {activeTab === 'LAB' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
            {/* Input Module */}
            <div className="glass-panel rounded-2xl p-8 border border-white/5">
                <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary-400" />
                    مولد المحتوى الذكي (DeepSeek-V3 Engine)
                </h3>
                
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" />
                            السياق / الموضوع (Prompt Context)
                        </label>
                        <textarea 
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            placeholder="الصق نص المنشور، الرابط، أو الفكرة التي تريد إنشاء رد عليها..."
                            className="w-full h-32 bg-[#0b0f19] border border-white/10 rounded-xl p-4 text-white text-sm focus:border-primary-500 focus:outline-none transition-all placeholder:text-slate-700 resize-none font-mono"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">نبرة الصوت (Tone)</label>
                            <select 
                                value={tone}
                                onChange={(e) => setTone(e.target.value)}
                                className="w-full bg-[#0b0f19] border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none appearance-none"
                            >
                                <option>Professional & Insightful</option>
                                <option>Casual & Friendly</option>
                                <option>Witty & Humorous</option>
                                <option>Direct & Concise</option>
                                <option>Empathetic & Supportive</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">التحسين الذكي</label>
                            <div 
                                onClick={() => setSmartContextEnabled(!smartContextEnabled)}
                                className={`h-[46px] rounded-lg border cursor-pointer flex items-center px-4 transition-all ${smartContextEnabled ? 'bg-primary-500/10 border-primary-500/30' : 'bg-white/5 border-white/10'}`}
                            >
                                <div className="flex items-center gap-3 w-full">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${smartContextEnabled ? 'border-primary-400 bg-primary-400' : 'border-slate-500'}`}>
                                        {smartContextEnabled && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                    </div>
                                    <span className={`text-sm font-medium ${smartContextEnabled ? 'text-primary-300' : 'text-slate-500'}`}>
                                        Context Injection
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Button 
                        onClick={handleGenerate} 
                        isLoading={isGenerating} 
                        className="w-full py-4 shadow-lg shadow-primary-500/10"
                    >
                        <Zap className="w-4 h-4 ml-2 fill-current" />
                        توليد المحتوى
                    </Button>
                </div>
            </div>

            {/* Output Module */}
            <div className="glass-panel rounded-2xl p-8 border border-white/5 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 p-6 opacity-5 pointer-events-none">
                    <FileText className="w-64 h-64" />
                </div>
                
                <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2 relative z-10">
                    <Activity className="w-5 h-5 text-violet-400" />
                    المخرجات والتحليل (Output & Analysis)
                </h3>

                {generatedContent ? (
                    <div className="flex-1 flex flex-col relative z-10 animate-in fade-in slide-in-from-right-4">
                        <div className="bg-[#020617] rounded-xl border border-white/10 p-6 mb-6 flex-1 shadow-inner relative group">
                            <p className="text-slate-200 leading-relaxed text-sm whitespace-pre-wrap font-mono">
                                {generatedContent}
                            </p>
                            <button 
                                onClick={() => navigator.clipboard.writeText(generatedContent)}
                                className="absolute top-4 left-4 p-2 bg-white/5 rounded-lg text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                title="نسخ النص"
                            >
                                <Share2 className="w-4 h-4" />
                            </button>
                        </div>

                        {viralityScore && (
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">نقاط الانتشار (Virality)</div>
                                    <div className={`text-2xl font-black ${viralityScore.color}`}>
                                        {viralityScore.score}/100
                                    </div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">التصنيف</div>
                                    <div className={`text-lg font-bold ${viralityScore.color} flex items-center gap-2`}>
                                        <BarChart2 className="w-4 h-4" />
                                        {viralityScore.rating}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setGeneratedContent('')} className="flex-1">
                                تجاهل
                            </Button>
                            <Button onClick={handleDeploy} isLoading={isDeploying} className="flex-[2] bg-gradient-to-r from-violet-600 to-violet-500 border-violet-400/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                                <Save className="w-4 h-4 ml-2" />
                                اعتماد ونشر للأرشيف
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-white/5 rounded-xl bg-white/5 relative z-10">
                        <Lightbulb className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm">المساحة جاهزة لاستقبال المخرجات...</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- HISTORY TAB --- */}
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
                                <span>{log.deployedAt?.seconds ? new Date(log.deployedAt.seconds * 1000).toLocaleString('ar-EG') : 'الآن'}</span>
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
    </div>
  );
};
