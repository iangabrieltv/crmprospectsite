import React, { useMemo, useState } from 'react';
import { AppTab, Lead } from '../types/crm';
import {
  AgendaEvent,
  CLIENT_STATUS_OPTIONS,
  Client,
  ClientStatus,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
  getAgendaEventTypeMeta,
  getClientStatusMeta,
  getProjectStatusMeta,
  getProposalStatusMeta,
  getSocialPostStatusMeta,
  getTaskPriorityMeta,
  getTaskStatusMeta,
} from '../types/kaizen';
import {
  FINANCIAL_ENTRY_STATUS_META,
  FinancialEntry,
  FinancialTransaction,
} from '../types/finance';
import {
  appendClientTimelineEvents,
  generateTimelineEventId,
} from '../services/clientService';
import { calculateProjectProgress } from '../services/projectService';
import { hasContractedSocialManagement } from '../services/socialService';
import { isTaskOverdue } from '../services/taskService';
import {
  computeClientFinancialSummary,
  formatBrlFromCents,
  formatDateBr,
  getEffectiveEntryStatus,
  getEntryAllowedTotalCents,
  getEntryPendingCents,
} from '../services/finance';
import { buildWhatsAppLink } from '../utils/phone';
import { downloadProposalPdf } from '../services/pdfService';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  Tabs,
} from './ui';
import {
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSignature,
  FolderKanban,
  Globe,
  Link2,
  MessageCircle,
  Plus,
  Server,
  Share2,
  Trash2,
  Wallet,
} from 'lucide-react';

