
import { RedditCredential } from '../types';
import { logger } from './logger';
import { getDb, isFirebaseConfigured } from './firebase';
import { doc, setDoc, getDoc } from "firebase/firestore";

const STORAGE_KEY = 'redditops_credential_pool';

/**
 * REDDITOPS GHOST PROTOCOL MANAGER
 * Handles high-volume account rotation with anti-fingerprinting logic.
 */
class CredentialManagerService {
    private pool: RedditCredential[] = [];
    private readonly MAX_LOCAL_STORAGE_ITEMS = 2000; 
    private readonly SAFETY_COOLDOWN_MS = 15 * 60 * 1000;
    private readonly DAILY_POST_LIMIT = 100;
    private readonly DAY_MS = 24 * 60 * 60 * 1000;

    constructor() {
        this.loadPool();
    }

    private sanitize(val: string, fieldName?: string): string {
        if (!val) return '';
        let cleanVal = val.trim().replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '');
        if (fieldName === 'username') {
            cleanVal = cleanVal.replace(/^u\//i, '');
        }
        return cleanVal;
    }

    private autoCorrectEntry(cred: RedditCredential): RedditCredential {
        const clientIDRegex = /^[a-zA-Z0-9_-]{22}$/;
        // Heuristic: If 'username' looks exactly like a ClientID (22 chars) but 'clientId' doesn't, SWAP THEM.
        if (clientIDRegex.test(cred.username) && !clientIDRegex.test(cred.clientId)) {
            logger.warn('SYS', `Auto-Correction: Detected swapped Username/ClientID. Fixing...`);
            const temp = cred.username;
            cred.username = cred.clientId;
            cred.clientId = temp;
        }
        return cred;
    }

