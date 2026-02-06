
import { RedditCredential } from '../types';
import { logger } from './logger';
import { getDb, isFirebaseConfigured } from './firebase';
import { doc, setDoc, getDoc } from "firebase/firestore";

const STORAGE_KEY = 'redditops_credential_pool';

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
        if (clientIDRegex.test(cred.username) && !clientIDRegex.test(cred.clientId)) {
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
                }
            }
        } catch (e) {
            // Fail safe: If storage is corrupted (JSON parse error), clear it to prevent app crash loop
            console.warn("Credential Manager: Corrupted storage detected. Resetting pool.", e);
            localStorage.removeItem(STORAGE_KEY);
            this.pool = [];
        }
    }

    private savePool() {
        try {
            const subset = this.pool.slice(0, this.MAX_LOCAL_STORAGE_ITEMS);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(subset));
            this.syncToCloudVault(); 
        } catch (e) {
            console.warn("Credential Manager: Failed to save to storage", e);
        }
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
        } catch (e) {}
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
                
                this.pool = this.pool.map(localCred => {
                    const cloudCred = cloudPool.find(c => c.username === localCred.username);
                    if (cloudCred) {
                        if ((cloudCred.dailyUsage || 0) > (localCred.dailyUsage || 0)) {
                            localCred.dailyUsage = cloudCred.dailyUsage;
                            localCred.lastUsed = Math.max(localCred.lastUsed, cloudCred.lastUsed || 0);
                        }
                    }
                    return localCred;
                });
                this.savePool();
            }
        } catch (e) {}
    }

    public importCredentials(csvText: string): number {
        const lines = csvText.split('\n');
        let addedCount = 0;

        lines.forEach(line => {
            const parts = line.split(',').map(s => s.trim());
            
            if (parts.length >= 4) {
                // ROBUST HEADER CHECK
                const lineLower = parts.join('').toLowerCase();
                if (
                    (lineLower.includes('username') && lineLower.includes('client')) ||
                    (lineLower.includes('user') && lineLower.includes('pass') && lineLower.includes('id'))
                ) {
                    return; 
                }

                let rawClientId, clientSecret, rawUsername, password;

                if (parts[2].length === 22 && parts[3].length > 20) {
                     rawUsername = parts[0];
                     password = parts[1];
                     rawClientId = parts[2];
                     clientSecret = parts[3];
                } else {
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
                
                if (newCred.username && newCred.username.length > 2 && newCred.clientId.length > 5 && !this.pool.find(p => p.username === newCred.username)) {
                    this.addCredential(newCred, false); 
                    addedCount++;
                }
            }
        });

        this.savePool();
        logger.success('SYS', `Imported ${addedCount} identities.`);
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
        if (autoSave) this.savePool();
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
                 logger.error('SYS', `Resources Low: ${cappedCount} accounts maxed daily.`);
             } else if (candidates.length > 0) {
                 logger.warn('SYS', 'Using backup (cooldown skip).');
                 candidates.sort((a, b) => a.lastUsed - b.lastUsed);
                 return this.selectAndMark(candidates[0]);
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
        }
        this.savePool();
        return cred;
    }

    public markRateLimited(id: string) {
        const cred = this.pool.find(c => c.id === id);
        if (cred) {
            cred.status = 'RATE_LIMITED';
            cred.cooldownUntil = Date.now() + (30 * 60 * 1000); 
            this.savePool();
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
        return `Pool: ${this.pool.length} | Ready: ${ready}`;
    }
}

export const credentialManager = new CredentialManagerService();
