
import { BotAgent, RoboticsState, AccountStatus } from '../types';
import { logger } from './logger';
import { DatabaseService } from './databaseService';
import { credentialManager } from './credentialManager';
import { RedditService } from './redditService';
import { isFirebaseConfigured } from './firebase';
import { cronService } from './cronService'; // Import Cron for Leader Check

/**
 * REDDITOPS ADVANCED ROBOTICS ENGINE (V5.1 SMART CLUSTER)
 * Aware of Leader Election. Only the MASTER node performs heavy API calls.
 * REPLICA nodes only update UI state without network overhead.
 */
class RoboticsEngineService {
    private agents: BotAgent[] = [
        { id: 'SPDR-01', name: 'NetCrawler V1', type: 'SPIDER', status: 'IDLE', currentTask: 'Awaiting Uplink', efficiency: 100, lastCycle: 0 },
        { id: 'SNTL-01', name: 'Account Guardian', type: 'SENTINEL', status: 'IDLE', currentTask: 'Monitoring Health', efficiency: 100, lastCycle: 0 },
        { id: 'WRKR-01', name: 'Key Rotator Bot', type: 'WORKER', status: 'IDLE', currentTask: 'Pool Optimization', efficiency: 100, lastCycle: 0 },
        { id: 'SPDR-02', name: 'Lead Scanner', type: 'SPIDER', status: 'IDLE', currentTask: 'Monitoring Leads', efficiency: 100, lastCycle: 0 }
    ];

    private state: RoboticsState = {
        systemMode: 'PRODUCTION_CYCLE',
        uptime: 0,
        activeAgents: 0,
        nextMaintenance: ''
    };

    private intervalId: any = null;
    private maintenanceHour = 3; 
    private readonly STORAGE_KEY = 'robotics_engine_state';

    constructor() {
        this.loadState();
        this.calculateNextMaintenance();
    }

