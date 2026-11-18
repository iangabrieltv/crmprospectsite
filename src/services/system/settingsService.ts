import {
  SystemSettings,
  SystemAppearanceMode,
} from '../../types/system';

const ALLOWED_HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return ALLOWED_HEX_COLOR_REGEX.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

export function buildDefaultSystemSettings(userName = 'Ian'): SystemSettings {
  const cleanName = (userName || 'Ian').trim() || 'Ian';
  return {
    id: 'default',
    adminProfile: {
      displayName: cleanName,
      contactEmail: '',
      photoUrl: '',
      agencyName: 'Agência Kaizen',
      commercialPhone: '',
      websiteUrl: '',
      issuerDocument: '',
    },
    visualIdentity: {
      brandName: 'Kaizen',
      primaryLogoUrl: '',
      compactLogoUrl: '',
      primaryColor: '#C6A15B',
      secondaryColor: '#A98B50',
      appearanceMode: 'premium_dark',
    },
    regional: {
      currency: 'BRL',
      dateFormat: 'DD/MM/YYYY',
      timezone: 'America/Maceio',
      language: 'pt-BR',
    },
    preferences: {
      enableNotifications: true,
      notifyComercial: true,
      notifyOperacional: true,
      notifyFinanceiro: true,
      notifyAgenda: true,
      autoRunAutomationsOnOpen: true,
      showAssistantSuggestions: true,
    },
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Normaliza SystemSettings preservando o tema Premium Dark e os padrões regionais
 * seguros do Kaizen sem jamais sobrescrever lançamentos financeiros históricos.
 */
export function normalizeSystemSettings(
  raw: Partial<SystemSettings> | null | undefined,
  fallbackUserName = 'Ian'
): SystemSettings {
  const defaults = buildDefaultSystemSettings(fallbackUserName);
  if (!raw || typeof raw !== 'object') return defaults;

  const appearanceMode: SystemAppearanceMode = 'premium_dark';
  const adminProfile = raw.adminProfile || defaults.adminProfile;
  const visualIdentity = raw.visualIdentity || defaults.visualIdentity;
  const preferences = raw.preferences || defaults.preferences;

  return {
    id: 'default',
    adminProfile: {
      displayName: (adminProfile.displayName || defaults.adminProfile.displayName).trim().slice(0, 120),
      contactEmail: (adminProfile.contactEmail || '').trim().slice(0, 160),
      photoUrl: (adminProfile.photoUrl || '').trim().slice(0, 500),
      agencyName: (adminProfile.agencyName || defaults.adminProfile.agencyName).trim().slice(0, 140),
      commercialPhone: (adminProfile.commercialPhone || '').trim().slice(0, 40),
      websiteUrl: (adminProfile.websiteUrl || '').trim().slice(0, 300),
      issuerDocument: (adminProfile.issuerDocument || '').trim().slice(0, 40),
    },
    visualIdentity: {
      brandName: (visualIdentity.brandName || defaults.visualIdentity.brandName).trim().slice(0, 80),
      primaryLogoUrl: (visualIdentity.primaryLogoUrl || '').trim().slice(0, 500),
      compactLogoUrl: (visualIdentity.compactLogoUrl || '').trim().slice(0, 500),
      primaryColor: normalizeHexColor(visualIdentity.primaryColor, '#C6A15B'),
      secondaryColor: normalizeHexColor(visualIdentity.secondaryColor, '#A98B50'),
      appearanceMode,
    },
    regional: {
      currency: 'BRL',
      dateFormat: 'DD/MM/YYYY',
      timezone: 'America/Maceio',
      language: 'pt-BR',
    },
    preferences: {
      enableNotifications:
        typeof preferences.enableNotifications === 'boolean'
          ? preferences.enableNotifications
          : defaults.preferences.enableNotifications,
      notifyComercial:
        typeof preferences.notifyComercial === 'boolean'
          ? preferences.notifyComercial
          : defaults.preferences.notifyComercial,
      notifyOperacional:
        typeof preferences.notifyOperacional === 'boolean'
          ? preferences.notifyOperacional
          : defaults.preferences.notifyOperacional,
      notifyFinanceiro:
        typeof preferences.notifyFinanceiro === 'boolean'
          ? preferences.notifyFinanceiro
          : defaults.preferences.notifyFinanceiro,
      notifyAgenda:
        typeof preferences.notifyAgenda === 'boolean'
          ? preferences.notifyAgenda
          : defaults.preferences.notifyAgenda,
      autoRunAutomationsOnOpen:
        typeof preferences.autoRunAutomationsOnOpen === 'boolean'
          ? preferences.autoRunAutomationsOnOpen
          : defaults.preferences.autoRunAutomationsOnOpen,
      showAssistantSuggestions:
        typeof preferences.showAssistantSuggestions === 'boolean'
          ? preferences.showAssistantSuggestions
          : defaults.preferences.showAssistantSuggestions,
    },
    schemaVersion: raw.schemaVersion ?? 1,
    updatedAt: raw.updatedAt || defaults.updatedAt,
  };
}

export interface IssuerBrandingSnapshot {
  issuerName: string;
  issuerDocument: string;
  agencyName: string;
  commercialPhone: string;
  websiteUrl: string;
  contactEmail: string;
}

export function getIssuerBrandingFromSettings(
  settings: SystemSettings | null | undefined,
  fallbackUserName = 'Ian'
): IssuerBrandingSnapshot {
  const normalized = normalizeSystemSettings(settings, fallbackUserName);
  const agencyName = normalized.adminProfile.agencyName || 'Agência Kaizen';
  const displayName = normalized.adminProfile.displayName || fallbackUserName;
  const issuerName = displayName ? `${agencyName} — ${displayName}` : agencyName;

  return {
    issuerName,
    issuerDocument: normalized.adminProfile.issuerDocument || '',
    agencyName,
    commercialPhone: normalized.adminProfile.commercialPhone || '',
    websiteUrl: normalized.adminProfile.websiteUrl || '',
    contactEmail: normalized.adminProfile.contactEmail || '',
  };
}
