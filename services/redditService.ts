
import { DatabaseService } from './databaseService';
import { logger } from './logger';
import { RedditComment } from '../types';
import { credentialManager } from './credentialManager';

const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_URL = 'https://oauth.reddit.com';

interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

// Memory Cache for Tokens: Map<CredentialID, Token>
const tokenCache = new Map<string, { token: string, expiry: number }>();

export const RedditService = {
    
    /**
     * Authenticates using a specific credential from the pool.
     */
    async authenticate(credId: string): Promise<string> {
        const cred = credentialManager.getPool().find(c => c.id === credId);
        if (!cred) throw new Error("Credential not found in pool.");

        // Check Cache
        const cached = tokenCache.get(credId);
        if (cached && Date.now() < cached.expiry) {
            return cached.token;
        }

        const credentials = btoa(`${cred.clientId}:${cred.clientSecret}`);
        const formData = new URLSearchParams();
        formData.append('grant_type', 'password');
        formData.append('username', cred.username);
        formData.append('password', cred.password);

        try {
            const response = await fetch(REDDIT_AUTH_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    // IMPROVED USER AGENT TO AVOID BANS
                    'User-Agent': `web:redditops-platinum:v4.5 (by /u/${cred.username})`
                },
                body: formData
            });

            if (response.status === 429) {
                throw new Error("RATE_LIMIT");
            }
            if (response.status === 401) {
                throw new Error("AUTH_FAIL"); 
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Auth Error: ${errText}`);
            }

            const data: TokenResponse = await response.json();
            
            if (data.access_token) {
                // Cache it
                tokenCache.set(credId, {
                    token: data.access_token,
                    expiry: Date.now() + (data.expires_in * 1000) - 60000
                });
                return data.access_token;
            } else {
                throw new Error("No access token returned.");
            }

        } catch (error) {
            throw error;
        }
    },

    /**
     * Helper to verify a key manually from Settings
     */
    async verifyCredential(credId: string): Promise<boolean> {
        try {
            // Force bypass cache to test real auth
            tokenCache.delete(credId);
            await this.authenticate(credId);
            return true;
        } catch (e) {
            console.error("Verification failed:", e);
            return false;
        }
    },

    /**
     * Generic Wrapper to execute API calls with Rotation Logic
     */
    async executeRotatedCall<T>(operationName: string, apiCall: (token: string) => Promise<Response>): Promise<T> {
        const maxRetries = 5; // We have a pool, so we can retry multiple times
        let attempts = 0;

        while (attempts < maxRetries) {
            const cred = credentialManager.getOptimalCredential();
            
            if (!cred) {
                throw new Error("All API Keys are currently exhausted/rate-limited. System Halted.");
            }

            try {
                logger.info('REDDIT', `Node [${cred.id.substring(0,4)}] executing ${operationName}...`);
                const token = await this.authenticate(cred.id);
                
                const response = await apiCall(token);

                // Handle Rate Limits (429)
                if (response.status === 429) {
                    logger.warn('REDDIT', `Rate Limit Hit on Node ${cred.id}. Rotating...`);
                    credentialManager.markRateLimited(cred.id);
                    attempts++;
                    continue; // Loop again to get a new credential
                }

                // Handle Auth Errors (401/403) - Maybe password changed or app revoked
                if (response.status === 401 || response.status === 403) {
                     logger.warn('REDDIT', `Auth Error on Node ${cred.id}. Marking exhausted.`);
                     credentialManager.markRateLimited(cred.id); // Or mark bad
                     attempts++;
                     continue;
                }

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status}`);
                }

                credentialManager.markSuccess(cred.id);
                const json = await response.json();
                return json as T;

            } catch (e: any) {
                if (e.message === "AUTH_FAIL" || e.message === "RATE_LIMIT") {
                    credentialManager.markRateLimited(cred.id);
                    attempts++;
                    continue;
                }
                throw e; // Real error (network, parsing, etc)
            }
        }

        throw new Error("Max retries reached. Operation failed across multiple nodes.");
    },

    /**
     * Real API Call: Get Inbox
     */
    async getInbox(): Promise<RedditComment[]> {
        try {
            const data: any = await this.executeRotatedCall('GetInbox', (token) => 
                fetch(`${REDDIT_API_URL}/message/inbox?limit=10`, {
                    headers: {
                        'Authorization': `bearer ${token}`,
                        'User-Agent': 'web:redditops-platinum:v4.5'
                    }
                })
            );

            if (!data.data || !data.data.children) return [];

            // Map Reddit JSON to our Interface
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
            logger.error('REDDIT', `Inbox Fetch Failed: ${(error as Error).message}`);
            throw error;
        }
    },

    /**
     * Real API Call: Post Comment Reply
     */
    async postReply(thingId: string, text: string, recipient: string): Promise<boolean> {
        try {
            const data: any = await this.executeRotatedCall('PostReply', (token) => {
                const formData = new URLSearchParams();
                formData.append('api_type', 'json');
                formData.append('text', text);
                formData.append('thing_id', thingId);

                return fetch(`${REDDIT_API_URL}/api/comment`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `bearer ${token}`,
                        'User-Agent': 'web:redditops-platinum:v4.5',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData
                });
            });

            if (data.json && data.json.errors && data.json.errors.length > 0) {
                throw new Error(`Reddit API Error: ${data.json.errors[0][1]}`);
            }

            logger.success('REDDIT', `Reply deployed successfully.`);
            
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
