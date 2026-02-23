
'use client';

import React, { useEffect, useState } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, signInAnonymously } from 'firebase/auth';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';

export const FirebaseClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [instances, setInstances] = useState<{
    app: FirebaseApp;
    db: Firestore;
    auth: Auth;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      const db = getFirestore(app);
      const auth = getAuth(app);
      
      signInAnonymously(auth).catch(console.error);
      
      setInstances({ app, db, auth });
    }
  }, []);

  if (!instances) return null;

  return (
    <FirebaseProvider value={instances}>
      {children}
    </FirebaseProvider>
  );
};
