
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Activity, Zap, Users, TrendingUp, Search, Target, Radio, Server, ShieldCheck, GitBranch, Cpu, ChevronRight } from 'lucide-react';
import { DatabaseService } from '../services/databaseService';
import { logger } from '../services/logger';
import { roboticsEngine } from '../services/roboticsEngine';
import { cronService } from '../services/cronService';
import { RedditService } from '../services/redditService';
import { BotAgent, RedditSystemHealth, ViewState } from '../types';
import { isFirebaseConfigured } from '../services/firebase'; 
import { getDeepSeekKey } from '../services/deepseekService';

interface DashboardProps {
    onNavigate?: (view: ViewState) => void;
}

const WidgetCard = ({ title, value, sub, icon: Icon, colorClass, glowClass, onClick }: any) => {
    return (
        <div className="col s12 m6 l3">
            <div className="card-panel glass-panel animate-float" onClick={onClick} style={{cursor: 'pointer', position: 'relative', overflow: 'hidden', padding: '24px'}}>
                {/* Decorative Glow */}
                <div style={{position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: glowClass, opacity: 0.2, filter: 'blur(30px)'}}></div>
                
                <div className="row valign-wrapper mb-0" style={{marginBottom: '0'}}>
                    <div className="col s8">
                        <span className="grey-text text-lighten-2" style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px'}}>{title}</span>
                        <h4 className="white-text m-0" style={{fontWeight: '800', marginTop: '10px', fontSize: '2rem'}}>{value}</h4>
                    </div>
                    <div className="col s4 right-align">
                        <div className="btn-floating btn-large transparent z-depth-0" style={{border: '1px solid rgba(255,255,255,0.1)'}}>
                            <Icon size={28} className={colorClass} style={{marginTop: '12px'}} />
                        </div>
                    </div>
                </div>
                <div className="row mb-0 mt-4">
                    <div className="col s12">
                         <span className="modern-chip" style={{background: 'rgba(255,255,255,0.05)', fontSize: '0.7rem', padding: '2px 10px', height: 'auto'}}>
                             <TrendingUp size={12} style={{marginRight: '5px', verticalAlign: 'middle'}} /> {sub}
                         </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState({ accounts: 0, leads: 0, engagement: 0, aiOps: 0 });
  const [liveData, setLiveData] = useState<any[]>(Array(30).fill(0).map((_, i) => ({ time: i, value: 0 })));
  const [currentLatency, setCurrentLatency] = useState(0);
  const [serviceHealth, setServiceHealth] = useState({ firebase: 0, deepseek: 0, auth: 0 });
  const [agents, setAgents] = useState<BotAgent[]>([]);
  const [redditHealth, setRedditHealth] = useState<RedditSystemHealth>({ globalRateLimit: 600, averageLatency: 0, errorRate: 0, activeNodes: 0, lastSync: 0 });

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
            
            // Health Check Logic
            const dsKey = getDeepSeekKey();
            
            setServiceHealth({
                firebase: isFirebaseConfigured() ? 100 : 0,
                deepseek: dsKey ? 100 : 0,
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
    const interval = setInterval(() => {
      if (!isMounted.current) return;
      
      const realOps = logger.getAndResetActivityCount();
      setCurrentLatency(logger.getLatestLatency());
      setAgents([...roboticsEngine.getAgents()]);
      setRedditHealth(RedditService.getSystemHealth());
      
      setLiveData(prev => {
        const nextTime = prev[prev.length - 1].time + 1;
        return [...prev.slice(1), { time: nextTime, value: realOps }];
      });
      fetchData();
    }, 2000);
    return () => { isMounted.current = false; clearInterval(interval); };
  }, [fetchData]);

  return (
    <div className="section">
        {/* Header */}
        <div className="row valign-wrapper" style={{marginBottom: '40px'}}>
            <div className="col s12 m8">
                <h4 style={{fontWeight: 800, margin: 0, letterSpacing: '-1px'}}>Command Center</h4>
                <p className="grey-text text-lighten-1" style={{margin: '5px 0 0 0'}}>Real-time Orchestration & Telemetry</p>
            </div>
            <div className="col s12 m4 right-align hide-on-small-only">
                <div className="modern-chip chip-glow-green">
                    <Radio size={12} style={{marginRight: '6px'}} /> LIVE PRODUCTION
                </div>
                <div className="modern-chip chip-glow-blue" style={{marginLeft: '10px'}}>
                    LATENCY: {Math.round(currentLatency)}ms
                </div>
            </div>
        </div>

        {/* Stats Grid */}
        <div className="row">
            <WidgetCard title="Opportunities" value={stats.leads} sub="Scraped Leads" icon={Search} colorClass="green-text text-accent-4" glowClass="#00c853" onClick={() => onNavigate?.('SCRAPER')} />
            <WidgetCard title="Network Nodes" value={stats.accounts} sub="Active Identities" icon={Users} colorClass="purple-text text-accent-2" glowClass="#7c4dff" onClick={() => onNavigate?.('ACCOUNTS')} />
            <WidgetCard title="AI Operations" value={stats.aiOps} sub="DeepSeek Cycles" icon={Zap} colorClass="orange-text text-accent-2" glowClass="#ffab40" onClick={() => onNavigate?.('CAMPAIGNS')} />
            <WidgetCard title="Total Engagement" value={stats.engagement} sub="Replies Deployed" icon={Target} colorClass="cyan-text text-accent-2" glowClass="#00e5ff" onClick={() => onNavigate?.('CAMPAIGNS')} />
        </div>

        {/* Reddit Health & Charts */}
        <div className="row">
            <div className="col s12 l8">
                <div className="card glass-panel" style={{height: '420px', padding: '20px'}}>
                    <div className="card-content white-text" style={{height: '100%'}}>
                        <div className="flex-between mb-4">
                            <span className="card-title" style={{fontSize: '1.2rem', fontWeight: 700}}><Activity size={20} className="cyan-text" style={{verticalAlign: 'middle', marginRight: '10px'}}/> System Throughput</span>
                            <span className="modern-chip chip-glow-blue">REQ / SEC</span>
                        </div>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={liveData}>
                                    <defs><linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00e5ff" stopOpacity={0.6}/><stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis hide /><YAxis hide domain={[0, 'auto']} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(10,14,23,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} />
                                    <Area type="monotone" dataKey="value" stroke="#00e5ff" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* API Monitoring */}
                 <div className="card glass-panel mt-4">
                    <div className="card-content white-text">
                         <span className="card-title" style={{fontSize: '1rem', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px'}}><Radio size={16} style={{verticalAlign: 'middle', marginRight: '8px'}}/> Reddit API Health</span>
                         <div className="row mt-4 mb-0">
                             <div className="col s6 m3 center-align">
                                 <h4 className={redditHealth.globalRateLimit < 100 ? "red-text" : "green-text text-accent-3"} style={{fontWeight: 800, margin: '5px 0'}}>{redditHealth.globalRateLimit}</h4>
                                 <small className="grey-text text-lighten-1" style={{textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '1px'}}>Rate Limit</small>
                             </div>
                             <div className="col s6 m3 center-align">
                                 <h4 className="white-text" style={{fontWeight: 800, margin: '5px 0'}}>{Math.round(redditHealth.averageLatency)}<span style={{fontSize: '1rem'}}>ms</span></h4>
                                 <small className="grey-text text-lighten-1" style={{textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '1px'}}>Avg Latency</small>
                             </div>
                             <div className="col s6 m3 center-align">
                                 <h4 className="white-text" style={{fontWeight: 800, margin: '5px 0'}}>{redditHealth.activeNodes}</h4>
                                 <small className="grey-text text-lighten-1" style={{textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '1px'}}>Proxy Nodes</small>
                             </div>
                             <div className="col s6 m3 center-align">
                                 <h4 className={redditHealth.errorRate > 0 ? "red-text" : "green-text text-accent-3"} style={{fontWeight: 800, margin: '5px 0'}}>{Math.round(redditHealth.errorRate)}%</h4>
                                 <small className="grey-text text-lighten-1" style={{textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '1px'}}>Error Rate</small>
                             </div>
                         </div>
                         <div className="progress grey darken-4 mt-4" style={{height: '6px', borderRadius: '3px'}}>
                             <div className="determinate cyan accent-4" style={{width: `${(redditHealth.globalRateLimit / 600) * 100}%`}}></div>
                         </div>
                    </div>
                 </div>
            </div>

            <div className="col s12 l4">
                <div className="card glass-panel">
                    <div className="card-content white-text">
                        <span className="card-title" style={{fontSize: '1.2rem', fontWeight: 700}}><Server size={20} className="purple-text text-accent-2" style={{verticalAlign: 'middle', marginRight: '10px'}}/> Uplink Status</span>
                        <ul className="collection" style={{border: 'none'}}>
                            <li className="collection-item avatar valign-wrapper pl-0">
                                <i className={`material-icons circle ${serviceHealth.firebase === 100 ? 'green accent-4' : 'red'}`} style={{color: '#000'}}>cloud_queue</i>
                                <div style={{marginLeft: '15px'}}>
                                    <span className="title font-bold">Firebase Core</span>
                                    <p className="grey-text text-lighten-1" style={{fontSize: '0.8rem'}}>{serviceHealth.firebase === 100 ? 'Encrypted Stream' : 'Disconnected'}</p>
                                </div>
                            </li>
                            <li className="collection-item avatar valign-wrapper pl-0">
                                <i className={`material-icons circle ${serviceHealth.deepseek === 100 ? 'purple accent-2' : 'grey'}`} style={{color: '#000'}}>psychology</i>
                                <div style={{marginLeft: '15px'}}>
                                    <span className="title font-bold">DeepSeek V3</span>
                                    <p className="grey-text text-lighten-1" style={{fontSize: '0.8rem'}}>{serviceHealth.deepseek === 100 ? 'Neural Link Active' : 'Configure Key'}</p>
                                </div>
                            </li>
                             <li className="collection-item avatar valign-wrapper pl-0">
                                <i className="material-icons circle blue accent-3" style={{color: '#000'}}>security</i>
                                <div style={{marginLeft: '15px'}}>
                                    <span className="title font-bold">Auth Guard</span>
                                    <p className="grey-text text-lighten-1" style={{fontSize: '0.8rem'}}>Zero Trust Model</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Agents List */}
                <div className="card-panel glass-panel">
                    <h6 className="white-text mb-4" style={{fontWeight: 700, letterSpacing: '0.5px'}}><GitBranch size={16} style={{verticalAlign: 'middle', marginRight: '8px'}}/> Active Agents</h6>
                    {agents.map(agent => (
                        <div key={agent.id} className="row mb-3 valign-wrapper">
                            <div className="col s2">
                                {agent.type === 'SPIDER' ? <Users size={18} className="cyan-text"/> : <ShieldCheck size={18} className="red-text text-accent-2"/>}
                            </div>
                            <div className="col s7">
                                <span className="white-text" style={{fontSize: '0.85rem', fontWeight: 600}}>{agent.name}</span>
                                <div style={{fontSize: '0.7rem', color: '#90a4ae'}}>{agent.currentTask}</div>
                            </div>
                            <div className="col s3">
                                <div className="progress grey darken-3" style={{height: '4px', borderRadius: '2px'}}>
                                    <div className={`determinate ${agent.status === 'WORKING' ? 'green accent-4' : 'orange accent-2'}`} style={{width: `${agent.efficiency}%`}}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};
