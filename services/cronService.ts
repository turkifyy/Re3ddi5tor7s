
import { CronJob, CronInterval } from '../types';
import { logger } from './logger';
import { DatabaseService } from './databaseService';
import { credentialManager } from './credentialManager';

const STORAGE_KEY = 'redditops_cron_registry';

/**
 * REDDITOPS INTELLIGENT SCHEDULER (V5.0 CLUSTER EDITION)
 * Implements "Leader Election" via Web Locks API.
 * Ensures only ONE tab/window executes jobs, while others wait in standby.
 */
class CronService {
    private jobs: Map<string, CronJob> = new Map();
    private handlers: Map<string, () => Promise<void>> = new Map();
    private isInitialized = false;
    private isLeader = false; // Is this tab the Master Node?

    constructor() {
        // JOB 1: LOG ROTATION
        this.defineJob('SYS_CLEANUP', 'System Log Rotation', 'EVERY_5_MINUTES', async () => {
            const removed = logger.pruneLogs(50);
            if (removed > 0) logger.success('CRON', `Cluster Maintenance: Pruned ${removed} logs.`);
        });

        // JOB 2: DEEP HEALTH CHECK
        this.defineJob('TOKEN_HEALTH', 'API Token Health Check', 'HOURLY', async () => {
            const result = await credentialManager.performDeepHealthCheck();
            logger.info('CRON', `Health Check: ${result}`);
        });

        // JOB 3: DB SYNC
        this.defineJob('DB_SYNC', 'Metrics Synchronization', 'EVERY_MINUTE', async () => {
            await DatabaseService.getGlobalStats(); 
        });
        
        // JOB 4: CACHE OPTIMIZATION
        this.defineJob('CACHE_PURGE', 'Browser Cache Optimization', 'DAILY', async () => {
            // CONSOLE FIX: Try-catch block to prevent SecurityError in Incognito mode
            try {
                if (navigator?.storage?.estimate) {
                    const estimate = await navigator.storage.estimate();
                    const usedMB = (estimate.usage || 0) / 1024 / 1024;
                    logger.info('CRON', `Storage: ${usedMB.toFixed(2)} MB used.`);
                }
                logger.success('CRON', 'Cache Optimized.');
            } catch (e) {
                // Silently fail if storage is restricted
            }
        });

        this.loadRegistry();
    }

    private getIntervalMs(interval: CronInterval): number {
        switch(interval) {
            case 'EVERY_MINUTE': return 60 * 1000;
            case 'EVERY_5_MINUTES': return 5 * 60 * 1000;
            case 'HOURLY': return 60 * 60 * 1000;
            case 'DAILY': return 24 * 60 * 60 * 1000;
            case 'WEEKLY': return 7 * 24 * 60 * 60 * 1000;
            default: return 60 * 1000;
        }
    }

    private defineJob(id: string, name: string, interval: CronInterval, handler: () => Promise<void>) {
        this.handlers.set(id, handler);
        if (!this.jobs.has(id)) {
            this.jobs.set(id, {
                id,
                name,
                description: `Executes ${interval.toLowerCase().replace(/_/g, ' ')}`,
                interval,
                lastRun: 0,
                nextRun: Date.now() + this.getIntervalMs(interval),
                status: 'IDLE',
                enabled: true
            });
        }
    }

    private loadRegistry() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed: CronJob[] = JSON.parse(stored);
                parsed.forEach(savedJob => {
                    if (this.jobs.has(savedJob.id)) {
                        const current = this.jobs.get(savedJob.id)!;
                        current.lastRun = savedJob.lastRun;
                        current.nextRun = savedJob.nextRun;
                        current.enabled = savedJob.enabled;
                    }
                });
            } catch (e) {
                // CONSOLE FIX: Use warn instead of error for non-critical registry corruption
                console.warn("[Cron] Registry rebuild required.");
            }
        }
    }

    private saveRegistry() {
        const jobsArray = Array.from(this.jobs.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(jobsArray));
    }

    public start() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        // Request the "Master Lock"
        if ('locks' in navigator) {
            navigator.locks.request('redditops_cluster_master', { mode: 'exclusive' }, async (lock) => {
                this.isLeader = true;
                logger.success('SYS', 'Cluster Election Won: This node is now MASTER.');
                
                // Infinite loop while holding the lock
                while (this.isInitialized) {
                    await this.tick();
                    await new Promise(r => setTimeout(r, 5000)); // Check every 5 seconds
                }
                
                this.isLeader = false;
            }).catch(err => {
                // CONSOLE FIX: Suppress lock errors in unsupported environments
                if (err.name !== 'SecurityError') {
                    logger.error('SYS', `Cluster Election Error: ${err.message}`);
                }
            });
        } else {
            logger.warn('SYS', 'Web Locks API missing. Running in standalone mode.');
            this.isLeader = true;
            setInterval(() => this.tick(), 10000);
        }
    }

    public stop() {
        this.isInitialized = false;
        this.isLeader = false;
    }

    public isMasterNode(): boolean {
        return this.isLeader;
    }

    public getJobs(): CronJob[] {
        return Array.from(this.jobs.values());
    }

    public async forceRun(jobId: string) {
        const job = this.jobs.get(jobId);
        if (job) {
            logger.info('CRON', `Manual Override: Forcing execution of ${job.name}`);
            await this.executeJob(job);
        }
    }

    private async tick() {
        if (!this.isLeader) return; 

        const now = Date.now();
        for (const job of this.jobs.values()) {
            if (job.enabled && job.status !== 'RUNNING' && now >= job.nextRun) {
                await this.executeJob(job);
            }
        }
    }

    private async executeJob(job: CronJob) {
        const handler = this.handlers.get(job.id);
        if (!handler) return;

        job.status = 'RUNNING';
        this.saveRegistry(); 
        
        try {
            await handler();
            job.status = 'SUCCESS';
            job.lastRun = Date.now();
            job.nextRun = Date.now() + this.getIntervalMs(job.interval);
            
            if (job.interval !== 'EVERY_MINUTE') {
                logger.success('CRON', `Job [${job.id}] completed.`);
            }
        } catch (e) {
            job.status = 'FAILED';
            job.nextRun = Date.now() + (5 * 60 * 1000); 
            logger.error('CRON', `Job [${job.id}] Failed: ${(e as Error).message}`);
        } finally {
            this.saveRegistry();
            setTimeout(() => {
                if (job.status !== 'RUNNING') job.status = 'IDLE';
            }, 3000);
        }
    }
}

export const cronService = new CronService();