    private loadState() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.state.uptime = parsed.uptime || 0;
            } catch (e) {}
        }
    }

    private saveState() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            uptime: this.state.uptime,
            systemMode: this.state.systemMode
        }));
    }

    public startEngine() {
        if (this.intervalId) return;
        logger.info('BOT', 'Robotics Engine Online. Cluster Sync Active.');
        this.intervalId = setInterval(() => this.tick(), 5000); 
    }

    public stopEngine() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = null;
    }

    public getAgents() {
        return this.agents;
    }

    public getState() {
        return this.state;
    }

    private calculateNextMaintenance() {
        const d = new Date();
        d.setHours(this.maintenanceHour, 0, 0, 0);
        if (d.getTime() < Date.now()) {
            d.setDate(d.getDate() + 1);
        }
        this.state.nextMaintenance = d.toLocaleTimeString('en-US');
    }

    private async tick() {
        const now = new Date();
        const currentHour = now.getHours();
        
        // Is this tab the Master Node?
        const isMaster = cronService.isMasterNode();

        // 1. Maintenance Logic (Runs on all nodes for visual sync)
        if (currentHour === this.maintenanceHour) {
            if (this.state.systemMode !== 'MAINTENANCE_CYCLE') this.enterMaintenanceMode();
            return; 
        } else {
            if (this.state.systemMode !== 'PRODUCTION_CYCLE') this.exitMaintenanceMode();
        }

        if (isMaster) {
            this.state.uptime += 5;
            this.saveState();
        }

        // 2. Dispatch Agents
        for (const agent of this.agents) {
            // REPLICA NODES: Only simulate idle/waiting state. Do NOT execute logic.
            if (!isMaster) {
                if (agent.status !== 'IDLE') agent.status = 'IDLE';
                agent.currentTask = 'Standby (Replica Node)';
                continue; 
            }

            const jitter = Math.floor(Math.random() * 1000);
            setTimeout(() => this.processAgentLogic(agent), jitter);
        }
    }

    private enterMaintenanceMode() {
        this.state.systemMode = 'MAINTENANCE_CYCLE';
        this.agents.forEach(a => {
            a.status = 'RESTING';
            a.currentTask = 'System Cooling / Maintenance Mode';
        });
        if (cronService.isMasterNode()) {
             logger.warn('SYS', 'ENTERING MAINTENANCE CYCLE. All bots docked.');
        }
    }

    private exitMaintenanceMode() {
        this.state.systemMode = 'PRODUCTION_CYCLE';
        this.calculateNextMaintenance();
        this.agents.forEach(a => a.status = 'IDLE');
        if (cronService.isMasterNode()) {
            logger.success('SYS', 'PRODUCTION CYCLE RESUMED. All bots deployed.');
        }
    }

    // Heavy Logic (Only runs on Master Node)
    private async processAgentLogic(agent: BotAgent) {
        if (agent.status === 'ERROR') return; 

        const now = Date.now();
        const interval = agent.id === 'SNTL-01' ? 60000 : agent.id === 'SPDR-01' ? 20000 : 15000;
        
        if (now - agent.lastCycle < interval) return; 

        try {
            agent.status = 'WORKING';
            agent.lastCycle = now;

            switch (agent.id) {
                case 'SPDR-01': // NetCrawler
                    if (!isFirebaseConfigured()) {
                        agent.currentTask = 'Waiting for Config...';
                        agent.efficiency = 0;
                        break;
                    }
                    agent.currentTask = 'Ping Test (Uplink)...';
                    const dbStart = performance.now();
                    try {
                        await DatabaseService.getAiOpsCount();
                        const latency = Math.round(performance.now() - dbStart);
                        agent.currentTask = `Uplink Stable (${latency}ms)`;
                        agent.efficiency = Math.min(100, Math.max(80, 100 - (latency / 10)));
                    } catch (e) {
                        agent.currentTask = 'Uplink Unstable / Offline';
                        agent.efficiency = 20;
                    }
                    break;

                case 'SNTL-01': // Account Guardian
                    if (!isFirebaseConfigured()) {
                        agent.currentTask = 'Offline Mode';
                        break;
                    }
                    agent.currentTask = 'Auditing Account Health...';
                    try {
                        const accounts = await DatabaseService.getAccounts();
                        agent.currentTask = `Monitoring ${accounts.length} Nodes`;
                    } catch (e) {
                        agent.currentTask = 'DB Read Error';
                    }
                    break;

                case 'WRKR-01': // Key Rotator
                    agent.currentTask = 'Optimizing Token Pool...';
                    const pool = credentialManager.getPool(); 
                    if (pool.length === 0) {
                        agent.currentTask = 'Pool Empty - Add Keys';
                        agent.efficiency = 0;
                    } else {
                        const limited = pool.filter(c => c.status === 'RATE_LIMITED').length;
                        agent.currentTask = `Active Management (${pool.length} Nodes)`;
                    }
                    break;

                 case 'SPDR-02': // Lead Scanner
                    if (!isFirebaseConfigured()) {
                        agent.currentTask = 'Offline';
                        break;
                    }
                    agent.currentTask = 'Analyzing Leads DB...';
                    try {
                        const leadsCount = await DatabaseService.getLeadsCount();
                        agent.currentTask = leadsCount > 0 ? `Analyzed ${leadsCount} Pending Leads` : 'Queue Empty';
                        agent.efficiency = 100;
                    } catch (e: any) {
                         agent.currentTask = 'DB Sync Error';
                         agent.efficiency = 50;
                    }
                    break;
            }

            setTimeout(() => {
                if (agent.status === 'WORKING') agent.status = 'IDLE';
            }, 2000);

        } catch (e) {
            agent.status = 'IDLE';
            agent.currentTask = 'Cycle Skipped (Network)';
        }
    }
}

export const roboticsEngine = new RoboticsEngineService();
