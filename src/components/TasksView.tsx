import React, { useMemo, useState } from 'react';
import { AppTab } from '../types/crm';
import {
  Client,
  Project,
  Task,
  TaskPriority,
  TaskStatus,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  getTaskPriorityMeta,
  getTaskStatusMeta,
} from '../types/kaizen';
import {
  TaskQueueView,
  computeTaskSummary,
  filterTasks,
  isTaskOverdue,
  transitionTaskStatus,
} from '../services/taskService';
import { getTodayIsoDate } from '../services/projectService';
import { getFilesForTaskContext } from '../services/resources';
import {
  ResourceCategory,
  ResourceFile,
  ResourceFolder,
} from '../types/resources';
import { TaskFormModal } from './TaskFormModal';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Tabs,
} from './ui';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit3,
  FolderKanban,
  LayoutGrid,
  List,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';

interface TasksViewProps {
  tasks: Task[];
  projects: Project[];
  clients: Client[];
  resourceFiles?: ResourceFile[];
  resourceCategories?: ResourceCategory[];
  resourceFolders?: ResourceFolder[];
  cloudPermissionBlocked?: boolean;
  onSaveTask: (task: Task, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteTask: (taskId: string) => Promise<void> | void;
  onSyncTaskFiles?: (taskId: string, selectedFileIds: string[]) => Promise<void> | void;
  onOpenProject?: (projectId: string) => void;
  onOpenClient?: (clientId: string) => void;
  onNavigate?: (tab: AppTab) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  projects,
  clients,
  resourceFiles = [],
  cloudPermissionBlocked = false,
  onSaveTask,
  onDeleteTask,
  onSyncTaskFiles,
  onOpenProject,
  onOpenClient,
}) => {
  const [activeQueue, setActiveQueue] = useState<TaskQueueView>('todas');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [filterClientId, setFilterClientId] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const todayStr = getTodayIsoDate();
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  const summary = useMemo(
    () => computeTaskSummary(tasks, todayStr),
    [tasks, todayStr]
  );

  const filteredTasks = useMemo(
    () =>
      filterTasks(tasks, {
        queue: activeQueue,
        projectId: filterProjectId,
        clientId: filterClientId,
        priority: filterPriority,
        status: filterStatus,
        searchTerm,
        todayStr,
      }),
    [
      tasks,
      activeQueue,
      filterProjectId,
      filterClientId,
      filterPriority,
      filterStatus,
      searchTerm,
      todayStr,
    ]
  );

  const handleQuickStatusChange = async (task: Task, nextStatus: TaskStatus) => {
    if (task.status === nextStatus) return;
    const updated = transitionTaskStatus(task, nextStatus);
    await onSaveTask(updated, 'edit');
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteTask(taskToDelete.id);
      setTaskToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatBrDate = (isoDate?: string) =>
    isoDate ? isoDate.split('-').reverse().join('/') : 'Sem prazo';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
        <div>
          <h2 className="kz-page-title">Minhas Tarefas</h2>
          <p className="kz-subtitle mt-1">
            Central única de execução sincronizada com Projetos e Agenda Integrada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-0.5 rounded-lg bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-primary)] shadow-[var(--kz-shadow-xs)]'
                  : 'text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-primary)] shadow-[var(--kz-shadow-xs)]'
                  : 'text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>

          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingTask(null);
              setIsFormOpen(true);
            }}
          >
            Nova Tarefa
          </Button>
        </div>
      </div>

      {cloudPermissionBlocked && (
        <Alert variant="warning">
          As tarefas estão sendo salvas localmente neste navegador porque a coleção{' '}
          <code className="font-mono">tasks</code> ainda aguarda publicação do arquivo{' '}
          <code className="font-mono">firestore.rules</code> atualizado no projeto Firebase.
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-text-muted)] flex items-center justify-between">
            <span>Em Aberto</span>
            <CheckSquare className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {summary.openCount}
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-info-text)] flex items-center justify-between">
            <span>Para Hoje</span>
            <Calendar className="w-3.5 h-3.5 text-[var(--kz-info-solid)]" />
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-info-text)]">
            {summary.todayCount}
          </div>
        </Card>

        <Card
          padding="sm"
          className={
            summary.overdueCount > 0
              ? 'border-[var(--kz-danger-border)] bg-[var(--kz-danger-bg)]/40'
              : ''
          }
        >
          <div className="text-[11px] font-semibold text-[var(--kz-danger-text)] flex items-center justify-between">
            <span>Atrasadas</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--kz-danger-solid)]" />
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-danger-text)]">
            {summary.overdueCount}
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-text-muted)] flex items-center justify-between">
            <span>Próximas</span>
            <Clock className="w-3.5 h-3.5 text-[var(--kz-text-muted)]" />
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {summary.upcomingCount}
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-success-text)] flex items-center justify-between">
            <span>Concluídas</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-success-text)]">
            {summary.completedCount}
          </div>
        </Card>
      </div>

      {/* Queue Tabs + Filter Bar */}
      <Card padding="md" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <Tabs
            activeId={activeQueue}
            onChange={(id) => setActiveQueue(id as TaskQueueView)}
            items={[
              { id: 'todas', label: 'Todas', badge: summary.total },
              { id: 'hoje', label: 'Hoje', badge: summary.todayCount },
              { id: 'proximas', label: 'Próximas', badge: summary.upcomingCount },
              { id: 'atrasadas', label: 'Atrasadas', badge: summary.overdueCount },
              { id: 'concluidas', label: 'Concluídas', badge: summary.completedCount },
              { id: 'sem_prazo', label: 'Sem prazo', badge: summary.noDueDateCount },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar tarefa..."
            leftIcon={<Search className="w-3.5 h-3.5" />}
          />

          <Select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
          >
            <option value="all">Todos os Projetos</option>
            <option value="unlinked">Sem projeto vinculado</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          <Select
            value={filterClientId}
            onChange={(e) => setFilterClientId(e.target.value)}
          >
            <option value="all">Todos os Clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </Select>

          <Select
            value={filterPriority}
            onChange={(e) =>
              setFilterPriority(e.target.value as TaskPriority | 'all')
            }
          >
            <option value="all">Todas Prioridades</option>
            {TASK_PRIORITY_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                Prioridade: {p.label}
              </option>
            ))}
          </Select>

          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
          >
            <option value="all">Todos os Status</option>
            {TASK_STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                Status: {s.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Content */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-6 h-6" />}
          title="Nenhuma tarefa encontrada"
          description="Ajuste os filtros selecionados ou cadastre uma nova tarefa operacional vinculada a um projeto ou cliente."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setEditingTask(null);
                setIsFormOpen(true);
              }}
            >
              Nova Tarefa
            </Button>
          }
        />
      ) : viewMode === 'list' ? (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const overdue = isTaskOverdue(task, todayStr);
            const project = task.projectId
              ? projectById.get(task.projectId)
              : undefined;
            const resolvedClientId = task.clientId || project?.clientId;
            const client = resolvedClientId
              ? clientById.get(resolvedClientId)
              : undefined;
            const statusMeta = getTaskStatusMeta(task.status);
            const priorityMeta = getTaskPriorityMeta(task.priority);
            const checklistDone = task.checklist.filter((c) => c.done).length;
            const attachedFilesCount = getFilesForTaskContext(resourceFiles, task.id).length;

            return (
              <Card
                key={task.id}
                padding="sm"
                className={`transition-colors ${
                  overdue
                    ? 'border-[var(--kz-danger-border)] bg-[var(--kz-danger-bg)]/20'
                    : ''
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickStatusChange(
                          task,
                          task.status === 'concluida' ? 'a_fazer' : 'concluida'
                        )
                      }
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        task.status === 'concluida'
                          ? 'bg-[var(--kz-success-solid)] border-[var(--kz-success-solid)] text-white'
                          : 'border-[var(--kz-border-strong)] hover:border-[var(--kz-accent)]'
                      }`}
                      title={
                        task.status === 'concluida'
                          ? 'Reabrir tarefa'
                          : 'Marcar como concluída'
                      }
                    >
                      {task.status === 'concluida' && (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            task.status === 'concluida'
                              ? 'line-through text-[var(--kz-text-muted)]'
                              : 'text-[var(--kz-text-primary)]'
                          }`}
                        >
                          {task.title}
                        </span>

                        <Badge variant={priorityMeta.variant} size="sm">
                          {priorityMeta.label}
                        </Badge>

                        <Badge variant={statusMeta.variant} size="sm">
                          {statusMeta.label}
                        </Badge>

                        {overdue && (
                          <Badge variant="danger" size="sm">
                            <AlertTriangle className="w-3 h-3" />
                            Atrasada
                          </Badge>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-[var(--kz-text-muted)] line-clamp-1">
                          {task.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--kz-text-secondary)]">
                        {project && (
                          <button
                            type="button"
                            onClick={() => onOpenProject?.(project.id)}
                            className="inline-flex items-center gap-1 text-[var(--kz-accent-text)] hover:underline cursor-pointer"
                          >
                            <FolderKanban className="w-3 h-3" />
                            <span>{project.name}</span>
                          </button>
                        )}

                        {client && (
                          <button
                            type="button"
                            onClick={() => onOpenClient?.(client.id)}
                            className="inline-flex items-center gap-1 text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] hover:underline cursor-pointer"
                          >
                            <Users className="w-3 h-3" />
                            <span>{client.companyName}</span>
                          </button>
                        )}

                        {task.phaseLabel && (
                          <span className="text-[var(--kz-text-muted)]">
                            · {task.phaseLabel}
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                            overdue
                              ? 'text-[var(--kz-danger-text)] font-bold'
                              : task.dueDate === todayStr
                              ? 'text-[var(--kz-info-text)] font-semibold'
                              : 'text-[var(--kz-text-muted)]'
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          <span>{formatBrDate(task.dueDate)}</span>
                        </span>

                        {task.checklist.length > 0 && (
                          <span className="font-mono text-[var(--kz-text-muted)]">
                            Checklist {checklistDone}/{task.checklist.length}
                          </span>
                        )}

                        {attachedFilesCount > 0 && (
                          <span className="inline-flex items-center gap-1 font-mono text-[var(--kz-accent-text)]">
                            <Paperclip className="w-3 h-3" />
                            <span>
                              {attachedFilesCount} {attachedFilesCount === 1 ? 'arquivo' : 'arquivos'}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={task.status}
                      onChange={(e) =>
                        handleQuickStatusChange(task, e.target.value as TaskStatus)
                      }
                      className="w-36"
                    >
                      {TASK_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>

                    <Button
                      variant="ghost"
                      size="xs"
                      leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setEditingTask(task);
                        setIsFormOpen(true);
                      }}
                    >
                      Editar
                    </Button>

                    <button
                      type="button"
                      onClick={() => setTaskToDelete(task)}
                      className="p-1.5 rounded-lg text-[var(--kz-text-subtle)] hover:text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)] transition-colors cursor-pointer"
                      aria-label="Excluir tarefa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3.5 items-start">
          {TASK_STATUS_OPTIONS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] p-3 space-y-2.5 min-h-[320px]"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--kz-border-subtle)]">
                  <Badge variant={col.variant} size="sm" dot>
                    {col.label}
                  </Badge>
                  <span className="text-[11px] font-mono font-bold text-[var(--kz-text-muted)]">
                    {colTasks.length}
                  </span>
                </div>

                {colTasks.length === 0 ? (
                  <div className="py-6 text-center text-[11px] text-[var(--kz-text-subtle)] border border-dashed border-[var(--kz-border-subtle)] rounded-lg">
                    Sem tarefas
                  </div>
                ) : (
                  <div className="space-y-2">
                    {colTasks.map((task) => {
                      const overdue = isTaskOverdue(task, todayStr);
                      const project = task.projectId
                        ? projectById.get(task.projectId)
                        : undefined;
                      const priorityMeta = getTaskPriorityMeta(task.priority);
                      const attachedFilesCount = getFilesForTaskContext(resourceFiles, task.id).length;

                      return (
                        <div
                          key={task.id}
                          className={`p-3 rounded-lg bg-[var(--kz-bg-surface)] border space-y-2 ${
                            overdue
                              ? 'border-[var(--kz-danger-border)]'
                              : 'border-[var(--kz-border-subtle)]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-xs font-semibold text-[var(--kz-text-primary)] leading-snug">
                              {task.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTask(task);
                                setIsFormOpen(true);
                              }}
                              className="p-1 text-[var(--kz-text-subtle)] hover:text-[var(--kz-accent-text)] cursor-pointer shrink-0"
                              title="Editar tarefa"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={priorityMeta.variant} size="sm">
                              {priorityMeta.label}
                            </Badge>
                            {overdue && (
                              <Badge variant="danger" size="sm">
                                Atrasada
                              </Badge>
                            )}
                          </div>

                          {project && (
                            <div className="text-[10px] text-[var(--kz-accent-text)] truncate">
                              {project.name}
                            </div>
                          )}

                          {attachedFilesCount > 0 && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--kz-text-secondary)]">
                              <Paperclip className="w-3 h-3 text-[var(--kz-accent)]" />
                              <span>{attachedFilesCount} anexo(s)</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--kz-border-subtle)]">
                            <span className="text-[10px] font-mono text-[var(--kz-text-muted)]">
                              {formatBrDate(task.dueDate)}
                            </span>

                            <Select
                              value={task.status}
                              onChange={(e) =>
                                handleQuickStatusChange(
                                  task,
                                  e.target.value as TaskStatus
                                )
                              }
                              className="w-28 text-[11px] h-7"
                            >
                              {TASK_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TaskFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingTask(null);
        }}
        projects={projects}
        clients={clients}
        resourceFiles={resourceFiles}
        editingTask={editingTask}
        onSave={onSaveTask}
        onSyncTaskFiles={onSyncTaskFiles}
      />

      <ConfirmDialog
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Tarefa"
        description={
          taskToDelete ? (
            <span>
              Deseja excluir permanentemente a tarefa{' '}
              <strong>{taskToDelete.title}</strong>? Ela também será removida do projeto e da agenda.
            </span>
          ) : (
            ''
          )
        }
        confirmLabel="Confirmar Exclusão"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
};
