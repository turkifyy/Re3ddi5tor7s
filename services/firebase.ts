
import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, collection, getDocs, limit, query } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { logger } from "./logger";

// Helper to check if a value is a placeholder or empty
const isInvalid = (val: string | undefined) => !val || val.includes('YOUR_') || val.length < 5;

let app: FirebaseApp | undefined;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

const STORAGE_KEY = 'redditops_fb_config';

/**
 * SMART HANDSHAKE PROTOCOL
 * Verifies that the Firestore instance is actually reachable.
 * This prevents "Ghost Connections" where init succeeds locally but fails on network.
 */
const probeConnectivity = async (db: Firestore) => {
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Network Timeout")), 5000));
        
        const probe = (async () => {
             const q = query(collection(db, 'system_probe'), limit(1));
             await getDocs(q); 
        })();

        await Promise.race([probe, timeout]);
        return true;
    } catch (e: any) {
        // If permission denied, it means we connected successfully but rules blocked us. This is GOOD (Settings are valid).
        if (e.code === 'permission-denied') return true;
        // If not found or internal, connection is okay.
        if (e.code === 'not-found') return true;
        
        // Real connection errors
        if (e.code === 'unavailable') throw new Error("NETWORK_OFFLINE");
        if (e.message === 'Network Timeout') throw new Error("NETWORK_TIMEOUT");
        if (e.message?.includes('project') || e.code === 'failed-precondition') throw new Error("INVALID_PROJECT");
        
        throw e;
    }
};

export const initializeFirebase = async (config: any) => {
  try {
    if (isInvalid(config.apiKey) || isInvalid(config.projectId)) {
      throw new Error("INVALID_CONFIG");
    }
    
    const sanitizedConfig = {
        apiKey: config.apiKey.trim(),
        authDomain: config.authDomain?.trim() || `${config.projectId}.firebaseapp.com`,
        projectId: config.projectId.trim(),
        storageBucket: config.storageBucket?.trim() || `${config.projectId}.appspot.com`,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
    };

    // --- SMART RESET LOGIC ---
    if (getApps().length > 0) {
        const existingApp = getApp();
        try {
            await deleteApp(existingApp);
        } catch (e) {
            // Suppress cleanup warning
        }
    }

    app = initializeApp(sanitizedConfig);

    if (!app) throw new Error("SDK_INIT_FAIL");

    // Initialize Services
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    
    if (!dbInstance || !authInstance) {
        throw new Error("SDK_MODULE_FAIL");
    }

    // CRITICAL PROBE
    await probeConnectivity(dbInstance);

    // Persist valid config only if successful
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedConfig));

    logger.success('SYS', `Secure Uplink established to project: ${sanitizedConfig.projectId}`);
    return true;

  } catch (error: any) {
    const msg = error.message || "Unknown Error";
    
    // SMART ERROR HANDLING:
    // Only wipe storage if the CONFIG itself is bad. 
    // Do NOT wipe if it's just a network glitch.
    if (msg === "INVALID_PROJECT" || msg === "INVALID_CONFIG" || msg.includes("api-key")) {
        logger.error('SYS', `Configuration Error: Invalid Credentials. Resetting...`);
        localStorage.removeItem(STORAGE_KEY);
        return false;
    } else if (msg === "NETWORK_OFFLINE" || msg === "NETWORK_TIMEOUT") {
        // OFFLINE MODE ACTIVATED
        logger.warn('SYS', `Uplink Offline: Entering Local Mode.`);
        // Return true allows the app to load, even without internet
        return true;
    } else {
        logger.error('SYS', `Connection Error: ${msg}`);
        return false;
    }
  }
};

// Auto-connect on load if config exists
export const tryAutoConnect = async () => {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            if (config.projectId && config.apiKey) {
                return await initializeFirebase(config);
            }
        } catch (e) {
            console.error("Auto-connect parse error", e);
            localStorage.removeItem(STORAGE_KEY);
            return false;
        }
    }
    return false;
};

export const getDb = () => dbInstance;
export const getAuthInstance = () => authInstance;

export const isFirebaseConfigured = () => !!app && !!dbInstance && !!authInstance;
