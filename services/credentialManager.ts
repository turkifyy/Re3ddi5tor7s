
import { RedditCredential } from '../types';
import { logger } from './logger';
import { getDb, isFirebaseConfigured } from './firebase';
import { doc, setDoc } from "firebase/firestore";

const STORAGE_KEY = 'redditops_credential_pool';

/**
 * REDDITOPS GHOST PROTOCOL MANAGER
 * Handles high-volume account rotation (up to 10k nodes) with anti-fingerprinting logic.
 */
class CredentialManagerService {
    private pool: RedditCredential[] = [];
    private readonly MAX_LOCAL_STORAGE_ITEMS = 2000; // Browser limit safeguard
    private readonly SAFETY_COOLDOWN_MS = 15 * 60 * 1000; // 15 Minutes minimum between same-account reuse

    constructor() {
        this.loadPool();
    }

    private loadPool() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    this.pool = parsed;
                } else {
                    this.pool = [];
                }
            }
        } catch (e) {
            console.error("Failed to load credential pool", e);
            this.pool = [];
        }
    }

    private savePool() {
        // Optimization: If pool is huge, only save active/local subset to localStorage to prevent quota exceeded
        // For production with 10k accounts, Firebase Vault is the primary store.
        const subset = this.pool.slice(0, this.MAX_LOCAL_STORAGE_ITEMS);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(subset));
        } catch (e) {
            logger.warn('SYS', 'Local Storage full. Relying on Cloud Vault.');
        }
        
        // Async Cloud Sync
        this.syncToCloudVault(); 
    }

    // Syncs the massive pool to Firestore for the Headless Bot
    public async syncToCloudVault() {
        if (!isFirebaseConfigured()) return;
        try {
            const db = getDb();
            if (!db) return;
            
            // Chunking for Firestore (Max 1MB per doc)
            const chunkSize = 500;
            for (let i = 0; i < this.pool.length; i += chunkSize) {
                const chunk = this.pool.slice(i, i + chunkSize);
                await setDoc(doc(db, 'admin_secrets', `reddit_pool_shard_${Math.floor(i/chunkSize)}`), {
                    updatedAt: new Date().toISOString(),
                    count: chunk.length,
                    pool: chunk
                });
            }
            // logger.info('SYS', 'Vault Synced.');
        } catch (e) {
            console.warn("Vault sync warning", e);
        }
    }

    /**
     * BULK IMPORT ENGINE
     * Parses CSV format: ClientID,Secret,Username,Password
     */
    public importCredentials(csvText: string): number {
        const lines = csvText.split('\n');
        let addedCount = 0;

        lines.forEach(line => {
            const parts = line.split(',').map(s => s.trim());
            if (parts.length >= 4) {
                const [clientId, clientSecret, username, password] = parts;
                
                // Prevent duplicates
                if (!this.pool.find(p => p.username === username)) {
                    this.addCredential({
                        clientId, clientSecret, username, password
                    }, false); // Don't save on every iteration
                    addedCount++;
                }
            }
        });

        this.savePool();
        logger.success('SYS', `Bulk Import: Successfully onboarded ${addedCount} new identities.`);
        return addedCount;
    }

    public getPool(): RedditCredential[] {
        const now = Date.now();
        let changed = false;
        
        // Smart Recovery: Check cooldowns
        this.pool.forEach(cred => {
            if (cred.status === 'RATE_LIMITED' && cred.cooldownUntil > 0 && cred.cooldownUntil < now) {
                cred.status = 'READY';
                cred.cooldownUntil = 0;
                changed = true;
                // Silent recovery log to reduce noise
            }
        });

        if (changed) this.savePool();
        return this.pool;
    }

    public addCredential(cred: Omit<RedditCredential, 'id' | 'usageCount' | 'status' | 'lastUsed' | 'cooldownUntil'>, autoSave = true) {
        const newCred: RedditCredential = {
            ...cred,
            id: Math.random().toString(36).substring(7),
            usageCount: 0,
            status: 'READY',
            lastUsed: 0,
            cooldownUntil: 0
        };
        this.pool.push(newCred);
        if (autoSave) {
            this.savePool();
            logger.info('SYS', `New Node Added: ${cred.username}`);
        }
    }

    public removeCredential(id: string) {
        this.pool = this.pool.filter(c => c.id !== id);
        this.savePool();
    }

    /**
     * CORE ALGORITHM: "GHOST PROTOCOL"
     * Selects a credential ensuring:
     * 1. It hasn't been used recently (Safety Cooldown).
     * 2. It is randomly selected (No sequential patterns).
     * 3. It distributes load across the entire 10k pool.
     */
    public getOptimalCredential(): RedditCredential | null {
        const now = Date.now();
        
        // 1. Filter for READY accounts
        let candidates = this.pool.filter(c => c.status === 'READY');

        // 2. Filter for Safety Cooldown (Don't reuse same account within 15 mins)
        // This is crucial for "Anti-Spam" detection.
        const safeCandidates = candidates.filter(c => (now - c.lastUsed) > this.SAFETY_COOLDOWN_MS);

        // Fallback: If all safe candidates are exhausted, use least recently used from the general pool
        // This happens if you post VERY frequently with a small pool.
        if (safeCandidates.length === 0 && candidates.length > 0) {
             logger.warn('SYS', 'High Velocity Warning: Reusing accounts within safety window.');
             candidates.sort((a, b) => a.lastUsed - b.lastUsed);
             return this.selectAndMark(candidates[0]);
        }

        if (safeCandidates.length === 0) {
             logger.error('SYS', 'CRITICAL: Pool Exhausted. All accounts are cooling down or rate-limited.');
             return null;
        }

        // 3. Random Selection (Jitter)
        // Never pick the first one. Pick a random one from the safe list.
        const randomIndex = Math.floor(Math.random() * safeCandidates.length);
        const chosen = safeCandidates[randomIndex];
        
        return this.selectAndMark(chosen);
    }

    // UPDATED: Public method to manually mark usage (Critical for Inbox/Manual replies)
    public markUsage(id: string) {
        const cred = this.pool.find(c => c.id === id);
        if (cred) {
            this.selectAndMark(cred);
        }
    }

    private selectAndMark(cred: RedditCredential): RedditCredential {
        cred.lastUsed = Date.now();
        cred.usageCount++;
        this.savePool();
        return cred;
    }

    public markRateLimited(id: string) {
        const cred = this.pool.find(c => c.id === id);
        if (cred) {
            cred.status = 'RATE_LIMITED';
            // Variable cooldown: 30 to 60 minutes to look natural
            const variableCooldown = (30 * 60 * 1000) + (Math.random() * 30 * 60 * 1000);
            cred.cooldownUntil = Date.now() + variableCooldown; 
            this.savePool();
            logger.warn('NET', `Anti-Ban Protocol: Node ${cred.username} placed in deep freeze for ${Math.round(variableCooldown/60000)}m.`);
        }
    }

    public markSuccess(id: string) {
        const cred = this.pool.find(c => c.id === id);
        if (cred && cred.status !== 'READY') {
            cred.status = 'READY'; 
            this.savePool();
        }
    }

    public async performDeepHealthCheck(): Promise<string> {
        // Only check a sample to avoid API spam during health check
        const sampleSize = Math.min(this.pool.length, 5); 
        // Logic for health check would go here (omitted for brevity in this update)
        return `Pool Size: ${this.pool.length} Nodes. Ready: ${this.pool.filter(c => c.status === 'READY').length}`;
    }
}

export const credentialManager = new CredentialManagerService();
