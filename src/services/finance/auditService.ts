import {
  FINANCIAL_PAYMENT_METHOD_OPTIONS,
  FinancialAuditAction,
  FinancialAuditLog,
  FinancialSettings,
} from '../../types/finance';
import { KAIZEN_TIMEZONE, buildFinancialId, getTodayInTimezone } from './money';

export function createFinancialAuditLog(params: {
  entityType: FinancialAuditLog['entityType'];
  entityId: string;
  action: FinancialAuditAction;
  description: string;
  amountCents?: number;
  actor: string;
  createdAt?: string;
}): FinancialAuditLog {
  return {
    id: buildFinancialId('faud'),
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    description: params.description,
    ...(params.amountCents !== undefined ? { amountCents: params.amountCents } : {}),
    actor: params.actor || 'Admin',
    createdAt: params.createdAt || new Date().toISOString(),
    schemaVersion: 1,
  };
}

export function buildDefaultFinancialSettings(
  todayYmd: string = getTodayInTimezone(KAIZEN_TIMEZONE)
): FinancialSettings {
  return {
    id: 'default',
    companyName: 'Agência Kaizen',
    currency: 'BRL',
    dateFormat: 'DD/MM/YYYY',
    timezone: KAIZEN_TIMEZONE,
    openingBalanceCents: 0,
    openingBalanceDate: todayYmd,
    openingBalanceDescription: 'Saldo inicial de caixa configurado no sistema',
    openingBalanceHistory: [
      {
        date: todayYmd,
        amountCents: 0,
        description: 'Posição inicial padrão',
        changedAt: new Date().toISOString(),
        changedBy: 'Sistema',
      },
    ],
    paymentMethods: FINANCIAL_PAYMENT_METHOD_OPTIONS.map((m) => ({
      id: m.id,
      label: m.label,
      active: true,
    })),
    alertDaysAhead: 5,
    defaultDueDay: 10,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  };
}
