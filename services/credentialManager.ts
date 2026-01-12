
import { RedditCredential } from '../types';
import { logger } from './logger';

const STORAGE_KEY = 'redditops_credential_pool';

/**
 * SMART CREDENTIAL ROTATION MANAGER
 * Handles the lifecycle of multiple Reddit API keys to avoid Rate Limits.
 */
class CredentialManagerService {
    private pool: RedditCredential[] = [];

    constructor() {
        this.loadPool();
    }

    private loadPool() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.pool = JSON.parse(stored);
            }
        } catch (e) {
            this.pool = [];
        }
    }

    private savePool() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pool));
    }

    public getPool(): RedditCredential[] {
        // Refresh statuses based on time
        const now = Date.now();
        let changed = false;
        
        this.pool.forEach(cred => {
            if (cred.status === 'RATE_LIMITED' && cred.cooldownUntil < now) {
                cred.status = 'READY';
                cred.cooldownUntil = 0;
                changed = true;
            }
        });

        if (changed) this.savePool();
        return this.pool;
    }

    public addCredential(cred: Omit<RedditCredential, 'id' | 'usageCount' | 'status' | 'lastUsed' | 'cooldownUntil'>) {
        const newCred: RedditCredential = {
            ...cred,
            id: Math.random().toString(36).substring(7),
            usageCount: 0,
            status: 'READY',
            lastUsed: 0,
            cooldownUntil: 0
        };
        this.pool.push(newCred);
        this.savePool();
        logger.info('SYS', `New API Key added to pool. Total keys: ${this.pool.length}`);
    }

    public removeCredential(id: string) {
        this.pool = this.pool.filter(c => c.id !== id);
        this.savePool();
    }

    /**
     * THE BRAIN: Selects the best available key.
     * Strategy: Least Recently Used (LRU) among 'READY' keys.
     */
    public getOptimalCredential(): RedditCredential | null {
        const now = Date.now();
        
        // 1. Release locks if time passed
        this.pool.forEach(cred => {
            if (cred.status === 'RATE_LIMITED' && cred.cooldownUntil < now) {
                cred.status = 'READY';
            }
        });

        // 2. Filter valid keys
        const available = this.pool.filter(c => c.status === 'READY');

        if (available.length === 0) {
             logger.error('SYS', 'CRITICAL: All API Keys are currently rate-limited or exhausted.');
             return null;
        }

        // 3. Sort by last used (Ascending) -> Use the one that rested the longest
        available.sort((a, b) => a.lastUsed - b.lastUsed);

        const chosen = available[0];
        
        // Update Usage
        chosen.lastUsed = now;
        chosen.usageCount++;
        this.savePool();
        
        return chosen;
    }

    public markRateLimited(id: string) {
        const cred = this.pool.find(c => c.id === id);
        if (cred) {
            cred.status = 'RATE_LIMITED';
            // Set cooldown for 10 minutes (Reddit reset time is usually 10m)
            cred.cooldownUntil = Date.now() + (10 * 60 * 1000); 
            this.savePool();
            logger.warn('NET', `Key ${id.substring(0,4)}... hit Rate Limit. Switched to cooldown.`);
        }
    }

    public markSuccess(id: string) {
        // Optional: Reset error counters if we were tracking them complexly
        // For now, usage count is enough.
    }
}

export const credentialManager = new CredentialManagerService();
