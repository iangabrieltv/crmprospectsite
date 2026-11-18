import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Plus,
  Send,
  Archive,
  Trash2,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Copy,
  Check,
  ArrowUpRight,
  AlertTriangle,
  Bot,
  Lightbulb,
  ShieldCheck,
} from 'lucide-react';
import { AppTab, Lead, NicheCampaign } from '../../types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
} from '../../types/kaizen';
import {
  FinancialAuditLog,
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialSettings,
  FinancialTransaction,
} from '../../types/finance';
import { ResourceFile } from '../../types/resources';
import {
  AiConversation,
  AiConversationMessage,
  AiProposedAction,
  SystemSettings,
} from '../../types/system';
import {
  buildAssistantContextSummary,
  computeSmartAiSuggestions,
} from '../../services/system/aiContextService';
import {
  prepareConfirmedAssistantAction,
  sendAssistantChatRequest,
} from '../../services/system/aiAssistantService';
import { GeminiStatusProbe } from '../../services/system/integrationsService';
import { getActiveFirebaseIdToken } from '../../services/authService';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Textarea,
} from '../ui';

interface AiAssistantViewProps {
  conversations: AiConversation[];
  onSaveConversation: (conv: AiConversation) => Promise<void> | void;
  onDeleteConversation: (convId: string) => Promise<void> | void;
  onCreateTaskFromAction: (task: Task) => Promise<void> | void;
  onLogAiEvent?: (level: 'info' | 'warning' | 'error', title: string, message: string) => void;
  geminiStatus: GeminiStatusProbe | null;
  systemSettings: SystemSettings;
  leads: Lead[];
  niches: NicheCampaign[];
  clients: Client[];
  proposals: ProposalContract[];
  projects: Project[];
  tasks: Task[];
  agendaEvents: AgendaEvent[];
  socialChannels: SocialChannel[];
  socialPosts: SocialPost[];
  financialEntries: FinancialEntry[];
  financialTransactions: FinancialTransaction[];
  financialCategories: FinancialCategory[];
  financialRecurrences: FinancialRecurrence[];
  financialSettings: FinancialSettings;
  financialAuditLogs: FinancialAuditLog[];
  resourceFiles: ResourceFile[];
  onNavigate: (tab: AppTab) => void;
}

