import { Task } from '../../types/kaizen';
import {
  AiConversationMessage,
  AiProposedAction,
} from '../../types/system';
import { buildWhatsAppLink } from '../../utils/phone';
import { AssistantContextSummary } from './aiContextService';
import { GeminiStatusProbe } from './integrationsService';

export async function fetchGeminiServerStatus(
  idToken: string | null
): Promise<GeminiStatusProbe> {
  if (!idToken) {
    return {
      reachable: false,
      configured: false,
      error: 'Sessão administrativa não autenticada.',
    };
  }
  try {
    const res = await fetch('/api/gemini/status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        reachable: false,
        configured: false,
        error: body.error || `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { configured?: boolean; model?: string };
    return {
      reachable: true,
      configured: Boolean(data.configured),
      model: data.model,
    };
  } catch (err) {
    return {
      reachable: false,
      configured: false,
      error: err instanceof Error ? err.message : 'Erro de rede ao consultar backend.',
    };
  }
}

export interface AssistantChatResponsePayload {
  reply: string;
  citedSources: string[];
  dataLimitationsNote?: string;
  proposedAction?: AiProposedAction;
}

export async function sendAssistantChatRequest(params: {
  message: string;
  history: Pick<AiConversationMessage, 'role' | 'content'>[];
  contextSummary: AssistantContextSummary;
  idToken: string | null;
}): Promise<AssistantChatResponsePayload> {
  if (!params.idToken) {
    throw new Error('Sessão expirada ou inválida. Faça login novamente.');
  }

  const res = await fetch('/api/gemini/assistant-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      message: params.message,
      history: params.history.slice(-10),
      contextSummary: params.contextSummary,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    reply?: string;
    citedSources?: string[];
    dataLimitationsNote?: string;
    proposedAction?: AiProposedAction;
  };

  if (!res.ok) {
    throw new Error(data.error || `Erro HTTP ${res.status} ao consultar Assistente IA.`);
  }

  return {
    reply: data.reply || 'Sem resposta textual retornada.',
    citedSources: Array.isArray(data.citedSources) ? data.citedSources : [],
    dataLimitationsNote: data.dataLimitationsNote,
    proposedAction: data.proposedAction,
  };
}

export type SafeActionExecutionResult =
  | {
      kind: 'create_task';
      task: Task;
      summary: string;
    }
  | {
      kind: 'whatsapp_draft';
      draftText: string;
      whatsappUrl: string | null;
      summary: string;
    }
  | {
      kind: 'note_saved';
      summary: string;
    };

/**
 * Executa SOMENTE ações assistidas seguras e previamente confirmadas pelo usuário.
 * Rejeita explicitamente ações financeiras, exclusões ou envios automáticos externos.
 */
export function prepareConfirmedAssistantAction(
  action: AiProposedAction,
  nowIso = new Date().toISOString()
): SafeActionExecutionResult {
  const allowedTypes: AiProposedAction['type'][] = [
    'create_task',
    'whatsapp_draft',
    'meeting_brief',
    'prioritize_note',
  ];
  if (!allowedTypes.includes(action.type)) {
    throw new Error('Tipo de ação assistida não permitido por política de segurança.');
  }

  if (action.type === 'create_task') {
    const title = (action.taskTitle || action.title || '').trim();
    if (!title) {
      throw new Error('Informe um título para criar a tarefa.');
    }
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title.slice(0, 220),
      description: (action.description || '').trim().slice(0, 4000) || undefined,
      clientId: action.taskClientId || undefined,
      projectId: action.taskProjectId || undefined,
      dueDate: action.taskDueDate || undefined,
      priority: action.taskPriority || 'media',
      status: 'a_fazer',
      checklist: [],
      notes: 'Criada via Assistente IA após confirmação explícita do administrador.',
      createdAt: nowIso,
      schemaVersion: 1,
      updatedAt: nowIso,
    };
    return {
      kind: 'create_task',
      task,
      summary: `Tarefa "${task.title}" criada em Minhas Tarefas.`,
    };
  }

  if (action.type === 'whatsapp_draft') {
    const draftText = (action.draftText || action.description || '').trim();
    if (!draftText) {
      throw new Error('Rascunho de mensagem vazio.');
    }
    const whatsappUrl = action.targetPhone
      ? buildWhatsAppLink(action.targetPhone, draftText)
      : null;
    return {
      kind: 'whatsapp_draft',
      draftText,
      whatsappUrl,
      summary: whatsappUrl
        ? `Rascunho preparado para ${action.targetName || action.targetPhone} (pronto para revisar e abrir no WhatsApp).`
        : 'Rascunho preparado e pronto para copiar.',
    };
  }

  return {
    kind: 'note_saved',
    summary: `Resumo "${action.title}" confirmado e fixado na conversa.`,
  };
}
