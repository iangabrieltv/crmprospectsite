import React, { useState, useMemo } from 'react';
import { Lead, NicheCampaign, FunnelStageId } from '../types/crm';
import { formatDisplayPhone, buildWhatsAppLink } from '../utils/phone';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  MessageCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CalendarCheck,
  AlertCircle,
  Plus,
  Edit3,
  Trash2,
  Sparkles,
  DollarSign,
  FileText,
  User,
  ArrowRight,
  Video,
  Share2,
  Check,
  RotateCcw,
  Building2,
  ListOrdered
} from 'lucide-react';

interface AgendaViewProps {
  niche: NicheCampaign;
  leads: Lead[];
  allLeads?: Lead[];
  userName: string;
  onUpdateLead: (updatedLead: Lead) => void;
  onMoveStage: (leadId: string, targetStage: FunnelStageId) => void;
  onOpenLeadModal: (lead: Lead) => void;
  onSwitchToKanban: () => void;
}

export const AgendaView: React.FC<AgendaViewProps> = ({
  niche,
  leads,
  allLeads,
  userName,
  onUpdateLead,
  onMoveStage,
  onOpenLeadModal,
  onSwitchToKanban,
}) => {
  // Filter mode: active niche or all niches
  const [scopeMode, setScopeMode] = useState<'niche' | 'all'>('niche');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Candidate leads: strictly leads in "reuniao_marcada" stage
  const sourcePool = scopeMode === 'niche' ? leads : (allLeads || leads);
  const meetingLeads = useMemo(() => {
    return sourcePool.filter((l) => l.stage === 'reuniao_marcada');
  }, [sourcePool]);

  // Current calendar navigation month & year
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayString, setSelectedDayString] = useState<string | null>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Selected lead for editing meeting details
  const [editingMeetingLead, setEditingMeetingLead] = useState<Lead | null>(null);
  const [editMeetingDate, setEditMeetingDate] = useState('');
  const [editMeetingTime, setEditMeetingTime] = useState('');
  const [editMeetingNotes, setEditMeetingNotes] = useState('');
  const [editMeetingLink, setEditMeetingLink] = useState('');
  const [editMeetingStatus, setEditMeetingStatus] = useState<'agendada' | 'realizada' | 'remarcada' | 'cancelada'>('agendada');
  const [copiedLink, setCopiedLink] = useState(false);

  // Quick picker to move another lead into "reuniao_marcada"
  const [isQuickPickerOpen, setIsQuickPickerOpen] = useState(false);
  const [quickSearchTerm, setQuickSearchTerm] = useState('');

  // Open meeting editor
  const handleOpenMeetingEditor = (lead: Lead) => {
    setEditingMeetingLead(lead);
    setEditMeetingDate(lead.meetingDate || selectedDayString || new Date().toISOString().split('T')[0]);
    setEditMeetingTime(lead.meetingTime || '10:00');
    setEditMeetingNotes(lead.meetingNotes || '');
    setEditMeetingLink(lead.meetingLink || '');
    setEditMeetingStatus(lead.meetingStatus || 'agendada');
  };

  // Save meeting details
  const handleSaveMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeetingLead) return;

    const updated: Lead = {
      ...editingMeetingLead,
      meetingDate: editMeetingDate || undefined,
      meetingTime: editMeetingTime || undefined,
      meetingNotes: editMeetingNotes.trim() || undefined,
      meetingLink: editMeetingLink.trim() || undefined,
      meetingStatus: editMeetingStatus,
      notes: [
        {
          id: 'note-agenda-' + Date.now(),
          date: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          text: `Agenda atualizada: Reunião marcada para ${editMeetingDate ? new Date(editMeetingDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'data a definir'}${editMeetingTime ? ` às ${editMeetingTime}` : ''}.${editMeetingNotes ? ` Pauta: "${editMeetingNotes.slice(0, 100)}..."` : ''}`,
          author: userName,
        },
        ...editingMeetingLead.notes,
      ],
    };

    onUpdateLead(updated);
    setEditingMeetingLead(null);
  };

  // Move a lead to "reuniao_marcada" from the quick picker
  const handleSelectLeadForMeeting = (lead: Lead) => {
    onMoveStage(lead.id, 'reuniao_marcada');
    setIsQuickPickerOpen(false);
    handleOpenMeetingEditor({
      ...lead,
      stage: 'reuniao_marcada',
    });
  };

  // Insert template text into meeting notes
  const handleInsertTemplateNote = (snippet: string) => {
    setEditMeetingNotes((prev) => {
      const cleanPrev = prev.trim();
      return cleanPrev ? `${cleanPrev}\n\n${snippet}` : snippet;
    });
  };

  // Generate WhatsApp confirmation message link
  const buildWhatsAppMeetingLink = (lead: Lead) => {
    const dataFmt = lead.meetingDate
      ? new Date(lead.meetingDate + 'T00:00:00').toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
        })
      : 'em breve';
    const horaFmt = lead.meetingTime ? `às ${lead.meetingTime}` : '';

    const text = `Olá, ${lead.contactName || 'tudo bem'}! Aqui é ${userName}.\n\nPassando para confirmar nossa reunião sobre o projeto da *${lead.companyName}* marcada para *${dataFmt}* ${horaFmt}.\n\n${lead.meetingLink ? `🔗 Link da nossa sala: ${lead.meetingLink}\n\n` : ''}Qualquer dúvida estou à disposição por aqui. Nos falamos em instantes!`;
    return buildWhatsAppLink(lead.phone, text);
  };

  // Generate Google Calendar Link
  const buildGoogleCalendarUrl = (lead: Lead) => {
    if (!lead.meetingDate) return '';
    const dateFormatted = lead.meetingDate.replace(/-/g, '');
    const timeFormatted = (lead.meetingTime || '10:00').replace(/:/g, '') + '00';
    const startIso = `${dateFormatted}T${timeFormatted}`;
    // 45 min duration
    const endHour = Number((lead.meetingTime || '10:00').split(':')[0]);
    const endMin = Number((lead.meetingTime || '10:00').split(':')[1]) + 45;
    const finalHour = endHour + Math.floor(endMin / 60);
    const finalMin = endMin % 60;
    const endIso = `${dateFormatted}T${String(finalHour).padStart(2, '0')}${String(finalMin).padStart(2, '0')}00`;

    const title = encodeURIComponent(`Reunião de Apresentação: ${lead.companyName} | ${userName}`);
    const details = encodeURIComponent(
      `Reunião comercial e apresentação do projeto com ${lead.companyName}.\nContato: ${lead.contactName || 'Responsável'}\nTelefone: ${formatDisplayPhone(lead.phone)}\n\nObservações / Pauta:\n${lead.meetingNotes || 'Apresentação da demonstração do site e proposta de implementação.'}\n\nLink da reunião: ${lead.meetingLink || 'Via WhatsApp / Meet'}`
    );
    const location = encodeURIComponent(lead.meetingLink || `WhatsApp: ${formatDisplayPhone(lead.phone)}`);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
  };

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 - 11

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Monday = 0, Sunday = 6
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayString(today.toISOString().split('T')[0]);
  };

  // Group leads with meetings by date: "YYYY-MM-DD" -> Lead[]
  const leadsByDate = useMemo(() => {
    const map = new Map<string, Lead[]>();
    meetingLeads.forEach((lead) => {
      if (lead.meetingDate) {
        const existing = map.get(lead.meetingDate) || [];
        existing.push(lead);
        map.set(lead.meetingDate, existing);
      }
    });
    return map;
  }, [meetingLeads]);

  // Unscheduled leads (in reuniao_marcada but without meetingDate)
  const unscheduledLeads = useMemo(() => {
    return meetingLeads.filter((l) => !l.meetingDate);
  }, [meetingLeads]);

  // Leads for the selected day
  const selectedDayLeads = useMemo(() => {
    if (!selectedDayString) return [];
    return leadsByDate.get(selectedDayString) || [];
  }, [selectedDayString, leadsByDate]);

  // 1. EMPTY STATE: No leads in "reuniao_marcada" stage at all
  if (meetingLeads.length === 0) {
    const availableLeadsToSchedule = sourcePool.filter((l) => l.stage !== 'reuniao_marcada');
    const filteredPickers = availableLeadsToSchedule.filter((l) => {
      if (!quickSearchTerm.trim()) return true;
      const q = quickSearchTerm.toLowerCase();
      return (
        l.companyName.toLowerCase().includes(q) ||
        (l.contactName && l.contactName.toLowerCase().includes(q)) ||
        l.phone.includes(q)
      );
    });

    return (
      <div className="flex-1 p-4 sm:p-8 max-w-5xl mx-auto w-full flex flex-col items-center justify-center min-h-[70vh]">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 shadow-sm max-w-2xl w-full text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-2xs border border-blue-100">
            <CalendarIcon className="w-8 h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
            Nenhuma Reunião Marcada na Agenda
          </h2>

          <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-lg mx-auto">
            A aba <strong>Agenda</strong> reúne automaticamente todos os contatos que você mover para a etapa{' '}
            <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
              6. Reunião Marcada
            </span>{' '}
            no Pipeline.
          </p>

          {/* Simple step visual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex flex-col gap-1 p-2">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider font-mono">Passo 1</span>
              <p className="text-xs font-semibold text-slate-800">Abra o Pipeline</p>
              <p className="text-[11px] text-slate-500">Localize o lead com quem combinou a demonstração.</p>
            </div>
            <div className="flex flex-col gap-1 p-2 border-t sm:border-t-0 sm:border-l border-slate-200">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">Passo 2</span>
              <p className="text-xs font-semibold text-slate-800">Mova para Reunião Marcada</p>
              <p className="text-[11px] text-slate-500">Arraste o cartão para a coluna "Reunião Marcada".</p>
            </div>
            <div className="flex flex-col gap-1 p-2 border-t sm:border-t-0 sm:border-l border-slate-200">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider font-mono">Passo 3</span>
              <p className="text-xs font-semibold text-slate-800">Defina Dia & Horário</p>
              <p className="text-[11px] text-slate-500">Ele aparecerá aqui para você colocar a data, hora e observações.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onSwitchToKanban}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Ir para o Pipeline (Kanban)</span>
            </button>

            {availableLeadsToSchedule.length > 0 && (
              <div className="relative w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsQuickPickerOpen(!isQuickPickerOpen)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>Agendar um Lead Agora</span>
                </button>

                {isQuickPickerOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-left animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                      <span className="text-xs font-bold text-slate-800">Escolha o Lead para Reunião</span>
                      <button
                        type="button"
                        onClick={() => setIsQuickPickerOpen(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                      >
                        Fechar
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Buscar por empresa, contato ou fone..."
                      value={quickSearchTerm}
                      onChange={(e) => setQuickSearchTerm(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />

                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {filteredPickers.slice(0, 10).map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => handleSelectLeadForMeeting(l)}
                          className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="truncate pr-2">
                            <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">
                              {l.companyName}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {l.contactName || 'Sem contato'} • {formatDisplayPhone(l.phone)}
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                            Agendar
                          </span>
                        </button>
                      ))}
                      {filteredPickers.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">Nenhum lead encontrado.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. MAIN AGENDA VIEW WITH CALENDAR & SCHEDULED MEETINGS
  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-w-0 w-full p-3 sm:p-6 overflow-y-auto">
      {/* Top Header & Metrics Bar */}
      <div className="max-w-7xl mx-auto w-full mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📅</span>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Agenda de Reuniões Marcadas
            </h1>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              {meetingLeads.length} {meetingLeads.length === 1 ? 'reunião' : 'reuniões'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Visualize dias e horários marcados, defina a pauta da reunião e dispare confirmações automáticas no WhatsApp.
          </p>
        </div>

        {/* View mode toggle & Scope selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope Selector */}
          <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setScopeMode('niche')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                scopeMode === 'niche' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {niche.emoji} {niche.name}
            </button>
            <button
              type="button"
              onClick={() => setScopeMode('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                scopeMode === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos os Nichos
            </button>
          </div>

          {/* Calendar vs List Mode */}
          <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendário</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Pauta / Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alert for leads in "reuniao_marcada" without date and time set */}
      {unscheduledLeads.length > 0 && (
        <div className="max-w-7xl mx-auto w-full mb-5 bg-amber-50 border border-amber-200/90 rounded-xl p-3.5 sm:p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-950">
                  {unscheduledLeads.length === 1
                    ? '1 lead aguardando definição de dia e horário da reunião'
                    : `${unscheduledLeads.length} leads aguardando definição de dia e horário`}
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Estes contatos já estão em <strong>Reunião Marcada</strong> no pipeline, mas ainda não têm o dia e horário definidos:
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  {unscheduledLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => handleOpenMeetingEditor(lead)}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Building2 className="w-3.5 h-3.5 text-amber-700" />
                      <span>{lead.companyName}</span>
                      <span className="text-[10px] text-amber-700 font-normal">→ Agendar agora</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: CALENDAR OR LIST */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Monthly Calendar */}
        {viewMode === 'calendar' ? (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-6 flex flex-col">
            {/* Month Navigation Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {monthNames[month]} {year}
                </h2>
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Hoje
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                <div key={d} className="text-[11px] font-semibold text-slate-400 py-1 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 gap-1 flex-1">
              {/* Empty leading padding cells */}
              {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[96px] bg-slate-50/40 rounded-xl border border-transparent p-1 text-slate-300 pointer-events-none" />
              ))}

              {/* Day cells */}
              {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayLeads = leadsByDate.get(dateKey) || [];
                const isToday =
                  new Date().toISOString().split('T')[0] === dateKey;
                const isSelected = selectedDayString === dateKey;

                return (
                  <div
                    key={dateKey}
                    onClick={() => setSelectedDayString(dateKey)}
                    className={`min-h-[85px] sm:min-h-[105px] rounded-xl border p-1.5 flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-400'
                        : isToday
                        ? 'border-emerald-400 bg-emerald-50/20 shadow-2xs'
                        : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-emerald-600 text-white'
                            : isSelected
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-700'
                        }`}
                      >
                        {dayNum}
                      </span>
                      {dayLeads.length > 0 && (
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                          {dayLeads.length}
                        </span>
                      )}
                    </div>

                    {/* Meetings badges inside day cell */}
                    <div className="space-y-1 mt-1 overflow-hidden">
                      {dayLeads.slice(0, 2).map((l) => (
                        <div
                          key={l.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMeetingEditor(l);
                          }}
                          className="px-1.5 py-0.5 bg-emerald-100/90 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded text-[10px] font-semibold truncate flex items-center gap-1 transition-colors"
                          title={`${l.meetingTime || ''} - ${l.companyName}: ${l.meetingNotes || 'Clique para ver pauta'}`}
                        >
                          <span className="font-mono text-[9px] text-emerald-700 shrink-0">
                            {l.meetingTime || 'Reunião'}
                          </span>
                          <span className="truncate">{l.companyName}</span>
                        </div>
                      ))}
                      {dayLeads.length > 2 && (
                        <span className="text-[9px] font-bold text-slate-500 px-1 block">
                          +{dayLeads.length - 2} mais
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* LIST VIEW OF ALL MEETINGS */
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">
                Lista Completa de Reuniões Agendadas ({meetingLeads.length})
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                Ordenado por data e horário
              </span>
            </div>

            {meetingLeads
              .slice()
              .sort((a, b) => {
                if (!a.meetingDate) return 1;
                if (!b.meetingDate) return -1;
                return (
                  new Date(`${a.meetingDate}T${a.meetingTime || '00:00'}`).getTime() -
                  new Date(`${b.meetingDate}T${b.meetingTime || '00:00'}`).getTime()
                );
              })
              .map((lead) => {
                const dateFmt = lead.meetingDate
                  ? new Date(lead.meetingDate + 'T00:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : 'Data não definida';

                return (
                  <div
                    key={lead.id}
                    className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{lead.companyName}</span>
                        {lead.contactName && (
                          <span className="text-[11px] text-slate-500">• {lead.contactName}</span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {lead.meetingStatus === 'realizada' ? 'Realizada' : 'Agendada'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                        <div className="flex items-center gap-1 font-semibold text-emerald-900">
                          <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{dateFmt}</span>
                        </div>
                        {lead.meetingTime && (
                          <div className="flex items-center gap-1 font-mono text-slate-700">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{lead.meetingTime}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 font-mono">
                          {formatDisplayPhone(lead.phone)}
                        </div>
                      </div>

                      {lead.meetingNotes && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2 max-w-xl">
                          <strong>Pauta:</strong> {lead.meetingNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <a
                        href={buildWhatsAppMeetingLink(lead)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Confirmar WhatsApp</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleOpenMeetingEditor(lead)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Right Col: Selected Day Panel & Agenda Details */}
        <div className="space-y-4">
          {/* Day Detail Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Dia Selecionado
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {selectedDayString
                    ? new Date(selectedDayString + 'T00:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                      })
                    : 'Escolha um dia'}
                </h3>
              </div>

              <span className="text-xs font-bold font-mono px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                {selectedDayLeads.length} {selectedDayLeads.length === 1 ? 'reunião' : 'reuniões'}
              </span>
            </div>

            {/* List of meetings on selected day */}
            {selectedDayLeads.length > 0 ? (
              <div className="space-y-3">
                {selectedDayLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{lead.companyName}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {lead.contactName || 'Sem contato'} • {formatDisplayPhone(lead.phone)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>{lead.meetingTime || '10:00'}</span>
                      </div>
                    </div>

                    {lead.meetingNotes && (
                      <div className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-slate-200/60">
                        <p className="font-semibold text-slate-800 mb-0.5">Observações & Pauta:</p>
                        <p className="whitespace-pre-line leading-relaxed">{lead.meetingNotes}</p>
                      </div>
                    )}

                    {lead.meetingLink && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <Video className="w-3.5 h-3.5 shrink-0" />
                        <a
                          href={lead.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:underline font-mono text-[11px]"
                        >
                          {lead.meetingLink}
                        </a>
                      </div>
                    )}

                    {/* Quick action buttons for this meeting */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <a
                        href={buildWhatsAppMeetingLink(lead)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs transition-colors"
                        title="Enviar confirmação pelo WhatsApp"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>

                      <a
                        href={buildGoogleCalendarUrl(lead)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Adicionar ao Google Agenda"
                      >
                        <CalendarCheck className="w-3 h-3 text-blue-600" />
                        <span>Google Agenda</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleOpenMeetingEditor(lead)}
                        className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Editar pauta e horário"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenLeadModal(lead)}
                        className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Ver ficha completa do lead"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Pipeline progression buttons */}
                    <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => onMoveStage(lead.id, 'fechado')}
                        className="flex-1 py-1 px-2 bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 rounded-md font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Mover para Fechado (Venda Concluída!)"
                      >
                        <DollarSign className="w-3 h-3 text-green-600" />
                        <span>Venda Fechada!</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveStage(lead.id, 'follow_up_1')}
                        className="py-1 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Reagendar / Voltar para Follow-up"
                      >
                        <RotateCcw className="w-3 h-3 text-purple-600" />
                        <span>Follow-up</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Nenhuma reunião neste dia</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Clique em um dia com reuniões ou agende uma reunião para esta data.
                </p>
              </div>
            )}
          </div>

          {/* Quick Script Tips for Meetings Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 rounded-2xl border border-blue-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                Checklist para a Reunião (10-15 Min)
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs text-blue-900/90 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>1. Apresente o protótipo rápido:</strong> mostre a prévia personalizada no celular/tela.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>2. Foque na jornada:</strong> visitante busca no Google → acha a empresa → clica no WhatsApp.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>3. Ancoragem de R$ 997 por R$ 697:</strong> mencione a condição especial da rodada.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>4. Entrega em 72h:</strong> reforça compromisso ágil com Pix 50/50 ou cartão.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* MODAL / DRAWER: EDIT MEETING DETAILS (Date, Time, Notes, Video Link) */}
      {editingMeetingLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold">
                  <CalendarCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Agendamento de Reunião: {editingMeetingLead.companyName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingMeetingLead.contactName || 'Responsável'} • {formatDisplayPhone(editingMeetingLead.phone)} • {editingMeetingLead.city}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingMeetingLead(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMeeting} className="p-4 sm:p-6 space-y-4">
              {/* Row: Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    📅 Data da Reunião *
                  </label>
                  <input
                    type="date"
                    required
                    value={editMeetingDate}
                    onChange={(e) => setEditMeetingDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900 font-semibold"
                  />
                  {/* Quick date shortcuts */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setEditMeetingDate(new Date().toISOString().split('T')[0])}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        setEditMeetingDate(d.toISOString().split('T')[0]);
                      }}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Amanhã
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 2);
                        setEditMeetingDate(d.toISOString().split('T')[0]);
                      }}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Em 2 dias
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ⏰ Horário da Reunião *
                  </label>
                  <input
                    type="time"
                    required
                    value={editMeetingTime}
                    onChange={(e) => setEditMeetingTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900 font-semibold"
                  />
                  {/* Quick time shortcuts */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditMeetingTime(t)}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer font-mono"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Video Link / Local */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  🔗 Link da Videochamada (Google Meet / Zoom / WhatsApp)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="https://meet.google.com/xyz ou WhatsApp Video"
                    value={editMeetingLink}
                    onChange={(e) => setEditMeetingLink(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setEditMeetingLink('https://meet.google.com/new')}
                    className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Criar nova sala Google Meet"
                  >
                    + Novo Meet
                  </button>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status da Reunião
                </label>
                <select
                  value={editMeetingStatus}
                  onChange={(e) => setEditMeetingStatus(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900"
                >
                  <option value="agendada">📅 Reunião Agendada</option>
                  <option value="realizada">✅ Reunião Realizada</option>
                  <option value="remarcada">🔁 Remarcada</option>
                  <option value="cancelada">❌ Cancelada</option>
                </select>
              </div>

              {/* Meeting Notes / Pauta (O que ela tem, o que tenho que fazer, o que vai ter na reunião) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    📝 Observações da Reunião (Pauta / O que ela tem / O que fazer)
                  </label>
                </div>

                {/* Quick Snippet Templates */}
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      handleInsertTemplateNote(
                        `• O QUE O CLIENTE TEM:\n- Não tem site próprio.\n- Tem perfil no Google Maps com fotos antigas e Instagram ativo.\n\n• O QUE EU TENHO QUE FAZER:\n- Mostrar o protótipo no celular.\n- Destacar o botão de WhatsApp direto para agendamento.\n\n• O QUE VAI TER NA REUNIÃO:\n- Apresentação rápida de 10 min.\n- Oferta ancorada de R$ 997 por R$ 697.\n- Condição de Pix 50% início e 50% entrega em 72h.`
                      )
                    }
                    className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded cursor-pointer"
                  >
                    + Template Completo de Pauta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTemplateNote(`• O QUE O CLIENTE TEM: `)}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer"
                  >
                    + O que ela tem
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTemplateNote(`• O QUE EU TENHO QUE FAZER: `)}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer"
                  >
                    + O que fazer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTemplateNote(`• PROPOSTA APRESENTADA: R$ 697 (Entrega 72h) + R$ 200/mês manutenção Google.`)}
                    className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded cursor-pointer"
                  >
                    + Valores R$ 697
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={editMeetingNotes}
                  onChange={(e) => setEditMeetingNotes(e.target.value)}
                  placeholder="Escreva tudo sobre a reunião: o que o cliente tem, o que você vai demonstrar, pontos combinados, proposta comercial..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed text-slate-900"
                />
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMeetingLead(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2">
                  <a
                    href={buildWhatsAppMeetingLink({
                      ...editingMeetingLead,
                      meetingDate: editMeetingDate,
                      meetingTime: editMeetingTime,
                      meetingLink: editMeetingLink,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Confirmar no WhatsApp</span>
                  </a>

                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar Agendamento</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