const QUICK_PROMPTS = [
  'Organize minhas prioridades de hoje considerando tarefas atrasadas, reuniões e retornos.',
  'Qual é o resumo financeiro atual separando valores realizados (pagos/recebidos) do previsto em aberto?',
  'Quais leads e propostas comerciais precisam de acompanhamento imediato?',
  'Prepare um rascunho de follow-up no WhatsApp para o lead mais prioritário em negociação.',
];

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  conversations,
  onSaveConversation,
  onDeleteConversation,
  onCreateTaskFromAction,
  onLogAiEvent,
  geminiStatus,
  systemSettings,
  leads,
  niches,
  clients,
  proposals,
  projects,
  tasks,
  agendaEvents,
  socialChannels,
  socialPosts,
  financialEntries,
  financialTransactions,
  financialCategories,
  financialRecurrences,
  financialSettings,
  financialAuditLogs,
  resourceFiles,
  onNavigate,
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    conversations.find((c) => !c.archived)?.id || conversations[0]?.id || null
  );
  const [showArchived, setShowArchived] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(
    systemSettings.preferences.showAssistantSuggestions
  );
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [confirmedWhatsappUrls, setConfirmedWhatsappUrls] = useState<Record<string, string | null>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [convToDelete, setConvToDelete] = useState<AiConversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Editable draft overrides for pending proposed actions keyed by action.id
  const [actionEdits, setActionEdits] = useState<Record<string, Partial<AiProposedAction>>>({});

  const visibleConversations = useMemo(
    () => conversations.filter((c) => (showArchived ? c.archived : !c.archived)),
    [conversations, showArchived]
  );

  const activeConversation = useMemo(() => {
    if (selectedConvId) {
      const match = conversations.find((c) => c.id === selectedConvId);
      if (match) return match;
    }
    return visibleConversations[0] || null;
  }, [conversations, selectedConvId, visibleConversations]);

  const contextSummary = useMemo(
    () =>
      buildAssistantContextSummary({
        leads,
        niches,
        clients,
        proposals,
        projects,
        tasks,
        agendaEvents,
        socialChannels,
        socialPosts,
        financialEntries,
        financialTransactions,
        financialCategories,
        financialRecurrences,
        financialSettings,
        financialAuditLogs,
        resourceFiles,
      }),
    [
      leads,
      niches,
      clients,
      proposals,
      projects,
      tasks,
      agendaEvents,
      socialChannels,
      socialPosts,
      financialEntries,
      financialTransactions,
      financialCategories,
      financialRecurrences,
      financialSettings,
      financialAuditLogs,
      resourceFiles,
    ]
  );

  const smartSuggestions = useMemo(
    () =>
      computeSmartAiSuggestions({
        leads,
        proposals,
        projects,
        tasks,
        financialEntries,
      }),
    [leads, proposals, projects, tasks, financialEntries]
  );

  const createNewConversationObject = (firstTitle = 'Nova Conversa'): AiConversation => {
    const now = new Date().toISOString();
    return {
      id: `aiconv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: firstTitle.slice(0, 80),
      archived: false,
      createdAt: now,
      updatedAt: now,
      messages: [],
      schemaVersion: 1,
    };
  };

  const handleNewConversation = async () => {
    const conv = createNewConversationObject();
    await onSaveConversation(conv);
    setSelectedConvId(conv.id);
    setShowArchived(false);
    setChatError(null);
  };

  const handleSendMessage = async (promptOverride?: string) => {
    const text = (promptOverride ?? inputText).trim();
    if (!text || isSending) return;

    setChatError(null);
    setActionFeedback(null);
    if (!promptOverride) setInputText('');

    let targetConv = activeConversation;
    if (!targetConv) {
      targetConv = createNewConversationObject(text.slice(0, 60));
    }

    const nowIso = new Date().toISOString();
    const userMsg: AiConversationMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: text,
      createdAt: nowIso,
    };

    const updatedTitle =
      targetConv.messages.length === 0
        ? text.slice(0, 56) + (text.length > 56 ? '…' : '')
        : targetConv.title;

    const withUser: AiConversation = {
      ...targetConv,
      title: updatedTitle,
      updatedAt: nowIso,
      messages: [...targetConv.messages, userMsg],
    };

    await onSaveConversation(withUser);
    setSelectedConvId(withUser.id);
    setIsSending(true);

    try {
      const idToken = await getActiveFirebaseIdToken();
      const response = await sendAssistantChatRequest({
        message: text,
        history: withUser.messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        contextSummary,
        idToken,
      });

      const replyIso = new Date().toISOString();
      const assistantMsg: AiConversationMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: response.reply,
        createdAt: replyIso,
        sources: response.citedSources,
        dataLimitationsNote: response.dataLimitationsNote,
        proposedAction: response.proposedAction,
      };

      await onSaveConversation({
        ...withUser,
        updatedAt: replyIso,
        messages: [...withUser.messages, assistantMsg],
      });
      onLogAiEvent?.('info', 'Consulta ao Assistente IA', `Pergunta processada (${response.citedSources.join(', ') || 'contexto geral'}).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar o Assistente IA.';
      setChatError(msg);
      const errIso = new Date().toISOString();
      const errorAssistantMsg: AiConversationMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content:
          'Não foi possível obter resposta do modelo neste momento. Você ainda pode consultar as Sugestões Inteligentes determinísticas ao lado.',
        createdAt: errIso,
        error: msg,
      };
      await onSaveConversation({
        ...withUser,
        updatedAt: errIso,
        messages: [...withUser.messages, errorAssistantMsg],
      });
      onLogAiEvent?.('warning', 'Falha no Assistente IA', msg);
    } finally {
      setIsSending(false);
    }
  };

  const getMergedAction = (action: AiProposedAction): AiProposedAction => ({
    ...action,
    ...(actionEdits[action.id] || {}),
  });

  const updateActionStatusInConversation = async (
    conv: AiConversation,
    msgId: string,
    nextAction: AiProposedAction
  ) => {
    const nowIso = new Date().toISOString();
    await onSaveConversation({
      ...conv,
      updatedAt: nowIso,
      messages: conv.messages.map((m) =>
        m.id === msgId ? { ...m, proposedAction: nextAction } : m
      ),
    });
  };

  const handleConfirmAction = async (msg: AiConversationMessage) => {
    if (!activeConversation || !msg.proposedAction) return;
    const edited = getMergedAction(msg.proposedAction);
    try {
      const result = prepareConfirmedAssistantAction(edited);
      if (result.kind === 'create_task') {
        await onCreateTaskFromAction(result.task);
      } else if (result.kind === 'whatsapp_draft') {
        setConfirmedWhatsappUrls((prev) => ({
          ...prev,
          [edited.id]: result.whatsappUrl,
        }));
      }
      await updateActionStatusInConversation(activeConversation, msg.id, {
        ...edited,
        status: 'confirmed',
      });
      setActionFeedback(result.summary);
      onLogAiEvent?.('info', 'Ação assistida confirmada', result.summary);
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Não foi possível executar a ação confirmada.'
      );
    }
  };

  const handleCancelAction = async (msg: AiConversationMessage) => {
    if (!activeConversation || !msg.proposedAction) return;
    await updateActionStatusInConversation(activeConversation, msg.id, {
      ...msg.proposedAction,
      status: 'cancelled',
    });
  };

  const handleToggleArchive = async (conv: AiConversation) => {
    await onSaveConversation({
      ...conv,
      archived: !conv.archived,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleConfirmDeleteConversation = async () => {
    if (!convToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteConversation(convToDelete.id);
      if (selectedConvId === convToDelete.id) {
        setSelectedConvId(null);
      }
      setConvToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-4">
        <div className="space-y-1">
          <h2 className="kz-page-title">Assistente IA Operacional</h2>
          <p className="kz-subtitle">
            Análise contextual sobre dados reais do CRM, Propostas, Projetos, Tarefas, Agenda e Financeiro — com ações seguras somente após confirmação.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={
              geminiStatus?.configured
                ? 'success'
                : geminiStatus?.reachable
                ? 'warning'
                : 'neutral'
            }
            dot
          >
            {geminiStatus?.configured
              ? `Gemini Conectado (${geminiStatus.model || 'servidor'})`
              : geminiStatus?.reachable
              ? 'GEMINI_API_KEY ausente no servidor'
              : 'Status IA indisponível'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Lightbulb className="w-3.5 h-3.5 text-[var(--kz-accent)]" />}
            onClick={() => setShowSuggestions((prev) => !prev)}
          >
            {showSuggestions ? 'Ocultar Sugestões' : 'Sugestões Inteligentes'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleNewConversation}
          >
            Nova Conversa
          </Button>
        </div>
      </div>

      {geminiStatus && !geminiStatus.configured && (
        <Alert variant="warning" title="Modo IA Server-Side não configurado neste ambiente">
          A chave <code className="font-mono">GEMINI_API_KEY</code> não foi definida no servidor. O histórico de conversas e as <strong>Sugestões Inteligentes determinísticas</strong> continuam funcionando normalmente com os dados reais da agência.
        </Alert>
      )}

      {actionFeedback && (
        <Alert variant="success" onDismiss={() => setActionFeedback(null)}>
          {actionFeedback}
        </Alert>
      )}
      {chatError && (
        <Alert variant="danger" onDismiss={() => setChatError(null)}>
          {chatError}
        </Alert>
      )}

      {/* Main 3-column workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Conversations Sidebar */}
        <Card padding="sm" className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-bold text-[var(--kz-text-primary)]">
              Conversas ({visibleConversations.length})
            </span>
            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              className="text-[11px] font-semibold text-[var(--kz-accent-text)] hover:underline cursor-pointer"
            >
              {showArchived ? 'Ver Ativas' : 'Arquivadas'}
            </button>
          </div>

          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-0.5">
            {visibleConversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--kz-text-muted)]">
                {showArchived
                  ? 'Nenhuma conversa arquivada.'
                  : 'Nenhuma conversa iniciada ainda.'}
              </div>
            ) : (
              visibleConversations.map((conv) => {
                const isSelected = activeConversation?.id === conv.id;
                return (
                  <div
                    key={conv.id}
                    className={`group rounded-xl border p-2.5 transition-colors ${
                      isSelected
                        ? 'bg-[var(--kz-accent-soft)] border-[var(--kz-accent-border)]'
                        : 'bg-[var(--kz-bg-subtle)]/40 border-[var(--kz-border-subtle)] hover:bg-[var(--kz-bg-subtle)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedConvId(conv.id)}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-[var(--kz-text-primary)] truncate">
                        {conv.title}
                      </div>
                      <div className="text-[10px] text-[var(--kz-text-muted)] mt-0.5 font-mono">
                        {conv.messages.length} msg ·{' '}
                        {new Date(conv.updatedAt).toLocaleDateString('pt-BR')}
                      </div>
                    </button>
                    <div className="flex items-center justify-end gap-1 mt-1.5 pt-1.5 border-t border-[var(--kz-border-subtle)]/60">
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(conv)}
                        className="p-1 text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)] cursor-pointer"
                        title={conv.archived ? 'Desarquivar conversa' : 'Arquivar conversa'}
                      >
                        <Archive className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConvToDelete(conv)}
                        className="p-1 text-[var(--kz-text-muted)] hover:text-[var(--kz-danger-text)] cursor-pointer"
                        title="Excluir conversa"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Chat Area */}
        <Card
          padding="none"
          className={`${showSuggestions ? 'lg:col-span-6' : 'lg:col-span-9'} flex flex-col overflow-hidden`}
        >
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-[var(--kz-border-subtle)] bg-[var(--kz-bg-subtle)]/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--kz-text-primary)] truncate">
                  {activeConversation?.title || 'Assistente Contextual Kaizen'}
                </div>
                <div className="text-[10px] text-[var(--kz-text-muted)]">
                  Contexto ao vivo: {contextSummary.commercial.totalLeads} leads ·{' '}
                  {contextSummary.operations.openTasksCount} tarefas abertas ·{' '}
                  {contextSummary.finance.receitaRecebidaNoMes} recebido no mês
                </div>
              </div>
            </div>
            <Badge variant="neutral" size="sm">
              <ShieldCheck className="w-3 h-3" />
              Somente Confirmação
            </Badge>
          </div>

          {/* Messages Feed */}
          <div className="p-4 space-y-4 min-h-[380px] max-h-[520px] overflow-y-auto">
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <div className="py-6 space-y-5">
                <EmptyState
                  icon={<Sparkles className="w-5 h-5" />}
                  title="Pergunte sobre a operação real da agência"
                  description="O assistente consulta os números consolidados de CRM, Clientes, Propostas, Projetos, Tarefas, Agenda e Financeiro (sem misturar previsto com realizado)."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      disabled={isSending}
                      className="text-left p-3 rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-subtle)]/50 hover:border-[var(--kz-accent-border)] hover:bg-[var(--kz-accent-soft)]/30 transition-colors text-xs text-[var(--kz-text-secondary)] cursor-pointer"
                    >
                      “{prompt}”
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              activeConversation.messages.map((msg) => {
                const isUser = msg.role === 'user';
                const mergedAction = msg.proposedAction
                  ? getMergedAction(msg.proposedAction)
                  : null;
                const confirmedWaUrl = mergedAction
                  ? confirmedWhatsappUrls[mergedAction.id]
                  : null;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] font-medium'
                          : 'bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] text-[var(--kz-text-primary)]'
                      }`}
                    >
                      {msg.content}

                      {!isUser && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-[var(--kz-border-subtle)] flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-[var(--kz-text-muted)]">Fontes:</span>
                          {msg.sources.map((src) => (
                            <Badge key={src} variant="neutral" size="sm">
                              {src}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {!isUser && msg.dataLimitationsNote && (
                        <div className="mt-2 text-[11px] text-[var(--kz-text-muted)] flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-[var(--kz-warning-solid)] shrink-0 mt-0.5" />
                          <span>{msg.dataLimitationsNote}</span>
                        </div>
                      )}
                    </div>

                    {/* Confirmation-only Action Preview Card */}
                    {!isUser && mergedAction && (
                      <div className="w-full max-w-[92%] p-3.5 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-accent-border)] space-y-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-[var(--kz-accent-text)] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Ação Assistida Sugerida ({mergedAction.type})</span>
                          </div>
                          <Badge
                            variant={
                              mergedAction.status === 'confirmed'
                                ? 'success'
                                : mergedAction.status === 'cancelled'
                                ? 'neutral'
                                : 'warning'
                            }
                            size="sm"
                          >
                            {mergedAction.status === 'confirmed'
                              ? 'Confirmada'
                              : mergedAction.status === 'cancelled'
                              ? 'Descartada'
                              : 'Aguardando Confirmação'}
                          </Badge>
                        </div>

                        {mergedAction.status === 'pending' ? (
                          <div className="space-y-2.5">
                            {mergedAction.type === 'create_task' && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="sm:col-span-2">
                                  <Input
                                    label="Título da Tarefa"
                                    value={mergedAction.taskTitle || mergedAction.title}
                                    onChange={(e) =>
                                      setActionEdits((prev) => ({
                                        ...prev,
                                        [mergedAction.id]: {
                                          ...(prev[mergedAction.id] || {}),
                                          taskTitle: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <Select
                                  label="Prioridade"
                                  value={mergedAction.taskPriority || 'media'}
                                  onChange={(e) =>
                                    setActionEdits((prev) => ({
                                      ...prev,
                                      [mergedAction.id]: {
                                        ...(prev[mergedAction.id] || {}),
                                        taskPriority: e.target.value as AiProposedAction['taskPriority'],
                                      },
                                    }))
                                  }
                                >
                                  <option value="baixa">Baixa</option>
                                  <option value="media">Média</option>
                                  <option value="alta">Alta</option>
                                  <option value="urgente">Urgente</option>
                                </Select>
                                <Input
                                  label="Prazo (opcional)"
                                  type="date"
                                  value={mergedAction.taskDueDate || ''}
                                  onChange={(e) =>
                                    setActionEdits((prev) => ({
                                      ...prev,
                                      [mergedAction.id]: {
                                        ...(prev[mergedAction.id] || {}),
                                        taskDueDate: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            )}

                            {mergedAction.type === 'whatsapp_draft' && (
                              <div className="space-y-2">
                                <Input
                                  label="Telefone Destinatário (opcional)"
                                  value={mergedAction.targetPhone || ''}
                                  onChange={(e) =>
                                    setActionEdits((prev) => ({
                                      ...prev,
                                      [mergedAction.id]: {
                                        ...(prev[mergedAction.id] || {}),
                                        targetPhone: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="5582999999999"
                                  className="font-mono"
                                />
                                <Textarea
                                  label="Rascunho Editável"
                                  rows={3}
                                  value={mergedAction.draftText || mergedAction.description}
                                  onChange={(e) =>
                                    setActionEdits((prev) => ({
                                      ...prev,
                                      [mergedAction.id]: {
                                        ...(prev[mergedAction.id] || {}),
                                        draftText: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            )}

                            {(mergedAction.type === 'meeting_brief' ||
                              mergedAction.type === 'prioritize_note') && (
                              <Textarea
                                label={mergedAction.title}
                                rows={3}
                                value={mergedAction.draftText || mergedAction.description}
                                onChange={(e) =>
                                  setActionEdits((prev) => ({
                                    ...prev,
                                    [mergedAction.id]: {
                                      ...(prev[mergedAction.id] || {}),
                                      draftText: e.target.value,
                                    },
                                  }))
                                }
                              />
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                variant="ghost"
                                size="xs"
                                leftIcon={<XCircle className="w-3.5 h-3.5" />}
                                onClick={() => handleCancelAction(msg)}
                              >
                                Descartar
                              </Button>
                              <Button
                                variant="primary"
                                size="xs"
                                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                onClick={() => handleConfirmAction(msg)}
                              >
                                Confirmar e Executar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 text-[11px] text-[var(--kz-text-secondary)]">
                            <p>{mergedAction.taskTitle || mergedAction.draftText || mergedAction.description}</p>
                            {mergedAction.status === 'confirmed' &&
                              mergedAction.type === 'whatsapp_draft' && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    leftIcon={
                                      copiedId === mergedAction.id ? (
                                        <Check className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )
                                    }
                                    onClick={() =>
                                      handleCopyText(
                                        mergedAction.id,
                                        mergedAction.draftText || mergedAction.description
                                      )
                                    }
                                  >
                                    {copiedId === mergedAction.id ? 'Copiado' : 'Copiar Rascunho'}
                                  </Button>
                                  {confirmedWaUrl && (
                                    <a
                                      href={confirmedWaUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-semibold rounded-lg bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)]"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                      <span>Abrir no WhatsApp</span>
                                    </a>
                                  )}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 border-t border-[var(--kz-border-subtle)] bg-[var(--kz-bg-subtle)]/30 space-y-2"
          >
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Textarea
                  rows={2}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Digite sua pergunta sobre leads, clientes, propostas, tarefas, agenda ou financeiro..."
                  disabled={isSending}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={isSending}
                disabled={!inputText.trim()}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Enviar
              </Button>
            </div>
            <div className="text-[10px] text-[var(--kz-text-muted)]">
              O Assistente nunca executa exclusões, alterações de CRM/financeiro nem envios automáticos sem sua confirmação explícita.
            </div>
          </form>
        </Card>

        {/* Smart Deterministic Suggestions Panel */}
        {showSuggestions && (
          <Card padding="sm" className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--kz-text-primary)]">
                <Lightbulb className="w-4 h-4 text-[var(--kz-accent)]" />
                <span>Sugestões Inteligentes</span>
              </div>
              <Badge variant="neutral" size="sm">
                {smartSuggestions.length}
              </Badge>
            </div>

            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-0.5">
              {smartSuggestions.map((sug) => (
                <div
                  key={sug.id}
                  className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-2"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <Badge
                      variant={
                        sug.severity === 'danger'
                          ? 'danger'
                          : sug.severity === 'warning'
                          ? 'warning'
                          : 'info'
                      }
                      size="sm"
                    >
                      {sug.category}
                    </Badge>
                  </div>
                  <div className="text-xs font-bold text-[var(--kz-text-primary)]">
                    {sug.title}
                  </div>
                  <p className="text-[11px] text-[var(--kz-text-muted)] leading-relaxed">
                    {sug.description}
                  </p>
                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleSendMessage(sug.promptToAsk)}
                      disabled={isSending}
                    >
                      Analisar no Chat
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      rightIcon={<ArrowUpRight className="w-3 h-3" />}
                      onClick={() => onNavigate(sug.targetTab)}
                    >
                      Módulo
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(convToDelete)}
        onClose={() => setConvToDelete(null)}
        onConfirm={handleConfirmDeleteConversation}
        title="Excluir Conversa"
        description={
          convToDelete
            ? `Deseja excluir permanentemente a conversa "${convToDelete.title}"?`
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
};
