import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from '../utils/firebase';
import { AUTHORIZED_ADMIN_UID } from '../config/env';

const LEGACY_AUTH_KEYS = ['prospectflow_auth_user', 'prospectflow_auth_session'];

export function clearLegacyLocalAuthState(): void {
  try {
    for (const key of LEGACY_AUTH_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access errors
  }
}

export function isAuthorizedSingleAdmin(user: User | null): boolean {
  if (!user) return false;
  if (!AUTHORIZED_ADMIN_UID) return true;
  return user.uid === AUTHORIZED_ADMIN_UID;
}

export function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos. Verifique suas credenciais no Firebase Authentication.';
    case 'auth/invalid-email':
      return 'Informe um endereço de e-mail válido.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada no Firebase Authentication.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas de login seguidas. Aguarde alguns minutos e tente novamente.';
    case 'auth/network-request-failed':
      return 'Erro de conexão com o serviço de autenticação. Verifique sua internet.';
    case 'auth/operation-not-allowed':
      return 'O login por E-mail/Senha ainda não foi habilitado no Firebase Console.';
    case 'auth/user-token-expired':
    case 'auth/requires-recent-login':
      return 'Sua sessão expirou. Faça login novamente para continuar.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Não foi possível concluir a autenticação. Tente novamente.';
  }
}

export async function loginWithEmailAndPassword(
  email: string,
  password: string,
  rememberMe: boolean
): Promise<User> {
  clearLegacyLocalAuthState();
  await setPersistence(
    auth,
    rememberMe ? browserLocalPersistence : browserSessionPersistence
  );

  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  if (!isAuthorizedSingleAdmin(credential.user)) {
    await signOut(auth);
    throw new Error(
      'Esta conta não está autorizada a acessar este sistema privado (UID não corresponde ao administrador).'
    );
  }

  return credential.user;
}

export async function logoutFromFirebase(): Promise<void> {
  clearLegacyLocalAuthState();
  await signOut(auth);
}

export async function getActiveFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user || !isAuthorizedSingleAdmin(user)) {
    return null;
  }
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export function subscribeToAdminSession(
  onSessionChange: (state: {
    user: User | null;
    authorized: boolean;
    reason?: string;
  }) => void
): () => void {
  clearLegacyLocalAuthState();
  let hadAuthenticatedUser = false;

  const unsubAuth = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      const reason = hadAuthenticatedUser
        ? 'Sua sessão foi encerrada ou expirou. Entre novamente para continuar.'
        : undefined;
      hadAuthenticatedUser = false;
      onSessionChange({ user: null, authorized: false, reason });
      return;
    }

    if (!isAuthorizedSingleAdmin(user)) {
      hadAuthenticatedUser = false;
      await signOut(auth).catch(() => {});
      onSessionChange({
        user: null,
        authorized: false,
        reason: 'Conta autenticada não autorizada para este sistema privado.',
      });
      return;
    }

    hadAuthenticatedUser = true;
    onSessionChange({ user, authorized: true });
  });

  const unsubToken = onIdTokenChanged(auth, async (user) => {
    if (!user && hadAuthenticatedUser) {
      hadAuthenticatedUser = false;
      onSessionChange({
        user: null,
        authorized: false,
        reason: 'Sua sessão expirou. Faça login novamente.',
      });
    }
  });

  return () => {
    unsubAuth();
    unsubToken();
  };
}
