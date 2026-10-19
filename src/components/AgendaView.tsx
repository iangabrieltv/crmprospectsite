import React, { useState, useMemo, useEffect } from 'react';
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
  ListOrdered,
  Search,
  Filter,
  Phone,
  Bookmark,
  CalendarDays,
  PhoneCall,
  Bell,
  BellRing
} from 'lucide-react';

interface AgendaViewProps {
  niche: NicheCampaign;
  leads: Lead[];
  allLeads?: Lead[];
  userName: string;
  initialLeadIdToEdit?: string | null;
  onClearInitialLeadToEdit?: () => void;
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
  initialLeadIdToEdit,
  onClearInitialLeadToEdit,
  onUpdateLead,
  onMoveStage,
  onOpenLeadModal,
  onSwitchToKanban,
}) => {
  // Filter scope: active niche or all niches
  const [scopeMode, setScopeMode] = useState<'niche' | 'all'>('niche');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [activeTabSubFilter, setActiveTabSubFilter] = useState<'all' | 'pending' | 'scheduled'>('all');

  // Candidate pool
  const sourcePool = scopeMode === 'niche' ? leads : (allLeads || leads);
  
  // Leads strictly in "reuniao_marcada" stage
  const meetingLeads = useMemo(() => {
    return sourcePool.filter((l) => l.stage === 'reuniao_marcada');
  }, [sourcePool]);

  // Current calendar navigation month & year
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayString, setSelectedDayString] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Selected lead for editing/scheduling meeting details
  const [editingMeetingLead, setEditingMeetingLead] = useState<Lead | null>(null);
  const [editMeetingDate, setEditMeetingDate] = useState('');
  const [editMeetingTime, setEditMeetingTime] = useState('');
  const [editMeetingNotes, setEditMeetingNotes] = useState('');
  const [editMeetingLink, setEditMeetingLink] = useState('');
  const [editMeetingStatus, setEditMeetingStatus] = useState<'agendada' | 'realizada' | 'remarcada' | 'cancelada'>('agendada');

  // Search filter for pipeline contacts in Agenda
  const [searchTerm, setSearchTerm] = useState('');

  // Quick picker to move another lead into "reuniao_marcada"
  const [isQuickPickerOpen, setIsQuickPickerOpen] = useState(false);
  const [quickSearchTerm, setQuickSearchTerm] = useState('');

  // Section toggle: 'all' | 'callbacks' | 'meetings'
  const [agendaSection, setAgendaSection] = useState<'all' | 'callbacks' | 'meetings'>('all');

  // Callback modal & quick picker state (Ligar Mais Tarde / Entrar em Contato Outra Hora)
  const [editingCallbackLead, setEditingCallbackLead] = useState<Lead | null>(null);
  const [editCallbackDate, setEditCallbackDate] = useState('');
  const [editCallbackTime, setEditCallbackTime] = useState('15:30');
  const [editCallbackNotes, setEditCallbackNotes] = useState('');
  const [editCallbackStatus, setEditCallbackStatus] = useState<'pendente' | 'realizado' | 'cancelado'>('pendente');
  const [isCallbackPickerOpen, setIsCallbackPickerOpen] = useState(false);
  const [callbackPickerSearch, setCallbackPickerSearch] = useState('');
  const [callbackFilterTab, setCallbackFilterTab] = useState<'all' | 'today' | 'overdue' | 'done'>('all');

  const todayDateString = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Leads that requested a callback (pediram para entrar em contato outra hora)
  const callbackLeads = useMemo(() => {
    return sourcePool.filter((l) => Boolean(l.callbackDate));
  }, [sourcePool]);

  // Callbacks due today
  const todayPendingCallbacks = useMemo(() => {
    return callbackLeads.filter(
      (l) => l.callbackDate === todayDateString && l.callbackStatus !== 'realizado' && l.callbackStatus !== 'cancelado'
    );
  }, [callbackLeads, todayDateString]);

  // Overdue callbacks
  const overduePendingCallbacks = useMemo(() => {
    return callbackLeads.filter(
      (l) => (l.callbackDate || '') < todayDateString && l.callbackStatus !== 'realizado' && l.callbackStatus !== 'cancelado'
    );
  }, [callbackLeads, todayDateString]);

  // Completed callbacks
  const completedCallbacks = useMemo(() => {
    return callbackLeads.filter((l) => l.callbackStatus === 'realizado');
  }, [callbackLeads]);

  // Group callbacks by date
  const callbacksByDate = useMemo(() => {
    const map = new Map<string, Lead[]>();
    callbackLeads.forEach((lead) => {
      if (lead.callbackDate) {
        const existing = map.get(lead.callbackDate) || [];
        existing.push(lead);
        map.set(lead.callbackDate, existing);
      }
    });
    return map;
  }, [callbackLeads]);

  const handleOpenCallbackEditor = (lead: Lead) => {
    setEditingCallbackLead(lead);
    setEditCallbackDate(lead.callbackDate || selectedDayString || todayDateString);
    setEditCallbackTime(lead.callbackTime || '15:30');
    setEditCallbackNotes(lead.callbackNotes || '');
    setEditCallbackStatus(lead.callbackStatus || 'pendente');
  };

  const handleSaveCallback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCallbackLead) return;

    const formattedDate = editCallbackDate
      ? new Date(editCallbackDate + 'T00:00:00').toLocaleDateString('pt-BR')
      : 'Hoje';

    const updated: Lead = {
      ...editingCallbackLead,
      callbackDate: editCallbackDate || undefined,
      callbackTime: editCallbackTime || undefined,
      callbackNotes: editCallbackNotes.trim() || undefined,
      callbackStatus: editCallbackStatus,
      lastContactDate: new Date().toISOString(),
      notes: [
        {
          id: 'note-cb-' + Date.now(),
          date: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          text: `Agendado retorno (pediu para ligar mais tarde): ${formattedDate} às ${editCallbackTime || 'horário comercial'}.${editCallbackNotes ? ` Motivo: "${editCallbackNotes}"` : ''}`,
          author: userName,
        },
        ...editingCallbackLead.notes,
      ],
    };

    onUpdateLead(updated);
    if (editCallbackDate) {
      setSelectedDayString(editCallbackDate);
    }
    setEditingCallbackLead(null);
  };

  const handleMarkCallbackDone = (lead: Lead) => {
    const updated: Lead = {
      ...lead,
      callbackStatus: 'realizado',
      lastContactDate: new Date().toISOString(),
      notes: [
        {
          id: 'note-cb-done-' + Date.now(),
          date: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          text: `✅ Retorno realizado com sucesso: ligação/contato concluído com o cliente.`,
          author: userName,
        },
        ...lead.notes,
      ],
    };
    onUpdateLead(updated);
  };

  const handleRemoveCallback = (lead: Lead) => {
    const updated: Lead = {
      ...lead,
      callbackDate: undefined,
      callbackTime: undefined,
      callbackNotes: undefined,
      callbackStatus: undefined,
    };
    onUpdateLead(updated);
    if (editingCallbackLead?.id === lead.id) {
      setEditingCallbackLead(null);
    }
  };

  const handleSelectLeadForCallback = (lead: Lead) => {
    setIsCallbackPickerOpen(false);
    handleOpenCallbackEditor(lead);
  };

  // Open meeting editor helper
  const handleOpenMeetingEditor = (lead: Lead) => {
    setEditingMeetingLead(lead);
    setEditMeetingDate(lead.meetingDate || selectedDayString || new Date().toISOString().split('T')[0]);
    setEditMeetingTime(lead.meetingTime || '10:00');
    setEditMeetingNotes(lead.meetingNotes || '');
    setEditMeetingLink(lead.meetingLink || '');
    setEditMeetingStatus(lead.meetingStatus || 'agendada');
  };

  // If initialLeadIdToEdit is passed from outside, open it immediately
  useEffect(() => {
    if (initialLeadIdToEdit) {
      const found = sourcePool.find((l) => l.id === initialLeadIdToEdit);
      if (found) {
        handleOpenMeetingEditor(found);
      }
      onClearInitialLeadToEdit?.();
    }
  }, [initialLeadIdToEdit, sourcePool]);

  // Save meeting details
  const handleSaveMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeetingLead) return;

    const formattedDate = editMeetingDate
      ? new Date(editMeetingDate + 'T00:00:00').toLocaleDateString('pt-BR')
      : 'data a definir';

    const updated: Lead = {
      ...editingMeetingLead,
      stage: 'reuniao_marcada',
      meetingDate: editMeetingDate || undefined,
      meetingTime: editMeetingTime || undefined,
      meetingNotes: editMeetingNotes.trim() || undefined,
      meetingLink: editMeetingLink.trim() || undefined,
      meetingStatus: editMeetingStatus,
      lastContactDate: new Date().toISOString(),
      notes: [
        {
          id: 'note-agenda-' + Date.now(),
          date: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          text: `Agenda de Reunião Marcada: ${formattedDate}${editMeetingTime ? ` às ${editMeetingTime}` : ''}.${editMeetingNotes ? ` Pauta/Estudo de Caso: "${editMeetingNotes.slice(0, 120)}..."` : ''}`,
          author: userName,
        },
        ...editingMeetingLead.notes,
      ],
    };

    onUpdateLead(updated);
    if (editMeetingDate) {
      setSelectedDayString(editMeetingDate);
    }
    setEditingMeetingLead(null);
  };

  // Move a lead to "reuniao_marcada" from the quick picker
  const handleSelectLeadForMeeting = (lead: Lead) => {
    const updatedLead: Lead = {
      ...lead,
      stage: 'reuniao_marcada',
    };
    onMoveStage(lead.id, 'reuniao_marcada');
    setIsQuickPickerOpen(false);
    handleOpenMeetingEditor(updatedLead);
  };

  // Insert template text into meeting notes for case study and client profile
  const handleInsertTemplateNote = (snippet: string) => {
    setEditMeetingNotes((prev) => {
      const cleanPrev = prev.trim();
      return cleanPrev ? `${cleanPrev}\n\n${snippet}` : snippet;
    });
  };

  // Complete case study and client profile template
  const applyCompleteCaseStudyTemplate = () => {
    const comp = editingMeetingLead?.companyName || 'Empresa';
    const cont = editingMeetingLead?.contactName || 'Responsável';
    const cid = editingMeetingLead?.city || niche.city;
    const cat = editingMeetingLead?.category || niche.segment;

    const template = `• PERFIL DO CLIENTE & NEGÓCIO:
- Responsável / Contato: ${cont}
- Empresa: ${comp} (${cat}) - ${cid}
- Situação atual: Não possui site próprio ativo / depende do Google Maps ou Instagram.
- Dúvidas e objeções da ligação: Perguntou se o site funciona bem no celular e se o cliente consegue chamar direto no WhatsApp.

• ESTUDO DE CASO & OPORTUNIDADE:
- Oportunidade: Clientes buscam por "${cat}" no Google em ${cid}, encontram a empresa com boa avaliação, mas perdem a chance de agendamento rápido por falta de site moderno.
- O que vou demonstrar no protótipo: Demonstração responsiva no celular, cardápio/serviços detalhados, botão de agendamento imediato no WhatsApp e avaliações 5 estrelas em destaque.

• PAUTA DA REUNIÃO (10 A 15 MIN):
1. Apresentar a demonstração exclusiva no celular (impacto visual imediato).
2. Explicar como o site transforma buscas no Google em conversas reais no WhatsApp.
3. Apresentar proposta comercial ancorada: de R$ 997 por R$ 697 (condição da rodada).
4. Condição facilitada: Pix 50% para início e 50% na entrega em até 72 horas.`;

    setEditMeetingNotes(template);
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

    const title = encodeURIComponent(`Reunião de Demonstração: ${lead.companyName} | ${userName}`);
    const details = encodeURIComponent(
      `Reunião comercial e apresentação do projeto com ${lead.companyName}.\nContato: ${lead.contactName || 'Responsável'}\nTelefone: ${formatDisplayPhone(lead.phone)}\n\nObservações / Estudo de Caso:\n${lead.meetingNotes || 'Apresentação da demonstração do site e proposta de implementação.'}\n\nLink da reunião: ${lead.meetingLink || 'Via WhatsApp / Meet'}`
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

  // Scheduled leads (in reuniao_marcada with meetingDate)
  const scheduledLeads = useMemo(() => {
    return meetingLeads.filter((l) => Boolean(l.meetingDate));
  }, [meetingLeads]);

  // Leads for the selected day
  const selectedDayLeads = useMemo(() => {
    if (!selectedDayString) return [];
    return leadsByDate.get(selectedDayString) || [];
  }, [selectedDayString, leadsByDate]);

  // Callbacks for the selected day
  const selectedDayCallbacks = useMemo(() => {
    if (!selectedDayString) return [];
    return callbacksByDate.get(selectedDayString) || [];
  }, [selectedDayString, callbacksByDate]);

  // Filtered callbacks list for dedicated callbacks view
  const filteredCallbackList = useMemo(() => {
    return callbackLeads.filter((l) => {
      if (callbackFilterTab === 'today') {
        if (l.callbackDate !== todayDateString || l.callbackStatus === 'realizado') return false;
      } else if (callbackFilterTab === 'overdue') {
        if ((l.callbackDate || '') >= todayDateString || l.callbackStatus === 'realizado') return false;
      } else if (callbackFilterTab === 'done') {
        if (l.callbackStatus !== 'realizado') return false;
      }
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        l.companyName.toLowerCase().includes(q) ||
        (l.contactName && l.contactName.toLowerCase().includes(q)) ||
        l.phone.includes(q) ||
        (l.callbackNotes && l.callbackNotes.toLowerCase().includes(q))
      );
    });
  }, [callbackLeads, callbackFilterTab, todayDateString, searchTerm]);

  // Available leads in source pool to schedule callback
  const filteredCallbackPickers = useMemo(() => {
    return sourcePool.filter((l) => {
      if (!callbackPickerSearch.trim()) return true;
      const q = callbackPickerSearch.toLowerCase();
      return (
        l.companyName.toLowerCase().includes(q) ||
        (l.contactName && l.contactName.toLowerCase().includes(q)) ||
        l.phone.includes(q) ||
        (l.city && l.city.toLowerCase().includes(q))
      );
    });
  }, [sourcePool, callbackPickerSearch]);

  // Filtered contacts list in the pipeline drawer
  const filteredMeetingDrawerLeads = useMemo(() => {
    return meetingLeads.filter((l) => {
      if (activeTabSubFilter === 'pending' && l.meetingDate) return false;
      if (activeTabSubFilter === 'scheduled' && !l.meetingDate) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        l.companyName.toLowerCase().includes(q) ||
        (l.contactName && l.contactName.toLowerCase().includes(q)) ||
        l.phone.includes(q) ||
        (l.city && l.city.toLowerCase().includes(q))
      );
    });
  }, [meetingLeads, activeTabSubFilter, searchTerm]);

  // Available leads in pipeline to pick
  const availableLeadsToSchedule = sourcePool.filter((l) => l.stage !== 'reuniao_marcada');
  const filteredQuickPickers = availableLeadsToSchedule.filter((l) => {
    if (!quickSearchTerm.trim()) return true;
    const q = quickSearchTerm.toLowerCase();
    return (
      l.companyName.toLowerCase().includes(q) ||
      (l.contactName && l.contactName.toLowerCase().includes(q)) ||
      l.phone.includes(q) ||
      (l.city && l.city.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-w-0 w-full p-3 sm:p-6 overflow-y-auto">
      {/* Top Banner explaining the meeting workflow */}
      <div className="max-w-7xl mx-auto w-full mb-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Pipeline & Ligações → Agenda
              </span>
              <span className="text-xs text-slate-300">• Multi-nicho sincronizado</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Agenda de Reuniões & Retornos
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Acompanhe suas <strong>Reuniões Marcadas</strong> e receba alertas automáticos para <strong>ligar mais tarde</strong> para os contatos que pediram retorno em outro horário.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setIsCallbackPickerOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>+ Ligar Mais Tarde (Retorno)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsQuickPickerOpen(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Marcar Reunião</span>
            </button>

            <button
              type="button"
              onClick={onSwitchToKanban}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Ver Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* PROMINENT INFORMATIVE ALERT BANNER: Ligar mais tarde hoje */}
      {(todayPendingCallbacks.length > 0 || overduePendingCallbacks.length > 0) && (
        <div className="max-w-7xl mx-auto w-full mb-5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/90 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-bounce">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-amber-950">
                    {todayPendingCallbacks.length > 0
                      ? `🔔 AVISO DA AGENDA: Você tem ${todayPendingCallbacks.length} contato(s) para entrar em contato mais tarde hoje!`
                      : '🔔 AVISO DA AGENDA: Contatos pendentes de retorno!'}
                  </h3>
                  {todayPendingCallbacks.length > 0 && (
                    <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                      Hoje ({todayPendingCallbacks.length})
                    </span>
                  )}
                  {overduePendingCallbacks.length > 0 && (
                    <span className="text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full">
                      {overduePendingCallbacks.length} atrasado(s)
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-900 mt-0.5">
                  Estes clientes pediram para falar outra hora. Clique em <strong>Ligar / WhatsApp</strong> para dar sequência no fechamento:
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCallbackPickerOpen(true)}
              className="self-start sm:self-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendar Novo Retorno</span>
            </button>
          </div>

          {/* Cards dos retornos de hoje */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...todayPendingCallbacks, ...overduePendingCallbacks].map((lead) => {
              const isToday = lead.callbackDate === todayDateString;
              return (
                <div
                  key={lead.id}
                  className={`bg-white rounded-xl p-3.5 border shadow-2xs space-y-2.5 transition-all hover:shadow-md ${
                    isToday ? 'border-amber-300 ring-1 ring-amber-200' : 'border-rose-200 bg-rose-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{lead.companyName}</h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {lead.contactName || 'Responsável'} • {formatDisplayPhone(lead.phone)}
                      </p>
                    </div>

                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 ${
                        isToday
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{lead.callbackTime || 'Horário'}</span>
                    </span>
                  </div>

                  {lead.callbackNotes ? (
                    <div className="text-[11px] text-amber-950 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60 font-medium line-clamp-2">
                      💬 "{lead.callbackNotes}"
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      Cliente pediu para ligar mais tarde.
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">
                    <a
                      href={buildWhatsAppLink(
                        lead.phone,
                        `Olá ${lead.contactName || ''}! Conforme combinamos, estou retornando o contato agora com relação ao projeto da ${lead.companyName}. Podemos conversar um instante?`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Ligar / WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleMarkCallbackDone(lead)}
                      className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      title="Marcar como Falado (Concluído)"
                    >
                      <Check className="w-4 h-4 text-emerald-600" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCallbackEditor(lead)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs cursor-pointer transition-colors"
                      title="Remarcar horário"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metrics & Scope Control Bar */}
      <div className="max-w-7xl mx-auto w-full mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Quick Metrics */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600 font-medium">Reuniões Marcadas:</span>
            <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              {meetingLeads.length}
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs text-xs">
            <PhoneCall className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-slate-600 font-medium">Ligar Mais Tarde:</span>
            <span className="font-bold font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
              {callbackLeads.length}
            </span>
            {todayPendingCallbacks.length > 0 && (
              <span className="font-bold text-[10px] text-amber-900 bg-amber-200 px-1.5 py-0.2 rounded-full animate-pulse">
                {todayPendingCallbacks.length} hoje!
              </span>
            )}
          </div>

          {unscheduledLeads.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl shadow-2xs text-xs text-amber-900">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-medium">Reuniões sem Horário:</span>
              <span className="font-bold font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                {unscheduledLeads.length}
              </span>
            </div>
          )}
        </div>

        {/* Scope Selector, Section Switcher & Mode switch */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Section Switcher Tabs: Tudo / Reuniões / Ligar mais tarde */}
          <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setAgendaSection('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                agendaSection === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visão Completa
            </button>
            <button
              type="button"
              onClick={() => setAgendaSection('meetings')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                agendaSection === 'meetings' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="w-3 h-3 text-emerald-400" />
              <span>Reuniões ({meetingLeads.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAgendaSection('callbacks')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                agendaSection === 'callbacks' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PhoneCall className="w-3 h-3 text-amber-400" />
              <span>Ligar Mais Tarde ({callbackLeads.length})</span>
            </button>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setScopeMode('niche')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                scopeMode === 'niche' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {niche.emoji} {niche.name}
            </button>
            <button
              type="button"
              onClick={() => setScopeMode('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                scopeMode === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos os Nichos
            </button>
          </div>

          {/* Calendar vs List Mode */}
          <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                viewMode === 'calendar' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendário</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Pauta / Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: Contatos da Pipeline em "Reunião Marcada" */}
      <div className="max-w-7xl mx-auto w-full mb-6 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">🤝</span>
              <h2 className="text-sm font-bold text-slate-900">
                Contatos em Reunião Marcada vindos da Pipeline
              </h2>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {meetingLeads.length} contatos
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Estes são os contatos que você colocou na etapa <strong>Reunião Marcada</strong> após a ligação. Clique para definir o horário ou preencher o estudo de caso.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveTabSubFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer transition-colors ${
                  activeTabSubFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({meetingLeads.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTabSubFilter('pending')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer transition-colors ${
                  activeTabSubFilter === 'pending' ? 'bg-amber-100 text-amber-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sem Horário ({unscheduledLeads.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTabSubFilter('scheduled')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer transition-colors ${
                  activeTabSubFilter === 'scheduled' ? 'bg-emerald-100 text-emerald-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Agendados ({scheduledLeads.length})
              </button>
            </div>

            {/* Search filter input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar contato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 sm:w-48"
              />
            </div>
          </div>
        </div>

        {/* Grid of meeting cards */}
        {filteredMeetingDrawerLeads.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-3">
            {filteredMeetingDrawerLeads.map((lead) => {
              const isScheduled = Boolean(lead.meetingDate);
              const dateFmt = lead.meetingDate
                ? new Date(lead.meetingDate + 'T00:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })
                : null;

              return (
                <div
                  key={lead.id}
                  className={`p-3.5 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-3 ${
                    isScheduled
                      ? 'bg-slate-50/70 border-slate-200/90 hover:border-blue-300 hover:bg-blue-50/20'
                      : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{lead.companyName}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {lead.contactName || 'Responsável'} • {formatDisplayPhone(lead.phone)}
                        </p>
                      </div>

                      {isScheduled ? (
                        <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300/80 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                          <CalendarIcon className="w-3 h-3 text-emerald-600" />
                          <span>{dateFmt} às {lead.meetingTime || '10:00'}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>Sem horário</span>
                        </span>
                      )}
                    </div>

                    {/* Case study & notes preview */}
                    {lead.meetingNotes ? (
                      <div className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-slate-200/70 line-clamp-2">
                        <span className="font-semibold text-slate-900">Estudo de caso / Pauta: </span>
                        <span>{lead.meetingNotes}</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        Nenhuma observação de estudo de caso cadastrada ainda.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => handleOpenMeetingEditor(lead)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                        isScheduled
                          ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isScheduled ? 'Editar Horário & Pauta' : 'Definir Dia e Horário'}</span>
                    </button>

                    <a
                      href={buildWhatsAppMeetingLink(lead)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                      title="Chamar para confirmar no WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>

                    <button
                      type="button"
                      onClick={() => onOpenLeadModal(lead)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Abrir ficha completa"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 mt-3">
            <CalendarCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">
              {searchTerm ? 'Nenhum contato encontrado com este termo' : 'Nenhum contato em "Reunião Marcada" nesta visualização'}
            </p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Quando você ligar para uma empresa e combinar a apresentação, arraste o contato para a coluna <strong>Reunião Marcada</strong> no Pipeline ou use o botão abaixo para agendar agora.
            </p>
            <button
              type="button"
              onClick={() => setIsQuickPickerOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendar Contato da Pipeline Agora</span>
            </button>
          </div>
        )}
      </div>

      {/* MAIN VIEW: CALENDAR OR LIST */}
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
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-md transition-colors cursor-pointer"
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
                <div key={`empty-${i}`} className="min-h-[85px] sm:min-h-[100px] bg-slate-50/40 rounded-xl border border-transparent p-1 text-slate-300 pointer-events-none" />
              ))}

              {/* Day cells */}
              {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayLeads = leadsByDate.get(dateKey) || [];
                const dayCallbacks = callbacksByDate.get(dateKey) || [];
                const isToday = new Date().toISOString().split('T')[0] === dateKey;
                const isSelected = selectedDayString === dateKey;

                return (
                  <div
                    key={dateKey}
                    onClick={() => setSelectedDayString(dateKey)}
                    className={`min-h-[85px] sm:min-h-[105px] rounded-xl border p-1.5 flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-400 shadow-2xs'
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
                      <div className="flex items-center gap-1">
                        {dayLeads.length > 0 && (
                          <span
                            className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/80"
                            title={`${dayLeads.length} Reunião(ões)`}
                          >
                            {dayLeads.length}
                          </span>
                        )}
                        {dayCallbacks.length > 0 && (
                          <span
                            className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5"
                            title={`${dayCallbacks.length} Retorno(s) / Ligar mais tarde`}
                          >
                            <PhoneCall className="w-2.5 h-2.5" />
                            <span>{dayCallbacks.length}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meetings & Callbacks chips inside day cell */}
                    <div className="space-y-1 mt-1 overflow-hidden">
                      {dayLeads.slice(0, 2).map((l) => (
                        <div
                          key={l.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMeetingEditor(l);
                          }}
                          className="px-1.5 py-0.5 bg-emerald-100/90 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded text-[10px] font-semibold truncate flex items-center gap-1 transition-colors"
                          title={`Reunião: ${l.meetingTime || ''} - ${l.companyName}: ${l.meetingNotes || 'Clique para ver estudo de caso e pauta'}`}
                        >
                          <span className="font-mono text-[9px] text-emerald-700 shrink-0">
                            {l.meetingTime || '10:00'}
                          </span>
                          <span className="truncate">{l.companyName}</span>
                        </div>
                      ))}

                      {dayCallbacks.slice(0, 2).map((l) => (
                        <div
                          key={'cb-cell-' + l.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCallbackEditor(l);
                          }}
                          className={`px-1.5 py-0.5 border rounded text-[10px] font-semibold truncate flex items-center gap-1 transition-colors ${
                            l.callbackStatus === 'realizado'
                              ? 'bg-slate-100 text-slate-500 border-slate-200 line-through'
                              : 'bg-amber-100/90 hover:bg-amber-200 text-amber-950 border-amber-300'
                          }`}
                          title={`Retorno: ${l.callbackTime || ''} - ${l.companyName}: ${l.callbackNotes || 'Ligar mais tarde'}`}
                        >
                          <PhoneCall className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                          <span className="font-mono text-[9px] text-amber-800 shrink-0">
                            {l.callbackTime || '15:30'}
                          </span>
                          <span className="truncate">{l.companyName}</span>
                        </div>
                      ))}

                      {dayLeads.length + dayCallbacks.length > 2 && (
                        <span className="text-[9px] font-bold text-slate-500 px-1 block">
                          +{dayLeads.length + dayCallbacks.length - 2} mais
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
                Lista Cronológica de Reuniões Marcadas ({meetingLeads.length})
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
                    <div className="space-y-1 max-w-xl">
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
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 line-clamp-3">
                          <strong>Estudo de Caso & Pauta:</strong> {lead.meetingNotes}
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
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          {lead.companyName}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {lead.contactName || 'Responsável'} • {formatDisplayPhone(lead.phone)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>{lead.meetingTime || '10:00'}</span>
                      </div>
                    </div>

                    {/* Full Meeting Notes (Case Study and Profile) */}
                    {lead.meetingNotes && (
                      <div className="text-[11px] text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/70">
                        <p className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                          <Bookmark className="w-3 h-3 text-blue-600" />
                          <span>Estudo de Caso & Perfil do Cliente:</span>
                        </p>
                        <p className="whitespace-pre-line leading-relaxed font-sans">{lead.meetingNotes}</p>
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

                    {/* Action buttons for this meeting */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <a
                        href={buildWhatsAppMeetingLink(lead)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs transition-colors"
                        title="Enviar mensagem de confirmação no WhatsApp"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Confirmar WhatsApp</span>
                      </a>

                      <a
                        href={buildGoogleCalendarUrl(lead)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Adicionar evento no Google Agenda"
                      >
                        <CalendarCheck className="w-3 h-3 text-blue-600" />
                        <span>Google Agenda</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleOpenMeetingEditor(lead)}
                        className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Editar data, hora e estudo de caso"
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
                        className="flex-1 py-1.5 px-2 bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Mover para Fechado (Venda Concluída!)"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-green-600" />
                        <span>Venda Fechada!</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveStage(lead.id, 'follow_up_1')}
                        className="py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
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
                <p className="text-xs font-bold text-slate-700">Nenhuma reunião neste dia</p>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-4">
                  Deseja marcar uma reunião para esta data?
                </p>
                {unscheduledLeads.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Escolha um contato pendente para hoje:
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {unscheduledLeads.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setEditingMeetingLead(l);
                            setEditMeetingDate(selectedDayString);
                            setEditMeetingTime('10:00');
                            setEditMeetingNotes(l.meetingNotes || '');
                            setEditMeetingLink(l.meetingLink || '');
                            setEditMeetingStatus('agendada');
                          }}
                          className="w-full text-left p-2 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span className="font-semibold text-slate-800 truncate">{l.companyName}</span>
                          <span className="text-[10px] font-bold text-emerald-700 shrink-0">+ Agendar</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsQuickPickerOpen(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    + Agendar Lead da Pipeline
                  </button>
                )}
              </div>
            )}

            {/* Contatos para Ligar Mais Tarde no Dia Selecionado */}
            <div className="pt-3 border-t border-slate-100 mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Ligar Mais Tarde neste Dia ({selectedDayCallbacks.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditCallbackDate(selectedDayString);
                    setIsCallbackPickerOpen(true);
                  }}
                  className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded cursor-pointer border border-amber-200 transition-colors"
                >
                  + Agendar Retorno
                </button>
              </div>

              {selectedDayCallbacks.length > 0 ? (
                <div className="space-y-2">
                  {selectedDayCallbacks.map((lead) => (
                    <div
                      key={'sel-cb-' + lead.id}
                      className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{lead.companyName}</h4>
                          <p className="text-[11px] text-slate-600 truncate">
                            {lead.contactName || 'Responsável'} • {formatDisplayPhone(lead.phone)}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 shrink-0">
                          ⏰ {lead.callbackTime || '15:30'}
                        </span>
                      </div>

                      {lead.callbackNotes && (
                        <p className="text-[11px] text-amber-950 bg-white p-2 rounded-lg border border-amber-200">
                          💬 "{lead.callbackNotes}"
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 pt-1">
                        <a
                          href={buildWhatsAppLink(
                            lead.phone,
                            `Olá ${lead.contactName || ''}! Conforme combinamos, estou retornando o contato agora com relação ao projeto da ${lead.companyName}. Podemos falar um instante?`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>Ligar Agora</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleMarkCallbackDone(lead)}
                          className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            lead.callbackStatus === 'realizado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200'
                          }`}
                          title={lead.callbackStatus === 'realizado' ? 'Retorno Concluído' : 'Marcar como Concluído'}
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenCallbackEditor(lead)}
                          className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs cursor-pointer"
                          title="Editar horário do retorno"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic py-1">
                  Nenhum retorno agendado para este dia.
                </p>
              )}
            </div>
          </div>

          {/* Quick Checklist for Sales Calls & Demo Meetings */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 rounded-2xl border border-blue-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                Roteiro da Reunião (10-15 Min)
              </h3>
            </div>
            <ul className="space-y-2 text-xs text-blue-900/90 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>1. Abra no celular:</strong> Mostre a demonstração personalizada com o nome e cores da empresa.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>2. Destaque o agendamento:</strong> Mostre como o visitante clica e já cai no WhatsApp com os serviços escolhidos.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>3. Ancoragem de R$ 997 por R$ 697:</strong> Apresente como condição exclusiva desta rodada de prospecção.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>4. Entrega em 72h:</strong> Feche com Pix 50% para início e 50% na entrega.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* MODAL: EDIT MEETING DETAILS & CASE STUDY */}
      {editingMeetingLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <CalendarCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
                    Reunião Marcada: {editingMeetingLead.companyName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingMeetingLead.contactName || 'Responsável'} • {formatDisplayPhone(editingMeetingLead.phone)} • {editingMeetingLead.city || niche.city}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingMeetingLead(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-xs font-bold"
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
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900 font-bold"
                  />
                  {/* Quick date shortcuts */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setEditMeetingDate(new Date().toISOString().split('T')[0])}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer font-medium"
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
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer font-medium"
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
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer font-medium"
                    >
                      Em 2 dias
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(15);
                        setEditMeetingDate(d.toISOString().split('T')[0]);
                      }}
                      className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-0.5 rounded cursor-pointer font-bold"
                    >
                      Dia 15
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
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900 font-bold"
                  />
                  {/* Quick time shortcuts */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditMeetingTime(t)}
                        className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-mono ${
                          editMeetingTime === t
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Video Link */}
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
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
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

              {/* Meeting Notes / Case Study & Profile */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-blue-600" />
                    <span>Observações da Reunião (Estudo de Caso & Perfil do Cliente)</span>
                  </label>
                </div>

                {/* Quick Snippet Templates */}
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <button
                    type="button"
                    onClick={applyCompleteCaseStudyTemplate}
                    className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold px-2.5 py-1 rounded-md cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-blue-700" />
                    <span>+ Template Estudo de Caso & Perfil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTemplateNote(`• O QUE O CLIENTE TEM:\n- Não tem site próprio.\n- Perfil no Google com boa avaliação e fotos no Instagram.`)}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md cursor-pointer font-medium"
                  >
                    + O que ele tem
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTemplateNote(`• O QUE VOU FAZER NA REUNIÃO:\n- Demonstrar o site interativo no celular.\n- Destacar o botão de agendamento rápido no WhatsApp.`)}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md cursor-pointer font-medium"
                  >
                    + O que vou fazer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTemplateNote(`• PROPOSTA: R$ 697 (ancoragem de R$ 997) + R$ 200/mês suporte Google. Pix 50/50 entrega em 72h.`)}
                    className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2 py-1 rounded-md cursor-pointer"
                  >
                    + Valores R$ 697
                  </button>
                </div>

                <textarea
                  rows={7}
                  value={editMeetingNotes}
                  onChange={(e) => setEditMeetingNotes(e.target.value)}
                  placeholder="Escreva tudo sobre o cliente e a reunião:
- Quem é o cliente e o que ele faz
- O que ele tem hoje (Google Maps, Instagram, site antigo)
- As dúvidas levantadas na ligação
- O que você vai demonstrar no protótipo
- Pauta e proposta de valores para se organizar..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed text-slate-900"
                />
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
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
                    <span>Confirmar WhatsApp</span>
                  </a>

                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar Reunião na Agenda</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK PICKER TO SELECT ANY LEAD FROM PIPELINE FOR MEETING */}
      {isQuickPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Marcar Reunião para Contato da Pipeline
                </h3>
                <p className="text-xs text-slate-500">
                  Escolha qualquer contato do funil para mover para "Reunião Marcada" e agendar data e pauta:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome da empresa, contato ou telefone..."
                value={quickSearchTerm}
                onChange={(e) => setQuickSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {filteredQuickPickers.slice(0, 15).map((l) => (
                <div
                  key={l.id}
                  onClick={() => handleSelectLeadForMeeting(l)}
                  className="p-2.5 rounded-xl hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">
                      {l.companyName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {l.contactName || 'Sem contato'} • {formatDisplayPhone(l.phone)} • {l.city || niche.city}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0 transition-colors">
                    + Agendar Reunião
                  </span>
                </div>
              ))}
              {filteredQuickPickers.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">
                  Nenhum contato encontrado na pipeline com esse nome.
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsQuickPickerOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CALLBACK DETAILS (Ligar Mais Tarde) */}
      {editingCallbackLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <PhoneCall className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-[280px]">
                    Ligar Mais Tarde: {editingCallbackLead.companyName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingCallbackLead.contactName || 'Responsável'} • {formatDisplayPhone(editingCallbackLead.phone)} • {editingCallbackLead.city || niche.city}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingCallbackLead(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCallback} className="p-4 sm:p-6 space-y-4">
              {/* Quick time shortcuts */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                  Atalhos de Horário Rápido:
                </label>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setEditCallbackDate(todayDateString);
                      const now = new Date();
                      const nextH = (now.getHours() + 1) % 24;
                      setEditCallbackTime(`${String(nextH).padStart(2, '0')}:00`);
                    }}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold cursor-pointer"
                  >
                    Hoje +1 hora
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditCallbackDate(todayDateString);
                      setEditCallbackTime('15:00');
                    }}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold cursor-pointer"
                  >
                    Hoje às 15:00
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditCallbackDate(todayDateString);
                      setEditCallbackTime('17:00');
                    }}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold cursor-pointer"
                  >
                    Hoje às 17:00
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tom = new Date();
                      tom.setDate(tom.getDate() + 1);
                      setEditCallbackDate(tom.toISOString().split('T')[0]);
                      setEditCallbackTime('09:30');
                    }}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold cursor-pointer"
                  >
                    Amanhã às 09:30
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data do Retorno *
                  </label>
                  <input
                    type="date"
                    required
                    value={editCallbackDate}
                    onChange={(e) => setEditCallbackDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Horário Previsto *
                  </label>
                  <input
                    type="time"
                    required
                    value={editCallbackTime}
                    onChange={(e) => setEditCallbackTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo / Observação do Cliente *
                </label>
                <textarea
                  rows={2}
                  value={editCallbackNotes}
                  onChange={(e) => setEditCallbackNotes(e.target.value)}
                  placeholder="Ex: Está em atendimento agora. Pediu para ligar às 16h pois o médico já estará livre."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status do Retorno
                </label>
                <select
                  value={editCallbackStatus}
                  onChange={(e) => setEditCallbackStatus(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                >
                  <option value="pendente">⏳ Pendente (Aguardando horário)</option>
                  <option value="realizado">✅ Realizado (Contato efetuado)</option>
                  <option value="cancelado">❌ Cancelado</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleRemoveCallback(editingCallbackLead)}
                  className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Excluir Retorno
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCallbackLead(null)}
                    className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Salvar Retorno</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PICK ANY LEAD FROM CAMPAIGN TO SCHEDULE CALLBACK */}
      {isCallbackPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Agendar Retorno (Ligar Mais Tarde)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecione o contato que pediu para você ligar em outro horário:
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCallbackPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por empresa, responsável ou telefone..."
                value={callbackPickerSearch}
                onChange={(e) => setCallbackPickerSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {filteredCallbackPickers.slice(0, 15).map((l) => (
                <div
                  key={l.id}
                  onClick={() => handleSelectLeadForCallback(l)}
                  className="p-2.5 rounded-xl hover:bg-amber-50/70 border border-slate-200 hover:border-amber-300 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-amber-700 truncate">
                      {l.companyName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {l.contactName || 'Sem contato'} • {formatDisplayPhone(l.phone)} • {l.city || niche.city}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 group-hover:bg-amber-600 group-hover:text-white px-2.5 py-1 rounded-lg border border-amber-300 shrink-0 transition-colors flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Ligar Mais Tarde</span>
                  </span>
                </div>
              ))}
              {filteredCallbackPickers.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">
                  Nenhum contato encontrado com esse nome.
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsCallbackPickerOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
