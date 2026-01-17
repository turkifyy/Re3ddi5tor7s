
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Zap, Users, TrendingUp, Search, Target, Radio, Server, ShieldCheck, GitBranch } from 'lucide-react';
import { DatabaseService } from '../services/databaseService';
import { logger } from '../services/logger';
import { roboticsEngine } from '../services/roboticsEngine';
import { RedditService } from '../services/redditService';
import { BotAgent, RedditSystemHealth, ViewState } from '../types';
import { isFirebaseConfigured } from '../services/firebase'; 
import { getDeepSeekKey } from '../services/deepseekService';

interface DashboardProps {
    onNavigate?: (view: ViewState) => void;
}

const WidgetCard = ({ title, value, sub, icon: Icon, colorClass, onClick }: any) => {
    return (
        <div className="col-12 col-md-6 col-lg-3 mb-4">
            <div className="card h-100" onClick={onClick} style={{cursor: 'pointer'}}>
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                        <div>
                            <div className="text-muted text-uppercase fw-bold" style={{fontSize: '0.75rem', letterSpacing: '1px'}}>{title}</div>
                            <h3 className="fw-bold text-white mt-2 mb-0">{value}</h3>
                        </div>
                        <div className={`p-2 rounded bg-opacity-10 ${colorClass.replace('text-', 'bg-')}`}>
                            <Icon size={24} className={colorClass} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="badge bg-dark border border-secondary text-secondary">
                             <TrendingUp size={12} className="me-1" /> {sub}
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
    <div className="container-fluid p-0">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-end mb-4">
            <div>
                <h2 className="fw-bold text-white mb-1">Command Center</h2>
                <p className="text-secondary mb-0">Real-time Orchestration & Telemetry</p>
            </div>
            <div className="d-none d-md-block text-end">
                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 me-2">
                    <Radio size={12} className="me-1" /> LIVE PROD
                </span>
                <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25">
                    LATENCY: {Math.round(currentLatency)}ms
                </span>
            </div>
        </div>

        {/* Stats Grid */}
        <div className="row">
            <WidgetCard title="Opportunities" value={stats.leads} sub="Scraped Leads" icon={Search} colorClass="text-success" onClick={() => onNavigate?.('SCRAPER')} />
            <WidgetCard title="Network Nodes" value={stats.accounts} sub="Active Identities" icon={Users} colorClass="text-warning" onClick={() => onNavigate?.('ACCOUNTS')} />
            <WidgetCard title="AI Operations" value={stats.aiOps} sub="DeepSeek Cycles" icon={Zap} colorClass="text-primary" onClick={() => onNavigate?.('CAMPAIGNS')} />
            <WidgetCard title="Engagement" value={stats.engagement} sub="Replies Deployed" icon={Target} colorClass="text-info" onClick={() => onNavigate?.('CAMPAIGNS')} />
        </div>

        {/* Charts & Health */}
        <div className="row">
            <div className="col-lg-8 mb-4">
                <div className="card mb-4" style={{height: '400px'}}>
                    <div className="card-body">
                        <div className="d-flex justify-content-between mb-4">
                            <h5 className="card-title fw-bold"><Activity size={20} className="text-info me-2"/> System Throughput</h5>
                            <span className="badge bg-dark border border-secondary">REQ / SEC</span>
                        </div>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={liveData}>
                                    <defs><linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00e5ff" stopOpacity={0.6}/><stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis hide /><YAxis hide domain={[0, 'auto']} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }} />
                                    <Area type="monotone" dataKey="value" stroke="#00e5ff" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* API Monitoring */}
                 <div className="card">
                    <div className="card-body">
                         <h6 className="card-title text-uppercase text-muted fw-bold mb-3" style={{letterSpacing: '1px'}}><Radio size={16} className="me-2"/> Reddit API Health</h6>
                         <div className="row text-center mb-3">
                             <div className="col-3">
                                 <h4 className={`fw-bold ${redditHealth.globalRateLimit < 100 ? "text-danger" : "text-success"}`}>{redditHealth.globalRateLimit}</h4>
                                 <small className="text-muted" style={{fontSize: '0.7rem'}}>Rate Limit</small>
                             </div>
                             <div className="col-3">
                                 <h4 className="fw-bold text-white">{Math.round(redditHealth.averageLatency)}<small>ms</small></h4>
                                 <small className="text-muted" style={{fontSize: '0.7rem'}}>Latency</small>
                             </div>
                             <div className="col-3">
                                 <h4 className="fw-bold text-white">{redditHealth.activeNodes}</h4>
                                 <small className="text-muted" style={{fontSize: '0.7rem'}}>Active Nodes</small>
                             </div>
                             <div className="col-3">
                                 <h4 className={`fw-bold ${redditHealth.errorRate > 0 ? "text-danger" : "text-success"}`}>{Math.round(redditHealth.errorRate)}%</h4>
                                 <small className="text-muted" style={{fontSize: '0.7rem'}}>Error Rate</small>
                             </div>
                         </div>
                         <div className="progress bg-dark" style={{height: '6px'}}>
                             <div className="progress-bar bg-info" role="progressbar" style={{width: `${(redditHealth.globalRateLimit / 600) * 100}%`}}></div>
                         </div>
                    </div>
                 </div>
            </div>

            <div className="col-lg-4">
                <div className="card mb-4">
                    <div className="card-body">
                        <h5 className="card-title fw-bold mb-4"><Server size={20} className="text-purple me-2"/> Uplink Status</h5>
                        <ul className="list-group list-group-flush">
                            <li className="list-group-item bg-transparent border-secondary border-opacity-25 d-flex align-items-center px-0">
                                <div className={`rounded-circle p-2 me-3 ${serviceHealth.firebase === 100 ? 'bg-success' : 'bg-danger'}`}></div>
                                <div>
                                    <div className="fw-bold">Firebase Core</div>
                                    <small className="text-muted">{serviceHealth.firebase === 100 ? 'Encrypted Stream' : 'Disconnected'}</small>
                                </div>
                            </li>
                            <li className="list-group-item bg-transparent border-secondary border-opacity-25 d-flex align-items-center px-0">
                                <div className={`rounded-circle p-2 me-3 ${serviceHealth.deepseek === 100 ? 'bg-primary' : 'bg-secondary'}`}></div>
                                <div>
                                    <div className="fw-bold">DeepSeek V3</div>
                                    <small className="text-muted">{serviceHealth.deepseek === 100 ? 'Neural Link Active' : 'Configure Key'}</small>
                                </div>
                            </li>
                             <li className="list-group-item bg-transparent border-0 d-flex align-items-center px-0">
                                <div className="rounded-circle p-2 me-3 bg-info"></div>
                                <div>
                                    <div className="fw-bold">Auth Guard</div>
                                    <small className="text-muted">Zero Trust Model</small>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="card">
                    <div className="card-body">
                         <h6 className="card-title fw-bold text-white mb-4"><GitBranch size={16} className="me-2"/> Active Agents</h6>
                         {agents.map(agent => (
                            <div key={agent.id} className="d-flex align-items-center mb-3">
                                <div className="me-3">
                                    {agent.type === 'SPIDER' ? <Users size={18} className="text-info"/> : <ShieldCheck size={18} className="text-danger"/>}
                                </div>
                                <div className="flex-grow-1">
                                    <div className="d-flex justify-content-between">
                                        <span className="text-white small fw-bold">{agent.name}</span>
                                        <span className={`small ${agent.status === 'WORKING' ? 'text-success' : 'text-warning'}`}>{agent.efficiency}%</span>
                                    </div>
                                    <div className="progress bg-dark mt-1" style={{height: '4px'}}>
                                        <div className={`progress-bar ${agent.status === 'WORKING' ? 'bg-success' : 'bg-warning'}`} style={{width: `${agent.efficiency}%`}}></div>
                                    </div>
                                    <div className="text-muted" style={{fontSize: '0.65rem'}}>{agent.currentTask}</div>
                                </div>
                            </div>
                         ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
