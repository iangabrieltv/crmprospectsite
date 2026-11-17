import React, { useEffect, useState } from 'react';
import { Check, Landmark, ShieldCheck } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from '../ui';
import { FinancialPaymentMethod, FinancialSettings } from '../../types/finance';
import {
  centsToInputValue,
  formatBrlFromCents,
  formatDateBr,
  parseBrlToCents,
} from '../../services/finance';

interface FinanceSettingsTabProps {
  settings: FinancialSettings;
  onSaveSettings: (
    nextSettings: FinancialSettings,
    openingBalanceChanged: boolean
  ) => Promise<void>;
}

export const FinanceSettingsTab: React.FC<FinanceSettingsTabProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [openingInput, setOpeningInput] = useState(
    centsToInputValue(settings.openingBalanceCents)
  );
  const [openingDate, setOpeningDate] = useState(settings.openingBalanceDate);
  const [openingDesc, setOpeningDesc] = useState(settings.openingBalanceDescription);
  const [openingNotes, setOpeningNotes] = useState(settings.openingBalanceNotes || '');
  const [alertDaysAhead, setAlertDaysAhead] = useState(
    String(settings.alertDaysAhead ?? 5)
  );
  const [defaultDueDay, setDefaultDueDay] = useState(
    String(settings.defaultDueDay ?? 10)
  );
  const [paymentMethods, setPaymentMethods] = useState(settings.paymentMethods);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCompanyName(settings.companyName);
    setOpeningInput(centsToInputValue(settings.openingBalanceCents));
    setOpeningDate(settings.openingBalanceDate);
    setOpeningDesc(settings.openingBalanceDescription);
    setOpeningNotes(settings.openingBalanceNotes || '');
    setAlertDaysAhead(String(settings.alertDaysAhead ?? 5));
    setDefaultDueDay(String(settings.defaultDueDay ?? 10));
    setPaymentMethods(settings.paymentMethods);
  }, [settings]);

  const toggleMethod = (id: FinancialPaymentMethod) => {
    setPaymentMethods((prev) =>
      prev.map((m) => (m.id === id ? { ...m, active: !m.active } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedOpening = parseBrlToCents(openingInput);
    if (!Number.isFinite(parsedOpening)) {
      setError('Saldo inicial inválido. Informe um número em R$.');
      return;
    }

    const openingChanged =
      parsedOpening !== settings.openingBalanceCents ||
      openingDate !== settings.openingBalanceDate;

    const nextHistory = openingChanged
      ? [
          {
            date: openingDate,
            amountCents: parsedOpening,
            description:
              openingDesc.trim() || 'Atualização do saldo inicial de caixa',
            changedAt: new Date().toISOString(),
            changedBy: 'Admin',
          },
          ...(settings.openingBalanceHistory || []),
        ].slice(0, 20)
      : settings.openingBalanceHistory || [];

    const nextSettings: FinancialSettings = {
      ...settings,
      companyName: companyName.trim() || 'Agência Kaizen',
      currency: 'BRL',
      dateFormat: 'DD/MM/YYYY',
      timezone: 'America/Maceio',
      openingBalanceCents: parsedOpening,
      openingBalanceDate: openingDate,
      openingBalanceDescription:
        openingDesc.trim() || 'Saldo inicial de caixa configurado no sistema',
      openingBalanceNotes: openingNotes.trim() || undefined,
      openingBalanceHistory: nextHistory,
      paymentMethods,
      alertDaysAhead: Math.max(0, Math.min(30, Number(alertDaysAhead) || 5)),
      defaultDueDay: Math.max(1, Math.min(28, Number(defaultDueDay) || 10)),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await onSaveSettings(nextSettings, openingChanged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Alert variant="warning">
        <span className="text-xs">
          <ShieldCheck className="w-3.5 h-3.5 inline mr-1.5" />
          <strong>Transparência sobre integrações bancárias:</strong> nenhuma API bancária,
          Open Finance ou gateway de pagamento externo está conectado no momento. Todas as baixas
          devem ser confirmadas manualmente pelo administrador para manter precisão de caixa.
        </span>
      </Alert>

      {error && (
        <Alert variant="danger" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Identificação & Padrões */}
        <Card padding="lg" className="space-y-4">
          <CardHeader>
            <div>
              <CardTitle>Parâmetros da Agência & Alertas</CardTitle>
              <CardDescription>
                Configuração padrão de moeda, fuso horário e vencimentos.
              </CardDescription>
            </div>
          </CardHeader>

          <Input
            label="Empresa Emissora"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />

          <div className="grid grid-cols-3 gap-3 text-xs bg-[var(--kz-bg-subtle)] p-3 rounded-xl border border-[var(--kz-border-subtle)]">
            <div>
              <span className="text-[11px] text-[var(--kz-text-muted)] block">Moeda</span>
              <span className="font-mono font-semibold text-[var(--kz-text-primary)]">
                BRL (R$)
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[var(--kz-text-muted)] block">Formato Data</span>
              <span className="font-mono font-semibold text-[var(--kz-text-primary)]">
                DD/MM/YYYY
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[var(--kz-text-muted)] block">Fuso Horário</span>
              <span className="font-mono font-semibold text-[var(--kz-text-primary)]">
                America/Maceio
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Antecedência de alertas (dias)"
              type="number"
              min={0}
              max={30}
              value={alertDaysAhead}
              onChange={(e) => setAlertDaysAhead(e.target.value)}
              helperText="Exibe aviso antes do vencimento"
            />
            <Input
              label="Dia padrão de vencimento"
              type="number"
              min={1}
              max={28}
              value={defaultDueDay}
              onChange={(e) => setDefaultDueDay(e.target.value)}
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="kz-label block">Formas de Pagamento Habilitadas</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {paymentMethods.map((pm) => (
                <label
                  key={pm.id}
                  className="flex items-center gap-2 text-xs p-2 rounded-lg border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={pm.active}
                    onChange={() => toggleMethod(pm.id)}
                  />
                  <span className="text-[var(--kz-text-primary)]">{pm.label}</span>
                </label>
              ))}
            </div>
          </div>
        </Card>

        {/* Saldo Inicial de Caixa + Histórico */}
        <Card padding="lg" className="space-y-4">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[var(--kz-accent)]" />
                Saldo Inicial de Caixa
              </CardTitle>
              <CardDescription>
                Define a posição inicial do caixa sem misturar com receitas operacionais.
              </CardDescription>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Saldo Inicial (R$)"
              required
              value={openingInput}
              onChange={(e) => setOpeningInput(e.target.value)}
              className="font-mono"
            />
            <Input
              label="Data de Referência"
              type="date"
              required
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
            />
          </div>

          <Input
            label="Descrição da Posição Inicial"
            value={openingDesc}
            onChange={(e) => setOpeningDesc(e.target.value)}
          />

          <Textarea
            label="Observações de Caixa (opcional)"
            rows={2}
            value={openingNotes}
            onChange={(e) => setOpeningNotes(e.target.value)}
          />

          {settings.openingBalanceHistory?.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[var(--kz-border-subtle)]">
              <div className="kz-label">Histórico de Alterações do Saldo Inicial</div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 text-[11px] text-[var(--kz-text-muted)]">
                {settings.openingBalanceHistory.map((snap, idx) => (
                  <div
                    key={`${snap.changedAt}-${idx}`}
                    className="flex items-center justify-between gap-2 bg-[var(--kz-bg-subtle)] px-2.5 py-1.5 rounded-lg"
                  >
                    <span className="truncate">
                      {formatDateBr(snap.date)} · {snap.description}
                    </span>
                    <span className="font-mono font-semibold text-[var(--kz-text-primary)] shrink-0">
                      {formatBrlFromCents(snap.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={saving}
          leftIcon={<Check className="w-4 h-4" />}
        >
          Salvar Configurações Financeiras
        </Button>
      </div>
    </form>
  );
};
