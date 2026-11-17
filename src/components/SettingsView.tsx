import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Database,
  Cloud,
  CheckCircle2,
  ArrowUpRight,
  Trash2,
  Plug,
} from 'lucide-react';
import { auth } from '../utils/firebase';
import { WORKSPACE_ID } from '../config/env';
import { AppTab, NicheCampaign, Lead, ImportedSheet } from '../types/crm';
import { loadLastBackupTimestamp } from '../utils/storage';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Button,
  Badge,
  Alert,
  ConfirmDialog,
} from './ui';

interface SettingsViewProps {
  userName: string;
  onUpdateUserName: (name: string) => void;
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
  isCloudSynced: boolean;
  syncStatus: 'synced' | 'saving' | 'error';
  onNavigate: (tab: AppTab) => void;
  onClearAllContacts?: () => Promise<void>;
}

const FUTURE_INTEGRATIONS = [
  {
    name: 'Google Calendar',
    description: 'Sincronização bidirecional de reuniões e compromissos da agência.',
    stage: 'Etapa futura',
  },
  {
    name: 'Google Drive / Materiais',
    description: 'Vínculo direto de pastas de clientes, briefings e entregas.',
    stage: 'Etapa futura',
  },
  {
    name: 'Módulo Financeiro & Cobranças',
    description: 'Controle de faturas, entradas recorrentes (MRR) e despesas.',
    stage: 'Etapa 5',
  },
  {
    name: 'Assistente IA Contextual',
    description: 'Briefings automáticos e resumos operacionais (além dos recursos de Leads/Scripts).',
    stage: 'Etapa 6',
  },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  userName,
  onUpdateUserName,
  niches,
  leads,
  importedSheets,
  isCloudSynced,
  syncStatus,
  onNavigate,
  onClearAllContacts,
}) => {
  const [nameInput, setNameInput] = useState(userName);
  const [savedNotice, setSavedNotice] = useState(false);

  const [isClearOpen, setIsClearOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearError, setClearError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const adminEmail = auth.currentUser?.email || 'Sessão administrativa autenticada';
  const lastBackupAt = loadLastBackupTimestamp();

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nameInput.trim();
    if (!cleaned) return;
    onUpdateUserName(cleaned);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleConfirmClear = async () => {
    if (!onClearAllContacts) return;
    setIsClearing(true);
    setClearError(null);
    try {
      await onClearAllContacts();
      setIsClearOpen(false);
      setClearConfirmText('');
    } catch (err) {
      setClearError(
        err instanceof Error
          ? `Falha ao zerar banco: ${err.message}`
          : 'Erro ao zerar banco na nuvem.'
      );
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Perfil do Operador */}
      <Card padding="lg" className="space-y-4">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <CardTitle>Perfil do Proprietário & Scripts</CardTitle>
              <CardDescription>
                Configuração privada de exibição e assinatura das mensagens de prospecção.
              </CardDescription>
            </div>
          </div>
          <Badge variant="success" dot>
            Uso exclusivo do proprietário
          </Badge>
        </CardHeader>

        <form onSubmit={handleSaveName} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <Input
            label="Nome usado nas variáveis {SeuNome}"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Ex: Ian"
            helperText="Aplicado automaticamente ao gerar links do WhatsApp e simulações de script."
            required
          />
          <Input
            label="Conta autenticada (Firebase Auth)"
            value={adminEmail}
            readOnly
            disabled
            helperText="Administrador único protegido por UID e regras do Firestore."
          />

          <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-1">
            <div>
              {savedNotice && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--kz-success-text)]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Nome atualizado com sucesso.
                </span>
              )}
            </div>
            <Button type="submit" variant="primary" size="md">
              Salvar Preferências
            </Button>
          </div>
        </form>
      </Card>

      {/* Workspace, Nuvem & Backup */}
      <Card padding="lg" className="space-y-4">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <CardTitle>Workspace, Sincronização & Governança</CardTitle>
              <CardDescription>
                Estado real da persistência em nuvem e acesso rápido ao backup JSON v3.0.
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={
              syncStatus === 'error'
                ? 'danger'
                : syncStatus === 'saving'
                ? 'info'
                : isCloudSynced
                ? 'success'
                : 'warning'
            }
            dot
          >
            {syncStatus === 'error'
              ? 'Erro de Sync'
              : syncStatus === 'saving'
              ? 'Salvando...'
              : isCloudSynced
              ? 'Firestore Conectado'
              : 'Conectando...'}
          </Badge>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)] space-y-1">
            <div className="text-[11px] font-medium text-[var(--kz-text-muted)]">
              Workspace Ativo
            </div>
            <div className="text-xs font-mono font-bold text-[var(--kz-text-primary)]">
              {WORKSPACE_ID}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)] space-y-1">
            <div className="text-[11px] font-medium text-[var(--kz-text-muted)]">
              Registros Sincronizados
            </div>
            <div className="text-xs font-mono font-bold text-[var(--kz-text-primary)]">
              {niches.length} nichos · {leads.length} leads · {importedSheets.length} planilhas
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)] space-y-1">
            <div className="text-[11px] font-medium text-[var(--kz-text-muted)]">
              Último Backup neste Navegador
            </div>
            <div className="text-xs font-semibold text-[var(--kz-text-primary)]">
              {lastBackupAt
                ? new Date(lastBackupAt).toLocaleString('pt-BR')
                : 'Nenhum registrado'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--kz-border-subtle)]">
          <div className="flex items-center gap-2 text-xs text-[var(--kz-text-muted)]">
            <ShieldCheck className="w-4 h-4 text-[var(--kz-success-solid)] shrink-0" />
            <span>
              Exportação completa, pré-visualização de restauração e gestão de nichos estão
              disponíveis em Relatórios.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
              onClick={() => onNavigate('global')}
            >
              Abrir Backup & Relatórios
            </Button>

            {onClearAllContacts && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-[var(--kz-danger-solid)]" />}
                className="text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)]"
                onClick={() => {
                  setClearConfirmText('');
                  setClearError(null);
                  setIsClearOpen(true);
                }}
              >
                Zerar Base
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Integrações Externas (Transparente — não configurado) */}
      <Card padding="lg" className="space-y-4">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] flex items-center justify-center">
              <Plug className="w-4 h-4" />
            </div>
            <div>
              <CardTitle>Integrações e Módulos Futuros</CardTitle>
              <CardDescription>
                Status transparente das integrações planejadas para as próximas etapas do Kaizen.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {FUTURE_INTEGRATIONS.map((integ) => (
            <div
              key={integ.name}
              className="p-3.5 rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-subtle)]/50 flex items-start justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="text-xs font-bold text-[var(--kz-text-primary)] flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-[var(--kz-text-subtle)]" />
                  <span>{integ.name}</span>
                </div>
                <p className="text-[11px] text-[var(--kz-text-muted)] leading-relaxed">
                  {integ.description}
                </p>
              </div>
              <Badge variant="neutral" size="sm">
                Não configurado
              </Badge>
            </div>
          ))}
        </div>

        <Alert variant="info">
          Nenhuma integração externa é simulada. Cada conector será ativado de forma segura apenas
          quando sua respectiva etapa for implementada.
        </Alert>
      </Card>

      {/* Confirm Clear Base Dialog */}
      <ConfirmDialog
        isOpen={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        onConfirm={handleConfirmClear}
        title="Zerar Banco de Dados (Ação Irreversível)"
        description={
          <span>
            Serão apagados do Cloud Firestore e do cache local: <strong>{leads.length} leads</strong>,{' '}
            <strong>{niches.length} nichos</strong> e{' '}
            <strong>{importedSheets.length} registros de planilhas</strong>.
          </span>
        }
        confirmLabel="Confirmar Exclusão Total"
        variant="danger"
        loading={isClearing}
        confirmDisabled={clearConfirmText.trim().toUpperCase() !== 'ZERAR'}
      >
        <Input
          label="Digite ZERAR para confirmar"
          value={clearConfirmText}
          onChange={(e) => setClearConfirmText(e.target.value)}
          placeholder="ZERAR"
          className="font-mono"
        />
        {clearError && <Alert variant="danger">{clearError}</Alert>}
      </ConfirmDialog>
    </div>
  );
};
