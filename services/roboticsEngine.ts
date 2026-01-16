
import { BotAgent, RoboticsState } from '../types';
import { logger } from './logger';
import { DatabaseService } from './databaseService';
import { credentialManager } from './credentialManager';
import { RedditService } from './redditService';
import { isFirebaseConfigured } from './firebase';
import { cronService } from './cronService';

/**
 * REDDITOPS ADVANCED ROBOTICS ENGINE (V6.0 PRODUCTION)
 * REAL-TIME STATUS MIRRORING. NO SIMULATIONS.
 * This engine aggregates data from actual services to reflect the true health of the cluster.
 */
class RoboticsEngineService {
    private agents: BotAgent[] = [
        { id: 'SPDR-01', name: 'NetCrawler V1', type: 'SPIDER', status: 'IDLE', currentTask: 'Waiting for Network', efficiency: 100, lastCycle: 0 },
        { id: 'SNTL-01', name: 'Account Guardian', type: 'SENTINEL', status: 'IDLE', currentTask: 'Audit Pending', efficiency: 100, lastCycle: 0 },
        { id: 'WRKR-01', name: 'Key Rotator', type: 'WORKER', status: 'IDLE', currentTask: 'Pool Check', efficiency: 100, lastCycle: 0 },
        { id: 'SPDR-02', name: 'Lead Scanner', type: 'SPIDER', status: 'IDLE', currentTask: 'Queue Check', efficiency: 100, lastCycle: 0 }
    ];

    private state: RoboticsState = {
        systemMode: 'PRODUCTION_CYCLE',
        uptime: 0,
        activeAgents: 0,
        nextMaintenance: ''
    };

    private intervalId: any = null;
    private readonly STORAGE_KEY = 'robotics_engine_prod_state';

    constructor() {
        this.loadState();
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
            uptime: this.state.uptime
        }));
    }

    public startEngine() {
        if (this.intervalId) return;
        logger.info('BOT', 'Production Engine Started. Real-time Monitoring Active.');
        // Fast tick for responsive UI in production
        this.intervalId = setInterval(() => this.tick(), 2000); 
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
            this.state.uptime += 2; // +2 seconds per tick
            this.saveState();
        }

        // PRODUCTION LOGIC: Update Agents based on REAL System Metrics
        await this.updateAgentsRealtime(isMaster);
    }

    // This function replaces the simulated logic with real state reflection
    private async updateAgentsRealtime(isMaster: boolean) {
        // Shared Metrics
        const redditHealth = RedditService.getSystemHealth();
        const pool = credentialManager.getPool();
        
        // 1. SPDR-01: Network Health (Based on Latency & Errors)
        const netAgent = this.agents[0];
        if (redditHealth.averageLatency > 0) {
            netAgent.status = redditHealth.averageLatency > 1500 ? 'ERROR' : 'WORKING';
            netAgent.currentTask = `Latency: ${Math.round(redditHealth.averageLatency)}ms | Rates: ${redditHealth.globalRateLimit}`;
            // Efficiency drops as error rate increases
            netAgent.efficiency = Math.max(0, 100 - (redditHealth.errorRate * 2));
        } else {
            netAgent.status = 'IDLE';
            netAgent.currentTask = 'Standby (No Traffic)';
            netAgent.efficiency = 100;
        }

        // 2. SNTL-01: Account Health (Based on Pool Status)
        const guardAgent = this.agents[1];
        const flaggedCount = pool.filter(c => c.status === 'RATE_LIMITED' || c.status === 'EXHAUSTED').length;
        if (flaggedCount > 0) {
            guardAgent.status = 'WORKING'; // It's "working" on dealing with issues
            guardAgent.currentTask = `Flagged Nodes: ${flaggedCount}`;
            guardAgent.efficiency = Math.max(0, 100 - (flaggedCount * 5));
        } else {
            guardAgent.status = 'IDLE';
            guardAgent.currentTask = 'All Systems Nominal';
            guardAgent.efficiency = 100;
        }

        // 3. WRKR-01: Rotator Logic (Based on Usage Caps)
        const rotAgent = this.agents[2];
        const activeNode = pool.sort((a,b) => b.lastUsed - a.lastUsed)[0];
        if (activeNode && (Date.now() - activeNode.lastUsed < 60000)) {
            rotAgent.status = 'WORKING';
            rotAgent.currentTask = `Active: ${activeNode.username} (${activeNode.dailyUsage}/100)`;
            rotAgent.efficiency = 100;
        } else {
            rotAgent.status = 'IDLE';
            rotAgent.currentTask = 'Awaiting Tasks';
        }

        // 4. SPDR-02: Lead Processor (Based on Queue)
        const scannerAgent = this.agents[3];
        if (isFirebaseConfigured() && isMaster) {
             // Only check DB if we are Master to save reads
             try {
                // We use a lighter check here or cached value if available
                const leadsCount = await DatabaseService.getLeadsCount();
                if (leadsCount > 0) {
                    scannerAgent.status = 'WORKING';
                    scannerAgent.currentTask = `Processing Queue (${leadsCount} items)`;
                } else {
                    scannerAgent.status = 'IDLE';
                    scannerAgent.currentTask = 'Queue Empty';
                }
             } catch(e) {
                 scannerAgent.status = 'ERROR';
                 scannerAgent.currentTask = 'DB Sync Failed';
             }
        } else {
            scannerAgent.status = 'IDLE';
            scannerAgent.currentTask = 'Replica Node (Standby)';
        }
    }
}

export const roboticsEngine = new RoboticsEngineService();
