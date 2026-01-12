import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { logger } from "./logger";

// Helper to check if a value is a placeholder or empty
const isInvalid = (val: string | undefined) => !val || val.includes('YOUR_');

let app: FirebaseApp | undefined;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

const STORAGE_KEY = 'redditops_fb_config';

export const initializeFirebase = async (config: any) => {
  try {
    if (isInvalid(config.apiKey) || isInvalid(config.projectId)) {
      throw new Error("Invalid Configuration Parameters: API Key or Project ID is missing.");
    }
    
    // Prevent trailing slashes or spaces causing issues
    const sanitizedConfig = {
        apiKey: config.apiKey.trim(),
        authDomain: config.authDomain?.trim() || `${config.projectId}.firebaseapp.com`,
        projectId: config.projectId.trim(),
        storageBucket: config.storageBucket?.trim() || `${config.projectId}.appspot.com`,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
    };

    // --- RESET LOGIC ---
    // If an app exists, we check if it matches the new config. If not, delete it.
    if (getApps().length > 0) {
        const existingApp = getApp();
        // Check if Project ID changed
        if (existingApp.options.projectId !== sanitizedConfig.projectId || existingApp.options.apiKey !== sanitizedConfig.apiKey) {
            console.log("[Firebase] Configuration changed. Tearing down old instance...");
            try {
                await deleteApp(existingApp);
            } catch (e) {
                console.warn("[Firebase] Warning during deleteApp:", e);
                // Continue anyway, sometimes deleteApp fails if obscure listeners are active
            }
            app = initializeApp(sanitizedConfig);
        } else {
            console.log("[Firebase] Re-using existing instance.");
            app = existingApp;
        }
    } else {
        console.log("[Firebase] Initializing new instance.");
        app = initializeApp(sanitizedConfig);
    }

    if (!app) throw new Error("Firebase App initialization failed internally.");

    // Initialize Services
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    
    if (!dbInstance || !authInstance) {
        throw new Error("Failed to initialize Firestore or Auth services.");
    }

    // Persist valid config only after successful initialization
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedConfig));

    logger.success('SYS', `Secure Uplink established to project: ${sanitizedConfig.projectId}`);
    return true;

  } catch (error) {
    const msg = (error as Error).message;
    logger.error('SYS', `Connection Error: ${msg}`);
    console.error("Firebase Init Error Details:", error);
    
    // Clear potentially bad config
    if (msg.includes("Invalid Configuration")) {
        localStorage.removeItem(STORAGE_KEY);
    }
    return false;
  }
};

// Auto-connect on load if config exists
export const tryAutoConnect = async () => {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            return await initializeFirebase(config);
        } catch (e) {
            console.error("Auto-connect parse error", e);
            return false;
        }
    }
    return false;
};

export const getDb = () => dbInstance;
export const getAuthInstance = () => authInstance;

// Strict check: Only returns true if real DB is connected
export const isFirebaseConfigured = () => !!app && !!dbInstance && !!authInstance;