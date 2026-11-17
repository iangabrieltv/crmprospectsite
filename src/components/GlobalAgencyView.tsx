import React, { useRef, useState } from 'react';
import { NicheCampaign, Lead, ImportedSheet } from '../types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
} from '../types/kaizen';
import {
  FinancialAuditLog,
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialSettings,
  FinancialTransaction,
} from '../types/finance';
import {
  loadLastBackupTimestamp,
  recordLastBackupTimestamp,
} from '../utils/storage';
import {
  analyzeBackupRestore,
  CompleteBackupData,
  parseAndValidateBackup,
  prepareBackupRestorePayload,
  RestoreAnalysisSummary,
  RestoreDuplicateStrategy,
  serializeCompleteBackupJson,
} from '../services/backupService';
import { fetchFullWorkspaceSnapshot } from '../utils/firebase';
import {
  Download,
  UploadCloud,
  RotateCcw,
  Plus,
  Trash2,
  Award,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Alert,
  Modal,
  ConfirmDialog,
  Input,
  Select,
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui';

export interface DeleteNicheChoice {
  nicheId: string;
  mode: 'move_leads' | 'delete_leads';
  targetNicheId?: string;
}

interface GlobalAgencyViewProps {
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
  clients?: Client[];
  proposals?: ProposalContract[];
  projects?: Project[];
  tasks?: Task[];
  agendaEvents?: AgendaEvent[];
  socialChannels?: SocialChannel[];
  socialPosts?: SocialPost[];
  financialEntries?: FinancialEntry[];
  financialTransactions?: FinancialTransaction[];
  financialCategories?: FinancialCategory[];
  financialRecurrences?: FinancialRecurrence[];
  financialSettings?: FinancialSettings;
  financialAuditLogs?: FinancialAuditLog[];
  userName: string;
  onSelectNiche: (nicheId: string) => void;
  onOpenNewNicheModal: () => void;
  onDeleteNiche: (choice: DeleteNicheChoice) => Promise<void>;
  onRestoreBackup: (payload: {
    niches: NicheCampaign[];
    leads: Lead[];
    importedSheets: ImportedSheet[];
    clients?: Client[];
    proposals?: ProposalContract[];
    projects?: Project[];
    tasks?: Task[];
    agendaEvents?: AgendaEvent[];
    socialChannels?: SocialChannel[];
    socialPosts?: SocialPost[];
    financialEntries?: FinancialEntry[];
    financialTransactions?: FinancialTransaction[];
    financialCategories?: FinancialCategory[];
    financialRecurrences?: FinancialRecurrence[];
    financialSettings?: FinancialSettings;
    financialAuditLogs?: FinancialAuditLog[];
    userName?: string;
  }) => Promise<void>;
  onResetToCleanBaseline?: () => Promise<void>;
}

function triggerJsonDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const GlobalAgencyView: React.FC<GlobalAgencyViewProps> = ({
  niches,
  leads,
  importedSheets,
  clients = [],
  proposals = [],
  projects = [],
  tasks = [],
  agendaEvents = [],
  socialChannels = [],
  socialPosts = [],
  financialEntries = [],
  financialTransactions = [],
  financialCategories = [],
  financialRecurrences = [],
  financialSettings,
  financialAuditLogs = [],
  userName,
  onSelectNiche,
  onOpenNewNicheModal,
  onDeleteNiche,
  onRestoreBackup,
  onResetToCleanBaseline,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Restore modal state
  const [pendingRestore, setPendingRestore] = useState<{
    backup: CompleteBackupData;
    analysis: RestoreAnalysisSummary;
    warnings: string[];
  } | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<RestoreDuplicateStrategy>('skip_phone_duplicates');
  const [createSafetySnapshotBeforeRestore, setCreateSafetySnapshotBeforeRestore] =
    useState(true);
  const [isRestoring, setIsRestoring] = useState(false);

  // Niche deletion modal state
  const [nicheToDelete, setNicheToDelete] = useState<{
    niche: NicheCampaign;
    linkedLeadsCount: number;
  } | null>(null);
  const [deleteMode, setDeleteMode] = useState<'move_leads' | 'delete_leads'>('move_leads');
  const [targetNicheId, setTargetNicheId] = useState<string>('');
  const [isDeletingNiche, setIsDeletingNiche] = useState(false);

  // Clean baseline reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const lastBackupAt = loadLastBackupTimestamp();

  // Agency Global Aggregates
  const totalLeads = leads.length;
  const closedLeads = leads.filter((l) => l.stage === 'fechado');
  const totalClosedCount = closedLeads.length;
  const totalSetupRevenue = closedLeads.reduce((acc, l) => acc + (l.creationValue || 0), 0);
  const totalMrrRevenue = closedLeads.reduce((acc, l) => acc + (l.monthlyMrr || 0), 0);

  const globalConversionRate =
    totalLeads > 0 ? ((totalClosedCount / totalLeads) * 100).toFixed(1) : '0.0';

  const nicheAnalytics = niches.map((niche) => {
    const nicheLeads = leads.filter((l) => l.nicheId === niche.id);
    const nTotal = nicheLeads.length;
    const nClosed = nicheLeads.filter((l) => l.stage === 'fechado');
    const nInterested = nicheLeads.filter(
      (l) => l.stage === 'reuniao_marcada' || l.stage === 'interessado'
    ).length;
    const nContacted = nicheLeads.filter(
      (l) => l.stage !== 'leads_sem_contato' && l.stage !== 'nao_iniciada'
    ).length;
    const nSetup = nClosed.reduce((acc, l) => acc + (l.creationValue || 0), 0);
    const nMrr = nClosed.reduce((acc, l) => acc + (l.monthlyMrr || 0), 0);
    const conversion = nTotal > 0 ? (nClosed.length / nTotal) * 100 : 0;

    return {
      niche,
      totalLeads: nTotal,
      contacted: nContacted,
      interested: nInterested,
      closed: nClosed.length,
      conversionRate: conversion,
      setupRevenue: nSetup,
      mrrRevenue: nMrr,
    };
  });

  const sortedByMrr = [...nicheAnalytics].sort(
    (a, b) => b.mrrRevenue - a.mrrRevenue || b.conversionRate - a.conversionRate
  );
  const championNiche = sortedByMrr[0];

  const handleExportJson = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      let exportNiches = niches;
      let exportLeads = leads;
      let exportSheets = importedSheets;
      let exportClients = clients;
      let exportProposals = proposals;
      let exportProjects = projects;
      let exportTasks = tasks;
      let exportAgendaEvents = agendaEvents;
      let exportSocialChannels = socialChannels;
      let exportSocialPosts = socialPosts;
      let exportFinancialEntries = financialEntries;
      let exportFinancialTransactions = financialTransactions;
      let exportFinancialCategories = financialCategories;
      let exportFinancialRecurrences = financialRecurrences;
      let exportFinancialSettings = financialSettings;
      let exportFinancialAuditLogs = financialAuditLogs;
      let fromCloud = false;

      try {
        const snapshot = await fetchFullWorkspaceSnapshot();
        if (
          snapshot.niches.length > 0 ||
          snapshot.leads.length > 0 ||
          snapshot.importedSheets.length > 0 ||
          snapshot.clients.length > 0 ||
          snapshot.proposals.length > 0 ||
          snapshot.projects.length > 0 ||
          snapshot.tasks.length > 0 ||
          snapshot.agendaEvents.length > 0 ||
          snapshot.socialChannels.length > 0 ||
          snapshot.socialPosts.length > 0 ||
          snapshot.financialEntries.length > 0 ||
          snapshot.financialTransactions.length > 0 ||
          snapshot.financialCategories.length > 0 ||
          snapshot.financialRecurrences.length > 0 ||
          Boolean(snapshot.financialSettings) ||
          snapshot.financialAuditLogs.length > 0
        ) {
          exportNiches = snapshot.niches;
          exportLeads = snapshot.leads;
          exportSheets = snapshot.importedSheets;
          if (snapshot.clients.length > 0) exportClients = snapshot.clients;
          if (snapshot.proposals.length > 0) exportProposals = snapshot.proposals;
          if (snapshot.projects.length > 0) exportProjects = snapshot.projects;
          if (snapshot.tasks.length > 0) exportTasks = snapshot.tasks;
          if (snapshot.agendaEvents.length > 0) exportAgendaEvents = snapshot.agendaEvents;
          if (snapshot.socialChannels.length > 0) exportSocialChannels = snapshot.socialChannels;
          if (snapshot.socialPosts.length > 0) exportSocialPosts = snapshot.socialPosts;
          if (snapshot.financialEntries.length > 0)
            exportFinancialEntries = snapshot.financialEntries;
          if (snapshot.financialTransactions.length > 0)
            exportFinancialTransactions = snapshot.financialTransactions;
          if (snapshot.financialCategories.length > 0)
            exportFinancialCategories = snapshot.financialCategories;
          if (snapshot.financialRecurrences.length > 0)
            exportFinancialRecurrences = snapshot.financialRecurrences;
          if (snapshot.financialSettings)
            exportFinancialSettings = snapshot.financialSettings;
          if (snapshot.financialAuditLogs.length > 0)
            exportFinancialAuditLogs = snapshot.financialAuditLogs;
          fromCloud = true;
        }
      } catch {
        fromCloud = false;
      }

      const jsonStr = serializeCompleteBackupJson({
        niches: exportNiches,
        leads: exportLeads,
        importedSheets: exportSheets,
        clients: exportClients,
        proposals: exportProposals,
        projects: exportProjects,
        tasks: exportTasks,
        agendaEvents: exportAgendaEvents,
        socialChannels: exportSocialChannels,
        socialPosts: exportSocialPosts,
        financialEntries: exportFinancialEntries,
        financialTransactions: exportFinancialTransactions,
        financialCategories: exportFinancialCategories,
        financialRecurrences: exportFinancialRecurrences,
        financialSettings: exportFinancialSettings,
        financialAuditLogs: exportFinancialAuditLogs,
        userName,
      });

      const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      triggerJsonDownload(`kaizen_backup_v3_${dateTag}.json`, jsonStr);
      recordLastBackupTimestamp();

      setFeedbackMessage(
        `Backup completo v3.0 exportado (${exportNiches.length} nichos, ${exportLeads.length} leads, ${exportClients.length} clientes, ${exportProposals.length} propostas, ${exportProjects.length} projetos, ${exportTasks.length} tarefas, ${exportFinancialEntries.length} lançamentos financeiros${
          fromCloud ? ' — validado direto do Firestore' : ' — a partir do estado local em memória'
        }).`
      );
      setTimeout(() => setFeedbackMessage(null), 6000);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Falha ao gerar backup JSON: ${err.message}`
          : 'Erro desconhecido ao exportar o backup JSON.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setFeedbackMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const validation = parseAndValidateBackup(content);
      if (!validation.ok || !validation.data) {
        setErrorMessage(validation.error || 'Arquivo de backup inválido.');
        return;
      }

      const analysis = analyzeBackupRestore(validation.data, {
        niches,
        leads,
        importedSheets,
      });

      setDuplicateStrategy('skip_phone_duplicates');
      setCreateSafetySnapshotBeforeRestore(true);
      setPendingRestore({
        backup: validation.data,
        analysis,
        warnings: validation.warnings,
      });
    };
    reader.onerror = () => {
      setErrorMessage('Não foi possível ler o arquivo selecionado.');
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setIsRestoring(true);
    setErrorMessage(null);

    try {
      if (createSafetySnapshotBeforeRestore) {
        const safetyJson = serializeCompleteBackupJson({
          niches,
          leads,
          importedSheets,
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
          userName,
        });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        triggerJsonDownload(`kaizen_pre_restore_safety_${stamp}.json`, safetyJson);
        recordLastBackupTimestamp();
      }

      const prepared = prepareBackupRestorePayload(
        pendingRestore.backup,
        { niches, leads, importedSheets },
        duplicateStrategy
      );

      await onRestoreBackup({
        niches: prepared.nichesToWrite,
        leads: prepared.leadsToWrite,
        importedSheets: prepared.sheetsToWrite,
        clients: prepared.clientsToWrite,
        proposals: prepared.proposalsToWrite,
        projects: prepared.projectsToWrite,
        tasks: prepared.tasksToWrite,
        agendaEvents: prepared.agendaEventsToWrite,
        socialChannels: prepared.socialChannelsToWrite,
        socialPosts: prepared.socialPostsToWrite,
        financialEntries: prepared.financialEntriesToWrite,
        financialTransactions: prepared.financialTransactionsToWrite,
        financialCategories: prepared.financialCategoriesToWrite,
        financialRecurrences: prepared.financialRecurrencesToWrite,
        financialSettings: prepared.financialSettingsToWrite,
        financialAuditLogs: prepared.financialAuditLogsToWrite,
        userName: pendingRestore.backup.userName,
      });

      setPendingRestore(null);
      setFeedbackMessage(
        `Backup restaurado e sincronizado: ${prepared.nichesToWrite.length} nichos, ${prepared.leadsToWrite.length} leads, ${prepared.clientsToWrite.length} clientes, ${prepared.proposalsToWrite.length} propostas, ${prepared.projectsToWrite.length} projetos, ${prepared.tasksToWrite.length} tarefas, ${prepared.financialEntriesToWrite.length} lançamentos financeiros` +
          (prepared.skippedDuplicates > 0
            ? ` (${prepared.skippedDuplicates} duplicados ignorados por telefone).`
            : '.')
      );
      setTimeout(() => setFeedbackMessage(null), 6000);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Falha ao restaurar backup no Firestore: ${err.message}`
          : 'Erro ao gravar dados restaurados no Firestore. Nenhum dado foi perdido.'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleOpenDeleteNicheModal = (niche: NicheCampaign, linkedLeadsCount: number) => {
    const otherNiches = niches.filter((n) => n.id !== niche.id);
    setDeleteMode(
      linkedLeadsCount > 0 && otherNiches.length > 0 ? 'move_leads' : 'delete_leads'
    );
    setTargetNicheId(otherNiches[0]?.id || '');
    setNicheToDelete({ niche, linkedLeadsCount });
  };

  const handleConfirmDeleteNiche = async () => {
    if (!nicheToDelete) return;
    setIsDeletingNiche(true);
    setErrorMessage(null);

    try {
      await onDeleteNiche({
        nicheId: nicheToDelete.niche.id,
        mode: nicheToDelete.linkedLeadsCount === 0 ? 'delete_leads' : deleteMode,
        targetNicheId: deleteMode === 'move_leads' ? targetNicheId : undefined,
      });
      setFeedbackMessage(
        nicheToDelete.linkedLeadsCount > 0 && deleteMode === 'move_leads'
          ? `Nicho "${nicheToDelete.niche.name}" removido e ${nicheToDelete.linkedLeadsCount} leads transferidos com segurança.`
          : `Nicho "${nicheToDelete.niche.name}" excluído do Firestore.`
      );
      setNicheToDelete(null);
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Erro ao excluir nicho no Firestore: ${err.message}`
          : 'Falha ao excluir nicho no Firestore.'
      );
    } finally {
      setIsDeletingNiche(false);
    }
  };

  const handleConfirmCleanReset = async () => {
    if (!onResetToCleanBaseline) return;
    setIsResetting(true);
    setErrorMessage(null);

    try {
      await onResetToCleanBaseline();
      setIsResetModalOpen(false);
      setResetConfirmText('');
      setFeedbackMessage('Base zerada na nuvem e localmente para o estado inicial limpo.');
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Falha ao zerar base no Firestore: ${err.message}`
          : 'Falha ao zerar base no Firestore.'
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-[var(--kz-border-subtle)] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="kz-page-title">Relatórios Comparativos & Governança da Agência</h2>
          <p className="kz-subtitle mt-1">
            Comparativo consolidado de performance entre nichos, exportação/restauração v3.0 e
            governança da base no Cloud Firestore.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onOpenNewNicheModal}
          className="self-start sm:self-auto"
        >
          Criar Novo Nicho
        </Button>
      </div>

      {/* Feedback banners */}
      {feedbackMessage && (
        <Alert variant="success" onDismiss={() => setFeedbackMessage(null)}>
          {feedbackMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="danger" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Global Agency Aggregate KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Campanhas & Contatos Consolidados
          </span>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {totalLeads}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Distribuídos em {niches.length} {niches.length === 1 ? 'nicho' : 'nichos'}
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Fechamentos na Agência
          </span>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-success-text)]">
            {totalClosedCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Taxa média: {globalConversionRate}%
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Setup Total Faturado
          </span>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-text-primary)]">
            R$ {totalSetupRevenue.toLocaleString('pt-BR')}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Criação e lançamento
          </div>
        </Card>

        <Card padding="md" className="border-[var(--kz-success-border)] bg-[var(--kz-success-bg)]/40">
          <span className="text-[11px] font-bold text-[var(--kz-success-text)] block">
            MRR Total Consolidado
          </span>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-success-text)]">
            R$ {totalMrrRevenue.toLocaleString('pt-BR')}/mês
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-success-text)] font-mono font-medium">
            Recorrência ativa mensal
          </div>
        </Card>
      </div>

      {/* Comparative Matrix Table */}
      <Card padding="lg" className="space-y-4">
        <CardHeader>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Painel Comparativo de Performance por Nicho</CardTitle>
              {championNiche && (
                <Badge variant="accent" size="md">
                  <Award className="w-3 h-3" />
                  Nicho Mais Rentável: {championNiche.niche.name}
                </Badge>
              )}
            </div>
            <CardDescription>
              Compare qual segmento gera o melhor retorno sobre o tempo investido em prospecção.
            </CardDescription>
          </div>
        </CardHeader>

        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Campanha / Nicho</TableHead>
                <TableHead>Cidade Base</TableHead>
                <TableHead className="text-right">Contatos</TableHead>
                <TableHead className="text-right">Contatados</TableHead>
                <TableHead className="text-right">Interessados</TableHead>
                <TableHead className="text-right">Fechamentos</TableHead>
                <TableHead className="text-right">Taxa Conv.</TableHead>
                <TableHead className="text-right">Setup Faturado</TableHead>
                <TableHead className="text-right">MRR Recorrente</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono tabular-nums">
              {nicheAnalytics.map((item) => {
                const isChampion = championNiche && championNiche.niche.id === item.niche.id;
                return (
                  <TableRow
                    key={item.niche.id}
                    className={isChampion ? 'bg-[var(--kz-accent-soft)] font-medium' : ''}
                  >
                    <TableCell className="font-sans">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.niche.emoji}</span>
                        <div>
                          <div className="font-semibold text-[var(--kz-text-primary)] flex items-center gap-1.5">
                            <span>{item.niche.name}</span>
                            {isChampion && (
                              <Award className="w-3.5 h-3.5 text-[var(--kz-accent)] shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--kz-text-muted)] font-normal">
                            {item.niche.segment}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-sans text-[var(--kz-text-secondary)]">
                      {item.niche.city}
                    </TableCell>
                    <TableCell className="text-right text-[var(--kz-text-primary)]">
                      {item.totalLeads}
                    </TableCell>
                    <TableCell className="text-right text-[var(--kz-text-secondary)]">
                      {item.contacted}
                    </TableCell>
                    <TableCell className="text-right text-[var(--kz-warning-text)]">
                      {item.interested}
                    </TableCell>
                    <TableCell className="text-right text-[var(--kz-success-text)] font-bold">
                      {item.closed}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={item.conversionRate >= 15 ? 'success' : 'neutral'}>
                        {item.conversionRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {item.setupRevenue.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right text-[var(--kz-success-text)] font-bold">
                      R$ {item.mrrRevenue.toLocaleString('pt-BR')}/mês
                    </TableCell>
                    <TableCell className="text-center font-sans">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          rightIcon={<ArrowUpRight className="w-3 h-3" />}
                          onClick={() => onSelectNiche(item.niche.id)}
                          className="text-[var(--kz-accent-text)]"
                        >
                          Abrir
                        </Button>
                        {niches.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteNicheModal(item.niche, item.totalLeads)}
                            className="p-1 text-[var(--kz-text-subtle)] hover:text-[var(--kz-danger-solid)] rounded transition-colors cursor-pointer"
                            title="Excluir nicho"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Backup, Restore & Data Governance */}
      <Card padding="lg" className="space-y-4">
        <CardHeader>
          <CardTitle>Backup Completo (v3.0), Restauração Segura & Governança</CardTitle>
          <span className="text-[11px] text-[var(--kz-text-muted)]">
            Último backup neste navegador:{' '}
            <strong className="text-[var(--kz-text-primary)]">
              {lastBackupAt ? new Date(lastBackupAt).toLocaleString('pt-BR') : 'Não registrado'}
            </strong>
          </span>
        </CardHeader>

        <p className="text-xs text-[var(--kz-text-secondary)] leading-relaxed">
          O backup v3.0 exporta integralmente <strong>leads</strong> (com notas, reuniões e
          retornos), <strong>nichos e scripts</strong>, e o{' '}
          <strong>histórico de planilhas importadas ({importedSheets.length})</strong> com
          validação de integridade, diretamente do Cloud Firestore.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            variant="primary"
            size="md"
            loading={isExporting}
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportJson}
          >
            {isExporting ? 'Coletando do Firestore...' : 'Exportar Backup Completo (JSON v3.0)'}
          </Button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <Button
            variant="outline"
            size="md"
            leftIcon={<UploadCloud className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Restaurar Backup (com Pré-visualização)
          </Button>

          {onResetToCleanBaseline && (
            <Button
              variant="ghost"
              size="md"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => {
                setResetConfirmText('');
                setIsResetModalOpen(true);
              }}
              className="text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)] sm:ml-auto"
            >
              Zerar Base para Padrão Inicial
            </Button>
          )}
        </div>
      </Card>

      {/* Modal: Safe Restore Preview */}
      <Modal
        isOpen={Boolean(pendingRestore)}
        onClose={() => setPendingRestore(null)}
        size="md"
        closeDisabled={isRestoring}
        title="Pré-visualização da Restauração de Backup"
        subtitle={
          pendingRestore
            ? `Versão ${pendingRestore.analysis.version} • Exportado em ${new Date(
                pendingRestore.analysis.exportedAt
              ).toLocaleString('pt-BR')}`
            : undefined
        }
        icon={
          <div className="w-9 h-9 rounded-full bg-[var(--kz-accent-soft)] flex items-center justify-center text-[var(--kz-accent-text)]">
            <ShieldCheck className="w-5 h-5" />
          </div>
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingRestore(null)} disabled={isRestoring}>
              Cancelar
            </Button>
            <Button variant="primary" loading={isRestoring} onClick={handleConfirmRestore}>
              {isRestoring ? 'Sincronizando...' : 'Confirmar e Restaurar'}
            </Button>
          </>
        }
      >
        {pendingRestore && (
          <div className="space-y-4">
            {pendingRestore.warnings.length > 0 && (
              <Alert variant="warning">
                {pendingRestore.warnings.map((w, i) => (
                  <p key={i}>• {w}</p>
                ))}
              </Alert>
            )}

            <div className="bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] rounded-xl p-3.5 text-xs space-y-1.5 text-[var(--kz-text-secondary)]">
              <div className="font-semibold text-[var(--kz-text-primary)] mb-1">
                Resumo do arquivo validado:
              </div>
              <div>
                • <strong>Nichos/Campanhas:</strong> {pendingRestore.analysis.totalNichesInFile} no
                arquivo ({pendingRestore.analysis.nichesNew} novos,{' '}
                {pendingRestore.analysis.nichesExisting} já existentes por ID)
              </div>
              <div>
                • <strong>Leads:</strong> {pendingRestore.analysis.totalLeadsInFile} no arquivo (
                {pendingRestore.analysis.leadsNew} novos,{' '}
                {pendingRestore.analysis.leadsExistingById} existentes por ID)
              </div>
              <div>
                • <strong>Planilhas importadas:</strong>{' '}
                {pendingRestore.analysis.totalSheetsInFile} no arquivo (
                {pendingRestore.analysis.sheetsNew} novas, {pendingRestore.analysis.sheetsExisting}{' '}
                existentes)
              </div>
              {(pendingRestore.backup.clients?.length || 0) > 0 && (
                <div>
                  • <strong>Clientes:</strong> {pendingRestore.backup.clients?.length} no arquivo
                </div>
              )}
              {(pendingRestore.backup.proposals?.length || 0) > 0 && (
                <div>
                  • <strong>Propostas & Contratos:</strong>{' '}
                  {pendingRestore.backup.proposals?.length} no arquivo
                </div>
              )}
              {(pendingRestore.backup.projects?.length || 0) > 0 && (
                <div>
                  • <strong>Projetos:</strong> {pendingRestore.backup.projects?.length} no arquivo
                </div>
              )}
              {(pendingRestore.backup.tasks?.length || 0) > 0 && (
                <div>
                  • <strong>Minhas Tarefas:</strong> {pendingRestore.backup.tasks?.length} no arquivo
                </div>
              )}
              {(pendingRestore.backup.agendaEvents?.length || 0) > 0 && (
                <div>
                  • <strong>Agenda Integrada:</strong>{' '}
                  {pendingRestore.backup.agendaEvents?.length} compromissos no arquivo
                </div>
              )}
              {((pendingRestore.backup.socialChannels?.length || 0) > 0 ||
                (pendingRestore.backup.socialPosts?.length || 0) > 0) && (
                <div>
                  • <strong>Redes Sociais:</strong>{' '}
                  {pendingRestore.backup.socialChannels?.length || 0} canais e{' '}
                  {pendingRestore.backup.socialPosts?.length || 0} publicações no arquivo
                </div>
              )}
              {((pendingRestore.backup.financialEntries?.length || 0) > 0 ||
                (pendingRestore.backup.financialTransactions?.length || 0) > 0 ||
                (pendingRestore.backup.financialRecurrences?.length || 0) > 0) && (
                <div>
                  • <strong>Financeiro:</strong>{' '}
                  {pendingRestore.backup.financialEntries?.length || 0} lançamentos,{' '}
                  {pendingRestore.backup.financialTransactions?.length || 0} movimentações e{' '}
                  {pendingRestore.backup.financialRecurrences?.length || 0} recorrências
                </div>
              )}
              {pendingRestore.analysis.leadsPotentialPhoneDuplicates > 0 && (
                <div className="text-[var(--kz-warning-text)] font-medium pt-1">
                  ⚠ {pendingRestore.analysis.leadsPotentialPhoneDuplicates} novos leads possuem
                  telefone já existente no mesmo nicho.
                </div>
              )}
              {pendingRestore.analysis.orphanLeadsInFile > 0 && (
                <div className="text-[var(--kz-warning-text)] font-medium">
                  ⚠ {pendingRestore.analysis.orphanLeadsInFile} leads referenciam um nicho ausente.
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <label className="block kz-label">Tratamento de possíveis duplicidades:</label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="restoreDupStrategy"
                    checked={duplicateStrategy === 'skip_phone_duplicates'}
                    onChange={() => setDuplicateStrategy('skip_phone_duplicates')}
                  />
                  <span>Ignorar novos leads com telefone duplicado no mesmo nicho (recomendado)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="restoreDupStrategy"
                    checked={duplicateStrategy === 'merge_by_id'}
                    onChange={() => setDuplicateStrategy('merge_by_id')}
                  />
                  <span>Mesclar todos os registros preservando os IDs originais</span>
                </label>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[var(--kz-text-secondary)] cursor-pointer bg-[var(--kz-success-bg)] p-2.5 rounded-xl border border-[var(--kz-success-border)]">
              <input
                type="checkbox"
                checked={createSafetySnapshotBeforeRestore}
                onChange={(e) => setCreateSafetySnapshotBeforeRestore(e.target.checked)}
                className="rounded text-[var(--kz-success-solid)]"
              />
              <span>
                Baixar cópia de segurança do estado atual automaticamente antes de restaurar
              </span>
            </label>
          </div>
        )}
      </Modal>

      {/* Modal: Explicit Niche Deletion */}
      <ConfirmDialog
        isOpen={Boolean(nicheToDelete)}
        onClose={() => setNicheToDelete(null)}
        onConfirm={handleConfirmDeleteNiche}
        title={nicheToDelete ? `Excluir Nicho "${nicheToDelete.niche.name}"` : 'Excluir Nicho'}
        description={
          nicheToDelete ? `${nicheToDelete.linkedLeadsCount} leads vinculados neste nicho.` : ''
        }
        confirmLabel={isDeletingNiche ? 'Aplicando...' : 'Confirmar Exclusão'}
        variant="danger"
        loading={isDeletingNiche}
        confirmDisabled={
          Boolean(
            nicheToDelete &&
              nicheToDelete.linkedLeadsCount > 0 &&
              deleteMode === 'move_leads' &&
              !targetNicheId
          )
        }
      >
        {nicheToDelete && nicheToDelete.linkedLeadsCount > 0 ? (
          <div className="space-y-3">
            <p>
              Para não deixar leads órfãos no Firestore, escolha o destino dos{' '}
              <strong>{nicheToDelete.linkedLeadsCount} leads</strong> vinculados a esta campanha:
            </p>

            <label className="flex items-start gap-2 p-2.5 rounded-xl border border-[var(--kz-border-subtle)] cursor-pointer hover:bg-[var(--kz-bg-canvas)]">
              <input
                type="radio"
                name="nicheDeleteMode"
                checked={deleteMode === 'move_leads'}
                onChange={() => setDeleteMode('move_leads')}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1.5">
                <span className="font-semibold text-[var(--kz-text-primary)] block">
                  Transferir leads para outro nicho (recomendado)
                </span>
                {deleteMode === 'move_leads' && (
                  <Select
                    value={targetNicheId}
                    onChange={(e) => setTargetNicheId(e.target.value)}
                  >
                    {niches
                      .filter((n) => n.id !== nicheToDelete.niche.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.emoji} {n.name}
                        </option>
                      ))}
                  </Select>
                )}
              </div>
            </label>

            <label className="flex items-start gap-2 p-2.5 rounded-xl border border-[var(--kz-danger-border)] bg-[var(--kz-danger-bg)]/70 cursor-pointer">
              <input
                type="radio"
                name="nicheDeleteMode"
                checked={deleteMode === 'delete_leads'}
                onChange={() => setDeleteMode('delete_leads')}
                className="mt-0.5"
              />
              <div>
                <span className="font-semibold text-[var(--kz-danger-text)] block">
                  Excluir o nicho e apagar os {nicheToDelete.linkedLeadsCount} leads do Firestore
                </span>
                <span className="text-[11px] text-[var(--kz-danger-text)]">
                  Ação irreversível: os contatos serão removidos da coleção{' '}
                  <code className="font-mono">leads</code>.
                </span>
              </div>
            </label>
          </div>
        ) : (
          <p>
            Este nicho não possui leads vinculados. Ele será removido da coleção{' '}
            <code className="font-mono">niches</code> no Firestore.
          </p>
        )}
      </ConfirmDialog>

      {/* Modal: Clean Baseline Reset */}
      <ConfirmDialog
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmCleanReset}
        title="Zerar Base Completa (Nuvem + Local)"
        description="Operação irreversível sem backup prévio."
        confirmLabel={isResetting ? 'Zerando...' : 'Confirmar Exclusão Total'}
        variant="danger"
        loading={isResetting}
        confirmDisabled={resetConfirmText.trim().toUpperCase() !== 'ZERAR'}
      >
        <div className="bg-[var(--kz-danger-bg)] border border-[var(--kz-danger-border)] rounded-xl p-3 text-xs text-[var(--kz-danger-text)] space-y-1">
          <p className="font-semibold">Serão excluídos do Firestore:</p>
          <p>• {leads.length} leads (coleção <code className="font-mono">leads</code>)</p>
          <p>• {niches.length} nichos (coleção <code className="font-mono">niches</code>)</p>
          <p>
            • {importedSheets.length} planilhas (coleção{' '}
            <code className="font-mono">importedSheets</code>)
          </p>
        </div>

        <Input
          label="Digite ZERAR para confirmar"
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder="Digite ZERAR"
          className="font-mono"
        />
      </ConfirmDialog>
    </div>
  );
};
