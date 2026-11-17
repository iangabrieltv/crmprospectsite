import React, { useMemo, useState } from 'react';
import {
  Client,
  Project,
  ProjectDocumentCategory,
  ProjectDocumentLink,
  ProjectStatus,
  ProposalContract,
  Task,
  TaskStatus,
  PROJECT_STATUS_OPTIONS,
  getProjectStatusMeta,
  getTaskPriorityMeta,
  getTaskStatusMeta,
} from '../types/kaizen';
import {
  FINANCIAL_ENTRY_STATUS_META,
  FinancialEntry,
} from '../types/finance';
import {
  PROJECT_TEMPLATES,
  appendProjectHistory,
  calculateProjectProgress,
  generateProjectDocumentId,
  getTodayIsoDate,
  transitionProjectStatus,
} from '../services/projectService';
import { isTaskOverdue, transitionTaskStatus } from '../services/taskService';
import {
  computeProjectFinancialSummary,
  formatBrlFromCents,
  formatDateBr,
  getEffectiveEntryStatus,
  getEntryAllowedTotalCents,
} from '../services/finance';
import { TaskFormModal } from './TaskFormModal';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  Tabs,
} from './ui';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FileText,
  FolderKanban,
  Layers,
  Plus,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';

interface ProjectDetailModalProps {
  project: Project;
  clients: Client[];
  proposals: ProposalContract[];
  tasks: Task[];
  financialEntries?: FinancialEntry[];
  userName: string;
  onClose: () => void;
  onEditProject: (project: Project) => void;
  onUpdateProject: (project: Project) => Promise<void> | void;
  onDeleteProject: (projectId: string) => Promise<void> | void;
  onSaveTask: (task: Task, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteTask: (taskId: string) => Promise<void> | void;
  onOpenClient?: (clientId: string) => void;
  onOpenFinance?: () => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  clients,
  proposals,
  tasks,
  financialEntries = [],
  userName,
  onClose,
  onEditProject,
  onUpdateProject,
  onDeleteProject,
  onSaveTask,
  onDeleteTask,
  onOpenClient,
  onOpenFinance,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'tasks' | 'documents' | 'finance' | 'history'
  >('overview');
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCompleteProjectConfirm, setShowCompleteProjectConfirm] =
    useState(false);
  const [pendingStatusChange, setPendingStatusChange] =
    useState<ProjectStatus | null>(null);

