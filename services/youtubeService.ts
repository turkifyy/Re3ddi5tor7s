
import { logger } from './logger';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// HELPER: Fetch with Timeout & Retry Strategy
const fetchWithRobustness = async (url: string, options: RequestInit = {}, retries = 3, timeout = 15000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        
        // Retry on 5xx server errors
        if (response.status >= 500 && retries > 0) {
            logger.warn('YOUTUBE', `Server error ${response.status}. Retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRobustness(url, options, retries - 1, timeout);
        }
        
        return response;
    } catch (error: any) {
        clearTimeout(id);
        const isAbort = error.name === 'AbortError';
        
        if (retries > 0 && !isAbort) {
            logger.warn('YOUTUBE', `Network glitch. Retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 1500));
            return fetchWithRobustness(url, options, retries - 1, timeout);
        }
        
        if (isAbort) throw new Error("Connection Timed Out (Google API Slow)");
        throw error;
    }
};

export const YouTubeService = {
    
    extractVideoId(url: string): string | null {
        // Supported formats: Standard, Share, Embed, Shorts
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    getApiKey(): string {
        try {
            return (localStorage.getItem('redditops_yt_key') || '').trim();
        } catch(e) {
            return '';
        }
    },

    getAccessToken(): string {
        try {
            return localStorage.getItem('redditops_yt_token') || ''; 
        } catch(e) {
            return '';
        }
    },

    // INTERNAL HELPER: Centralized Error Parsing
    async _handleError(response: Response, context: string) {
        let errorMsg = `YouTube API Error (${response.status})`;
        try {
            const data = await response.json();
            if (data.error?.message) {
                // CLEANUP: Strip HTML tags like <a href="..."> which look bad in logs
                errorMsg = data.error.message.replace(/<[^>]*>?/gm, '');
            }
        } catch (e) { /* ignore json parse error */ }

        // Smart Error Classification for User Feedback
        const lowerMsg = errorMsg.toLowerCase();
        if (lowerMsg.includes('quota')) {
            errorMsg = "QUOTA EXCEEDED: Daily YouTube API limit reached. Reset occurs at midnight PT. (Check Google Cloud Console)";
        } else if (response.status === 403) {
            errorMsg = "ACCESS DENIED: Check API Key permissions or enable YouTube Data API v3 in Google Cloud.";
        } else if (response.status === 404) {
            errorMsg = "NOT FOUND: Video or Resource does not exist.";
        }

        logger.error('YOUTUBE', `${context}: ${errorMsg}`);
        throw new Error(errorMsg);
    },

    // NEW: Search for videos by keyword and date with SORT ORDER support
    async searchVideos(query: string, publishedAfter?: string, maxResults: number = 5, order: 'date' | 'viewCount' | 'relevance' = 'date'): Promise<{videoId: string, title: string}[]> {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error("YouTube API Key is missing.");

        try {
            // order=viewCount gets the "Trending/Viral" videos for the query
            let url = `${YOUTUBE_API_BASE}/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}&order=${order}`;
            
            if (publishedAfter) {
                url += `&publishedAfter=${publishedAfter}`;
            }

            const response = await fetchWithRobustness(url);
            if (!response.ok) {
                await this._handleError(response, 'VideoSearch');
            }

            const data = await response.json();
            if (!data.items) return [];

            return data.items.map((item: any) => ({
                videoId: item.id.videoId,
                title: item.snippet.title
            }));

        } catch (error: any) {
             let msg = error.message;
            if (msg.includes('<')) msg = msg.replace(/<[^>]*>?/gm, '');
            throw new Error(msg);
        }
    },

    async fetchVideoComments(videoId: string, maxResults: number = 100): Promise<any[]> {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error("YouTube API Key is missing. Please add it in Settings.");

        try {
            // 1. Fetch video details for context (Title)
            // We wrap this in its own try/catch so a title failure doesn't block comment scraping (unless it's Quota)
            let videoTitle = "Unknown Video";
            try {
                const videoRes = await fetchWithRobustness(`${YOUTUBE_API_BASE}/videos?part=snippet&id=${videoId}&key=${apiKey}`);
                if (!videoRes.ok) {
                    // Check if it's a fatal error (Quota) before ignoring
                    const tempJson = await videoRes.clone().json().catch(() => ({}));
                    const tempMsg = tempJson.error?.message || "";
                    if (tempMsg.includes('quota')) await this._handleError(videoRes, 'VideoMetadata');
                    
                    logger.warn('YOUTUBE', `Could not fetch video title (Status ${videoRes.status}). Proceeding with ID.`);
                } else {
                    const videoData = await videoRes.json();
                    videoTitle = videoData.items?.[0]?.snippet?.title || "Unknown Video";
                }
            } catch (e: any) {
                if (e.message.includes('QUOTA')) throw e; // Re-throw fatal quota errors
            }

            // 2. Fetch Comments
            // textFormat=plainText strips most HTML but we use textOriginal for raw data
            const url = `${YOUTUBE_API_BASE}/commentThreads?part=snippet&videoId=${videoId}&key=${apiKey}&maxResults=${Math.min(maxResults, 100)}&textFormat=plainText&order=relevance`; // Changed order to relevance to get top comments
            
            const response = await fetchWithRobustness(url);
            
            if (!response.ok) {
                await this._handleError(response, 'CommentFetch');
            }

            const data = await response.json();
            
            if (!data.items) return [];

            return data.items.map((item: any) => {
                const comment = item.snippet.topLevelComment.snippet;
                return {
                    id: item.id,
                    author: comment.authorDisplayName,
                    // Use textOriginal to avoid HTML entities
                    content: comment.textOriginal || comment.textDisplay,
                    likes: comment.likeCount,
                    publishedAt: comment.publishedAt,
                    videoTitle: videoTitle,
                    videoId: videoId
                };
            });

        } catch (error: any) {
            // Final safety catch to ensure no HTML leaks
            let msg = error.message;
            if (msg.includes('<')) msg = msg.replace(/<[^>]*>?/gm, '');
            throw new Error(msg);
        }
    },

    async postReply(commentId: string, text: string): Promise<boolean> {
        // WARNING: Requires OAuth Token with 'force-ssl' scope. API Key is NOT enough for writing.
        const token = this.getAccessToken();
        if (!token) {
            throw new Error("WRITE_PERMISSION_DENIED: Posting to YouTube requires an OAuth Access Token (Not just API Key).");
        }

        try {
            const response = await fetchWithRobustness(`${YOUTUBE_API_BASE}/comments?part=snippet`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    snippet: {
                        parentId: commentId,
                        textOriginal: text
                    }
                })
            });

            if (!response.ok) {
                await this._handleError(response, 'PostReply');
            }

            return true;
        } catch (error: any) {
            // Pass through refined errors
            throw error;
        }
    }
};
