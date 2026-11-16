import React, { useRef, useState } from 'react';
import { NicheCampaign, Lead, ImportedSheet } from '../types/crm';
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
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  AlertCircle,
  ShieldCheck,
  X,
} from 'lucide-react';

export interface DeleteNicheChoice {
  nicheId: string;
  mode: 'move_leads' | 'delete_leads';
  targetNicheId?: string;
}

interface GlobalAgencyViewProps {
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
  userName: string;
  onSelectNiche: (nicheId: string) => void;
  onOpenNewNicheModal: () => void;
  onDeleteNiche: (choice: DeleteNicheChoice) => Promise<void>;
  onRestoreBackup: (payload: {
    niches: NicheCampaign[];
    leads: Lead[];
    importedSheets: ImportedSheet[];
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

  // Complete v3.0 Backup Export (reads live cloud snapshot first, falls back clearly if needed)
  const handleExportJson = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      let exportNiches = niches;
      let exportLeads = leads;
      let exportSheets = importedSheets;
      let fromCloud = false;

      try {
        const snapshot = await fetchFullWorkspaceSnapshot();
        if (snapshot.niches.length > 0 || snapshot.leads.length > 0 || snapshot.importedSheets.length > 0) {
          exportNiches = snapshot.niches;
          exportLeads = snapshot.leads;
          exportSheets = snapshot.importedSheets;
          fromCloud = true;
        }
      } catch {
        fromCloud = false;
      }

      const jsonStr = serializeCompleteBackupJson({
        niches: exportNiches,
        leads: exportLeads,
        importedSheets: exportSheets,
        userName,
      });

      const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      triggerJsonDownload(`kaizen_backup_v3_${dateTag}.json`, jsonStr);
      recordLastBackupTimestamp();

      setFeedbackMessage(
        `Backup completo v3.0 exportado (${exportNiches.length} nichos, ${exportLeads.length} leads, ${exportSheets.length} planilhas${
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

  // Step 1-4 of Safe Restore: Parse, validate integrity, analyze duplicates & show explicit summary modal
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

  // Execute confirmed restore (optional pre-restore safety snapshot + awaited Firestore writes)
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
        userName: pendingRestore.backup.userName,
      });

      setPendingRestore(null);
      setFeedbackMessage(
        `Backup restaurado e sincronizado com o Firestore: ${prepared.nichesToWrite.length} nichos, ${prepared.leadsToWrite.length} leads, ${prepared.sheetsToWrite.length} planilhas` +
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

  // Open explicit niche deletion dialog
  const handleOpenDeleteNicheModal = (niche: NicheCampaign, linkedLeadsCount: number) => {
    const otherNiches = niches.filter((n) => n.id !== niche.id);
    setDeleteMode(linkedLeadsCount > 0 && otherNiches.length > 0 ? 'move_leads' : 'delete_leads');
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
      <div className="border-b border-slate-200/80 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>⚙️ Visão Global da Agência & Backup</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Painel consolidado comparando performance entre todos os nichos, exportação/restauração completa e governança de dados.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewNicheModal}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Criar Novo Nicho</span>
        </button>
      </div>

      {/* Feedback banners */}
      {feedbackMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Agency Aggregate KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Total de Leads na Agência</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {totalLeads}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Distribuídos em {niches.length} nichos
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Clientes Fechados Ativos</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {totalClosedCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Taxa média: {globalConversionRate}%
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Setup Total Faturado</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            R$ {totalSetupRevenue.toLocaleString('pt-BR')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Criação e lançamento
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs ring-1 ring-emerald-500/20 bg-emerald-50/15">
          <span className="text-[11px] font-bold text-emerald-800 block">MRR Total Consolidado</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-800">
            R$ {totalMrrRevenue.toLocaleString('pt-BR')}/mês
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-mono font-medium">
            Recorrência ativa mensal
          </div>
        </div>
      </div>

      {/* Comparative Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Painel Comparativo de Performance por Nicho</span>
              {championNiche && (
                <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-600" />
                  Nicho Mais Rentável: {championNiche.niche.name}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Compare qual segmento gera o melhor retorno sobre o tempo investido em prospecção.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-medium">
                <th className="py-2.5 px-3">Campanha / Nicho</th>
                <th className="py-2.5 px-3">Cidade Base</th>
                <th className="py-2.5 px-3 text-right">Leads</th>
                <th className="py-2.5 px-3 text-right">Contatados</th>
                <th className="py-2.5 px-3 text-right">Interessados</th>
                <th className="py-2.5 px-3 text-right">Fechamentos</th>
                <th className="py-2.5 px-3 text-right">Taxa Conv.</th>
                <th className="py-2.5 px-3 text-right">Setup Faturado</th>
                <th className="py-2.5 px-3 text-right">MRR Recorrente</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {nicheAnalytics.map((item) => {
                const isChampion = championNiche && championNiche.niche.id === item.niche.id;
                return (
                  <tr
                    key={item.niche.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isChampion ? 'bg-amber-50/20 font-medium' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.niche.emoji}</span>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{item.niche.name}</span>
                            {isChampion && (
                              <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            {item.niche.segment}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-600">{item.niche.city}</td>
                    <td className="py-3 px-3 text-right text-slate-800">{item.totalLeads}</td>
                    <td className="py-3 px-3 text-right text-slate-600">{item.contacted}</td>
                    <td className="py-3 px-3 text-right text-amber-700">{item.interested}</td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-bold">{item.closed}</td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          item.conversionRate >= 15
                            ? 'bg-emerald-100 text-emerald-800 font-bold'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.conversionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700">
                      R$ {item.setupRevenue.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-bold">
                      R$ {item.mrrRevenue.toLocaleString('pt-BR')}/mês
                    </td>
                    <td className="py-3 px-3 text-center font-sans">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectNiche(item.niche.id)}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>Abrir</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                        {niches.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteNicheModal(item.niche, item.totalLeads)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Excluir nicho"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backup, Restore & Data Governance */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-900">
            Backup Completo (v3.0), Restauração Segura & Governança
          </h3>
          <span className="text-[11px] text-slate-500">
            Último backup neste navegador:{' '}
            <strong>
              {lastBackupAt ? new Date(lastBackupAt).toLocaleString('pt-BR') : 'Não registrado'}
            </strong>
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          O backup v3.0 exporta integralmente <strong>leads</strong> (com notas, reuniões e retornos), <strong>nichos e scripts</strong>, e o <strong>histórico de planilhas importadas ({importedSheets.length})</strong> com validação de integridade, diretamente do Cloud Firestore.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Export JSON */}
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportJson}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Coletando do Firestore...' : 'Exportar Backup Completo (JSON v3.0)'}</span>
          </button>

          {/* Import JSON */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-slate-600" />
            <span>Restaurar Backup (com Pré-visualização)</span>
          </button>

          {/* Explicit Baseline Reset */}
          {onResetToCleanBaseline && (
            <button
              type="button"
              onClick={() => {
                setResetConfirmText('');
                setIsResetModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Zerar Base para Padrão Inicial</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal: Safe Restore Preview & Explicit Confirmation */}
      {pendingRestore && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pré-visualização da Restauração de Backup
                  </h3>
                  <p className="text-xs text-slate-500">
                    Versão {pendingRestore.analysis.version} • Exportado em{' '}
                    {new Date(pendingRestore.analysis.exportedAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setPendingRestore(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingRestore.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                {pendingRestore.warnings.map((w, i) => (
                  <p key={i}>• {w}</p>
                ))}
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-1.5 text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">Resumo do arquivo validado:</div>
              <div>
                • <strong>Nichos/Campanhas:</strong> {pendingRestore.analysis.totalNichesInFile} no arquivo (
                {pendingRestore.analysis.nichesNew} novos, {pendingRestore.analysis.nichesExisting} já existentes por ID)
              </div>
              <div>
                • <strong>Leads:</strong> {pendingRestore.analysis.totalLeadsInFile} no arquivo (
                {pendingRestore.analysis.leadsNew} novos, {pendingRestore.analysis.leadsExistingById} existentes por ID)
              </div>
              <div>
                • <strong>Planilhas importadas:</strong> {pendingRestore.analysis.totalSheetsInFile} no arquivo (
                {pendingRestore.analysis.sheetsNew} novas, {pendingRestore.analysis.sheetsExisting} existentes)
              </div>
              {pendingRestore.analysis.leadsPotentialPhoneDuplicates > 0 && (
                <div className="text-amber-800 font-medium pt-1">
                  ⚠ {pendingRestore.analysis.leadsPotentialPhoneDuplicates} novos leads possuem telefone já existente no mesmo nicho.
                </div>
              )}
              {pendingRestore.analysis.orphanLeadsInFile > 0 && (
                <div className="text-amber-800 font-medium">
                  ⚠ {pendingRestore.analysis.orphanLeadsInFile} leads referenciam um nicho ausente.
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-semibold text-slate-700">
                Tratamento de possíveis duplicidades:
              </label>
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

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200">
              <input
                type="checkbox"
                checked={createSafetySnapshotBeforeRestore}
                onChange={(e) => setCreateSafetySnapshotBeforeRestore(e.target.checked)}
                className="rounded text-emerald-600"
              />
              <span>
                Baixar cópia de segurança do estado atual automaticamente antes de restaurar
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setPendingRestore(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-60"
              >
                {isRestoring ? 'Sincronizando com Firestore...' : 'Confirmar e Restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Explicit Niche Deletion with Orphan Lead Handling */}
      {nicheToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Excluir Nicho "{nicheToDelete.niche.name}"
                </h3>
                <p className="text-xs text-slate-500">
                  {nicheToDelete.linkedLeadsCount} leads vinculados neste nicho
                </p>
              </div>
            </div>

            {nicheToDelete.linkedLeadsCount > 0 ? (
              <div className="space-y-3 text-xs text-slate-700">
                <p>
                  Para não deixar leads órfãos no Firestore, escolha o destino dos{' '}
                  <strong>{nicheToDelete.linkedLeadsCount} leads</strong> vinculados a esta campanha:
                </p>

                <label className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="nicheDeleteMode"
                    checked={deleteMode === 'move_leads'}
                    onChange={() => setDeleteMode('move_leads')}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1.5">
                    <span className="font-semibold text-slate-900 block">
                      Transferir leads para outro nicho (recomendado)
                    </span>
                    {deleteMode === 'move_leads' && (
                      <select
                        value={targetNicheId}
                        onChange={(e) => setTargetNicheId(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
                      >
                        {niches
                          .filter((n) => n.id !== nicheToDelete.niche.id)
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.emoji} {n.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </label>

                <label className="flex items-start gap-2 p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 cursor-pointer hover:bg-rose-50">
                  <input
                    type="radio"
                    name="nicheDeleteMode"
                    checked={deleteMode === 'delete_leads'}
                    onChange={() => setDeleteMode('delete_leads')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-rose-900 block">
                      Excluir o nicho e apagar os {nicheToDelete.linkedLeadsCount} leads do Firestore
                    </span>
                    <span className="text-[11px] text-rose-700">
                      Ação irreversível: os contatos serão removidos da coleção <code className="font-mono">leads</code>.
                    </span>
                  </div>
                </label>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Este nicho não possui leads vinculados. Ele será removido da coleção <code className="font-mono">niches</code> no Firestore.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingNiche}
                onClick={() => setNicheToDelete(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingNiche || (nicheToDelete.linkedLeadsCount > 0 && deleteMode === 'move_leads' && !targetNicheId)}
                onClick={handleConfirmDeleteNiche}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isDeletingNiche ? 'Aplicando no Firestore...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Explicit Clean Baseline Reset */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Zerar Base Completa (Nuvem + Local)
                </h3>
                <p className="text-xs text-slate-500">
                  Operação irreversível sem backup prévio
                </p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3.5 text-xs text-rose-900 space-y-1">
              <p className="font-semibold">Serão excluídos do Firestore:</p>
              <p>• {leads.length} leads (coleção <code className="font-mono">leads</code>)</p>
              <p>• {niches.length} nichos (coleção <code className="font-mono">niches</code>)</p>
              <p>• {importedSheets.length} planilhas (coleção <code className="font-mono">importedSheets</code>)</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Digite <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-rose-700">ZERAR</code> para confirmar:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Digite ZERAR"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isResetting || resetConfirmText.trim().toUpperCase() !== 'ZERAR'}
                onClick={handleConfirmCleanReset}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer disabled:opacity-40"
              >
                {isResetting ? 'Zerando...' : 'Confirmar Exclusão Total'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
