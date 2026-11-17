import React, { useMemo, useState } from 'react';
import {
  CommercialScript,
  ModelTemplate,
  ResourceCategory,
  ResourceCategoryKind,
  ResourceFile,
  ResourceFolder,
  ResourceFolderScope,
} from '../../types/resources';
import {
  canDeleteFolder,
  countCategoryReferences,
  createResourceCategory,
  createResourceFolder,
} from '../../services/resources';
import { Alert, Badge, Button, Card, Input, Select } from '../ui';
import { Folder, FolderPlus, Plus, Tag, Trash2 } from 'lucide-react';

interface CategoriesOrganizationTabProps {
  categories: ResourceCategory[];
  folders: ResourceFolder[];
  files: ResourceFile[];
  scripts: CommercialScript[];
  templates: ModelTemplate[];
  onSaveCategory: (cat: ResourceCategory, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteCategory: (categoryId: string) => Promise<void> | void;
  onSaveFolder: (folder: ResourceFolder, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteFolder: (folderId: string) => Promise<void> | void;
}

export const CategoriesOrganizationTab: React.FC<
  CategoriesOrganizationTabProps
> = ({
  categories,
  folders,
  files,
  scripts,
  templates,
  onSaveCategory,
  onDeleteCategory,
  onSaveFolder,
  onDeleteFolder,
}) => {
  const [catName, setCatName] = useState('');
  const [catKind, setCatKind] = useState<ResourceCategoryKind>('arquivo');
  const [catDesc, setCatDesc] = useState('');

  const [folderName, setFolderName] = useState('');
  const [folderScope, setFolderScope] = useState<ResourceFolderScope>('geral');
  const [folderParentId, setFolderParentId] = useState('');
  const [actionMsg, setActionMsg] = useState<{
    variant: 'info' | 'warning' | 'success';
    text: string;
  } | null>(null);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of files) {
      for (const t of f.tags || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    for (const s of scripts) {
      for (const t of s.tags || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    for (const m of templates) {
      for (const t of m.tags || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [files, scripts, templates]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const created = createResourceCategory({
      name: catName,
      kind: catKind,
      description: catDesc,
    });
    await onSaveCategory(created, 'create');
    setCatName('');
    setCatDesc('');
    setActionMsg({
      variant: 'success',
      text: `Categoria "${created.name}" adicionada com sucesso.`,
    });
  };

  const handleRemoveCategory = async (cat: ResourceCategory) => {
    const refs = countCategoryReferences(cat.id, { files, scripts, templates });
    if (refs > 0) {
      setActionMsg({
        variant: 'warning',
        text: `Não é possível excluir "${cat.name}" porque existem ${refs} registro(s) vinculados a ela. Desative-a ou mova os itens antes.`,
      });
      return;
    }
    await onDeleteCategory(cat.id);
    setActionMsg({
      variant: 'info',
      text: `Categoria "${cat.name}" removida.`,
    });
  };

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    const created = createResourceFolder({
      name: folderName,
      scope: folderScope,
      parentId: folderParentId || undefined,
    });
    await onSaveFolder(created, 'create');
    setFolderName('');
    setActionMsg({
      variant: 'success',
      text: `Pasta "${created.name}" criada na estrutura organizacional.`,
    });
  };

  const handleRemoveFolder = async (folder: ResourceFolder) => {
    const check = canDeleteFolder(folder.id, folders, files);
    if (!check.allowed) {
      setActionMsg({
        variant: 'warning',
        text: check.reason || 'Pasta possui itens vinculados.',
      });
      return;
    }
    await onDeleteFolder(folder.id);
    setActionMsg({
      variant: 'info',
      text: `Pasta "${folder.name}" removida.`,
    });
  };

  return (
    <div className="space-y-6">
      {actionMsg && (
        <Alert variant={actionMsg.variant}>{actionMsg.text}</Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gestão de Categorias */}
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--kz-text-primary)]">
              Categorias de Arquivos, Scripts e Modelos
            </h3>
            <p className="text-xs text-[var(--kz-text-secondary)]">
              Crie novas categorias ou ative/desative classificações sem quebrar históricos.
            </p>
          </div>

          <form onSubmit={handleAddCategory} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              placeholder="Nome da categoria *"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
            <Select
              value={catKind}
              onChange={(e) => setCatKind(e.target.value as ResourceCategoryKind)}
            >
              <option value="arquivo">Arquivos & Docs</option>
              <option value="script">Scripts Comerciais</option>
              <option value="modelo">Modelos</option>
            </Select>
            <Button type="submit" variant="primary" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </form>

          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
            {categories.map((cat) => {
              const refs = countCategoryReferences(cat.id, {
                files,
                scripts,
                templates,
              });
              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/50 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--kz-text-primary)] truncate">
                        {cat.name}
                      </span>
                      <Badge
                        variant={
                          cat.kind === 'arquivo'
                            ? 'info'
                            : cat.kind === 'script'
                            ? 'accent'
                            : 'success'
                        }
                      >
                        {cat.kind}
                      </Badge>
                      {!cat.active && <Badge variant="neutral">Inativa</Badge>}
                    </div>
                    <p className="text-[11px] text-[var(--kz-text-muted)] tabular-nums">
                      {refs} vínculo(s) ativo(s)
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        onSaveCategory(
                          {
                            ...cat,
                            active: !cat.active,
                            updatedAt: new Date().toISOString(),
                          },
                          'edit'
                        )
                      }
                    >
                      {cat.active ? 'Desativar' : 'Ativar'}
                    </Button>
                    {!cat.isDefault && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleRemoveCategory(cat)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Gestão de Pastas + Etiquetas */}
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--kz-text-primary)]">
                Estrutura de Pastas Hierárquicas
              </h3>
              <p className="text-xs text-[var(--kz-text-secondary)]">
                Organize diretórios da agência, áreas de clientes, projetos ou marketing.
              </p>
            </div>

            <form onSubmit={handleAddFolder} className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Nome da pasta *"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                />
                <Select
                  value={folderScope}
                  onChange={(e) =>
                    setFolderScope(e.target.value as ResourceFolderScope)
                  }
                >
                  <option value="geral">Escopo: Geral</option>
                  <option value="interno">Escopo: Interno Agência</option>
                  <option value="cliente">Escopo: Clientes</option>
                  <option value="projeto">Escopo: Projetos</option>
                  <option value="marketing">Escopo: Marketing</option>
                </Select>
              </div>
              <div className="flex gap-2">
                <Select
                  value={folderParentId}
                  onChange={(e) => setFolderParentId(e.target.value)}
                  className="flex-1"
                >
                  <option value="">Pasta raiz (sem pasta pai)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      Dentro de: {f.name}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="primary" size="sm">
                  <FolderPlus className="h-3.5 w-3.5" />
                  Criar Pasta
                </Button>
              </div>
            </form>

            {folders.length === 0 ? (
              <p className="text-xs text-[var(--kz-text-muted)] py-3 text-center border border-dashed border-[var(--kz-border-subtle)] rounded-lg">
                Nenhuma pasta personalizada criada ainda.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2">
                {folders.map((f) => {
                  const parent = f.parentId
                    ? folders.find((p) => p.id === f.parentId)
                    : null;
                  const count = files.filter((file) => file.folderId === f.id).length;
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/50 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Folder className="h-4 w-4 text-[var(--kz-accent)] shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--kz-text-primary)]">
                            {f.name}
                          </p>
                          <p className="text-[10px] text-[var(--kz-text-muted)]">
                            {parent ? `Subpasta de ${parent.name} · ` : ''}
                            {f.scope} · {count} arquivo(s)
                          </p>
                        </div>
                      </div>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleRemoveFolder(f)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-[var(--kz-accent)]" />
              <h3 className="text-sm font-semibold text-[var(--kz-text-primary)]">
                Etiquetas (Tags) em Uso
              </h3>
            </div>
            {allTags.length === 0 ? (
              <p className="text-xs text-[var(--kz-text-muted)]">
                As etiquetas adicionadas em arquivos, scripts e modelos aparecerão consolidadas aqui.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(([tag, count]) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)] px-2 py-1 text-xs text-[var(--kz-text-secondary)]"
                  >
                    #{tag}
                    <span className="font-mono text-[10px] text-[var(--kz-accent-text)]">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
