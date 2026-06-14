import React, { createContext, useContext, useState, useEffect } from 'react';
import { get, set, del } from 'idb-keyval';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as fbSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';

// Initialize Firebase (only Auth)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

interface AuthContextType {
  user: any | null | undefined;
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
  const [user, setUser] = useState<any | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Restore locally saved OAuth access token if available
    const initAuth = async () => {
       const token = await get('drive_access_token');
       if (token) setAccessToken(token);
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          picture: firebaseUser.photoURL
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Add scopes for Drive
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        await set('drive_access_token', credential.accessToken);
      }
    } catch (err: any) {
      console.error("Firebase login failed:", err);
      alert("Failed to sign in with Google.");
    }
  };
  
  const requireDriveScope = async () => {
     if (!accessToken) {
       await signIn();
     }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setUser(null);
      setAccessToken(null);
      await del('drive_access_token');
    } catch(err) {
      console.error("Sign out error", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, accessToken, signIn, signOut, requireDriveScope }}>
      {children}
    </AuthContext.Provider>
  );
};


