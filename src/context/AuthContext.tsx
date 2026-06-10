import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signInWithRedirect, getRedirectResult, signOut as firebaseSignOut, GoogleAuthProvider, onAuthStateChanged, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { get, set, del } from 'idb-keyval';
import { auth, googleProvider, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null | undefined;
  loading: boolean;
  error: Error | undefined;
  accessToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  requireDriveScope: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Enforce browser persistence primarily using IndexedDB
        // using browserLocalPersistence ensures it survives across tabs and restarts
        await setPersistence(auth, browserLocalPersistence);
      } catch (e) {
        console.error("Auth persistence setup failed:", e);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    const checkToken = async () => {
      const storedAccessToken = await get('drive_access_token');
      const storedExpiresAt = await get('drive_token_expires_at');
      
      if (storedAccessToken && storedExpiresAt && Date.now() < storedExpiresAt - 5 * 60 * 1000) {
        setAccessToken(storedAccessToken);
      }
    };
    checkToken();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // One-time account recovery to migrate notes from orphaned accounts
        try {
          const RECOVERY_DONE_KEY = `recovery_done_${u.uid}`;
          const done = await get(RECOVERY_DONE_KEY);
          
          if (!done && u.email) {
            console.log("Checking for orphaned user accounts to migrate...");
            
            // Note: Since collectionGroup queries require an index, we will use a try-catch.
            // If the index doesn't exist, this fails fast without breaking the app.
            // In a real environment, you'd deploy the composite index or provide the console link.
            import('firebase/firestore').then(async ({ collectionGroup, query, where, getDocs, writeBatch, doc, collection }) => {
              try {
                const q = query(collectionGroup(db, 'settings'), where('email', '==', u.email));
                const snap = await getDocs(q);
                
                const orphanedUids = snap.docs
                  .map(d => d.data().userId)
                  .filter(id => id && id !== u.uid);
                  
                if (orphanedUids.length > 0) {
                  console.log("Found orphaned accounts, migrating data...", orphanedUids);
                  const batch = writeBatch(db);
                  
                  for (const oldUid of orphanedUids) {
                    const notesSnap = await getDocs(collection(db, `users/${oldUid}/notes`));
                    notesSnap.forEach(noteDoc => {
                      const data = noteDoc.data();
                      batch.set(doc(db, `users/${u.uid}/notes/${noteDoc.id}`), {
                        ...data,
                        userId: u.uid
                      });
                      batch.delete(noteDoc.ref);
                    });
                    
                    // Cleanup old settings to mark as migrated
                    batch.delete(doc(db, `users/${oldUid}/settings/default`));
                  }
                  
                  await batch.commit();
                  console.log("Migration complete.");
                }
                
                await set(RECOVERY_DONE_KEY, true);
              } catch (err) {
                console.warn("Account recovery query failed (index may be building)", err);
              }
            });
          }
        } catch (e) {
          console.error("Recovery check error", e);
        }
      }
      
      setUser(u);
      if (!u) {
        setAccessToken(null);
        await del('drive_access_token');
        await del('drive_token_expires_at');
        await del('drive_refresh_token');
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setAccessToken(credential.accessToken);
            const expiresAt = Date.now() + 3600 * 1000;
            await set('drive_access_token', credential.accessToken);
            await set('drive_token_expires_at', expiresAt);
            
            const refreshToken = (result as any)._tokenResponse?.oauthRefreshToken || (result as any)._tokenResponse?.refreshToken;
            if (refreshToken) await set('drive_refresh_token', refreshToken);
          }
        }
      } catch (err: any) {
        console.error("Redirect login error:", err);
      }
    };
    handleRedirect();
  }, []);

  useEffect(() => {
    const handleSilentRefresh = async () => {
      try {
        const storedRefreshToken = await get('drive_refresh_token');
        const storedExpiresAt = await get('drive_token_expires_at');
        
        if (!storedRefreshToken || !storedExpiresAt) return;
        
        // Refresh within 5 minutes of expiration
        if (Date.now() >= storedExpiresAt - 5 * 60 * 1000) {
           console.log("Silently refreshing access token...");
           // Use a proxy or default configuration if VITE_GOOGLE_CLIENT_ID isn't set
           const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID.apps.googleusercontent.com";
           
           const res = await fetch('https://oauth2.googleapis.com/token', {
             method: 'POST',
             headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
             body: new URLSearchParams({
               client_id: clientId,
               grant_type: 'refresh_token',
               refresh_token: storedRefreshToken,
             }),
           });
           
           if (res.ok) {
             const data = await res.json();
             if (data.access_token) {
               const newExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
               setAccessToken(data.access_token);
               await set('drive_access_token', data.access_token);
               await set('drive_token_expires_at', newExpiresAt);
               // Overwrite refresh token if a new one is returned
               if (data.refresh_token) {
                 await set('drive_refresh_token', data.refresh_token);
               }
             }
           } else {
             console.error("Failed to refresh token:", await res.text());
             await del('drive_refresh_token');
             await del('drive_access_token');
             await del('drive_token_expires_at');
             setAccessToken(null);
           }
        }
      } catch (e) {
        console.error("Silent refresh error:", e);
      }
    };

    const interval = setInterval(handleSilentRefresh, 60 * 1000);
    handleSilentRefresh();
    return () => clearInterval(interval);
  }, []);

  const signIn = async () => {
    try {
      // Check if user is already signed in
      if (auth.currentUser) {
        console.log("User is already signed in, reusing existing session.");
        // If we don't have a token, we might need to get it without a full re-login if possible,
        // but since we are relying on Google sign in, we should check if they already have access.
        // Actually, if we already have auth.currentUser, but need a new Drive scope,
        // we can just re-authenticate the current user for the scopes if missing.
        // But for now, we just proceed to re-auth with popup if needed.
        // Wait, the prompt says: "Fix the Firebase auth initialization to always check for an existing authenticated user session first before attempting any new sign in flow"
        if (accessToken) {
          return;
        }
      }

      googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
      googleProvider.setCustomParameters({
        access_type: 'offline',
        prompt: 'select_account' // Avoid creating new anonymous parallel sessions, force account selection or reuse local session
      });
      
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        const expiresAt = Date.now() + 3600 * 1000;
        await set('drive_access_token', credential.accessToken);
        await set('drive_token_expires_at', expiresAt);
        
        const refreshToken = (result as any)._tokenResponse?.oauthRefreshToken || (result as any)._tokenResponse?.refreshToken;
        if (refreshToken) await set('drive_refresh_token', refreshToken);
      }
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') {
        return; // User cancelled
      }
      console.error("Popup sign in failed:", e);
      alert(`Sign in failed. Error: ${e.message}`);
    }
  };
  
  const requireDriveScope = async () => {
     if (accessToken) return;
     await signIn();
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setAccessToken(null);
      await del('drive_access_token');
      await del('drive_token_expires_at');
      await del('drive_refresh_token');
    } catch (e) {
      console.error("Sign out failed", e);
      throw e;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, accessToken, signIn, signOut, requireDriveScope }}>
      {children}
    </AuthContext.Provider>
  );
};


