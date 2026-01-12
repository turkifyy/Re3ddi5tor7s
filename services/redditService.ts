
import { DatabaseService } from './databaseService';
import { logger } from './logger';
import { RedditComment } from '../types';

/**
 * PRODUCTION REDDIT SERVICE
 * Handles Real Authentication and API Calls.
 * NOTE: Requires a "Script" type app on Reddit for username/password flow.
 */

const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_URL = 'https://oauth.reddit.com';

interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

// Internal token storage
let currentToken: string | null = null;
let tokenExpiry: number = 0;

export const RedditService = {
    
    /**
     * Authenticates with Reddit to get a Bearer Token.
     * Uses the "Password Grant" flow suitable for scripts/bots.
     */
    async authenticate(): Promise<string> {
        // Check if current token is valid
        if (currentToken && Date.now() < tokenExpiry) {
            return currentToken;
        }

        const clientId = localStorage.getItem('redditops_r_client');
        const clientSecret = localStorage.getItem('redditops_r_secret');
        const username = localStorage.getItem('redditops_r_username');
        const password = localStorage.getItem('redditops_r_password');

        if (!clientId || !clientSecret || !username || !password) {
            throw new Error("بيانات Reddit مفقودة. يرجى الذهاب للإعدادات وتعبئة بيانات Bot.");
        }

        logger.info('REDDIT', `Authenticating as u/${username}...`);

        const credentials = btoa(`${clientId}:${clientSecret}`);
        const formData = new URLSearchParams();
        formData.append('grant_type', 'password');
        formData.append('username', username);
        formData.append('password', password);

        try {
            const response = await fetch(REDDIT_AUTH_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': `web:redditops-platinum:v4.5 (by /u/${username})`
                },
                body: formData
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Auth Failed: ${response.status} - ${errText}`);
            }

            const data: TokenResponse = await response.json();
            
            if (data.access_token) {
                currentToken = data.access_token;
                // Expire 1 minute before actual expiry to be safe
                tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
                logger.success('REDDIT', 'Authentication Successful. Secure Link Established.');
                return currentToken;
            } else {
                throw new Error("No access token returned.");
            }

        } catch (error) {
            logger.error('REDDIT', `Authentication Critical Failure: ${(error as Error).message}`);
            throw error;
        }
    },

    /**
     * Real API Call: Get Inbox
     */
    async getInbox(): Promise<RedditComment[]> {
        try {
            const token = await this.authenticate();
            logger.info('REDDIT', 'Fetching Inbox from Live API...');

            const response = await fetch(`${REDDIT_API_URL}/message/inbox?limit=10`, {
                headers: {
                    'Authorization': `bearer ${token}`,
                    'User-Agent': 'web:redditops-platinum:v4.5'
                }
            });

            if (!response.ok) {
                if (response.status === 403) throw new Error("Access Denied (403). Check account scopes.");
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            
            // Map Reddit JSON to our Interface
            const mappedComments: RedditComment[] = data.data.children.map((child: any) => {
                const item = child.data;
                return {
                    id: item.name, // e.g., t1_xxxx
                    author: item.author,
                    body: item.body || item.subject || 'No Content',
                    subreddit: item.subreddit_name_prefixed || 'r/Private',
                    postTitle: item.link_title || item.subject || 'Direct Message',
                    permalink: item.context || '#',
                    createdUtc: item.created_utc,
                    isReplied: !!item.likes, // Heuristic: we often upvote our own replies
                    sentiment: 'Neutral' // Real sentiment requires AI analysis pass
                };
            });

            return mappedComments;

        } catch (error) {
            logger.error('REDDIT', `Inbox Fetch Failed: ${(error as Error).message}`);
            // Return empty array to not break UI, but toast handles error
            throw error;
        }
    },

    /**
     * Real API Call: Post Comment Reply
     */
    async postReply(thingId: string, text: string, recipient: string): Promise<boolean> {
        try {
            const token = await this.authenticate();
            logger.info('REDDIT', `Posting reply to ${thingId}...`);

            const formData = new URLSearchParams();
            formData.append('api_type', 'json');
            formData.append('text', text);
            formData.append('thing_id', thingId);

            const response = await fetch(`${REDDIT_API_URL}/api/comment`, {
                method: 'POST',
                headers: {
                    'Authorization': `bearer ${token}`,
                    'User-Agent': 'web:redditops-platinum:v4.5',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            const data = await response.json();

            // Reddit returns 200 even on some logical errors, check json.errors
            if (data.json && data.json.errors && data.json.errors.length > 0) {
                throw new Error(`Reddit API Error: ${data.json.errors[0][1]}`);
            }

            logger.success('REDDIT', `Reply deployed successfully.`);
            
            // Archive to Firestore for record keeping
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
