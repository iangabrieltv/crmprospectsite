import React, { useState } from 'react';
import { Check, Edit3, Plus, ShieldAlert, Tags } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Select,
  Textarea,
} from '../ui';
import {
  FinancialCategory,
  FinancialEntry,
  FinancialKind,
  FinancialRecurrence,
} from '../../types/finance';
import {
  canDeleteFinancialCategory,
  getCategoryLinkedUsage,
} from '../../services/finance';

interface FinanceCategoriesTabProps {
  categories: FinancialCategory[];
  entries: FinancialEntry[];
  recurrences: FinancialRecurrence[];
  onSaveCategory: (payload: {
    editingId?: string;
    name: string;
    kind: FinancialKind;
    description?: string;
    active: boolean;
  }) => Promise<void>;
}

export const FinanceCategoriesTab: React.FC<FinanceCategoriesTabProps> = ({
  categories,
  entries,
  recurrences,
  onSaveCategory,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<FinancialCategory | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FinancialKind>('despesa');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [guardMessage, setGuardMessage] = useState<string | null>(null);

  const openCreate = (defaultKind: FinancialKind) => {
    setEditingCat(null);
    setName('');
    setKind(defaultKind);
    setDescription('');
    setActive(true);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (cat: FinancialCategory) => {
    setEditingCat(cat);
    setName(cat.name);
    setKind(cat.kind);
    setDescription(cat.description || '');
    setActive(cat.active);
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome da categoria.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveCategory({
        ...(editingCat ? { editingId: editingCat.id } : {}),
        name: name.trim(),
        kind,
        description: description.trim() || undefined,
        active,
      });
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat: FinancialCategory) => {
    const check = canDeleteFinancialCategory(cat.id, entries, recurrences);
    if (cat.active && !check.allowed) {
      setGuardMessage(
        `"${cat.name}" possui ${check.usage.entryCount} lançamento(s) e ${check.usage.recurrenceCount} recorrência(s) vinculados. Ela pode ser desativada para novos lançamentos sem apagar o histórico existente.`
      );
    }
    await onSaveCategory({
      editingId: cat.id,
      name: cat.name,
      kind: cat.kind,
      description: cat.description,
      active: !cat.active,
    });
  };

  const renderSection = (sectionKind: FinancialKind, title: string, subtitle: string) => {
    const list = categories
      .filter((c) => c.kind === sectionKind)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return (
      <Card padding="lg" className="space-y-4">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tags className="w-4 h-4 text-[var(--kz-accent)]" />
              {title}
            </CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => openCreate(sectionKind)}
          >
            Nova Categoria
          </Button>
        </CardHeader>

        <div className="divide-y divide-[var(--kz-border-subtle)]">
          {list.map((cat) => {
            const usage = getCategoryLinkedUsage(cat.id, entries, recurrences);
            return (
              <div
                key={cat.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        cat.active
                          ? 'text-[var(--kz-text-primary)]'
                          : 'text-[var(--kz-text-muted)] line-through'
                      }`}
                    >
                      {cat.name}
                    </span>
                    <Badge variant={cat.active ? 'success' : 'neutral'}>
                      {cat.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                    {usage.totalCount > 0 && (
                      <span className="text-[11px] font-mono text-[var(--kz-text-muted)]">
                        · {usage.entryCount} lanç. · {usage.recurrenceCount} rec.
                      </span>
                    )}
                  </div>
                  {cat.description && (
                    <p className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
                      {cat.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="xs"
                    leftIcon={<Edit3 className="w-3 h-3" />}
                    onClick={() => openEdit(cat)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleToggleActive(cat)}
                  >
                    {cat.active ? 'Desativar' : 'Reativar'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <Alert variant="info">
        <span className="text-xs">
          <ShieldAlert className="w-3.5 h-3.5 inline mr-1.5" />
          <strong>Integridade de histórico:</strong> categorias associadas a lançamentos ou
          recorrências não são excluídas fisicamente — use <em>Desativar</em> para removê-las de
          novos cadastros mantendo relatórios históricos íntegros.
        </span>
      </Alert>

      {guardMessage && (
        <Alert variant="warning" onDismiss={() => setGuardMessage(null)}>
          {guardMessage}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {renderSection(
          'receita',
          'Categorias de Receitas',
          'Planos, implantações, serviços pontuais e recorrências da Kaizen.'
        )}
        {renderSection(
          'despesa',
          'Categorias de Despesas',
          'Infraestrutura, SaaS, mídia paga, terceirizados, tributos e pró-labore.'
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        size="sm"
        closeDisabled={saving}
        title={editingCat ? 'Editar Categoria Financeira' : 'Nova Categoria Financeira'}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="kz-fin-cat-form"
              variant="primary"
              loading={saving}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Salvar
            </Button>
          </>
        }
      >
        <form id="kz-fin-cat-form" onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <Alert variant="danger" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Input
            label="Nome da Categoria"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Produção Audiovisual"
          />
          <Select
            label="Natureza"
            value={kind}
            disabled={Boolean(editingCat)}
            onChange={(e) => setKind(e.target.value as FinancialKind)}
          >
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </Select>
          <Textarea
            label="Descrição (opcional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
};
