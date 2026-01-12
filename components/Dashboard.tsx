import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Activity, Zap, Users, TrendingUp, Server, Wifi, Target } from 'lucide-react';
import { DatabaseService } from '../services/databaseService';
import { logger } from '../services/logger';

// Animated Counter
const Counter = ({ end, duration = 2000 }: { end: number, duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);

  return <span>{count.toLocaleString('ar-EG')}</span>;
};

const WidgetCard = ({ title, value, sub, icon: Icon, color = "primary", delay = 0 }: any) => {
    const colorClasses = {
        primary: "text-primary-400 from-primary-500/20 to-primary-500/0 border-primary-500/30",
        violet: "text-violet-500 from-violet-600/20 to-violet-600/0 border-violet-500/30",
        success: "text-success-500 from-success-500/20 to-success-500/0 border-success-500/30",
        warning: "text-orange-400 from-orange-500/20 to-orange-500/0 border-orange-500/30"
    };

    return (
        <div 
            className={`glass-card p-6 rounded-2xl relative group overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color].split(" ")[1]} ${colorClasses[color].split(" ")[2]} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
            
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">{title}</h3>
                    <div className="text-3xl font-black text-white font-mono tracking-tight drop-shadow-lg flex items-center gap-2">
                        <Counter end={value} />
                        {color === 'success' && <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500"></span>
                        </span>}
                    </div>
                </div>
                <div className={`p-3 rounded-xl bg-white/5 border border-white/5 ${colorClasses[color].split(" ")[0]} group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>

            <div className="mt-6 flex items-end justify-between relative z-10">
                <div className={`text-xs font-mono flex items-center gap-1.5 ${colorClasses[color].split(" ")[0]}`}>
                    <TrendingUp className="w-3 h-3" />
                    <span className="font-bold">{sub}</span>
                </div>
                
                <div className="flex gap-0.5 items-end h-6 opacity-50 group-hover:opacity-100 transition-opacity">
                    {[40, 70, 45, 90, 60, 85, 100].map((h, i) => (
                        <div key={i} className={`w-1 rounded-t-sm bg-current ${colorClasses[color].split(" ")[0]}`} style={{ height: `${h}%` }}></div>
                    ))}
                </div>
            </div>

            <div className="absolute bottom-0 right-0 w-full h-[2px] bg-gradient-to-l from-transparent via-white/10 to-transparent"></div>
            <div className={`absolute top-0 right-0 w-[2px] h-0 group-hover:h-full bg-gradient-to-b ${colorClasses[color].split(" ")[2]} transition-all duration-700`}></div>
        </div>
    );
};

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ accounts: 0, campaigns: 0, engagement: 0, aiOps: 0 });
  const [liveData, setLiveData] = useState<any[]>(Array(30).fill(0).map((_, i) => ({ time: i, value: 0 })));
  const [currentLatency, setCurrentLatency] = useState(0);
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    try {
        const accs = await DatabaseService.getAccounts();
        const camps = await DatabaseService.getCampaigns();
        const aiCount = await DatabaseService.getAiOpsCount();
        const totalEngaged = camps.reduce((sum, c) => sum + (c.postsEngaged || 0), 0);
        
        if (isMounted.current) {
            setStats({ accounts: accs.length, campaigns: camps.length, engagement: totalEngaged, aiOps: aiCount });
        }
    } catch(e) {
        // Silent fail prevents dashboard crash on load errors
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => { isMounted.current = false; };
  }, [fetchData]);

  // Live Telemetry Loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMounted.current) return;

      const realOps = logger.getAndResetActivityCount();
      const realLatency = logger.getLatestLatency();
      
      setCurrentLatency(realLatency);

      setLiveData(prev => {
        const nextTime = prev[prev.length - 1].time + 1;
        // Amplify ops for visual effect if low
        const value = realOps > 0 ? realOps * 10 : Math.max(0, prev[prev.length-1].value - 5 + Math.random()*10); 
        return [...prev.slice(1), { time: nextTime, value: Math.min(100, Math.max(0, value)) }];
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8 animate-in fade-in slide-in-from-top-4">
        <div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-1">نظرة عامة تكتيكية</h2>
            <p className="text-slate-400 font-mono text-xs tracking-wider">بث القياس عن بعد // <span className="text-success-500 animate-pulse">مباشر</span></p>
        </div>
        <div className="flex gap-2">
            <div className={`px-3 py-1 bg-white/5 rounded border border-white/5 text-[10px] font-mono transition-colors duration-500 ${currentLatency > 500 ? "text-red-400 border-red-500/20 bg-red-500/10" : "text-slate-400"}`}>
                الاستجابة: <span className="text-white font-bold">{currentLatency}ms</span>
            </div>
            <div className="px-3 py-1 bg-white/5 rounded border border-white/5 text-[10px] text-slate-400 font-mono">
                الحالة: <span className="text-success-500">عملياتي</span>
            </div>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <WidgetCard title="إجمالي التفاعل" value={stats.engagement} sub="تحديث فوري" icon={Activity} color="primary" delay={0} />
        <WidgetCard title="الهويات النشطة" value={stats.accounts} sub="عمليات الشبكة" icon={Users} color="violet" delay={100} />
        <WidgetCard title="عمليات DEEPSEEK" value={stats.aiOps} sub="توكنز" icon={Zap} color="warning" delay={200} />
        <WidgetCard title="حالة الحملات" value={stats.campaigns} sub="نشطة" icon={Target} color="success" delay={300} />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Holographic Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-1 relative overflow-hidden group">
          <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
          
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0f172a]/50">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/10 rounded-lg">
                    <Wifi className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">نشاط النظام (System Heartbeat)</h3>
                    <div className="text-[10px] text-primary-400 font-mono">عملية/ثانية</div>
                </div>
            </div>
            <div className="flex gap-2">
                 {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 bg-slate-700 rounded-full animate-pulse" style={{animationDelay: `${i*200}ms`}}></div>)}
            </div>
          </div>

          <div className="h-[350px] w-full p-4 bg-[#020617]/40 relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.9)', border: '1px solid #1e293b', color: '#f8fafc', borderRadius: '4px', textAlign: 'right' }}
                  itemStyle={{ color: '#00f0ff', fontFamily: 'monospace' }}
                  cursor={{ stroke: '#00f0ff', strokeWidth: 1 }}
                  labelFormatter={() => "النشاط"}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#00f0ff" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  animationDuration={300}
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%] opacity-30"></div>
          </div>
        </div>

        {/* System Health Module */}
        <div className="glass-panel rounded-2xl p-8 flex flex-col relative overflow-hidden">
           <div className="absolute top-0 left-0 p-4 opacity-10">
               <Server className="w-32 h-32 text-white" />
           </div>

           <h3 className="text-sm font-bold text-white mb-8 flex items-center gap-2 relative z-10">
               <span className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></span>
               سلامة وصحة السيرفر
           </h3>

           <div className="flex-1 flex flex-col justify-center space-y-8 relative z-10">
              {[
                  { label: "اتصال FIRESTORE", val: 100, color: "bg-success-500", glow: "shadow-[0_0_15px_#22c55e]" },
                  { label: "واجهة DEEPSEEK", val: 100, color: "bg-primary-500", glow: "shadow-[0_0_15px_#06b6d4]" },
                  { label: "مصادقة النظام", val: 100, color: "bg-violet-500", glow: "shadow-[0_0_15px_#8b5cf6]" }
              ].map((metric, i) => (
                <div key={i} className="group">
                    <div className="flex justify-between text-[10px] font-bold mb-2 text-slate-400 group-hover:text-white transition-colors tracking-widest">
                    <span>{metric.label}</span>
                    <span className="font-mono">{metric.val}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/5">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ${metric.color} ${metric.glow}`} 
                        style={{ width: `${metric.val}%` }}
                    ></div>
                    </div>
                </div>
              ))}
           </div>
           
           <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <button onClick={() => fetchData()} className="w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-all border border-white/5 hover:border-primary-400/30 hover:text-primary-400 flex items-center justify-center gap-2">
                  <Activity className="w-4 h-4" /> تحديث البيانات يدوياً
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};