    private loadPool() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    this.pool = parsed.map(c => {
                        let cred = {
                            ...c,
                            username: this.sanitize(c.username, 'username'),
                            clientId: this.sanitize(c.clientId),
                            clientSecret: this.sanitize(c.clientSecret),
                            password: this.sanitize(c.password),
                            dailyUsage: c.dailyUsage || 0,
                            dayStartTimestamp: c.dayStartTimestamp || Date.now(),
                            status: c.status === 'DAILY_CAP_REACHED' ? 'READY' : c.status
                        };
                        return this.autoCorrectEntry(cred);
                    });
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
        this.syncToCloudVault(); 
    }

    public async syncToCloudVault() {
        if (!isFirebaseConfigured()) return;
        try {
            const db = getDb();
            if (!db) return;
            await setDoc(doc(db, 'admin_secrets', `reddit_pool_shard_0`), {
                updatedAt: new Date().toISOString(),
                count: this.pool.length,
                pool: this.pool
            });
        } catch (e) {
            console.warn("Vault sync push warning", e);
        }
    }

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

                this.pool = this.pool.map(localCred => {
                    const cloudCred = cloudPool.find(c => c.username === localCred.username);
                    if (cloudCred) {
                        if ((cloudCred.dailyUsage || 0) > (localCred.dailyUsage || 0)) {
                            localCred.dailyUsage = cloudCred.dailyUsage;
                            localCred.lastUsed = Math.max(localCred.lastUsed, cloudCred.lastUsed || 0);
                            updatesCount++;
                        }
                        if (cloudCred.status === 'DAILY_CAP_REACHED' && localCred.status !== 'DAILY_CAP_REACHED') {
                            localCred.status = 'DAILY_CAP_REACHED';
                        }
                    }
                    return localCred;
                });

                if (updatesCount > 0) {
                    this.savePool();
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
            // Filter empty lines
            if (parts.length >= 4) {
                // Strict Header Check: Check if line contains keywords common in headers
                const lowerLine = parts.join('').toLowerCase();
                if (
                    lowerLine.includes('username') || 
                    lowerLine.includes('clientid') || 
                    lowerLine.includes('secret') ||
                    (parts[0].toLowerCase() === 'user' && parts[1].toLowerCase() === 'pass')
                ) {
                    // Skip header row
                    return;
                }

                let rawClientId, clientSecret, rawUsername, password;

                // DETECT FORMAT
                // Format 1: User, Pass, ClientID(22), Secret
                // Format 2: ClientID(22), Secret, User, Pass

                // Check if index 2 is strictly a Client ID (22 chars) AND index 3 is a Secret (usually longer)
                if (parts[2].length === 22 && parts[3].length > 20) {
                     // Format 1 detected (User, Pass, ClientID, Secret)
                     rawUsername = parts[0];
                     password = parts[1];
                     rawClientId = parts[2];
                     clientSecret = parts[3];
                } else {
                     // Assume Format 2 (ClientID, Secret, User, Pass)
                     rawClientId = parts[0];
                     clientSecret = parts[1];
                     rawUsername = parts[2];
                     password = parts[3];
                }
                
                let newCred: any = {
                    clientId: rawClientId,
                    clientSecret: clientSecret,
                    username: rawUsername,
                    password: password
                };

                newCred.username = this.sanitize(newCred.username, 'username');
                newCred.clientId = this.sanitize(newCred.clientId);
                newCred.clientSecret = this.sanitize(newCred.clientSecret);
                newCred.password = this.sanitize(newCred.password);
                
                newCred = this.autoCorrectEntry(newCred as RedditCredential);
                
                // Only add if username looks valid (at least 3 chars) to avoid empty/junk entries
                if (newCred.username && newCred.username.length > 2 && !this.pool.find(p => p.username === newCred.username)) {
                    this.addCredential(newCred, false); 
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
            if (now - cred.dayStartTimestamp > this.DAY_MS) {
                cred.dailyUsage = 0;
                cred.dayStartTimestamp = now;
                if (cred.status === 'DAILY_CAP_REACHED') cred.status = 'READY';
                changed = true;
            }
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
        let sanitizedCred: RedditCredential = {
            ...cred,
            username: this.sanitize(cred.username, 'username'),
            clientId: this.sanitize(cred.clientId, 'clientId'),
            clientSecret: this.sanitize(cred.clientSecret, 'clientSecret'),
            password: this.sanitize(cred.password, 'password'),
            id: Math.random().toString(36).substring(7),
            usageCount: 0,
            status: 'READY',
            lastUsed: 0,
            cooldownUntil: 0,
            dailyUsage: 0,
            dayStartTimestamp: Date.now()
        };

        sanitizedCred = this.autoCorrectEntry(sanitizedCred);

        this.pool.push(sanitizedCred);
        if (autoSave) {
            this.savePool();
            logger.info('SYS', `New Node Added: ${sanitizedCred.username}`);
        }
    }

    public removeCredential(id: string) {
        this.pool = this.pool.filter(c => c.id !== id);
        this.savePool();
    }

    public getOptimalCredential(): RedditCredential | null {
        this.getPool(); 
        const now = Date.now();
        let candidates = this.pool.filter(c => c.status === 'READY' && c.dailyUsage < this.DAILY_POST_LIMIT);
        const safeCandidates = candidates.filter(c => (now - c.lastUsed) > this.SAFETY_COOLDOWN_MS);

        if (safeCandidates.length === 0) {
             const cappedCount = this.pool.filter(c => c.dailyUsage >= this.DAILY_POST_LIMIT).length;
             if (cappedCount > 0) {
                 logger.error('SYS', `Resource Alert: ${cappedCount} accounts reached daily limit.`);
             } else {
                 if (candidates.length > 0) {
                     logger.warn('SYS', 'Velocity Warning: Using cooldown backup.');
                     candidates.sort((a, b) => a.lastUsed - b.lastUsed);
                     return this.selectAndMark(candidates[0]);
                 }
                 logger.error('SYS', 'CRITICAL: Pool Exhausted.');
             }
             return null;
        }

        safeCandidates.sort((a, b) => {
             const usageDiff = (b.dailyUsage || 0) - (a.dailyUsage || 0);
             if (usageDiff !== 0) return usageDiff;
             return (a.username || '').localeCompare(b.username || '');
        });

        return this.selectAndMark(safeCandidates[0]);
    }

    public markUsage(id: string) {
        const cred = this.pool.find(c => c.id === id);
        if (cred) this.selectAndMark(cred);
    }

    private selectAndMark(cred: RedditCredential): RedditCredential {
        cred.lastUsed = Date.now();
        cred.usageCount++;
        cred.dailyUsage++;
        if (cred.dailyUsage >= this.DAILY_POST_LIMIT) {
            cred.status = 'DAILY_CAP_REACHED';
            logger.warn('SYS', `Node ${cred.username} reached daily limit (${this.DAILY_POST_LIMIT}).`);
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
            logger.warn('NET', `Anti-Ban: Node ${cred.username} frozen for ${Math.round(variableCooldown/60000)}m.`);
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
        return `Pool: ${this.pool.length} | Ready: ${ready} | Resting: ${capped}`;
    }
}

export const credentialManager = new CredentialManagerService();
