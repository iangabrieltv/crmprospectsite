import React, { useMemo, useState } from 'react';
import { Lead, NicheCampaign } from '../../types/crm';
import { Client } from '../../types/kaizen';
import {
  CommercialScript,
  CommercialScriptChannel,
  ResourceCategory,
  SCRIPT_CHANNEL_OPTIONS,
  SCRIPT_PLACEHOLDERS,
} from '../../types/resources';
import {
  ScriptVariableContext,
  archiveCommercialScript,
  buildScriptWhatsAppUrl,
  buildVariableContextFromClient,
  buildVariableContextFromLead,
  createCommercialScript,
  duplicateCommercialScript,
  filterCommercialScripts,
  interpolateCommercialScript,
  markScriptUsed,
} from '../../services/resources';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  Textarea,
} from '../ui';
import {
  AlertTriangle,
  Archive,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  MessageCircle,
  MessageSquareCode,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from 'lucide-react';

interface CommercialScriptsTabProps {
  scripts: CommercialScript[];
  categories: ResourceCategory[];
  leads: Lead[];
  niches: NicheCampaign[];
  clients: Client[];
  userName: string;
  agencyName?: string;
  openCreateSignal?: number;
  onSaveScript: (script: CommercialScript, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteScript: (scriptId: string) => Promise<void> | void;
}

export const CommercialScriptsTab: React.FC<CommercialScriptsTabProps> = ({
  scripts,
  categories,
  leads,
  niches,
  clients,
  userName,
  agencyName = 'Agência Kaizen',
  onSaveScript,
  onDeleteScript,
}) => {
  const scriptCategories = useMemo(
    () =>
      categories
        .filter((c) => c.kind === 'script' && c.active)
        .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)),
    [categories]
  );

  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<CommercialScriptChannel | ''>('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ativo' | 'arquivado' | 'all'>('ativo');

  // Seletor de contexto real (Lead, Cliente ou Manual)
  const [contextSource, setContextSource] = useState<'lead' | 'client' | 'manual'>(
    leads.length > 0 ? 'lead' : clients.length > 0 ? 'client' : 'manual'
  );
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0]?.id || '');
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '');
  const [manualCtx, setManualCtx] = useState<ScriptVariableContext>({
    nome: '',
    empresa: '',
    servico: '',
    cidade: '',
    link: '',
    nome_agencia: agencyName,
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal Criar/Editar Script
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<CommercialScript | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategoryId, setFormCategoryId] = useState(scriptCategories[0]?.id || '');
  const [formChannel, setFormChannel] = useState<CommercialScriptChannel>('whatsapp');
  const [formDescription, setFormDescription] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formFavorite, setFormFavorite] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);

  // Safe delete / archive confirmation
  const [confirmDeleteTarget, setConfirmDeleteTarget] =
    useState<CommercialScript | null>(null);

  const activeLead = leads.find((l) => l.id === selectedLeadId) || null;
  const activeClient = clients.find((c) => c.id === selectedClientId) || null;

  const activeVariableContext: ScriptVariableContext = useMemo(() => {
    if (contextSource === 'lead' && activeLead) {
      const niche = niches.find((n) => n.id === activeLead.nicheId) || null;
      return buildVariableContextFromLead(activeLead, niche, agencyName);
    }
    if (contextSource === 'client' && activeClient) {
      return buildVariableContextFromClient(activeClient, agencyName);
    }
    return {
      ...manualCtx,
      nome_agencia: manualCtx.nome_agencia || agencyName,
    };
  }, [contextSource, activeLead, activeClient, niches, manualCtx, agencyName]);

  const activePhone =
    contextSource === 'lead'
      ? activeLead?.phone || ''
      : contextSource === 'client'
      ? activeClient?.phone || ''
      : '';

  const filteredScripts = useMemo(
    () =>
      filterCommercialScripts(scripts, {
        query,
        categoryId: selectedCategoryId || undefined,
        channel: selectedChannel,
        favoritesOnly,
        status: statusFilter,
      }),
    [scripts, query, selectedCategoryId, selectedChannel, favoritesOnly, statusFilter]
  );

  const openCreateModal = () => {
    setEditingScript(null);
    setFormTitle('');
    setFormCategoryId(selectedCategoryId || scriptCategories[0]?.id || '');
    setFormChannel('whatsapp');
    setFormDescription('');
    setFormContent(
      `Olá {{nome}}, tudo bem? Aqui é da {{nome_agencia}}.\n\nSobre a {{empresa}} em {{cidade}}, gostaria de alinhar o próximo passo de {{servico}}: {{link}}`
    );
    setFormTags('');
    setFormFavorite(false);
    setIsModalOpen(true);
  };

  const openEditModal = (script: CommercialScript) => {
    setEditingScript(script);
    setFormTitle(script.title);
    setFormCategoryId(script.categoryId);
    setFormChannel(script.channel);
    setFormDescription(script.description || '');
    setFormContent(script.content);
    setFormTags((script.tags || []).join(', '));
    setFormFavorite(Boolean(script.favorite));
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim() || !formCategoryId) return;
    setIsSavingForm(true);
    try {
      const tags = formTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (editingScript) {
        await onSaveScript(
          {
            ...editingScript,
            title: formTitle.trim(),
            categoryId: formCategoryId,
            channel: formChannel,
            description: formDescription.trim() || undefined,
            content: formContent,
            tags,
            favorite: formFavorite,
            updatedAt: new Date().toISOString(),
          },
          'edit'
        );
      } else {
        const created = createCommercialScript({
          title: formTitle,
          categoryId: formCategoryId,
          channel: formChannel,
          description: formDescription,
          content: formContent,
          tags,
          favorite: formFavorite,
          createdBy: userName || 'Ian',
        });
        await onSaveScript(created, 'create');
      }
      setIsModalOpen(false);
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleCopyRendered = async (script: CommercialScript, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(script.id);
      setTimeout(() => setCopiedId(null), 1800);
      await onSaveScript(markScriptUsed(script), 'edit');
    } catch {
      // ignore clipboard errors cleanly
    }
  };

  const handleDuplicate = async (script: CommercialScript) => {
    const dup = duplicateCommercialScript(script, userName || 'Ian');
    await onSaveScript(dup, 'create');
  };

  const handleToggleFavorite = async (script: CommercialScript) => {
    await onSaveScript(
      { ...script, favorite: !script.favorite, updatedAt: new Date().toISOString() },
      'edit'
    );
  };

  const handleToggleArchive = async (script: CommercialScript) => {
    if (script.status === 'arquivado') {
      await onSaveScript(
        {
          ...script,
          status: 'ativo',
          archivedAt: undefined,
          updatedAt: new Date().toISOString(),
        },
        'edit'
      );
    } else {
      await onSaveScript(archiveCommercialScript(script), 'edit');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget) return;
    if (confirmDeleteTarget.referencedInHistory) {
      await onSaveScript(archiveCommercialScript(confirmDeleteTarget), 'edit');
    } else {
      await onDeleteScript(confirmDeleteTarget.id);
    }
    setConfirmDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      {/* Barra superior: Contexto Dinâmico Real + Busca */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--kz-text-primary)]">
              Central de Scripts Comerciais ({scripts.filter((s) => s.status === 'ativo').length} ativos)
            </h3>
            <p className="text-xs text-[var(--kz-text-secondary)]">
              Pré-visualização honesta com dados reais do CRM ou Cliente — variáveis sem
              preenchimento permanecem explícitas para você revisar antes do envio.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="h-3.5 w-3.5" />
            Novo Script
          </Button>
        </div>

        {/* Contexto de Variáveis Reais */}
        <div className="rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/70 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--kz-text-secondary)]">
              Contexto para Pré-Visualização de Variáveis
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setContextSource('lead')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  contextSource === 'lead'
                    ? 'bg-[var(--kz-accent)]/15 text-[var(--kz-accent-text)] border border-[var(--kz-accent)]/35'
                    : 'text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)]'
                }`}
              >
                Lead Real ({leads.length})
              </button>
              <button
                type="button"
                onClick={() => setContextSource('client')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  contextSource === 'client'
                    ? 'bg-[var(--kz-accent)]/15 text-[var(--kz-accent-text)] border border-[var(--kz-accent)]/35'
                    : 'text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)]'
                }`}
              >
                Cliente Real ({clients.length})
              </button>
              <button
                type="button"
                onClick={() => setContextSource('manual')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  contextSource === 'manual'
                    ? 'bg-[var(--kz-accent)]/15 text-[var(--kz-accent-text)] border border-[var(--kz-accent)]/35'
                    : 'text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)]'
                }`}
              >
                Preenchimento Manual
              </button>
            </div>
          </div>

          {contextSource === 'lead' ? (
            <Select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
            >
              {leads.length === 0 ? (
                <option value="">Nenhum lead no CRM</option>
              ) : (
                leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.companyName} {l.contactName ? `(${l.contactName})` : ''} · {l.city || 'Sem cidade'}
                  </option>
                ))
              )}
            </Select>
          ) : contextSource === 'client' ? (
            <Select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              {clients.length === 0 ? (
                <option value="">Nenhum cliente cadastrado</option>
              ) : (
                clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} {c.contactName ? `(${c.contactName})` : ''}
                  </option>
                ))
              )}
            </Select>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Input
                placeholder="{{nome}}"
                value={manualCtx.nome || ''}
                onChange={(e) => setManualCtx((p) => ({ ...p, nome: e.target.value }))}
              />
              <Input
                placeholder="{{empresa}}"
                value={manualCtx.empresa || ''}
                onChange={(e) => setManualCtx((p) => ({ ...p, empresa: e.target.value }))}
              />
              <Input
                placeholder="{{servico}}"
                value={manualCtx.servico || ''}
                onChange={(e) => setManualCtx((p) => ({ ...p, servico: e.target.value }))}
              />
              <Input
                placeholder="{{cidade}}"
                value={manualCtx.cidade || ''}
                onChange={(e) => setManualCtx((p) => ({ ...p, cidade: e.target.value }))}
              />
              <Input
                placeholder="{{link}}"
                value={manualCtx.link || ''}
                onChange={(e) => setManualCtx((p) => ({ ...p, link: e.target.value }))}
              />
              <Input
                placeholder="{{nome_agencia}}"
                value={manualCtx.nome_agencia || ''}
                onChange={(e) =>
                  setManualCtx((p) => ({ ...p, nome_agencia: e.target.value }))
                }
              />
            </div>
          )}
        </div>

        {/* Busca e Filtros */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Input
              placeholder="Pesquisar título, texto ou tags do script..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search className="h-3.5 w-3.5" />}
            />
          </div>
          <Select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
          >
            <option value="">Todas as 14 categorias</option>
            {scriptCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={selectedChannel}
            onChange={(e) =>
              setSelectedChannel(e.target.value as CommercialScriptChannel | '')
            }
          >
            <option value="">Todos os canais</option>
            {SCRIPT_CHANNEL_OPTIONS.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.label}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ativo' | 'arquivado' | 'all')
              }
            >
              <option value="ativo">Ativos</option>
              <option value="arquivado">Arquivados</option>
              <option value="all">Todos</option>
            </Select>
            <button
              type="button"
              onClick={() => setFavoritesOnly((prev) => !prev)}
              className={`rounded-lg border p-2 cursor-pointer ${
                favoritesOnly
                  ? 'border-[#C6A15B]/50 bg-[#C6A15B]/15 text-[#D9BC7E]'
                  : 'border-[var(--kz-border-subtle)] text-[var(--kz-text-muted)]'
              }`}
              title="Somente favoritos"
            >
              <Star className={`h-4 w-4 ${favoritesOnly ? 'fill-[#D9BC7E]' : ''}`} />
            </button>
          </div>
        </div>
      </Card>

      {/* Grade: Categorias Laterais + Lista de Scripts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <Card className="p-3 h-fit space-y-1">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--kz-text-muted)]">
            Categorias ({scriptCategories.length})
          </p>
          <button
            type="button"
            onClick={() => setSelectedCategoryId('')}
            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left cursor-pointer ${
              selectedCategoryId === ''
                ? 'bg-[var(--kz-accent)]/15 text-[var(--kz-accent-text)] font-semibold'
                : 'text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)]'
            }`}
          >
            <span>Todas</span>
            <span className="tabular-nums text-[11px]">
              {scripts.filter((s) => s.status === 'ativo').length}
            </span>
          </button>
          {scriptCategories.map((cat) => {
            const count = scripts.filter(
              (s) => s.categoryId === cat.id && s.status === 'ativo'
            ).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left cursor-pointer ${
                  selectedCategoryId === cat.id
                    ? 'bg-[var(--kz-accent)]/15 text-[var(--kz-accent-text)] font-semibold'
                    : 'text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)]'
                }`}
              >
                <span className="truncate">{cat.name}</span>
                <span className="tabular-nums text-[11px]">{count}</span>
              </button>
            );
          })}
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {filteredScripts.length === 0 ? (
            <EmptyState
              icon={<MessageSquareCode className="h-5 w-5" />}
              title="Nenhum script encontrado nesta seleção"
              description="Crie um novo script ou selecione outra categoria para visualizar roteiros."
              action={
                <Button variant="primary" size="sm" onClick={openCreateModal}>
                  <Plus className="h-3.5 w-3.5" />
                  Criar Script
                </Button>
              }
            />
          ) : (
            filteredScripts.map((script) => {
              const cat = categories.find((c) => c.id === script.categoryId);
              const rendered = interpolateCommercialScript(
                script.content,
                activeVariableContext
              );
              const whatsappUrl = activePhone
                ? buildScriptWhatsAppUrl(activePhone, rendered.renderedText)
                : '';

              return (
                <Card key={script.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-[var(--kz-text-primary)]">
                          {script.title}
                        </h4>
                        <Badge variant="info">{cat?.name || 'Sem categoria'}</Badge>
                        <Badge variant="neutral">
                          {SCRIPT_CHANNEL_OPTIONS.find((c) => c.id === script.channel)?.label ||
                            script.channel}
                        </Badge>
                        {script.status === 'arquivado' && (
                          <Badge variant="warning">Arquivado</Badge>
                        )}
                      </div>
                      {script.description && (
                        <p className="text-xs text-[var(--kz-text-muted)]">
                          {script.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleToggleFavorite(script)}
                        title="Favoritar"
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${
                            script.favorite ? 'fill-[#D9BC7E] text-[#D9BC7E]' : ''
                          }`}
                        />
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => openEditModal(script)}
                        title="Editar"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleDuplicate(script)}
                        title="Duplicar script"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleToggleArchive(script)}
                        title={script.status === 'arquivado' ? 'Restaurar' : 'Arquivar'}
                      >
                        {script.status === 'arquivado' ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setConfirmDeleteTarget(script)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </Button>
                    </div>
                  </div>

                  {/* Pré-visualização com variáveis reais */}
                  <div className="rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/70 p-3.5 text-xs whitespace-pre-wrap text-[var(--kz-text-primary)] leading-relaxed">
                    {rendered.renderedText}
                  </div>

                  {rendered.missingVariables.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Campos sem dados no cadastro atual (não inventados):{' '}
                        <strong>{rendered.missingVariables.join(', ')}</strong>
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--kz-text-muted)]">
                      <span className="tabular-nums">
                        Usos registrados: {script.usageCount || 0}
                      </span>
                      {script.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded border border-[var(--kz-border-subtle)] px-1.5 py-0.5 text-[10px]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => handleCopyRendered(script, rendered.renderedText)}
                      >
                        {copiedId === script.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copiar Texto Preenchido
                          </>
                        )}
                      </Button>

                      {whatsappUrl ? (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => onSaveScript(markScriptUsed(script), 'edit')}
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/30"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Abrir no WhatsApp
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-[var(--kz-text-muted)]">
                          Selecione um Lead/Cliente com telefone para abrir WhatsApp
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Criar / Editar Script */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingScript ? 'Editar Script Comercial' : 'Novo Script Comercial'}
        subtitle="Utilize variáveis dinâmicas sem risco: dados ausentes nunca são inventados."
        size="lg"
      >
        <form onSubmit={handleSaveModal} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Título do Script *"
              placeholder="Ex.: Follow-up Pós-Envio de Proposta"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
            <Select
              label="Categoria *"
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
            >
              {scriptCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Canal Principal"
              value={formChannel}
              onChange={(e) =>
                setFormChannel(e.target.value as CommercialScriptChannel)
              }
            >
              {SCRIPT_CHANNEL_OPTIONS.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.label}
                </option>
              ))}
            </Select>
            <Input
              label="Tags (separadas por vírgula)"
              placeholder="followup, proposta, fechamento"
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
            />
          </div>

          <Input
            label="Descrição de uso"
            placeholder="Quando e em qual etapa do atendimento usar este roteiro"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[var(--kz-text-secondary)]">
                Conteúdo do Script *
              </label>
              <div className="flex flex-wrap gap-1">
                {SCRIPT_PLACEHOLDERS.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    onClick={() => setFormContent((prev) => `${prev}${prev.endsWith(' ') || prev === '' ? '' : ' '}${p.token}`)}
                    className="rounded border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)] px-2 py-0.5 text-[10px] font-mono text-[var(--kz-accent-text)] hover:border-[var(--kz-accent)]/50 cursor-pointer"
                    title={p.label}
                  >
                    + {p.token}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              rows={7}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[var(--kz-border-subtle)]">
            <button
              type="button"
              onClick={() => setFormFavorite((p) => !p)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                formFavorite
                  ? 'border-[#C6A15B]/50 bg-[#C6A15B]/15 text-[#D9BC7E]'
                  : 'border-[var(--kz-border-subtle)] text-[var(--kz-text-secondary)]'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${formFavorite ? 'fill-[#D9BC7E]' : ''}`} />
              {formFavorite ? 'Favorito' : 'Marcar Favorito'}
            </button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={isSavingForm}>
                {editingScript ? 'Salvar Alterações' : 'Criar Script'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Confirmação Segura de Exclusão/Arquivamento */}
      <ConfirmDialog
        isOpen={Boolean(confirmDeleteTarget)}
        onClose={() => setConfirmDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={
          confirmDeleteTarget?.referencedInHistory
            ? 'Arquivar Script com Histórico'
            : 'Excluir Script Comercial'
        }
        description={
          confirmDeleteTarget?.referencedInHistory ? (
            <Alert variant="warning">
              Este script já foi utilizado em atendimentos ({confirmDeleteTarget.usageCount || 1} uso(s)).
              Para preservar o histórico, ele será <strong>arquivado</strong> em vez de apagado
              definitivamente.
            </Alert>
          ) : (
            `Tem certeza que deseja excluir o script "${confirmDeleteTarget?.title}"?`
          )
        }
        confirmLabel={
          confirmDeleteTarget?.referencedInHistory ? 'Arquivar Script' : 'Excluir'
        }
      />
    </div>
  );
};
