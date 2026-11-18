import { firebaseConfig, WORKSPACE_ID } from '../../config/env';
import { IntegrationStatusItem } from '../../types/system';

export interface GeminiStatusProbe {
  reachable: boolean;
  configured: boolean;
  model?: string;
  error?: string;
}

export function checkSystemIntegrationsStatus(params: {
  authUserEmail?: string | null;
  authUid?: string | null;
  isCloudSynced: boolean;
  syncStatus: 'synced' | 'saving' | 'error';
  geminiProbe: GeminiStatusProbe | null;
  checkedAt?: string;
}): IntegrationStatusItem[] {
  const checkedAt = params.checkedAt || new Date().toISOString();

  const authConnected = Boolean(params.authUid);
  const firestoreConnected = params.isCloudSynced && params.syncStatus !== 'error';
  const storageConfigured = Boolean(firebaseConfig.storageBucket);

  const geminiItem: IntegrationStatusItem = !params.geminiProbe
    ? {
        id: 'gemini_ai',
        name: 'Gemini AI (Assistente & Scripts)',
        category: 'ia',
        status: 'indisponivel',
        detail: 'Aguardando verificação do backend (/api/gemini/status).',
        limitationsNote: 'A chave GEMINI_API_KEY fica exclusivamente no servidor.',
        checkedAt,
      }
    : !params.geminiProbe.reachable
    ? {
        id: 'gemini_ai',
        name: 'Gemini AI (Assistente & Scripts)',
        category: 'ia',
        status: 'erro',
        detail: params.geminiProbe.error || 'Não foi possível consultar o endpoint do backend.',
        limitationsNote: 'Sugestões determinísticas continuam operando normalmente sem LLM.',
        checkedAt,
      }
    : params.geminiProbe.configured
    ? {
        id: 'gemini_ai',
        name: 'Gemini AI (Assistente & Scripts)',
        category: 'ia',
        status: 'conectado',
        detail: `Configurada no servidor (modelo ${params.geminiProbe.model || 'padrão'}).`,
        limitationsNote: 'Uso protegido por Firebase Auth e rate limiter server-side.',
        checkedAt,
      }
    : {
        id: 'gemini_ai',
        name: 'Gemini AI (Assistente & Scripts)',
        category: 'ia',
        status: 'nao_configurado',
        detail: 'Variável GEMINI_API_KEY ausente no servidor.',
        limitationsNote: 'Defina GEMINI_API_KEY no ambiente de execução para habilitar respostas com IA.',
        checkedAt,
      };

  return [
    {
      id: 'firebase_auth',
      name: 'Firebase Authentication',
      category: 'infraestrutura',
      status: authConnected ? 'conectado' : 'erro',
      detail: authConnected
        ? `Sessão exclusiva ativa (${params.authUserEmail || 'UID verificado'}).`
        : 'Nenhuma sessão autenticada detectada.',
      checkedAt,
    },
    {
      id: 'cloud_firestore',
      name: 'Cloud Firestore',
      category: 'infraestrutura',
      status:
        params.syncStatus === 'error'
          ? 'erro'
          : firestoreConnected
          ? 'conectado'
          : 'indisponivel',
      detail:
        params.syncStatus === 'error'
          ? 'Erro de sincronização reportado na última operação.'
          : firestoreConnected
          ? `Conectado em tempo real (workspace ${WORKSPACE_ID} · banco ${firebaseConfig.firestoreDatabaseId}).`
          : 'Aguardando confirmação de leitura/escrita em nuvem.',
      checkedAt,
    },
    {
      id: 'firebase_storage',
      name: 'Firebase Storage (Materiais)',
      category: 'infraestrutura',
      status: storageConfigured ? 'conectado' : 'nao_configurado',
      detail: storageConfigured
        ? `Bucket configurado (${firebaseConfig.storageBucket}) com fallback local seguro.`
        : 'Bucket de Storage não configurado.',
      checkedAt,
    },
    geminiItem,
    {
      id: 'whatsapp_links',
      name: 'WhatsApp (Preparação de Mensagens)',
      category: 'mensageria',
      status: 'conectado',
      detail: 'Geração de links wa.me com scripts, propostas e rascunhos prontos para envio manual.',
      limitationsNote: 'Não realiza disparo automático via WhatsApp Business API; o envio ocorre no aplicativo.',
      checkedAt,
    },
    {
      id: 'google_calendar',
      name: 'Google Calendar (OAuth)',
      category: 'agenda',
      status: 'nao_configurado',
      detail: 'Integração OAuth externa ainda não configurada neste ambiente.',
      limitationsNote: 'A Agenda Integrada persiste compromissos diretamente no Firestore.',
      checkedAt,
    },
    {
      id: 'email_smtp',
      name: 'E-mail Transacional / SMTP',
      category: 'email',
      status: 'nao_configurado',
      detail: 'Provedor de envio de e-mails não configurado.',
      limitationsNote: 'Propostas e contratos podem ser exportados em PDF profissional ou compartilhados via WhatsApp.',
      checkedAt,
    },
  ];
}
