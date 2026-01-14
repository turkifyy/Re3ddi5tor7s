
/**
 * REDDITOPS HUNTER-KILLER BOT
 * Mode: Search & Destroy (Engagement) - PRODUCTION V5.0
 * Executed by GitHub Actions.
 */

const admin = require('firebase-admin');
const https = require('https'); 

// 1. Initialize Firebase with Safety Check
let serviceAccount = null;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
} catch (e) {
    console.error("FATAL: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON. Check your GitHub Secrets format.");
    process.exit(1);
}

if (!serviceAccount) { 
    console.error("FATAL: No Service Account provided in environment variables."); 
    process.exit(1); 
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// --- HELPER FUNCTIONS ---

// Optimized Fetch: Uses Native Node 18+ Fetch if available, falls back to Polyfill if not.
const fetch = global.fetch ? global.fetch : async (url, options = {}) => {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                json: () => {
                    try { return JSON.parse(data); } 
                    catch(e) { return null; }
                },
                text: () => data
            }));
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
};

async function getRedditAccessToken(cred) {
    const auth = Buffer.from(`${cred.clientId}:${cred.clientSecret}`).toString('base64');
    const body = `grant_type=password&username=${encodeURIComponent(cred.username)}&password=${encodeURIComponent(cred.password)}`;
    
    try {
        const res = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': `bot:redditops:v5.0.0-release (by /u/${cred.username})`
            },
            body: body
        });
        
        const data = await res.json();
        // SAFE ACCESS: Returns undefined instead of throwing error if data is null
        return data?.access_token; 
    } catch (e) {
        console.error(`Error getting token for ${cred.username}:`, e.message);
        return null;
    }
}

async function searchReddit(token, subreddit, keyword) {
    // Search for recent comments/posts containing keyword
    const url = `https://oauth.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(keyword)}&sort=new&restrict_sr=on&t=day&limit=5`;
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'bot:redditops:v5.0.0-release' }
        });
        const data = await res.json();
        // SAFE ACCESS: Checks deep nesting safely
        return data?.data?.children || [];
    } catch (e) {
        console.error(`Error searching r/${subreddit}:`, e.message);
        return [];
    }
}

async function generateReply(prompt) {
    if (!process.env.DEEPSEEK_API_KEY) return "Error: No API Key";
    
    try {
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are a helpful expert. Write a short, professional, and engaging Reddit comment reply. Max 3 sentences." },
                    { role: "user", content: `Context: ${prompt}\n\nReply:` }
                ]
            })
        });
        const data = await res.json();
        // SAFE ACCESS: Prevents crash if AI API returns error structure
        return data?.choices?.[0]?.message?.content || "Error generating";
    } catch (e) {
        console.error("AI Generation Error:", e.message);
        return "Error generating";
    }
}

async function postComment(token, thingId, text) {
    const body = `api_type=json&text=${encodeURIComponent(text)}&thing_id=${thingId}`;
    try {
        const res = await fetch('https://oauth.reddit.com/api/comment', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'bot:redditops:v5.0.0-release'
            },
            body: body
        });
        return await res.json();
    } catch (e) {
        console.error(`Failed to post comment to ${thingId}:`, e.message);
        return null;
    }
}

// --- MAIN LOGIC ---

async function runHunterKiller() {
    console.log(">>> STARTING HUNTER-KILLER PROTOCOL [V5.0 PROD] <<<");
    const tasksExecuted = [];
    
    try {
        // 1. Get Credentials from Cloud Vault (Reading Shard 0)
        const secretsDoc = await db.collection('admin_secrets').doc('reddit_pool_shard_0').get();
        
        if (!secretsDoc.exists) {
            console.error("FATAL: 'reddit_pool_shard_0' not found. Ensure you have added accounts in the dashboard settings.");
            throw new Error("No Reddit Credentials in Cloud Vault.");
        }
        
        const pool = secretsDoc.data().pool || [];
        
        if (pool.length === 0) {
             throw new Error("Credential pool is empty.");
        }

        // Find a READY key
        const readyKey = pool.find(c => c.status === 'READY');
        if (!readyKey) throw new Error("No READY keys available in the pool.");
        
        console.log(`[+] Using Agent: ${readyKey.username}`);
        const token = await getRedditAccessToken(readyKey);
        
        if (!token) {
            console.error("[-] Failed to authenticate agent. Skipping cycle.");
            process.exit(0); // Exit gracefully instead of throwing fatal error
        }

        // 2. Get Active Campaigns
        const campaignsSnap = await db.collection('campaigns').where('status', '==', 'RUNNING').get();
        if (campaignsSnap.empty) {
            console.log("[-] No active campaigns.");
            process.exit(0);
        }

        // 3. Search & Destroy Loop
        for (const doc of campaignsSnap.docs) {
            const camp = doc.data();
            const keywords = camp.keywords || [];
            const subreddits = camp.targetSubreddits || [];
            
            if (keywords.length === 0) continue;

            console.log(`[i] Processing Campaign: ${camp.name}`);

            for (const sub of subreddits) {
                for (const kw of keywords) {
                    console.log(`   > Hunting '${kw}' in r/${sub}...`);
                    
                    const hits = await searchReddit(token, sub, kw);
                    
                    for (const hit of hits) {
                        const post = hit.data;
                        if (!post) continue; // Skip malformed results

                        const thingId = post.name; // t3_xxxx
                        
                        // Check if already replied
                        const logSnap = await db.collection('generated_content')
                            .where('redditId', '==', thingId).get();
                            
                        if (!logSnap.empty) {
                            console.log(`     - Skipping ${thingId} (Already engaged)`);
                            continue;
                        }

                        // Generate AI Reply
                        console.log(`     + Match Found! Generating Reply...`);
                        const replyText = await generateReply(post.title + " " + post.selftext);
                        
                        if (replyText.includes("Error")) continue;

                        // Post Reply
                        const result = await postComment(token, thingId, replyText); 
                        
                        // Check for Reddit API errors (Robust Check)
                        // Uses optional chaining to ensure 'result.json.errors' exists before checking length
                        if (result?.json?.errors?.length === 0) {
                            tasksExecuted.push(`Replied to ${thingId} in r/${sub}`);
                            console.log(`     ✅ SUCCESS: Deployed reply.`);
                            
                            // Log to DB
                            await db.collection('generated_content').add({
                                campaignId: doc.id,
                                content: replyText,
                                subreddit: sub,
                                status: 'DEPLOYED',
                                redditId: thingId,
                                deployedAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            
                            // Update Campaign Stats
                            await doc.ref.update({
                                postsEngaged: admin.firestore.FieldValue.increment(1),
                                commentsGenerated: admin.firestore.FieldValue.increment(1)
                            });
                        } else {
                            // Safe logging of error structure
                            const errLog = result?.json?.errors ? JSON.stringify(result.json.errors) : "Unknown API Error";
                            console.error(`     ❌ FAILED: ${errLog}`);
                        }
                    }
                }
            }
        }

        // 4. Update Pulse (Heartbeat)
        await db.collection('metrics').doc('server_pulse').set({
            lastHeartbeat: Date.now(),
            status: 'ONLINE',
            runnerId: process.env.GITHUB_RUN_ID || 'manual',
            executedTasks: tasksExecuted.length > 0 ? tasksExecuted : ['No targets found'],
            durationMs: 0,
            nextScheduledRun: Date.now() + (4 * 60 * 60 * 1000)
        });

        console.log(">>> MISSION COMPLETE <<<");
        process.exit(0);

    } catch (e) {
        console.error("FATAL RUNTIME ERROR:", e);
        process.exit(1);
    }
}

runHunterKiller();
