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
 * Ensures initial registered users exist so the admin sees a comprehensive list
 * immediately upon logging in.
 */
export async function ensureInitialRegisteredUsers(currentAdmin?: User | null) {
  try {
    // 1. Ensure admin document exists
    const adminEmail = ADMIN_EMAIL.toLowerCase();
    const adminDocRef = doc(db, COLLECTION_NAME, normalizeEmailDocId(adminEmail));
    const adminDoc = await getDoc(adminDocRef);

    if (!adminDoc.exists()) {
      const adminData: RegisteredUser = {
        id: adminEmail,
        email: adminEmail,
        displayName: currentAdmin?.displayName || 'Uzair Ahmed',
        photoURL: currentAdmin?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=Uzair`,
        role: 'admin',
        isEnabled: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        notes: 'Primary Master Admin with full access & token control',
      };
      await setDoc(adminDocRef, adminData);
    }

    // 2. Check if there are other registered users; if none, seed default team accounts
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    const otherDocs = snap.docs.filter(d => d.id !== adminEmail);

    if (otherDocs.length === 0) {
      const sampleUsers: RegisteredUser[] = [
        {
          id: 'operations@indiandelivery.com',
          email: 'operations@indiandelivery.com',
          displayName: 'Rahul Verma (Fleet Ops)',
          photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul',
          role: 'user',
          isEnabled: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
          lastLoginAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          notes: 'Delhi Hub Logistics Operator',
        },
        {
          id: 'dispatcher@indiandelivery.com',
          email: 'dispatcher@indiandelivery.com',
          displayName: 'Priya Sharma (Dispatch)',
          photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya',
          role: 'user',
          isEnabled: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
          lastLoginAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          notes: 'Mumbai Regional Logistics Lead',
        },
        {
          id: 'logistics.team@gmail.com',
          email: 'logistics.team@gmail.com',
          displayName: 'Team Transit Terminal',
          photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Terminal',
          role: 'user',
          isEnabled: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
          lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          notes: 'External Partner Account (Sample Token Limit)',
        },
      ];

      for (const sample of sampleUsers) {
        await setDoc(doc(db, COLLECTION_NAME, sample.id), sample);
      }
    }
  } catch (err) {
    console.error('Error ensuring initial registered users:', err);
  }
}

/**
 * Synchronizes user data when someone signs in with Google.
 */
export async function syncUserOnLogin(user: User): Promise<RegisteredUser> {
  if (!user.email) throw new Error('User has no email address');
  
  const email = user.email.toLowerCase().trim();
  const docId = normalizeEmailDocId(email);
  const docRef = doc(db, COLLECTION_NAME, docId);

  try {
    const existing = await getDoc(docRef);
    const isAdmin = email === ADMIN_EMAIL.toLowerCase();

    if (!existing.exists()) {
      const newUser: RegisteredUser = {
        id: email,
        email: email,
        displayName: user.displayName || email.split('@')[0],
        photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
        role: isAdmin ? 'admin' : 'user',
        isEnabled: true, // By default enabled until admin turns switch off
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        notes: isAdmin ? 'Primary Master Admin' : 'Registered Google User',
      };
      await setDoc(docRef, newUser);
      return newUser;
    } else {
      const existingData = existing.data() as RegisteredUser;
      const updatedData: Partial<RegisteredUser> = {
        displayName: user.displayName || existingData.displayName || email.split('@')[0],
        photoURL: user.photoURL || existingData.photoURL || '',
        lastLoginAt: new Date().toISOString(),
      };
      if (isAdmin && existingData.role !== 'admin') {
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
 * Register a new email manually by the admin.
 */
export async function addRegisteredUser(
  email: string, 
  displayName?: string, 
  notes?: string
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
    isEnabled: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: 'Never',
    notes: notes?.trim() || 'Authorized by Admin uzair9799@gmail.com',
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
 */
export function subscribeToRegisteredUsers(
  onUsersChange: (users: RegisteredUser[]) => void,
  onError?: (error: any) => void
) {
  return onSnapshot(
    collection(db, COLLECTION_NAME),
    (snapshot) => {
      const users: RegisteredUser[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<RegisteredUser, 'id'>),
      }));
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
