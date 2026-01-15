
import { DatabaseService } from './databaseService';
import { logger } from './logger';
import { RedditComment, RedditSystemHealth } from '../types';
import { credentialManager } from './credentialManager';

const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_URL = 'https://oauth.reddit.com';

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

// Helper: Simulate human behavior (Jitter)
// PRODUCTION SETTING: Adaptive delay based on action type
const humanizeDelay = async (isWriteAction: boolean) => {
    // Write Action (Post/Comment): 2s - 4s (Safety First)
    // Read Action (Scrape/Inbox): 200ms - 800ms (Speed First)
    const min = isWriteAction ? 2000 : 200;
    const max = isWriteAction ? 4000 : 800;
    const jitter = min + Math.random() * (max - min);
    await new Promise(r => setTimeout(r, jitter));
};

// Helper: Production User Agent
const getRandomUserAgent = (username: string) => {
    return `web:redditops-platinum:v5.0.0-release (by /u/${username})`;
};

// Helper: Retry Logic for Production Stability
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> => {
    try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        if (retries > 0 && (response.status === 503 || response.status === 504 || response.status === 502)) {
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        return response;
    } catch (err) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw err;
    }
};

export const RedditService = {
    
    async authenticate(credId: string): Promise<string> {
        const cred = credentialManager.getPool().find(c => c.id === credId);
        if (!cred) throw new Error("Credential not found in pool.");

        const cached = tokenCache.get(credId);
        if (cached && Date.now() < cached.expiry) {
            return cached.token;
        }

        const credentials = btoa(`${cred.clientId}:${cred.clientSecret}`);
        const formData = new URLSearchParams();
        formData.append('grant_type', 'password');
        formData.append('username', cred.username);
        formData.append('password', cred.password);

        const start = performance.now();

        try {
            const response = await fetchWithRetry(REDDIT_AUTH_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': getRandomUserAgent(cred.username)
                },
                body: formData
            });

            const latency = performance.now() - start;
            this.updateLatency(latency);
            logger.trackActivity(latency);

            if (response.status === 429) {
                this.recordError();
                throw new Error("RATE_LIMIT");
            }
            if (response.status === 401) {
                this.recordError();
                throw new Error("AUTH_FAIL"); 
            }

            if (!response.ok) {
                this.recordError();
                const errText = await response.text();
                throw new Error(`Auth Error: ${errText}`);
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
            if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
                const msg = "Network/CORS Error: المتصفح حجب الاتصال. يرجى تثبيت إضافة 'Allow CORS' أو تشغيل النظام عبر خادم وكيل.";
                logger.error('NET', msg);
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
            credentialManager.markUsage(cred.id);
        } else {
            cred = credentialManager.getOptimalCredential();
        }
            
        if (!cred) {
            throw new Error("All API Keys are currently exhausted/rate-limited. System Halted.");
        }

        try {
            await humanizeDelay(isWriteAction);

            const token = await this.authenticate(cred.id);
            const userAgent = getRandomUserAgent(cred.username);
            
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
                    logger.warn('REDDIT', `Auth Error on Node ${cred.id}.`);
                    credentialManager.markRateLimited(cred.id);
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

    // --- SCRAPER ENGINE METHODS ---

    /**
     * Fetch raw posts with Pagination Logic and Abort Signal support
     */
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
                        headers: { 'Authorization': `bearer ${token}`, 'User-Agent': agent },
                        signal // Pass the abort signal to the fetch
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
                return allPosts; // Return what we have so far
            }
            logger.error('SCRAPER', `Failed to fetch posts from r/${subreddit}`);
            throw error;
        }
    },

    /**
     * Deep Scan: Expand comments for a specific post
     */
    async fetchPostComments(postId: string, limit = 50, signal?: AbortSignal): Promise<any[]> {
        try {
             const data: any = await this.executeCall('ScrapeComments', (token, agent) => 
                fetchWithRetry(`${REDDIT_API_URL}/comments/${postId.replace('t3_', '')}?limit=${limit}&depth=2`, {
                    headers: { 'Authorization': `bearer ${token}`, 'User-Agent': agent },
                    signal
                }),
                undefined,
                false // Read Action
            );
            
            if (Array.isArray(data) && data.length > 1) {
                return data[1]?.data?.children?.map((c: any) => c.data) || [];
            }
            return [];
        } catch (error) {
             // Silently fail for individual comment threads to not stop the whole batch
             return [];
        }
    },

    async getInbox(credId?: string): Promise<RedditComment[]> {
        try {
            const data: any = await this.executeCall('GetInbox', (token, agent) => 
                fetchWithRetry(`${REDDIT_API_URL}/message/inbox?limit=10`, {
                    headers: {
                        'Authorization': `bearer ${token}`,
                        'User-Agent': agent
                    }
                }), 
                credId,
                false // Read Action
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

                return fetch(`${REDDIT_API_URL}/api/comment`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `bearer ${token}`,
                        'User-Agent': agent,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData
                });
            }, credId, true); // Write Action (High Safety Delay)

            if (data.json && data.json.errors && data.json.errors.length > 0) {
                throw new Error(`Reddit API Error: ${data.json.errors[0][1]}`);
            }

            logger.success('REDDIT', `Ghost Protocol: Reply deployed safely via rotated node.`);
            
            await DatabaseService.deployCampaignContent(
                'direct_reply',
                text,
                `${recipient} (ID: ${thingId})`
            );

            return true;

        } catch (error) {
            logger.error('REDDIT', `Reply Failed: ${(error as Error).message}`);
            throw error;
        }
    }
};
