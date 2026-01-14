
import React from 'react';
import { BookOpen, Key, Link, ShieldCheck, Cpu, Database, AlertTriangle, FileText } from 'lucide-react';

export const Documentation: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center border border-primary-500/20">
            <BookOpen className="w-8 h-8 text-primary-400" />
        </div>
        <div>
            <h2 className="text-3xl font-black text-white tracking-tight">توثيق النظام (Documentation)</h2>
            <p className="text-slate-400 text-sm mt-1 font-mono">الدليل الشامل لإدارة منصة RedditOps Platinum V4.5</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
          
          {/* Section 1: Setup */}
          <div className="glass-panel rounded-2xl p-8 border border-white/5">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-success-500" />
                  1. التهيئة الأولية (Initial Setup)
              </h3>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                  <p>
                      يعتمد النظام على Firebase كمزود سحابي (Serverless). للبدء، يجب عليك الحصول على 
                      <span className="font-mono text-primary-400 mx-1">Project ID</span> و 
                      <span className="font-mono text-primary-400 mx-1">API Key</span>.
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-slate-400">
                      <li>انتقل إلى Firebase Console وأنشئ مشروعاً جديداً.</li>
                      <li>قم بتفعيل <strong>Authentication</strong> (البريد الإلكتروني/كلمة المرور).</li>
                      <li>أنشئ قاعدة بيانات <strong>Firestore</strong> في وضع الاختبار (Test Mode).</li>
                      <li>انسخ بيانات الإعداد وأدخلها في شاشة التمهيد (Boot Screen) للنظام.</li>
                  </ul>
              </div>
          </div>

          {/* Section 2: Account Linking */}
          <div className="glass-panel rounded-2xl p-8 border border-white/5">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Link className="w-5 h-5 text-violet-400" />
                  2. ربط حسابات Reddit (Account Linking & OAuth)
              </h3>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                  <p>
                      لكي يتمكن النظام من الرد والمشاركة، يجب ربط حسابات Reddit باستخدام <strong>OAuth Credentials</strong>.
                      يدعم النظام نمط "Script App" المخصص للبوتات.
                  </p>
                  
                  <div className="bg-[#0b0f19] p-4 rounded-xl border border-white/10 font-mono text-xs">
                      <h4 className="font-bold text-white mb-2">خطوات الحصول على المفاتيح:</h4>
                      <ol className="list-decimal list-inside space-y-1 text-slate-400">
                          <li>سجل الدخول بحساب Reddit المراد ربطه.</li>
                          <li>انتقل إلى <a href="https://www.reddit.com/prefs/apps" target="_blank" className="text-blue-400 underline">reddit.com/prefs/apps</a>.</li>
                          <li>أنشئ تطبيقاً جديداً من نوع <strong>Script</strong>.</li>
                          <li>انسخ الـ <strong>Client ID</strong> (أسفل الاسم) والـ <strong>Client Secret</strong>.</li>
                      </ol>
                  </div>

                  <p>
                      بعد الحصول على المفاتيح، انتقل إلى <span className="text-white font-bold">الإعدادات</span> -> <span className="text-white font-bold">Reddit Account Linking</span> وأضف البيانات.
                      سيقوم "مدير الاعتماد" (Credential Manager) بتخزينها وتدويرها تلقائياً لتجنب الحظر.
                  </p>
              </div>
          </div>

          {/* Section 3: Monitoring */}
          <div className="glass-panel rounded-2xl p-8 border border-white/5">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  3. المراقبة والحدود (System Monitoring)
              </h3>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                  <p>
                      يوفر النظام لوحة مراقبة حية في <strong>Dashboard</strong> تعرض حالة اتصال Reddit API.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                       <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                           <div className="font-bold text-white mb-1">Rate Limit (الحدود)</div>
                           <div className="text-xs text-slate-400">يسمح Reddit بـ 600 طلب كل 10 دقائق. النظام يراقب رأس `x-ratelimit-remaining` ويوقف العمليات تلقائياً عند الاقتراب من الصفر.</div>
                       </div>
                       <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                           <div className="font-bold text-white mb-1">Latency (الكمون)</div>
                           <div className="text-xs text-slate-400">يتم قياس سرعة استجابة الخوادم بالميلي ثانية. ارتفاع الرقم فوق 1000ms قد يشير إلى ضغط على الشبكة.</div>
                       </div>
                  </div>
              </div>
          </div>

          {/* Section 4: AI */}
          <div className="glass-panel rounded-2xl p-8 border border-white/5">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary-400" />
                  4. الذكاء الاصطناعي (DeepSeek Integration)
              </h3>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                  <p>
                      يستخدم النظام نموذج <strong>DeepSeek-V3</strong> لتوليد الردود وتحليل المشاعر.
                      تأكد من إضافة مفتاح API الخاص بـ DeepSeek في الإعدادات.
                  </p>
                  <p>
                      يمكنك تفعيل <strong>Smart Context Injection</strong> في "مختبر الذكاء الاصطناعي" لتحسين جودة الردود بناءً على الوقت ونوايا المستخدم.
                  </p>
              </div>
          </div>
      </div>
    </div>
  );
};
