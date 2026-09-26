import React from 'react';
import {
  Lead,
  NicheCampaign,
  FUNNEL_STAGES,
  FunnelStageId,
  ScriptId
} from '../types/crm';
import {
  TrendingUp,
  Users,
  CheckCircle2,
  DollarSign,
  Award,
  ArrowRight,
  Flame,
  BarChart3,
  Percent,
  Clock,
  Sparkles
} from 'lucide-react';

interface DashboardViewProps {
  niche: NicheCampaign;
  leads: Lead[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ niche, leads }) => {
  const totalLeads = leads.length;

  // Closed stats
  const closedLeads = leads.filter((l) => l.stage === 'fechado');
  const closedCount = closedLeads.length;
  const totalSetupRevenue = closedLeads.reduce((acc, l) => acc + (l.creationValue || 0), 0);
  const totalMrr = closedLeads.reduce((acc, l) => acc + (l.monthlyMrr || 0), 0);

  // Stage groups
  const interestedLeads = leads.filter((l) => l.stage === 'interessado');
  const followUpLeads = leads.filter(
    (l) => l.stage === 'follow_up_1' || l.stage === 'follow_up_2'
  );
  const contactedLeads = leads.filter(
    (l) => l.stage !== 'nao_iniciada'
  );
  const respondedLeads = leads.filter(
    (l) =>
      l.stage === 'follow_up_1' ||
      l.stage === 'follow_up_2' ||
      l.stage === 'interessado' ||
      l.stage === 'fechado' ||
      l.stage === 'nao_interessado'
  );

  // Response & Conversion Rates
  const responseRate = contactedLeads.length > 0
    ? ((respondedLeads.length / contactedLeads.length) * 100).toFixed(1)
    : '0.0';

  const conversionRate = totalLeads > 0
    ? ((closedCount / totalLeads) * 100).toFixed(1)
    : '0.0';

  const targetMrrPercent = niche.targetMrr > 0
    ? Math.min(100, Math.round((totalMrr / niche.targetMrr) * 100))
    : 0;

  // A/B Script Performance Matrix (Dynamic based on niche.scripts)
  const scriptStats: Record<
    string,
    {
      id: string;
      title: string;
      totalUsed: number;
      interested: number;
      closed: number;
      conversionRate: number;
      revenueSetup: number;
      revenueMrr: number;
    }
  > = {};

  // Initialize with all scripts in niche
  Object.values(niche.scripts).forEach((s) => {
    scriptStats[s.id] = {
      id: s.id,
      title: s.title,
      totalUsed: 0,
      interested: 0,
      closed: 0,
      conversionRate: 0,
      revenueSetup: 0,
      revenueMrr: 0,
    };
  });

  leads.forEach((l) => {
    if (l.scriptUsed && l.scriptUsed !== 'none' && scriptStats[l.scriptUsed]) {
      const s = scriptStats[l.scriptUsed];
      s.totalUsed++;
      if (l.stage === 'interessado' || l.stage === 'fechado') {
        s.interested++;
      }
      if (l.stage === 'fechado') {
        s.closed++;
        s.revenueSetup += l.creationValue || 0;
        s.revenueMrr += l.monthlyMrr || 0;
      }
    }
  });

  // Calculate conversion rates
  Object.values(scriptStats).forEach((s) => {
    s.conversionRate = s.totalUsed > 0 ? (s.closed / s.totalUsed) * 100 : 0;
  });

  // Find best performing script
  const scriptList = Object.values(scriptStats);
  const bestScript = [...scriptList].sort((a, b) => b.conversionRate - a.conversionRate || b.closed - a.closed)[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      
      {/* Top Header & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{niche.emoji}</span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Dashboard & Funil: {niche.name}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Análise de conversão, receita recorrente (MRR) e teste A/B dos scripts para {niche.segment}.
          </p>
        </div>

        {/* Target MRR Progress */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs min-w-[240px]">
          <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
            <span className="text-slate-500 font-sans text-[11px]">Meta MRR Mensal</span>
            <span className="font-bold text-slate-900">
              R$ {totalMrr.toLocaleString('pt-BR')} / R$ {niche.targetMrr.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${targetMrrPercent}%` }}
            />
          </div>
          <div className="text-right text-[10px] font-mono text-emerald-700 font-semibold mt-1">
            {targetMrrPercent}% da meta atingida
          </div>
        </div>
      </div>

      {/* KPI Stat Cards (Single-Elevation, Tabular figures) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Leads */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Total Leads</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {totalLeads}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            {contactedLeads.length} já contatados
          </div>
        </div>

        {/* Card 2: Response Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Taxa de Resposta</span>
            <Percent className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-blue-700">
            {responseRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            {respondedLeads.length} retornos obtidos
          </div>
        </div>

        {/* Card 3: In Follow-up */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Em Follow-up</span>
            <Clock className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-purple-700">
            {followUpLeads.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            Toques 1 e 2 ativos
          </div>
        </div>

        {/* Card 4: Interested Leads */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Interessados na Mesa</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
            {interestedLeads.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            Demo / Proposta em análise
          </div>
        </div>

        {/* Card 5: Closed Leads */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Vendas Fechadas</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {closedCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            Conv. Geral: {conversionRate}%
          </div>
        </div>

        {/* Card 6: MRR Recurring */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between ring-1 ring-emerald-500/20 bg-emerald-50/20">
          <div className="text-[11px] font-medium text-emerald-800 flex items-center justify-between">
            <span>MRR Recorrente</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-800">
            R$ {totalMrr.toLocaleString('pt-BR')}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-mono truncate">
            + R$ {totalSetupRevenue.toLocaleString('pt-BR')} em setup
          </div>
        </div>
      </div>

      {/* Stepped Visual Conversion Funnel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Funil Sequencial de Vendas de Sites
            </h3>
            <p className="text-xs text-slate-500">
              Distribuição dos {totalLeads} contatos ao longo das 8 etapas do processo.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            8 Etapas Monitoradas
          </span>
        </div>

        {/* Funnel rows */}
        <div className="space-y-3 pt-2">
          {FUNNEL_STAGES.map((stage, idx) => {
            const stageLeads = leads.filter((l) => l.stage === stage.id);
            const count = stageLeads.length;
            const percentOfTotal = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
            const stageSetup = stageLeads.reduce((acc, l) => acc + (l.creationValue || 0), 0);
            const stageMrr = stageLeads.reduce((acc, l) => acc + (l.monthlyMrr || 0), 0);

            return (
              <div key={stage.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{stage.name}</span>
                    <span className="text-slate-400 text-[11px]">·</span>
                    <span className="text-slate-500 text-[11px]">{stage.description}</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    {(stageSetup > 0 || stageMrr > 0) && (
                      <span className="text-slate-500 text-[11px] hidden sm:inline">
                        {stageSetup > 0 ? `Setup: R$ ${stageSetup.toLocaleString('pt-BR')}` : ''}
                        {stageMrr > 0 ? ` · MRR: R$ ${stageMrr.toLocaleString('pt-BR')}/mês` : ''}
                      </span>
                    )}
                    <span className="font-bold text-slate-900 w-12 text-right">
                      {count} leads
                    </span>
                    <span className="text-slate-400 text-[11px] w-12 text-right">
                      {percentOfTotal.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-slate-100 rounded-md overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-300 ${
                      stage.id === 'fechado'
                        ? 'bg-green-600'
                        : stage.id === 'interessado'
                        ? 'bg-emerald-500'
                        : stage.id === 'nao_interessado'
                        ? 'bg-rose-400'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.max(count > 0 ? 3 : 0, percentOfTotal)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* A/B Script Performance Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Matriz de Performance A/B dos 3 Scripts
              </h3>
              {bestScript && bestScript.closed > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-600" />
                  Script Campeão: {bestScript.id === 'script1' ? 'Script 1' : bestScript.id === 'script2' ? 'Script 2' : 'Script 3'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Compara a taxa de resposta e conversão em fechamentos reais de sites para cada roteiro.
            </p>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-medium">
                <th className="py-2.5 px-3">Script de Prospecção</th>
                <th className="py-2.5 px-3 text-right">Leads Disparados</th>
                <th className="py-2.5 px-3 text-right">Interessados</th>
                <th className="py-2.5 px-3 text-right">Fechamentos</th>
                <th className="py-2.5 px-3 text-right">Taxa de Conversão</th>
                <th className="py-2.5 px-3 text-right">Setup Gerado</th>
                <th className="py-2.5 px-3 text-right">MRR Recorrente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {scriptList.map((s) => {
                const isChampion = bestScript && bestScript.id === s.id && s.closed > 0;
                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isChampion ? 'bg-amber-50/30 font-semibold' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-sans font-medium text-slate-900 flex items-center gap-2">
                      {isChampion && <Award className="w-4 h-4 text-amber-600 shrink-0" />}
                      <span>{s.title}</span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700">{s.totalUsed}</td>
                    <td className="py-3 px-3 text-right text-amber-700">{s.interested}</td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-bold">{s.closed}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        s.conversionRate >= 15
                          ? 'bg-emerald-100 text-emerald-800 font-bold'
                          : s.conversionRate > 0
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-400'
                      }`}>
                        {s.conversionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700">
                      R$ {s.revenueSetup.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-bold">
                      R$ {s.revenueMrr.toLocaleString('pt-BR')}/mês
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Insight Card */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Recomendação Estratégica para {niche.segment}:</span>
            <p className="text-slate-700 leading-relaxed font-sans text-xs">
              {bestScript && bestScript.closed > 0 ? (
                <>
                  O <strong>{bestScript.title}</strong> está gerando a maior taxa de conversão ({bestScript.conversionRate.toFixed(1)}%).
                  Priorize esse script nos primeiros contatos para maximizar fechamentos de site e MRR neste nicho.
                </>
              ) : (
                <>
                  Para o nicho de <strong>{niche.segment}</strong>, inicie testando o <strong>Script 1 (Método Simula)</strong> enviando protótipos visuais pelo WhatsApp, e o <strong>Script 2 (Diagnóstico Google)</strong> para empresas com nota alta e sem site no perfil.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
