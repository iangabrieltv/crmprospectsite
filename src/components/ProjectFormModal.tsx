import React, { useEffect, useMemo, useState } from 'react';
import {
  Client,
  Project,
  ProjectStatus,
  ProjectTemplateId,
  ProposalContract,
  Task,
  PROJECT_STATUS_OPTIONS,
} from '../types/kaizen';
import {
  PROJECT_TEMPLATES,
  addDaysToIsoDate,
  createProjectWithTemplateTasks,
  getTodayIsoDate,
} from '../services/projectService';
import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Textarea,
} from './ui';
import { FolderKanban, Layers } from 'lucide-react';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  proposals: ProposalContract[];
  userName: string;
  editingProject?: Project | null;
  defaultClientId?: string;
  onCreateProjectWithTasks: (
    project: Project,
    initialTasks: Task[]
  ) => Promise<void> | void;
  onUpdateProject: (project: Project) => Promise<void> | void;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  clients,
  proposals,
  userName,
  editingProject,
  defaultClientId,
  onCreateProjectWithTasks,
  onUpdateProject,
}) => {
  const [templateId, setTemplateId] = useState<ProjectTemplateId>('kaizen_start');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('nao_iniciado');
  const [ownerName, setOwnerName] = useState(userName || 'Ian');
  const [startDate, setStartDate] = useState(getTodayIsoDate());
  const [dueDate, setDueDate] = useState(addDaysToIsoDate(getTodayIsoDate(), 14));
  const [notes, setNotes] = useState('');
  const [includePinnedInstagramPosts, setIncludePinnedInstagramPosts] =
    useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingProject) {
      setTemplateId(editingProject.templateId);
      setName(editingProject.name);
      setClientId(editingProject.clientId);
      setProposalId(editingProject.proposalId || '');
      setServiceType(editingProject.serviceType);
      setDescription(editingProject.description || '');
      setStatus(editingProject.status);
      setOwnerName(editingProject.ownerName || userName || 'Ian');
      setStartDate(editingProject.startDate || getTodayIsoDate());
      setDueDate(editingProject.dueDate || '');
      setNotes(editingProject.notes || '');
      setIncludePinnedInstagramPosts(true);
    } else {
      const today = getTodayIsoDate();
      const firstClientId = defaultClientId || clients[0]?.id || '';
      const defTpl = PROJECT_TEMPLATES.kaizen_start;
      setTemplateId('kaizen_start');
      setName('');
      setClientId(firstClientId);
      setProposalId('');
      setServiceType(defTpl.defaultServiceType);
      setDescription(defTpl.description);
      setStatus('nao_iniciado');
      setOwnerName(userName || 'Ian');
      setStartDate(today);
      setDueDate(addDaysToIsoDate(today, defTpl.defaultDurationDays));
      setNotes('');
      setIncludePinnedInstagramPosts(true);
    }
  }, [isOpen, editingProject, defaultClientId, clients, userName]);

  const handleSelectTemplate = (nextTpl: ProjectTemplateId) => {
    if (editingProject) return;
    setTemplateId(nextTpl);
    const tpl = PROJECT_TEMPLATES[nextTpl];
    setServiceType(tpl.defaultServiceType);
    setDescription(tpl.description);
    if (startDate) {
      setDueDate(addDaysToIsoDate(startDate, tpl.defaultDurationDays));
    }
  };

  const clientProposals = useMemo(
    () => proposals.filter((p) => !clientId || p.clientId === clientId),
    [proposals, clientId]
  );

  const selectedTemplate = PROJECT_TEMPLATES[templateId];
  const previewTaskCount =
    selectedTemplate.tasks.filter(
      (t) =>
        t.optionalKey !== 'instagram_pinned_posts' || includePinnedInstagramPosts
    ).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientId) return;
    setIsSaving(true);
    try {
      if (editingProject) {
        const nowIso = new Date().toISOString();
        const updated: Project = {
          ...editingProject,
          name: name.trim(),
          clientId,
          proposalId: proposalId || undefined,
          serviceType: serviceType.trim() || editingProject.serviceType,
          description: description.trim() || undefined,
          status,
          ownerName: ownerName.trim() || userName || 'Ian',
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
          notes: notes.trim() || undefined,
          completedAt:
            status === 'concluido'
              ? editingProject.completedAt || nowIso
              : editingProject.completedAt,
          updatedAt: nowIso,
        };
        await onUpdateProject(updated);
      } else {
        const { project, initialTasks } = createProjectWithTemplateTasks({
          name: name.trim(),
          clientId,
          proposalId: proposalId || undefined,
          templateId,
          serviceType: serviceType.trim() || selectedTemplate.defaultServiceType,
          description: description.trim() || undefined,
          ownerName: ownerName.trim() || userName || 'Ian',
          status,
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
          notes: notes.trim() || undefined,
          includePinnedInstagramPosts,
        });
        await onCreateProjectWithTasks(project, initialTasks);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      closeDisabled={isSaving}
      title={editingProject ? 'Editar Projeto' : 'Novo Projeto'}
      subtitle={
        editingProject
          ? 'Atualize escopo, datas, responsável ou status do projeto.'
          : 'Escolha um modelo reutilizável (Kaizen Start ou Performance 90 dias) ou crie um projeto personalizado.'
      }
      icon={
        <div className="w-9 h-9 rounded-lg bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] flex items-center justify-center text-[var(--kz-accent)]">
          <FolderKanban className="w-4 h-4" />
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="kaizen-project-form"
            variant="primary"
            loading={isSaving}
            disabled={clients.length === 0}
          >
            {editingProject ? 'Salvar Projeto' : 'Criar Projeto'}
          </Button>
        </>
      }
    >
      <form id="kaizen-project-form" onSubmit={handleSubmit} className="space-y-4">
        {clients.length === 0 && (
          <Alert variant="warning">
            Cadastre ao menos um cliente no módulo <strong>Clientes</strong> antes de iniciar um projeto vinculado.
          </Alert>
        )}

        {!editingProject && (
          <div className="space-y-2">
            <label className="block kz-label">Modelo de Projeto (Template Independente)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(Object.keys(PROJECT_TEMPLATES) as ProjectTemplateId[]).map((tplKey) => {
                const tpl = PROJECT_TEMPLATES[tplKey];
                const isSelected = templateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                      isSelected
                        ? 'bg-[var(--kz-accent-soft)] border-[var(--kz-accent)] ring-1 ring-[var(--kz-accent)]'
                        : 'bg-[var(--kz-bg-subtle)]/60 border-[var(--kz-border-subtle)] hover:border-[var(--kz-border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--kz-text-primary)]">
                        {tpl.name}
                      </span>
                      <Badge variant={isSelected ? 'accent' : 'neutral'} size="sm">
                        {tpl.tasks.length > 0 ? `${tpl.tasks.length} tarefas` : 'Em branco'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[var(--kz-text-muted)] leading-relaxed">
                      {tpl.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {templateId === 'kaizen_start' && (
              <label className="flex items-center gap-2 text-xs text-[var(--kz-text-secondary)] p-2.5 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePinnedInstagramPosts}
                  onChange={(e) => setIncludePinnedInstagramPosts(e.target.checked)}
                  className="rounded accent-[var(--kz-accent)]"
                />
                <span>
                  Incluir tarefa de <strong>posts fixados para Instagram</strong> (conforme escopo contratado)
                </span>
              </label>
            )}

            {previewTaskCount > 0 && (
              <div className="text-[11px] text-[var(--kz-text-muted)] flex items-center gap-1.5 px-1">
                <Layers className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                <span>
                  Ao criar, <strong>{previewTaskCount} tarefas independentes</strong> serão copiadas para este projeto e exibidas automaticamente em Minhas Tarefas.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Nome do Projeto *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Landing Page + GBP — Clínica Vida"
            required
          />

          <Select
            label="Cliente Vinculado *"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            <option value="">Selecione um cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Serviço Contratado *"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            placeholder="Ex: Kaizen Start (LP + SEO + GBP)"
            required
          />

          <Select
            label="Proposta / Contrato Vinculado (opcional)"
            value={proposalId}
            onChange={(e) => setProposalId(e.target.value)}
          >
            <option value="">Nenhum documento vinculado</option>
            {clientProposals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.title}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          >
            {PROJECT_STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>

          <Input
            label="Responsável *"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
          />

          <Input
            label="Data de Início"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            label="Prazo de Entrega"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <Textarea
          label="Descrição & Escopo do Projeto"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Descreva os entregáveis acordados, objetivos e critérios de revisão..."
        />

        <Textarea
          label="Observações Administrativas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notas internas de acompanhamento..."
        />
      </form>
    </Modal>
  );
};
