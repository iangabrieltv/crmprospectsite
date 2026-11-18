import React, { useEffect, useState } from 'react';
import { RotateCcw, Settings } from 'lucide-react';
import {
  ANALYTICS_PERIOD_OPTIONS,
  AnalyticsPeriodPreset,
  AnalyticsPreferences,
  DEFAULT_FAVORITE_KPI_IDS,
  FAVORITE_KPI_CATALOG,
} from '../../types/analytics';
import { Button, Modal, Select } from '../ui';

interface AnalyticsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: AnalyticsPreferences;
  onSave: (nextPrefs: AnalyticsPreferences) => Promise<void>;
}

export const AnalyticsSettingsModal: React.FC<AnalyticsSettingsModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSave,
}) => {
  const [draft, setDraft] = useState<AnalyticsPreferences>(preferences);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(preferences);
    }
  }, [isOpen, preferences]);

  const toggleKpi = (kpiId: string) => {
    setDraft((prev) => {
      const exists = prev.favoriteKpis.includes(kpiId);
      const next = exists
        ? prev.favoriteKpis.filter((id) => id !== kpiId)
        : [...prev.favoriteKpis, kpiId];
      return { ...prev, favoriteKpis: next };
    });
  };

  const handleReset = () => {
    setDraft({
      id: 'default',
      defaultPeriodPreset: 'este_mes',
      favoriteKpis: [...DEFAULT_FAVORITE_KPI_IDS],
      compactTables: false,
      showDataLimitationsNotice: true,
      schemaVersion: 1,
    });
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...draft,
        id: 'default',
        favoriteKpis:
          draft.favoriteKpis.length > 0 ? draft.favoriteKpis : [...DEFAULT_FAVORITE_KPI_IDS],
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      closeDisabled={isSaving}
      title="Personalizar Central de Relatórios & Inteligência"
      subtitle="Defina seu período padrão, KPIs favoritos e densidade visual."
      icon={
        <div className="w-9 h-9 rounded-full bg-[var(--kz-accent-soft)] flex items-center justify-center text-[var(--kz-accent-text)]">
          <Settings className="w-4 h-4" />
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={handleReset}
            disabled={isSaving}
          >
            Restaurar Padrão
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button variant="primary" loading={isSaving} onClick={handleConfirm}>
              Salvar Preferências
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-xs">
        <Select
          label="Período Padrão ao Abrir o Módulo"
          value={draft.defaultPeriodPreset}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              defaultPeriodPreset: e.target.value as AnalyticsPeriodPreset,
            }))
          }
        >
          {ANALYTICS_PERIOD_OPTIONS.filter((o) => o.id !== 'personalizado').map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </Select>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="kz-label">KPIs Favoritos na Visão Geral ({draft.favoriteKpis.length})</span>
            <span className="text-[11px] text-[var(--kz-text-muted)]">
              Selecione ao menos 1 indicador
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {FAVORITE_KPI_CATALOG.map((item) => {
              const checked = draft.favoriteKpis.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    checked
                      ? 'bg-[var(--kz-accent-soft)]/35 border-[var(--kz-accent-border)]'
                      : 'bg-[var(--kz-bg-canvas)] border-[var(--kz-border-subtle)] hover:border-[var(--kz-border-default)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleKpi(item.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--kz-text-primary)]">{item.label}</div>
                    <div className="text-[10px] text-[var(--kz-text-muted)] leading-snug">
                      {item.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 pt-1 border-t border-[var(--kz-border-subtle)]">
          <label className="flex items-center gap-2.5 cursor-pointer text-[var(--kz-text-secondary)]">
            <input
              type="checkbox"
              checked={draft.compactTables}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, compactTables: e.target.checked }))
              }
            />
            <span>Modo compacto em tabelas e cards de indicadores</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer text-[var(--kz-text-secondary)]">
            <input
              type="checkbox"
              checked={draft.showDataLimitationsNotice}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  showDataLimitationsNotice: e.target.checked,
                }))
              }
            />
            <span>Exibir notas de transparência e escopo nos relatórios</span>
          </label>
        </div>
      </div>
    </Modal>
  );
};
