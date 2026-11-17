import React from 'react';
import { Clock, ArrowRight, Kanban, LayoutDashboard, Layers } from 'lucide-react';
import { AppTab } from '../types/crm';
import { NAVIGATION_ITEMS } from '../config/navigation';
import { Card, CardHeader, CardTitle, CardDescription, Badge, Button, Alert } from './ui';

interface ModulePlaceholderProps {
  tab: AppTab;
  onNavigate: (tab: AppTab) => void;
}

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({
  tab,
  onNavigate,
}) => {
  const item = NAVIGATION_ITEMS.find((i) => i.id === tab);

  const title = item?.label || 'Módulo em Desenvolvimento';
  const description =
    item?.description ||
    'Este módulo faz parte da arquitetura integrada do Kaizen e será implementado nas próximas etapas.';
  const plannedFeatures = item?.plannedFeatures || [];
  const targetStageLabel = item?.targetStageLabel || 'Próximas etapas do Kaizen';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Card padding="lg" className="space-y-6">
        <CardHeader className="pb-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning" dot size="md">
                Em desenvolvimento
              </Badge>
              <Badge variant="neutral" size="md">
                {targetStageLabel}
              </Badge>
            </div>
            <CardTitle className="text-lg sm:text-xl pt-1">{title}</CardTitle>
            <CardDescription className="text-xs sm:text-sm max-w-2xl leading-relaxed">
              {description}
            </CardDescription>
          </div>
        </CardHeader>

        <Alert variant="info" title="Módulo estruturado na arquitetura Kaizen (sem dados fictícios)">
          Na <strong>Etapa 1 — Fundação Visual</strong>, a navegação e a estrutura visual deste
          módulo já estão preparadas. Nenhuma métrica, registro ou integração simulada é exibida
          até a implementação real com persistência no Cloud Firestore.
        </Alert>

        {plannedFeatures.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--kz-text-primary)]">
              <Layers className="w-4 h-4 text-[var(--kz-accent)]" />
              <span>Escopo previsto para este módulo</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {plannedFeatures.map((feat, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] text-xs text-[var(--kz-text-secondary)]"
                >
                  <Clock className="w-4 h-4 text-[var(--kz-text-subtle)] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-[var(--kz-border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[var(--kz-text-muted)]">
            Enquanto isso, todas as operações comerciais continuam ativas no CRM e na Agenda.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<LayoutDashboard className="w-3.5 h-3.5" />}
              onClick={() => onNavigate('dashboard')}
            >
              Ir para Dashboard
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Kanban className="w-3.5 h-3.5" />}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => onNavigate('kanban')}
            >
              Abrir CRM / Pipeline
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
