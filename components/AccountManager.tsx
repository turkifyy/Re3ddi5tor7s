
import React, { useEffect, useState } from 'react';
import { RedditAccount, AccountStatus } from '../types';
import { Button } from './Button';
import { DatabaseService } from '../services/databaseService';
import { deepseekService } from '../services/deepseekService';
import { AnalyticsEngine } from '../services/analyticsEngine'; // Import Algorithm Engine
import { useToast } from './ToastProvider';
import { Shield, RefreshCw, Trash2, Plus, Loader2, Brain, X, MessageSquare, Activity, Wifi } from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebase';

export const AccountManager: React.FC = () => {
  const [accounts, setAccounts] = useState<RedditAccount[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();
  
  // Connection State (Initialized from config check)
  const [isConnected, setIsConnected] = useState(isFirebaseConfigured());

  const [newUsername, setNewUsername] = useState('');
  const [newProxy, setNewProxy] = useState('');

  // Sentiment Analysis Modal State
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const data = await DatabaseService.getAccounts();
      
      // ALGORITHM APPLICATION: Recalculate Health Scores dynamically
      const processedData = data.map(acc => ({
          ...acc,
          healthScore: AnalyticsEngine.calculateAccountHealth(acc)
      }));

      setAccounts(processedData);
      setIsConnected(true); // Uplink confirmed
    } catch (err) {
      addToast('error', 'فشل المزامنة مع قاعدة البيانات السحابية.');
      setIsConnected(false); // Uplink lost
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddAccount = async () => {
    if (!newUsername) return;
    
    // Initial heuristic for new account
    const initialHealth = 100; // New accounts start fresh

    const newAccountPayload = {
      username: newUsername.startsWith('u/') ? newUsername : `u/${newUsername}`,
      proxyIp: newProxy || 'مباشر',
      status: AccountStatus.ACTIVE,
      karma: 0,
      accountAgeDays: 0,
      lastActive: 'الآن',
      healthScore: initialHealth
    };

    try {
      setIsLoading(true);
      await DatabaseService.addAccount(newAccountPayload);
      addToast('success', 'تم تسجيل الهوية بنجاح.');
      await fetchAccounts();
      setIsAdding(false);
      setNewUsername('');
      setNewProxy('');
    } catch (err) {
      addToast('error', 'فشل الكتابة في قاعدة البيانات.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm('هل أنت متأكد من إنهاء هذه الهوية؟')) return;
    try {
      await DatabaseService.deleteAccount(id);
      addToast('info', 'تم إنهاء الهوية وإزالتها من الشبكة.');
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      addToast('error', 'فشل الحذف من قاعدة البيانات.');
    }
  };

  const openAnalysisModal = (id: string) => {
    setAnalysisId(id);
    setAnalysisText('');
  };

  const closeAnalysisModal = () => {
    setAnalysisId(null);
    setAnalysisText('');
    setIsAnalyzing(false);
  };

  const executeAnalysis = async () => {
    if (!analysisId || !analysisText) return;
    setIsAnalyzing(true);

    addToast('info', 'تم إنشاء الاتصال: جاري معالجة المشاعر عبر DeepSeek-V3...');
    try {
        const result = await deepseekService.analyzeSentiment(analysisText);
        
        if (result.label === 'Error') {
             addToast('error', 'فشلت المعالجة: خطأ في اتصال DeepSeek API.');
             setIsAnalyzing(false);
             return;
        }

        await DatabaseService.updateAccountSentiment(analysisId, result);
        addToast('success', `اكتمل التحليل: تم رصد شعور ${result.label}.`);
        await fetchAccounts(); // This will trigger health recalculation via Algorithm
        closeAnalysisModal();
    } catch (e) {
        addToast('error', 'خطأ قاعدة البيانات: فشل تسجيل القياس.');
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      
      {/* --- SENTIMENT ANALYSIS MODAL --- */}
      {analysisId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl shadow-primary-500/10 border-primary-500/30">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary-400" />
                    فحص المشاعر العصبي (AI Sentiment)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-mono">أدخل العينة النصية للتحليل عبر DeepSeek API</p>
                </div>
                <button onClick={closeAnalysisModal} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" /> نص التعليق / المنشور
                    </label>
                    <textarea 
                        value={analysisText}
                        onChange={(e) => setAnalysisText(e.target.value)}
                        placeholder="أدخل نص التعليق هنا ليقوم الذكاء الاصطناعي بتقييم نبرته..."
                        className="w-full h-32 bg-[#0b0f19] border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none transition-all placeholder:text-slate-700 resize-none"
                        autoFocus
                    />
                </div>
                
                <div className="flex gap-3 justify-end pt-2">
                    <Button variant="secondary" onClick={closeAnalysisModal} disabled={isAnalyzing}>إلغاء</Button>
                    <Button onClick={executeAnalysis} isLoading={isAnalyzing}>
                        {isAnalyzing ? 'جاري المعالجة...' : 'تشغيل التحليل'}
                    </Button>
                </div>
              </div>
           </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 rounded-lg border border-primary-500/20">
              <Shield className="w-6 h-6 text-primary-400" />
            </div>
            مصفوفة الحسابات
          </h2>
          <p className="text-slate-400 text-sm mt-2 ml-1">
            {accounts.length > 0 
              ? `إدارة ${accounts.length} هوية نشطة. الخوارزمية تعمل في وضع: Heuristic Analysis.`
              : 'جاري المزامنة مع Firebase...'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          
          {/* Connection Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-500 ${isConnected ? 'bg-green-500/5 border-green-500/20 text-green-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
              <span className="text-[10px] font-mono font-bold tracking-wider">{isConnected ? 'LIVE UPLINK' : 'OFFLINE'}</span>
          </div>

          <Button variant="secondary" size="sm" onClick={fetchAccounts} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
            مزامنة الشبكة
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsAdding(!isAdding)}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة عقدة
          </Button>
        </div>
      </div>

      {isAdding && (
        <div className="glass-panel rounded-2xl p-8 animate-in slide-in-from-top-4 border-primary-500/30">
          <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary-400 rounded-full"></span>
            تسجيل هوية جديدة (سحابي)
          </h3>
          <div className="flex gap-6 items-end">
            <div className="flex-1 space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">اسم المستخدم</label>
              <input 
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="u/username"
                className="w-full bg-[#0b0f19] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all"
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">البروكسي (اختياري)</label>
              <input 
                 value={newProxy}
                 onChange={(e) => setNewProxy(e.target.value)}
                 placeholder="192.168.x.x"
                 className="w-full bg-[#0b0f19] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all"
              />
            </div>
            <div className="pb-0.5">
                <Button onClick={handleAddAccount} disabled={isLoading} size="md">
                {isLoading ? 'جاري التسجيل...' : 'تهيئة العقدة'}
                </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-500 glass-panel rounded-2xl">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500 mb-6" />
          <p className="text-sm font-mono tracking-widest">جاري الاتصال بـ FIRESTORE + تشغيل الخوارزميات...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-32 border border-white/5 border-dashed rounded-2xl bg-white/5 backdrop-blur-sm">
          <Shield className="w-16 h-16 text-slate-700 mx-auto mb-6 opacity-50" />
          <h3 className="text-slate-300 font-bold text-lg">السجل فارغ</h3>
          <p className="text-slate-500 text-sm mt-2">قم بتهيئة أول حساب Reddit لبدء العمليات.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <table className="w-full text-right text-sm text-slate-400">
            <thead className="bg-white/5 text-slate-300 uppercase font-mono text-xs tracking-wider border-b border-white/10">
              <tr>
                <th className="px-8 py-5 font-semibold">الهوية</th>
                <th className="px-8 py-5 font-semibold">حالة الشبكة</th>
                <th className="px-8 py-5 font-semibold">النقاط (Karma)</th>
                <th className="px-8 py-5 font-semibold">المشاعر الأخيرة</th>
                <th className="px-8 py-5 font-semibold">سلامة الحساب (Calc)</th>
                <th className="px-8 py-5 text-left font-semibold">التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-5 font-medium text-white font-mono group-hover:text-primary-400 transition-colors" dir="ltr">
                    {acc.username}
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border 
                        ${acc.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                          acc.status === 'FLAGGED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${acc.status === 'ACTIVE' ? 'bg-green-400 animate-pulse' : 'bg-current'}`}></span>
                        {acc.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-slate-300 font-mono">
                    {acc.karma.toLocaleString('ar-EG')}
                  </td>
                  <td className="px-8 py-5">
                    {acc.sentiment ? (
                        <div className="flex flex-col gap-1.5 w-32">
                            <div className="flex justify-between text-[10px] font-mono font-bold tracking-tight">
                                <span className={
                                    acc.sentiment.label === 'Positive' ? 'text-success-500' :
                                    acc.sentiment.label === 'Negative' ? 'text-red-400' : 'text-slate-400'
                                }>{acc.sentiment.label}</span>
                                <span className="text-slate-500">{acc.sentiment.score > 0 ? '+' : ''}{acc.sentiment.score.toFixed(2)}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800/50 rounded-full relative overflow-hidden border border-white/5">
                                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-600/50 z-10"></div>
                                <div 
                                    className={`absolute top-0 bottom-0 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                                        acc.sentiment.score >= 0 
                                        ? 'bg-success-500 right-1/2 shadow-[0_0_8px_rgba(34,197,94,0.4)]' 
                                        : 'bg-red-500 left-1/2 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                                    }`}
                                    style={{
                                        width: `${Math.abs(acc.sentiment.score) * 50}%`,
                                        right: acc.sentiment.score >= 0 ? '50%' : 'auto',
                                        left: acc.sentiment.score < 0 ? '50%' : 'auto'
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-[10px] text-slate-600 font-mono tracking-wider flex items-center gap-1">
                            <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                            لا توجد بيانات
                        </div>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    {/* Updated Health Bar using calculated score */}
                    <div className="flex items-center gap-3" title="محسوب بناءً على الكارما، الحالة، والمشاعر">
                      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                              acc.healthScore > 75 ? 'bg-gradient-to-r from-green-500 to-emerald-400 shadow-[0_0_10px_#22c55e]' :
                              acc.healthScore > 40 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                              'bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_10px_#ef4444]'
                          }`} 
                          style={{ width: `${acc.healthScore}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${acc.healthScore > 75 ? 'text-white' : 'text-slate-400'}`}>{acc.healthScore}%</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-left">
                    <div className="flex items-center justify-end gap-2">
                        <button 
                            onClick={() => openAnalysisModal(acc.id)}
                            className="text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 p-2 rounded-lg transition-all group relative"
                            title="فحص المشاعر بالذكاء الاصطناعي"
                        >
                            <Brain className="w-4 h-4" />
                        </button>
                        <button 
                        onClick={() => handleDelete(acc.id)}
                        className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                        >
                        <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
