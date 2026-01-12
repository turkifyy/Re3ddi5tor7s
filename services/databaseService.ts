
import { getDb, isFirebaseConfigured } from './firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDoc,
  setDoc,
  increment,
  serverTimestamp
} from "firebase/firestore";
import { RedditAccount, Campaign, AccountStatus } from '../types';
import { logger } from './logger';

const ACCOUNTS_COL = 'accounts';
const CAMPAIGNS_COL = 'campaigns';
const METRICS_COL = 'metrics';
const CONTENT_COL = 'generated_content';

const ensureConnection = () => {
  if (!isFirebaseConfigured()) {
    // Silent fail instead of throwing to avoid red console logs during polling
    return null;
  }
  const db = getDb();
  if (!db) return null;
  return db;
};

// Helper to translate Firestore errors
const handleError = (e: any, context: string) => {
    // Don't log expected errors during setup phase
    if (e.message.includes('not active') || e.message.includes('null')) return;

    let msg = e.message;
    if (e.code === 'permission-denied') msg = "تم رفض الوصول: ليس لديك صلاحيات كافية.";
    if (e.code === 'unavailable') msg = "الخدمة غير متاحة: تحقق من اتصال الإنترنت.";
    
    // Only log real errors
    logger.error('DB', `Error [${context}]: ${msg}`);
};

// Helper to track real latency
const withTracking = async <T>(operation: () => Promise<T>, context: string): Promise<T> => {
    if (!isFirebaseConfigured()) {
        return [] as any; // Return empty data if not configured
    }

    const start = performance.now();
    try {
        const result = await operation();
        const duration = Math.round(performance.now() - start);
        logger.trackActivity(duration);
        return result;
    } catch (e) {
        handleError(e, context);
        return [] as any; // Fallback
    }
};

export const DatabaseService = {
  // --- Accounts ---
  async getAccounts(): Promise<RedditAccount[]> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return [];
        const snapshot = await getDocs(collection(db, ACCOUNTS_COL));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RedditAccount));
    }, 'GetAccounts');
  },

  async addAccount(account: Omit<RedditAccount, 'id'>): Promise<void> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) throw new Error("No DB");
        await addDoc(collection(db, ACCOUNTS_COL), account);
        logger.success('DB', `تم تسجيل عقدة الهوية '${account.username}' في السجل.`);
    }, 'AddAccount');
  },

  async updateAccountSentiment(id: string, sentiment: { score: number; label: string }): Promise<void> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return;
        const ref = doc(db, ACCOUNTS_COL, id);
        await updateDoc(ref, { sentiment });
        logger.info('DB', `تم تحديث قياس المشاعر للعقدة ${id}`);
    }, 'UpdateSentiment');
  },

  // ROBOTICS EXCLUSIVE: Auto-Heal Capability
  async updateAccountStatus(id: string, status: AccountStatus, note?: string): Promise<void> {
     return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return;
        const ref = doc(db, ACCOUNTS_COL, id);
        await updateDoc(ref, { status, lastActive: new Date().toISOString() });
        if(note) logger.info('BOT', `Status Update [${id}]: ${status} - ${note}`);
     }, 'BotUpdateStatus');
  },

  async deleteAccount(id: string): Promise<void> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return;
        await deleteDoc(doc(db, ACCOUNTS_COL, id));
        logger.warn('DB', `تم حذف عقدة الهوية '${id}' من التخزين السحابي.`);
    }, 'DeleteAccount');
  },

  // --- Campaigns ---
  async getCampaigns(): Promise<Campaign[]> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return [];
        const snapshot = await getDocs(collection(db, CAMPAIGNS_COL));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
    }, 'GetCampaigns');
  },

  async addCampaign(campaign: Omit<Campaign, 'id'>): Promise<void> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return;
        await addDoc(collection(db, CAMPAIGNS_COL), campaign);
        logger.success('DB', `تم بدء العملية '${campaign.name}' في السحابة.`);
    }, 'AddCampaign');
  },

  async updateCampaignStats(id: string, engaged: number, generated: number): Promise<void> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return;
        const ref = doc(db, CAMPAIGNS_COL, id);
        await updateDoc(ref, {
            postsEngaged: increment(engaged),
            commentsGenerated: increment(generated)
        });
    }, 'UpdateCampaignStats');
  },

  // --- Content Deployment ---
  async deployCampaignContent(campaignId: string | undefined, content: string, subreddit: string): Promise<void> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return;
        await addDoc(collection(db, CONTENT_COL), {
            campaignId: campaignId || 'direct_console',
            content,
            subreddit,
            status: 'DEPLOYED',
            deployedAt: serverTimestamp()
        });
        logger.success('DB', `تم نشر المحتوى بنجاح إلى أرشيف الإنتاج.`);
    }, 'DeployContent');
  },

  // --- Metrics ---
  async getAiOpsCount(): Promise<number> {
    if (!isFirebaseConfigured()) return 0;
    try {
        const db = getDb();
        if (!db) return 0;
        
        const docRef = doc(db, METRICS_COL, 'global_stats');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().aiOps || 0;
        }
        return 0;
    } catch (e) {
        // Silent fail for metrics to not disrupt flow or console
        return 0;
    }
  },

  async incrementAiOps(): Promise<void> {
    if (!isFirebaseConfigured()) return;
    const db = getDb();
    if (!db) return;
    
    const docRef = doc(db, METRICS_COL, 'global_stats');
    logger.trackActivity(); 
    try {
        await setDoc(docRef, { aiOps: increment(1) }, { merge: true });
    } catch(e) {}
  }
};
