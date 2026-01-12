
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { Settings, Shield, Server, Wifi, Database, Activity, AlertTriangle, RefreshCw, Eye, Key, Save, Lock, MessageCircle, User, Plus, Trash2, Cpu, CheckCircle2, Zap } from 'lucide-react';
import { isFirebaseConfigured, initializeFirebase } from '../services/firebase';
import { setDeepSeekKey, getDeepSeekKey } from '../services/deepseekService';
import { credentialManager } from '../services/credentialManager';
import { RedditService } from '../services/redditService';
import { RedditCredential } from '../types';

interface SettingsManagerProps {
    onLogout: () => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({ onLogout }) => {
  const { addToast } = useToast();
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const isConnected = isFirebaseConfigured();
  
  // Keys State
  const [dsKey, setDsKey] = useState('');
  
  // Reddit Credential Pool State
  const [credPool, setCredPool] = useState<RedditCredential[]>([]);
  const [newClient, setNewClient] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [isAddingCred, setIsAddingCred] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Firebase Config State (Loaded from localStorage)
  const [fbProjectId, setFbProjectId] = useState('');
  const [fbApiKey, setFbApiKey] = useState('');

  const loadCredentials = () => {
      setCredPool([...credentialManager.getPool()]);
  };

  useEffect(() => {
      // Load DeepSeek Key
      setDsKey(getDeepSeekKey());

      // Load Credential Pool
      loadCredentials();

      // Load Firebase Config
      const storedConfig = localStorage.getItem('redditops_fb_config');
      if (storedConfig) {
          try {
              const conf = JSON.parse(storedConfig);
              setFbProjectId(conf.projectId || '');
              setFbApiKey(conf.apiKey || '');
          } catch(e) {}
      }
  }, []);

  const handleSaveAiKey = () => {
      setDeepSeekKey(dsKey);
      addToast('success', 'تم تحديث مفتاح DeepSeek وحفظه.');
  };

  const handleAddCredential = () => {
      if (!newClient || !newSecret || !newUser || !newPass) {
          addToast('error', 'جميع الحقول مطلوبة لإضافة مفتاح API.');
          return;
      }
      credentialManager.addCredential({
          clientId: newClient.trim(),
          clientSecret: newSecret.trim(),
          username: newUser.trim(),
          password: newPass.trim()
      });
      addToast('success', 'تمت إضافة المفتاح إلى مجمع التدوير (Rotation Pool).');
      setNewClient('');
      setNewSecret('');
      setNewUser('');
      setNewPass('');
      setIsAddingCred(false);
      loadCredentials();
  };

  const handleRemoveCredential = (id: string) => {
      if(confirm('هل أنت متأكد من إزالة هذا المفتاح من المجمع؟')) {
          credentialManager.removeCredential(id);
          loadCredentials();
          addToast('info', 'تمت إزالة المفتاح.');
      }
  };

  const handleTestKey = async (id: string) => {
      setTestingId(id);
      addToast('info', 'جاري فحص الاتصال بـ Reddit API...');
      
      const success = await RedditService.verifyCredential(id);
      
      if (success) {
          addToast('success', 'اتصال ناجح! هذا المفتاح يعمل بشكل صحيح.');
          credentialManager.markSuccess(id);
      } else {
          addToast('error', 'فشل الاتصال: بيانات الاعتماد غير صحيحة أو محظورة.');
          credentialManager.markRateLimited(id); // Effectively disable it
      }
      
      loadCredentials();
      setTestingId(null);
  };

  const handleSaveFirebaseConfig = async () => {
      if (!fbProjectId || !fbApiKey) {
          addToast('error', 'بيانات السيرفر ناقصة.');
          return;
      }
      
      const confirmUpdate = confirm("تحذير: تغيير إعدادات السيرفر سيؤدي إلى إعادة تهيئة الاتصال. هل أنت متأكد؟");
      if (!confirmUpdate) return;

      const success = await initializeFirebase({
          apiKey: fbApiKey.trim(),
          projectId: fbProjectId.trim(),
          authDomain: `${fbProjectId.trim()}.firebaseapp.com`,
          storageBucket: `${fbProjectId.trim()}.appspot.com`
      });

      if (success) {
          addToast('success', 'تم تحديث إعدادات Firebase وإعادة الاتصال.');
          setTimeout(() => window.location.reload(), 1500); // Reload to ensure clean state
      } else {
          addToast('error', 'فشل الاتصال بالإعدادات الجديدة.');
      }
  };

  const toggleAnimations = () => {
      setAnimationsEnabled(!animationsEnabled);
      if (animationsEnabled) {
          document.body.style.setProperty('--animate-duration', '0s');
          addToast('info', 'تم تعطيل التأثيرات الحركية.');
      } else {
          document.body.style.removeProperty('--animate-duration');
          addToast('success', 'تم تفعيل التأثيرات الحركية.');
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-slate-900/50 rounded-2xl flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
            <Settings className="w-8 h-8 text-primary-400 animate-[spin_10s_linear_infinite]" />
        </div>
        <div>
            <h2 className="text-3xl font-black text-white tracking-tight">إعدادات النظام</h2>
            <p className="text-slate-400 text-sm mt-1 font-mono">التحكم في التكوين / إدارة الاتصال / بروتوكولات الصيانة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Connection Status Module */}
        <div className="glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-bl-full pointer-events-none"></div>
            <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                <Wifi className="w-5 h-5 text-green-400" />
                حالة الربط الشبكي
            </h3>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 rounded-lg border border-white/10">
                            <Database className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">قاعدة البيانات</div>
                            <div className="text-sm font-mono text-white">Google Firestore</div>
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${isConnected ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {isConnected ? 'متصل' : 'منقطع'}
                    </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 rounded-lg border border-white/10">
                            <Cpu className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">خوادم API Reddit</div>
                            <div className="text-sm font-mono text-white">Load Balancing ({credPool.length} Nodes)</div>
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${credPool.some(c => c.status === 'READY') ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                        {credPool.some(c => c.status === 'READY') ? 'نشط' : 'متوقف'}
                    </div>
                </div>
            </div>
        </div>

        {/* Server Configuration */}
        <div className="glass-panel rounded-2xl p-8 border border-white/5">
            <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                <Server className="w-5 h-5 text-slate-200" />
                إعدادات الربط السحابي (Cloud Uplink)
            </h3>
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Firebase Project ID</label>
                    <input 
                        value={fbProjectId}
                        onChange={(e) => setFbProjectId(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none font-mono"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Web API Key</label>
                    <div className="flex gap-2">
                         <input 
                            type="password"
                            value={fbApiKey}
                            onChange={(e) => setFbApiKey(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none font-mono"
                        />
                    </div>
                </div>
                <Button onClick={handleSaveFirebaseConfig} variant="secondary" className="w-full mt-2">
                    <RefreshCw className="w-4 h-4 ml-2" />
                    تحديث الاتصال وإعادة التشغيل
                </Button>
            </div>
        </div>

        {/* Advanced Reddit Key Pool Manager */}
        <div className="glass-panel rounded-2xl p-8 border border-white/5 lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-orange-400" />
                        نظام تدوير المفاتيح (Smart API Key Rotation)
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">
                        إدارة مجمع المفاتيح (Quota Pool) لتفادي الحظر. يقوم النظام بالتبديل تلقائياً عند استنفاد الرصيد المجاني.
                    </p>
                </div>
                <Button size="sm" onClick={() => setIsAddingCred(!isAddingCred)} variant={isAddingCred ? 'secondary' : 'primary'}>
                    {isAddingCred ? 'إلغاء' : 'إضافة مفتاح جديد'}
                </Button>
            </div>

            {/* Add Credential Form */}
            {isAddingCred && (
                <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-6 mb-6 animate-in slide-in-from-top-4">
                    <h4 className="text-orange-200 font-bold text-sm mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> بيانات التطبيق الجديد
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Client ID</label>
                            <input value={newClient} onChange={e => setNewClient(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded p-2 text-white text-xs font-mono" placeholder="Ex: kX9_..." />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Client Secret</label>
                            <input type="password" value={newSecret} onChange={e => setNewSecret(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded p-2 text-white text-xs font-mono" placeholder="Secret Key" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Reddit Username</label>
                            <input value={newUser} onChange={e => setNewUser(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded p-2 text-white text-xs font-mono" placeholder="u/BotName" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Password</label>
                            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded p-2 text-white text-xs font-mono" placeholder="Account Password" />
                        </div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <Button size="sm" onClick={handleAddCredential}>حفظ وإدراج في الشبكة</Button>
                    </div>
                </div>
            )}

            {/* Credentials List (The Rack) */}
            <div className="space-y-3">
                {credPool.length === 0 ? (
                    <div className="text-center py-12 border border-white/5 border-dashed rounded-xl">
                        <MessageCircle className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">مجمع المفاتيح فارغ. أضف مفتاحاً واحداً على الأقل للعمل.</p>
                    </div>
                ) : (
                    credPool.map((cred, idx) => (
                        <div key={cred.id} className="flex flex-col md:flex-row items-center justify-between p-4 bg-[#0b0f19] border border-white/5 rounded-xl hover:border-white/10 transition-colors group">
                             <div className="flex items-center gap-4 w-full md:w-auto mb-3 md:mb-0">
                                <div className={`w-2 h-12 rounded-full ${
                                    cred.status === 'READY' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 
                                    cred.status === 'RATE_LIMITED' ? 'bg-orange-500 shadow-[0_0_10px_#f97316]' : 'bg-red-500'
                                }`}></div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-bold text-sm">Node #{idx + 1}</span>
                                        <span className="text-xs text-slate-500 font-mono bg-white/5 px-1.5 rounded">{cred.username}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1 font-mono">
                                        <span>ID: {cred.clientId.substring(0,6)}...</span>
                                        <span className="text-slate-600">|</span>
                                        <span>Used: {cred.usageCount} times</span>
                                        {cred.status === 'RATE_LIMITED' && (
                                            <span className="text-orange-400 animate-pulse">
                                                [COOLDOWN: {Math.ceil((cred.cooldownUntil - Date.now()) / 60000)}m]
                                            </span>
                                        )}
                                    </div>
                                </div>
                             </div>
                             
                             <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                <button
                                    onClick={() => handleTestKey(cred.id)}
                                    disabled={testingId === cred.id}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Zap className={`w-3 h-3 ${testingId === cred.id ? 'text-yellow-400 animate-pulse' : 'text-slate-500'}`} />
                                    {testingId === cred.id ? 'جاري الفحص...' : 'فحص الاتصال'}
                                </button>
                                <div className="text-right mr-4 hidden md:block">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Status</div>
                                    <div className={`text-xs font-bold ${cred.status === 'READY' ? 'text-green-400' : 'text-orange-400'}`}>{cred.status}</div>
                                </div>
                                <button 
                                    onClick={() => handleRemoveCredential(cred.id)}
                                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                        </div>
                    ))
                )}
            </div>
            {credPool.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span>Active Nodes: {credPool.filter(c => c.status === 'READY').length} / {credPool.length}</span>
                    <span className="flex items-center gap-1 text-primary-500"><CheckCircle2 className="w-3 h-3" /> Auto-Rotation Active</span>
                </div>
            )}
        </div>

        {/* AI Configuration */}
        <div className="glass-panel rounded-2xl p-8 border border-primary-500/20">
            <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                <Key className="w-5 h-5 text-primary-400" />
                مفاتيح الذكاء الاصطناعي (AI Core)
            </h3>
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">DeepSeek API Key</label>
                    <div className="flex gap-2">
                        <input 
                            type="password"
                            value={dsKey}
                            onChange={(e) => setDsKey(e.target.value)}
                            className="flex-1 bg-slate-900 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none font-mono"
                            placeholder="sk-..."
                        />
                        <Button onClick={handleSaveAiKey} size="sm">
                            <Save className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        {/* Interface Preferences */}
        <div className="glass-panel rounded-2xl p-8">
            <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary-400" />
                تفضيلات الواجهة
            </h3>
            <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-slate-500" />
                        <span className="text-sm text-slate-300">التأثيرات الحركية (Animations)</span>
                    </div>
                    <button 
                        onClick={toggleAnimations}
                        className={`w-12 h-6 rounded-full transition-colors relative ${animationsEnabled ? 'bg-primary-600' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${animationsEnabled ? 'left-1' : 'left-7'}`}></div>
                    </button>
                 </div>
            </div>
        </div>

        {/* Danger Zone */}
        <div className="glass-panel rounded-2xl p-8 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)] relative overflow-hidden lg:col-span-2">
             <div className="absolute inset-0 bg-red-500/5 pointer-events-none"></div>
             <h3 className="text-red-400 font-bold text-lg mb-6 flex items-center gap-2 relative z-10">
                <AlertTriangle className="w-5 h-5" />
                منطقة الخطر
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed relative z-10">
                سيؤدي تسجيل الخروج إلى إنهاء الجلسة الحالية. ستبقى إعدادات الاتصال محفوظة في المتصفح للدخول السريع لاحقاً.
            </p>
            <div className="relative z-10">
                <Button variant="danger" className="w-full justify-center" onClick={onLogout}>
                    <Shield className="w-4 h-4 ml-2" />
                    تسجيل الخروج (Logout)
                </Button>
            </div>
        </div>

      </div>

      <div className="text-center pt-8 border-t border-white/5">
        <p className="text-[10px] font-mono text-slate-600">
            RedditOps Platinum V4.5 // Build 2024.10.15 // Enterprise License
        </p>
      </div>

    </div>
  );
};
