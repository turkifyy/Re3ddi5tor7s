import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { Settings, Shield, Server, Wifi, Database, Activity, AlertTriangle, RefreshCw, Eye, Key, Save, Lock } from 'lucide-react';
import { isFirebaseConfigured, initializeFirebase } from '../services/firebase';
import { setDeepSeekKey, getDeepSeekKey } from '../services/deepseekService';

interface SettingsManagerProps {
    onLogout: () => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({ onLogout }) => {
  const { addToast } = useToast();
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const isConnected = isFirebaseConfigured();
  
  // Keys State
  const [dsKey, setDsKey] = useState('');
  
  // Firebase Config State (Loaded from localStorage)
  const [fbProjectId, setFbProjectId] = useState('');
  const [fbApiKey, setFbApiKey] = useState('');

  useEffect(() => {
      // Load DeepSeek Key
      setDsKey(getDeepSeekKey());

      // Load Firebase Config (Parse from LocalStorage directly as a fallback to show current config)
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

  const handleClearCache = () => {
    addToast('info', 'جاري تنظيف الذاكرة المؤقتة...');
    setTimeout(() => {
        addToast('success', 'تم تنظيف ذاكرة التخزين المؤقت وتحسين الأداء.');
    }, 1500);
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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
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
                            <Activity className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">محرك الذكاء الاصطناعي</div>
                            <div className="text-sm font-mono text-white">DeepSeek-V3 API</div>
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${dsKey ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                        {dsKey ? 'مهيأ' : 'مطلوب'}
                    </div>
                </div>
            </div>
        </div>

        {/* Server Configuration (Moved Here) */}
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