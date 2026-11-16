import defaultFirebaseConfig from '../firebase-applet-config.json';

const viteEnv: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ? (import.meta as unknown as { env: Record<string, string | undefined> }).env
    : {};

export type AppEnvironment = 'production' | 'staging' | 'development';

export const APP_ENV: AppEnvironment =
  viteEnv.VITE_APP_ENV === 'staging' || viteEnv.VITE_APP_ENV === 'development'
    ? viteEnv.VITE_APP_ENV
    : 'production';

// Preserves the existing production workspace path by default
export const WORKSPACE_ID = (viteEnv.VITE_WORKSPACE_ID || 'adm_equipeie').trim();

// Optional single-admin UID lock configured via environment variable (never hardcoded)
export const AUTHORIZED_ADMIN_UID = (viteEnv.VITE_AUTHORIZED_ADMIN_UID || '').trim();

export const USE_FIREBASE_EMULATOR = viteEnv.VITE_USE_FIREBASE_EMULATOR === 'true';

export const firebaseConfig = {
  projectId: viteEnv.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  appId: viteEnv.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  apiKey: viteEnv.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: viteEnv.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  firestoreDatabaseId: viteEnv.VITE_FIREBASE_DATABASE_ID || defaultFirebaseConfig.firestoreDatabaseId,
  storageBucket: viteEnv.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  measurementId: viteEnv.VITE_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId,
  oAuthClientId: defaultFirebaseConfig.oAuthClientId,
  recaptchaSiteKey: defaultFirebaseConfig.recaptchaSiteKey,
};
