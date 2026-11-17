import React, { useState } from 'react';
import { NicheCampaign } from '../types/crm';
import { DEFAULT_SCRIPTS } from '../utils/initialData';
import { BookOpen } from 'lucide-react';
import { Modal, Input, Button } from './ui';

interface NewNicheModalProps {
  onClose: () => void;
  onCreateNiche: (niche: NicheCampaign) => void;
}

const EMOJI_SUGGESTIONS = ['🥗', '🥑', '🩺', '🦷', '🔑', '💅', '⚖️', '🍕', '🚗', '🏗️', '🐾', '💈'];

export const NewNicheModal: React.FC<NewNicheModalProps> = ({ onClose, onCreateNiche }) => {
  const [templateType, setTemplateType] = useState<
    'estetica' | 'odonto' | 'nutri' | 'clinicas' | 'custom'
  >('estetica');
  const [name, setName] = useState('Estética Automotiva');
  const [segment, setSegment] = useState('Estética Automotiva & Polimento');
  const [city, setCity] = useState('');
  const [emoji, setEmoji] = useState('🚗');
  const [targetMrr, setTargetMrr] = useState('6000');

  const handleSelectTemplate = (
    type: 'estetica' | 'odonto' | 'nutri' | 'clinicas' | 'custom'
  ) => {
    setTemplateType(type);
    if (type === 'estetica') {
      setName('Estética Automotiva');
      setSegment('Estética Automotiva & Polimento');
      setEmoji('🚗');
    } else if (type === 'odonto') {
      setName('Dentistas & Odontologia');
      setSegment('Clínicas Odontológicas & Dentistas');
      setEmoji('🦷');
    } else if (type === 'nutri') {
      setName('Nutricionistas');
      setSegment('Nutricionistas & Clínicas de Nutrição');
      setEmoji('🥗');
    } else if (type === 'clinicas') {
      setName('Clínicas & Consultórios');
      setSegment('Clínicas Médicas & Especialistas');
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

    const nicheScripts = { ...DEFAULT_SCRIPTS };

    const isNutri =
      name.toLowerCase().includes('nutri') || segment.toLowerCase().includes('nutri');
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
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      title="Novo Nicho / Campanha de Venda"
      subtitle="Configure segmento, roteiro inicial e meta de recorrência"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="kaizen-new-niche-form" variant="primary">
            Criar Campanha
          </Button>
        </>
      }
    >
      <form id="kaizen-new-niche-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Preset Template Selector */}
        <div>
          <label className="kz-label mb-1.5 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
            <span>Modelo de Scripts & Roteiro</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              {
                key: 'estetica' as const,
                icon: '🚗',
                title: 'Estética Automotiva',
                desc: '10 Etapas: Ancoragem R$ 697, Plano B R$ 397 + Upsell GMB',
              },
              {
                key: 'odonto' as const,
                icon: '🦷',
                title: 'Dentistas / Odonto',
                desc: '10 Etapas: Ancoragem R$ 697, Plano B R$ 397 + Upsell GMB',
              },
              {
                key: 'nutri' as const,
                icon: '🥗',
                title: 'Nutricionistas',
                desc: '16 Etapas com Áudios, Diagnóstico e Roteiro Texto',
              },
              {
                key: 'clinicas' as const,
                icon: '🩺',
                title: 'Clínicas Médicas',
                desc: 'Estrutura Validada, Mockup e Cold Call',
              },
            ].map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => handleSelectTemplate(preset.key)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  templateType === preset.key
                    ? 'border-[var(--kz-accent)] bg-[var(--kz-accent-soft)] ring-1 ring-[var(--kz-accent)]'
                    : 'border-[var(--kz-border-subtle)] hover:bg-[var(--kz-bg-subtle)]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--kz-text-primary)]">
                  <span>{preset.icon}</span>
                  <span>{preset.title}</span>
                </div>
                <div className="text-[10px] text-[var(--kz-text-muted)] mt-0.5 leading-tight">
                  {preset.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block kz-label mb-1.5">Emoji do Nicho</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {EMOJI_SUGGESTIONS.map((em) => (
              <button
                type="button"
                key={em}
                onClick={() => setEmoji(em)}
                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-all cursor-pointer ${
                  emoji === em
                    ? 'border-[var(--kz-accent)] bg-[var(--kz-accent-soft)] ring-1 ring-[var(--kz-accent-border)]'
                    : 'border-[var(--kz-border-subtle)] hover:bg-[var(--kz-bg-subtle)]'
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
              className="w-9 h-8 text-center text-sm border border-[var(--kz-border-default)] rounded-lg bg-[var(--kz-bg-surface)]"
            />
          </div>
        </div>

        <Input
          label="Nome da Campanha"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Nutricionistas - Arapiraca"
          autoFocus
        />

        <Input
          label="Segmento de Atuação"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          placeholder="Ex: Nutricionistas & Nutrologia"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Cidade / Região Padrão"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex: Arapiraca - AL"
          />

          <Input
            label="Meta de MRR (R$/mês)"
            type="number"
            value={targetMrr}
            onChange={(e) => setTargetMrr(e.target.value)}
            placeholder="5000"
            className="font-mono tabular-nums"
          />
        </div>
      </form>
    </Modal>
  );
};
