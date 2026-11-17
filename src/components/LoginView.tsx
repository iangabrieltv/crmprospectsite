import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, Copy, Check } from 'lucide-react';
import {
  loginWithEmailAndPassword,
  loginWithGoogle,
  inspectGoogleAccountUid,
  mapFirebaseAuthError,
} from '../services/authService';
import { Card, Input, Button, Alert } from './ui';

interface LoginViewProps {
  sessionNotice?: string | null;
  authConfigValid?: boolean;
  onSuccessLogin?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  sessionNotice,
  authConfigValid = true,
  onSuccessLogin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveredAccount, setDiscoveredAccount] = useState<{
    uid: string;
    email: string | null;
  } | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!authConfigValid) {
      setError(
        'Login bloqueado por segurança: a variável VITE_AUTHORIZED_ADMIN_UID ainda não foi configurada neste ambiente. Você pode clicar em "Entrar com Google" abaixo para validar sua conta e obter seu UID automaticamente.'
      );
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Por favor, informe o e-mail e a senha de acesso.');
      return;
    }

    setIsLoading(true);
    try {
      await loginWithEmailAndPassword(cleanEmail, password, rememberMe);
      onSuccessLogin?.();
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setDiscoveredAccount(null);
    setIsGoogleLoading(true);
    try {
      if (!authConfigValid) {
        const info = await inspectGoogleAccountUid();
        setDiscoveredAccount(info);
        return;
      }
      await loginWithGoogle(rememberMe);
      onSuccessLogin?.();
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleCopyUid = () => {
    if (!discoveredAccount) return;
    navigator.clipboard.writeText(discoveredAccount.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const activeError =
    error ||
    (!authConfigValid
      ? sessionNotice ||
        'Login bloqueado por segurança: a variável VITE_AUTHORIZED_ADMIN_UID não está configurada neste ambiente.'
      : sessionNotice);

  return (
    <div className="min-h-screen bg-[var(--kz-bg-canvas)] bg-[radial-gradient(ellipse_at_top,rgba(198,161,91,0.08),transparent_60%)] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#19191F] border border-[#C6A15B]/45 text-[#C6A15B] font-extrabold text-xl tracking-tight shadow-[var(--kz-shadow-md)]">
            K
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--kz-text-primary)]">
              Kaizen — Gestão Integrada
            </h1>
            <p className="text-xs sm:text-sm text-[var(--kz-text-muted)] mt-1">
              Sistema privado de operação comercial e gestão da agência
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <Card padding="lg" className="space-y-5 shadow-[var(--kz-shadow-md)]">
          <div className="border-b border-[var(--kz-border-subtle)] pb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--kz-accent-text)] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--kz-accent)]" />
              Acesso Restrito ao Proprietário
            </span>
            <span className="text-[10px] font-mono text-[var(--kz-text-muted)]">
              Firebase Auth
            </span>
          </div>

          {activeError && <Alert variant="danger">{activeError}</Alert>}

          {discoveredAccount && (
            <Alert variant="info" title="Conta Google verificada — falta configurar o UID">
              <div className="space-y-2 mt-1">
                <p>
                  Conta autenticada: <strong>{discoveredAccount.email || 'Sem e-mail'}</strong>. Para liberar o acesso no sistema e no Firestore, copie seu UID abaixo:
                </p>
                <div className="flex items-center gap-2 bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-default)] rounded-lg px-2.5 py-1.5">
                  <code className="text-[11px] font-mono text-[var(--kz-text-primary)] break-all flex-1">
                    {discoveredAccount.uid}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={handleCopyUid}
                    leftIcon={copiedUid ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  >
                    {copiedUid ? 'Copiado' : 'Copiar UID'}
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          {/* Google Sign-In */}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            loading={isGoogleLoading}
            disabled={isLoading}
            onClick={handleGoogleLogin}
            className="w-full"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>
              {isGoogleLoading
                ? 'Conectando ao Google...'
                : authConfigValid
                ? 'Entrar com Google'
                : 'Entrar com Google (ou obter UID)'}
            </span>
          </Button>

          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-[var(--kz-border-subtle)]" />
            <span className="shrink mx-3 text-[11px] font-medium uppercase tracking-wider text-[var(--kz-text-muted)]">
              ou com e-mail e senha
            </span>
            <div className="flex-grow border-t border-[var(--kz-border-subtle)]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail autorizado"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu-email@dominio.com"
              leftIcon={<Mail className="w-3.5 h-3.5" />}
              autoFocus
            />

            <Input
              label="Senha"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              leftIcon={<Lock className="w-3.5 h-3.5" />}
              className="font-mono"
            />

            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[var(--kz-border-default)] bg-[var(--kz-bg-subtle)] text-[var(--kz-accent)] accent-[#C6A15B] focus:ring-[var(--kz-accent)] w-3.5 h-3.5 cursor-pointer"
                />
                <span>Manter sessão neste dispositivo</span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={isGoogleLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full"
            >
              {isLoading ? 'Autenticando...' : 'Entrar no Kaizen'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
