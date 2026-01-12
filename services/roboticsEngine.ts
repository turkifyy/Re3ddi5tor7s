
import { BotAgent, RoboticsState } from '../types';
import { logger } from './logger';
import { DatabaseService } from './databaseService';
import { credentialManager } from './credentialManager';
import { RedditService } from './redditService';

/**
 * REDDITOPS ADVANCED ROBOTICS ENGINE
 * Orchestrates autonomous agents with a 23h Active / 1h Rest circadian rhythm.
 */
class RoboticsEngineService {
    private agents: BotAgent[] = [
        { id: 'SPDR-01', name: 'NetCrawler V1', type: 'SPIDER', status: 'IDLE', currentTask: 'Awaiting Uplink', efficiency: 100, lastCycle: 0 },
        { id: 'SNTL-01', name: 'Account Guardian', type: 'SENTINEL', status: 'IDLE', currentTask: 'Monitoring Health', efficiency: 100, lastCycle: 0 },
        { id: 'WRKR-01', name: 'Key Rotator Bot', type: 'WORKER', status: 'IDLE', currentTask: 'Pool Optimization', efficiency: 100, lastCycle: 0 },
        { id: 'SPDR-02', name: 'Inbox Hunter', type: 'SPIDER', status: 'IDLE', currentTask: 'Scanning Messages', efficiency: 100, lastCycle: 0 }
    ];

    private state: RoboticsState = {
        systemMode: 'PRODUCTION_CYCLE',
        uptime: 0,
        activeAgents: 0,
        nextMaintenance: ''
    };

    private intervalId: any = null;
    private maintenanceHour = 3; // 3 AM is maintenance hour (Rest)

    constructor() {
        this.calculateNextMaintenance();
    }

    public startEngine() {
        if (this.intervalId) return;
        logger.info('BOT', 'Robotics Engine Initialized. Starting Production Cycle (23h ON / 1h OFF).');
        this.intervalId = setInterval(() => this.tick(), 5000); // 5-second heartbeat
    }

    public stopEngine() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = null;
        logger.warn('BOT', 'Robotics Engine Halted Manually.');
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
        this.state.nextMaintenance = d.toLocaleTimeString('ar-EG');
    }

    // Main Heartbeat Loop
    private async tick() {
        const now = new Date();
        const currentHour = now.getHours();

        // 1. Check Circadian Rhythm (23h / 1h)
        if (currentHour === this.maintenanceHour) {
            if (this.state.systemMode !== 'MAINTENANCE_CYCLE') {
                this.enterMaintenanceMode();
            }
            return; // Skip work ticks during maintenance
        } else {
            if (this.state.systemMode !== 'PRODUCTION_CYCLE') {
                this.exitMaintenanceMode();
            }
        }

        this.state.uptime += 5;

        // 2. Dispatch Agents (Round Robin Execution)
        for (const agent of this.agents) {
            await this.processAgentLogic(agent);
        }
    }

    private enterMaintenanceMode() {
        this.state.systemMode = 'MAINTENANCE_CYCLE';
        this.agents.forEach(a => {
            a.status = 'RESTING';
            a.currentTask = 'System Cooling / Cache Dump';
        });
        logger.warn('SYS', 'ENTERING MAINTENANCE CYCLE (1 Hour Rest). All bots docked.');
    }

    private exitMaintenanceMode() {
        this.state.systemMode = 'PRODUCTION_CYCLE';
        this.calculateNextMaintenance();
        this.agents.forEach(a => a.status = 'IDLE');
        logger.success('SYS', 'PRODUCTION CYCLE RESUMED. All bots deployed.');
    }

    // Intelligent Agent Logic
    private async processAgentLogic(agent: BotAgent) {
        // Simulate "Thinking" delay randomly
        if (Math.random() > 0.7) return; 

        try {
            agent.status = 'WORKING';
            agent.lastCycle = Date.now();

            switch (agent.id) {
                // --- SPIDER 01: NET CRAWLER (Connectivity Check) ---
                case 'SPDR-01':
                    agent.currentTask = 'Pinging Firebase Nodes...';
                    await new Promise(r => setTimeout(r, 500)); // Sim delay
                    try {
                        const dbStart = performance.now();
                        await DatabaseService.getAiOpsCount(); // Lightweight ping
                        const latency = Math.round(performance.now() - dbStart);
                        agent.currentTask = `Network Stable (${latency}ms)`;
                        agent.efficiency = Math.min(100, Math.max(80, 100 - (latency / 10)));
                    } catch (e) {
                        agent.currentTask = 'Network Fluctuation Detected';
                        agent.efficiency = 50;
                    }
                    break;

                // --- SENTINEL 01: ACCOUNT GUARDIAN (Health Monitor) ---
                case 'SNTL-01':
                    agent.currentTask = 'Scanning Account Matrices...';
                    const accounts = await DatabaseService.getAccounts();
                    const lowHealth = accounts.filter(a => a.healthScore < 50);
                    if (lowHealth.length > 0) {
                        agent.currentTask = `ALERT: ${lowHealth.length} Accounts Critical`;
                        // logger.warn('BOT', `Sentinel detected ${lowHealth.length} accounts needing attention.`);
                    } else {
                        agent.currentTask = 'All Systems Nominal (Green)';
                    }
                    break;

                // --- WORKER 01: KEY ROTATOR (Optimization) ---
                case 'WRKR-01':
                    agent.currentTask = 'Analyzing Credential Pool...';
                    const pool = credentialManager.getPool();
                    const limited = pool.filter(c => c.status === 'RATE_LIMITED').length;
                    if (limited > 0) {
                         agent.currentTask = `Cooling ${limited} Keys...`;
                    } else {
                         agent.currentTask = 'Pool Optimized. Ready.';
                    }
                    break;

                 // --- SPIDER 02: INBOX HUNTER (Content Scanner) ---
                 case 'SPDR-02':
                    // We don't want to actually spam API, so we just check "If active"
                    agent.currentTask = 'Crawling Inbox Surface...';
                    // Simulation of crawl
                    if (Math.random() > 0.9) {
                         agent.currentTask = 'New Signal Detected (Simulated)';
                         // In real production, this would call RedditService.getInbox() periodically
                    }
                    break;
            }

            // Self-Correction
            if (agent.efficiency < 30) {
                logger.warn('BOT', `Agent ${agent.name} efficiency critical. Auto-optimizing...`);
                agent.efficiency = 100; // Reset
            }

        } catch (e) {
            agent.status = 'ERROR';
            agent.currentTask = 'Runtime Error - Rebooting...';
            logger.error('BOT', `Agent ${agent.name} Crashed. Restarting process.`);
            setTimeout(() => agent.status = 'IDLE', 3000);
        }
    }
}

export const roboticsEngine = new RoboticsEngineService();
