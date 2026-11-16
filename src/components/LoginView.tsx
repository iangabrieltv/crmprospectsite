import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Database,
  RefreshCw,
} from 'lucide-react';
import { loginWithEmailAndPassword, mapFirebaseAuthError } from '../services/authService';

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
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!authConfigValid) {
      setError(
        'Configuração de segurança ausente: defina VITE_AUTHORIZED_ADMIN_UID com o UID do administrador único antes de acessar o CRM.'
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

  const activeError =
    error ||
    (!authConfigValid
      ? sessionNotice ||
        'Configuração de segurança ausente: defina VITE_AUTHORIZED_ADMIN_UID no ambiente para habilitar o acesso.'
      : sessionNotice);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 flex items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="max-w-md w-full space-y-6">
        {/* Brand / Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/20 ring-4 ring-white/10 mb-2">
            <Database className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            ProspectFlow CRM
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Painel Privado da Agência Kaizen
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Acesso Restrito (Firebase Auth)
            </span>
          </div>

          {activeError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{activeError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail autorizado
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu-email@dominio.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                />
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Manter sessão neste dispositivo</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !authConfigValid}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
