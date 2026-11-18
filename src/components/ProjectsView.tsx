import React, { useEffect, useMemo, useState } from 'react';
import { AppTab } from '../types/crm';
import {
  Client,
  Project,
  ProjectStatus,
  ProjectTemplateId,
  ProposalContract,
  Task,
  PROJECT_STATUS_OPTIONS,
  getProjectStatusMeta,
} from '../types/kaizen';
import { FinancialEntry } from '../types/finance';
import { ResourceCategory, ResourceFile, ResourceFolder } from '../types/resources';
import {
  PROJECT_TEMPLATES,
  calculateProjectProgress,
  getTodayIsoDate,
} from '../services/projectService';
import { ProjectFormModal } from './ProjectFormModal';
import { ProjectDetailModal } from './ProjectDetailModal';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
} from './ui';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FolderKanban,
  Layers,
  Plus,
  Search,
  Users,
} from 'lucide-react';

interface ProjectsViewProps {
  projects: Project[];
  clients: Client[];
  proposals: ProposalContract[];
  tasks: Task[];
  financialEntries?: FinancialEntry[];
  resourceFiles?: ResourceFile[];
  resourceFolders?: ResourceFolder[];
  resourceCategories?: ResourceCategory[];
  userName: string;
  cloudPermissionBlocked?: boolean;
  externalSelectedProjectId?: string | null;
  onClearExternalSelectedProjectId?: () => void;
  initialClientIdForNewProject?: string | null;
  onClearInitialClientIdForNewProject?: () => void;
  onCreateProjectWithTasks: (
    project: Project,
    initialTasks: Task[]
  ) => Promise<void> | void;
  onUpdateProject: (project: Project) => Promise<void> | void;
  onDeleteProject: (projectId: string) => Promise<void> | void;
  onSaveTask: (task: Task, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteTask: (taskId: string) => Promise<void> | void;
  onSaveResourceFile?: (
    file: ResourceFile,
    mode: 'create' | 'edit'
  ) => Promise<void> | void;
  onSyncTaskFiles?: (taskId: string, selectedFileIds: string[]) => Promise<void> | void;
  onOpenClient?: (clientId: string) => void;
  onNavigate?: (tab: AppTab) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  clients,
  proposals,
  tasks,
  financialEntries = [],
  resourceFiles = [],
  resourceFolders = [],
  resourceCategories = [],
  userName,
  cloudPermissionBlocked = false,
  externalSelectedProjectId,
  onClearExternalSelectedProjectId,
  initialClientIdForNewProject,
  onClearInitialClientIdForNewProject,
  onCreateProjectWithTasks,
  onUpdateProject,
  onDeleteProject,
  onSaveTask,
  onDeleteTask,
  onSaveResourceFile,
  onSyncTaskFiles,
  onOpenClient,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all');
  const [filterTemplate, setFilterTemplate] = useState<ProjectTemplateId | 'all'>('all');
  const [filterClientId, setFilterClientId] = useState<string>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [draftDefaultClientId, setDraftDefaultClientId] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (externalSelectedProjectId) {
      setSelectedProjectId(externalSelectedProjectId);
      onClearExternalSelectedProjectId?.();
    }
  }, [externalSelectedProjectId, onClearExternalSelectedProjectId]);

  useEffect(() => {
    if (initialClientIdForNewProject) {
      setEditingProject(null);
      setDraftDefaultClientId(initialClientIdForNewProject);
      setIsFormOpen(true);
      onClearInitialClientIdForNewProject?.();
    }
  }, [initialClientIdForNewProject, onClearInitialClientIdForNewProject]);

  const todayStr = getTodayIsoDate();
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const filteredProjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return projects.filter((proj) => {
      if (filterStatus !== 'all' && proj.status !== filterStatus) return false;
      if (filterTemplate !== 'all' && proj.templateId !== filterTemplate)
        return false;
      if (filterClientId !== 'all' && proj.clientId !== filterClientId)
        return false;
      if (q) {
        const clientName = clientById.get(proj.clientId)?.companyName || '';
        const haystack = [
          proj.name,
          proj.serviceType,
          proj.description || '',
          clientName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    projects,
    filterStatus,
    filterTemplate,
    filterClientId,
    searchTerm,
    clientById,
  ]);

  const kpis = useMemo(() => {
    let active = 0;
    let waiting = 0;
    let completed = 0;
    let overdue = 0;

    for (const p of projects) {
      if (p.status === 'concluido') completed += 1;
      else if (p.status === 'aguardando_cliente' || p.status === 'em_revisao')
        waiting += 1;
      else if (p.status === 'em_andamento' || p.status === 'nao_iniciado')
        active += 1;

      if (
        p.dueDate &&
        p.dueDate < todayStr &&
        p.status !== 'concluido' &&
        p.status !== 'cancelado'
      ) {
        overdue += 1;
      }
    }
    return { total: projects.length, active, waiting, completed, overdue };
  }, [projects, todayStr]);

  const formatBrDate = (iso?: string) =>
    iso ? iso.split('-').reverse().join('/') : 'Sem prazo';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
        <div>
          <h2 className="kz-page-title">Projetos da Agência</h2>
          <p className="kz-subtitle mt-1">
            Gerencie entregas pontuais (Kaizen Start), ciclos de 90 dias (Kaizen Performance) e projetos personalizados.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditingProject(null);
            setDraftDefaultClientId(undefined);
            setIsFormOpen(true);
          }}
        >
          Novo Projeto
        </Button>
      </div>

      {cloudPermissionBlocked && (
        <Alert variant="warning">
          Os projetos estão sendo salvos localmente neste navegador porque a coleção{' '}
          <code className="font-mono">projects</code> ainda aguarda publicação do{' '}
          <code className="font-mono">firestore.rules</code> atualizado no projeto Firebase.
        </Alert>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-text-muted)] flex items-center justify-between">
            <span>Projetos Ativos</span>
            <FolderKanban className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {kpis.active}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)]">
            {kpis.total} cadastrados no total
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-warning-text)] flex items-center justify-between">
            <span>Revisão / Aguardando</span>
            <Layers className="w-3.5 h-3.5 text-[var(--kz-warning-solid)]" />
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-warning-text)]">
            {kpis.waiting}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)]">
            Dependendo de homologação
          </div>
        </Card>

        <Card
          padding="sm"
          className={
            kpis.overdue > 0
              ? 'border-[var(--kz-danger-border)] bg-[var(--kz-danger-bg)]/40'
              : ''
          }
        >
          <div className="text-[11px] font-semibold text-[var(--kz-danger-text)] flex items-center justify-between">
            <span>Prazos Vencidos</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--kz-danger-solid)]" />
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-danger-text)]">
            {kpis.overdue}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)]">
            Entregas acima da data prevista
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-success-text)] flex items-center justify-between">
            <span>Concluídos</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-success-text)]">
            {kpis.completed}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)]">
            Finalizados pelo administrador
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar projeto ou cliente..."
            leftIcon={<Search className="w-3.5 h-3.5" />}
          />

          <Select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as ProjectStatus | 'all')
            }
          >
            <option value="all">Todos os Status</option>
            {PROJECT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Select
            value={filterTemplate}
            onChange={(e) =>
              setFilterTemplate(e.target.value as ProjectTemplateId | 'all')
            }
          >
            <option value="all">Todos os Modelos</option>
            <option value="kaizen_start">Kaizen Start</option>
            <option value="kaizen_performance">Kaizen Performance (90 dias)</option>
            <option value="personalizado">Personalizado</option>
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
        </div>
      </Card>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-6 h-6" />}
          title="Nenhum projeto encontrado"
          description="Crie um novo projeto a partir dos modelos Kaizen Start, Kaizen Performance (90 dias) ou Personalizado."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setEditingProject(null);
                setDraftDefaultClientId(undefined);
                setIsFormOpen(true);
              }}
            >
              Criar Primeiro Projeto
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const client = clientById.get(project.clientId);
            const statusMeta = getProjectStatusMeta(project.status);
            const tplMeta =
              PROJECT_TEMPLATES[project.templateId] ||
              PROJECT_TEMPLATES.personalizado;
            const prog = calculateProjectProgress(project, tasks, todayStr);
            const isProjectOverdue =
              Boolean(project.dueDate) &&
              (project.dueDate as string) < todayStr &&
              project.status !== 'concluido' &&
              project.status !== 'cancelado';

            return (
              <Card
                key={project.id}
                padding="md"
                className={`flex flex-col justify-between gap-4 hover:border-[var(--kz-accent-border)] transition-colors cursor-pointer ${
                  isProjectOverdue ? 'border-[var(--kz-danger-border)]' : ''
                }`}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <Badge variant="accent" size="sm">
                          {tplMeta.shortLabel}
                        </Badge>
                        <Badge variant={statusMeta.variant} size="sm" dot>
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-bold text-[var(--kz-text-primary)] truncate">
                        {project.name}
                      </h3>
                      <p className="text-xs text-[var(--kz-text-muted)] truncate">
                        {project.serviceType}
                      </p>
                    </div>
                  </div>

                  {client && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--kz-text-secondary)]">
                      <Users className="w-3.5 h-3.5 text-[var(--kz-text-subtle)] shrink-0" />
                      <span className="truncate font-medium">
                        {client.companyName}
                      </span>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-[var(--kz-text-muted)]">
                        {prog.completedTasks}/{prog.totalTasks} tarefas
                      </span>
                      <span className="font-bold text-[var(--kz-text-primary)]">
                        {prog.percent}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--kz-bg-subtle)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          prog.percent === 100
                            ? 'bg-[var(--kz-success-solid)]'
                            : 'bg-[var(--kz-accent)]'
                        }`}
                        style={{ width: `${prog.percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--kz-border-subtle)] flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                      isProjectOverdue
                        ? 'text-[var(--kz-danger-text)] font-bold'
                        : 'text-[var(--kz-text-muted)]'
                    }`}
                  >
                    <Calendar className="w-3 h-3" />
                    <span>Entrega: {formatBrDate(project.dueDate)}</span>
                  </span>

                  {prog.overdueTasks > 0 && (
                    <Badge variant="danger" size="sm">
                      {prog.overdueTasks} atrasada(s)
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ProjectFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProject(null);
          setDraftDefaultClientId(undefined);
        }}
        clients={clients}
        proposals={proposals}
        userName={userName}
        editingProject={editingProject}
        defaultClientId={draftDefaultClientId}
        onCreateProjectWithTasks={onCreateProjectWithTasks}
        onUpdateProject={onUpdateProject}
      />

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          clients={clients}
          proposals={proposals}
          tasks={tasks}
          financialEntries={financialEntries}
          resourceFiles={resourceFiles}
          resourceFolders={resourceFolders}
          resourceCategories={resourceCategories}
          userName={userName}
          onClose={() => setSelectedProjectId(null)}
          onEditProject={(proj) => {
            setEditingProject(proj);
            setIsFormOpen(true);
          }}
          onUpdateProject={onUpdateProject}
          onDeleteProject={onDeleteProject}
          onSaveTask={onSaveTask}
          onDeleteTask={onDeleteTask}
          onSaveResourceFile={onSaveResourceFile}
          onSyncTaskFiles={onSyncTaskFiles}
          onOpenClient={onOpenClient}
          onOpenFinance={onNavigate ? () => onNavigate('finance') : undefined}
          onOpenDocumentsCenter={onNavigate ? () => onNavigate('documents') : undefined}
        />
      )}
    </div>
  );
};
