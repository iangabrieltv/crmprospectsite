import React, { useEffect, useState } from 'react';
import {
  Client,
  Project,
  Task,
  TaskChecklistItem,
  TaskPriority,
  TaskStatus,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from '../types/kaizen';
import {
  generateTaskChecklistId,
  generateTaskId,
} from '../services/taskService';
import {
  Modal,
  Button,
  Input,
  Select,
  Textarea,
} from './ui';
import { CheckSquare, Plus, Trash2 } from 'lucide-react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  clients: Client[];
  editingTask?: Task | null;
  defaultProjectId?: string;
  defaultClientId?: string;
  onSave: (task: Task, mode: 'create' | 'edit') => Promise<void> | void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  projects,
  clients,
  editingTask,
  defaultProjectId,
  defaultClientId,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [clientId, setClientId] = useState('');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('media');
  const [status, setStatus] = useState<TaskStatus>('a_fazer');
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setProjectId(editingTask.projectId || '');
      setClientId(editingTask.clientId || '');
      setPhaseLabel(editingTask.phaseLabel || '');
      setStartDate(editingTask.startDate || '');
      setDueDate(editingTask.dueDate || '');
      setPriority(editingTask.priority);
      setStatus(editingTask.status);
      setNotes(editingTask.notes || '');
      setChecklist(
        (editingTask.checklist || []).map((item) => ({ ...item }))
      );
    } else {
      const initProject = defaultProjectId
        ? projects.find((p) => p.id === defaultProjectId)
        : undefined;
      setTitle('');
      setDescription('');
      setProjectId(defaultProjectId || '');
      setClientId(defaultClientId || initProject?.clientId || '');
      setPhaseLabel('');
      setStartDate('');
      setDueDate('');
      setPriority('media');
      setStatus('a_fazer');
      setNotes('');
      setChecklist([]);
    }
    setNewSubtaskTitle('');
  }, [isOpen, editingTask, defaultProjectId, defaultClientId, projects]);

  const selectedProject = projects.find((p) => p.id === projectId);

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    if (nextProjectId) {
      const matched = projects.find((p) => p.id === nextProjectId);
      if (matched?.clientId) {
        setClientId(matched.clientId);
      }
    }
  };

  const handleAddChecklistItem = () => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    setChecklist((prev) => [
      ...prev,
      { id: generateTaskChecklistId(), title: trimmed, done: false },
    ]);
    setNewSubtaskTitle('');
  };

  const handleToggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    );
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const isDone = status === 'concluida';
      const resolvedClientId = clientId || selectedProject?.clientId || undefined;

      const payload: Task = {
        id: editingTask ? editingTask.id : generateTaskId(),
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: projectId || undefined,
        clientId: resolvedClientId,
        phaseLabel: phaseLabel.trim() || undefined,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        priority,
        status,
        checklist,
        notes: notes.trim() || undefined,
        completedAt: isDone
          ? editingTask?.completedAt || nowIso
          : undefined,
        createdAt: editingTask?.createdAt || nowIso,
        schemaVersion: editingTask?.schemaVersion || 1,
        updatedAt: nowIso,
      };

      await onSave(payload, editingTask ? 'edit' : 'create');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      closeDisabled={isSaving}
      title={editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
      subtitle="Registro único sincronizado automaticamente entre Projetos, Minhas Tarefas e Agenda."
      icon={
        <div className="w-9 h-9 rounded-lg bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] flex items-center justify-center text-[var(--kz-accent)]">
          <CheckSquare className="w-4 h-4" />
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="kaizen-task-form"
            variant="primary"
            loading={isSaving}
          >
            {editingTask ? 'Salvar Alterações' : 'Criar Tarefa'}
          </Button>
        </>
      }
    >
      <form id="kaizen-task-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Título da Tarefa *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Configurar domínio e DNS na hospedagem"
          required
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Projeto Vinculado"
            value={projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            <option value="">Sem vínculo com projeto</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name}
              </option>
            ))}
          </Select>

          <Select
            label="Cliente Vinculado"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Sem vínculo direto com cliente</option>
            {clients.map((cli) => (
              <option key={cli.id} value={cli.id}>
                {cli.companyName}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            {TASK_STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Select
            label="Prioridade"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {TASK_PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Input
            label="Data de Início"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            label="Prazo (aparece na Agenda)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        {selectedProject?.phases && selectedProject.phases.length > 0 ? (
          <Select
            label="Etapa / Ciclo do Projeto"
            value={phaseLabel}
            onChange={(e) => setPhaseLabel(e.target.value)}
          >
            <option value="">Geral / Sem ciclo específico</option>
            {selectedProject.phases.map((ph) => {
              const label = ph.rangeLabel
                ? `${ph.rangeLabel} · ${ph.label}`
                : ph.label;
              return (
                <option key={ph.id} value={label}>
                  {label}
                </option>
              );
            })}
          </Select>
        ) : (
          <Input
            label="Etapa / Categoria (opcional)"
            value={phaseLabel}
            onChange={(e) => setPhaseLabel(e.target.value)}
            placeholder="Ex: Estruturação, Design, SEO..."
          />
        )}

        <Textarea
          label="Descrição Operacional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Detalhe o que precisa ser entregue, referências ou critérios de aceitação..."
        />

        {/* Subtarefas / Checklist */}
        <div className="p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--kz-text-primary)]">
              Checklist / Subtarefas ({checklist.filter((c) => c.done).length}/
              {checklist.length})
            </span>
          </div>

          <div className="flex gap-2">
            <Input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddChecklistItem();
                }
              }}
              placeholder="Adicionar item ao checklist..."
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleAddChecklistItem}
            >
              Incluir
            </Button>
          </div>

          {checklist.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] text-xs"
                >
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleChecklistItem(item.id)}
                      className="rounded accent-[var(--kz-accent)]"
                    />
                    <span
                      className={`truncate ${
                        item.done
                          ? 'line-through text-[var(--kz-text-muted)]'
                          : 'text-[var(--kz-text-primary)]'
                      }`}
                    >
                      {item.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklistItem(item.id)}
                    className="p-1 text-[var(--kz-text-subtle)] hover:text-[var(--kz-danger-text)] cursor-pointer"
                    aria-label="Remover item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Textarea
          label="Observações Internas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notas de execução, bloqueios ou links auxiliares..."
        />
      </form>
    </Modal>
  );
};
