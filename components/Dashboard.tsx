
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Activity, Zap, Users, TrendingUp, Server, Wifi, Target, Cpu, GitBranch, ShieldCheck, Clock, Power, AlertTriangle, BarChart3, Radio, Search, Layers } from 'lucide-react';
import { DatabaseService } from '../services/databaseService';
import { logger } from '../services/logger';
import { roboticsEngine } from '../services/roboticsEngine';
import { cronService } from '../services/cronService';
import { RedditService } from '../services/redditService';
import { BotAgent, RoboticsState, RedditSystemHealth, ViewState } from '../types';
import { isFirebaseConfigured } from '../services/firebase'; 
import { getDeepSeekKey } from '../services/deepseekService'; 

interface DashboardProps {
    onNavigate?: (view: ViewState) => void;
}

// Standard Counter without easing for immediate feedback in prod
const Counter = ({ end }: { end: number }) => {
  return <span>{end.toLocaleString('en-US')}</span>;
};

const WidgetCard = ({ title, value, sub, icon: Icon, color = "primary", onClick }: any) => {
    const colorClasses = {
        primary: "text-primary-400 from-primary-500/20 to-primary-500/0 border-primary-500/30",
        violet: "text-violet-500 from-violet-600/20 to-violet-600/0 border-violet-500/30",
        success: "text-success-500 from-success-500/20 to-success-500/0 border-success-500/30",
        warning: "text-orange-400 from-orange-500/20 to-orange-500/0 border-orange-500/30"
    };

    return (
        <div 
            onClick={onClick}
            className={`glass-card p-6 rounded-2xl relative group overflow-hidden cursor-pointer hover:shadow-2xl transition-all hover:-translate-y-1`}
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
            </div>
            <div className="absolute bottom-0 right-0 w-full h-[2px] bg-gradient-to-l from-transparent via-white/10 to-transparent"></div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState({ accounts: 0, leads: 0, engagement: 0, aiOps: 0 });
  const [liveData, setLiveData] = useState<any[]>(Array(30).fill(0).map((_, i) => ({ time: i, value: 0 })));
  const [currentLatency, setCurrentLatency] = useState(0);
  const [serviceHealth, setServiceHealth] = useState({ firebase: 0, deepseek: 0, auth: 0 });
  const [agents, setAgents] = useState<BotAgent[]>([]);
  const [roboState, setRoboState] = useState<RoboticsState | null>(null);
  const [redditHealth, setRedditHealth] = useState<RedditSystemHealth>({ globalRateLimit: 600, averageLatency: 0, errorRate: 0, activeNodes: 0, lastSync: 0 });
  const [isMasterNode, setIsMasterNode] = useState(false);

  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    try {
        const accs = await DatabaseService.getAccounts();
        const leadsCount = await DatabaseService.getLeadsCount();
        const aiCount = await DatabaseService.getAiOpsCount();
        const camps = await DatabaseService.getCampaigns();
        const totalEngaged = camps.reduce((sum, c) => sum + (c.postsEngaged || 0), 0);
        
        if (isMounted.current) {
            setStats({ accounts: accs.length, leads: leadsCount, engagement: totalEngaged, aiOps: aiCount });
            setServiceHealth({
                firebase: isFirebaseConfigured() ? 100 : 0,
                deepseek: getDeepSeekKey() && getDeepSeekKey().length > 10 ? 100 : 0,
                auth: 100
            });
        }
    } catch(e) {
        if (isMounted.current) setServiceHealth(prev => ({ ...prev, firebase: 50 }));
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => { isMounted.current = false; };
  }, [fetchData]);

  useEffect(() => {
    let tickCount = 0;
    const interval = setInterval(() => {
      if (!isMounted.current) return;
      tickCount++;

      // 1. Get REAL ops count
      const realOps = logger.getAndResetActivityCount();
      
      const realLatency = logger.getLatestLatency();
      setCurrentLatency(realLatency);
      setAgents([...roboticsEngine.getAgents()]);
      setRoboState({...roboticsEngine.getState()});
      setRedditHealth(RedditService.getSystemHealth());
      
      setIsMasterNode(cronService.isMasterNode());

      setLiveData(prev => {
        const nextTime = prev[prev.length - 1].time + 1;
        // PRODUCTION CHANGE: Strict 1:1 mapping. No smoothing.
        // If 0 ops happened, graph shows 0.
        return [...prev.slice(1), { time: nextTime, value: realOps }];
      });

      if (tickCount % 5 === 0) fetchData();
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 animate-in fade-in slide-in-from-top-4 gap-4">
        <div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-1">مركز القيادة المباشر (V6.0)</h2>
            <p className="text-slate-400 font-mono text-xs tracking-wider">بث حي // <span className="text-success-500 animate-pulse font-bold">LIVE PRODUCTION</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
            <div className={`px-3 py-1 bg-white/5 rounded border border-white/5 text-[10px] font-mono transition-colors duration-500 flex items-center gap-2 ${isMasterNode ? "text-primary-400 border-primary-500/20 bg-primary-500/10" : "text-slate-500"}`}>
                <Layers className="w-3 h-3" />
                Cluster Role: <span className="font-bold">{isMasterNode ? "MASTER NODE" : "REPLICA NODE"}</span>
            </div>

            <div className={`px-3 py-1 bg-white/5 rounded border border-white/5 text-[10px] font-mono transition-colors duration-500 ${currentLatency > 1000 ? "text-red-400 border-red-500/20 bg-red-500/10" : "text-slate-400"}`}>
                الاستجابة: <span className="text-white font-bold">{Math.round(currentLatency)}ms</span>
            </div>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <WidgetCard title="الفرص المكتشفة" value={stats.leads} sub="نتائج الزحف (Scraped)" icon={Search} color="success" onClick={() => onNavigate?.('SCRAPER')} />
        <WidgetCard title="الهويات النشطة" value={stats.accounts} sub="عمليات الشبكة" icon={Users} color="violet" onClick={() => onNavigate?.('ACCOUNTS')} />
        <WidgetCard title="عمليات DEEPSEEK" value={stats.aiOps} sub="توكنز" icon={Zap} color="warning" onClick={() => onNavigate?.('CAMPAIGNS')} />
        <WidgetCard title="إجمالي التفاعل" value={stats.engagement} sub="ردود منشورة" icon={Target} color="primary" onClick={() => onNavigate?.('CAMPAIGNS')} />
      </div>

      {/* Reddit Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3 glass-panel rounded-2xl p-8 border border-white/5 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5"><BarChart3 className="w-32 h-32" /></div>
             <div className="flex justify-between items-center mb-8 relative z-10">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <Radio className="w-5 h-5 text-orange-400" /> مراقبة نظام Reddit (System Monitoring)
                </h3>
                {redditHealth.errorRate > 10 && (
                    <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-bold animate-pulse flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> اضطراب في الشبكة</div>
                )}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-2">حدود API (Rate Limit)</div>
                    <div className="flex items-end gap-2"><span className={`text-2xl font-mono font-black ${redditHealth.globalRateLimit < 100 ? 'text-red-400' : 'text-white'}`}>{redditHealth.globalRateLimit}</span><span className="text-[10px] text-slate-500 mb-1">/ 600 req</span></div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${redditHealth.globalRateLimit < 100 ? 'bg-red-500' : 'bg-success-500'}`} style={{ width: `${(redditHealth.globalRateLimit / 600) * 100}%` }}></div></div>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-2">متوسط الكمون (Latency)</div>
                    <div className="flex items-end gap-2"><span className={`text-2xl font-mono font-black ${redditHealth.averageLatency > 1500 ? 'text-red-400' : redditHealth.averageLatency > 800 ? 'text-orange-400' : 'text-white'}`}>{Math.round(redditHealth.averageLatency)}</span><span className="text-[10px] text-slate-500 mb-1">ms</span></div>
                    <div className="text-[10px] text-slate-500 mt-2">وقت الاستجابة الفعلي</div>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-2">العقد النشطة (Active Linked)</div>
                    <div className="flex items-end gap-2"><span className="text-2xl font-mono font-black text-white">{redditHealth.activeNodes}</span><span className="text-[10px] text-slate-500 mb-1">Nodes</span></div>
                    <div className="text-[10px] text-success-500 mt-2 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> نظام التدوير نشط</div>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-2">معدل الأخطاء (Error Rate)</div>
                    <div className="flex items-end gap-2"><span className={`text-2xl font-mono font-black ${redditHealth.errorRate > 0 ? 'text-red-400' : 'text-green-400'}`}>{Math.round(redditHealth.errorRate)}%</span></div>
                    <div className="text-[10px] text-slate-500 mt-2">نسبة الطلبات المرفوضة</div>
                </div>
             </div>
        </div>
      </div>

      {/* Robotics Grid */}
      <div className="glass-panel rounded-2xl p-6 border border-primary-500/10 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Cpu className="w-64 h-64 text-primary-400" /></div>
           <div className="flex justify-between items-center mb-6 relative z-10">
               <h3 className="text-white font-bold flex items-center gap-2"><GitBranch className="w-5 h-5 text-primary-400" /> شبكة الروبوتات والعناكب (Autonomous Grid)</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
               {agents.map((agent) => (
                   <div key={agent.id} className="bg-[#0b0f19] border border-white/5 rounded-xl p-4 hover:border-primary-500/30 transition-all group">
                       <div className="flex justify-between items-start mb-3">
                           <div className="flex items-center gap-2">
                               <div className={`p-1.5 rounded-lg ${agent.type === 'SPIDER' ? 'bg-violet-500/10 text-violet-400' : agent.type === 'SENTINEL' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                   {agent.type === 'SPIDER' ? <Wifi className="w-3 h-3" /> : agent.type === 'SENTINEL' ? <ShieldCheck className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                               </div>
                               <div><div className="text-xs font-bold text-white group-hover:text-primary-400 transition-colors">{agent.name}</div><div className="text-[9px] text-slate-500 font-mono tracking-wider">{agent.id}</div></div>
                           </div>
                           <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'WORKING' ? 'bg-success-500 animate-pulse' : agent.status === 'ERROR' ? 'bg-red-500' : 'bg-slate-700'}`}></div>
                       </div>
                       <div className="space-y-2">
                           <div className="flex justify-between text-[10px] text-slate-400 font-mono"><span>Task:</span><span className="text-white truncate max-w-[100px]" title={agent.currentTask}>{agent.currentTask}</span></div>
                           <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${agent.efficiency > 80 ? 'bg-primary-500' : agent.efficiency > 50 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${agent.efficiency}%` }}></div></div>
                           <div className="text-[9px] text-right text-slate-600 font-mono">Efficiency: {Math.round(agent.efficiency)}%</div>
                       </div>
                   </div>
               ))}
           </div>
      </div>
      
      {/* Charts & Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel rounded-2xl p-1 relative overflow-hidden group">
          <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0f172a]/50">
            <div className="flex items-center gap-3"><div className="p-2 bg-primary-500/10 rounded-lg"><Wifi className="w-5 h-5 text-primary-400" /></div><div><h3 className="text-sm font-bold text-white">نشاط النظام (System Heartbeat)</h3><div className="text-[10px] text-primary-400 font-mono">عملية/ثانية (Raw Data)</div></div></div>
            <div className="flex gap-2">{[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 bg-slate-700 rounded-full animate-pulse" style={{animationDelay: `${i*200}ms`}}></div>)}</div>
          </div>
          <div className="h-[350px] w-full p-4 bg-[#020617]/40 relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveData}>
                <defs><linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00f0ff" stopOpacity={0.5}/><stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis hide /><YAxis hide domain={[0, 'auto']} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.9)', border: '1px solid #1e293b', color: '#f8fafc', borderRadius: '4px', textAlign: 'right' }} itemStyle={{ color: '#00f0ff', fontFamily: 'monospace' }} cursor={{ stroke: '#00f0ff', strokeWidth: 1 }} labelFormatter={() => "النشاط"} />
                <Area type="monotone" dataKey="value" stroke="#00f0ff" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" animationDuration={0} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-8 flex flex-col relative overflow-hidden">
           <div className="absolute top-0 left-0 p-4 opacity-10"><Server className="w-32 h-32 text-white" /></div>
           <h3 className="text-sm font-bold text-white mb-8 flex items-center gap-2 relative z-10"><span className={`w-2 h-2 rounded-full animate-pulse ${serviceHealth.firebase === 100 ? 'bg-success-500' : 'bg-orange-500'}`}></span> سلامة وصحة السيرفر (Live Status)</h3>
           <div className="flex-1 flex flex-col justify-center space-y-8 relative z-10">
              {[{ label: "اتصال FIRESTORE", val: serviceHealth.firebase, color: serviceHealth.firebase > 0 ? "bg-success-500" : "bg-red-500", glow: serviceHealth.firebase > 0 ? "shadow-[0_0_15px_#22c55e]" : "" }, { label: "واجهة DEEPSEEK", val: serviceHealth.deepseek, color: serviceHealth.deepseek > 0 ? "bg-primary-500" : "bg-slate-700", glow: serviceHealth.deepseek > 0 ? "shadow-[0_0_15px_#06b6d4]" : "" }, { label: "مصادقة النظام", val: serviceHealth.auth, color: "bg-violet-500", glow: "shadow-[0_0_15px_#8b5cf6]" }].map((metric, i) => (
                <div key={i} className="group"><div className="flex justify-between text-[10px] font-bold mb-2 text-slate-400 group-hover:text-white transition-colors tracking-widest"><span>{metric.label}</span><span className="font-mono">{metric.val === 0 ? 'OFFLINE' : metric.val === 100 ? 'ONLINE' : 'DEGRADED'}</span></div><div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/5"><div className={`h-full rounded-full transition-all duration-1000 ${metric.color} ${metric.glow}`} style={{ width: `${metric.val}%` }}></div></div></div>
              ))}
           </div>
           <div className="mt-8 pt-6 border-t border-white/5 text-center"><button onClick={() => fetchData()} className="w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-all border border-white/5 hover:border-primary-400/30 hover:text-primary-400 flex items-center justify-center gap-2"><Activity className="w-4 h-4" /> تحديث البيانات يدوياً</button></div>
        </div>
      </div>
    </div>
  );
};
