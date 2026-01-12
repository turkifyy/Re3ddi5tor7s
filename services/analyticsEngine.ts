
import { RedditAccount, Campaign } from '../types';

/**
 * Enterprise-grade Analytics Engine
 * Handles heuristic analysis, scoring algorithms, and predictive logic.
 */
export const AnalyticsEngine = {
  
  /**
   * ALGORITHM 1: Account Health Scoring (Heuristic)
   * Calculates a 0-100 score based on multiple weighted factors.
   * - Status (Binary weight)
   * - Karma (Logarithmic scale)
   * - Sentiment (Linear scale)
   * - Age (Linear scale capped)
   */
  calculateAccountHealth(account: RedditAccount): number {
    let score = 50; // Base Score

    // 1. Status Impact (Critical)
    switch (account.status) {
        case 'ACTIVE': score += 20; break;
        case 'RESTING': score += 10; break;
        case 'FLAGGED': score -= 30; break;
        case 'BANNED': return 0; // Immediate death
    }

    // 2. Karma Impact (Logarithmic - dimishing returns after 10k)
    // Small karma boost (0-15 points)
    const karmaBoost = Math.min(15, Math.log10(Math.max(1, account.karma)) * 3);
    score += karmaBoost;

    // 3. Sentiment Impact (-10 to +10)
    if (account.sentiment) {
        score += (account.sentiment.score * 10);
    }

    // 4. Activity Recency Penalties
    // If last active was "Now", good. If older, penalty.
    // (Simplified for this version as string, usually would parse Date)
    if (account.lastActive === 'الآن') score += 5;

    // Clamp between 0 and 100
    return Math.min(100, Math.max(0, Math.round(score)));
  },

  /**
   * ALGORITHM 2: ROI & Engagement Projection
   * Calculates Return on Investment based on interaction ratios.
   */
  calculateCampaignROI(engaged: number, generated: number): number {
      if (generated === 0) return 0;
      
      // Formula: (Engaged / Generated) * Weight * 100
      // We assume an "Engagement" is worth 5x a "Generation" effort
      const ratio = engaged / generated;
      const roi = ratio * 5 * 100;
      
      return Math.round(roi);
  },

  /**
   * ALGORITHM 3: Smart Context Injector (Prompt Engineering)
   * Enhances raw user input with temporal and strategic context before AI processing.
   */
  enhancePromptContext(rawContext: string, tone: string): string {
      const hour = new Date().getHours();
      let timeContext = "";

      // Temporal Awareness Logic
      if (hour >= 5 && hour < 12) timeContext = "It's morning. Be energetic and concise.";
      else if (hour >= 12 && hour < 18) timeContext = "It's afternoon. Be productive and detailed.";
      else if (hour >= 18 && hour < 23) timeContext = "It's evening. Be casual and conversational.";
      else timeContext = "It's late night. Be brief, slightly tired but helpful (like a real night owl).";

      // Intent Extraction (Basic NLP)
      const isQuestion = rawContext.includes("?") || rawContext.includes("كيف") || rawContext.includes("help");
      const intentContext = isQuestion ? "Provide a direct, actionable answer." : "Share a relevant opinion or anecdote.";

      return `
      [SYSTEM CONTEXT INJECTION]
      - Current Time State: ${timeContext}
      - Detected Intent: ${intentContext}
      - Target Tone: ${tone}
      
      [USER DATA]
      ${rawContext}
      `;
  },

  /**
   * ALGORITHM 4: Content Virality Scorer
   * Analyzes generated text to predict performance.
   */
  predictVirality(content: string): { score: number; rating: string; color: string } {
      let score = 60; // Base

      // Length Heuristic (Reddit likes medium-long comments, not too short, not too long)
      const len = content.length;
      if (len > 100 && len < 400) score += 15; // Sweet spot
      else if (len < 50) score -= 10; // Too short/low effort
      else if (len > 800) score -= 5; // Wall of text

      // Structure Heuristics
      if (content.includes("\n")) score += 5; // Formatting helps
      if (content.includes("?")) score += 5; // Questions drive engagement

      // Cap
      score = Math.min(99, Math.max(10, score));

      let rating = "Normal";
      let color = "text-slate-400";

      if (score >= 85) { rating = "Viral Potential"; color = "text-violet-400"; }
      else if (score >= 70) { rating = "High Quality"; color = "text-primary-400"; }
      else if (score >= 50) { rating = "Standard"; color = "text-slate-400"; }
      else { rating = "Low Effort"; color = "text-orange-400"; }

      return { score, rating, color };
  }
};
