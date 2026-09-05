import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { RegisteredUser } from '../types';
import { ADMIN_EMAIL } from '../constants';
import { User } from 'firebase/auth';

const COLLECTION_NAME = 'registered_users';

export function normalizeEmailDocId(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * List of known demo emails that should never be present in the database.
 */
export const KNOWN_DEMO_EMAILS = [
  'operations@indiandelivery.com',
  'dispatcher@indiandelivery.com',
  'logistics.team@gmail.com',
];

/**
 * Deletes any demo / seeded users from Firestore so only real Firebase Authentication users remain.
 */
export async function purgeDemoUsers(): Promise<number> {
  let count = 0;
  for (const demoEmail of KNOWN_DEMO_EMAILS) {
    try {
      const docId = normalizeEmailDocId(demoEmail);
      const docRef = doc(db, COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await deleteDoc(docRef);
        count++;
      }
    } catch (err) {
      console.warn(`Could not purge demo user ${demoEmail}:`, err);
    }
  }
  return count;
}

/**
 * Ensures the logged-in admin user is registered and purges any demo emails.
 * Never creates demo or mock users.
 */
export async function ensureInitialRegisteredUsers(currentAdmin?: User | null) {
  try {
    // 1. Purge any demo emails that might have previously been seeded
    await purgeDemoUsers();

    // 2. Ensure admin document exists from real Firebase Auth
    if (currentAdmin && currentAdmin.email) {
      await syncUserOnLogin(currentAdmin);
    } else {
      const adminEmail = ADMIN_EMAIL.toLowerCase();
      const adminDocRef = doc(db, COLLECTION_NAME, normalizeEmailDocId(adminEmail));
      const adminDoc = await getDoc(adminDocRef);

      if (!adminDoc.exists()) {
        const adminData: RegisteredUser = {
          id: adminEmail,
          email: adminEmail,
          displayName: 'Sayed Uzair',
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=Uzair`,
          role: 'admin',
          isEnabled: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          notes: 'Master Administrator (Firebase Auth)',
          isFirebaseAuth: true,
        };
        await setDoc(adminDocRef, adminData);
      }
    }
  } catch (err) {
    console.error('Error ensuring admin user:', err);
  }
}

/**
 * Scans Firebase Firestore to discover any existing/previous users from:
 * 1. The alternate 'users' collection
 * 2. The 'shipments' collection (createdByEmail and updatedByEmail metadata)
 * 
 * Any discovered real user emails are added to 'registered_users' with access enabled.
 */
export async function discoverAndSyncPreviousUsers(): Promise<{ discovered: number; totalScanned: number }> {
  let discovered = 0;
  let totalScanned = 0;
  const discoveredEmails = new Map<string, Partial<RegisteredUser>>();

  // 1. Scan alternate 'users' collection
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    totalScanned += usersSnap.size;
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      const email = (data.email || (d.id.includes('@') ? d.id : null))?.toLowerCase()?.trim();
      if (email && email.includes('@') && !KNOWN_DEMO_EMAILS.includes(email)) {
        discoveredEmails.set(email, {
          email,
          displayName: data.displayName || data.name || email.split('@')[0],
          photoURL: data.photoURL || data.avatar,
          notes: 'Discovered from Firebase users collection',
          isFirebaseAuth: true,
          authUid: data.uid || d.id,
        });
      }
    });
  } catch (err) {
    console.warn('Could not scan alternate users collection:', err);
  }

  // 2. Scan 'shipments' collection for real creator/updater emails
  try {
    const shipmentsSnap = await getDocs(collection(db, 'shipments'));
    totalScanned += shipmentsSnap.size;
    shipmentsSnap.docs.forEach((d) => {
      const data = d.data();
      const candidates = [data.createdByEmail, data.updatedByEmail, data.assignedToEmail];
      for (const raw of candidates) {
        if (raw && typeof raw === 'string' && raw.includes('@')) {
          const email = raw.toLowerCase().trim();
          if (!KNOWN_DEMO_EMAILS.includes(email) && !discoveredEmails.has(email)) {
            discoveredEmails.set(email, {
              email,
              displayName: email.split('@')[0],
              notes: 'Discovered from Firebase shipment audit trail',
              isFirebaseAuth: true,
            });
          }
        }
      }
    });
  } catch (err) {
    console.warn('Could not scan shipments collection:', err);
  }

  // 3. Persist all discovered accounts to 'registered_users'
  for (const [email, userDetails] of discoveredEmails.entries()) {
    const docId = normalizeEmailDocId(email);
    const docRef = doc(db, COLLECTION_NAME, docId);
    try {
      const existing = await getDoc(docRef);
      if (!existing.exists()) {
        const newUser: RegisteredUser = {
          id: email,
          email,
          displayName: userDetails.displayName || email.split('@')[0],
          photoURL: userDetails.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
          role: email === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user',
          isEnabled: email === ADMIN_EMAIL.toLowerCase(), // Default switch OFF (black screen) for users
          createdAt: new Date().toISOString(),
          lastLoginAt: 'Previously Active',
          notes: userDetails.notes || 'Imported from Firebase history',
          isFirebaseAuth: true,
          authUid: userDetails.authUid,
        };
        await setDoc(docRef, newUser);
        discovered++;
      }
    } catch (err) {
      console.warn(`Failed to sync discovered user ${email}:`, err);
    }
  }

  return { discovered, totalScanned };
}

/**
 * Batch imports user emails (e.g. copied from Firebase Authentication console).
 */
export async function batchImportUsers(rawEmails: string[]): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const raw of rawEmails) {
    const email = raw.trim().toLowerCase();
    if (!email || !emailRegex.test(email) || KNOWN_DEMO_EMAILS.includes(email)) {
      skipped++;
      continue;
    }

    const docId = normalizeEmailDocId(email);
    const docRef = doc(db, COLLECTION_NAME, docId);
    try {
      const existing = await getDoc(docRef);
      if (!existing.exists()) {
        const newUser: RegisteredUser = {
          id: email,
          email,
          displayName: email.split('@')[0],
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
          role: email === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user',
          isEnabled: email === ADMIN_EMAIL.toLowerCase(), // Default to OFF (black screen) unless admin
          createdAt: new Date().toISOString(),
          lastLoginAt: 'Imported from Firebase Auth',
          notes: 'Synchronized from Firebase Authentication console',
          isFirebaseAuth: true,
        };
        await setDoc(docRef, newUser);
        imported++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.warn(`Error importing user ${email}:`, err);
      skipped++;
    }
  }

  return { imported, skipped };
}

/**
 * Synchronizes real user data whenever someone signs in with Firebase Authentication.
 */
export async function syncUserOnLogin(user: User): Promise<RegisteredUser> {
  if (!user.email) throw new Error('User has no email address in Firebase Authentication');
  
  const email = user.email.toLowerCase().trim();
  const docId = normalizeEmailDocId(email);
  const docRef = doc(db, COLLECTION_NAME, docId);

  try {
    const existing = await getDoc(docRef);
    const isAdmin = email === ADMIN_EMAIL.toLowerCase();
    const providerId = user.providerData?.[0]?.providerId || 'firebase';

    if (!existing.exists()) {
      const newUser: RegisteredUser = {
        id: email,
        email: email,
        displayName: user.displayName || email.split('@')[0],
        photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
        role: isAdmin ? 'admin' : 'user',
        isEnabled: isAdmin ? true : false, // Default switch is OFF (black screen) for new sign-ins; only master admin is ON
        createdAt: user.metadata?.creationTime || new Date().toISOString(),
        lastLoginAt: user.metadata?.lastSignInTime || new Date().toISOString(),
        notes: isAdmin ? 'Master Administrator (Firebase Auth)' : 'New User (Default: Restricted / Black Screen)',
        authUid: user.uid,
        authProvider: providerId,
        isFirebaseAuth: true,
      };
      await setDoc(docRef, newUser);
      return newUser;
    } else {
      const existingData = existing.data() as RegisteredUser;
      const updatedData: Partial<RegisteredUser> = {
        displayName: user.displayName || existingData.displayName || email.split('@')[0],
        photoURL: user.photoURL || existingData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
        lastLoginAt: user.metadata?.lastSignInTime || new Date().toISOString(),
        authUid: user.uid,
        authProvider: providerId,
        isFirebaseAuth: true,
      };
      if (isAdmin) {
        updatedData.role = 'admin';
        updatedData.isEnabled = true;
      }
      await updateDoc(docRef, updatedData);
      return { ...existingData, ...updatedData };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `registered_users/${docId}`);
    throw err;
  }
}

/**
 * Toggle the API access switch for a specific registered user.
 * When isEnabled = false, that user sees only a black screen with:
 * "API Token limit reached, recharge it to use more"
 */
export async function toggleUserAccess(email: string, isEnabled: boolean): Promise<void> {
  const docId = normalizeEmailDocId(email);
  const docRef = doc(db, COLLECTION_NAME, docId);
  try {
    await updateDoc(docRef, {
      isEnabled,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `registered_users/${docId}`);
    throw err;
  }
}

/**
 * Register an authorized email manually by the admin.
 */
export async function addRegisteredUser(
  email: string, 
  displayName?: string, 
  notes?: string,
  isEnabled: boolean = false
): Promise<RegisteredUser> {
  const cleanEmail = email.trim().toLowerCase();
  const docId = normalizeEmailDocId(cleanEmail);
  const docRef = doc(db, COLLECTION_NAME, docId);

  const newUser: RegisteredUser = {
    id: cleanEmail,
    email: cleanEmail,
    displayName: displayName?.trim() || cleanEmail.split('@')[0],
    photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
    role: cleanEmail === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user',
    isEnabled: cleanEmail === ADMIN_EMAIL.toLowerCase() ? true : isEnabled,
    createdAt: new Date().toISOString(),
    lastLoginAt: 'Pre-Authorized',
    notes: notes?.trim() || 'Pre-authorized by Admin uzair9799@gmail.com',
    isFirebaseAuth: true,
  };

  try {
    await setDoc(docRef, newUser);
    return newUser;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `registered_users/${docId}`);
    throw err;
  }
}

/**
 * Delete a registered user from the authorized access list.
 */
export async function removeRegisteredUser(email: string): Promise<void> {
  const docId = normalizeEmailDocId(email);
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `registered_users/${docId}`);
    throw err;
  }
}

/**
 * Real-time listener for all registered users (for admin uzair9799@gmail.com).
 * Filters out any known demo emails in memory as well for guaranteed cleanliness.
 */
export function subscribeToRegisteredUsers(
  onUsersChange: (users: RegisteredUser[]) => void,
  onError?: (error: any) => void
) {
  return onSnapshot(
    collection(db, COLLECTION_NAME),
    (snapshot) => {
      const users: RegisteredUser[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<RegisteredUser, 'id'>),
        }))
        .filter((u) => !KNOWN_DEMO_EMAILS.includes(u.email.toLowerCase()));
      onUsersChange(users);
    },
    (err) => {
      console.error('Error listening to registered users:', err);
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

/**
 * Real-time listener for a single user's access status.
 */
export function subscribeToUserStatus(
  email: string,
  onStatusChange: (user: RegisteredUser | null) => void,
  onError?: (error: any) => void
) {
  const docId = normalizeEmailDocId(email);
  return onSnapshot(
    doc(db, COLLECTION_NAME, docId),
    (docSnap) => {
      if (docSnap.exists()) {
        onStatusChange({ id: docSnap.id, ...(docSnap.data() as Omit<RegisteredUser, 'id'>) });
      } else {
        onStatusChange(null);
      }
    },
    (err) => {
      console.error(`Error listening to status for ${email}:`, err);
      if (onError) onError(err);
    }
  );
}
