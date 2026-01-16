
import { RedditCredential } from '../types';
import { logger } from './logger';
import { getDb, isFirebaseConfigured } from './firebase';
import { doc, setDoc, getDoc } from "firebase/firestore";

const STORAGE_KEY = 'redditops_credential_pool';

/**
 * REDDITOPS GHOST PROTOCOL MANAGER
 * Handles high-volume account rotation (up to 10k nodes) with anti-fingerprinting logic.
 * ENFORCES STRICT DAILY LIMITS TO PREVENT BANS.
 */
class CredentialManagerService {
    private pool: RedditCredential[] = [];
    private readonly MAX_LOCAL_STORAGE_ITEMS = 2000; 
    private readonly SAFETY_COOLDOWN_MS = 15 * 60 * 1000; // 15 Mins between actions
    private readonly DAILY_POST_LIMIT = 100; // UPDATED: Max 100 posts per 24h per account
    private readonly DAY_MS = 24 * 60 * 60 * 1000;

    constructor() {
        this.loadPool();
    }

    private loadPool() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    // Normalize old data to include new fields
                    this.pool = parsed.map(c => ({
                        ...c,
                        dailyUsage: c.dailyUsage || 0,
                        dayStartTimestamp: c.dayStartTimestamp || Date.now(),
                        status: c.status === 'DAILY_CAP_REACHED' ? 'READY' : c.status // Reset on load to allow re-check
                    }));
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
        const subset = this.pool.slice(0, this.MAX_LOCAL_STORAGE_ITEMS);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(subset));
        } catch (e) {
            logger.warn('SYS', 'Local Storage full. Relying on Cloud Vault.');
        }
        
        // Async Cloud Sync (Push changes to server)
        this.syncToCloudVault(); 
    }

    public async syncToCloudVault() {
        if (!isFirebaseConfigured()) return;
        try {
            const db = getDb();
            if (!db) return;
            
            // Push Shard 0 (Assumption: Single shard for now)
            await setDoc(doc(db, 'admin_secrets', `reddit_pool_shard_0`), {
                updatedAt: new Date().toISOString(),
                count: this.pool.length,
                pool: this.pool
            });
        } catch (e) {
            console.warn("Vault sync push warning", e);
        }
    }

    /**
     * CRITICAL FIX: Reverse Sync (Pull from Cloud)
     * Ensures Client sees the usage updates made by the Server Bot.
     */
    public async pullFromCloudVault() {
        if (!isFirebaseConfigured()) return;
        try {
            const db = getDb();
            if (!db) return;

            const docRef = doc(db, 'admin_secrets', 'reddit_pool_shard_0');
            const snap = await getDoc(docRef);

            if (snap.exists()) {
                const cloudData = snap.data();
                const cloudPool = cloudData.pool as RedditCredential[];
                
                let updatesCount = 0;

                // Merge Logic: Trust Cloud Usage if higher (Bot worked while we were away)
                this.pool = this.pool.map(localCred => {
                    const cloudCred = cloudPool.find(c => c.username === localCred.username);
                    if (cloudCred) {
                        if ((cloudCred.dailyUsage || 0) > (localCred.dailyUsage || 0)) {
                            localCred.dailyUsage = cloudCred.dailyUsage;
                            localCred.lastUsed = Math.max(localCred.lastUsed, cloudCred.lastUsed || 0);
                            updatesCount++;
                        }
                        // Sync Status if Server marked it as Capped
                        if (cloudCred.status === 'DAILY_CAP_REACHED' && localCred.status !== 'DAILY_CAP_REACHED') {
                            localCred.status = 'DAILY_CAP_REACHED';
                        }
                    }
                    return localCred;
                });

                if (updatesCount > 0) {
                    this.savePool(); // Save merged state locally
                    logger.info('SYS', `Synced ${updatesCount} updates from Cloud Bot.`);
                }
            }
        } catch (e) {
            console.warn("Vault sync pull warning", e);
        }
    }

    public importCredentials(csvText: string): number {
        const lines = csvText.split('\n');
        let addedCount = 0;

        lines.forEach(line => {
            const parts = line.split(',').map(s => s.trim());
            if (parts.length >= 4) {
                const [clientId, clientSecret, username, password] = parts;
                
                if (!this.pool.find(p => p.username === username)) {
                    this.addCredential({
                        clientId, clientSecret, username, password
                    }, false); 
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
        
        this.pool.forEach(cred => {
            // 1. Reset Daily Counter if 24 hours passed
            if (now - cred.dayStartTimestamp > this.DAY_MS) {
                cred.dailyUsage = 0;
                cred.dayStartTimestamp = now;
                if (cred.status === 'DAILY_CAP_REACHED') cred.status = 'READY';
                changed = true;
            }

            // 2. Smart Recovery for Rate Limits
            if (cred.status === 'RATE_LIMITED' && cred.cooldownUntil > 0 && cred.cooldownUntil < now) {
                cred.status = 'READY';
                cred.cooldownUntil = 0;
                changed = true;
            }
        });

        if (changed) this.savePool();
        return this.pool;
    }

    public addCredential(cred: Omit<RedditCredential, 'id' | 'usageCount' | 'status' | 'lastUsed' | 'cooldownUntil' | 'dailyUsage' | 'dayStartTimestamp'>, autoSave = true) {
        const newCred: RedditCredential = {
            ...cred,
            id: Math.random().toString(36).substring(7),
            usageCount: 0,
            status: 'READY',
            lastUsed: 0,
            cooldownUntil: 0,
            dailyUsage: 0,
            dayStartTimestamp: Date.now()
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

    // NEW: Remove by username to support clean deletion from Account Manager
    public removeCredentialByUsername(username: string) {
        const cleanName = username.replace('u/', '').trim();
        const initialLen = this.pool.length;
        this.pool = this.pool.filter(c => c.username !== cleanName);
        if (this.pool.length < initialLen) {
            this.savePool();
            logger.warn('SYS', `Security Protocol: Credentials for ${cleanName} destroyed.`);
        }
    }

    /**
     * CORE ALGORITHM: "SEQUENTIAL FILLING" (Updated V5.3 PROD)
     * Strategy:
     * 1. Check if we have an account that started today but isn't full yet.
     * 2. If yes, KEEP USING IT until it hits 100.
     * 3. If no (all active are full/cooling), pick a FRESH account.
     * 4. This creates a chain: A -> A -> ... -> A (Cap) -> B -> B ...
     * 5. V5.3 Update: Uses 'username' for deterministic tie-breaking (Matches Server Bot).
     */
    public getOptimalCredential(): RedditCredential | null {
        // Ensure counters are fresh
        this.getPool(); 
        const now = Date.now();
        
        // Filter: Ready AND Not Capped
        let candidates = this.pool.filter(c => c.status === 'READY' && c.dailyUsage < this.DAILY_POST_LIMIT);

        // Filter: Safety Cooldown (Anti-Spam per account)
        const safeCandidates = candidates.filter(c => (now - c.lastUsed) > this.SAFETY_COOLDOWN_MS);

        if (safeCandidates.length === 0) {
             // Check if it's because of daily limits
             const cappedCount = this.pool.filter(c => c.dailyUsage >= this.DAILY_POST_LIMIT).length;
             if (cappedCount > 0) {
                 logger.error('SYS', `Resource Alert: ${cappedCount} accounts reached daily limit (${this.DAILY_POST_LIMIT}). All active nodes exhausted.`);
             } else {
                 if (candidates.length > 0) {
                     logger.warn('SYS', 'Velocity Warning: Using cooldown backup (All safe nodes exhausted).');
                     // Desperate Fallback
                     candidates.sort((a, b) => a.lastUsed - b.lastUsed);
                     return this.selectAndMark(candidates[0]);
                 }
                 logger.error('SYS', 'CRITICAL: Pool Exhausted. Add more accounts.');
             }
             return null;
        }

        // SEQUENTIAL SORTING LOGIC:
        // 1. Prioritize High Usage (Finish what started)
        // 2. Tie-break with Username (String Comparison) to ensure we always pick "Account_A" over "Account_B" if both are 0 usage.
        // This ensures the Simulation logic in Client matches the Execution logic in Server Bot.
        safeCandidates.sort((a, b) => {
             const usageDiff = (b.dailyUsage || 0) - (a.dailyUsage || 0);
             if (usageDiff !== 0) return usageDiff;
             // Secondary sort: Deterministic Username order
             return (a.username || '').localeCompare(b.username || '');
        });

        const chosen = safeCandidates[0];
        
        return this.selectAndMark(chosen);
    }

    public markUsage(id: string) {
        const cred = this.pool.find(c => c.id === id);
        if (cred) {
            this.selectAndMark(cred);
        }
    }

    private selectAndMark(cred: RedditCredential): RedditCredential {
        cred.lastUsed = Date.now();
        cred.usageCount++;
        cred.dailyUsage++; // Increment Daily Counter

        // Check if cap reached immediately
        if (cred.dailyUsage >= this.DAILY_POST_LIMIT) {
            cred.status = 'DAILY_CAP_REACHED';
            logger.warn('SYS', `Node ${cred.username} reached daily limit (${this.DAILY_POST_LIMIT}). Resting until tomorrow.`);
        }

        this.savePool();
        return cred;
    }

    public markRateLimited(id: string) {
        const cred = this.pool.find(c => c.id === id);
        if (cred) {
            cred.status = 'RATE_LIMITED';
            const variableCooldown = (30 * 60 * 1000) + (Math.random() * 30 * 60 * 1000);
            cred.cooldownUntil = Date.now() + variableCooldown; 
            this.savePool();
            logger.warn('NET', `Anti-Ban Protocol: Node ${cred.username} placed in deep freeze for ${Math.round(variableCooldown/60000)}m.`);
        }
    }

    public markSuccess(id: string) {
        const cred = this.pool.find(c => c.id === id);
        if (cred && cred.status !== 'READY' && cred.status !== 'DAILY_CAP_REACHED') {
            cred.status = 'READY'; 
            this.savePool();
        }
    }

    public performDeepHealthCheck(): string {
        const ready = this.pool.filter(c => c.status === 'READY').length;
        const capped = this.pool.filter(c => c.status === 'DAILY_CAP_REACHED').length;
        return `Pool: ${this.pool.length} | Ready: ${ready} | Resting (Daily Cap): ${capped}`;
    }
}

export const credentialManager = new CredentialManagerService();
