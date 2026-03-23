
import { DatabaseService } from './databaseService';
import { logger } from './logger';

const KEY_STORAGE = 'redditops_ds_key';

// Safe Environment Variable Access for Browser Runtime (Vercel Compatible)
const getEnvVar = (key: string) => {
    try {
        // 1. Check for Vite/Vercel specific env var (Priority)
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            const viteKey = `VITE_${key}`;
            // @ts-ignore
            if (import.meta.env[viteKey]) return import.meta.env[viteKey];
            // @ts-ignore
            if (import.meta.env[key]) return import.meta.env[key];
        }
        
        // 2. Fallback to standard process.env (for local node scripts)
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            return process.env[key];
        }
    } catch (e) {
        return undefined;
    }
    return undefined;
};

// SAFE INITIALIZATION: Wrap in try-catch to prevent module load failure
let dynamicApiKey = '';
try {
    dynamicApiKey = localStorage.getItem(KEY_STORAGE) || '';
} catch (e) {
    console.warn("LocalStorage blocked for DeepSeek Key");
}

if (!dynamicApiKey) {
    dynamicApiKey = getEnvVar('DEEPSEEK_API_KEY') || '';
}

const BASE_URL = 'https://api.deepseek.com/v1';

export const setDeepSeekKey = (key: string) => {
    dynamicApiKey = key;
    try {
        localStorage.setItem(KEY_STORAGE, key);
    } catch(e) { /* ignore */ }
};

export const getDeepSeekKey = () => dynamicApiKey;

// HELPER: Fetch with Timeout & Retry Strategy (Armored Connection)
// Same logic as YouTubeService for consistency and stability
const fetchWithRobustness = async (url: string, options: RequestInit = {}, retries = 2, timeout = 30000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout); // 30s timeout for AI (slower than standard API)
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        
        // Retry on 5xx server errors or 429 rate limits
        if ((response.status >= 500 || response.status === 429) && retries > 0) {
            logger.warn('AI', `DeepSeek busy/error (${response.status}). Retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
            return fetchWithRobustness(url, options, retries - 1, timeout);
        }
        
        return response;
    } catch (error: any) {
        clearTimeout(id);
        const isAbort = error.name === 'AbortError';
        
        if (retries > 0 && !isAbort) {
            logger.warn('AI', `Network glitch during synthesis. Retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 1500));
            return fetchWithRobustness(url, options, retries - 1, timeout);
        }
        
        if (isAbort) throw new Error("AI Synthesis Timed Out (DeepSeek Slow)");
        throw error;
    }
};

// Helper to measure latency
const measure = async <T>(fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
        const res = await fn();
        logger.trackActivity(Math.round(performance.now() - start));
        return res;
    } catch(e) {
        logger.trackActivity(Math.round(performance.now() - start));
        throw e;
    }
}

