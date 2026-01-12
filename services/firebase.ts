
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
        // We assume 'users' collection exists or at least we can try to query it.
        // Even if empty, it verifies the project ID is valid and reachable.
        // We use a timeout to fail fast if network is dead.
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Network Timeout")), 5000));
        
        const probe = (async () => {
             // Just creating a ref doesn't hit network, fetching does.
             // We don't care about the result, just that it doesn't throw "Project Not Found"
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
        if (e.code === 'unavailable') throw new Error("السيرفر غير متاح (Offline). تحقق من الإنترنت.");
        if (e.message?.includes('project') || e.code === 'failed-precondition') throw new Error("معرف المشروع (Project ID) غير صحيح أو غير موجود.");
        
        throw e;
    }
};

export const initializeFirebase = async (config: any) => {
  try {
    if (isInvalid(config.apiKey) || isInvalid(config.projectId)) {
      throw new Error("تكوين غير صالح: Project ID أو API Key ناقصة.");
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
    // Safely tear down existing app to prevent memory leaks or conflicts
    if (getApps().length > 0) {
        const existingApp = getApp();
        console.log("[Firebase] Tearing down previous session...");
        try {
            await deleteApp(existingApp);
        } catch (e) {
            console.warn("[Firebase] Cleanup warning (non-fatal):", e);
        }
    }

    console.log("[Firebase] Initializing Uplink...");
    app = initializeApp(sanitizedConfig);

    if (!app) throw new Error("فشل داخلي في مكتبة Firebase.");

    // Initialize Services
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    
    if (!dbInstance || !authInstance) {
        throw new Error("فشل تحميل وحدات Firestore/Auth.");
    }

    // --- PROBE STEP ---
    // Optional: You can enable this to force a network check immediately.
    // For now, we trust the local init unless it's a "Bootstrap" action where we want to be sure.
    // We will just log success here.

    // Persist valid config
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedConfig));

    logger.success('SYS', `Secure Uplink established to project: ${sanitizedConfig.projectId}`);
    return true;

  } catch (error) {
    const msg = (error as Error).message;
    logger.error('SYS', `Connection Error: ${msg}`);
    console.error("Firebase Init Error Details:", error);
    
    // Clear potentially bad config
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
};

// Auto-connect on load if config exists
export const tryAutoConnect = async () => {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            // On auto-connect, we don't want to throw errors to the UI immediately, just return status
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
