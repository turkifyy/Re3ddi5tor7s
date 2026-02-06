
import { DatabaseService } from './databaseService';
import { logger } from './logger';
import { RedditComment, RedditSystemHealth } from '../types';
import { credentialManager } from './credentialManager';

const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_URL = 'https://oauth.reddit.com';
const REDDIT_PUBLIC_URL = 'https://www.reddit.com';

// ENTERPRISE PROXY POOL (V7.5 - Optimized)
// TIER 1: AUTH PROXIES (High Reliability, Support POST)
const AUTH_PROXIES = [
    "https://corsproxy.io/?", 
    "https://thingproxy.freeboard.io/fetch/", 
    "https://api.cors.lol/?url="
];

// TIER 2: SCRAPE PROXIES (Rotation for GET requests)
const SCRAPE_PROXIES = [
    "https://api.allorigins.win/raw?url=", 
    "https://corsproxy.io/?",              
    "https://thingproxy.freeboard.io/fetch/",
];

interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

const tokenCache = new Map<string, { token: string, expiry: number }>();

let systemHealth: RedditSystemHealth = {
    globalRateLimit: 600, 
    averageLatency: 0,
    errorRate: 0,
    activeNodes: 0,
    lastSync: Date.now()
};

const humanizeDelay = async (isWriteAction: boolean) => {
    const min = isWriteAction ? 2000 : 500;
    const max = isWriteAction ? 4000 : 1000;
    const jitter = min + Math.random() * (max - min);
    await new Promise(r => setTimeout(r, jitter));
};

