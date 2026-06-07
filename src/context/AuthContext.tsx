import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signInWithRedirect, getRedirectResult, signOut as firebaseSignOut, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { get, set, del } from 'idb-keyval';
import { auth, googleProvider } from '../lib/firebase';

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
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setAccessToken(null);
        del('drive_access_token');
        del('drive_token_expires_at');
        del('drive_refresh_token');
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
      googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
      googleProvider.setCustomParameters({
        access_type: 'offline',
        prompt: 'consent'
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


