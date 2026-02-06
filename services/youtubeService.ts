
import { logger } from './logger';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export const YouTubeService = {
    
    extractVideoId(url: string): string | null {
        // Supported formats: Standard, Share, Embed, Shorts
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    getApiKey(): string {
        try {
            return localStorage.getItem('redditops_yt_key') || '';
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

    async fetchVideoComments(videoId: string, maxResults: number = 100): Promise<any[]> {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error("YouTube API Key is missing. Please add it in Settings.");

        try {
            // 1. Fetch video details for context (Title)
            const videoRes = await fetch(`${YOUTUBE_API_BASE}/videos?part=snippet&id=${videoId}&key=${apiKey}`);
            const videoData = await videoRes.json();
            const videoTitle = videoData.items?.[0]?.snippet?.title || "Unknown Video";

            // 2. Fetch Comments
            // OPTIMIZATION: order='time' gets the newest comments first (Sniper Mode).
            // CRITICAL FIX: textFormat=plainText does not fully strip HTML in textDisplay.
            // We must use 'textOriginal' from the response structure.
            const url = `${YOUTUBE_API_BASE}/commentThreads?part=snippet&videoId=${videoId}&key=${apiKey}&maxResults=${Math.min(maxResults, 100)}&textFormat=plainText&order=time`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "YouTube API Error");
            }

            const data = await response.json();
            
            if (!data.items) return [];

            return data.items.map((item: any) => {
                const comment = item.snippet.topLevelComment.snippet;
                return {
                    id: item.id,
                    author: comment.authorDisplayName,
                    // FIX: Use textOriginal to avoid HTML entities like <br>, &quot;
                    content: comment.textOriginal || comment.textDisplay,
                    likes: comment.likeCount,
                    publishedAt: comment.publishedAt,
                    videoTitle: videoTitle,
                    videoId: videoId
                };
            });

        } catch (error: any) {
            logger.error('SCRAPER', `YouTube Fetch Error: ${error.message}`);
            throw error;
        }
    },

    async postReply(commentId: string, text: string): Promise<boolean> {
        // WARNING: Requires OAuth Token with 'force-ssl' scope.
        const token = this.getAccessToken();
        if (!token) {
            throw new Error("WRITE_PERMISSION_DENIED: Posting to YouTube requires an OAuth Access Token.");
        }

        try {
            const response = await fetch(`${YOUTUBE_API_BASE}/comments?part=snippet`, {
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
                const err = await response.json();
                throw new Error(err.error?.message || "YouTube Post Failed");
            }

            return true;
        } catch (error: any) {
            logger.error('YOUTUBE', `Reply Error: ${error.message}`);
            throw error;
        }
    }
};
