import React, { createContext, useContext, useState, useEffect } from 'react';
import { get, set, del } from 'idb-keyval';

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
  // We use user to store basic identity from Google profile.
  const [user, setUser] = useState<any | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedAccessToken = await get("drive_access_token");
        const storedExpiresAt = await get("drive_token_expires_at");
        const storedUser = await get("drive_user_info");
        
        if (storedAccessToken && storedExpiresAt && Date.now() < storedExpiresAt - 5 * 60 * 1000) {
          setAccessToken(storedAccessToken);
          setUser(storedUser || { id: "google-oauth-user" });
        } else {
          // If expired, try refresh logic
          await refreshAccessToken();
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const parseIdToken = (idToken: string) => {
    try {
      const base64Url = idToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const parsed = JSON.parse(jsonPayload);
      if (parsed.sub) {
         return { id: parsed.sub, email: parsed.email, name: parsed.name, picture: parsed.picture };
      }
    } catch(e) {
      console.error("Failed to parse id_token", e);
    }
    return null;
  };

  const refreshAccessToken = async () => {
    try {
      const storedRefreshToken = await get("drive_refresh_token");
      if (!storedRefreshToken) {
        setUser(null);
        return;
      }
      
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: storedRefreshToken })
      });
      
      if (!res.ok) {
        setUser(null);
        await del("drive_access_token");
        await del("drive_token_expires_at");
        await del("drive_refresh_token");
        await del("drive_user_info");
        return;
      }
      
      const data = await res.json();
      if (data.access_token) {
        const newExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
        setAccessToken(data.access_token);
        await set("drive_access_token", data.access_token);
        await set("drive_token_expires_at", newExpiresAt);
        
        let userInfo = await get("drive_user_info") || { id: "google-oauth-user" };
        if (data.id_token) {
           const parsedUser = parseIdToken(data.id_token);
           if (parsedUser) {
             userInfo = parsedUser;
             await set("drive_user_info", userInfo);
           }
        }
        setUser(userInfo);
        
        if (data.refresh_token) {
           await set("drive_refresh_token", data.refresh_token);
        }
      }
    } catch(e) {
      console.error("Auto refresh failed", e);
      setUser(null);
    }
  };

  useEffect(() => {
    const handleSilentRefresh = async () => {
      try {
        const storedExpiresAt = await get("drive_token_expires_at");
        if (!storedExpiresAt) return;
        
        // Refresh within 5 minutes of expiration
        if (Date.now() >= storedExpiresAt - 5 * 60 * 1000) {
           await refreshAccessToken();
        }
      } catch (e) {
         console.error("Silent refresh interval error", e);
      }
    };
    
    // Check every minute
    const interval = setInterval(handleSilentRefresh, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for message from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin is from same app
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && origin !== window.location.origin) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const payload = event.data.payload;
        if (payload.access_token) {
          const expiresAt = Date.now() + (payload.expires_in || 3600) * 1000;
          setAccessToken(payload.access_token);
          await set("drive_access_token", payload.access_token);
          await set("drive_token_expires_at", expiresAt);
          if (payload.refresh_token) {
            await set("drive_refresh_token", payload.refresh_token);
          }
          
          let userInfo = { id: "google-oauth-user" };
          if (payload.id_token) {
             const parsedUser = parseIdToken(payload.id_token);
             if (parsedUser) userInfo = parsedUser;
          }
          await set("drive_user_info", userInfo);
          setUser(userInfo);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const signIn = async () => {
    try {
      if (accessToken) return;

      const response = await fetch('/api/auth/url');
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Please allow popups for this site to connect your Google account.');
      }
    } catch (err) {
      console.error("Login popup failed:", err);
      alert("Failed to initialize Google login.");
    }
  };
  
  const requireDriveScope = async () => {
     if (accessToken) return;
     await signIn();
  };

  const signOut = async () => {
    setUser(null);
    setAccessToken(null);
    await del('drive_access_token');
    await del('drive_token_expires_at');
    await del('drive_refresh_token');
    await del('drive_user_info');
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, accessToken, signIn, signOut, requireDriveScope }}>
      {children}
    </AuthContext.Provider>
  );
};


