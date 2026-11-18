import React, { useEffect, useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Download,
  FileSpreadsheet,
  Play,
  Sliders,
  Star,
  Trash2,
} from 'lucide-react';
import { Lead, NicheCampaign } from '../../types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialPost,
  Task,
} from '../../types/kaizen';
import {
  FinancialCategory,
  FinancialEntry,
  FinancialSettings,
  FinancialTransaction,
} from '../../types/finance';
import { ResourceFile } from '../../types/resources';
import {
  ANALYTICS_PERIOD_OPTIONS,
  AnalyticsPeriodPreset,
  AnalyticsPreferences,
  CustomReportConfig,
  CustomReportModuleId,
  GeneratedAnalyticsReport,
  SavedCustomReport,
} from '../../types/analytics';
import {
  CUSTOM_REPORT_MODULE_OPTIONS,
  createSavedCustomReportRecord,
  downloadAnalyticsReportCsv,
  downloadAnalyticsReportPdf,
  generateCustomReport,
  getCustomReportModuleDef,
  sanitizeConfigForModule,
  validateCustomReportConfig,
} from '../../services/analytics';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '../ui';
import { AnalyticsKpiCard, DataLimitationBanner } from './AnalyticsCharts';

interface AnalyticsCustomReportsTabProps {
  leads: Lead[];
  niches: NicheCampaign[];
  clients: Client[];
  proposals: ProposalContract[];
  projects: Project[];
  tasks: Task[];
  agendaEvents: AgendaEvent[];
  socialPosts: SocialPost[];
  financialEntries: FinancialEntry[];
  financialTransactions: FinancialTransaction[];
  financialCategories: FinancialCategory[];
  financialSettings: FinancialSettings;
  resourceFiles: ResourceFile[];
  savedReports: SavedCustomReport[];
  preferences: AnalyticsPreferences;
  onSaveCustomReport: (report: SavedCustomReport) => Promise<void>;
  onDeleteCustomReport: (reportId: string) => Promise<void>;
  onToggleFavoriteCustomReport: (report: SavedCustomReport) => Promise<void>;
  onActiveReportChange?: (report: GeneratedAnalyticsReport | null) => void;
  onFeedback?: (msg: string) => void;
}

