import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { Note } from '../types';

interface FirebaseConnectionContextType {
  cloudNotes: Note[];
  isConnected: boolean;
}

const FirebaseConnectionContext = createContext<FirebaseConnectionContextType>({ cloudNotes: [], isConnected: false });

export const useFirebaseConnection = () => useContext(FirebaseConnectionContext);

export const FirebaseConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cloudNotes, setCloudNotes] = useState<Note[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const connect = () => {
      if (unsubscribeRef.current) return;
      const q = query(collection(db, `users/${user.uid}/notes`));
      unsubscribeRef.current = onSnapshot(q, (snap) => {
        const notes = snap.docs.map(doc => doc.data() as Note);
        setCloudNotes(notes);
        setIsConnected(true);
      }, (error) => {
        console.error("Firebase connection error:", error);
        setIsConnected(false);
      });
    };

    const disconnect = () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
        setIsConnected(false);
      }
    };

    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        disconnect();
      } else {
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnect();
    };
  }, [user]);

  return (
    <FirebaseConnectionContext.Provider value={{ cloudNotes, isConnected }}>
      {children}
    </FirebaseConnectionContext.Provider>
  );
};
