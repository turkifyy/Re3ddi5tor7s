
import { BotAgent, RoboticsState } from '../types';
import { logger } from './logger';
import { DatabaseService } from './databaseService';
import { credentialManager } from './credentialManager';
import { RedditService } from './redditService';
import { isFirebaseConfigured } from './firebase';
import { cronService } from './cronService';

/**
 * REDDITOPS ADVANCED ROBOTICS ENGINE (V6.0 PRODUCTION)
 * REAL-TIME STATUS MIRRORING.
 * This engine aggregates data from ACTUAL services to reflect the true health of the cluster.
 * NO SIMULATIONS. ALL METRICS ARE DERIVED FROM LIVE RUNTIME STATE.
 */
class RoboticsEngineService {
    private agents: BotAgent[] = [
        { id: 'SPDR-01', name: 'NetCrawler V1', type: 'SPIDER', status: 'IDLE', currentTask: 'Awaiting Traffic', efficiency: 100, lastCycle: 0 },
        { id: 'SNTL-01', name: 'Account Guardian', type: 'SENTINEL', status: 'IDLE', currentTask: 'Pool Audit', efficiency: 100, lastCycle: 0 },
        { id: 'WRKR-01', name: 'Key Rotator', type: 'WORKER', status: 'IDLE', currentTask: 'Load Balancing', efficiency: 100, lastCycle: 0 },
        { id: 'SPDR-02', name: 'Lead Scanner', type: 'SPIDER', status: 'IDLE', currentTask: 'Queue Monitor', efficiency: 100, lastCycle: 0 }
    ];

    private state: RoboticsState = {
        systemMode: 'PRODUCTION_CYCLE',
        uptime: 0,
        activeAgents: 0,
        nextMaintenance: ''
    };

    private intervalId: any = null;
    private readonly STORAGE_KEY = 'robotics_engine_prod_state';
    private startTime = Date.now();

    constructor() {
        // Load uptime from previous session to maintain continuity
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
            uptime: this.state.uptime
        }));
    }

    public startEngine() {
        if (this.intervalId) return;
        logger.info('BOT', 'Production Engine Started. Attaching to System Kernel.');
        // Tick every second to capture granular state changes
        this.intervalId = setInterval(() => this.tick(), 1000); 
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

    private async tick() {
        const isMaster = cronService.isMasterNode();

        if (isMaster) {
            // Real wall-clock uptime accumulation
            this.state.uptime += 1;
            
            // Persist state occasionally to save IO
            if (this.state.uptime % 10 === 0) this.saveState();
        }

        // BINDING: Update Agents based on REAL System Metrics
        await this.updateAgentsRealtime(isMaster);
        
        // Count truly active agents
        this.state.activeAgents = this.agents.filter(a => a.status === 'WORKING').length;
    }

    // STRICT DATA BINDING LOGIC
    private async updateAgentsRealtime(isMaster: boolean) {
        // 1. Fetch Live Metrics
        const redditHealth = RedditService.getSystemHealth();
        const pool = credentialManager.getPool();
        const latency = logger.getLatestLatency(); // Real network latency
        
        // --- AGENT 1: SPDR-01 (Network Connectivity) ---
        // Bound to: Network Latency & Error Rates
        const netAgent = this.agents[0];
        if (latency > 0) {
            netAgent.status = 'WORKING';
            netAgent.currentTask = `Stabilizing Uplink (${Math.round(latency)}ms)`;
            // Efficiency formula: 100 - (Error Rate % * 2) - (Latency Penalty)
            // Penalty: 10% for every 500ms over 200ms
            const latencyPenalty = Math.max(0, (latency - 200) / 500) * 10;
            netAgent.efficiency = Math.max(0, Math.round(100 - (redditHealth.errorRate * 2) - latencyPenalty));
        } else {
            // If no traffic recently, it's Idle
            netAgent.status = 'IDLE';
            netAgent.currentTask = 'Standby (No Traffic)';
            netAgent.efficiency = 100;
        }

        // --- AGENT 2: SNTL-01 (Account Security) ---
        // Bound to: Credential Pool Health
        const guardAgent = this.agents[1];
        const totalNodes = pool.length;
        const activeNodes = pool.filter(c => c.status === 'READY').length;
        const flaggedNodes = pool.filter(c => c.status === 'RATE_LIMITED' || c.status === 'EXHAUSTED').length;

        if (flaggedNodes > 0) {
            guardAgent.status = 'WORKING';
            guardAgent.currentTask = `Mitigating ${flaggedNodes} Flags`;
            // Efficiency drops as fleet health drops
            guardAgent.efficiency = totalNodes > 0 ? Math.round((activeNodes / totalNodes) * 100) : 100;
        } else if (totalNodes > 0) {
            guardAgent.status = 'IDLE';
            guardAgent.currentTask = `Fleet Healthy (${totalNodes} Nodes)`;
            guardAgent.efficiency = 100;
        } else {
            guardAgent.status = 'ERROR';
            guardAgent.currentTask = 'Pool Empty';
            guardAgent.efficiency = 0;
        }

        // --- AGENT 3: WRKR-01 (Rotation Logic) ---
        // Bound to: Last Rotation Timestamp
        const rotAgent = this.agents[2];
        const lastUsedNode = pool.sort((a,b) => b.lastUsed - a.lastUsed)[0];
        
        // Consider "Working" if a rotation happened in the last 60 seconds
        if (lastUsedNode && (Date.now() - lastUsedNode.lastUsed < 60000)) {
            rotAgent.status = 'WORKING';
            rotAgent.currentTask = `Rotated: ${lastUsedNode.username}`;
            // Efficiency based on daily usage (Higher usage = lower efficiency left)
            const capacityLeft = 1 - (lastUsedNode.dailyUsage / 100);
            rotAgent.efficiency = Math.round(capacityLeft * 100);
        } else {
            rotAgent.status = 'IDLE';
            rotAgent.currentTask = 'Awaiting API Calls';
            rotAgent.efficiency = 100;
        }

        // --- AGENT 4: SPDR-02 (Database Sync) ---
        // Bound to: Firestore Connectivity & Cron Job Status
        const scannerAgent = this.agents[3];
        // Check if DB_SYNC cron job is running
        const cronJobs = cronService.getJobs();
        const dbJob = cronJobs.find(j => j.id === 'DB_SYNC');
        
        if (dbJob && dbJob.status === 'RUNNING') {
             scannerAgent.status = 'WORKING';
             scannerAgent.currentTask = 'Syncing Metrics';
             scannerAgent.efficiency = isFirebaseConfigured() ? 100 : 0;
        } else {
             // Or check if scraper is active via local storage flag (optional, kept simple for now)
             scannerAgent.status = 'IDLE';
             scannerAgent.currentTask = 'Db Sync Idle';
        }
    }
}

export const roboticsEngine = new RoboticsEngineService();
