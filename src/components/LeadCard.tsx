import React, { useState } from 'react';
import { Lead, FunnelStageId, FUNNEL_STAGES, NicheCampaign } from '../types/crm';
import {
  isInactiveOver48h,
  buildWhatsAppLink,
  getContactGreetingMessage,
  getStageWhatsAppMessage,
  interpolateScript,
  formatDisplayPhone,
  formatFriendlyTime
} from '../utils/phone';
import {
  MessageCircle,
  Clock,
  Star,
  MapPin,
  ExternalLink,
  MoreVertical,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Copy,
  Check,
  Send,
  Calendar,
  PhoneCall
} from 'lucide-react';
import { DEFAULT_SCRIPTS } from '../utils/initialData';

interface LeadCardProps {
  lead: Lead;
  niche: NicheCampaign;
  userName: string;
  onClick: () => void;
  onMoveStage: (leadId: string, targetStage: FunnelStageId) => void;
  onFastWhatsAppContacted: (lead: Lead) => void;
  onSelectCity?: (city: string) => void;
  onOpenAgenda?: (leadId: string) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  niche,
  userName,
  onClick,
  onMoveStage,
  onFastWhatsAppContacted,
  onSelectCity,
  onOpenAgenda,
}) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const inactive = isInactiveOver48h(lead.lastContactDate, lead.createdAt);

  // Script definition helper
  const scriptKey =
    lead.scriptUsed !== 'none' && niche.scripts[lead.scriptUsed]
      ? lead.scriptUsed
      : Object.keys(niche.scripts)[0] || 'script_mensagem';
  const scriptDef =
    niche.scripts[scriptKey] ||
    Object.values(niche.scripts)[0] ||
    DEFAULT_SCRIPTS.script_mensagem;

  // Direct WhatsApp greeting / progressive follow-up message based on current stage
  const targetBusinessName = (lead.companyName || '').trim();
  const contactGreetingMessage = getStageWhatsAppMessage(targetBusinessName, lead.stage);
  const waLink = buildWhatsAppLink(lead.phone, contactGreetingMessage);

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(lead.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 1500);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', lead.id);
    e.dataTransfer.setData('leadId', lead.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Find next logical stage for quick advance
  const currentStageIndex = FUNNEL_STAGES.findIndex((s) => s.id === lead.stage);
  const nextStage =
    currentStageIndex >= 0 && currentStageIndex < FUNNEL_STAGES.length - 1
      ? FUNNEL_STAGES[currentStageIndex + 1]
      : null;

  const handleQuickAdvance = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nextStage) {
      onMoveStage(lead.id, nextStage.id);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedLeadId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('leadId');
        if (draggedLeadId) {
          onMoveStage(draggedLeadId, lead.stage);
        }
      }}
      onClick={onClick}
      className={`group relative rounded-xl border transition-all duration-200 cursor-pointer p-3.5 hover:shadow-[var(--kz-shadow-md)] hover:-translate-y-0.5 ${
        inactive
          ? 'bg-amber-500/[0.06] border-[var(--kz-warning-border)] ring-1 ring-amber-500/20 hover:bg-amber-500/[0.09]'
          : 'bg-[var(--kz-bg-subtle)] border-[var(--kz-border-default)] hover:bg-[#1E1E25] hover:border-[var(--kz-border-strong)] shadow-[var(--kz-shadow-xs)]'
      }`}
    >
      {/* Top Tag & Inactivity Banner & Last Contact Indicator */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {inactive ? (
            <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--kz-warning-text)] bg-[var(--kz-warning-bg)] border border-[var(--kz-warning-border)] px-2 py-0.5 rounded-full shrink-0">
              <Clock className="w-3 h-3 shrink-0" />
              <span>Inativo (+48h)</span>
            </div>
          ) : (
            <span className="text-[10px] font-semibold text-[var(--kz-text-muted)] bg-[var(--kz-bg-muted)] border border-[var(--kz-border-subtle)] px-2 py-0.5 rounded-md truncate max-w-[130px]">
              {scriptDef.title ? scriptDef.title.split('—')[0] : 'Script'}
            </span>
          )}

          {lead.lastContactDate ? (
            <span
              className="text-[10px] font-mono text-[var(--kz-accent-text)] bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0"
              title={`Última mensagem enviada: ${new Date(lead.lastContactDate).toLocaleString('pt-BR')}`}
            >
              <Send className="w-2.5 h-2.5 text-[var(--kz-accent)]" />
              <span>{formatFriendlyTime(lead.lastContactDate)}</span>
            </span>
          ) : (
            <span className="text-[10px] text-[var(--kz-text-subtle)] bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] px-1.5 py-0.5 rounded shrink-0">
              Sem envio
            </span>
          )}
        </div>

        {/* Quick Menu */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            className="p-1 rounded text-[var(--kz-text-subtle)] hover:text-[var(--kz-text-primary)] hover:bg-[var(--kz-bg-muted)] transition-colors cursor-pointer"
            title="Mover etapa"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMoveMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-[#222229] rounded-xl shadow-[var(--kz-shadow-lg)] border border-[var(--kz-border-default)] py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--kz-text-subtle)] border-b border-[var(--kz-border-subtle)]">
                Mover para Etapa
              </div>
              {FUNNEL_STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onMoveStage(lead.id, s.id);
                    setShowMoveMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer ${
                    lead.stage === s.id
                      ? 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] font-semibold'
                      : 'text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)] hover:text-[var(--kz-text-primary)]'
                  }`}
                >
                  <span className="truncate">{s.shortName}</span>
                  {lead.stage === s.id && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kz-accent)] shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Company Name & Contact */}
      <div className="mb-2">
        <h4 className="text-xs font-bold text-[var(--kz-text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--kz-accent-text)] transition-colors">
          {lead.companyName}
        </h4>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {lead.contactName && (
            <span className="text-[11px] text-[var(--kz-text-muted)] font-medium truncate">
              {lead.contactName}
            </span>
          )}
          {lead.category && (
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-md tracking-tight border ${
                lead.category.toLowerCase().includes('academia') ||
                lead.category.toLowerCase().includes('suplement') ||
                lead.category.toLowerCase().includes('crossfit')
                  ? 'bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border-[var(--kz-warning-border)]'
                  : 'bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border-[var(--kz-success-border)]'
              }`}
              title={`Categoria: ${lead.category}`}
            >
              {lead.category}
            </span>
          )}
        </div>
      </div>

      {/* Location & Google Rating */}
      <div className="flex items-center justify-between gap-1 text-[11px] text-[var(--kz-text-muted)] mb-2.5">
        <button
          type="button"
          onClick={(e) => {
            if (onSelectCity && lead.city) {
              e.stopPropagation();
              onSelectCity(lead.city);
            }
          }}
          className={`flex items-center gap-1 truncate text-[var(--kz-text-secondary)] rounded px-1 -mx-1 transition-colors text-left ${
            onSelectCity ? 'hover:bg-[var(--kz-accent-soft)] hover:text-[var(--kz-accent-text)] cursor-pointer' : ''
          }`}
          title={onSelectCity ? `Filtrar pipeline pela cidade: ${lead.city || niche.city}` : undefined}
        >
          <MapPin className="w-3 h-3 shrink-0 text-[var(--kz-accent)]" />
          <span className="truncate font-medium">{lead.city || niche.city}</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {lead.googleMapsUrl && (
            <a
              href={lead.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-1.5 py-0.5 rounded text-[var(--kz-info-text)] bg-[var(--kz-info-bg)] hover:bg-sky-500/20 transition-colors flex items-center gap-0.5 text-[10px] font-medium border border-[var(--kz-info-border)]"
              title="Abrir no Google Meu Negócio / Maps"
            >
              <span>GMB</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {lead.googleRating ? (
            <div className="flex items-center gap-0.5 font-mono text-[11px] text-[var(--kz-warning-text)] font-bold shrink-0 bg-[var(--kz-warning-bg)] border border-[var(--kz-warning-border)] px-1.5 py-0.2 rounded-md">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{lead.googleRating.toFixed(1)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Phone with 1-click copy */}
      <div className="flex items-center justify-between gap-1 text-[11px] pt-2 border-t border-[var(--kz-border-subtle)]">
        <button
          type="button"
          onClick={handleCopyPhone}
          className="flex items-center gap-1 font-mono tabular-nums text-[var(--kz-text-secondary)] hover:text-[var(--kz-accent-text)] font-semibold cursor-pointer group/copy"
          title="Clique para copiar telefone"
        >
          <span>{formatDisplayPhone(lead.phone)}</span>
          {copiedPhone ? (
            <Check className="w-3 h-3 text-[var(--kz-success-text)]" />
          ) : (
            <Copy className="w-2.5 h-2.5 text-[var(--kz-text-subtle)] group-hover/copy:text-[var(--kz-accent)]" />
          )}
        </button>

        {lead.mockupUrl && (
          <a
            href={lead.mockupUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-[var(--kz-accent-text)] hover:text-[var(--kz-text-primary)] flex items-center gap-0.5 font-bold cursor-pointer bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] px-1.5 py-0.5 rounded"
            title="Abrir mockup interativo"
          >
            <span>Demo</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>

      {/* Financials (Setup + MRR) if present */}
      {(lead.creationValue || lead.monthlyMrr) ? (
        <div className="mt-2 pt-1.5 border-t border-[var(--kz-border-subtle)] flex items-center justify-between text-[11px] font-mono tabular-nums">
          {lead.creationValue ? (
            <span className="text-[var(--kz-text-primary)] font-semibold">
              R$ {lead.creationValue.toLocaleString('pt-BR')}
            </span>
          ) : <span />}
          {lead.monthlyMrr ? (
            <span className="text-[var(--kz-success-text)] bg-[var(--kz-success-bg)] border border-[var(--kz-success-border)] px-1.5 py-0.5 rounded font-bold text-[10px]">
              +R$ {lead.monthlyMrr.toLocaleString('pt-BR')}/mês
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Meeting schedule tag if in reuniao_marcada */}
      {lead.stage === 'reuniao_marcada' && (
        <div
          onClick={(e) => {
            if (onOpenAgenda) {
              e.stopPropagation();
              onOpenAgenda(lead.id);
            }
          }}
          className={`mt-2 p-1.5 bg-[var(--kz-success-bg)] border border-[var(--kz-success-border)] rounded-lg flex items-center justify-between text-[11px] text-[var(--kz-success-text)] transition-colors ${
            onOpenAgenda ? 'hover:bg-emerald-500/20 cursor-pointer' : ''
          }`}
          title="Clique para abrir e agendar na Agenda"
        >
          <div className="flex items-center gap-1 font-semibold truncate">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {lead.meetingDate
                ? `${new Date(lead.meetingDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}${lead.meetingTime ? ` às ${lead.meetingTime}` : ''}`
                : 'Definir dia na Agenda'}
            </span>
          </div>
          <span className="text-[10px] font-bold bg-emerald-500/20 text-[var(--kz-success-text)] px-1.5 py-0.2 rounded shrink-0">
            {lead.meetingDate ? 'Agendada' : 'Agendar 📅'}
          </span>
        </div>
      )}

      {/* Callback schedule tag (Pediu para falar outra hora / Ligar mais tarde) */}
      {lead.callbackDate && lead.callbackStatus !== 'realizado' && lead.callbackStatus !== 'cancelado' && (
        <div
          onClick={(e) => {
            if (onOpenAgenda) {
              e.stopPropagation();
              onOpenAgenda(lead.id);
            }
          }}
          className={`mt-2 p-1.5 rounded-lg flex items-center justify-between text-[11px] transition-colors border ${
            lead.callbackDate === new Date().toISOString().split('T')[0]
              ? 'bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border-[var(--kz-warning-border)] ring-1 ring-amber-500/30 font-semibold'
              : 'bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border-[var(--kz-warning-border)] hover:bg-amber-500/20'
          } ${onOpenAgenda ? 'cursor-pointer' : ''}`}
          title="Pediu para entrar em contato outra hora. Clique para gerenciar na Agenda."
        >
          <div className="flex items-center gap-1.5 font-semibold truncate">
            <PhoneCall className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {lead.callbackDate === new Date().toISOString().split('T')[0]
                ? `Ligar Hoje${lead.callbackTime ? ` às ${lead.callbackTime}` : ''}`
                : `Retorno: ${new Date(lead.callbackDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}${lead.callbackTime ? ` às ${lead.callbackTime}` : ''}`}
            </span>
          </div>
          <span className="text-[10px] font-bold bg-amber-500/20 text-[var(--kz-warning-text)] px-1.5 py-0.2 rounded shrink-0">
            {lead.callbackNotes ? lead.callbackNotes.slice(0, 14) + (lead.callbackNotes.length > 14 ? '...' : '') : 'Retorno 📞'}
          </span>
        </div>
      )}

      {/* Action Row: Primary WhatsApp Call + Quick Advance button */}
      <div className="mt-3 pt-2 border-t border-[var(--kz-border-subtle)] flex items-center gap-2">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            if (waLink === '#') {
              e.preventDefault();
              return;
            }
            onFastWhatsAppContacted(lead);
          }}
          className="flex-1 flex items-center justify-center gap-2 py-2 sm:py-1.5 px-3 sm:px-2 text-xs font-bold text-white bg-[var(--kz-success-solid)] hover:bg-emerald-500 active:bg-emerald-700 rounded-lg shadow-[var(--kz-shadow-xs)] transition-colors cursor-pointer min-h-[38px] sm:min-h-0"
          title="Chamar no WhatsApp com a mensagem do script pronta"
        >
          <MessageCircle className="w-4 h-4 fill-white/20 shrink-0" />
          <span>WhatsApp</span>
        </a>

        {nextStage && (
          <button
            type="button"
            onClick={handleQuickAdvance}
            className="px-3 py-2 sm:py-1.5 text-xs sm:text-[11px] font-semibold text-[var(--kz-text-secondary)] bg-[var(--kz-bg-muted)] hover:bg-[#2B2B34] hover:text-[var(--kz-text-primary)] border border-[var(--kz-border-subtle)] rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 min-h-[38px] sm:min-h-0"
            title={`Avançar para: ${nextStage.shortName}`}
          >
            <span>Avançar</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--kz-text-muted)] shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};
