import React, { useState } from 'react';
import { NicheCampaign, Lead, ScriptId } from '../types/crm';
import { cleanPhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';
import { SAMPLE_IMPORT_LEADS } from '../utils/initialData';
import {
  UploadCloud,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Plus,
  Play,
  RotateCcw,
  Check,
  Building2,
  Phone,
  MapPin,
  Star
} from 'lucide-react';

interface ParsedLeadCandidate {
  companyName: string;
  contactName?: string;
  phone: string;
  city?: string;
  address?: string;
  googleRating?: number;
  recommendedScript?: 'script1' | 'script2' | 'script3';
  opportunityAngle?: string;
  selected: boolean;
}

interface ImporterViewProps {
  activeNiche: NicheCampaign;
  onImportLeadsToNiche: (nicheId: string, leads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[]) => void;
  onCreateNicheWithLeads: (
    newNiche: { name: string; segment: string; city: string; emoji: string },
    leads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[]
  ) => void;
  onSwitchToKanban: () => void;
}

export const ImporterView: React.FC<ImporterViewProps> = ({
  activeNiche,
  onImportLeadsToNiche,
  onCreateNicheWithLeads,
  onSwitchToKanban,
}) => {
  const [rawText, setRawText] = useState('');
  const [destinationMode, setDestinationMode] = useState<'current' | 'new'>('current');
  const [newNicheName, setNewNicheName] = useState('');
  const [newNicheSegment, setNewNicheSegment] = useState('');
  const [newNicheCity, setNewNicheCity] = useState(activeNiche.city);
  const [newNicheEmoji, setNewNicheEmoji] = useState('💼');

  const [parsedCandidates, setParsedCandidates] = useState<ParsedLeadCandidate[]>([]);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Fast Client-Side CSV/TSV Parser (Handles Excel paste & commas)
  const parseRawTextHeuristic = (text: string): ParsedLeadCandidate[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const candidates: ParsedLeadCandidate[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ignore header row if detected
      if (
        i === 0 &&
        (line.toLowerCase().includes('empresa') ||
          line.toLowerCase().includes('nome') ||
          line.toLowerCase().includes('telefone'))
      ) {
        continue;
      }

      // Check separator (tab or comma or semicolon)
      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t').map((p) => p.trim());
      } else if (line.includes(';')) {
        parts = line.split(';').map((p) => p.trim());
      } else if (line.includes(',')) {
        parts = line.split(',').map((p) => p.trim());
      } else if (line.includes(' - ')) {
        parts = line.split(' - ').map((p) => p.trim());
      } else {
        parts = [line];
      }

      const company = parts[0] || `Lead ${i + 1}`;
      let phoneCandidate = '';
      let addressCandidate = '';
      let ratingCandidate: number | undefined = undefined;

      // Extract phone from parts or regex
      for (let p of parts) {
        const digits = p.replace(/\D/g, '');
        if (digits.length >= 8 && digits.length <= 13) {
          phoneCandidate = digits;
          break;
        }
      }

      if (!phoneCandidate) {
        const matchDigits = line.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}/);
        if (matchDigits) {
          phoneCandidate = matchDigits[0].replace(/\D/g, '');
        }
      }

      // If parts has address
      if (parts.length > 2) {
        addressCandidate = parts[2];
      }

      // Check rating
      const matchRating = line.match(/\b([1-5](?:[.,]\d)?)\s*(?:★|⭐|estrelas|nota)/i);
      if (matchRating) {
        ratingCandidate = parseFloat(matchRating[1].replace(',', '.'));
      }

      if (phoneCandidate) {
        candidates.push({
          companyName: company,
          phone: cleanPhoneForWhatsApp(phoneCandidate),
          city: activeNiche.city,
          address: addressCandidate || undefined,
          googleRating: ratingCandidate,
          recommendedScript: 'script1',
          selected: true,
        });
      }
    }

    return candidates;
  };

  const handleRunHeuristicParse = () => {
    setErrorMessage(null);
    if (!rawText.trim()) {
      setErrorMessage('Cole os dados da planilha ou contatos antes de analisar.');
      return;
    }
    const candidates = parseRawTextHeuristic(rawText);
    if (candidates.length === 0) {
      setErrorMessage('Nenhum número de telefone válido foi detectado nos dados colados.');
      return;
    }
    setParsedCandidates(candidates);
  };

  const handleRunAiAnalysis = async () => {
    setErrorMessage(null);
    if (!rawText.trim()) {
      setErrorMessage('Cole os dados brutos antes de executar a análise por IA.');
      return;
    }

    setIsAnalyzingAi(true);
    try {
      const res = await fetch('/api/gemini/analyze-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          nicheName: activeNiche.name,
          defaultCity: activeNiche.city,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha no processamento pelo Gemini');
      }

      const data = await res.json();
      if (Array.isArray(data.leads) && data.leads.length > 0) {
        const formatted = data.leads.map((l: any) => ({
          companyName: l.companyName || 'Empresa',
          contactName: l.contactName || undefined,
          phone: cleanPhoneForWhatsApp(l.phone || ''),
          city: l.city || activeNiche.city,
          address: l.address || undefined,
          googleRating: typeof l.googleRating === 'number' ? l.googleRating : undefined,
          recommendedScript: (['script1', 'script2', 'script3'].includes(l.recommendedScript)
            ? l.recommendedScript
            : 'script1') as 'script1' | 'script2' | 'script3',
          opportunityAngle: l.opportunityAngle,
          selected: true,
        }));
        setParsedCandidates(formatted);
      } else {
        // Fallback to heuristic
        const fallbackCandidates = parseRawTextHeuristic(rawText);
        setParsedCandidates(fallbackCandidates);
      }
    } catch (err: any) {
      console.warn('AI Analysis fallback triggered:', err);
      const fallbackCandidates = parseRawTextHeuristic(rawText);
      setParsedCandidates(fallbackCandidates);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleLoadSampleLeads = () => {
    setRawText(
      SAMPLE_IMPORT_LEADS.map(
        (s) => `${s.companyName}\t${s.phone}\t${s.address}\t${s.googleRating} ⭐\t${s.city}`
      ).join('\n')
    );
    const mapped: ParsedLeadCandidate[] = SAMPLE_IMPORT_LEADS.map((s) => ({
      companyName: s.companyName,
      contactName: s.contactName,
      phone: cleanPhoneForWhatsApp(s.phone),
      city: s.city,
      address: s.address,
      googleRating: s.googleRating,
      recommendedScript: s.recommendedScript as any,
      opportunityAngle: s.opportunityAngle,
      selected: true,
    }));
    setParsedCandidates(mapped);
    setErrorMessage(null);
  };

  const handleToggleCandidate = (index: number) => {
    setParsedCandidates((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleToggleAll = (select: boolean) => {
    setParsedCandidates((prev) => prev.map((c) => ({ ...c, selected: select })));
  };

  const handleCommitImport = () => {
    const selected = parsedCandidates.filter((c) => c.selected);
    if (selected.length === 0) {
      setErrorMessage('Selecione pelo menos um lead para importar.');
      return;
    }

    const payload: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[] = selected.map((c) => ({
      companyName: c.companyName,
      contactName: c.contactName,
      phone: c.phone,
      displayPhone: formatDisplayPhone(c.phone),
      city: c.city || activeNiche.city,
      address: c.address,
      googleRating: c.googleRating,
      stage: 'nao_iniciada',
      scriptUsed: c.recommendedScript || 'script1',
      opportunityAngle: c.opportunityAngle,
    }));

    if (destinationMode === 'current') {
      onImportLeadsToNiche(activeNiche.id, payload);
    } else {
      if (!newNicheName.trim()) {
        setErrorMessage('Informe um nome para a nova campanha.');
        return;
      }
      onCreateNicheWithLeads(
        {
          name: newNicheName.trim(),
          segment: newNicheSegment.trim() || newNicheName.trim(),
          city: newNicheCity.trim() || activeNiche.city,
          emoji: newNicheEmoji || '💼',
        },
        payload
      );
    }

    setSuccessCount(payload.length);
    setParsedCandidates([]);
    setRawText('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>📥 Importador Inteligente por Nicho</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cole dados copiados do Excel, Google Sheets, Maps ou texto livre. Limpeza e formatação automática de WhatsApp (+55).
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadSampleLeads}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-blue-600" />
          <span>Carregar 10 Leads de Exemplo</span>
        </button>
      </div>

      {/* Success Notification */}
      {successCount !== null && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              <strong>{successCount} leads importados com sucesso!</strong> Os contatos já foram organizados na coluna <em>1. Não Iniciada</em>.
            </span>
          </div>
          <button
            onClick={() => {
              setSuccessCount(null);
              onSwitchToKanban();
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Ver no Kanban
          </button>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1: Input Area & Destination Option */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Raw Data Textarea */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>Colar Linhas de Planilha ou Texto de Contatos</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Aceita tabulação do Excel, CSV ou linhas soltas
            </span>
          </div>

          <textarea
            rows={8}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Exemplo de dados colados do Excel:
Clínica Odonto Prime	11988887777	Av. Paulista, 1000	4.9 ⭐	São Paulo - SP
Sorriso & Arte	11977776666	Rua Augusta, 500	4.8 ⭐	São Paulo - SP
Dr. Lucas Implantes	11966665555	Vila Mariana	4.6 ⭐	São Paulo - SP"
            className="w-full text-xs p-3 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-slate-50"
          />

          {/* Action Buttons: Heuristic vs AI */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRunHeuristicParse}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
              <span>Processamento Rápido (Planilha/CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleRunAiAnalysis}
              disabled={isAnalyzingAi}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAnalyzingAi ? 'Analisando com IA (Gemini)...' : 'Analisar com IA (Gemini)'}</span>
            </button>
          </div>
        </div>

        {/* Right: Destination Config (Option A vs Option B) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block border-b border-slate-100 pb-2">
            Destino dos Leads
          </span>

          <div className="space-y-2">
            {/* Option A */}
            <label className={`block p-3 rounded-xl border cursor-pointer transition-all ${
              destinationMode === 'current'
                ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-300'
                : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="destination"
                  checked={destinationMode === 'current'}
                  onChange={() => setDestinationMode('current')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Opção A: Importar para o Nicho Atual
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {activeNiche.emoji} {activeNiche.name} ({activeNiche.city})
                  </div>
                </div>
              </div>
            </label>

            {/* Option B */}
            <label className={`block p-3 rounded-xl border cursor-pointer transition-all ${
              destinationMode === 'new'
                ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-300'
                : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="destination"
                  checked={destinationMode === 'new'}
                  onChange={() => setDestinationMode('new')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Opção B: Criar Novo Nicho Automático
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Cria uma área de trabalho isolada para este novo segmento
                  </div>
                </div>
              </div>
            </label>
          </div>

          {/* New Niche Inputs (if Option B selected) */}
          {destinationMode === 'new' && (
            <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={newNicheEmoji}
                    onChange={(e) => setNewNicheEmoji(e.target.value)}
                    maxLength={2}
                    className="w-full text-center text-sm px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Nome da Campanha *
                  </label>
                  <input
                    type="text"
                    value={newNicheName}
                    onChange={(e) => setNewNicheName(e.target.value)}
                    placeholder="Ex: Advogados - SP"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Segmento de Mercado
                </label>
                <input
                  type="text"
                  value={newNicheSegment}
                  onChange={(e) => setNewNicheSegment(e.target.value)}
                  placeholder="Ex: Escritórios de Advocacia"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Cidade Principal
                </label>
                <input
                  type="text"
                  value={newNicheCity}
                  onChange={(e) => setNewNicheCity(e.target.value)}
                  placeholder="Ex: São Paulo - SP"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Live Candidates Preview Table */}
      {parsedCandidates.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Leads Identificados ({parsedCandidates.length})</span>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-mono">
                  {parsedCandidates.filter((c) => c.selected).length} selecionados
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Verifique os dados limpos antes de salvar no CRM. Telefones formatados para o padrão WhatsApp internacional (+55).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Marcar Todos
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => handleToggleAll(false)}
                className="text-xs text-slate-500 hover:underline cursor-pointer"
              >
                Desmarcar Todos
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-8"></th>
                  <th className="py-2.5 px-3">Empresa</th>
                  <th className="py-2.5 px-3">WhatsApp Formatado</th>
                  <th className="py-2.5 px-3">Localização</th>
                  <th className="py-2.5 px-3">Nota Google</th>
                  <th className="py-2.5 px-3">Script Recomendado</th>
                  <th className="py-2.5 px-3">Oportunidade (IA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedCandidates.map((candidate, idx) => (
                  <tr
                    key={idx}
                    onClick={() => handleToggleCandidate(idx)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      candidate.selected ? 'bg-blue-50/20' : 'opacity-60'
                    }`}
                  >
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={candidate.selected}
                        onChange={() => handleToggleCandidate(idx)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {candidate.companyName}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-emerald-700 font-semibold">
                      {formatDisplayPhone(candidate.phone)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-[150px]">
                      {candidate.address || candidate.city || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {candidate.googleRating ? (
                        <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{candidate.googleRating}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {candidate.recommendedScript === 'script1'
                          ? 'Script 1 · Mockup'
                          : candidate.recommendedScript === 'script2'
                          ? 'Script 2 · Google'
                          : 'Script 3 · Cold Call'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[200px]">
                      {candidate.opportunityAngle || 'Oportunidade de site moderno'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirm Button */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Total a adicionar:{' '}
              <strong className="text-slate-900">
                {parsedCandidates.filter((c) => c.selected).length} leads
              </strong>
            </span>

            <button
              type="button"
              onClick={handleCommitImport}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                {destinationMode === 'current'
                  ? `Confirmar e Importar para ${activeNiche.name}`
                  : `Criar Novo Nicho e Importar Leads`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
