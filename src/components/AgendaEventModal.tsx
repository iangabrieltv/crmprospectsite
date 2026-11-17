import React, { useEffect, useState } from 'react';
import { Lead } from '../types/crm';
import {
  AgendaEvent,
  AgendaEventStatus,
  AgendaEventType,
  AGENDA_EVENT_TYPE_OPTIONS,
  Client,
  Project,
} from '../types/kaizen';
import {
  buildGoogleCalendarTemplateUrl,
  generateAgendaEventId,
} from '../services/agendaService';
import { getTodayIsoDate } from '../services/projectService';
import {
  Button,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  Textarea,
} from './ui';
import { Calendar, ExternalLink, Trash2 } from 'lucide-react';

interface AgendaEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  leads: Lead[];
  projects: Project[];
  editingEvent?: AgendaEvent | null;
  defaultDate?: string;
  defaultClientId?: string;
  defaultProjectId?: string;
  onSaveEvent: (event: AgendaEvent, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteEvent?: (eventId: string) => Promise<void> | void;
}

export const AgendaEventModal: React.FC<AgendaEventModalProps> = ({
  isOpen,
  onClose,
  clients,
  leads,
  projects,
  editingEvent,
  defaultDate,
  defaultClientId,
  defaultProjectId,
  onSaveEvent,
  onDeleteEvent,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getTodayIsoDate());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [type, setType] = useState<AgendaEventType>('reuniao_cliente');
  const [status, setStatus] = useState<AgendaEventStatus>('agendado');
  const [clientId, setClientId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingEvent) {
      setTitle(editingEvent.title);
      setDescription(editingEvent.description || '');
      setDate(editingEvent.date);
      setStartTime(editingEvent.startTime || '');
      setEndTime(editingEvent.endTime || '');
      setType(editingEvent.type);
      setStatus(editingEvent.status);
      setClientId(editingEvent.clientId || '');
      setLeadId(editingEvent.leadId || '');
      setProjectId(editingEvent.projectId || '');
      setMeetingLink(editingEvent.meetingLink || '');
      setNotes(editingEvent.notes || '');
    } else {
      setTitle('');
      setDescription('');
      setDate(defaultDate || getTodayIsoDate());
      setStartTime('10:00');
      setEndTime('11:00');
      setType(defaultClientId ? 'reuniao_cliente' : 'compromisso_interno');
      setStatus('agendado');
      setClientId(defaultClientId || '');
      setLeadId('');
      setProjectId(defaultProjectId || '');
      setMeetingLink('');
      setNotes('');
    }
  }, [isOpen, editingEvent, defaultDate, defaultClientId, defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: AgendaEvent = {
        id: editingEvent ? editingEvent.id : generateAgendaEventId(),
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        type,
        status,
        clientId: clientId || undefined,
        leadId: leadId || undefined,
        projectId: projectId || undefined,
        meetingLink: meetingLink.trim() || undefined,
        notes: notes.trim() || undefined,
        externalSync: editingEvent?.externalSync || {
          provider: 'google_calendar',
          status: 'not_connected',
        },
        createdAt: editingEvent?.createdAt || nowIso,
        schemaVersion: editingEvent?.schemaVersion || 1,
        updatedAt: nowIso,
      };
      await onSaveEvent(payload, editingEvent ? 'edit' : 'create');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!editingEvent || !onDeleteEvent) return;
    setIsSaving(true);
    try {
      await onDeleteEvent(editingEvent.id);
      setShowDeleteConfirm(false);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const googleTemplateUrl = buildGoogleCalendarTemplateUrl({
    title: title || 'Compromisso Kaizen',
    date,
    startTime,
    endTime,
    description,
    meetingLink,
  });

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        closeDisabled={isSaving}
        title={editingEvent ? 'Editar Compromisso' : 'Novo Compromisso na Agenda'}
        subtitle="Cadastre reuniões, lembretes ou compromissos internos com vínculo direto a clientes, leads e projetos."
        icon={
          <div className="w-9 h-9 rounded-lg bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] flex items-center justify-center text-[var(--kz-accent)]">
            <Calendar className="w-4 h-4" />
          </div>
        }
        footer={
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <div>
              {editingEvent && onDeleteEvent && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-[var(--kz-danger-solid)]" />}
                  className="text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)]"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving}
                >
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={googleTemplateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg border border-[var(--kz-border-default)] bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] transition-colors"
                title="Abre modelo manual no Google Calendar (OAuth ainda não conectado)"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir no Google Calendar</span>
              </a>
              <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="kaizen-agenda-event-form"
                variant="primary"
                loading={isSaving}
              >
                {editingEvent ? 'Salvar Alterações' : 'Agendar Compromisso'}
              </Button>
            </div>
          </div>
        }
      >
        <form
          id="kaizen-agenda-event-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <Input
            label="Título do Compromisso *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Reunião de alinhamento mensal ou entrega da Landing Page"
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              label="Tipo de Evento *"
              value={type}
              onChange={(e) => setType(e.target.value as AgendaEventType)}
            >
              {AGENDA_EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </Select>

            <Input
              label="Data *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />

            <Input
              label="Início"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />

            <Input
              label="Término"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Cliente Relacionado"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Nenhum cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>

            <Select
              label="Projeto Relacionado"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Nenhum projeto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            <Select
              label="Lead Relacionado"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
            >
              <option value="">Nenhum lead</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.companyName}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Link da Reunião (Google Meet / Zoom / WhatsApp)"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/..."
            />

            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AgendaEventStatus)}
            >
              <option value="agendado">Agendado</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </Select>
          </div>

          <Textarea
            label="Descrição / Pauta"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Assuntos a tratar ou entregáveis da reunião..."
          />

          <Textarea
            label="Observações"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anotações pós-reunião ou lembretes..."
          />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Compromisso"
        description={
          <span>
            Deseja remover o compromisso <strong>{editingEvent?.title}</strong> da agenda?
          </span>
        }
        confirmLabel="Confirmar Exclusão"
        variant="danger"
        loading={isSaving}
      />
    </>
  );
};
