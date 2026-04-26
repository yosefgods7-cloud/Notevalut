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
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') {
        return; // User cancelled
      }
      console.error("Popup sign in failed:", e);
      alert(`Sign in failed.
If you are using a browser with strict privacy settings (like Brave or Safari), please disable Shields or allow third-party cookies for this site. Firebase Authentication requires them to securely verify your identity.

Make sure your GitHub Pages domain is added to "Authorized domains" in the Firebase Console.

Error Details: ${e.message}`);
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
