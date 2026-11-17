import React, { useMemo, useState } from 'react';
import { Client, Project, SocialPost, Task } from '../../types/kaizen';
import {
  RESOURCE_CLIENT_SECTIONS,
  RESOURCE_PROJECT_SECTIONS,
  ResourceClientSection,
  ResourceFile,
  ResourceProjectSection,
} from '../../types/resources';
import {
  formatFileSize,
  getFilesForClientContext,
  getFilesForProjectContext,
  inferClientSectionForFile,
  inferProjectSectionForFile,
} from '../../services/resources';
import { Badge, Button, Card, EmptyState, Select } from '../ui';
import {
  Building2,
  Eye,
  FolderKanban,
  Link2,
  Plus,
  Share2,
} from 'lucide-react';

interface ClientsProjectsMaterialsTabProps {
  files: ResourceFile[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  socialPosts: SocialPost[];
  onPreviewFile: (file: ResourceFile) => void;
  onUploadForClient: (clientId: string, section?: ResourceClientSection) => void;
  onUploadForProject: (projectId: string, section?: ResourceProjectSection) => void;
}

export const ClientsProjectsMaterialsTab: React.FC<
  ClientsProjectsMaterialsTabProps
> = ({
  files,
  clients,
  projects,
  tasks,
  socialPosts,
  onPreviewFile,
  onUploadForClient,
  onUploadForProject,
}) => {
  const [contextMode, setContextMode] = useState<'client' | 'project'>('client');
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');

  const effectiveClientId =
    clients.some((c) => c.id === selectedClientId) ? selectedClientId : clients[0]?.id || '';
  const effectiveProjectId =
    projects.some((p) => p.id === selectedProjectId) ? selectedProjectId : projects[0]?.id || '';

  const selectedClient = clients.find((c) => c.id === effectiveClientId) || null;
  const selectedProject = projects.find((p) => p.id === effectiveProjectId) || null;

  const clientContextFiles = useMemo(
    () =>
      effectiveClientId
        ? getFilesForClientContext(files, effectiveClientId, projects, socialPosts, false)
        : [],
    [files, effectiveClientId, projects, socialPosts]
  );

  const clientFilesBySection = useMemo(() => {
    const map = new Map<ResourceClientSection, ResourceFile[]>();
    for (const sec of RESOURCE_CLIENT_SECTIONS) {
      map.set(sec.id, []);
    }
    for (const file of clientContextFiles) {
      const sec = inferClientSectionForFile(file);
      const list = map.get(sec) || [];
      list.push(file);
      map.set(sec, list);
    }
    return map;
  }, [clientContextFiles]);

  const projectContextFiles = useMemo(
    () =>
      effectiveProjectId
        ? getFilesForProjectContext(files, effectiveProjectId, false)
        : [],
    [files, effectiveProjectId]
  );

  const projectFilesBySection = useMemo(() => {
    const map = new Map<ResourceProjectSection, ResourceFile[]>();
    for (const sec of RESOURCE_PROJECT_SECTIONS) {
      map.set(sec.id, []);
    }
    for (const file of projectContextFiles) {
      const sec = inferProjectSectionForFile(file);
      const list = map.get(sec) || [];
      list.push(file);
      map.set(sec, list);
    }
    return map;
  }, [projectContextFiles]);

  const projectTasksWithFiles = useMemo(() => {
    if (!effectiveProjectId) return [];
    return tasks.filter(
      (t) =>
        t.projectId === effectiveProjectId &&
        files.some((f) => f.status === 'ativo' && f.linkedTaskIds?.includes(t.id))
    );
  }, [tasks, files, effectiveProjectId]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho e Alternador Cliente / Projeto */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setContextMode('client')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
              contextMode === 'client'
                ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)]'
                : 'border border-[var(--kz-border-subtle)] text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)]'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Estrutura por Cliente ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setContextMode('project')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
              contextMode === 'project'
                ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)]'
                : 'border border-[var(--kz-border-subtle)] text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)]'
            }`}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            Estrutura por Projeto ({projects.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {contextMode === 'client' ? (
            <>
              <Select
                value={effectiveClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="min-w-[240px]"
              >
                {clients.length === 0 ? (
                  <option value="">Nenhum cliente cadastrado</option>
                ) : (
                  clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))
                )}
              </Select>
              {selectedClient && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onUploadForClient(selectedClient.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Enviar para Cliente
                </Button>
              )}
            </>
          ) : (
            <>
              <Select
                value={effectiveProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="min-w-[240px]"
              >
                {projects.length === 0 ? (
                  <option value="">Nenhum projeto cadastrado</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                )}
              </Select>
              {selectedProject && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onUploadForProject(selectedProject.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Enviar para Projeto
                </Button>
              )}
            </>
          )}
        </div>
      </Card>

      {contextMode === 'client' ? (
        !selectedClient ? (
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="Nenhum cliente cadastrado"
            description="Converta um lead ou cadastre um cliente no módulo Clientes para organizar seus materiais por seção."
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-xs text-[var(--kz-text-secondary)]">
                Exibindo <strong className="text-[var(--kz-text-primary)]">{clientContextFiles.length}</strong> arquivo(s) no contexto de{' '}
                <strong className="text-[var(--kz-text-primary)]">{selectedClient.companyName}</strong>{' '}
                (incluindo automaticamente arquivos vinculados aos projetos e redes sociais deste cliente, sem duplicação física).
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {RESOURCE_CLIENT_SECTIONS.map((sec) => {
                const sectionFiles = clientFilesBySection.get(sec.id) || [];
                return (
                  <Card key={sec.id} className="p-4 flex flex-col justify-between gap-3">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--kz-text-primary)]">
                            {sec.label}
                          </h4>
                          <p className="text-[11px] text-[var(--kz-text-muted)]">
                            {sec.description}
                          </p>
                        </div>
                        <Badge variant={sectionFiles.length > 0 ? 'info' : 'neutral'}>
                          {sectionFiles.length}
                        </Badge>
                      </div>

                      {sectionFiles.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-[var(--kz-border-subtle)] px-3 py-4 text-center text-[11px] text-[var(--kz-text-muted)]">
                          Nenhum arquivo nesta seção.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {sectionFiles.map((file) => {
                            const viaProject =
                              file.projectId &&
                              projects.find((p) => p.id === file.projectId);
                            const viaSocial =
                              file.linkedSocialPostIds &&
                              file.linkedSocialPostIds.length > 0;
                            return (
                              <button
                                key={file.id}
                                type="button"
                                onClick={() => onPreviewFile(file)}
                                className="w-full flex items-center justify-between gap-2 rounded-lg border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/60 px-2.5 py-2 text-left hover:border-[var(--kz-accent)]/40 cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-[var(--kz-text-primary)]">
                                    {file.name}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--kz-text-muted)]">
                                    <span>.{file.extension.toUpperCase()}</span>
                                    <span>·</span>
                                    <span>{formatFileSize(file.sizeBytes)}</span>
                                    {viaProject && (
                                      <span className="inline-flex items-center gap-0.5 text-[var(--kz-accent-text)]">
                                        <Link2 className="h-2.5 w-2.5" />
                                        {viaProject.name}
                                      </span>
                                    )}
                                    {viaSocial && (
                                      <span className="inline-flex items-center gap-0.5 text-sky-400">
                                        <Share2 className="h-2.5 w-2.5" />
                                        Social
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--kz-text-secondary)]" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onUploadForClient(selectedClient.id, sec.id)}
                      className="w-full"
                    >
                      <Plus className="h-3 w-3" />
                      Adicionar em {sec.label}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        )
      ) : !selectedProject ? (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title="Nenhum projeto cadastrado"
          description="Crie um projeto no módulo Projetos para gerenciar arquivos de referência, produção, artes e entregáveis finais."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-xs text-[var(--kz-text-secondary)]">
              Projeto <strong className="text-[var(--kz-text-primary)]">{selectedProject.name}</strong> ·{' '}
              {projectContextFiles.length} arquivo(s) vinculado(s)
              {projectTasksWithFiles.length > 0 &&
                ` · ${projectTasksWithFiles.length} tarefa(s) com anexos`}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {RESOURCE_PROJECT_SECTIONS.map((sec) => {
              const sectionFiles = projectFilesBySection.get(sec.id) || [];
              return (
                <Card key={sec.id} className="p-4 flex flex-col justify-between gap-3">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--kz-text-primary)]">
                          {sec.label}
                        </h4>
                        <p className="text-[11px] text-[var(--kz-text-muted)]">
                          {sec.description}
                        </p>
                      </div>
                      <Badge variant={sectionFiles.length > 0 ? 'info' : 'neutral'}>
                        {sectionFiles.length}
                      </Badge>
                    </div>

                    {sectionFiles.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[var(--kz-border-subtle)] px-3 py-4 text-center text-[11px] text-[var(--kz-text-muted)]">
                        Nenhum arquivo nesta etapa.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sectionFiles.map((file) => (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => onPreviewFile(file)}
                            className="w-full flex items-center justify-between gap-2 rounded-lg border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/60 px-2.5 py-2 text-left hover:border-[var(--kz-accent)]/40 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-[var(--kz-text-primary)]">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-[var(--kz-text-muted)]">
                                .{file.extension.toUpperCase()} · {formatFileSize(file.sizeBytes)}
                                {file.linkedTaskIds?.length
                                  ? ` · ${file.linkedTaskIds.length} tarefa(s)`
                                  : ''}
                              </p>
                            </div>
                            <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--kz-text-secondary)]" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => onUploadForProject(selectedProject.id, sec.id)}
                    className="w-full"
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar em {sec.label}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
