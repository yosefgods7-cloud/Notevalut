import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signInWithRedirect, getRedirectResult, signOut as firebaseSignOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextType {
  user: User | null | undefined;
  loading: boolean;
  error: Error | undefined;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
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
  const [user, loading, error] = useAuthState(auth);
  const [isRedirectLoading, setIsRedirectLoading] = useState(true);

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("Successfully logged in via redirect");
        }
      } catch (err: any) {
        console.error("Redirect login error:", err);
        alert(`Redirect sign-in failed: ${err.message}`);
      } finally {
        setIsRedirectLoading(false);
      }
    };
    handleRedirect();
  }, []);

  const signIn = async () => {
    // Detect PWA mode or mobile to decide on login strategy
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isStandalone || isMobile) {
      try {
        await signInWithRedirect(auth, googleProvider);
        return;
      } catch (e: any) {
        console.error("Redirect sign in failed", e);
      }
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') {
        return; // User cancelled
      }
      
      console.warn("Popup sign in failed, trying redirect fallback...", e);
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr: any) {
        console.error("Final fallback failed:", redirectErr);
        alert(`Sign in failed. 
If you're using Brave, turn off shields. 
If on iPhone/Safari, ensure 3rd party cookies are enabled.
Domain: ${window.location.hostname}
Error: ${redirectErr.message}`);
      }
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error("Sign out failed", e);
      throw e;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
