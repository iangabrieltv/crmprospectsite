import React, { useMemo, useState } from 'react';
import { Lead, NicheCampaign } from '../../types/crm';
import { Client, Project, ProposalContract, Task } from '../../types/kaizen';
import {
  MODEL_DOMAIN_OPTIONS,
  MODEL_KIND_OPTIONS,
  ModelTemplate,
  ModelTemplateDomain,
  ModelTemplateKind,
  ResourceCategory,
} from '../../types/resources';
import {
  PROJECT_TEMPLATES,
} from '../../services/projectService';
import {
  archiveModelTemplate,
  buildIndependentProjectFromTemplateModel,
  buildIndependentProposalFromTemplate,
  buildIndependentTasksFromTemplate,
  createModelTemplate,
  duplicateModelTemplate,
  filterModelTemplates,
} from '../../services/resources';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Textarea,
} from '../ui';
import {
  Archive,
  Check,
  Copy,
  Edit3,
  Eye,
  Library,
  Play,
  Plus,
  RotateCcw,
  Search,
  Star,
} from 'lucide-react';

interface ModelLibraryTabProps {
  templates: ModelTemplate[];
  categories: ResourceCategory[];
  clients: Client[];
  leads: Lead[];
  niches: NicheCampaign[];
  projects: Project[];
  proposals: ProposalContract[];
  userName: string;
  onSaveTemplate: (template: ModelTemplate, mode: 'create' | 'edit') => Promise<void> | void;
  onCreateProposalFromTemplate: (
    draft: Omit<ProposalContract, 'id' | 'createdAt'>
  ) => Promise<void> | void;
  onCreateProjectFromTemplate: (params: {
    project: Project;
    initialTasks: Task[];
  }) => Promise<void> | void;
  onCreateTasksFromTemplate: (tasks: Task[]) => Promise<void> | void;
}