export const AnalyticsCustomReportsTab: React.FC<AnalyticsCustomReportsTabProps> = ({
  leads,
  niches,
  clients,
  proposals,
  projects,
  tasks,
  agendaEvents,
  socialPosts,
  financialEntries,
  financialTransactions,
  financialCategories,
  financialSettings,
  resourceFiles,
  savedReports,
  preferences,
  onSaveCustomReport,
  onDeleteCustomReport,
  onToggleFavoriteCustomReport,
  onActiveReportChange,
  onFeedback,
}) => {
  const [config, setConfig] = useState<CustomReportConfig>(() => ({
    module: 'financeiro_lancamentos',
    periodPreset: preferences.defaultPeriodPreset || 'este_mes',
    onlyOverdue: false,
    includeCancelled: false,
  }));
  const [activeTitleOverride, setActiveTitleOverride] = useState<string | undefined>(undefined);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);

  // Save modal state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveFavorite, setSaveFavorite] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm state
  const [reportToDelete, setReportToDelete] = useState<SavedCustomReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const moduleDef = useMemo(() => getCustomReportModuleDef(config.module), [config.module]);
  const validation = useMemo(() => validateCustomReportConfig(config), [config]);

  const generatedReport = useMemo<GeneratedAnalyticsReport | null>(() => {
    if (!validation.valid) return null;
    try {
      return generateCustomReport({
        config,
        reportTitle: activeTitleOverride,
        leads,
        niches,
        clients,
        proposals,
        projects,
        tasks,
        agendaEvents,
        socialPosts,
        financialEntries,
        financialTransactions,
        financialCategories,
        financialSettings,
        resourceFiles,
      });
    } catch {
      return null;
    }
  }, [
    validation.valid,
    config,
    activeTitleOverride,
    leads,
    niches,
    clients,
    proposals,
    projects,
    tasks,
    agendaEvents,
    socialPosts,
    financialEntries,
    financialTransactions,
    financialCategories,
    financialSettings,
    resourceFiles,
  ]);

  useEffect(() => {
    if (onActiveReportChange) {
      onActiveReportChange(generatedReport);
    }
  }, [generatedReport, onActiveReportChange]);

  const sortedSavedReports = useMemo(
    () =>
      [...savedReports].sort((a, b) => {
        if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
        return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
      }),
    [savedReports]
  );

  const handleModuleChange = (nextModule: CustomReportModuleId) => {
    setActiveTitleOverride(undefined);
    setActiveSavedId(null);
    setConfig((prev) => sanitizeConfigForModule(prev, nextModule));
  };

  const handleLoadSaved = (saved: SavedCustomReport) => {
    setConfig(saved.config);
    setActiveTitleOverride(saved.name);
    setActiveSavedId(saved.id);
    if (onFeedback) {
      onFeedback(`Relatório "${saved.name}" carregado com dados atualizados.`);
    }
  };

  const handleOpenSaveModal = () => {
    setSaveName(activeTitleOverride || '');
    setSaveDescription('');
    setSaveFavorite(false);
    setSaveError(null);
    setIsSaveModalOpen(true);
  };

  const handleConfirmSave = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const record = createSavedCustomReportRecord({
        id: activeSavedId || undefined,
        name: saveName,
        description: saveDescription,
        config,
        favorite: saveFavorite,
      });
      await onSaveCustomReport(record);
      setActiveTitleOverride(record.name);
      setActiveSavedId(record.id);
      setIsSaveModalOpen(false);
      if (onFeedback) {
        onFeedback(`Modelo de relatório "${record.name}" salvo.`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar relatório.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteCustomReport(reportToDelete.id);
      if (activeSavedId === reportToDelete.id) {
        setActiveSavedId(null);
        setActiveTitleOverride(undefined);
      }
      setReportToDelete(null);
      if (onFeedback) {
        onFeedback('Modelo de relatório removido.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportPdf = () => {
    if (!generatedReport) return;
    const filename = downloadAnalyticsReportPdf(generatedReport);
    if (onFeedback) onFeedback(`PDF exportado: ${filename}`);
  };

  const handleExportCsv = () => {
    if (!generatedReport) return;
    const filename = downloadAnalyticsReportCsv(generatedReport);
    if (onFeedback) onFeedback(`CSV exportado: ${filename}`);
  };

  return (
    <div className="space-y-6">
      {/* Construtor Dinâmico & Modelos Salvos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="md" className="lg:col-span-2 space-y-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--kz-accent)]" />
              <div>
                <CardTitle>Construtor de Relatório Personalizado</CardTitle>
                <CardDescription>
                  Selecione módulo, período e apenas filtros compatíveis com a fonte de dados.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="primary"
              size="xs"
              leftIcon={<BookmarkPlus className="w-3.5 h-3.5" />}
              disabled={!validation.valid}
              onClick={handleOpenSaveModal}
            >
              Salvar Modelo
            </Button>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Módulo / Base de Dados"
              value={config.module}
              onChange={(e) => handleModuleChange(e.target.value as CustomReportModuleId)}
            >
              {CUSTOM_REPORT_MODULE_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>

            <Select
              label="Período"
              value={config.periodPreset}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  periodPreset: e.target.value as AnalyticsPeriodPreset,
                }))
              }
            >
              {ANALYTICS_PERIOD_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>

            {config.periodPreset === 'personalizado' && (
              <>
                <Input
                  type="date"
                  label="Data Inicial"
                  value={config.customStart || ''}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, customStart: e.target.value }))
                  }
                />
                <Input
                  type="date"
                  label="Data Final"
                  value={config.customEnd || ''}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, customEnd: e.target.value }))
                  }
                />
              </>
            )}

            {moduleDef.supportedFilters.nicheId && (
              <Select
                label="Campanha / Nicho"
                value={config.nicheId || ''}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, nicheId: e.target.value || undefined }))
                }
              >
                <option value="">Todos os nichos</option>
                {niches.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.emoji} {n.name}
                  </option>
                ))}
              </Select>
            )}

            {moduleDef.supportedFilters.clientId && (
              <Select
                label="Cliente"
                value={config.clientId || ''}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, clientId: e.target.value || undefined }))
                }
              >
                <option value="">Todos os clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </Select>
            )}

            {moduleDef.supportedFilters.projectId && (
              <Select
                label="Projeto"
                value={config.projectId || ''}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, projectId: e.target.value || undefined }))
                }
              >
                <option value="">Todos os projetos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}

            {moduleDef.supportedFilters.categoryId && (
              <Select
                label="Categoria Financeira"
                value={config.categoryId || ''}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, categoryId: e.target.value || undefined }))
                }
              >
                <option value="">Todas as categorias</option>
                {financialCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.kind === 'receita' ? 'Receita' : 'Despesa'})
                  </option>
                ))}
              </Select>
            )}

            {moduleDef.supportedFilters.statusFilter && (
              <Select
                label="Status / Recorte"
                value={config.statusFilter || ''}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    statusFilter: e.target.value || undefined,
                  }))
                }
              >
                <option value="">Todos</option>
                {moduleDef.statusOptions.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {(moduleDef.supportedFilters.onlyOverdue ||
            moduleDef.supportedFilters.includeCancelled) && (
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[var(--kz-text-secondary)]">
              {moduleDef.supportedFilters.onlyOverdue && (
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.onlyOverdue)}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, onlyOverdue: e.target.checked }))
                    }
                  />
                  <span>Somente itens em atraso</span>
                </label>
              )}
              {moduleDef.supportedFilters.includeCancelled && (
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.includeCancelled)}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, includeCancelled: e.target.checked }))
                    }
                  />
                  <span>Incluir registros cancelados / encerrados</span>
                </label>
              )}
            </div>
          )}

          {!validation.valid && (
            <Alert variant="danger" title="Combinação de filtros inválida">
              {validation.errors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </Alert>
          )}
        </Card>

        {/* Modelos Salvos */}
        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div>
              <CardTitle>Relatórios Salvos ({sortedSavedReports.length})</CardTitle>
              <CardDescription>Reexecute com um clique sobre os dados atuais.</CardDescription>
            </div>
          </CardHeader>

          {sortedSavedReports.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--kz-text-muted)]">
              Nenhum relatório personalizado salvo ainda. Configure ao lado e clique em{' '}
              <strong>Salvar Modelo</strong>.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {sortedSavedReports.map((rep) => {
                const isActive = activeSavedId === rep.id;
                return (
                  <div
                    key={rep.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 transition-colors ${
                      isActive
                        ? 'bg-[var(--kz-accent-soft)]/50 border-[var(--kz-accent-border)]'
                        : 'bg-[var(--kz-bg-canvas)] border-[var(--kz-border-subtle)]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="font-semibold text-[var(--kz-text-primary)] truncate">
                        {rep.name}
                      </div>
                      <div className="text-[10px] text-[var(--kz-text-muted)] truncate">
                        {getCustomReportModuleDef(rep.config.module).label}
                      </div>
                      {rep.description && (
                        <div className="text-[10px] text-[var(--kz-text-secondary)] line-clamp-2">
                          {rep.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleFavoriteCustomReport(rep)}
                        title={rep.favorite ? 'Remover favorito' : 'Favoritar'}
                        className={`p-1 rounded hover:bg-[var(--kz-bg-subtle)] cursor-pointer ${
                          rep.favorite ? 'text-[var(--kz-accent)]' : 'text-[var(--kz-text-subtle)]'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${rep.favorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadSaved(rep)}
                        title="Executar modelo"
                        className="p-1 rounded text-[var(--kz-accent-text)] hover:bg-[var(--kz-bg-subtle)] cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportToDelete(rep)}
                        title="Excluir modelo"
                        className="p-1 rounded text-[var(--kz-text-subtle)] hover:text-[var(--kz-danger-text)] hover:bg-[var(--kz-bg-subtle)] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Pré-visualização e Exportação do Relatório Gerado */}
      {generatedReport && (
        <Card padding="md" className="space-y-4">
          <CardHeader>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{generatedReport.title}</CardTitle>
                <Badge variant="accent">{generatedReport.periodLabel}</Badge>
              </div>
              <CardDescription>{generatedReport.appliedFiltersSummary}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                onClick={handleExportCsv}
              >
                Exportar CSV
              </Button>
              <Button
                variant="primary"
                size="xs"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportPdf}
              >
                Exportar PDF
              </Button>
            </div>
          </CardHeader>

          {generatedReport.summaryCards.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {generatedReport.summaryCards.map((card, i) => (
                <AnalyticsKpiCard
                  key={i}
                  label={card.label}
                  value={card.value}
                  subtitle={card.hint}
                  compact
                />
              ))}
            </div>
          )}

          {generatedReport.dataLimitationsNote && (
            <DataLimitationBanner
              alwaysShow
              message={generatedReport.dataLimitationsNote}
            />
          )}

          {generatedReport.rows.length === 0 ? (
            <EmptyState
              icon={<Sliders className="w-5 h-5" />}
              title="Sem registros neste recorte"
              description={generatedReport.emptyMessage}
            />
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    {generatedReport.columns.map((col, idx) => (
                      <TableHead key={idx}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedReport.rows.map((row, rIdx) => (
                    <TableRow key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <TableCell
                          key={cIdx}
                          className={`${
                            cIdx === 0 ? 'font-medium text-[var(--kz-text-primary)]' : ''
                          } ${preferences.compactTables ? 'py-2' : ''}`}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {generatedReport.totalsRow && (
                    <TableRow className="bg-[var(--kz-accent-soft)]/30 font-bold">
                      {generatedReport.totalsRow.map((cell, cIdx) => (
                        <TableCell
                          key={cIdx}
                          className={`text-[var(--kz-text-primary)] ${
                            preferences.compactTables ? 'py-2' : ''
                          }`}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      )}

      {/* Modal: Salvar Relatório Personalizado */}
      <Modal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        size="sm"
        closeDisabled={isSaving}
        title="Salvar Modelo de Relatório"
        subtitle={`Módulo: ${moduleDef.label}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsSaveModalOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button variant="primary" loading={isSaving} onClick={handleConfirmSave}>
              Salvar Modelo
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {saveError && <Alert variant="danger">{saveError}</Alert>}
          <Input
            label="Nome do Relatório"
            required
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Ex.: Receitas em Aberto por Cliente"
          />
          <Textarea
            label="Descrição (opcional)"
            rows={2}
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
            placeholder="Objetivo ou frequência de conferência..."
          />
          <label className="flex items-center gap-2 text-xs text-[var(--kz-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={saveFavorite}
              onChange={(e) => setSaveFavorite(e.target.checked)}
            />
            <span>Marcar como favorito no topo da lista</span>
          </label>
        </div>
      </Modal>

      {/* ConfirmDialog: Excluir Relatório Salvo */}
      <ConfirmDialog
        isOpen={Boolean(reportToDelete)}
        onClose={() => setReportToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Relatório Salvo"
        description={
          reportToDelete
            ? `Deseja excluir o modelo "${reportToDelete.name}"? Nenhum dado operacional será apagado.`
            : ''
        }
        confirmLabel="Excluir Modelo"
        loading={isDeleting}
      />
    </div>
  );
};
