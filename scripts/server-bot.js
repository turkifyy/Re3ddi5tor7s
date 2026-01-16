
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * REDDITOPS HUNTER-KILLER BOT (V5.3 STABLE)
 * Mode: Hybrid (Active Hunting + Queue Processing)
 * Features: Auto-DeepSeek Reply, Ban Evasion (High Entropy), Firebase Sync, DAILY LIMIT ENFORCEMENT.
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

// --- CONSTANTS ---
const DAILY_LIMIT = 100; // Strict limit per account
const SAFETY_COOLDOWN = 15 * 60 * 1000; // 15 mins

// --- HELPER FUNCTIONS ---

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
        return data?.access_token; 
    } catch (e) {
        console.error(`Error getting token for ${cred.username}:`, e.message);
        return null;
    }
}

async function generateReply(prompt, contextType) {
    if (!process.env.DEEPSEEK_API_KEY) return "Error: No API Key";
    
    const tones = [
        "helpful and concise", "slightly humorous and witty", "professional and insightful", "casual and friendly", "direct"
    ];
    const randomTone = tones[Math.floor(Math.random() * tones.length)];

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
                    { 
                        role: "system", 
                        content: `You are a Reddit user replying to a ${contextType}. 
                        Goal: Write a natural, human-like reply. Tone: ${randomTone}.
                        Constraints: Do NOT sound like an AI. Keep it under 40 words. Lowercase occasionally.` 
                    },
                    { role: "user", content: `Context: ${prompt}\n\nReply:` }
                ],
                temperature: 0.9,
                max_tokens: 60
            })
        });
        const data = await res.json();
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

// --- INTELLIGENT CREDENTIAL SELECTION (SEQUENTIAL + DETERMINISTIC) ---
async function selectAndLockCredential(docRef, pool) {
    const now = Date.now();
    let selectedCred = null;
    let poolUpdated = false;

    // 1. Reset Counters if Day Passed
    pool = pool.map(c => {
        const cDate = c.dayStartTimestamp || 0;
        if (now - cDate > (24 * 60 * 60 * 1000)) {
            c.dailyUsage = 0;
            c.dayStartTimestamp = now;
            if (c.status === 'DAILY_CAP_REACHED') c.status = 'READY';
            poolUpdated = true;
        }
        return c;
    });

    // 2. Filter Candidates (Ready & Not Capped)
    const candidates = pool.filter(c => c.status === 'READY' && (c.dailyUsage || 0) < DAILY_LIMIT);
    
    // 3. Filter Cooldown
    const safeCandidates = candidates.filter(c => (now - (c.lastUsed || 0)) > SAFETY_COOLDOWN);

    if (safeCandidates.length > 0) {
        // SEQUENTIAL LOGIC V2:
        // Priority 1: High usage (Finish what started)
        // Priority 2: Alphabetical Username (Deterministic Tie-Breaker)
        // This ensures if everyone is at 0, we ALWAYS pick 'Account_A' before 'Account_B'.
        safeCandidates.sort((a, b) => {
            const usageDiff = (b.dailyUsage || 0) - (a.dailyUsage || 0);
            if (usageDiff !== 0) return usageDiff;
            return (a.username || '').localeCompare(b.username || '');
        });
        
        selectedCred = safeCandidates[0]; 
    } else if (candidates.length > 0) {
        // Fallback (Desperation Mode): Pick ignoring cooldown if queue is clogged
        selectedCred = candidates.sort((a,b) => (a.lastUsed||0) - (b.lastUsed||0))[0];
    }

    if (selectedCred) {
        // Mark Usage IN MEMORY (Will save after post)
        selectedCred.lastUsed = now;
        selectedCred.usageCount = (selectedCred.usageCount || 0) + 1;
        selectedCred.dailyUsage = (selectedCred.dailyUsage || 0) + 1;
        
        if (selectedCred.dailyUsage >= DAILY_LIMIT) {
            selectedCred.status = 'DAILY_CAP_REACHED';
        }
        poolUpdated = true;
    }

    if (poolUpdated) {
        // Optimistic Update to Vault
        await docRef.update({ pool: pool, updatedAt: new Date().toISOString() });
    }

    return selectedCred;
}

// --- CORE LOGIC ---
async function runHunterKiller() {
    console.log(">>> STARTING REDDITOPS ENGINE [V5.3 STABLE] <<<");
    
    try {
        // 1. Get Credentials Shard
        const docRef = db.collection('admin_secrets').doc('reddit_pool_shard_0');
        const secretsDoc = await docRef.get();
        if (!secretsDoc.exists) throw new Error("No Reddit Credentials in Cloud Vault.");
        
        let pool = secretsDoc.data().pool || [];
        
        // 2. Select Credential (with daily limit enforcement)
        const activeCred = await selectAndLockCredential(docRef, pool);
        
        if (!activeCred) {
            console.log("!!! SYSTEM HALT: All accounts are either resting, rate-limited, or hit daily cap.");
            process.exit(0);
        }

        console.log(`[+] Authenticated Agent: ${activeCred.username} (Daily Usage: ${activeCred.dailyUsage}/${DAILY_LIMIT})`);
        const token = await getRedditAccessToken(activeCred);
        if (!token) throw new Error("Auth Failed");

        // 3. Process Queue
        const snapshot = await db.collection('scraped_leads')
            .where('status', '==', 'NEW')
            .limit(5) // Low limit per run to spread load
            .get();

        if (snapshot.empty) {
            console.log("   -> Queue empty.");
            process.exit(0);
        }

        let processed = 0;
        for (const doc of snapshot.docs) {
            const lead = doc.data();
            console.log(`     > Processing: ${lead.id}`);
            
            const reply = await generateReply(lead.content, lead.type);
            if (reply.includes("Error")) continue;

            const res = await postComment(token, lead.id, reply);
            if (res?.json?.errors?.length === 0) {
                console.log(`       ✅ Deployed.`);
                await doc.ref.update({ status: 'ENGAGED', engagedAt: admin.firestore.FieldValue.serverTimestamp() });
                await db.collection('generated_content').add({
                    campaignId: 'auto_bot', content: reply, subreddit: lead.subreddit, status: 'DEPLOYED', deployedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                processed++;
                // Wait 10s between posts to be safe
                await new Promise(r => setTimeout(r, 10000));
            } else {
                console.error(`       ❌ Error: ${JSON.stringify(res)}`);
            }
        }

        // 4. Report
        await db.collection('metrics').doc('server_pulse').set({
            lastHeartbeat: Date.now(),
            status: 'ONLINE',
            runnerId: process.env.GITHUB_RUN_ID || 'manual',
            executedTasks: [`Processed ${processed} leads using ${activeCred.username}`],
            durationMs: 0,
            nextScheduledRun: Date.now() + (4 * 60 * 60 * 1000)
        });

        process.exit(0);

    } catch (e) {
        console.error("FATAL RUNTIME ERROR:", e);
        process.exit(1);
    }
}

runHunterKiller();