// HELPER: Safely parse JSON or return null if response is HTML/Text
const safeJson = async (res: Response) => {
    try {
        const text = await res.text();
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
};

const fetchWithRetry = async (targetUrl: string, options: RequestInit, useAuthProxiesOnly: boolean): Promise<Response> => {
    let lastError: any;
    
    // Shuffle proxies to distribute load
    const pool = useAuthProxiesOnly ? [...AUTH_PROXIES] : [...SCRAPE_PROXIES].sort(() => Math.random() - 0.5);

    for (const proxyBase of pool) {
        try {
            // Smart URL Construction
            const finalUrl = `${proxyBase}${encodeURIComponent(targetUrl)}`;
            
            const response = await fetch(finalUrl, {
                ...options,
            });
            
            const isRateLimited = response.status === 429;
            const isServerError = response.status >= 500;
            const isAuthError = response.status === 401 || response.status === 403;
            
            // Success Case
            if (response.ok) return response;

            // Handle specific failures
            if (isRateLimited) {
                logger.warn('NET', `Proxy Rate Limited (429). Switching tunnel...`);
                continue; 
            }

            if (isServerError) {
                // Silent continue on 5xx errors from proxy
                continue;
            }

            // If it's a client error (e.g., 404 Not Found), return it immediately, don't retry
            if (response.status >= 400 && response.status < 500 && !isAuthError) {
                return response;
            }

        } catch (err: any) {
            // Network failures (offline, CORS block)
            lastError = err;
        }
    }

    logger.error('NET', 'All proxy tunnels failed. Connection degraded.');
    throw lastError || new Error("Network Grid Down");
};

export const RedditService = {
    
    async authenticate(credId: string): Promise<string> {
        const cred = credentialManager.getPool().find(c => c.id === credId);
        if (!cred) throw new Error("Credential not found in pool.");

        const cached = tokenCache.get(credId);
        if (cached && Date.now() < cached.expiry) {
            return cached.token;
        }

        const username = cred.username.trim();
        const password = cred.password.trim();
        const clientId = cred.clientId.trim();
        const clientSecret = cred.clientSecret.trim();

        const basicAuth = btoa(`${clientId}:${clientSecret}`);
        
        const formData = new URLSearchParams();
        formData.append('grant_type', 'password');
        formData.append('username', username);
        formData.append('password', password);
        formData.append('scope', '*'); 

        const start = performance.now();

        try {
            const response = await fetchWithRetry(REDDIT_AUTH_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${basicAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            }, true);

            const latency = performance.now() - start;
            this.updateLatency(latency);
            logger.trackActivity(latency);

            if (!response.ok) {
                this.recordError();
                let errMsg = `HTTP ${response.status}`;
                try {
                     const errJson = await safeJson(response);
                     if(errJson && errJson.error) errMsg = errJson.error;
                } catch(e) {}

                logger.error('REDDIT', `Auth Failed for ${username}: ${errMsg}`);
                
                if (response.status === 401) throw new Error(`AUTH_FAIL: Check Password`);
                throw new Error(errMsg);
            }

            const data = await safeJson(response);
            
            if (data && data.access_token) {
                tokenCache.set(credId, {
                    token: data.access_token,
                    expiry: Date.now() + (data.expires_in * 1000) - 60000
                });
                return data.access_token;
            } else {
                throw new Error("No access token returned (Proxy might have blocked response).");
            }

        } catch (error: any) {
            throw error;
        }
    },

    async verifyCredential(credId: string): Promise<boolean> {
        try {
            tokenCache.delete(credId);
            await this.authenticate(credId);
            return true;
        } catch (e) {
            return false;
        }
    },

    updateLatency(ms: number) {
        systemHealth.averageLatency = (systemHealth.averageLatency * 0.7) + (ms * 0.3);
        systemHealth.lastSync = Date.now();
    },

    updateRateLimits(headers: Headers) {
        const remaining = headers.get('x-ratelimit-remaining');
        if (remaining) {
            systemHealth.globalRateLimit = parseFloat(remaining);
        }
    },

    recordError() {
        systemHealth.errorRate = Math.min(100, systemHealth.errorRate + 5); 
    },

    getSystemHealth(): RedditSystemHealth {
        systemHealth.errorRate = Math.max(0, systemHealth.errorRate - 0.1);
        systemHealth.activeNodes = credentialManager.getPool().filter(c => c.status === 'READY').length;
        return { ...systemHealth };
    },

    async executeCall<T>(
        operationName: string, 
        apiCall: (token: string, agent: string) => Promise<Response>, 
        specificCredId?: string,
        isWriteAction: boolean = false
    ): Promise<T> {
        let cred;
        
        if (specificCredId) {
            cred = credentialManager.getPool().find(c => c.id === specificCredId);
            if (!cred) throw new Error("Account not found");
        } else {
            cred = credentialManager.getOptimalCredential();
        }
            
        if (!cred) throw new Error("No available accounts.");

        try {
            await humanizeDelay(isWriteAction);
            const token = await this.authenticate(cred.id);
            const userAgent = `web:redditops:v6.0.0 (by /u/${cred.username})`;
            
            const start = performance.now();
            const response = await apiCall(token, userAgent);
            const latency = performance.now() - start;
            this.updateLatency(latency);
            this.updateRateLimits(response.headers);
            logger.trackActivity(latency); 

            if (response.status === 429) {
                credentialManager.markRateLimited(cred.id);
                this.recordError();
                throw new Error("RATE_LIMIT");
            }

            if (response.status === 401) {
                tokenCache.delete(cred.id);
                throw new Error("AUTH_FAIL");
            }

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            credentialManager.markSuccess(cred.id);
            const json = await safeJson(response);
            if (!json) throw new Error("Invalid JSON response from Reddit API");
            
            return json as T;

        } catch (e: any) {
            throw e;
        }
    },

    async fetchSubredditPosts(subreddit: string, sort: 'hot' | 'new' | 'top' = 'hot', limit = 25, timeframe = 'all', signal?: AbortSignal): Promise<any[]> {
        let allPosts: any[] = [];
        let afterToken = null;
        let remaining = limit;
        const cleanSub = subreddit.replace('r/', '').trim();
        
        try {
            while (remaining > 0) {
                if (signal?.aborted) throw new Error("ABORTED");

                const currentBatchLimit = Math.min(100, remaining);
                
                let url = `${REDDIT_PUBLIC_URL}/r/${cleanSub}/${sort}.json?limit=${currentBatchLimit}&t=${timeframe}`;
                if (afterToken) url += `&after=${afterToken}`;

                // Critical Fix: Pass headers to mimic browser
                const response = await fetchWithRetry(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json'
                    },
                    signal
                }, false);

                if (!response.ok) throw new Error(`Scrape Failed: ${response.status}`);
                
                // Safe handling of malformed JSON from proxies
                const data = await safeJson(response);

                if (!data || !data.data || !data.data.children) {
                     logger.warn('SCRAPER', `Empty data structure from r/${cleanSub} (or blocked by proxy)`);
                     break;
                }

                const children = data.data.children;
                if (children.length === 0) break;

                const mapped = children.map((c: any) => c.data);
                allPosts = [...allPosts, ...mapped];
                
                afterToken = data.data.after;
                remaining -= mapped.length;

                if (!afterToken) break;
            }
            return allPosts;

        } catch (error: any) {
            if (error.message === 'ABORTED' || error.name === 'AbortError') return allPosts;
            logger.error('SCRAPER', `Failed to scrape r/${cleanSub}: ${error.message}`);
            // Return whatever we found instead of throwing, so UI shows partial results
            return allPosts;
        }
    },

    async fetchPostComments(postId: string, limit = 50, signal?: AbortSignal): Promise<any[]> {
        try {
             const cleanId = postId.replace('t3_', '');
             const url = `${REDDIT_PUBLIC_URL}/comments/${cleanId}.json?limit=${limit}&depth=1&sort=new`;
             
             const response = await fetchWithRetry(url, {
                 method: 'GET',
                 headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                 },
                 signal
             }, false);

             const data = await safeJson(response);
             return data?.[1]?.data?.children?.map((c: any) => c.data) || [];
        } catch (error) {
             logger.warn('SCRAPER', `Comment fetch failed for ${postId}`);
             return [];
        }
    },

    async getInbox(credId?: string): Promise<RedditComment[]> {
        try {
            const data: any = await this.executeCall('GetInbox', (token, agent) => 
                fetchWithRetry(`${REDDIT_API_URL}/message/inbox?limit=10`, {
                    headers: { 'Authorization': `bearer ${token}` }
                }, true), 
                credId,
                false 
            );

            if (!data?.data?.children) return [];

            return data.data.children.map((child: any) => ({
                id: child.data.name, 
                author: child.data.author,
                body: child.data.body || child.data.subject || 'No Content',
                subreddit: child.data.subreddit_name_prefixed || 'r/Private',
                postTitle: child.data.link_title || child.data.subject || 'Direct Message',
                permalink: child.data.context || '#',
                createdUtc: child.data.created_utc,
                isReplied: !!child.data.likes,
                sentiment: 'Neutral'
            }));

        } catch (error) {
            throw error;
        }
    },

    async postReply(thingId: string, text: string, recipient: string, credId?: string): Promise<boolean> {
        try {
            const data: any = await this.executeCall('PostReply', (token, agent) => {
                const formData = new URLSearchParams();
                formData.append('api_type', 'json');
                formData.append('text', text);
                formData.append('thing_id', thingId);

                return fetchWithRetry(`${REDDIT_API_URL}/api/comment`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `bearer ${token}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData
                }, true); 
            }, credId, true);

            if (data.json?.errors?.length > 0) throw new Error(data.json.errors[0][1]);
            
            logger.success('REDDIT', `Reply deployed to ${recipient}`);
            await DatabaseService.deployCampaignContent('direct_reply', text, `${recipient} (ID: ${thingId})`);
            return true;

        } catch (error) {
            logger.error('REDDIT', `Reply Failed: ${(error as Error).message}`);
            throw error;
        }
    }
};
