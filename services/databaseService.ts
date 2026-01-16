
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
  serverTimestamp,
  query,
  orderBy,
  where,
  limit,
  getCountFromServer
} from "firebase/firestore";
import { RedditAccount, Campaign, AccountStatus, ServerPulse, ScrapedLead, SystemLog } from '../types';
import { logger } from './logger';

const ACCOUNTS_COL = 'accounts';
const CAMPAIGNS_COL = 'campaigns';
const METRICS_COL = 'metrics';
const CONTENT_COL = 'generated_content';
const LEADS_COL = 'scraped_leads';
const LOGS_COL = 'system_logs'; // NEW: Production Logs Collection

const ensureConnection = () => {
  if (!isFirebaseConfigured()) {
    return null;
  }
  const db = getDb();
  if (!db) return null;
  return db;
};

// Helper to translate Firestore errors
const handleError = (e: any, context: string) => {
    if (e.message.includes('not active') || e.message.includes('null')) return;

    let msg = e.message;
    if (e.code === 'permission-denied') msg = "تم رفض الوصول: ليس لديك صلاحيات كافية.";
    if (e.code === 'unavailable') msg = "الخدمة غير متاحة: تحقق من اتصال الإنترنت.";
    
    logger.error('DB', `Error [${context}]: ${msg}`);
};

// Helper to track real latency
const withTracking = async <T>(operation: () => Promise<T>, context: string, fallbackValue?: any): Promise<T> => {
    if (!isFirebaseConfigured()) {
        return (fallbackValue !== undefined ? fallbackValue : []) as any;
    }

    const start = performance.now();
    try {
        const result = await operation();
        const duration = Math.round(performance.now() - start);
        logger.trackActivity(duration);
        return result;
    } catch (e) {
        handleError(e, context);
        return (fallbackValue !== undefined ? fallbackValue : []) as any;
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

  // NEW: Get Deployment History
  async getDeploymentHistory(limitCount = 20): Promise<any[]> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return [];
        const q = query(collection(db, CONTENT_COL), orderBy('deployedAt', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }, 'GetDeploymentHistory');
  },

  // --- Scraper Leads ---
  async addScrapedLead(lead: ScrapedLead): Promise<void> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return;
        const q = query(collection(db, LEADS_COL), where('id', '==', lead.id), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
             await addDoc(collection(db, LEADS_COL), lead);
             logger.info('DB', `Stored new lead from r/${lead.subreddit}: ${lead.id}`);
        }
    }, 'AddLead');
  },

  async getPendingLeads(): Promise<ScrapedLead[]> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return [];
        
        const q = query(collection(db, LEADS_COL), where('status', '==', 'NEW'), limit(100));
        const snap = await getDocs(q);
        
        const leads = snap.docs.map(doc => doc.data() as ScrapedLead);
        const getT = (d?: string) => d ? new Date(d).getTime() : 0;

        return leads.sort((a, b) => getT(b.scrapedAt) - getT(a.scrapedAt));
    }, 'GetPendingLeads');
  },

  async markLeadEngaged(id: string): Promise<void> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return;
        
        const q = query(collection(db, LEADS_COL), where('id', '==', id), limit(1));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const docRef = snap.docs[0].ref;
            await updateDoc(docRef, { status: 'ENGAGED' });
        }
    }, 'MarkLeadEngaged');
  },
  
  async getLeadsCount(): Promise<number> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return 0;
        const coll = collection(db, LEADS_COL);
        const snapshot = await getCountFromServer(coll);
        return snapshot.data().count;
    }, 'GetLeadsCount', 0);
  },

  // --- Metrics ---
  async getAiOpsCount(): Promise<number> {
    return withTracking(async () => {
        const db = ensureConnection();
        if (!db) return 0;
        
        const docRef = doc(db, METRICS_COL, 'global_stats');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().aiOps || 0;
        }
        return 0;
    }, 'GetMetrics', 0);
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
  },

  async getServerPulse(): Promise<ServerPulse | null> {
      return withTracking(async () => {
          const db = ensureConnection();
          if (!db) return null;
          const docRef = doc(db, METRICS_COL, 'server_pulse');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
              return snap.data() as ServerPulse;
          }
          return null;
      }, 'GetServerPulse', null);
  },

  // --- PRODUCTION: PERSISTENT LOGGING ---
  async writeSystemLog(log: SystemLog): Promise<void> {
      // Direct DB call to avoid circular dependency with logger tracking
      if (!isFirebaseConfigured()) return;
      const db = getDb();
      if (!db) return;
      
      try {
          // Only persist Warnings and Errors to save writes
          if (log.level === 'ERROR' || log.level === 'WARN') {
              await addDoc(collection(db, LOGS_COL), {
                  ...log,
                  createdAt: serverTimestamp()
              });
          }
      } catch (e) {
          // Fail silently to avoid infinite error loops
          console.error("Failed to write system log to cloud", e);
      }
  }
};
