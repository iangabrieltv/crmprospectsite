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
import {
  AUTHORIZED_ADMIN_UID,
  isValidAdminUidConfig,
} from '../config/env';

const LEGACY_AUTH_KEYS = ['prospectflow_auth_user', 'prospectflow_auth_session'];

export interface AdminAuthorizationCheck {
  allowed: boolean;
  configValid: boolean;
  code: 'OK' | 'CONFIG_MISSING' | 'UNAUTHENTICATED' | 'UID_MISMATCH';
  reason?: string;
}

export function evaluateSingleAdminAuthorization(params: {
  authenticatedUid: string | null | undefined;
  authorizedUid: string;
}): AdminAuthorizationCheck {
  if (!isValidAdminUidConfig(params.authorizedUid)) {
    return {
      allowed: false,
      configValid: false,
      code: 'CONFIG_MISSING',
      reason:
        'Configuração de segurança ausente: defina VITE_AUTHORIZED_ADMIN_UID com o UID do administrador único para liberar o acesso.',
    };
  }

  const uid = typeof params.authenticatedUid === 'string' ? params.authenticatedUid.trim() : '';
  if (!uid) {
    return {
      allowed: false,
      configValid: true,
      code: 'UNAUTHENTICATED',
    };
  }

  if (uid !== params.authorizedUid.trim()) {
    return {
      allowed: false,
      configValid: true,
      code: 'UID_MISMATCH',
      reason:
        'Acesso negado: esta conta não corresponde ao UID autorizado do administrador único.',
    };
  }

  return {
    allowed: true,
    configValid: true,
    code: 'OK',
  };
}

export function isAdminAuthorizationConfigured(): boolean {
  return isValidAdminUidConfig(AUTHORIZED_ADMIN_UID);
}

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
  const result = evaluateSingleAdminAuthorization({
    authenticatedUid: user?.uid,
    authorizedUid: AUTHORIZED_ADMIN_UID,
  });
  return result.allowed;
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

  const preCheck = evaluateSingleAdminAuthorization({
    authenticatedUid: '__PRECHECK__',
    authorizedUid: AUTHORIZED_ADMIN_UID,
  });
  if (!preCheck.configValid) {
    throw new Error(
      preCheck.reason ||
        'Configuração de segurança ausente: defina VITE_AUTHORIZED_ADMIN_UID antes de fazer login.'
    );
  }

  await setPersistence(
    auth,
    rememberMe ? browserLocalPersistence : browserSessionPersistence
  );

  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const authCheck = evaluateSingleAdminAuthorization({
    authenticatedUid: credential.user?.uid,
    authorizedUid: AUTHORIZED_ADMIN_UID,
  });

  if (!authCheck.allowed) {
    await signOut(auth).catch(() => {});
    throw new Error(
      authCheck.reason ||
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
    configValid: boolean;
    reason?: string;
  }) => void
): () => void {
  clearLegacyLocalAuthState();
  let hadAuthenticatedUser = false;

  const evaluateAndEmit = async (user: User | null) => {
    if (!isAdminAuthorizationConfigured()) {
      hadAuthenticatedUser = false;
      if (user) {
        await signOut(auth).catch(() => {});
      }
      onSessionChange({
        user: null,
        authorized: false,
        configValid: false,
        reason:
          'Configuração de segurança ausente: defina VITE_AUTHORIZED_ADMIN_UID com o UID do administrador único.',
      });
      return;
    }

    if (!user) {
      const reason = hadAuthenticatedUser
        ? 'Sua sessão foi encerrada ou expirou. Entre novamente para continuar.'
        : undefined;
      hadAuthenticatedUser = false;
      onSessionChange({ user: null, authorized: false, configValid: true, reason });
      return;
    }

    const check = evaluateSingleAdminAuthorization({
      authenticatedUid: user.uid,
      authorizedUid: AUTHORIZED_ADMIN_UID,
    });

    if (!check.allowed) {
      hadAuthenticatedUser = false;
      await signOut(auth).catch(() => {});
      onSessionChange({
        user: null,
        authorized: false,
        configValid: check.configValid,
        reason: check.reason || 'Conta autenticada não autorizada para este sistema privado.',
      });
      return;
    }

    hadAuthenticatedUser = true;
    onSessionChange({ user, authorized: true, configValid: true });
  };

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    void evaluateAndEmit(user);
  });

  const unsubToken = onIdTokenChanged(auth, (user) => {
    if (!user && hadAuthenticatedUser) {
      hadAuthenticatedUser = false;
      onSessionChange({
        user: null,
        authorized: false,
        configValid: isAdminAuthorizationConfigured(),
        reason: 'Sua sessão expirou. Faça login novamente.',
      });
    }
  });

  return () => {
    unsubAuth();
    unsubToken();
  };
}
