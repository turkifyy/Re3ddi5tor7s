import { DatabaseService } from './databaseService';
import { logger } from './logger';

const KEY_STORAGE = 'redditops_ds_key';
let dynamicApiKey = localStorage.getItem(KEY_STORAGE) || process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = 'https://api.deepseek.com/v1';

export const setDeepSeekKey = (key: string) => {
    dynamicApiKey = key;
    localStorage.setItem(KEY_STORAGE, key);
};

export const getDeepSeekKey = () => dynamicApiKey;

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
          const response = await fetch(`${BASE_URL}/chat/completions`, {
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
                  content: `You are an expert Reddit user. Write a highly engaging, natural-sounding Reddit comment based on the context. Strictly adhere to the requested tone. Keep it under 500 chars. No hashtags. Do not sound like a bot.`
                },
                {
                  role: "user",
                  content: `Context: "${context}"\nTone: ${tone}\n\nWrite the comment:`
                }
              ],
              temperature: 0.7
            })
          });

          if (!response.ok) {
            throw new Error(`DeepSeek Endpoint Error: ${response.status} ${response.statusText}`);
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
          const response = await fetch(`${BASE_URL}/chat/completions`, {
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

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
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
  }
};