  // Document link state
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docCategory, setDocCategory] =
    useState<ProjectDocumentCategory>('briefing');
  const [noteText, setNoteText] = useState('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  const todayStr = getTodayIsoDate();
  const statusMeta = getProjectStatusMeta(project.status);
  const templateMeta =
    PROJECT_TEMPLATES[project.templateId] || PROJECT_TEMPLATES.personalizado;
  const client = clients.find((c) => c.id === project.clientId) || null;
  const linkedProposal = project.proposalId
    ? proposals.find((p) => p.id === project.proposalId) || null
    : null;

  const projectTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.projectId === project.id)
        .sort((a, b) => {
          const aDone = a.status === 'concluida' ? 1 : 0;
          const bDone = b.status === 'concluida' ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          return (a.dueDate || '9999-99-99').localeCompare(
            b.dueDate || '9999-99-99'
          );
        }),
    [tasks, project.id]
  );

  const progress = useMemo(
    () => calculateProjectProgress(project, tasks, todayStr),
    [project, tasks, todayStr]
  );

  const projectFinance = useMemo(
    () =>
      computeProjectFinancialSummary({
        project,
        proposals,
        entries: financialEntries,
      }),
    [project, proposals, financialEntries]
  );

  const handleStatusDropdownChange = async (nextStatus: ProjectStatus) => {
    if (nextStatus === project.status) return;
    if (nextStatus === 'concluido') {
      setPendingStatusChange('concluido');
      setShowCompleteProjectConfirm(true);
      return;
    }
    const updated = transitionProjectStatus(project, nextStatus, userName);
    await onUpdateProject(updated);
  };

  const handleConfirmConcludeProject = async () => {
    const target = pendingStatusChange || 'concluido';
    const updated = transitionProjectStatus(
      project,
      target,
      userName,
      'Conclusão confirmada explicitamente pelo administrador.'
    );
    await onUpdateProject(updated);
    setShowCompleteProjectConfirm(false);
    setPendingStatusChange(null);
  };

  const handleQuickTaskStatus = async (task: Task, nextStatus: TaskStatus) => {
    if (task.status === nextStatus) return;
    const updatedTask = transitionTaskStatus(task, nextStatus);
    await onSaveTask(updatedTask, 'edit');

    if (nextStatus === 'concluida') {
      const nextTasksSnapshot = tasks.map((t) =>
        t.id === task.id ? updatedTask : t
      );
      const updatedProject = appendProjectHistory(project, {
        type: 'tarefa_concluida',
        title: `Tarefa concluída: ${task.title}`,
        author: userName,
      });
      await onUpdateProject(updatedProject);

      const nextProg = calculateProjectProgress(
        updatedProject,
        nextTasksSnapshot,
        todayStr
      );
      if (nextProg.allTasksCompleted && updatedProject.status !== 'concluido') {
        setPendingStatusChange('concluido');
        setShowCompleteProjectConfirm(true);
      }
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docUrl.trim()) return;
    setIsSavingMeta(true);
    try {
      const normalizedUrl = docUrl.trim().startsWith('http')
        ? docUrl.trim()
        : `https://${docUrl.trim()}`;
      const newDoc: ProjectDocumentLink = {
        id: generateProjectDocumentId(),
        title: docTitle.trim(),
        url: normalizedUrl,
        category: docCategory,
        addedAt: new Date().toISOString(),
      };
      const withHistory = appendProjectHistory(
        {
          ...project,
          documents: [newDoc, ...(project.documents || [])],
        },
        {
          type: 'documento_adicionado',
          title: `Documento vinculado: ${newDoc.title}`,
          author: userName,
        }
      );
      await onUpdateProject(withHistory);
      setDocTitle('');
      setDocUrl('');
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleRemoveDocument = async (docId: string) => {
    const updated: Project = {
      ...project,
      documents: (project.documents || []).filter((d) => d.id !== docId),
      updatedAt: new Date().toISOString(),
    };
    await onUpdateProject(updated);
  };

  const handleAddHistoryNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setIsSavingMeta(true);
    try {
      const updated = appendProjectHistory(project, {
        type: 'observacao',
        title: 'Observação registrada',
        description: noteText.trim(),
        author: userName,
      });
      await onUpdateProject(updated);
      setNoteText('');
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleConfirmDeleteProject = async () => {
    setIsDeleting(true);
    try {
      await onDeleteProject(project.id);
      setShowDeleteConfirm(false);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const formatBrDate = (iso?: string) =>
    iso ? iso.split('-').reverse().join('/') : '—';

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        size="xl"
        title={project.name}
        subtitle={`${templateMeta.shortLabel} · ${project.serviceType}${
          client ? ` · ${client.companyName}` : ''
        }`}
        icon={
          <div className="w-9 h-9 rounded-lg bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] flex items-center justify-center text-[var(--kz-accent)]">
            <FolderKanban className="w-4 h-4" />
          </div>
        }
        footer={
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-[var(--kz-danger-solid)]" />}
              className="text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)]"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Excluir Projeto
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {client && onOpenClient && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Users className="w-3.5 h-3.5" />}
                  onClick={() => {
                    onClose();
                    onOpenClient(client.id);
                  }}
                >
                  Abrir Cliente
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setEditingTask(null);
                  setIsTaskFormOpen(true);
                }}
              >
                Nova Tarefa
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                onClick={() => onEditProject(project)}
              >
                Editar Projeto
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Progress & Status Header */}
          <div className="p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/70 border border-[var(--kz-border-subtle)] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusMeta.variant} dot size="md">
                  {statusMeta.label}
                </Badge>
                <span className="text-xs font-mono text-[var(--kz-text-secondary)] tabular-nums">
                  {progress.completedTasks} de {progress.totalTasks} tarefas concluídas (
                  {progress.percent}%)
                </span>
                {progress.overdueTasks > 0 && (
                  <Badge variant="danger" size="sm">
                    {progress.overdueTasks} atrasada(s)
                  </Badge>
                )}
              </div>

              <Select
                value={project.status}
                onChange={(e) =>
                  handleStatusDropdownChange(e.target.value as ProjectStatus)
                }
                className="w-44"
              >
                {PROJECT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-full h-2 bg-[var(--kz-bg-canvas)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.percent === 100
                    ? 'bg-[var(--kz-success-solid)]'
                    : 'bg-[var(--kz-accent)]'
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          {progress.allTasksCompleted && project.status !== 'concluido' && (
            <Alert variant="success">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Todas as <strong>{progress.totalTasks}</strong> tarefas deste projeto foram concluídas. Deseja marcar o projeto como <strong>Concluído</strong>?
                </span>
                <Button
                  variant="primary"
                  size="xs"
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setPendingStatusChange('concluido');
                    setShowCompleteProjectConfirm(true);
                  }}
                >
                  Confirmar Conclusão
                </Button>
              </div>
            </Alert>
          )}

          {/* SubTabs */}
          <div className="border-b border-[var(--kz-border-subtle)] pb-3">
            <Tabs
              activeId={activeSubTab}
              onChange={(id) =>
                setActiveSubTab(
                  id as 'overview' | 'tasks' | 'documents' | 'finance' | 'history'
                )
              }
              items={[
                { id: 'overview', label: 'Visão Geral' },
                { id: 'tasks', label: 'Tarefas', badge: projectTasks.length },
                {
                  id: 'documents',
                  label: 'Documentos & Links',
                  badge: project.documents?.length || 0,
                },
                {
                  id: 'finance',
                  label: 'Financeiro',
                  badge: projectFinance.entries.length,
                },
                {
                  id: 'history',
                  label: 'Histórico',
                  badge: project.history?.length || 0,
                },
              ]}
            />
          </div>

          {activeSubTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">Cliente</div>
                  <div className="mt-1 text-xs font-bold text-[var(--kz-text-primary)] truncate">
                    {client?.companyName || 'Não encontrado'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">Responsável</div>
                  <div className="mt-1 text-xs font-bold text-[var(--kz-text-primary)] truncate">
                    {project.ownerName}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">Início</div>
                  <div className="mt-1 text-xs font-mono font-bold text-[var(--kz-text-primary)]">
                    {formatBrDate(project.startDate)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">Prazo de Entrega</div>
                  <div className="mt-1 text-xs font-mono font-bold text-[var(--kz-accent-text)]">
                    {formatBrDate(project.dueDate)}
                  </div>
                </div>
              </div>

              {project.phases && project.phases.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--kz-text-primary)]">
                    <Layers className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>Estrutura de Ciclos do Projeto</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {project.phases.map((ph) => (
                      <div
                        key={ph.id}
                        className="p-3 rounded-xl bg-[var(--kz-bg-canvas)]/70 border border-[var(--kz-border-subtle)] space-y-1"
                      >
                        <div className="text-[10px] font-mono font-bold uppercase text-[var(--kz-accent-text)]">
                          {ph.rangeLabel || 'Fase'}
                        </div>
                        <div className="text-xs font-bold text-[var(--kz-text-primary)]">
                          {ph.label}
                        </div>
                        {ph.description && (
                          <p className="text-[11px] text-[var(--kz-text-muted)] leading-relaxed">
                            {ph.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-1.5">
                  <div className="text-xs font-bold text-[var(--kz-text-primary)]">
                    Descrição & Escopo
                  </div>
                  <p className="text-xs text-[var(--kz-text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {project.description || 'Nenhuma descrição informada.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-1.5">
                  <div className="text-xs font-bold text-[var(--kz-text-primary)]">
                    Observações & Contrato
                  </div>
                  {linkedProposal && (
                    <div className="text-[11px] font-mono text-[var(--kz-accent-text)]">
                      Documento vinculado: {linkedProposal.code} — {linkedProposal.title}
                    </div>
                  )}
                  <p className="text-xs text-[var(--kz-text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {project.notes || 'Sem observações cadastradas.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'tasks' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--kz-text-muted)]">
                  Tarefas vinculadas em fonte única com <strong>Minhas Tarefas</strong> e <strong>Agenda Integrada</strong>.
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setEditingTask(null);
                    setIsTaskFormOpen(true);
                  }}
                >
                  Adicionar Tarefa
                </Button>
              </div>

              {projectTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--kz-text-muted)] border border-dashed border-[var(--kz-border-default)] rounded-xl">
                  Nenhuma tarefa vinculada a este projeto ainda.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {projectTasks.map((task) => {
                    const overdue = isTaskOverdue(task, todayStr);
                    const pMeta = getTaskPriorityMeta(task.priority);
                    const sMeta = getTaskStatusMeta(task.status);
                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-xl bg-[var(--kz-bg-surface)] border flex flex-wrap items-center justify-between gap-2 ${
                          overdue
                            ? 'border-[var(--kz-danger-border)]'
                            : 'border-[var(--kz-border-subtle)]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickTaskStatus(
                                task,
                                task.status === 'concluida' ? 'a_fazer' : 'concluida'
                              )
                            }
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                              task.status === 'concluida'
                                ? 'bg-[var(--kz-success-solid)] border-[var(--kz-success-solid)] text-white'
                                : 'border-[var(--kz-border-strong)] hover:border-[var(--kz-accent)]'
                            }`}
                          >
                            {task.status === 'concluida' && (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-xs font-semibold ${
                                task.status === 'concluida'
                                  ? 'line-through text-[var(--kz-text-muted)]'
                                  : 'text-[var(--kz-text-primary)]'
                              }`}
                            >
                              {task.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant={pMeta.variant} size="sm">
                                {pMeta.label}
                              </Badge>
                              <Badge variant={sMeta.variant} size="sm">
                                {sMeta.label}
                              </Badge>
                              {task.dueDate && (
                                <span
                                  className={`text-[10px] font-mono inline-flex items-center gap-1 ${
                                    overdue
                                      ? 'text-[var(--kz-danger-text)] font-bold'
                                      : 'text-[var(--kz-text-muted)]'
                                  }`}
                                >
                                  <Calendar className="w-3 h-3" />
                                  {formatBrDate(task.dueDate)}
                                </span>
                              )}
                              {overdue && (
                                <Badge variant="danger" size="sm">
                                  <AlertTriangle className="w-3 h-3" />
                                  Atrasada
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Select
                            value={task.status}
                            onChange={(e) =>
                              handleQuickTaskStatus(
                                task,
                                e.target.value as TaskStatus
                              )
                            }
                            className="w-32 h-7 text-[11px]"
                          >
                            <option value="a_fazer">A fazer</option>
                            <option value="em_andamento">Em andamento</option>
                            <option value="em_revisao">Em revisão</option>
                            <option value="aguardando">Aguardando</option>
                            <option value="concluida">Concluída</option>
                          </Select>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTask(task);
                              setIsTaskFormOpen(true);
                            }}
                            className="p-1.5 text-[var(--kz-text-muted)] hover:text-[var(--kz-accent-text)] cursor-pointer"
                            title="Editar tarefa"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            className="p-1.5 text-[var(--kz-text-subtle)] hover:text-[var(--kz-danger-text)] cursor-pointer"
                            title="Excluir tarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'documents' && (
            <div className="space-y-4">
              <form
                onSubmit={handleAddDocument}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
              >
                <div className="sm:col-span-4">
                  <Input
                    label="Título do Arquivo / Link"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Ex: Protótipo Figma ou Briefing"
                  />
                </div>
                <div className="sm:col-span-4">
                  <Input
                    label="URL / Caminho"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Select
                    label="Categoria"
                    value={docCategory}
                    onChange={(e) =>
                      setDocCategory(e.target.value as ProjectDocumentCategory)
                    }
                  >
                    <option value="briefing">Briefing</option>
                    <option value="design">Design</option>
                    <option value="acesso">Acessos</option>
                    <option value="contrato">Contrato</option>
                    <option value="entrega">Entrega</option>
                    <option value="outro">Outro</option>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    variant="secondary"
                    size="md"
                    loading={isSavingMeta}
                    className="w-full"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Vincular
                  </Button>
                </div>
              </form>

              {(project.documents || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--kz-text-muted)] border border-dashed border-[var(--kz-border-default)] rounded-xl">
                  Nenhum arquivo, briefing ou link vinculado a este projeto.
                </div>
              ) : (
                <div className="space-y-2">
                  {(project.documents || []).map((docItem) => (
                    <div
                      key={docItem.id}
                      className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-[var(--kz-accent)] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--kz-text-primary)] truncate">
                            {docItem.title}
                          </div>
                          <div className="text-[11px] text-[var(--kz-text-muted)] truncate font-mono">
                            {docItem.category || 'documento'} · {docItem.url}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={docItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--kz-accent-text)] hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveDocument(docItem.id)}
                          className="p-1 text-[var(--kz-text-subtle)] hover:text-[var(--kz-danger-text)] cursor-pointer"
                          title="Remover vínculo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'finance' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[var(--kz-text-muted)]">
                  Resultado gerencial vinculado a receitas e despesas deste projeto.
                </span>
                {onOpenFinance && (
                  <Button
                    variant="outline"
                    size="xs"
                    leftIcon={<Wallet className="w-3.5 h-3.5" />}
                    onClick={() => {
                      onClose();
                      onOpenFinance();
                    }}
                  >
                    Gerenciar no Financeiro
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">
                    Receita Faturada
                  </div>
                  <div className="mt-1 text-sm font-mono font-bold text-[var(--kz-text-primary)]">
                    {formatBrlFromCents(projectFinance.billedRevenueCents)}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--kz-success-text)]">
                    Recebido: {formatBrlFromCents(projectFinance.receivedRevenueCents)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">
                    Despesas do Projeto
                  </div>
                  <div className="mt-1 text-sm font-mono font-bold text-[var(--kz-danger-text)]">
                    {formatBrlFromCents(projectFinance.linkedExpensesTotalCents)}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--kz-text-muted)]">
                    Pago: {formatBrlFromCents(projectFinance.paidExpensesCents)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">
                    Resultado Realizado
                  </div>
                  <div
                    className={`mt-1 text-sm font-mono font-bold ${
                      projectFinance.realizedResultCents >= 0
                        ? 'text-[var(--kz-success-text)]'
                        : 'text-[var(--kz-danger-text)]'
                    }`}
                  >
                    {formatBrlFromCents(projectFinance.realizedResultCents)}
                  </div>
                  <div className="text-[10px] text-[var(--kz-text-muted)]">
                    Recebido menos pago
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)]">
                  <div className="text-[11px] text-[var(--kz-text-muted)]">
                    Resultado Previsto
                  </div>
                  <div
                    className={`mt-1 text-sm font-mono font-bold ${
                      projectFinance.projectedResultCents >= 0
                        ? 'text-[var(--kz-accent-text)]'
                        : 'text-[var(--kz-danger-text)]'
                    }`}
                  >
                    {formatBrlFromCents(projectFinance.projectedResultCents)}
                  </div>
                  {projectFinance.contractedValueCents > 0 && (
                    <div className="text-[10px] font-mono text-[var(--kz-text-muted)]">
                      Contrato: {formatBrlFromCents(projectFinance.contractedValueCents)}
                    </div>
                  )}
                </div>
              </div>

              {projectFinance.entries.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--kz-text-muted)] border border-dashed border-[var(--kz-border-default)] rounded-xl">
                  Nenhuma receita ou despesa vinculada diretamente a este projeto ainda.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {projectFinance.entries.map((entry) => {
                    const effStatus = getEffectiveEntryStatus(entry);
                    const sMeta = FINANCIAL_ENTRY_STATUS_META[effStatus];
                    return (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--kz-text-primary)] truncate">
                            {entry.kind === 'receita' ? 'Receita: ' : 'Despesa: '}
                            {entry.description}
                          </div>
                          <div className="text-[11px] font-mono text-[var(--kz-text-muted)]">
                            Venc. {formatDateBr(entry.dueDate)} · Total{' '}
                            {formatBrlFromCents(getEntryAllowedTotalCents(entry))} · Baixado{' '}
                            {formatBrlFromCents(entry.settledCents || 0)}
                          </div>
                        </div>
                        <Badge variant={sMeta.variant} size="sm">
                          {sMeta.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'history' && (
            <div className="space-y-4">
              <form
                onSubmit={handleAddHistoryNote}
                className="flex flex-col sm:flex-row gap-2"
              >
                <Input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Registrar avanço, solicitação de revisão ou observação do projeto..."
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                  loading={isSavingMeta}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Registrar
                </Button>
              </form>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {(project.history || []).map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-[var(--kz-text-primary)]">
                        {evt.title}
                      </span>
                      <span className="font-mono text-[var(--kz-text-muted)]">
                        {new Date(evt.date).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                        {evt.author ? ` · ${evt.author}` : ''}
                      </span>
                    </div>
                    {evt.description && (
                      <p className="text-xs text-[var(--kz-text-secondary)] whitespace-pre-wrap">
                        {evt.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <TaskFormModal
        isOpen={isTaskFormOpen}
        onClose={() => {
          setIsTaskFormOpen(false);
          setEditingTask(null);
        }}
        projects={[project]}
        clients={clients}
        editingTask={editingTask}
        defaultProjectId={project.id}
        defaultClientId={project.clientId}
        onSave={onSaveTask}
      />

      <ConfirmDialog
        isOpen={showCompleteProjectConfirm}
        onClose={() => {
          setShowCompleteProjectConfirm(false);
          setPendingStatusChange(null);
        }}
        onConfirm={handleConfirmConcludeProject}
        title="Confirmar Conclusão do Projeto"
        description={
          <span>
            Deseja confirmar o projeto <strong>{project.name}</strong> como{' '}
            <strong>Concluído</strong>? O histórico de entrega e progresso ficará preservado.
          </span>
        }
        confirmLabel="Confirmar Conclusão"
        variant="primary"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDeleteProject}
        title="Excluir Projeto"
        description={
          <span>
            Deseja excluir permanentemente o projeto <strong>{project.name}</strong> e suas{' '}
            <strong>{projectTasks.length} tarefas vinculadas</strong>?
          </span>
        }
        confirmLabel="Excluir Projeto e Tarefas"
        variant="danger"
        loading={isDeleting}
      />
    </>
  );
};
