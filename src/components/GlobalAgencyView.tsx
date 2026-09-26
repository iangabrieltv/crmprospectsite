import React, { useRef, useState } from 'react';
import { NicheCampaign, Lead } from '../types/crm';
import {
  exportBackupJson,
  parseBackupJson,
  resetAllDataToDefault
} from '../utils/storage';
import {
  Globe,
  TrendingUp,
  Download,
  UploadCloud,
  RotateCcw,
  Plus,
  Trash2,
  DollarSign,
  Award,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';

interface GlobalAgencyViewProps {
  niches: NicheCampaign[];
  leads: Lead[];
  userName: string;
  onSelectNiche: (nicheId: string) => void;
  onOpenNewNicheModal: () => void;
  onDeleteNiche: (nicheId: string) => void;
  onRestoreBackup: (niches: NicheCampaign[], leads: Lead[], userName?: string) => void;
}

export const GlobalAgencyView: React.FC<GlobalAgencyViewProps> = ({
  niches,
  leads,
  userName,
  onSelectNiche,
  onOpenNewNicheModal,
  onDeleteNiche,
  onRestoreBackup,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Agency Global Aggregates
  const totalLeads = leads.length;
  const closedLeads = leads.filter((l) => l.stage === 'fechado');
  const totalClosedCount = closedLeads.length;
  const totalSetupRevenue = closedLeads.reduce((acc, l) => acc + (l.creationValue || 0), 0);
  const totalMrrRevenue = closedLeads.reduce((acc, l) => acc + (l.monthlyMrr || 0), 0);
  const interestedTotal = leads.filter((l) => l.stage === 'interessado').length;

  const globalConversionRate = totalLeads > 0
    ? ((totalClosedCount / totalLeads) * 100).toFixed(1)
    : '0.0';

  // Compute stats per niche
  const nicheAnalytics = niches.map((niche) => {
    const nicheLeads = leads.filter((l) => l.nicheId === niche.id);
    const nTotal = nicheLeads.length;
    const nClosed = nicheLeads.filter((l) => l.stage === 'fechado');
    const nInterested = nicheLeads.filter((l) => l.stage === 'interessado').length;
    const nContacted = nicheLeads.filter((l) => l.stage !== 'nao_iniciada').length;
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

  // Best niche by MRR
  const sortedByMrr = [...nicheAnalytics].sort((a, b) => b.mrrRevenue - a.mrrRevenue || b.conversionRate - a.conversionRate);
  const championNiche = sortedByMrr[0];

  // Backup Export
  const handleExportJson = () => {
    const jsonStr = exportBackupJson(niches, leads, userName);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospectflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedbackMessage('Backup exportado com sucesso em formato JSON!');
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Backup Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseBackupJson(content);
      if (parsed) {
        onRestoreBackup(parsed.niches, parsed.leads, parsed.userName);
        setFeedbackMessage('Backup importado com sucesso! Todos os dados foram restaurados.');
        setTimeout(() => setFeedbackMessage(null), 4000);
      } else {
        alert('Arquivo de backup inválido.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Reset to default data
  const handleResetData = () => {
    if (
      confirm(
        'Atenção: Isso irá redefinir todas as campanhas e leads para os dados de demonstração iniciais. Deseja continuar?'
      )
    ) {
      const reset = resetAllDataToDefault();
      onRestoreBackup(reset.niches, reset.leads, 'Gabriel');
      setFeedbackMessage('CRM restaurado para os dados originais de demonstração.');
      setTimeout(() => setFeedbackMessage(null), 4000);
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
            Painel consolidado comparando performance entre todos os nichos, exportação/importação de dados e persistência.
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

      {/* Feedback banner */}
      {feedbackMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
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
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        item.conversionRate >= 15
                          ? 'bg-emerald-100 text-emerald-800 font-bold'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
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
                            onClick={() => {
                              if (confirm(`Deseja remover o nicho "${item.niche.name}" e seus ${item.totalLeads} leads?`)) {
                                onDeleteNiche(item.niche.id);
                              }
                            }}
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
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Backup, Exportação & Persistência Total
        </h3>
        <p className="text-xs text-slate-500">
          Todas as alterações, mensagens e leads são gravados automaticamente no <strong>localStorage</strong> do seu navegador. Você pode baixar cópias de segurança em JSON ou migrar para outro dispositivo.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exportar Todos os Nichos (JSON)</span>
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
            <span>Importar Backup (JSON)</span>
          </button>

          {/* Reset Demo Data */}
          <button
            type="button"
            onClick={handleResetData}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Dados de Exemplo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
