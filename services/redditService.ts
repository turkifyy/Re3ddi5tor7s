
import { DatabaseService } from './databaseService';
import { logger } from './logger';
import { RedditComment, RedditSystemHealth } from '../types';
import { credentialManager } from './credentialManager';

const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_URL = 'https://oauth.reddit.com';

// ENTERPRISE PROXY POOL (Optimized V6.4)
const PROXY_POOL = [
    "https://api.cors.lol/?url=",
    "https://corsproxy.io/?",
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
    const min = isWriteAction ? 2000 : 200;
    const max = isWriteAction ? 4000 : 500;
    const jitter = min + Math.random() * (max - min);
    await new Promise(r => setTimeout(r, jitter));
};

const fetchWithRetry = async (targetUrl: string, options: RequestInit): Promise<Response> => {
    let lastError: any;

    if (options.headers) {
        // NOTE: Proxies like corsproxy.io will BLOCK requests if a browser User-Agent is present in headers.
        // We delete it here so the Proxy sees a clean request.
        // @ts-ignore
        delete options.headers['User-Agent'];
    }

    for (const proxyBase of PROXY_POOL) {
        try {
            const finalUrl = `${proxyBase}${encodeURIComponent(targetUrl)}`;
            
            const response = await fetch(finalUrl, {
                ...options,
                cache: 'no-store'
            });
            
            const isRateLimited = response.status === 429 || response.status === 403;
            
            if (response.ok || (response.status >= 400 && response.status < 500 && !isRateLimited)) {
                return response;
            }

            if (response.status >= 500 || isRateLimited) {
                logger.warn('NET', `Proxy Tunnel ${new URL(proxyBase).hostname} unstable (${response.status}). Rerouting...`);
                continue;
            }

            return response;

        } catch (err: any) {
            logger.warn('NET', `Proxy Tunnel ${new URL(proxyBase).hostname} unreachable. Rerouting...`);
            lastError = err;
        }
    }

    logger.error('NET', 'CRITICAL: All proxy tunnels collapsed. Internet connectivity issue?');
    throw lastError || new Error("Multi-Tunnel Failure");
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

        // Basic Auth: ClientID:ClientSecret
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
            });

            const latency = performance.now() - start;
            this.updateLatency(latency);
            logger.trackActivity(latency);

            if (!response.ok) {
                this.recordError();
                let errMsg = `HTTP ${response.status}`;
                
                try {
                    const errData = await response.json();
                    if (errData.error) errMsg += `: ${errData.error}`;
                } catch(e) { }

                logger.error('REDDIT', `Auth Failed for ${username}: ${errMsg}`);

                if (response.status === 401) {
                    if (username.length === 22 && clientId.length < 20) {
                        logger.error('SYS', `CONFIGURATION ERROR: Swapped User/ClientID detected.`);
                        throw new Error(`AUTH_FAIL: Credentials Swapped? Username '${username}' looks like a Client ID.`);
                    }
                    throw new Error(`AUTH_FAIL: Reddit refused credentials. Check User/Pass.`);
                }
                if (response.status === 429) throw new Error("RATE_LIMIT: Too Many Requests");
                
                throw new Error(errMsg);
            }

            const data: TokenResponse = await response.json();
            
            if (data.access_token) {
                tokenCache.set(credId, {
                    token: data.access_token,
                    expiry: Date.now() + (data.expires_in * 1000) - 60000
                });
                return data.access_token;
            } else {
                this.recordError();
                throw new Error("No access token returned.");
            }

        } catch (error: any) {
            if (error.message === 'Multi-Tunnel Failure') {
                const msg = "Network/Proxy Error: Unable to reach Reddit via any tunnel.";
                throw new Error(msg);
            }
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
            if (!cred) throw new Error("Selected Linked Account is not available.");
            if (isWriteAction && (cred.status === 'DAILY_CAP_REACHED' || cred.status === 'RATE_LIMITED')) {
                throw new Error(`SAFETY BLOCK: Account ${cred.username} is ${cred.status}. Action prevented.`);
            }
            credentialManager.markUsage(cred.id);
        } else {
            cred = credentialManager.getOptimalCredential();
        }
            
        if (!cred) {
            throw new Error("All API Keys are currently exhausted or rate-limited. System Halted.");
        }

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
                logger.warn('REDDIT', `Rate Limit Hit on Node ${cred.id}.`);
                credentialManager.markRateLimited(cred.id);
                this.recordError();
                throw new Error("RATE_LIMIT");
            }

            if (response.status === 401 || response.status === 403) {
                    logger.warn('REDDIT', `Auth Error on Node ${cred.id}. Re-authenticating...`);
                    tokenCache.delete(cred.id); 
                    this.recordError();
                    throw new Error("AUTH_FAIL");
            }

            if (!response.ok) {
                this.recordError();
                throw new Error(`API Error: ${response.status}`);
            }

            credentialManager.markSuccess(cred.id);
            const json = await response.json();
            return json as T;

        } catch (e: any) {
            throw e;
        }
    },

    async fetchSubredditPosts(subreddit: string, sort: 'hot' | 'new' | 'top' = 'hot', limit = 25, timeframe = 'all', signal?: AbortSignal): Promise<any[]> {
        let allPosts: any[] = [];
        let afterToken = null;
        let remaining = limit;
        
        try {
            while (remaining > 0) {
                if (signal?.aborted) throw new Error("ABORTED");

                const currentBatchLimit = Math.min(100, remaining);
                let url = `${REDDIT_API_URL}/r/${subreddit}/${sort}?limit=${currentBatchLimit}&t=${timeframe}`;
                if (afterToken) url += `&after=${afterToken}`;

                const data: any = await this.executeCall('ScrapePostsBatch', (token, agent) => 
                    fetchWithRetry(url, {
                        headers: { 'Authorization': `bearer ${token}` },
                        signal
                    }),
                    undefined,
                    false
                );

                const children = data?.data?.children || [];
                if (children.length === 0) break;

                const mapped = children.map((c: any) => c.data);
                allPosts = [...allPosts, ...mapped];
                
                afterToken = data?.data?.after;
                remaining -= mapped.length;

                if (!afterToken) break;
            }
            return allPosts;

        } catch (error: any) {
            if (error.message === 'ABORTED' || error.name === 'AbortError') {
                logger.info('SCRAPER', `Operation aborted by user for r/${subreddit}`);
                return allPosts; 
            }
            logger.error('SCRAPER', `Failed to fetch posts from r/${subreddit}`);
            throw error;
        }
    },

    async fetchPostComments(postId: string, limit = 50, signal?: AbortSignal): Promise<any[]> {
        try {
             const safeLimit = Math.min(limit, 50);
             const cleanId = postId.replace('t3_', '');

             const data: any = await this.executeCall('ScrapeComments', (token, agent) => 
                fetchWithRetry(`${REDDIT_API_URL}/comments/${cleanId}?limit=${safeLimit}&depth=1&sort=new`, {
                    headers: { 'Authorization': `bearer ${token}` },
                    signal
                }),
                undefined,
                false 
            );
            
            if (Array.isArray(data) && data.length > 1) {
                return data[1]?.data?.children?.map((c: any) => c.data) || [];
            }
            return [];
        } catch (error) {
             return [];
        }
    },

    async getInbox(credId?: string): Promise<RedditComment[]> {
        try {
            const data: any = await this.executeCall('GetInbox', (token, agent) => 
                fetchWithRetry(`${REDDIT_API_URL}/message/inbox?limit=10`, {
                    headers: { 'Authorization': `bearer ${token}` }
                }), 
                credId,
                false 
            );

            if (!data?.data || !data.data.children) return [];

            const mappedComments: RedditComment[] = data.data.children.map((child: any) => {
                const item = child.data;
                return {
                    id: item.name, 
                    author: item.author,
                    body: item.body || item.subject || 'No Content',
                    subreddit: item.subreddit_name_prefixed || 'r/Private',
                    postTitle: item.link_title || item.subject || 'Direct Message',
                    permalink: item.context || '#',
                    createdUtc: item.created_utc,
                    isReplied: !!item.likes,
                    sentiment: 'Neutral'
                };
            });
            return mappedComments;

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
                });
            }, credId, true);

            if (data.json && data.json.errors && data.json.errors.length > 0) {
                throw new Error(`Reddit API Error: ${data.json.errors[0][1]}`);
            }

            logger.success('REDDIT', `Action Completed: Reply deployed.`);
            await DatabaseService.deployCampaignContent('direct_reply', text, `${recipient} (ID: ${thingId})`);
            return true;

        } catch (error) {
            logger.error('REDDIT', `Reply Failed: ${(error as Error).message}`);
            throw error;
        }
    }
};
