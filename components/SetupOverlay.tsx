import React, { useState, useEffect, useRef } from 'react';
import { Shield, AlertTriangle, Key, Server, Lock, LogIn, Mail, Cpu, Power, Globe, Copy, Check, Info } from 'lucide-react';
import { initializeFirebase, tryAutoConnect } from '../services/firebase';
import { AuthService } from '../services/authService';
import { Button } from './Button';

interface SetupOverlayProps {
    onComplete: (userProfile?: any) => void;
}

export const SetupOverlay: React.FC<SetupOverlayProps> = ({ onComplete }) => {
  const [isSystemConfigured, setIsSystemConfigured] = useState(false);
  
  // Form State
  const [projectId, setProjectId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Domain Copy State
  const [copied, setCopied] = useState(false);
  const [currentDomain, setCurrentDomain] = useState('');
  const domainInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      // 1. Detect Domain safely after mount
      if (typeof window !== 'undefined') {
          // window.location.host includes port (e.g. localhost:3000) which is more accurate for debugging
          // but for Firebase Auth Domains, usually just hostname is needed.
          // We default to hostname, but allow user to edit.
          setCurrentDomain(window.location.hostname || 'localhost');
      }

      // 2. Check if we have a valid configuration in storage (Async)
      const checkConnection = async () => {
          const connected = await tryAutoConnect();
          setIsSystemConfigured(connected);
      };
      checkConnection();
  }, []);

  const copyText = (text: string) => {
      if (!text) return;

      // 1. Try Standard Clipboard API (Secure Contexts Only)
      if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text)
            .then(() => showSuccess())
            .catch(() => fallbackCopy(text));
      } else {
          // 2. Fallback
          fallbackCopy(text);
      }
  };

  const fallbackCopy = (text: string) => {
      try {
          const textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          textArea.style.top = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) showSuccess();
          else setError("تعذر النسخ التلقائي.");
      } catch (err) {
          console.error('Fallback copy failed', err);
      }
  };

  const showSuccess = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleBootstrap = async () => {
      setError('');
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

          // 2. Initialize Firebase (Async)
          const success = await initializeFirebase({
            apiKey: cleanApiKey,
            projectId: cleanProjectId,
            authDomain: `${cleanProjectId}.firebaseapp.com`,
            storageBucket: `${cleanProjectId}.appspot.com`
          });

          if (!success) throw new Error("فشل تهيئة المكتبة. تأكد من صحة Project ID و API Key.");

          // 3. Create Root Admin
          const profile = await AuthService.register(cleanEmail, cleanPassword);
          
          if (profile) {
              onComplete(profile);
          }

      } catch (err: any) {
          setError(err.message || "فشلت عملية التهيئة.");
          setIsLoading(false);
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
          // Catch domain error specifically during login too
          if (err.message.includes('Authorized Domains')) msg = err.message;
          
          setError(msg);
          setIsLoading(false);
      }
  };

  const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';

  return (
    <div className="fixed inset-0 z-50 bg-[#02040a] flex items-center justify-center p-4" dir="rtl">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="glass-panel max-w-md w-full rounded-2xl p-1 relative overflow-hidden animate-in zoom-in duration-500 shadow-2xl shadow-primary-500/10 z-10">
        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-red-500 via-primary-500 to-primary-600"></div>
        
        <div className="bg-[#0b0f19] p-8 rounded-xl relative overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center border border-white/10 mb-4 shadow-lg group relative">
                    <div className="absolute inset-0 bg-primary-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    {isSystemConfigured ? (
                        <Shield className="w-8 h-8 text-primary-400 relative z-10" />
                    ) : (
                        <Power className="w-8 h-8 text-orange-400 relative z-10 animate-pulse" />
                    )}
                </div>

                <h1 className="text-xl font-black text-white tracking-tight">
                    REDDIT<span className="text-transparent bg-clip-text bg-gradient-to-l from-primary-400 to-violet-500">OPS</span>
                </h1>
                <p className="text-slate-500 text-[10px] font-mono mt-1 tracking-widest uppercase">
                    {isSystemConfigured ? 'بوابة الوصول الآمن' : 'نظام التشغيل الأولي (Bootstrap)'}
                </p>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-bold flex items-start gap-2 animate-in slide-in-from-top-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> 
                    <span className="leading-relaxed">{error}</span>
                </div>
            )}

            {!isSystemConfigured ? (
                /* --- BOOTSTRAP MODE (Config + First Admin) --- */
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    
                    {/* Domain Helper - CRITICAL FIX FOR USER */}
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Globe className="w-3 h-3 text-blue-400" />
                            <span className="text-[10px] font-bold text-blue-300 uppercase">مطلوب: تصريح النطاق (Authorized Domain)</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed mb-2">
                            لتجنب خطأ "Network Request Failed"، انسخ الرابط أدناه وأضفه في: <br/>
                            <span className="text-slate-300 font-mono">Firebase Console {'>'} Authentication {'>'} Settings {'>'} Authorized Domains</span>
                        </p>
                        
                        <div className="flex gap-2">
                            {/* Improved Display: Editable Input */}
                            <input 
                                ref={domainInputRef}
                                type="text"
                                value={currentDomain}
                                onChange={(e) => setCurrentDomain(e.target.value)}
                                className="flex-1 bg-black/30 rounded border border-white/10 p-2 text-[10px] font-mono text-primary-400 outline-none focus:border-primary-500/50"
                                placeholder="example.com"
                            />
                            <button 
                                onClick={() => copyText(currentDomain)}
                                className={`px-3 py-1 rounded border transition-all flex items-center gap-1 min-w-[60px] justify-center ${copied ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'hover:bg-white/10 border-white/10 text-slate-400 hover:text-white'}`}
                                title="نسخ الرابط"
                            >
                                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                        
                        {/* Fallback Suggestion for Localhost */}
                        {isLocalhost && (
                            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                                <span className="text-[9px] text-slate-500 flex items-center gap-1">
                                    <Info className="w-3 h-3" />
                                    <span>جرب أيضاً إضافة IP المحلي:</span>
                                </span>
                                <button 
                                    onClick={() => copyText("127.0.0.1")}
                                    className="text-[9px] font-mono bg-white/5 px-2 py-0.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    127.0.0.1
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Server className="w-3 h-3" /> إعدادات السيرفر
                            </label>
                            <input 
                                value={projectId} 
                                onChange={e => setProjectId(e.target.value)} 
                                className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white text-xs focus:border-primary-500 focus:outline-none font-mono placeholder:text-slate-700" 
                                placeholder="Firebase Project ID" 
                            />
                            <input 
                                value={apiKey} 
                                onChange={e => setApiKey(e.target.value)} 
                                type="password" 
                                className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white text-xs focus:border-primary-500 focus:outline-none font-mono placeholder:text-slate-700" 
                                placeholder="Web API Key" 
                            />
                        </div>

                        <div className="space-y-1 pt-2 border-t border-white/5">
                             <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Shield className="w-3 h-3" /> المسؤول الأول (Root Admin)
                            </label>
                            <input 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                type="email"
                                className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none" 
                                placeholder="البريد الإلكتروني" 
                            />
                            <input 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                type="password" 
                                className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary-500 focus:outline-none" 
                                placeholder="كلمة المرور (6+ أحرف)" 
                            />
                        </div>
                    </div>

                    <Button 
                        variant="primary"
                        onClick={handleBootstrap} 
                        isLoading={isLoading}
                        className="w-full justify-center py-3 font-bold shadow-lg shadow-primary-500/20"
                    >
                        <Power className="w-4 h-4 ml-2" />
                        تهيئة النظام وتشغيل الأدمن
                    </Button>
                </div>
            ) : (
                /* --- LOGIN MODE ONLY --- */
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                    <div className="space-y-3">
                        <div className="relative group">
                            <Mail className="absolute right-3 top-3.5 w-4 h-4 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                            <input 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                type="email"
                                className="w-full bg-slate-900 border border-white/10 rounded-lg py-3 pr-10 pl-3 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all placeholder:text-slate-600" 
                                placeholder="البريد الإلكتروني" 
                            />
                        </div>
                        <div className="relative group">
                            <Lock className="absolute right-3 top-3.5 w-4 h-4 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                            <input 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                type="password" 
                                className="w-full bg-slate-900 border border-white/10 rounded-lg py-3 pr-10 pl-3 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all placeholder:text-slate-600" 
                                placeholder="كلمة المرور" 
                            />
                        </div>
                    </div>

                    <Button 
                        variant="primary"
                        onClick={handleLogin} 
                        isLoading={isLoading}
                        className="w-full justify-center py-3 font-bold shadow-lg shadow-primary-500/20"
                    >
                        <LogIn className="w-4 h-4 ml-2" />
                        الدخول للمنصة
                    </Button>

                    <div className="text-center pt-4">
                        <p className="text-[10px] text-slate-600">
                            التسجيل العام مغلق. يرجى مراجعة مسؤول النظام لإضافة مستخدمين جدد.
                        </p>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};