interface ClientDetailModalProps {
  client: Client;
  leads: Lead[];
  proposals: ProposalContract[];
  projects?: Project[];
  tasks?: Task[];
  agendaEvents?: AgendaEvent[];
  socialChannels?: SocialChannel[];
  socialPosts?: SocialPost[];
  financialEntries?: FinancialEntry[];
  financialTransactions?: FinancialTransaction[];
  userName: string;
  onClose: () => void;
  onEditClient: (client: Client) => void;
  onUpdateClient: (updated: Client) => Promise<void> | void;
  onDeleteClient: (clientId: string) => Promise<void> | void;
  onOpenLeadModal?: (lead: Lead) => void;
  onCreateProposalForClient?: (client: Client) => void;
  onPreviewProposal?: (proposal: ProposalContract) => void;
  onCreateProjectForClient?: (client: Client) => void;
  onOpenProject?: (projectId: string) => void;
  onCreateEventForClient?: (client: Client) => void;
  onOpenSocialModule?: () => void;
  onOpenFinance?: () => void;
  onNavigate?: (tab: AppTab) => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  leads,
  proposals,
  projects = [],
  tasks = [],
  agendaEvents = [],
  socialChannels = [],
  socialPosts = [],
  financialEntries = [],
  financialTransactions = [],
  userName,
  onClose,
  onEditClient,
  onUpdateClient,
  onDeleteClient,
  onOpenLeadModal,
  onCreateProposalForClient,
  onPreviewProposal,
  onCreateProjectForClient,
  onOpenProject,
  onCreateEventForClient,
  onOpenSocialModule,
  onOpenFinance,
  onNavigate,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'timeline' | 'relations'>(
    'overview'
  );
  const [newNoteText, setNewNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const statusMeta = getClientStatusMeta(client.status);

  const linkedLead = useMemo(() => {
    if (client.originLeadId) {
      return leads.find((l) => l.id === client.originLeadId) || null;
    }
    return null;
  }, [leads, client.originLeadId]);

  const linkedProposals = useMemo(
    () =>
      proposals.filter(
        (p) =>
          p.clientId === client.id ||
          (client.originLeadId && p.leadId === client.originLeadId)
      ),
    [proposals, client.id, client.originLeadId]
  );

  const linkedProjects = useMemo(
    () => projects.filter((p) => p.clientId === client.id),
    [projects, client.id]
  );

  const linkedProjectIds = useMemo(
    () => new Set(linkedProjects.map((p) => p.id)),
    [linkedProjects]
  );

  const linkedTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.clientId === client.id || (t.projectId && linkedProjectIds.has(t.projectId))
      ),
    [tasks, client.id, linkedProjectIds]
  );

  const linkedEvents = useMemo(
    () =>
      agendaEvents
        .filter(
          (ev) =>
            ev.clientId === client.id ||
            (ev.projectId && linkedProjectIds.has(ev.projectId)) ||
            (client.originLeadId && ev.leadId === client.originLeadId)
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [agendaEvents, client.id, client.originLeadId, linkedProjectIds]
  );

  const socialEligible = useMemo(
    () => hasContractedSocialManagement(client, proposals, socialChannels),
    [client, proposals, socialChannels]
  );

  const linkedSocialChannels = useMemo(
    () =>
      socialChannels.filter(
        (ch) => ch.ownerType === 'client' && ch.clientId === client.id
      ),
    [socialChannels, client.id]
  );

  const linkedSocialPosts = useMemo(
    () =>
      socialPosts.filter(
        (p) => p.ownerType === 'client' && p.clientId === client.id
      ),
    [socialPosts, client.id]
  );

  const clientFinance = useMemo(
    () =>
      computeClientFinancialSummary({
        client,
        proposals,
        entries: financialEntries,
        transactions: financialTransactions,
      }),
    [client, proposals, financialEntries, financialTransactions]
  );

  const handleStatusChange = async (nextStatus: ClientStatus) => {
    if (nextStatus === client.status) return;
    const nextLabel = getClientStatusMeta(nextStatus).label;
    const nowIso = new Date().toISOString();
    const updated: Client = {
      ...client,
      status: nextStatus,
      timeline: appendClientTimelineEvents(client.timeline || [], [
        {
          id: generateTimelineEventId('st'),
          date: nowIso,
          type: 'status_alterado',
          title: `Status alterado para ${nextLabel}`,
          author: userName,
        },
      ]),
      updatedAt: nowIso,
    };
    await onUpdateClient(updated);
  };

  const handleEnableSocialManagement = async () => {
    const nowIso = new Date().toISOString();
    await onUpdateClient({
      ...client,
      socialManagementEnabled: true,
      timeline: appendClientTimelineEvents(client.timeline || [], [
        {
          id: generateTimelineEventId('soc'),
          date: nowIso,
          type: 'edicao',
          title: 'Gestão de Redes Sociais ativada no cadastro do cliente',
          author: userName,
        },
      ]),
      updatedAt: nowIso,
    });
  };

  const handleAddTimelineNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setIsSavingNote(true);
    try {
      const nowIso = new Date().toISOString();
      const updated: Client = {
        ...client,
        timeline: appendClientTimelineEvents(client.timeline || [], [
          {
            id: generateTimelineEventId('note'),
            date: nowIso,
            type: 'anotacao',
            title: 'Registro de atendimento',
            description: newNoteText.trim(),
            author: userName,
          },
        ]),
        updatedAt: nowIso,
      };
      await onUpdateClient(updated);
      setNewNoteText('');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteClient(client.id);
      setShowDeleteConfirm(false);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const relationsBadgeCount =
    (linkedLead ? 1 : 0) +
    linkedProposals.length +
    linkedProjects.length +
    linkedTasks.length +
    linkedEvents.length +
    (socialEligible ? linkedSocialPosts.length : 0);

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        size="xl"
        title={client.companyName}
        subtitle={`${client.segment || 'Cliente Kaizen'}${
          client.city ? ` · ${client.city}` : ''
        }${client.displayPhone ? ` · ${client.displayPhone}` : ''}`}
        footer={
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-[var(--kz-danger-solid)]" />}
              className="text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)]"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Excluir Cliente
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {client.phone && (
                <a
                  href={buildWhatsAppLink(
                    client.phone,
                    `Olá ${client.contactName || client.companyName}, tudo bem?`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] hover:bg-emerald-500/20 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
              {onCreateProposalForClient && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<FileSignature className="w-3.5 h-3.5" />}
                  onClick={() => onCreateProposalForClient(client)}
                >
                  Nova Proposta / Contrato
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                onClick={() => onEditClient(client)}
              >
                Editar Ficha
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Top Status & Navigation Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--kz-border-subtle)]">
            <Tabs
              activeId={activeSubTab}
              onChange={setActiveSubTab}
              items={[
                { id: 'overview', label: 'Visão Geral & Contrato' },
                {
                  id: 'timeline',
                  label: 'Histórico',
                  badge: client.timeline?.length || 0,
                },
                {
                  id: 'relations',
                  label: 'Relacionamentos',
                  badge: relationsBadgeCount,
                },
              ]}
            />

            <div className="flex items-center gap-2">
              <Badge variant={statusMeta.variant} dot size="md">
                {statusMeta.label}
              </Badge>
              <Select
                value={client.status}
                onChange={(e) => handleStatusChange(e.target.value as ClientStatus)}
                className="w-40"
              >
                {CLIENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {activeSubTab === 'overview' && (
            <div className="space-y-5">
              {/* Contract Value Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/70 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">Recorrência (MRR)</div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-[var(--kz-success-text)]">
                    R$ {(client.monthlyMrr || 0).toLocaleString('pt-BR')}/mês
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/70 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">Implantação (Setup)</div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-[var(--kz-text-primary)]">
                    R$ {(client.setupValue || 0).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/70 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">Dia de Cobrança</div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-[var(--kz-text-primary)]">
                    Todo dia {client.billingDay || 10}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/70 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">Vigência Inicial</div>
                  <div className="mt-1 text-sm font-semibold font-mono text-[var(--kz-text-primary)]">
                    {client.contractStartDate
                      ? client.contractStartDate.split('-').reverse().join('/')
                      : new Date(client.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[var(--kz-bg-canvas)]/70 border border-[var(--kz-border-subtle)] space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 font-bold text-[var(--kz-text-primary)]">
                    <Building2 className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>Dados Cadastrais</span>
                  </div>
                  <div className="space-y-1.5 text-[var(--kz-text-secondary)]">
                    <div>
                      <span className="text-[var(--kz-text-muted)]">Responsável:</span>{' '}
                      {client.contactName || 'Não informado'}
                    </div>
                    <div>
                      <span className="text-[var(--kz-text-muted)]">CPF/CNPJ:</span>{' '}
                      <span className="font-mono">{client.document || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--kz-text-muted)]">E-mail:</span>{' '}
                      {client.email || 'Não informado'}
                    </div>
                    <div>
                      <span className="text-[var(--kz-text-muted)]">WhatsApp:</span>{' '}
                      <span className="font-mono">{client.displayPhone || client.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--kz-text-muted)]">Endereço:</span>{' '}
                      {[client.address, client.city].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--kz-bg-canvas)]/70 border border-[var(--kz-border-subtle)] space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 font-bold text-[var(--kz-text-primary)]">
                    <Globe className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>Infraestrutura & Publicação</span>
                  </div>
                  <div className="space-y-1.5 text-[var(--kz-text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[var(--kz-text-subtle)] shrink-0" />
                      <span className="text-[var(--kz-text-muted)]">Domínio:</span>
                      <span className="font-mono text-[var(--kz-text-primary)]">
                        {client.domainName || 'Não configurado'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-[var(--kz-text-subtle)] shrink-0" />
                      <span className="text-[var(--kz-text-muted)]">Hospedagem:</span>
                      <span>{client.hostingProvider || 'Não informada'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[var(--kz-text-subtle)] shrink-0" />
                      <span className="text-[var(--kz-text-muted)]">Renovação:</span>
                      <span className="font-mono">
                        {client.contractRenewalDate
                          ? client.contractRenewalDate.split('-').reverse().join('/')
                          : 'Recorrência contínua'}
                      </span>
                    </div>
                    {client.websiteUrl && (
                      <div className="pt-1">
                        <a
                          href={
                            client.websiteUrl.startsWith('http')
                              ? client.websiteUrl
                              : `https://${client.websiteUrl}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--kz-accent-text)] hover:underline font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Abrir site do cliente</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(client.serviceScope || client.notes) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-1.5">
                    <div className="text-xs font-bold text-[var(--kz-text-primary)]">
                      Escopo Contratado
                    </div>
                    <p className="text-xs text-[var(--kz-text-secondary)] whitespace-pre-wrap leading-relaxed">
                      {client.serviceScope || 'Não detalhado.'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-1.5">
                    <div className="text-xs font-bold text-[var(--kz-text-primary)]">
                      Observações Administrativas
                    </div>
                    <p className="text-xs text-[var(--kz-text-secondary)] whitespace-pre-wrap leading-relaxed">
                      {client.notes || 'Sem observações registradas.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'timeline' && (
            <div className="space-y-4">
              <form onSubmit={handleAddTimelineNote} className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Registrar entrega, alinhamento, pedido de ajuste ou histórico do cliente..."
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                  loading={isSavingNote}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Adicionar Registro
                </Button>
              </form>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {(client.timeline || []).length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--kz-text-muted)] border border-dashed border-[var(--kz-border-default)] rounded-xl">
                    Nenhum evento registrado na linha do tempo deste cliente.
                  </div>
                ) : (
                  (client.timeline || []).map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)] space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-[var(--kz-text-primary)]">
                          {evt.title}
                        </span>
                        <span className="font-mono text-[var(--kz-text-muted)]">
                          {new Date(evt.date).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                          {evt.author ? ` · ${evt.author}` : ''}
                        </span>
                      </div>
                      {evt.description && (
                        <p className="text-xs text-[var(--kz-text-secondary)] whitespace-pre-wrap">
                          {evt.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'relations' && (
            <div className="space-y-5">
              {/* Origem no CRM */}
              <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--kz-text-primary)]">
                    <Link2 className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>Origem no CRM (Lead Vinculado)</span>
                  </div>
                  {linkedLead && onOpenLeadModal && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        onClose();
                        onOpenLeadModal(linkedLead);
                      }}
                    >
                      Abrir Lead no CRM
                    </Button>
                  )}
                </div>

                {linkedLead ? (
                  <div className="text-xs text-[var(--kz-text-secondary)] flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--kz-text-primary)]">
                      {linkedLead.companyName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{linkedLead.notes?.length || 0} notas originais preservadas</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[var(--kz-text-muted)]">
                      ID: {linkedLead.id}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--kz-text-muted)]">
                    Cliente cadastrado diretamente sem vínculo com lead de prospecção.
                  </p>
                )}
              </div>

              {/* Propostas e Contratos */}
              <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--kz-text-primary)]">
                    <FileSignature className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>Propostas e Contratos ({linkedProposals.length})</span>
                  </div>
                  {onCreateProposalForClient && (
                    <Button
                      variant="outline"
                      size="xs"
                      leftIcon={<Plus className="w-3 h-3" />}
                      onClick={() => onCreateProposalForClient(client)}
                    >
                      Gerar Proposta / Contrato
                    </Button>
                  )}
                </div>

                {linkedProposals.length === 0 ? (
                  <p className="text-xs text-[var(--kz-text-muted)]">
                    Nenhuma proposta ou contrato vinculado a este cliente até o momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedProposals.map((prop) => {
                      const pMeta = getProposalStatusMeta(prop.status);
                      return (
                        <div
                          key={prop.id}
                          className="p-3 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[var(--kz-accent-text)]">
                                {prop.code}
                              </span>
                              <span className="text-xs font-semibold text-[var(--kz-text-primary)] truncate">
                                {prop.title}
                              </span>
                              <Badge variant={pMeta.variant} size="sm">
                                {pMeta.label}
                              </Badge>
                            </div>
                            <div className="text-[11px] font-mono text-[var(--kz-text-muted)]">
                              Setup R$ {prop.setupTotal.toLocaleString('pt-BR')} · MRR R${' '}
                              {prop.monthlyMrr.toLocaleString('pt-BR')}/mês
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {onPreviewProposal && (
                              <Button
                                variant="ghost"
                                size="xs"
                                leftIcon={<Eye className="w-3.5 h-3.5" />}
                                onClick={() => onPreviewProposal(prop)}
                              >
                                Visualizar
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="xs"
                              leftIcon={<Download className="w-3.5 h-3.5" />}
                              onClick={() => downloadProposalPdf(prop)}
                            >
                              PDF
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Projetos reais vinculados */}
              <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--kz-text-primary)]">
                    <FolderKanban className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>Projetos ({linkedProjects.length})</span>
                  </div>
                  {onCreateProjectForClient && (
                    <Button
                      variant="outline"
                      size="xs"
                      leftIcon={<Plus className="w-3 h-3" />}
                      onClick={() => {
                        onClose();
                        onCreateProjectForClient(client);
                      }}
                    >
                      Novo Projeto
                    </Button>
                  )}
                </div>

                {linkedProjects.length === 0 ? (
                  <p className="text-xs text-[var(--kz-text-muted)]">
                    Nenhum projeto vinculado a este cliente ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedProjects.map((proj) => {
                      const pMeta = getProjectStatusMeta(proj.status);
                      const progress = calculateProjectProgress(proj, tasks);
                      return (
                        <div
                          key={proj.id}
                          className="p-3 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-[var(--kz-text-primary)]">
                                {proj.name}
                              </span>
                              <Badge variant={pMeta.variant} size="sm">
                                {pMeta.label}
                              </Badge>
                            </div>
                            <div className="text-[11px] font-mono text-[var(--kz-text-muted)]">
                              {progress.completedTasks}/{progress.totalTasks} tarefas ({progress.percent}%)
                              {proj.dueDate
                                ? ` · Entrega ${proj.dueDate.split('-').reverse().join('/')}`
                                : ''}
                            </div>
                          </div>

                          {onOpenProject && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                onClose();
                                onOpenProject(proj.id);
                              }}
                            >
                              Abrir Projeto
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tarefas vinculadas */}
              <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--kz-text-primary)]">
                    <CheckSquare className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>Minhas Tarefas ({linkedTasks.length})</span>
                  </div>
                  {onNavigate && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        onClose();
                        onNavigate('tasks');
                      }}
                    >
                      Abrir Central de Tarefas
                    </Button>
                  )}
                </div>

                {linkedTasks.length === 0 ? (
                  <p className="text-xs text-[var(--kz-text-muted)]">
                    Nenhuma tarefa associada a este cliente ou aos seus projetos.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {linkedTasks.map((t) => {
                      const tStatus = getTaskStatusMeta(t.status);
                      const tPrio = getTaskPriorityMeta(t.priority);
                      const overdue = isTaskOverdue(t);
                      return (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div
                              className={`font-medium truncate ${
                                t.status === 'concluida'
                                  ? 'line-through text-[var(--kz-text-muted)]'
                                  : 'text-[var(--kz-text-primary)]'
                              }`}
                            >
                              {t.title}
                            </div>
                            <div className="text-[11px] font-mono text-[var(--kz-text-muted)]">
                              {t.dueDate
                                ? `Prazo ${t.dueDate.split('-').reverse().join('/')}`
                                : 'Sem prazo'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {overdue && (
                              <Badge variant="danger" size="sm">
                                Atrasada
                              </Badge>
                            )}
                            <Badge variant={tPrio.variant} size="sm">
                              {tPrio.label}
                            </Badge>
                            <Badge variant={tStatus.variant} size="sm">
                              {tStatus.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Agenda / Reuniões do cliente */}
              <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--kz-text-primary)]">
                    <Calendar className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>Reuniões & Compromissos ({linkedEvents.length})</span>
                  </div>
                  {onCreateEventForClient && (
                    <Button
                      variant="outline"
                      size="xs"
                      leftIcon={<Plus className="w-3 h-3" />}
                      onClick={() => {
                        onClose();
                        onCreateEventForClient(client);
                      }}
                    >
                      Agendar Reunião
                    </Button>
                  )}
                </div>

                {linkedEvents.length === 0 ? (
                  <p className="text-xs text-[var(--kz-text-muted)]">
                    Nenhum compromisso registrado na agenda para este cliente.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {linkedEvents.map((ev) => {
                      const evMeta = getAgendaEventTypeMeta(ev.type);
                      return (
                        <div
                          key={ev.id}
                          className="p-2.5 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--kz-text-primary)] truncate">
                              {ev.title}
                            </div>
                            <div className="text-[11px] font-mono text-[var(--kz-text-muted)]">
                              {ev.date.split('-').reverse().join('/')}
                              {ev.startTime ? ` às ${ev.startTime}` : ''}
                            </div>
                          </div>
                          <Badge variant={evMeta.variant} size="sm">
                            {evMeta.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Redes Sociais (apenas se escopo contratado ou habilitado) */}
              <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--kz-text-primary)]">
                    <Share2 className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>
                      Redes Sociais{' '}
                      {socialEligible ? `(${linkedSocialPosts.length} publicações)` : ''}
                    </span>
                  </div>
                  {socialEligible && onOpenSocialModule && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        onClose();
                        onOpenSocialModule();
                      }}
                    >
                      Abrir Redes Sociais
                    </Button>
                  )}
                </div>

                {!socialEligible ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[var(--kz-text-muted)]">
                      Este cliente não possui gestão de redes sociais no escopo contratado.
                    </p>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={handleEnableSocialManagement}
                    >
                      Habilitar Gestão Social
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div className="text-[var(--kz-text-secondary)]">
                      {linkedSocialChannels.length} canal(is) cadastrado(s) ·{' '}
                      {linkedSocialPosts.length} conteúdo(s) no calendário editorial.
                    </div>
                    {linkedSocialPosts.slice(0, 4).map((post) => {
                      const pStatus = getSocialPostStatusMeta(post.status);
                      return (
                        <div
                          key={post.id}
                          className="p-2 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] flex items-center justify-between gap-2"
                        >
                          <span className="truncate font-medium text-[var(--kz-text-primary)]">
                            {post.title}
                          </span>
                          <Badge variant={pStatus.variant} size="sm">
                            {pStatus.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Financeiro real do cliente (Etapa 4) */}
              <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--kz-text-primary)]">
                    <Wallet className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>
                      Financeiro do Cliente ({clientFinance.entries.length}{' '}
                      {clientFinance.entries.length === 1 ? 'lançamento' : 'lançamentos'})
                    </span>
                  </div>
                  {(onOpenFinance || onNavigate) && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        onClose();
                        if (onOpenFinance) onOpenFinance();
                        else onNavigate?.('finance');
                      }}
                    >
                      Abrir Financeiro
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)]">
                    <div className="text-[10px] text-[var(--kz-text-muted)]">
                      Contratado
                    </div>
                    <div className="mt-0.5 font-mono font-bold text-[var(--kz-text-primary)]">
                      {formatBrlFromCents(clientFinance.contractedSetupCents)}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--kz-text-muted)]">
                      MRR {formatBrlFromCents(clientFinance.contractedMrrCents)}/mês
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)]">
                    <div className="text-[10px] text-[var(--kz-text-muted)]">
                      Faturado
                    </div>
                    <div className="mt-0.5 font-mono font-bold text-[var(--kz-text-primary)]">
                      {formatBrlFromCents(clientFinance.billedTotalCents)}
                    </div>
                    <div className="text-[10px] text-[var(--kz-text-muted)]">
                      Dia venc. {client.billingDay || 10}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)]">
                    <div className="text-[10px] text-[var(--kz-success-text)]">
                      Recebido Real
                    </div>
                    <div className="mt-0.5 font-mono font-bold text-[var(--kz-success-text)]">
                      {formatBrlFromCents(clientFinance.receivedTotalCents)}
                    </div>
                    <div className="text-[10px] text-[var(--kz-text-muted)]">
                      {clientFinance.recentTransactions.length} baixa(s)
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)]">
                    <div
                      className={`text-[10px] ${
                        clientFinance.overdueTotalCents > 0
                          ? 'text-[var(--kz-danger-text)] font-semibold'
                          : 'text-[var(--kz-warning-text)]'
                      }`}
                    >
                      {clientFinance.overdueTotalCents > 0
                        ? `Em atraso (${clientFinance.overdueCount})`
                        : 'Em aberto'}
                    </div>
                    <div
                      className={`mt-0.5 font-mono font-bold ${
                        clientFinance.overdueTotalCents > 0
                          ? 'text-[var(--kz-danger-text)]'
                          : 'text-[var(--kz-warning-text)]'
                      }`}
                    >
                      {formatBrlFromCents(clientFinance.pendingTotalCents)}
                    </div>
                    {clientFinance.overdueTotalCents > 0 && (
                      <div className="text-[10px] font-mono text-[var(--kz-danger-text)]">
                        Vencido: {formatBrlFromCents(clientFinance.overdueTotalCents)}
                      </div>
                    )}
                  </div>
                </div>

                {clientFinance.entries.length === 0 ? (
                  <p className="text-xs text-[var(--kz-text-muted)]">
                    Nenhum lançamento financeiro vinculado a este cliente ainda. Gere uma previsão a partir de uma proposta aprovada ou cadastre diretamente no módulo Financeiro.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {clientFinance.entries.slice(0, 6).map((entry) => {
                      const effStatus = getEffectiveEntryStatus(entry);
                      const eMeta = FINANCIAL_ENTRY_STATUS_META[effStatus];
                      const pending = getEntryPendingCents(entry);
                      return (
                        <div
                          key={entry.id}
                          className="p-2.5 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--kz-text-primary)] truncate">
                              {entry.description}
                            </div>
                            <div className="text-[11px] font-mono text-[var(--kz-text-muted)]">
                              Venc. {formatDateBr(entry.dueDate)} · Total{' '}
                              {formatBrlFromCents(getEntryAllowedTotalCents(entry))}
                              {pending > 0
                                ? ` · Aberto ${formatBrlFromCents(pending)}`
                                : ''}
                            </div>
                          </div>
                          <Badge variant={eMeta.variant} size="sm">
                            {eMeta.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Alert variant="info">
                Os vínculos exibidos acima refletem exclusivamente registros reais existentes no sistema.
              </Alert>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Ficha do Cliente"
        description={
          <span>
            Deseja excluir permanentemente o cliente <strong>{client.companyName}</strong>? O lead original no CRM não será apagado.
          </span>
        }
        confirmLabel="Confirmar Exclusão"
        variant="danger"
        loading={isDeleting}
      />
    </>
  );
};
