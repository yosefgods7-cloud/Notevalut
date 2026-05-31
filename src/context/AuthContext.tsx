import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signInWithRedirect, getRedirectResult, signOut as firebaseSignOut, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
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
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setAccessToken(null);
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
          }
        }
      } catch (err: any) {
        console.error("Redirect login error:", err);
      }
    };
    handleRedirect();
  }, []);

  const signIn = async () => {
    try {
      googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
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