export const ModelLibraryTab: React.FC<ModelLibraryTabProps> = ({
  templates,
  categories,
  clients,
  leads,
  niches,
  projects,
  proposals,
  userName,
  onSaveTemplate,
  onCreateProposalFromTemplate,
  onCreateProjectFromTemplate,
  onCreateTasksFromTemplate,
}) => {
  const modelCategories = useMemo(
    () => categories.filter((c) => c.kind === 'modelo' && c.active),
    [categories]
  );

  const [query, setQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<ModelTemplateDomain | ''>('');
  const [kindFilter, setKindFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ativo' | 'arquivado' | 'all'>('ativo');

  // Visualizar modelo
  const [viewingTemplate, setViewingTemplate] = useState<ModelTemplate | null>(null);

  // Criar / Editar modelo
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ModelTemplate | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDomain, setFormDomain] = useState<ModelTemplateDomain>('comercial');
  const [formKind, setFormKind] = useState<ModelTemplateKind>('proposta');
  const [formCategoryId, setFormCategoryId] = useState(modelCategories[0]?.id || 'cat-mod-comercial');
  const [formDescription, setFormDescription] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formFavorite, setFormFavorite] = useState(false);
  const [formProjectRef, setFormProjectRef] = useState<'' | 'kaizen_start' | 'kaizen_performance'>('');
  const [isSavingForm, setIsSavingForm] = useState(false);

  // Utilizar modelo (instanciação independente)
  const [usingTemplate, setUsingTemplate] = useState<ModelTemplate | null>(null);
  const [useTargetClientId, setUseTargetClientId] = useState(clients[0]?.id || '');
  const [useTargetLeadId, setUseTargetLeadId] = useState('');
  const [useTargetProjectId, setUseTargetProjectId] = useState(projects[0]?.id || '');
  const [useCustomProjectName, setUseCustomProjectName] = useState('');
  const [useCopiedText, setUseCopiedText] = useState(false);
  const [useSuccessMsg, setUseSuccessMsg] = useState<string | null>(null);
  const [isInstantiating, setIsInstantiating] = useState(false);

  const filteredTemplates = useMemo(
    () =>
      filterModelTemplates(templates, {
        query,
        domain: domainFilter,
        kind: kindFilter || undefined,
        favoritesOnly,
        status: statusFilter,
      }),
    [templates, query, domainFilter, kindFilter, favoritesOnly, statusFilter]
  );

  const openCreateForm = () => {
    setEditingTemplate(null);
    setFormTitle('');
    setFormDomain('comercial');
    setFormKind('proposta');
    setFormCategoryId(modelCategories[0]?.id || 'cat-mod-comercial');
    setFormDescription('');
    setFormContent('');
    setFormTags('');
    setFormFavorite(false);
    setFormProjectRef('');
    setIsFormOpen(true);
  };

  const openEditForm = (tmpl: ModelTemplate) => {
    setEditingTemplate(tmpl);
    setFormTitle(tmpl.title);
    setFormDomain(tmpl.domain);
    setFormKind(tmpl.kind);
    setFormCategoryId(tmpl.categoryId || modelCategories[0]?.id || 'cat-mod-comercial');
    setFormDescription(tmpl.description || '');
    setFormContent(tmpl.content);
    setFormTags((tmpl.tags || []).join(', '));
    setFormFavorite(Boolean(tmpl.favorite));
    setFormProjectRef(tmpl.linkedProjectTemplateId || '');
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;
    setIsSavingForm(true);
    try {
      const tags = formTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      if (editingTemplate) {
        await onSaveTemplate(
          {
            ...editingTemplate,
            title: formTitle.trim(),
            domain: formDomain,
            kind: formKind,
            categoryId: formCategoryId,
            description: formDescription.trim() || undefined,
            content: formContent,
            tags,
            favorite: formFavorite,
            linkedProjectTemplateId:
              formKind === 'projeto' && formProjectRef ? formProjectRef : undefined,
            updatedAt: new Date().toISOString(),
          },
          'edit'
        );
      } else {
        const created = createModelTemplate({
          title: formTitle,
          domain: formDomain,
          kind: formKind,
          categoryId: formCategoryId,
          description: formDescription,
          content: formContent,
          tags,
          favorite: formFavorite,
          linkedProjectTemplateId:
            formKind === 'projeto' && formProjectRef ? formProjectRef : undefined,
          createdBy: userName || 'Ian',
        });
        await onSaveTemplate(created, 'create');
      }
      setIsFormOpen(false);
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleOpenUseModal = (tmpl: ModelTemplate) => {
    setUsingTemplate(tmpl);
    setUseTargetClientId(clients[0]?.id || '');
    setUseTargetLeadId('');
    setUseTargetProjectId(projects[0]?.id || '');
    setUseCustomProjectName(
      clients[0] ? `${tmpl.title.replace(/^Modelo de Projeto — /, '')} · ${clients[0].companyName}` : tmpl.title
    );
    setUseCopiedText(false);
    setUseSuccessMsg(null);
  };

  const handleInstantiateModel = async () => {
    if (!usingTemplate) return;
    setIsInstantiating(true);
    setUseSuccessMsg(null);
    try {
      const selectedClient = clients.find((c) => c.id === useTargetClientId) || null;
      const selectedLead = leads.find((l) => l.id === useTargetLeadId) || null;
      const nicheMatch = selectedLead
        ? niches.find((n) => n.id === selectedLead.nicheId) || null
        : null;

      if (usingTemplate.kind === 'proposta' || usingTemplate.kind === 'contrato') {
        const draft = buildIndependentProposalFromTemplate({
          template: usingTemplate,
          existingProposals: proposals,
          issuerName: userName ? `Agência Kaizen — ${userName}` : 'Agência Kaizen',
          client: selectedClient,
          lead: selectedLead,
          niche: nicheMatch,
        });
        await onCreateProposalFromTemplate(draft);
        await onSaveTemplate(
          {
            ...usingTemplate,
            usageCount: (usingTemplate.usageCount || 0) + 1,
            updatedAt: new Date().toISOString(),
          },
          'edit'
        );
        setUseSuccessMsg(
          `Cópia independente criada em Propostas e Contratos (${draft.code}). Alterações futuras neste modelo não afetam o documento gerado.`
        );
      } else if (usingTemplate.kind === 'projeto') {
        if (!selectedClient) return;
        const result = buildIndependentProjectFromTemplateModel({
          template: usingTemplate,
          name:
            useCustomProjectName.trim() ||
            `${usingTemplate.title} · ${selectedClient.companyName}`,
          clientId: selectedClient.id,
          ownerName: userName || 'Ian',
        });
        await onCreateProjectFromTemplate(result);
        await onSaveTemplate(
          {
            ...usingTemplate,
            usageCount: (usingTemplate.usageCount || 0) + 1,
            updatedAt: new Date().toISOString(),
          },
          'edit'
        );
        setUseSuccessMsg(
          `Projeto "${result.project.name}" criado com ${result.initialTasks.length} tarefa(s) independentes em Projetos & Minhas Tarefas.`
        );
      } else if (
        usingTemplate.kind === 'tarefa' ||
        usingTemplate.kind === 'checklist' ||
        usingTemplate.kind === 'plano_trabalho'
      ) {
        const createdTasks = buildIndependentTasksFromTemplate({
          template: usingTemplate,
          projectId: useTargetProjectId || undefined,
          clientId:
            projects.find((p) => p.id === useTargetProjectId)?.clientId ||
            selectedClient?.id ||
            undefined,
        });
        await onCreateTasksFromTemplate(createdTasks);
        await onSaveTemplate(
          {
            ...usingTemplate,
            usageCount: (usingTemplate.usageCount || 0) + 1,
            updatedAt: new Date().toISOString(),
          },
          'edit'
        );
        setUseSuccessMsg(
          `${createdTasks.length} tarefa(s) independente(s) adicionada(s) em Minhas Tarefas.`
        );
      } else {
        await navigator.clipboard.writeText(usingTemplate.content);
        setUseCopiedText(true);
        await onSaveTemplate(
          {
            ...usingTemplate,
            usageCount: (usingTemplate.usageCount || 0) + 1,
            updatedAt: new Date().toISOString(),
          },
          'edit'
        );
        setUseSuccessMsg('Conteúdo independente copiado para a área de transferência.');
      }
    } finally {
      setIsInstantiating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filtros e Cabeçalho */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--kz-text-primary)]">
              Biblioteca de Modelos ({templates.filter((t) => t.status === 'ativo').length} ativos)
            </h3>
            <p className="text-xs text-[var(--kz-text-secondary)]">
              Modelos comerciais, operacionais, de marketing e gestão. Utilizar um modelo
              sempre gera uma cópia independente — nunca altera registros já gerados.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={openCreateForm}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar Modelo
          </Button>
        </div>

        {/* Chips de Domínio */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDomainFilter('')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
              domainFilter === ''
                ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)]'
                : 'border border-[var(--kz-border-subtle)] text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)]'
            }`}
          >
            Todos os Domínios
          </button>
          {MODEL_DOMAIN_OPTIONS.map((dom) => (
            <button
              key={dom.id}
              type="button"
              onClick={() => setDomainFilter(dom.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                domainFilter === dom.id
                  ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)]'
                  : 'border border-[var(--kz-border-subtle)] text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)]'
              }`}
            >
              {dom.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Input
              placeholder="Buscar modelo por título, conteúdo ou tag..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search className="h-3.5 w-3.5" />}
            />
          </div>
          <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="">Todos os tipos</option>
            {MODEL_KIND_OPTIONS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
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

      {/* Grid de Modelos */}
      {filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<Library className="h-5 w-5" />}
          title="Nenhum modelo encontrado"
          description="Ajuste os filtros ou crie um novo modelo reutilizável para sua operação."
          action={
            <Button variant="primary" size="sm" onClick={openCreateForm}>
              <Plus className="h-3.5 w-3.5" />
              Criar Primeiro Modelo
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((tmpl) => {
            const domainMeta = MODEL_DOMAIN_OPTIONS.find((d) => d.id === tmpl.domain);
            const kindMeta = MODEL_KIND_OPTIONS.find((k) => k.id === tmpl.kind);
            const linkedProjectTemplate = tmpl.linkedProjectTemplateId
              ? PROJECT_TEMPLATES[tmpl.linkedProjectTemplateId]
              : null;

            return (
              <Card key={tmpl.id} className="p-4 flex flex-col justify-between gap-3">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="accent">{domainMeta?.label || tmpl.domain}</Badge>
                      <Badge variant="neutral">{kindMeta?.label || tmpl.kind}</Badge>
                      {tmpl.status === 'arquivado' && (
                        <Badge variant="warning">Arquivado</Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onSaveTemplate(
                          {
                            ...tmpl,
                            favorite: !tmpl.favorite,
                            updatedAt: new Date().toISOString(),
                          },
                          'edit'
                        )
                      }
                      className="text-[var(--kz-text-muted)] hover:text-[#D9BC7E] cursor-pointer"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          tmpl.favorite ? 'fill-[#D9BC7E] text-[#D9BC7E]' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <h4 className="text-sm font-semibold text-[var(--kz-text-primary)]">
                    {tmpl.title}
                  </h4>

                  {tmpl.description && (
                    <p className="text-xs text-[var(--kz-text-secondary)] line-clamp-2">
                      {tmpl.description}
                    </p>
                  )}

                  {linkedProjectTemplate && (
                    <p className="text-[11px] text-[var(--kz-accent-text)]">
                      Integrado ao template nativo: {linkedProjectTemplate.name} (
                      {linkedProjectTemplate.tasks.length} tarefas)
                    </p>
                  )}

                  {tmpl.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tmpl.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded border border-[var(--kz-border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--kz-text-muted)]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--kz-border-subtle)] pt-3">
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => handleOpenUseModal(tmpl)}
                    disabled={tmpl.status === 'arquivado'}
                  >
                    <Play className="h-3 w-3" />
                    Utilizar Modelo
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setViewingTemplate(tmpl)}
                      title="Visualizar conteúdo"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => openEditForm(tmpl)}
                      title="Editar modelo"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        onSaveTemplate(
                          duplicateModelTemplate(tmpl, userName || 'Ian'),
                          'create'
                        )
                      }
                      title="Duplicar modelo"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        onSaveTemplate(
                          tmpl.status === 'arquivado'
                            ? {
                                ...tmpl,
                                status: 'ativo',
                                archivedAt: undefined,
                                updatedAt: new Date().toISOString(),
                              }
                            : archiveModelTemplate(tmpl),
                          'edit'
                        )
                      }
                      title={tmpl.status === 'arquivado' ? 'Restaurar' : 'Arquivar obsoleto'}
                    >
                      {tmpl.status === 'arquivado' ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Visualizar Modelo */}
      <Modal
        isOpen={Boolean(viewingTemplate)}
        onClose={() => setViewingTemplate(null)}
        title={viewingTemplate?.title}
        subtitle={
          viewingTemplate
            ? `${MODEL_DOMAIN_OPTIONS.find((d) => d.id === viewingTemplate.domain)?.label || viewingTemplate.domain} · ${MODEL_KIND_OPTIONS.find((k) => k.id === viewingTemplate.kind)?.label || viewingTemplate.kind}`
            : ''
        }
        size="lg"
      >
        {viewingTemplate && (
          <div className="space-y-4 text-xs">
            {viewingTemplate.description && (
              <p className="text-[var(--kz-text-secondary)]">
                {viewingTemplate.description}
              </p>
            )}
            <pre className="max-h-[380px] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)] p-4 text-xs text-[var(--kz-text-primary)] leading-relaxed">
              {viewingTemplate.content}
            </pre>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const tmpl = viewingTemplate;
                  setViewingTemplate(null);
                  handleOpenUseModal(tmpl);
                }}
              >
                <Play className="h-3.5 w-3.5" />
                Utilizar este Modelo
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Criar / Editar Modelo */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingTemplate ? 'Editar Modelo' : 'Adicionar Novo Modelo'}
        subtitle="Organize modelos reutilizáveis sem duplicar estruturas existentes."
        size="lg"
      >
        <form onSubmit={handleSaveForm} className="space-y-4">
          <Input
            label="Título do Modelo *"
            placeholder="Ex.: Proposta Landing Page + Google Ads"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label="Domínio *"
              value={formDomain}
              onChange={(e) => setFormDomain(e.target.value as ModelTemplateDomain)}
            >
              {MODEL_DOMAIN_OPTIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>

            <Select
              label="Tipo de Modelo *"
              value={formKind}
              onChange={(e) => setFormKind(e.target.value as ModelTemplateKind)}
            >
              {MODEL_KIND_OPTIONS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </Select>

            <Select
              label="Categoria *"
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
            >
              {modelCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          {formKind === 'projeto' && (
            <Select
              label="Vincular Template Nativo de Projeto (Opcional)"
              value={formProjectRef}
              onChange={(e) =>
                setFormProjectRef(
                  e.target.value as '' | 'kaizen_start' | 'kaizen_performance'
                )
              }
            >
              <option value="">Personalizado (usa conteúdo/escopo abaixo)</option>
              <option value="kaizen_start">Kaizen Start (reaproveita tarefas nativas)</option>
              <option value="kaizen_performance">
                Kaizen Performance (90 dias · reaproveita fases e tarefas)
              </option>
            </Select>
          )}

          <Input
            label="Descrição resumida"
            placeholder="Objetivo e contexto recomendado para este modelo"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />

          <Textarea
            label="Conteúdo / Estrutura Base *"
            rows={7}
            placeholder="Cláusulas, checklist linha a linha, estrutura de proposta ou texto padrão..."
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            required
          />

          <Input
            label="Tags (separadas por vírgula)"
            placeholder="proposta, onboarding, sop, social"
            value={formTags}
            onChange={(e) => setFormTags(e.target.value)}
          />

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
              Favorito
            </button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={isSavingForm}>
                {editingTemplate ? 'Salvar Modelo' : 'Cadastrar Modelo'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Utilizar Modelo (Cópia Independente) */}
      <Modal
        isOpen={Boolean(usingTemplate)}
        onClose={() => setUsingTemplate(null)}
        title={`Utilizar Modelo: ${usingTemplate?.title || ''}`}
        subtitle="Gera uma cópia independente no módulo destino sem alterar o modelo original nem itens antigos."
        size="md"
      >
        {usingTemplate && (
          <div className="space-y-4">
            {useSuccessMsg && (
              <Alert variant="success" title="Cópia Independente Gerada">
                {useSuccessMsg}
              </Alert>
            )}

            {(usingTemplate.kind === 'proposta' ||
              usingTemplate.kind === 'contrato') && (
              <div className="space-y-3">
                <Select
                  label="Cliente Destino (opcional se selecionar Lead)"
                  value={useTargetClientId}
                  onChange={(e) => setUseTargetClientId(e.target.value)}
                >
                  <option value="">Sem cliente vinculado (usar Lead ou avulso)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Ou Lead do CRM (opcional)"
                  value={useTargetLeadId}
                  onChange={(e) => setUseTargetLeadId(e.target.value)}
                >
                  <option value="">Nenhum lead</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.companyName} · {l.city}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {usingTemplate.kind === 'projeto' && (
              <div className="space-y-3">
                <Select
                  label="Cliente do Novo Projeto *"
                  value={useTargetClientId}
                  onChange={(e) => setUseTargetClientId(e.target.value)}
                >
                  {clients.length === 0 ? (
                    <option value="">Cadastre um cliente primeiro</option>
                  ) : (
                    clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName}
                      </option>
                    ))
                  )}
                </Select>
                <Input
                  label="Nome do Novo Projeto *"
                  value={useCustomProjectName}
                  onChange={(e) => setUseCustomProjectName(e.target.value)}
                />
              </div>
            )}

            {(usingTemplate.kind === 'tarefa' ||
              usingTemplate.kind === 'checklist' ||
              usingTemplate.kind === 'plano_trabalho') && (
              <div className="space-y-3">
                <Select
                  label="Vincular ao Projeto (opcional)"
                  value={useTargetProjectId}
                  onChange={(e) => setUseTargetProjectId(e.target.value)}
                >
                  <option value="">Tarefa avulsa (sem projeto)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                {!useTargetProjectId && (
                  <Select
                    label="Cliente (opcional)"
                    value={useTargetClientId}
                    onChange={(e) => setUseTargetClientId(e.target.value)}
                  >
                    <option value="">Nenhum cliente</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}

            {(usingTemplate.kind === 'processo_interno' ||
              usingTemplate.kind === 'texto_padrao' ||
              usingTemplate.kind === 'apresentacao') && (
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)] p-3 text-xs text-[var(--kz-text-primary)]">
                {usingTemplate.content}
              </pre>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--kz-border-subtle)]">
              <Button variant="ghost" onClick={() => setUsingTemplate(null)}>
                Fechar
              </Button>
              <Button
                variant="primary"
                loading={isInstantiating}
                disabled={usingTemplate.kind === 'projeto' && !useTargetClientId}
                onClick={handleInstantiateModel}
              >
                {useCopiedText ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Gerar Cópia Independente
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
