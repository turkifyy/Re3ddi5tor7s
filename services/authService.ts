import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "firebase/auth";
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp, query, limit } from "firebase/firestore";
import { getAuthInstance, getDb } from "./firebase";
import { UserProfile } from "../types";
import { logger } from "./logger";

export const AuthService = {
    // Register: Checks if it's the first user -> makes them ADMIN
    async register(email: string, pass: string): Promise<UserProfile> {
        const auth = getAuthInstance();
        const db = getDb();
        
        // Explicit check with detailed error
        if (!auth) throw new Error("Firebase Auth service is not ready. Please check connection.");
        if (!db) throw new Error("Firestore service is not ready. Please check connection.");

        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            // 2. Optimized Check: Use query with limit(1) instead of fetching all users
            const usersRef = collection(db, 'users');
            
            let isFirstUser = false;
            try {
                const q = query(usersRef, limit(1));
                const usersSnapshot = await getDocs(q);
                isFirstUser = usersSnapshot.empty;
            } catch (fsError: any) {
                // Determine if it's a "missing database" error
                if (fsError.code === 'not-found' || fsError.message?.includes('project') || fsError.message?.includes('index')) {
                    throw new Error("قاعدة بيانات Firestore غير موجودة. يرجى الذهاب لـ Firebase Console -> Build -> Firestore Database -> Create Database.");
                }
                // Determine if it's a permission/domain error on Firestore side
                if (fsError.code === 'permission-denied') {
                     throw new Error("تم رفض الوصول لقاعدة البيانات. تحقق من Security Rules.");
                }
                throw fsError;
            }

            const role = isFirstUser ? 'ADMIN' : 'USER';

            // 3. Save User Profile
            const profile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                role: role,
                createdAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'users', user.uid), {
                ...profile,
                createdAt: serverTimestamp()
            });

            logger.success('AUTH', `User registered: ${email}. Assigned Role: ${role}`);
            return profile;

        } catch (error: any) {
            let errorMsg = error.message;
            // Translate common Firebase Setup Errors
            if (error.code === 'auth/email-already-in-use') errorMsg = "البريد الإلكتروني مستخدم بالفعل";
            if (error.code === 'auth/weak-password') errorMsg = "كلمة المرور ضعيفة جداً";
            if (error.code === 'auth/operation-not-allowed') errorMsg = "يرجى تفعيل Email/Password Sign-in في Firebase Console.";
            if (error.code === 'auth/invalid-api-key') errorMsg = "مفتاح API غير صالح. تحقق من الإعدادات.";
            
            // SPECIFIC DOMAIN ERROR HANDLING
            if (error.code === 'auth/network-request-failed' || error.message.includes('network')) {
                errorMsg = `فشل الاتصال: يرجى إضافة النطاق "${window.location.hostname}" إلى قائمة Authorized Domains في إعدادات مصادقة Firebase.`;
            }
            if (error.code === 'auth/unauthorized-domain') {
                 errorMsg = `نطاق غير مصرح به: أضف "${window.location.hostname}" إلى Authorized Domains في Firebase.`;
            }
            
            logger.error('AUTH', `Registration Failed: ${errorMsg}`);
            throw new Error(errorMsg);
        }
    },

    async login(email: string, pass: string): Promise<UserProfile> {
        const auth = getAuthInstance();
        const db = getDb();
        if (!auth || !db) throw new Error("نظام المصادقة غير مهيأ");

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const uid = userCredential.user.uid;

            // Fetch Role
            const docSnap = await getDoc(doc(db, 'users', uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                logger.info('AUTH', `User logged in: ${email} (${data.role})`);
                return {
                    uid,
                    email: data.email,
                    role: data.role,
                    createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString()
                } as UserProfile;
            } else {
                // Fail-safe: If Auth exists but Firestore doc is missing, create a default entry
                logger.warn('AUTH', 'User document missing. Auto-healing profile...');
                const fallbackProfile: UserProfile = { 
                    uid, 
                    email: email, 
                    role: 'USER', 
                    createdAt: new Date().toISOString() 
                };
                // Try to restore the doc if permissions allow
                try {
                     await setDoc(doc(db, 'users', uid), { ...fallbackProfile, createdAt: serverTimestamp() });
                } catch(e) { /* Ignore permission errors here */ }
                
                return fallbackProfile;
            }

        } catch (error: any) {
            let errorMsg = error.message;
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') errorMsg = "بيانات الاعتماد غير صحيحة";
            if (error.code === 'auth/too-many-requests') errorMsg = "تم حظر الدخول مؤقتاً لكثرة المحاولات";
            
             // SPECIFIC DOMAIN ERROR HANDLING
            if (error.code === 'auth/network-request-failed' || error.message.includes('network')) {
                errorMsg = `فشل الاتصال: يرجى إضافة النطاق "${window.location.hostname}" إلى قائمة Authorized Domains في إعدادات مصادقة Firebase.`;
            }

            logger.error('AUTH', `Login Failed: ${errorMsg}`);
            throw new Error(errorMsg);
        }
    },

    async logout() {
        const auth = getAuthInstance();
        if (auth) {
            await signOut(auth);
            logger.info('AUTH', 'Session terminated cleanly.');
        }
    },

    async getCurrentProfile(uid: string): Promise<UserProfile | null> {
        const db = getDb();
        if (!db) return null;
        try {
            const docSnap = await getDoc(doc(db, 'users', uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    uid: data.uid,
                    email: data.email,
                    role: data.role,
                    createdAt: data.createdAt?.toDate?.().toISOString() || ''
                } as UserProfile;
            }
            return null;
        } catch (e) {
            return null;
        }
    }
};