export const deepseekService = {
  async generateComment(context: string, tone: string): Promise<string> {
    logger.info('AI', `Initiating DeepSeek-V3 Synthesis Sequence. Tone: ${tone}`);
    
    if (!dynamicApiKey || dynamicApiKey.includes("YOUR_")) {
      const errorMsg = "CRITICAL: DeepSeek API Key missing. Please configure in Settings.";
      logger.error('AI', errorMsg);
      return `System Error: ${errorMsg}`;
    }

    try {
      return await measure(async () => {
          const response = await fetchWithRobustness(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${dynamicApiKey}`
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: `You are a RedditOps marketing assistant.
Task: Reply in a natural and engaging way.
Requirements:
- Don't look like a bot.
- Mention one specific benefit related to the context.
- Add a nice call to action.
- Don't exceed 3 lines.
- Tone: ${tone}`
                },
                {
                  role: "user",
                  content: `Context: "${context}"\n\nWrite the reply:`
                }
              ],
              temperature: 0.7,
              max_tokens: 150
            })
          });

          if (!response.ok) {
            let errMsg = `DeepSeek Error ${response.status}`;
            try {
                const errData = await response.json();
                if (errData.error?.message) errMsg = errData.error.message;
            } catch(e) {}
            throw new Error(errMsg);
          }

          const data = await response.json();
          const content = data.choices[0]?.message?.content || "No content generated.";
          
          logger.success('AI', 'DeepSeek-V3 Synthesis Successful. Token usage recorded.');
          
          // Log usage to real DB
          await DatabaseService.incrementAiOps();

          return content;
      });

    } catch (error) {
      logger.error('AI', `Synthesis Failed: ${(error as Error).message}`);
      return `Error generating content: ${(error as Error).message}`;
    }
  },

  async analyzeSentiment(text: string): Promise<{ score: number; label: string }> {
    logger.info('AI', `Analyzing Sentiment for text sample...`);

    if (!dynamicApiKey || dynamicApiKey.includes("YOUR_")) {
        const errorMsg = "CRITICAL: DeepSeek API Key missing.";
        logger.error('AI', errorMsg);
        throw new Error(errorMsg);
    }

    try {
      return await measure(async () => {
          const response = await fetchWithRobustness(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${dynamicApiKey}`
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: `Analyze the sentiment. Return ONLY a JSON object: {"score": number (-1.0 to 1.0), "label": "Positive"|"Negative"|"Neutral"}. No Markdown.`
                },
                {
                  role: "user",
                  content: text
                }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
           let errMsg = `API Error: ${response.status}`;
           try {
                const errData = await response.json();
                if (errData.error?.message) errMsg = errData.error.message;
           } catch(e) {}
           throw new Error(errMsg);
      }
      
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      let result;
      try {
        // Robust JSON Extraction
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
        } else {
            // Fallback: try cleaning markdown code blocks
            const cleanJson = content.replace(/```json\n?|```/g, '').trim();
            result = JSON.parse(cleanJson);
        }
      } catch (e) {
         logger.error('AI', 'Failed to parse JSON response from DeepSeek.');
         throw new Error("JSON Parsing Failed");
      }
      
      await DatabaseService.incrementAiOps();
      logger.success('AI', `Sentiment Analysis Complete: ${result.label} (${result.score})`);
      
      return { 
          score: typeof result.score === 'number' ? result.score : 0, 
          label: result.label || 'Neutral' 
      };
      });

    } catch (error) {
       logger.error('AI', `Sentiment Analysis Failed: ${(error as Error).message}`);
       return { score: 0, label: 'Error' }; 
    }
  },

  async analyzeLeadIntentBatch(comments: {id: string, text: string}[], context: string): Promise<Record<string, { isLead: boolean, score: number, intent: string, reason: string }>> {
    logger.info('AI', `Batch Precision Mode: Analyzing ${comments.length} comments...`);

    if (!dynamicApiKey || dynamicApiKey.includes("YOUR_")) {
        const errorMsg = "CRITICAL: DeepSeek API Key missing.";
        logger.error('AI', errorMsg);
        throw new Error(errorMsg);
    }

    if (comments.length === 0) return {};

    try {
      return await measure(async () => {
          // Prepare the comments payload
          const commentsPayload = comments.map(c => `[ID: ${c.id}] ${c.text}`).join('\n\n');

          const response = await fetchWithRobustness(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${dynamicApiKey}`
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: `You are an elite lead generation analyst. Analyze the provided batch of comments to determine if the user is a potential customer for the product/service described in the Context.
                  
CRITERIA FOR A GOOD LEAD:
- They express a pain point the product solves.
- They are asking for recommendations related to the product.
- They show buying intent or frustration with a competitor.

Return ONLY a valid JSON object where the keys are the comment IDs and the values are objects with the analysis. No markdown formatting. Schema:
{
  "COMMENT_ID": {
    "isLead": boolean, // true if they are a strong potential customer
    "score": number, // 0 to 100 based on buying intent urgency
    "intent": string, // 3-5 words summarizing what they want/need
    "reason": string // 1 short sentence explaining why they are or aren't a lead
  }
}`
                },
                {
                  role: "user",
                  content: `Context (What we are selling): "${context}"\n\nComments to analyze:\n${commentsPayload}`
                }
              ],
              temperature: 0.1,
              response_format: { type: "json_object" }
            })
          });

          if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
          }
          
          const data = await response.json();
          const content = data.choices[0]?.message?.content;
          
          let result: Record<string, any> = {};
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                const cleanJson = content.replace(/```json\n?|```/g, '').trim();
                result = JSON.parse(cleanJson);
            }
          } catch (e) {
             logger.error('AI', 'Failed to parse JSON response for Batch Lead Intent.');
             throw new Error("JSON Parsing Failed");
          }
          
          await DatabaseService.incrementAiOps();
          
          let leadsFound = 0;
          for (const key in result) {
              if (result[key].isLead) leadsFound++;
          }
          
          logger.success('AI', `Batch Analysis Complete. Found ${leadsFound} leads out of ${comments.length} comments.`);
          
          return result;
      });

    } catch (error) {
       logger.error('AI', `Batch Lead Intent Analysis Failed: ${(error as Error).message}`);
       return {}; 
    }
  },

  async analyzeLeadIntent(comment: string, context: string): Promise<{ isLead: boolean, score: number, intent: string, reason: string }> {
    logger.info('AI', `Precision Mode: Analyzing Lead Intent...`);

    if (!dynamicApiKey || dynamicApiKey.includes("YOUR_")) {
        const errorMsg = "CRITICAL: DeepSeek API Key missing.";
        logger.error('AI', errorMsg);
        throw new Error(errorMsg);
    }

    try {
      return await measure(async () => {
          const response = await fetchWithRobustness(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${dynamicApiKey}`
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: `You are an elite lead generation analyst. Analyze the provided comment to determine if the user is a potential customer for the product/service described in the Context.
                  
CRITERIA FOR A GOOD LEAD:
- They express a pain point the product solves.
- They are asking for recommendations related to the product.
- They show buying intent or frustration with a competitor.

Return ONLY a valid JSON object with no markdown formatting. Schema:
{
  "isLead": boolean, // true if they are a strong potential customer
  "score": number, // 0 to 100 based on buying intent urgency
  "intent": string, // 3-5 words summarizing what they want/need
  "reason": string // 1 short sentence explaining why they are or aren't a lead
}`
                },
                {
                  role: "user",
                  content: `Context (What we are selling): "${context}"\n\nComment to analyze: "${comment}"`
                }
              ],
              temperature: 0.1,
              response_format: { type: "json_object" }
            })
          });

          if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
          }
          
          const data = await response.json();
          const content = data.choices[0]?.message?.content;
          
          let result;
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                const cleanJson = content.replace(/```json\n?|```/g, '').trim();
                result = JSON.parse(cleanJson);
            }
          } catch (e) {
             logger.error('AI', 'Failed to parse JSON response for Lead Intent.');
             throw new Error("JSON Parsing Failed");
          }
          
          await DatabaseService.incrementAiOps();
          
          if (result.isLead) {
              logger.success('AI', `High-Intent Lead Verified! Score: ${result.score}`);
          } else {
              logger.warn('AI', `Lead Rejected by AI. Reason: ${result.reason}`);
          }
          
          return {
              isLead: !!result.isLead,
              score: typeof result.score === 'number' ? result.score : 0,
              intent: result.intent || 'Unknown',
              reason: result.reason || 'No reason provided'
          };
      });

    } catch (error) {
       logger.error('AI', `Lead Intent Analysis Failed: ${(error as Error).message}`);
       return { isLead: false, score: 0, intent: 'Error', reason: 'Analysis failed' }; 
    }
  }
};
