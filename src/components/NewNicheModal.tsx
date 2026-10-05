import React, { useState } from 'react';
import { NicheCampaign } from '../types/crm';
import { DEFAULT_SCRIPTS, SCRIPT_NUTRICIONISTA, SCRIPT_NUTRICIONISTA_MENSAGENS } from '../utils/initialData';
import { X, Sparkles, BookOpen } from 'lucide-react';

interface NewNicheModalProps {
  onClose: () => void;
  onCreateNiche: (niche: NicheCampaign) => void;
}

const EMOJI_SUGGESTIONS = ['🥗', '🥑', '🩺', '🦷', '🔑', '💅', '⚖️', '🍕', '🚗', '🏗️', '🐾', '💈'];

export const NewNicheModal: React.FC<NewNicheModalProps> = ({ onClose, onCreateNiche }) => {
  const [templateType, setTemplateType] = useState<'nutri' | 'clinicas' | 'custom'>('nutri');
  const [name, setName] = useState('Nutricionistas & Nutrologia');
  const [segment, setSegment] = useState('Nutricionistas & Clínicas de Nutrição');
  const [city, setCity] = useState('');
  const [emoji, setEmoji] = useState('🥗');
  const [targetMrr, setTargetMrr] = useState('5000');

  const handleSelectTemplate = (type: 'nutri' | 'clinicas' | 'custom') => {
    setTemplateType(type);
    if (type === 'nutri') {
      setName('Nutricionistas');
      setSegment('Nutricionistas & Clínicas de Nutrição');
      setEmoji('🥗');
    } else if (type === 'clinicas') {
      setName('Clínicas & Consultórios');
      setSegment('Clínicas Médicas & Odontológicas');
      setEmoji('🩺');
    } else {
      setName('');
      setSegment('');
      setEmoji('💼');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const isNutri =
      templateType === 'nutri' ||
      name.toLowerCase().includes('nutri') ||
      segment.toLowerCase().includes('nutri');

    const nicheScripts = isNutri
      ? {
          script_nutri: SCRIPT_NUTRICIONISTA,
          script_nutri_mensagens: SCRIPT_NUTRICIONISTA_MENSAGENS,
          script1: DEFAULT_SCRIPTS.script1,
          script2: DEFAULT_SCRIPTS.script2,
        }
      : { ...DEFAULT_SCRIPTS };

    const newNiche: NicheCampaign = {
      id: 'niche-' + Date.now(),
      name: name.trim(),
      segment: segment.trim() || name.trim(),
      city: city.trim() || 'Brasil',
      emoji: emoji || (isNutri ? '🥗' : '💼'),
      targetMrr: targetMrr ? parseFloat(targetMrr) : 5000,
      createdAt: new Date().toISOString(),
      scripts: nicheScripts,
    };

    onCreateNiche(newNiche);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900">
            + Novo Nicho / Campanha de Venda
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Preset Template Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              Modelo de Scripts & Roteiro
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectTemplate('nutri')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  templateType === 'nutri'
                    ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                  <span>🥗</span> Nutricionistas
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  16 Etapas com Áudios, Diagnóstico Google e Fechamento R$ 697
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTemplate('clinicas')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  templateType === 'clinicas'
                    ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                  <span>🩺</span> Clínicas & Médicos
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  Método Mockup, Prévia Pronta e Cold Call
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Emoji do Nicho
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {EMOJI_SUGGESTIONS.map((em) => (
                <button
                  type="button"
                  key={em}
                  onClick={() => setEmoji(em)}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-all cursor-pointer ${
                    emoji === em
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {em}
                </button>
              ))}
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={2}
                className="w-9 h-8 text-center text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome da Campanha *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: 🥗 Nutricionistas - Arapiraca"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Segmento de Atuação
            </label>
            <input
              type="text"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              placeholder="Ex: Nutricionistas & Nutrologia"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cidade / Região Padrão
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex: Arapiraca - AL"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Meta de Faturamento MRR (R$/mês)
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                R$
              </span>
              <input
                type="number"
                value={targetMrr}
                onChange={(e) => setTargetMrr(e.target.value)}
                placeholder="5000"
                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tabular-nums text-slate-900"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
            >
              Criar Campanha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
