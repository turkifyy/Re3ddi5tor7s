import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Key, Server, Lock, LogIn, Mail, Power, Eye, EyeOff, RefreshCw, Cpu, CheckCircle2, Activity } from 'lucide-react';
import { initializeFirebase, tryAutoConnect } from '../services/firebase';
import { AuthService } from '../services/authService';
import { Button } from './Button';

interface SetupOverlayProps {
    onComplete: (userProfile?: any) => void;
}

export const SetupOverlay: React.FC<SetupOverlayProps> = ({ onComplete }) => {
  // System State
  const [isSystemConfigured, setIsSystemConfigured] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  
  // Form State
  const [projectId, setProjectId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // UI State
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
      // Simulate System Boot Sequence & Check Config
      const bootSystem = async () => {
          setTimeout(async () => {
              const connected = await tryAutoConnect();
              setIsSystemConfigured(connected);
              setIsBooting(false);
          }, 1500); // Cinematic boot delay
      };
      bootSystem();
  }, []);

  const handleBootstrap = async () => {
      setError('');
      setStatusMsg('');
      setIsLoading(true);

      try {
          // Clean inputs
          const cleanProjectId = projectId.trim();
          const cleanApiKey = apiKey.trim();
          const cleanEmail = email.trim();
          const cleanPassword = password;

          // 1. Validate Inputs
          if (!cleanProjectId || !cleanApiKey || !cleanEmail || !cleanPassword) {
              throw new Error("جميع الحقول مطلوبة لتهيئة النظام.");
          }
          if (cleanPassword.length < 6) throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
          if (cleanProjectId.includes(' ')) throw new Error("معرف المشروع (Project ID) لا يمكن أن يحتوي على مسافات.");

          setStatusMsg('جاري تهيئة الاتصال بالسيرفر...');

          // 2. Initialize Firebase (Async)
          const success = await initializeFirebase({
            apiKey: cleanApiKey,
            projectId: cleanProjectId,
            authDomain: `${cleanProjectId}.firebaseapp.com`,
            storageBucket: `${cleanProjectId}.appspot.com`
          });

          if (!success) throw new Error("فشل الاتصال: تأكد من صحة Project ID و API Key.");

          setStatusMsg('جاري إنشاء حساب المسؤول الأول (Root Admin)...');

          // 3. Create Root Admin (This validates if the Project ID actually exists on the network)
          const profile = await AuthService.register(cleanEmail, cleanPassword);
          
          if (profile) {
              onComplete(profile);
          }

      } catch (err: any) {
          let msg = err.message || "فشلت عملية التهيئة.";
          
          // Smart Error Translation
          if (msg.includes('auth/invalid-api-key')) msg = "مفتاح API غير صحيح. يرجى التحقق من Firebase Console.";
          if (msg.includes('auth/network-request-failed')) msg = "خطأ في الشبكة. تحقق من الاتصال أو إعدادات CORS.";
          if (msg.includes('auth/project-not-found')) msg = "معرف المشروع (Project ID) غير موجود. تأكد من نسخه بدقة.";
          
          setError(msg);
          setIsLoading(false);
          setStatusMsg('');
      }
  };

  const handleLogin = async () => {
      setError('');
      setIsLoading(true);

      try {
          if (!email || !password) throw new Error("يرجى إدخال البيانات.");
          
          const profile = await AuthService.login(email.trim(), password);
          if (profile) {
              onComplete(profile);
          }
      } catch (err: any) {
          let msg = "فشل الدخول.";
          if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') msg = "بيانات الاعتماد غير صحيحة.";
          if (err.message.includes('Authorized Domains') || err.message.includes('unauthorized-domain')) {
              msg = `النطاق غير مصرح به: انتقل إلى Authentication -> Settings -> Authorized Domains في Firebase وأضف هذا النطاق.`;
          }
          
          setError(msg);
          setIsLoading(false);
      }
  };

  const handleHardReset = () => {
      if(confirm("تحذير: هذا الإجراء سيقوم بمسح إعدادات الاتصال المحلية وإعادتك لوضع التهيئة. هل أنت متأكد؟")) {
          localStorage.removeItem('redditops_fb_config');
          window.location.reload();
      }
  };

  // --- RENDER: BOOT SCREEN ---
  if (isBooting) {
      return (
        <div className="fixed inset-0 z-50 bg-[#02040a] flex flex-col items-center justify-center p-4" dir="rtl">
            <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 border-t-2 border-primary-500 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-r-2 border-violet-500 rounded-full animate-spin duration-1000 direction-reverse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Cpu className="w-8 h-8 text-white animate-pulse" />
                </div>
            </div>
            <h2 className="text-xl font-black text-white tracking-widest uppercase mb-2">
                REDDIT<span className="text-primary-500">OPS</span> OS
            </h2>
            <div className="text-[10px] font-mono text-slate-500 flex flex-col items-center gap-1">
                <span>جاري تحميل الوحدات الأساسية...</span>
                <span className="text-primary-500/50">V4.5 KERNEL INITIALIZED</span>
            </div>
        </div>
      );
  }

  // --- RENDER: MAIN INTERFACE ---
  return (
    <div className="fixed inset-0 z-50 bg-[#02040a] flex items-center justify-center p-4" dir="rtl">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
      </div>

      <div className="glass-panel max-w-md w-full rounded-2xl p-1 relative overflow-hidden animate-in zoom-in duration-500 shadow-2xl shadow-primary-500/10 z-10 border border-white/10">
        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-red-500 via-primary-500 to-primary-600"></div>
        
        <div className="bg-[#0b0f19]/95 backdrop-blur-xl p-8 rounded-xl relative overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center border border-white/10 mb-4 shadow-lg group relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    {isSystemConfigured ? (
                        <Shield className="w-8 h-8 text-primary-400 relative z-10" />
                    ) : (
                        <Power className="w-8 h-8 text-orange-400 relative z-10 animate-pulse" />
                    )}
                </div>

                <h1 className="text-2xl font-black text-white tracking-tight">
                    REDDIT<span className="text-transparent bg-clip-text bg-gradient-to-l from-primary-400 to-violet-500">OPS</span>
                </h1>
                <p className="text-slate-500 text-[10px] font-mono mt-1 tracking-[0.2em] uppercase flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isSystemConfigured ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`}></span>
                    {isSystemConfigured ? 'بوابة الوصول الآمن' : 'نظام التهيئة الأولي'}
                </p>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-xs flex items-start gap-3 animate-in slide-in-from-top-2 shadow-inner">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" /> 
                    <span className="leading-relaxed mt-0.5 select-text">{error}</span>
                </div>
            )}
            
            {/* Status Loading Display */}
            {isLoading && !error && (
                <div className="mb-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-lg text-primary-200 text-xs flex items-center gap-3 animate-pulse">
                    <Activity className="w-4 h-4 shrink-0 animate-spin" />
                    <span>{statusMsg || 'جاري المعالجة...'}</span>
                </div>
            )}

            {!isSystemConfigured ? (
                /* --- BOOTSTRAP MODE (Config + First Admin) --- */
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    
                    <div className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-1">
                                <Server className="w-3 h-3 text-primary-400" /> إعدادات السيرفر (Firebase)
                            </label>
                            
                            <div className="group relative">
                                <input 
                                    value={projectId} 
                                    onChange={e => setProjectId(e.target.value)} 
                                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 pl-10 text-white text-xs focus:border-primary-500 focus:outline-none font-mono placeholder:text-slate-700 transition-all focus:shadow-[0_0_15px_rgba(6,182,212,0.1)]" 
                                    placeholder="Project ID (e.g., my-project-123)" 
                                />
                                <div className="absolute left-3 top-3 text-slate-600">
                                    <Cpu className="w-4 h-4" />
                                </div>
                            </div>

                            <div className="group relative">
                                <input 
                                    value={apiKey} 
                                    onChange={e => setApiKey(e.target.value)} 
                                    type={showApiKey ? "text" : "password"} 
                                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 pl-10 text-white text-xs focus:border-primary-500 focus:outline-none font-mono placeholder:text-slate-700 transition-all focus:shadow-[0_0_15px_rgba(6,182,212,0.1)]" 
                                    placeholder="Web API Key" 
                                />
                                <div className="absolute left-3 top-3 text-slate-600">
                                    <Key className="w-4 h-4" />
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-3 top-3 text-slate-600 hover:text-white transition-colors"
                                >
                                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-white/5">
                             <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-1">
                                <Shield className="w-3 h-3 text-violet-400" /> تسجيل المسؤول (Root Admin)
                            </label>
                            
                            <div className="group relative">
                                <input 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    type="email"
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 pl-10 text-white text-sm focus:border-primary-500 focus:outline-none transition-all" 
                                    placeholder="البريد الإلكتروني الرسمي" 
                                />
                                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-600" />
                            </div>

                            <div className="group relative">
                                <input 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    type={showPassword ? "text" : "password"} 
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 pl-10 text-white text-sm focus:border-primary-500 focus:outline-none transition-all" 
                                    placeholder="كلمة المرور (6+ أحرف)" 
                                />
                                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-600" />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3.5 text-slate-600 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <Button 
                        variant="primary"
                        onClick={handleBootstrap} 
                        isLoading={isLoading}
                        className="w-full justify-center py-3.5 font-bold shadow-lg shadow-primary-500/20 text-sm mt-2"
                    >
                        <Power className="w-4 h-4 ml-2" />
                        تهيئة النظام وتشغيل الأدمن
                    </Button>
                    
                    <div className="text-center">
                        <p className="text-[9px] text-slate-600 font-mono">
                           * يتم حفظ بيانات الاتصال مشفرة محلياً في المتصفح.
                        </p>
                    </div>
                </div>
            ) : (
                /* --- LOGIN MODE ONLY --- */
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-success-500/5 border border-success-500/20 rounded-lg p-3 flex items-center gap-2 mb-2">
                         <CheckCircle2 className="w-4 h-4 text-success-500" />
                         <span className="text-[10px] text-success-200">النظام مهيأ ومتصل بالسحابة.</span>
                    </div>

                    <div className="space-y-3">
                        <div className="relative group">
                            <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                            <input 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                type="email"
                                className="w-full bg-slate-900 border border-white/10 rounded-lg py-3 pl-10 pr-3 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all placeholder:text-slate-600" 
                                placeholder="البريد الإلكتروني" 
                            />
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                            <input 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                type={showPassword ? "text" : "password"} 
                                className="w-full bg-slate-900 border border-white/10 rounded-lg py-3 pl-10 pr-10 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all placeholder:text-slate-600" 
                                placeholder="كلمة المرور" 
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3.5 text-slate-600 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Button 
                            variant="primary"
                            onClick={handleLogin} 
                            isLoading={isLoading}
                            className="w-full justify-center py-3 font-bold shadow-lg shadow-primary-500/20"
                        >
                            <LogIn className="w-4 h-4 ml-2" />
                            الدخول للمنصة
                        </Button>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-white/10"></div>
                            <span className="flex-shrink-0 mx-4 text-[9px] text-slate-600 font-mono">خيارات الصيانة</span>
                            <div className="flex-grow border-t border-white/10"></div>
                        </div>

                        <button 
                            onClick={handleHardReset}
                            className="w-full py-2 text-[10px] text-slate-500 hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/20 rounded transition-all flex items-center justify-center gap-2 font-mono"
                        >
                            <RefreshCw className="w-3 h-3" />
                            إعادة تعيين التكوين (Reset Config)
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};