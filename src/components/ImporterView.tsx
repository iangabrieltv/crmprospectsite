import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { NicheCampaign, Lead } from '../types/crm';
import { cleanPhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';
import { SAMPLE_IMPORT_LEADS } from '../utils/initialData';
import {
  UploadCloud,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Plus,
  Play,
  RotateCcw,
  Check,
  Building2,
  Phone,
  MapPin,
  Star,
  FileUp,
  FileText,
  X,
  AlertTriangle,
  FolderUp,
  ExternalLink,
  Globe,
  User,
  Search,
  Edit2,
  Save,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CopyX,
  Filter,
  Trash2,
  Undo2,
  Tag,
  Ban
} from 'lucide-react';

export interface ParsedLeadCandidate {
  companyName: string;
  contactName?: string;
  phone: string;
  category?: string;
  city?: string;
  address?: string;
  googleRating?: number;
  googleMapsUrl?: string;
  websiteUrl?: string;
  recommendedScript?: 'script1' | 'script2' | 'script3';
  opportunityAngle?: string;
  selected: boolean;
  isEditing?: boolean;
  originalLineNumber?: number;
}

export interface DuplicateDetail {
  id: string;
  candidate: ParsedLeadCandidate;
  reason: string;
  matchType: 'phone' | 'name' | 'existing_crm' | 'incompatible_category';
  matchedWith: string;
  originalIndex: number;
}

interface UploadedFileInfo {
  name: string;
  size: number;
  format: string;
  sheetName?: string;
  rowCount: number;
}

interface ImporterViewProps {
  activeNiche: NicheCampaign;
  existingLeads?: Lead[];
  onImportLeadsToNiche: (nicheId: string, leads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[]) => void;
  onCreateNicheWithLeads: (
    newNiche: { name: string; segment: string; city: string; emoji: string },
    leads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[]
  ) => void;
  onSwitchToKanban: () => void;
}

export const ImporterView: React.FC<ImporterViewProps> = ({
  activeNiche,
  existingLeads,
  onImportLeadsToNiche,
  onCreateNicheWithLeads,
  onSwitchToKanban,
}) => {
  const [inputMethod, setInputMethod] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [showRawTextPreview, setShowRawTextPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [destinationMode, setDestinationMode] = useState<'current' | 'new'>('current');
  const [newNicheName, setNewNicheName] = useState('');
  const [newNicheSegment, setNewNicheSegment] = useState('');
  const [newNicheCity, setNewNicheCity] = useState(activeNiche.city);
  const [newNicheEmoji, setNewNicheEmoji] = useState('💼');

  // Candidate leads: raw from spreadsheet, unique (kept), and duplicates (excluded)
  const [rawParsedCandidates, setRawParsedCandidates] = useState<ParsedLeadCandidate[]>([]);
  const [parsedCandidates, setParsedCandidates] = useState<ParsedLeadCandidate[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateDetail[]>([]);
  const [activeCandidatesTab, setActiveCandidatesTab] = useState<'unique' | 'duplicates' | 'incompatible_category'>('unique');
  const [duplicateSearch, setDuplicateSearch] = useState('');

  // Antiduplication & Niche Category filters (active by default!)
  const [dedupCheckPhone, setDedupCheckPhone] = useState(true);
  const [dedupCheckName, setDedupCheckName] = useState(true);
  const [dedupCheckCrm, setDedupCheckCrm] = useState(true);
  const [dedupCheckCategory, setDedupCheckCategory] = useState(true);
  const [dedupAutoExclude, setDedupAutoExclude] = useState(true);

  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Check if a category / company belongs or is incompatible with the active campaign niche
  const checkNicheCategoryRelevance = (
    rawCategory: string | undefined,
    companyName: string,
    niche: NicheCampaign
  ): { isIncompatible: boolean; reason: string; matchedCategory: string } => {
    const normCat = (rawCategory || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const normCompany = (companyName || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const normNiche = `${niche.name} ${niche.segment}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const isNutriNiche =
      normNiche.includes('nutri') ||
      normNiche.includes('nutricionista') ||
      normNiche.includes('nutrolog');

    const isOdontoNiche =
      normNiche.includes('odonto') ||
      normNiche.includes('dentist');

    const combinedText = `${normCat} ${normCompany}`;

    // 1. Nutricionistas & Nutrologia Rules
    if (isNutriNiche) {
      // Whitelist terms: if it explicitly indicates a nutritionist/nutrology clinic, keep it
      const hasNutriCore = /\b(nutri|nutricionista|nutrolog[ao]|nutricao|dieta|consultorio de nutricao|emagrecimento integrativo|nutri infantil)\b/i.test(
        combinedText
      );

      const nutriIncompatiblePatterns = [
        {
          pattern: /\b(academia|academias|crossfit|gym|fitness center|centro de treinamento|musculacao|treino funcional|ct |box de crossfit|escola de natacao|studio pilates|pilates)\b/i,
          label: 'Academia / Centro Fitness',
        },
        {
          pattern: /\b(loja de suplemento|loja de suplementos|suplementos alimentares|suplementacao|suplemento|suplementos|produtos naturais|emporio natural|loja de produtos naturais|mundo verde)\b/i,
          label: 'Loja de Suplementos / Produtos',
        },
        {
          pattern: /\b(farmacia|drogaria|farmacia de manipulacao|manipulacao|remedios)\b/i,
          label: 'Farmácia / Drogaria',
        },
        {
          pattern: /\b(marmitaria|restaurante|lanchonete|refeicoes fitness|buffet|comida fitness|delivery fitness|pizzaria|hamburgueria)\b/i,
          label: 'Restaurante / Marmitaria',
        },
        {
          pattern: /\b(pet shop|veterinari[ao]|agropecuaria|banho e tosa)\b/i,
          label: 'Pet Shop / Veterinária',
        },
        {
          pattern: /\b(otica|oticas|barbearia|salao de beleza|cabeleireir[ao]|tatuagem|tattoo|podologia)\b/i,
          label: 'Comércio / Estética não relacionada',
        },
        {
          pattern: /\b(mecanica|auto pecas|imobiliaria|advocacia|contabilidade|lava rapido)\b/i,
          label: 'Setor não relacionado',
        },
      ];

      for (const rule of nutriIncompatiblePatterns) {
        if (rule.pattern.test(normCat)) {
          if (!hasNutriCore) {
            return {
              isIncompatible: true,
              reason: `Categoria fora do nicho: "${rawCategory || rule.label}". Não é nutricionista ou consultório de nutrição.`,
              matchedCategory: rule.label,
            };
          }
        } else if (rule.pattern.test(normCompany) && !hasNutriCore) {
          return {
            isIncompatible: true,
            reason: `Estabelecimento identificado como "${rule.label}" pelo nome. Não corresponde ao perfil de nutricionista.`,
            matchedCategory: rule.label,
          };
        }
      }
    } else if (isOdontoNiche) {
      const odontoIncompatible = [
        {
          pattern: /\b(laboratorio de protese|protese dentaria|protetico|dental |produtos odontologicos)\b/i,
          label: 'Laboratório / Fornecedor Odontológico',
        },
        {
          pattern: /\b(farmacia|drogaria|academia|restaurante|pet shop)\b/i,
          label: 'Comércio não odontológico',
        },
      ];
      for (const rule of odontoIncompatible) {
        if (rule.pattern.test(normCat) || rule.pattern.test(normCompany)) {
          return {
            isIncompatible: true,
            reason: `Categoria fora do nicho: "${rawCategory || rule.label}". Não é consultório ou clínica odontológica.`,
            matchedCategory: rule.label,
          };
        }
      }
    }

    return { isIncompatible: false, reason: '', matchedCategory: '' };
  };

  // Phone normalization for duplicate detection (handles DDD, leading 0, +55, and mobile 9-digit)
  const normalizePhoneForDeduplication = (phone: string): string => {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (!digits) return '';

    // Remove leading zeros (e.g. 011987654321 -> 11987654321)
    while (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    // Remove Brazilian international code 55 if length >= 12
    if (digits.startsWith('55') && digits.length >= 12) {
      digits = digits.slice(2);
    }

    // Standardize 10-digit mobile phones to 11 digits
    if (digits.length === 10) {
      const ddd = digits.slice(0, 2);
      const num = digits.slice(2);
      digits = `${ddd}9${num}`;
    }

    return digits;
  };

  // Name normalization for duplicate detection (removes accents, honorifics, symbols, company types)
  const normalizeNameForDeduplication = (name: string): string => {
    if (!name) return '';
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents (á -> a, ç -> c)
      // Remove professional & medical titles/honorifics
      .replace(/\b(dra?|doutor[a]?|nutri|nutricionista|nutrolog[ao]|medico|medica|psicolog[ao]|fisioterapeuta|dentista|odontolog[ao]|dr|dr[a]?\.)\b/gi, ' ')
      // Remove commercial & clinical prefixes/suffixes
      .replace(/\b(clinica|consultorio|instituto|espaco|studio|centro|atendimento|consultoria|saude|estetica|integrada)\b/gi, ' ')
      // Remove legal corporate suffixes
      .replace(/\b(ltda|me|eireli|epp|sa|s\/a|s\.a|ss|eirelli)\b/gi, ' ')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Deduplication & Niche Category Filter core algorithm
  const runDeduplication = (
    candidates: ParsedLeadCandidate[],
    checkPhone = dedupCheckPhone,
    checkName = dedupCheckName,
    checkCrm = dedupCheckCrm,
    autoExclude = dedupAutoExclude,
    checkCategory = dedupCheckCategory
  ) => {
    setRawParsedCandidates(candidates);

    if (!autoExclude || (!checkPhone && !checkName && !checkCrm && !checkCategory)) {
      setParsedCandidates(candidates);
      setDuplicateCandidates([]);
      return;
    }

    const unique: ParsedLeadCandidate[] = [];
    const duplicates: DuplicateDetail[] = [];

    // Internal maps to identify repeated contacts within the spreadsheet
    const seenPhones = new Map<string, { candidate: ParsedLeadCandidate; originalIndex: number }>();
    const seenPhonesLast8 = new Map<string, { candidate: ParsedLeadCandidate; originalIndex: number }>();
    const seenNames = new Map<
      string,
      { candidate: ParsedLeadCandidate; originalIndex: number; matchedField: string; originalValue: string }
    >();

    // Pre-index existing CRM leads
    const existingPhones = new Map<string, Lead>();
    const existingPhonesLast8 = new Map<string, Lead>();
    const existingNames = new Map<string, { lead: Lead; matchedField: string; originalValue: string }>();

    if (checkCrm && existingLeads && existingLeads.length > 0) {
      for (const lead of existingLeads) {
        if (lead.phone) {
          const pKey = normalizePhoneForDeduplication(lead.phone);
          if (pKey) {
            existingPhones.set(pKey, lead);
            if (pKey.length >= 8) {
              existingPhonesLast8.set(pKey.slice(-8), lead);
            }
          }
        }
        if (lead.companyName) {
          const nKey = normalizeNameForDeduplication(lead.companyName);
          if (nKey && nKey.length >= 3 && !nKey.startsWith('lead ') && !nKey.startsWith('sem nome')) {
            existingNames.set(nKey, { lead, matchedField: 'empresa', originalValue: lead.companyName });
          }
        }
        if (lead.contactName) {
          const cKey = normalizeNameForDeduplication(lead.contactName);
          if (cKey && cKey.length >= 3 && !cKey.startsWith('lead ') && !cKey.startsWith('sem nome')) {
            existingNames.set(cKey, { lead, matchedField: 'contato', originalValue: lead.contactName });
          }
        }
      }
    }

    candidates.forEach((candidate, idx) => {
      const originalIndex = candidate.originalLineNumber || idx + 1;
      const phoneKey = normalizePhoneForDeduplication(candidate.phone);
      const companyKey = normalizeNameForDeduplication(candidate.companyName);
      const contactKey = candidate.contactName ? normalizeNameForDeduplication(candidate.contactName) : '';

      // Prepare list of name keys to check (both company and contact person name)
      const nameKeysToCheck: { key: string; field: 'empresa' | 'contato'; originalVal: string }[] = [];
      if (companyKey && companyKey.length >= 3 && !companyKey.startsWith('lead ') && !companyKey.startsWith('sem nome')) {
        nameKeysToCheck.push({ key: companyKey, field: 'empresa', originalVal: candidate.companyName });
      }
      if (contactKey && contactKey.length >= 3 && !contactKey.startsWith('lead ') && !contactKey.startsWith('sem nome')) {
        nameKeysToCheck.push({ key: contactKey, field: 'contato', originalVal: candidate.contactName! });
      }

      let isDuplicate = false;
      let reason = '';
      let matchType: 'phone' | 'name' | 'existing_crm' | 'incompatible_category' = 'phone';
      let matchedWith = '';

      // 0. Check niche category compatibility
      if (!isDuplicate && checkCategory) {
        const catCheck = checkNicheCategoryRelevance(candidate.category, candidate.companyName, activeNiche);
        if (catCheck.isIncompatible) {
          isDuplicate = true;
          matchType = 'incompatible_category';
          matchedWith = catCheck.matchedCategory;
          reason = catCheck.reason;
        }
      }

      // 1. Check against existing CRM leads
      if (checkCrm && !isDuplicate) {
        if (checkPhone && phoneKey) {
          if (existingPhones.has(phoneKey)) {
            const matched = existingPhones.get(phoneKey)!;
            isDuplicate = true;
            matchType = 'existing_crm';
            matchedWith = matched.companyName || formatDisplayPhone(matched.phone);
            reason = `Já cadastrado no CRM com este telefone: "${matched.companyName}" (${formatDisplayPhone(matched.phone)})`;
          } else if (phoneKey.length >= 8 && existingPhonesLast8.has(phoneKey.slice(-8))) {
            const matched = existingPhonesLast8.get(phoneKey.slice(-8))!;
            isDuplicate = true;
            matchType = 'existing_crm';
            matchedWith = matched.companyName || formatDisplayPhone(matched.phone);
            reason = `Já cadastrado no CRM com este número: "${matched.companyName}" (${formatDisplayPhone(matched.phone)})`;
          }
        }

        if (checkName && !isDuplicate) {
          for (const item of nameKeysToCheck) {
            if (existingNames.has(item.key)) {
              const matched = existingNames.get(item.key)!;
              isDuplicate = true;
              matchType = 'existing_crm';
              matchedWith = matched.lead.companyName;
              reason = `Já cadastrado no CRM com este nome (${item.field === 'empresa' ? 'empresa' : 'contato'}): "${matched.originalValue}"`;
              break;
            }
          }
        }
      }

      // 2. Check internal duplicate by phone within spreadsheet
      if (!isDuplicate && checkPhone && phoneKey) {
        if (seenPhones.has(phoneKey)) {
          const matched = seenPhones.get(phoneKey)!;
          isDuplicate = true;
          matchType = 'phone';
          matchedWith = `${matched.candidate.companyName || matched.candidate.contactName} (Linha ${matched.originalIndex})`;
          reason = `Telefone repetido (${formatDisplayPhone(candidate.phone)}): idêntico ao contato da Linha ${matched.originalIndex} ("${matched.candidate.companyName || matched.candidate.contactName}")`;
        } else if (phoneKey.length >= 8 && seenPhonesLast8.has(phoneKey.slice(-8))) {
          const matched = seenPhonesLast8.get(phoneKey.slice(-8))!;
          isDuplicate = true;
          matchType = 'phone';
          matchedWith = `${matched.candidate.companyName || matched.candidate.contactName} (Linha ${matched.originalIndex})`;
          reason = `Telefone repetido (${formatDisplayPhone(candidate.phone)}): mesmo número da Linha ${matched.originalIndex} ("${matched.candidate.companyName || matched.candidate.contactName}")`;
        }
      }

      // 3. Check internal duplicate by name (Company or Contact)
      if (!isDuplicate && checkName) {
        for (const item of nameKeysToCheck) {
          if (seenNames.has(item.key)) {
            const matched = seenNames.get(item.key)!;
            isDuplicate = true;
            matchType = 'name';
            matchedWith = `${matched.candidate.companyName || matched.candidate.contactName} (Linha ${matched.originalIndex})`;
            reason = `Nome repetido (${item.originalVal}): idêntico ao contato da Linha ${matched.originalIndex} ("${matched.originalValue}")`;
            break;
          }
        }
      }

      if (isDuplicate) {
        duplicates.push({
          id: `dup-${originalIndex}-${idx}-${Date.now()}`,
          candidate,
          reason,
          matchType,
          matchedWith,
          originalIndex,
        });
      } else {
        unique.push(candidate);
        if (phoneKey) {
          seenPhones.set(phoneKey, { candidate, originalIndex });
          if (phoneKey.length >= 8) {
            seenPhonesLast8.set(phoneKey.slice(-8), { candidate, originalIndex });
          }
        }
        for (const item of nameKeysToCheck) {
          seenNames.set(item.key, {
            candidate,
            originalIndex,
            matchedField: item.field,
            originalValue: item.originalVal,
          });
        }
      }
    });

    setParsedCandidates(unique);
    setDuplicateCandidates(duplicates);
    setActiveCandidatesTab('unique');
  };

  const handleRestoreDuplicate = (dup: DuplicateDetail) => {
    setDuplicateCandidates((prev) => prev.filter((d) => d.id !== dup.id));
    setParsedCandidates((prev) => [...prev, { ...dup.candidate, selected: true }]);
  };

  const handleRestoreAllDuplicates = () => {
    const restored = duplicateCandidates.map((d) => ({ ...d.candidate, selected: true }));
    setParsedCandidates((prev) => [...prev, ...restored]);
    setDuplicateCandidates([]);
    setActiveCandidatesTab('unique');
  };

  const handleRestoreOnlyCategoryExclusions = () => {
    const toRestore = duplicateCandidates.filter((d) => d.matchType === 'incompatible_category');
    const remaining = duplicateCandidates.filter((d) => d.matchType !== 'incompatible_category');
    setParsedCandidates((prev) => [...prev, ...toRestore.map((d) => ({ ...d.candidate, selected: true }))]);
    setDuplicateCandidates(remaining);
  };

  const handleRestoreOnlyDuplicates = () => {
    const toRestore = duplicateCandidates.filter((d) => d.matchType !== 'incompatible_category');
    const remaining = duplicateCandidates.filter((d) => d.matchType === 'incompatible_category');
    setParsedCandidates((prev) => [...prev, ...toRestore.map((d) => ({ ...d.candidate, selected: true }))]);
    setDuplicateCandidates(remaining);
  };

  const handleToggleDedupPhone = (enabled: boolean) => {
    setDedupCheckPhone(enabled);
    runDeduplication(rawParsedCandidates, enabled, dedupCheckName, dedupCheckCrm, dedupAutoExclude, dedupCheckCategory);
  };

  const handleToggleDedupName = (enabled: boolean) => {
    setDedupCheckName(enabled);
    runDeduplication(rawParsedCandidates, dedupCheckPhone, enabled, dedupCheckCrm, dedupAutoExclude, dedupCheckCategory);
  };

  const handleToggleDedupCrm = (enabled: boolean) => {
    setDedupCheckCrm(enabled);
    runDeduplication(rawParsedCandidates, dedupCheckPhone, dedupCheckName, enabled, dedupAutoExclude, dedupCheckCategory);
  };

  const handleToggleAutoExclude = (enabled: boolean) => {
    setDedupAutoExclude(enabled);
    runDeduplication(rawParsedCandidates, dedupCheckPhone, dedupCheckName, dedupCheckCrm, enabled, dedupCheckCategory);
  };

  const handleToggleDedupCategory = (enabled: boolean) => {
    setDedupCheckCategory(enabled);
    runDeduplication(rawParsedCandidates, dedupCheckPhone, dedupCheckName, dedupCheckCrm, dedupAutoExclude, enabled);
  };

  // Normalize header text for intelligent column recognition
  const normalizeHeader = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  // Detect whether a string is a link and whether it's Google Maps/GMB or Website
  const classifyUrl = (rawUrl: string): { isGoogleMaps: boolean; cleanUrl: string } | null => {
    let url = rawUrl.trim();
    if (!url) return null;

    // Remove quotes
    url = url.replace(/^["']|["']$/g, '');

    // Check if it's a URL
    const isUrl =
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('www.') ||
      url.includes('google.com/maps') ||
      url.includes('maps.google.') ||
      url.includes('goo.gl/maps') ||
      url.includes('maps.app.goo.gl') ||
      url.includes('g.page');

    if (!isUrl) return null;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const isGoogleMaps =
      url.includes('google.com/maps') ||
      url.includes('maps.google') ||
      url.includes('goo.gl/maps') ||
      url.includes('maps.app.goo.gl') ||
      url.includes('g.page') ||
      url.includes('search.google.com/local');

    return { isGoogleMaps, cleanUrl: url };
  };

  // Build a Google Maps search fallback URL
  const buildGoogleMapsSearchUrl = (company: string, city: string) => {
    const query = `${company} ${city || activeNiche.city}`.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  // Split CSV or TSV line respecting quotes
  const splitCsvOrTsvLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Intelligent parser for Excel and CSV data
  const parseRawTextHeuristic = (text: string): ParsedLeadCandidate[] => {
    const rawLines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length === 0) return [];

    const candidates: ParsedLeadCandidate[] = [];

    // Detect delimiter
    const firstLine = rawLines[0];
    const detectDelimiter = (line: string): string => {
      if (line.includes('\t')) return '\t';
      if (line.includes(';')) return ';';
      if (line.includes(',')) return ',';
      return '\t';
    };

    const delimiter = detectDelimiter(firstLine);
    const firstRowParts = splitCsvOrTsvLine(firstLine, delimiter);

    // Map column headers intelligently
    let headerPhoneIndex = -1;
    let headerCompanyIndex = -1;
    let headerContactIndex = -1;
    let headerCategoryIndex = -1;
    let headerMapsIndex = -1;
    let headerWebIndex = -1;
    let headerCityIndex = -1;
    let headerAddressIndex = -1;
    let headerRatingIndex = -1;

    // Check sample rows to verify if columns have numbers/phones or names
    const sampleRows = rawLines.slice(1, 20).map((l) => splitCsvOrTsvLine(l, delimiter));
    const phoneCountPerCol: number[] = firstRowParts.map(() => 0);
    sampleRows.forEach((rowParts) => {
      rowParts.forEach((part, colIdx) => {
        const digits = part.replace(/\D/g, '');
        if (digits.length >= 8 && digits.length <= 13) {
          phoneCountPerCol[colIdx] = (phoneCountPerCol[colIdx] || 0) + 1;
        }
      });
    });

    firstRowParts.forEach((part, idx) => {
      const norm = normalizeHeader(part);

      // Phone (explicit phone names or WhatsApp)
      if (
        norm.includes('tel') ||
        norm.includes('cel') ||
        norm.includes('whats') ||
        norm.includes('fone') ||
        norm.includes('phone') ||
        norm.includes('mobile') ||
        norm.includes('zap') ||
        norm.includes('numero') ||
        norm === 'contatotel' ||
        norm === 'contatowhats'
      ) {
        if (headerPhoneIndex === -1) headerPhoneIndex = idx;
      }
      // If header is "contato", check if values in that column are phone numbers or names
      else if (norm.includes('contato')) {
        if ((phoneCountPerCol[idx] || 0) > 0 && headerPhoneIndex === -1) {
          headerPhoneIndex = idx;
        } else if (headerContactIndex === -1) {
          headerContactIndex = idx;
        }
      }
      // Contact Person Name
      else if (
        norm.includes('responsavel') ||
        norm.includes('proprietario') ||
        norm.includes('socio') ||
        norm.includes('pessoa') ||
        norm.includes('doutor') ||
        norm.includes('contact') ||
        norm.includes('owner') ||
        norm.includes('nutri')
      ) {
        if (headerContactIndex === -1) headerContactIndex = idx;
      }
      // Company Name / Business Title / General Name
      else if (
        norm.includes('empresa') ||
        norm.includes('nome') ||
        norm.includes('razao') ||
        norm.includes('fantasia') ||
        norm.includes('estabelecimento') ||
        norm.includes('consultorio') ||
        norm.includes('clinica') ||
        norm.includes('negocio') ||
        norm.includes('company') ||
        norm.includes('title') ||
        norm.includes('cliente') ||
        norm.includes('paciente')
      ) {
        if (headerCompanyIndex === -1) headerCompanyIndex = idx;
      }
      // Category / Niche / Segment / Business Type
      else if (
        norm.includes('categoria') ||
        norm.includes('category') ||
        norm.includes('nicho') ||
        norm.includes('segmento') ||
        norm.includes('ramo') ||
        norm.includes('tipo') ||
        norm.includes('setor') ||
        norm.includes('especialidade') ||
        norm.includes('atividade')
      ) {
        if (headerCategoryIndex === -1) headerCategoryIndex = idx;
      }
      // Google Maps / GMB Link
      else if (
        norm.includes('maps') ||
        norm.includes('gmb') ||
        norm.includes('googlemeunegocio') ||
        norm.includes('perfilgoogle') ||
        norm.includes('google')
      ) {
        if (headerMapsIndex === -1) headerMapsIndex = idx;
      }
      // Website / General Link
      else if (
        norm.includes('site') ||
        norm.includes('web') ||
        norm.includes('url') ||
        norm.includes('link') ||
        norm.includes('instagram') ||
        norm.includes('pagina')
      ) {
        if (headerWebIndex === -1) headerWebIndex = idx;
      }
      // City
      else if (norm.includes('cidade') || norm.includes('municipio') || norm.includes('city') || norm === 'uf' || norm === 'estado') {
        if (headerCityIndex === -1) headerCityIndex = idx;
      }
      // Address / Neighborhood
      else if (
        norm.includes('end') ||
        norm.includes('bairro') ||
        norm.includes('rua') ||
        norm.includes('logradouro') ||
        norm.includes('localizacao') ||
        norm.includes('address')
      ) {
        if (headerAddressIndex === -1) headerAddressIndex = idx;
      }
      // Rating
      else if (
        norm.includes('nota') ||
        norm.includes('aval') ||
        norm.includes('rating') ||
        norm.includes('star') ||
        norm.includes('estrela')
      ) {
        if (headerRatingIndex === -1) headerRatingIndex = idx;
      }
    });

    // Fallback: if no phone column matched by header, pick the column with highest phone occurrences
    if (headerPhoneIndex === -1) {
      let bestCol = -1;
      let maxPhones = 0;
      phoneCountPerCol.forEach((count, colIdx) => {
        if (count > maxPhones) {
          maxPhones = count;
          bestCol = colIdx;
        }
      });
      if (bestCol !== -1 && maxPhones > 0) {
        headerPhoneIndex = bestCol;
      }
    }

    const hasHeaderMatch = headerPhoneIndex !== -1 || headerCompanyIndex !== -1;
    const startIndex = hasHeaderMatch ? 1 : 0;

    for (let i = startIndex; i < rawLines.length; i++) {
      const line = rawLines[i];
      const parts = splitCsvOrTsvLine(line, delimiter);

      let company = '';
      let contactName = '';
      let categoryCandidate = '';
      let phoneCandidate = '';
      let cityCandidate = '';
      let addressCandidate = '';
      let googleMapsUrl = '';
      let websiteUrl = '';
      let ratingCandidate: number | undefined = undefined;

      // Extract based on matched header indices
      if (hasHeaderMatch) {
        if (headerCompanyIndex !== -1 && parts[headerCompanyIndex]) {
          company = parts[headerCompanyIndex];
        }
        if (headerContactIndex !== -1 && parts[headerContactIndex]) {
          contactName = parts[headerContactIndex];
        }
        if (headerCategoryIndex !== -1 && parts[headerCategoryIndex]) {
          categoryCandidate = parts[headerCategoryIndex].trim();
        }
        if (headerPhoneIndex !== -1 && parts[headerPhoneIndex]) {
          phoneCandidate = parts[headerPhoneIndex].replace(/\D/g, '');
        }
        if (headerMapsIndex !== -1 && parts[headerMapsIndex]) {
          const c = classifyUrl(parts[headerMapsIndex]);
          if (c) googleMapsUrl = c.cleanUrl;
        }
        if (headerWebIndex !== -1 && parts[headerWebIndex]) {
          const c = classifyUrl(parts[headerWebIndex]);
          if (c) {
            if (c.isGoogleMaps && !googleMapsUrl) googleMapsUrl = c.cleanUrl;
            else if (!c.isGoogleMaps) websiteUrl = c.cleanUrl;
          }
        }
        if (headerCityIndex !== -1 && parts[headerCityIndex]) {
          cityCandidate = parts[headerCityIndex];
        }
        if (headerAddressIndex !== -1 && parts[headerAddressIndex]) {
          addressCandidate = parts[headerAddressIndex];
        }
        if (headerRatingIndex !== -1 && parts[headerRatingIndex]) {
          const num = parseFloat(parts[headerRatingIndex].replace(',', '.'));
          if (!isNaN(num) && num >= 1 && num <= 5) ratingCandidate = num;
        }
      }

      // Infer category from company name or row content if not in header
      if (!categoryCandidate) {
        const textToTest = `${company} ${line}`.toLowerCase();
        if (/\b(academia|academias|gym|crossfit|musculacao|centro de treinamento|box de crossfit|studio pilates|pilates)\b/i.test(textToTest)) {
          categoryCandidate = 'Academia / Centro Fitness';
        } else if (/\b(loja de suplemento|suplementos|suplementacao|whey|creatina|produtos naturais|emporio natural|mundo verde)\b/i.test(textToTest)) {
          categoryCandidate = 'Loja de Suplementos';
        } else if (/\b(farmacia|drogaria|manipulacao|remedios)\b/i.test(textToTest)) {
          categoryCandidate = 'Farmácia / Drogaria';
        } else if (/\b(restaurante|marmitaria|marmita|comida fitness|buffet|hamburgueria|pizzaria)\b/i.test(textToTest)) {
          categoryCandidate = 'Restaurante / Marmitaria';
        } else if (/\b(pet shop|veterinari|banho e tosa)\b/i.test(textToTest)) {
          categoryCandidate = 'Pet Shop / Veterinária';
        } else if (/\b(nutri|nutricionista|nutrolog|nutricao|dieta)\b/i.test(textToTest)) {
          categoryCandidate = 'Nutricionista';
        } else if (/\b(dentista|odonto|odontologia|ortodontia)\b/i.test(textToTest)) {
          categoryCandidate = 'Odontologia';
        }
      }

      // Fallback heuristics: check every part for phone and URLs
      for (const p of parts) {
        // Detect links
        const urlInfo = classifyUrl(p);
        if (urlInfo) {
          if (urlInfo.isGoogleMaps && !googleMapsUrl) {
            googleMapsUrl = urlInfo.cleanUrl;
          } else if (!urlInfo.isGoogleMaps && !websiteUrl) {
            websiteUrl = urlInfo.cleanUrl;
          }
        }

        // Detect phone
        if (!phoneCandidate) {
          const digits = p.replace(/\D/g, '');
          if (digits.length >= 8 && digits.length <= 13) {
            phoneCandidate = digits;
          }
        }
      }

      // Regex fallback for phone in full line
      if (!phoneCandidate) {
        const matchDigits = line.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}/);
        if (matchDigits) {
          phoneCandidate = matchDigits[0].replace(/\D/g, '');
        }
      }

      // Company fallback: use first part if empty
      if (!company) {
        // Exclude if first part was purely a phone or URL
        if (parts[0] && !parts[0].replace(/\D/g, '').length && !classifyUrl(parts[0])) {
          company = parts[0];
        } else {
          company = `Lead ${i + 1}`;
        }
      }

      // Check rating if not found
      if (ratingCandidate === undefined) {
        const matchRating = line.match(/\b([1-5](?:[.,]\d)?)\s*(?:★|⭐|estrelas|nota)/i);
        if (matchRating) {
          ratingCandidate = parseFloat(matchRating[1].replace(',', '.'));
        }
      }

      // If no explicit Google Maps link, create search link
      if (!googleMapsUrl && company) {
        googleMapsUrl = buildGoogleMapsSearchUrl(company, cityCandidate || activeNiche.city);
      }

      // Check opportunity angle
      let oppAngle = '';
      if (!websiteUrl) {
        oppAngle = 'Sem site cadastrado no Google Meu Negócio';
      } else if (ratingCandidate && ratingCandidate >= 4.5) {
        oppAngle = 'Avaliação alta no Google, ideal para agendamento online';
      } else {
        oppAngle = 'Oportunidade de modernização de presença web';
      }

      if (phoneCandidate) {
        candidates.push({
          companyName: company,
          contactName: contactName || undefined,
          phone: cleanPhoneForWhatsApp(phoneCandidate),
          category: categoryCandidate || undefined,
          city: cityCandidate || activeNiche.city,
          address: addressCandidate || undefined,
          googleRating: ratingCandidate,
          googleMapsUrl: googleMapsUrl || undefined,
          websiteUrl: websiteUrl || undefined,
          recommendedScript: 'script1',
          opportunityAngle: oppAngle,
          selected: true,
          isEditing: false,
          originalLineNumber: i + 1,
        });
      }
    }

    return candidates;
  };

  // Validate and read spreadsheet file (strict blocking of Word, Slides, PDFs)
  const validateAndProcessFile = (file: File) => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();

    // 1. Explicitly block Word, Slides, PDFs
    const disallowedWord = ['.doc', '.docx', '.odt', '.rtf', '.pages', '.dot', '.dotx'];
    const disallowedPresentation = ['.ppt', '.pptx', '.pps', '.ppsx', '.odp', '.key'];
    const disallowedPdf = ['.pdf'];
    const disallowedMedia = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.mp3', '.zip', '.rar', '.7z'];

    if (disallowedWord.includes(ext)) {
      setErrorMessage(
        `❌ O arquivo "${file.name}" é um documento do Word (.doc/.docx). O sistema só aceita planilhas (.xlsx, .xls, .csv, .tsv). Por favor, exporte como planilha ou copie as linhas.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (disallowedPresentation.includes(ext)) {
      setErrorMessage(
        `❌ O arquivo "${file.name}" é uma apresentação de slides (.ppt/.pptx). Não é permitido. Envie um arquivo de planilha (.xlsx, .xls ou .csv).`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (disallowedPdf.includes(ext)) {
      setErrorMessage(
        `❌ O arquivo "${file.name}" é um documento PDF. O sistema requer planilha estruturada (.xlsx, .xls ou .csv).`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (disallowedMedia.includes(ext)) {
      setErrorMessage(
        `❌ Arquivo "${file.name}" inválido. Envie apenas planilhas (.xlsx, .xls, .csv ou .tsv).`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Validate allowed spreadsheet extensions
    const allowedExtensions = ['.xlsx', '.xls', '.csv', '.tsv', '.txt'];
    if (!allowedExtensions.includes(ext)) {
      setErrorMessage(
        `❌ Formato não suportado (${ext || 'sem extensão'}). Formatos aceitos: Excel (.xlsx, .xls) ou CSV (.csv, .tsv).`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setErrorMessage(null);
    setIsReadingFile(true);

    // 3. Process Excel formats (.xlsx, .xls) via SheetJS
    if (ext === '.xlsx' || ext === '.xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];

          if (!firstSheetName) {
            throw new Error('A planilha está vazia ou não possui abas válidas.');
          }

          const worksheet = workbook.Sheets[firstSheetName];
          const tsvText = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });

          if (!tsvText.trim()) {
            throw new Error(`A aba "${firstSheetName}" da planilha está vazia.`);
          }

          const lines = tsvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
          setRawText(tsvText);
          setUploadedFile({
            name: file.name,
            size: file.size,
            format: ext === '.xlsx' ? 'Excel (.xlsx)' : 'Excel (.xls)',
            sheetName: firstSheetName,
            rowCount: Math.max(0, lines.length - 1),
          });

          // Immediate extraction & preview with antiduplication
          const candidates = parseRawTextHeuristic(tsvText);
          if (candidates.length > 0) {
            runDeduplication(candidates);
          } else {
            setParsedCandidates([]);
            setDuplicateCandidates([]);
            setErrorMessage('Nenhum telefone válido foi detectado automaticamente. Você pode usar a análise com IA.');
          }
        } catch (err: any) {
          setErrorMessage(`Falha ao ler planilha Excel: ${err.message || 'Arquivo corrompido ou ilegível'}`);
        } finally {
          setIsReadingFile(false);
        }
      };
      reader.onerror = () => {
        setErrorMessage('Erro ao ler arquivo do computador.');
        setIsReadingFile(false);
      };
      reader.readAsArrayBuffer(file);
    } else {
      // 4. Process text-based spreadsheets (.csv, .tsv, .txt)
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = (e.target?.result as string) || '';
          if (!text.trim()) {
            throw new Error('O arquivo CSV selecionado está vazio.');
          }
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          setRawText(text);
          setUploadedFile({
            name: file.name,
            size: file.size,
            format: ext === '.csv' ? 'CSV (.csv)' : ext === '.tsv' ? 'TSV (.tsv)' : 'Texto (.txt)',
            rowCount: Math.max(0, lines.length - 1),
          });

          // Immediate extraction & preview with antiduplication
          const candidates = parseRawTextHeuristic(text);
          if (candidates.length > 0) {
            runDeduplication(candidates);
          } else {
            setParsedCandidates([]);
            setDuplicateCandidates([]);
            setErrorMessage('Nenhum telefone válido foi detectado automaticamente. Você pode usar a análise com IA.');
          }
        } catch (err: any) {
          setErrorMessage(`Falha ao ler arquivo CSV: ${err.message || 'Erro de leitura'}`);
        } finally {
          setIsReadingFile(false);
        }
      };
      reader.onerror = () => {
        setErrorMessage('Erro ao ler arquivo do computador.');
        setIsReadingFile(false);
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
  };

  const handleClearFile = () => {
    setUploadedFile(null);
    setRawText('');
    setRawParsedCandidates([]);
    setParsedCandidates([]);
    setDuplicateCandidates([]);
    setErrorMessage(null);
    setActiveCandidatesTab('unique');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRunHeuristicParse = () => {
    setErrorMessage(null);
    if (!rawText.trim()) {
      setErrorMessage(
        inputMethod === 'file'
          ? 'Escolha um arquivo de planilha (.xlsx, .csv) antes de processar.'
          : 'Cole os dados da planilha antes de processar.'
      );
      return;
    }
    const candidates = parseRawTextHeuristic(rawText);
    if (candidates.length === 0) {
      setErrorMessage('Nenhum número de telefone válido foi detectado nos dados fornecidos.');
      return;
    }
    runDeduplication(candidates);
  };

  const handleRunAiAnalysis = async () => {
    setErrorMessage(null);
    if (!rawText.trim()) {
      setErrorMessage(
        inputMethod === 'file'
          ? 'Escolha um arquivo de planilha (.xlsx, .csv) antes de analisar com IA.'
          : 'Cole os dados da planilha antes de analisar com IA.'
      );
      return;
    }

    setIsAnalyzingAi(true);
    try {
      const res = await fetch('/api/gemini/analyze-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          nicheName: activeNiche.name,
          defaultCity: activeNiche.city,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha no processamento pelo Gemini');
      }

      const data = await res.json();
      if (Array.isArray(data.leads) && data.leads.length > 0) {
        const formatted: ParsedLeadCandidate[] = data.leads.map((l: any, i: number) => {
          const comp = l.companyName || 'Empresa';
          const ct = l.city || activeNiche.city;
          const mapsUrl = l.googleMapsUrl || buildGoogleMapsSearchUrl(comp, ct);

          return {
            companyName: comp,
            contactName: l.contactName || undefined,
            phone: cleanPhoneForWhatsApp(l.phone || ''),
            city: ct,
            address: l.address || undefined,
            googleRating: typeof l.googleRating === 'number' ? l.googleRating : undefined,
            googleMapsUrl: mapsUrl,
            websiteUrl: l.websiteUrl || undefined,
            recommendedScript: (['script1', 'script2', 'script3'].includes(l.recommendedScript)
              ? l.recommendedScript
              : 'script1') as 'script1' | 'script2' | 'script3',
            opportunityAngle: l.opportunityAngle || 'Oportunidade de site moderno e agendamento online',
            selected: true,
            isEditing: false,
            originalLineNumber: i + 1,
          };
        });
        runDeduplication(formatted);
      } else {
        const fallbackCandidates = parseRawTextHeuristic(rawText);
        runDeduplication(fallbackCandidates);
      }
    } catch (err: any) {
      console.warn('AI Analysis fallback triggered:', err);
      const fallbackCandidates = parseRawTextHeuristic(rawText);
      runDeduplication(fallbackCandidates);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleLoadSampleLeads = () => {
    setUploadedFile(null);
    const sampleTsv = [
      'Empresa\tContato\tCategoria\tTelefone\tEndereço\tNota Google\tLink Maps\tSite\tCidade',
      ...SAMPLE_IMPORT_LEADS.map(
        (s) =>
          `${s.companyName}\t${s.contactName}\t${s.category || 'Nutricionista'}\t${s.phone}\t${s.address}\t${s.googleRating} ⭐\t${s.googleMapsUrl}\t${s.websiteUrl || ''}\t${s.city}`
      ),
    ].join('\n');

    setRawText(sampleTsv);
    const mapped: ParsedLeadCandidate[] = SAMPLE_IMPORT_LEADS.map((s, i) => ({
      companyName: s.companyName,
      contactName: s.contactName,
      phone: cleanPhoneForWhatsApp(s.phone),
      category: s.category,
      city: s.city,
      address: s.address,
      googleRating: s.googleRating,
      googleMapsUrl: s.googleMapsUrl,
      websiteUrl: s.websiteUrl,
      recommendedScript: s.recommendedScript as any,
      opportunityAngle: s.opportunityAngle,
      selected: true,
      isEditing: false,
      originalLineNumber: i + 1,
    }));
    runDeduplication(mapped);
    setErrorMessage(null);
  };

  const handleToggleCandidate = (index: number) => {
    setParsedCandidates((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleToggleAll = (select: boolean) => {
    setParsedCandidates((prev) => prev.map((c) => ({ ...c, selected: select })));
  };

  const handleToggleEditCandidate = (index: number) => {
    setParsedCandidates((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, isEditing: !c.isEditing } : c))
    );
  };

  const handleUpdateCandidateField = (index: number, field: keyof ParsedLeadCandidate, value: any) => {
    setParsedCandidates((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, [field]: value } : c))
    );
  };

  const handleCommitImport = () => {
    const selected = parsedCandidates.filter((c) => c.selected);
    if (selected.length === 0) {
      setErrorMessage('Selecione pelo menos um lead para importar.');
      return;
    }

    const payload: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[] = selected.map((c) => ({
      companyName: c.companyName,
      contactName: c.contactName,
      phone: c.phone,
      displayPhone: formatDisplayPhone(c.phone),
      category: c.category,
      city: c.city || activeNiche.city,
      address: c.address,
      googleRating: c.googleRating,
      googleMapsUrl: c.googleMapsUrl,
      websiteUrl: c.websiteUrl,
      stage: 'nao_iniciada',
      scriptUsed: c.recommendedScript || 'script1',
      opportunityAngle: c.opportunityAngle,
    }));

    if (destinationMode === 'current') {
      onImportLeadsToNiche(activeNiche.id, payload);
    } else {
      if (!newNicheName.trim()) {
        setErrorMessage('Informe um nome para a nova campanha.');
        return;
      }
      onCreateNicheWithLeads(
        {
          name: newNicheName.trim(),
          segment: newNicheSegment.trim() || newNicheName.trim(),
          city: newNicheCity.trim() || activeNiche.city,
          emoji: newNicheEmoji || '💼',
        },
        payload
      );
    }

    setSuccessCount(payload.length);
    setRawParsedCandidates([]);
    setParsedCandidates([]);
    setDuplicateCandidates([]);
    setRawText('');
    setUploadedFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const duplicatesOnly = duplicateCandidates.filter((d) => d.matchType !== 'incompatible_category');
  const categoryExclusions = duplicateCandidates.filter((d) => d.matchType === 'incompatible_category');

  const filteredDuplicates = duplicateCandidates.filter((dup) => {
    // If viewing duplicates tab, only show phone/name/crm duplicates
    if (activeCandidatesTab === 'duplicates' && dup.matchType === 'incompatible_category') return false;
    // If viewing category exclusions tab, only show incompatible_category
    if (activeCandidatesTab === 'incompatible_category' && dup.matchType !== 'incompatible_category') return false;

    if (!duplicateSearch.trim()) return true;
    const q = duplicateSearch.toLowerCase();
    return (
      dup.candidate.companyName.toLowerCase().includes(q) ||
      (dup.candidate.contactName && dup.candidate.contactName.toLowerCase().includes(q)) ||
      (dup.candidate.category && dup.candidate.category.toLowerCase().includes(q)) ||
      dup.candidate.phone.includes(q) ||
      dup.reason.toLowerCase().includes(q) ||
      dup.matchedWith.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>📥 Importador de Planilhas & Google Meu Negócio</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Reconhecimento inteligente de nome, telefone WhatsApp, links do Google Meu Negócio/Maps e site. A prévia já identifica tudo automaticamente.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadSampleLeads}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-blue-600" />
          <span>Carregar Exemplo com Links do Maps</span>
        </button>
      </div>

      {/* Success Notification */}
      {successCount !== null && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              <strong>{successCount} leads importados com sucesso!</strong> Os contatos com telefones e links do Google Meu Negócio foram organizados na coluna <em>1. Não Iniciada</em>.
            </span>
          </div>
          <button
            onClick={() => {
              setSuccessCount(null);
              onSwitchToKanban();
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Ver no Kanban
          </button>
        </div>
      )}

      {/* Error alert with strict format reminder */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{errorMessage}</p>
            <p className="text-[11px] text-rose-600 mt-1">
              Formatos aceitos: <strong>.xlsx, .xls, .csv, .tsv</strong>. Não é permitido: Word (.doc/.docx), apresentações (.ppt/.pptx) ou PDFs.
            </p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Input Area (File or Text) & Destination Option */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: File Upload or Raw Data */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          {/* Method Selector Tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setInputMethod('file')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  inputMethod === 'file'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderUp className="w-3.5 h-3.5" />
                <span>Escolher Arquivo de Planilha</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMethod('text')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  inputMethod === 'text'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Colar Texto / Tabela Livre</span>
              </button>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium">
                Aceita: Excel (.xlsx, .xls) e CSV
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium hidden sm:inline">
                Bloqueia Word e Slides
              </span>
            </div>
          </div>

          {/* Mode 1: File Picker & Drag-and-Drop Area */}
          {inputMethod === 'file' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, .tsv, .txt, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/tab-separated-values"
                onChange={handleFileInputChange}
                className="hidden"
                id="spreadsheet-file-input"
              />

              {!uploadedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/80 scale-[1.005]'
                      : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/70 bg-slate-50/30'
                  }`}
                >
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs">
                      {isReadingFile ? (
                        <RotateCcw className="w-6 h-6 animate-spin text-blue-600" />
                      ) : (
                        <UploadCloud className="w-6 h-6" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {isReadingFile
                          ? 'Identificando dados e contatos da planilha...'
                          : 'Clique para escolher a planilha ou arraste o arquivo aqui'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Formatos aceitos: <strong>Excel (.xlsx, .xls)</strong> e <strong>CSV (.csv, .tsv)</strong>
                      </p>
                    </div>

                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors">
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Selecionar Arquivo do Computador</span>
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Documentos do Word (.doc/.docx) ou slides (.ppt) não são aceitos</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Card for Already Uploaded File */
                <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[260px]">
                          {uploadedFile.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                          {uploadedFile.format}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{formatFileSize(uploadedFile.size)}</span>
                        <span>•</span>
                        <span>
                          <strong>{uploadedFile.rowCount}</strong> linhas de contatos analisadas
                        </span>
                        {uploadedFile.sheetName && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600">Aba: {uploadedFile.sheetName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setShowRawTextPreview(!showRawTextPreview)}
                      className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span>{showRawTextPreview ? 'Ocultar Linhas' : 'Ver Linhas'}</span>
                      {showRawTextPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-blue-700 hover:text-blue-800 font-semibold px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      Trocar Arquivo
                    </button>

                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remover arquivo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Collapsible raw text preview */}
              {showRawTextPreview && uploadedFile && rawText && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                    <span>Linhas brutas da planilha:</span>
                    <span>Mostrando início</span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-700 max-h-36 overflow-y-auto whitespace-pre-wrap bg-white p-2.5 rounded border border-slate-200">
                    {rawText.slice(0, 1500)}
                    {rawText.length > 1500 && '\n... [dados adicionais carregados]'}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Paste Raw Text Area */}
          {inputMethod === 'text' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Cole os dados copiados do Excel, Google Sheets, Maps ou Bloco de Notas:
                </span>
                <span className="text-[11px] text-slate-400">Aceita links, telefones e nomes</span>
              </div>

              <textarea
                rows={7}
                value={rawText}
                onChange={(e) => {
                  const val = e.target.value;
                  setRawText(val);
                  setUploadedFile(null);
                  if (val.trim()) {
                    const candidates = parseRawTextHeuristic(val);
                    if (candidates.length > 0) {
                      runDeduplication(candidates);
                    }
                  }
                }}
                placeholder="Exemplo de dados colados:
Clínica Odonto Prime	Dra. Camila	11988887777	https://maps.google.com/?q=Odonto+Prime	4.9 ⭐	São Paulo - SP
Sorriso & Arte Odonto	Dr. Fernando	11977776666	https://goo.gl/maps/sorriso	4.8 ⭐	São Paulo - SP"
                className="w-full text-xs p-3 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-slate-50"
              />
            </div>
          )}

          {/* Action Buttons: Fast Heuristic vs Gemini AI */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunHeuristicParse}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                <span>Atualizar Prévia dos Dados</span>
              </button>

              <button
                type="button"
                onClick={handleRunAiAnalysis}
                disabled={isAnalyzingAi}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAnalyzingAi ? 'Analisando com IA (Gemini)...' : 'Enriquecer com IA (Gemini)'}</span>
              </button>
            </div>

            {parsedCandidates.length > 0 && (
              <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{parsedCandidates.length} contatos prontos com informações extraídas</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Destination Config (Option A vs Option B) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block border-b border-slate-100 pb-2">
            Destino dos Leads
          </span>

          <div className="space-y-2">
            {/* Option A */}
            <label
              className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                destinationMode === 'current'
                  ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-300'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="destination"
                  checked={destinationMode === 'current'}
                  onChange={() => setDestinationMode('current')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Opção A: Importar para o Nicho Atual
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {activeNiche.emoji} {activeNiche.name} ({activeNiche.city})
                  </div>
                </div>
              </div>
            </label>

            {/* Option B */}
            <label
              className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                destinationMode === 'new'
                  ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-300'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="destination"
                  checked={destinationMode === 'new'}
                  onChange={() => setDestinationMode('new')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Opção B: Criar Novo Nicho Automático
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Cria uma nova campanha isolada para esta planilha
                  </div>
                </div>
              </div>
            </label>
          </div>

          {/* New Niche Inputs (if Option B selected) */}
          {destinationMode === 'new' && (
            <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Emoji</label>
                  <input
                    type="text"
                    value={newNicheEmoji}
                    onChange={(e) => setNewNicheEmoji(e.target.value)}
                    maxLength={2}
                    className="w-full text-center text-sm px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Nome da Campanha *
                  </label>
                  <input
                    type="text"
                    value={newNicheName}
                    onChange={(e) => setNewNicheName(e.target.value)}
                    placeholder="Ex: Advogados - SP"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Segmento de Mercado
                </label>
                <input
                  type="text"
                  value={newNicheSegment}
                  onChange={(e) => setNewNicheSegment(e.target.value)}
                  placeholder="Ex: Escritórios de Advocacia"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Cidade Principal
                </label>
                <input
                  type="text"
                  value={newNicheCity}
                  onChange={(e) => setNewNicheCity(e.target.value)}
                  placeholder="Ex: São Paulo - SP"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Live Candidates Preview Table with Antiduplication Panel */}
      {(parsedCandidates.length > 0 || duplicateCandidates.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 animate-in fade-in duration-200">
          {/* Antiduplication & Niche Category Control Panel & Status */}
          <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-emerald-50/70 border border-blue-200/80 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">
                      Filtro Antiduplicidade & Nicho Ativo
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {parsedCandidates.length} No Nicho Mantidos
                    </span>
                    {duplicatesOnly.length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Trash2 className="w-3 h-3 text-amber-700" />
                        {duplicatesOnly.length} Repetidos Excluídos
                      </span>
                    )}
                    {categoryExclusions.length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <Ban className="w-3 h-3 text-rose-700" />
                        {categoryExclusions.length} Fora do Nicho Excluídos
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {categoryExclusions.length > 0 || duplicatesOnly.length > 0 ? (
                      <span>
                        Analisamos {rawParsedCandidates.length} registros para a campanha{' '}
                        <strong>{destinationMode === 'current' ? activeNiche.name : newNicheName || activeNiche.name}</strong>.
                        {categoryExclusions.length > 0 && (
                          <span className="text-rose-700 font-medium">
                            {' '}{categoryExclusions.length} estabelecimentos com categorias fora do nicho (como Academia, Loja de Suplementos) foram excluídos automaticamente.{' '}
                          </span>
                        )}
                        {duplicatesOnly.length > 0 && (
                          <span className="text-amber-800">
                            {duplicatesOnly.length} contatos repetidos foram excluídos.{' '}
                          </span>
                        )}
                        Apenas contatos únicos pertencentes ao nicho serão importados.
                      </span>
                    ) : (
                      'Nenhum contato repetido ou categoria fora do nicho foi detectado. Todos os dados são 100% únicos e compatíveis!'
                    )}
                  </p>
                </div>
              </div>

              {/* Action buttons in header */}
              {(duplicatesOnly.length > 0 || categoryExclusions.length > 0) && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {duplicatesOnly.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveCandidatesTab(activeCandidatesTab === 'duplicates' ? 'unique' : 'duplicates')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-2xs ${
                        activeCandidatesTab === 'duplicates'
                          ? 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700'
                          : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      <CopyX className="w-3.5 h-3.5" />
                      <span>
                        {activeCandidatesTab === 'duplicates'
                          ? 'Voltar aos Únicos'
                          : `Ver ${duplicatesOnly.length} Repetidos`}
                      </span>
                    </button>
                  )}

                  {categoryExclusions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveCandidatesTab(activeCandidatesTab === 'incompatible_category' ? 'unique' : 'incompatible_category')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-2xs ${
                        activeCandidatesTab === 'incompatible_category'
                          ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                          : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50'
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>
                        {activeCandidatesTab === 'incompatible_category'
                          ? 'Voltar aos Únicos'
                          : `Ver ${categoryExclusions.length} Fora do Nicho`}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Criteria check filters */}
            <div className="pt-2 border-t border-blue-200/50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-blue-600" />
                  Critérios de Análise:
                </span>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                  <input
                    type="checkbox"
                    checked={dedupCheckPhone}
                    onChange={(e) => handleToggleDedupPhone(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] font-medium">Por Telefone / WhatsApp</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                  <input
                    type="checkbox"
                    checked={dedupCheckName}
                    onChange={(e) => handleToggleDedupName(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] font-medium">Por Nome (Empresa ou Contato)</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                  <input
                    type="checkbox"
                    checked={dedupCheckCategory}
                    onChange={(e) => handleToggleDedupCategory(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1">
                    <Ban className="w-3 h-3 text-rose-600" />
                    Excluir Categorias Fora do Nicho ({activeNiche.name.split('&')[0].trim()})
                  </span>
                </label>

                {existingLeads && existingLeads.length > 0 && destinationMode === 'current' && (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                    <input
                      type="checkbox"
                      checked={dedupCheckCrm}
                      onChange={(e) => handleToggleDedupCrm(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-[11px] font-medium">Checar com CRM Atual ({activeNiche.name})</span>
                  </label>
                )}

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                  <input
                    type="checkbox"
                    checked={dedupAutoExclude}
                    onChange={(e) => handleToggleAutoExclude(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold text-blue-900">Excluir Automaticamente</span>
                </label>
              </div>

              {duplicateCandidates.length > 0 && (
                <button
                  type="button"
                  onClick={handleRestoreAllDuplicates}
                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center gap-1"
                  title="Restaurar todos os contatos excluídos para a lista de importação"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Restaurar todos os excluídos</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs (Contatos no Nicho vs Repetidos vs Fora do Nicho) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveCandidatesTab('unique')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeCandidatesTab === 'unique'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>✨ Contatos no Nicho ({parsedCandidates.length})</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeCandidatesTab === 'unique' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {parsedCandidates.filter((c) => c.selected).length} selecionados
                </span>
              </button>

              {duplicatesOnly.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveCandidatesTab('duplicates')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeCandidatesTab === 'duplicates'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <CopyX className="w-3.5 h-3.5" />
                  <span>🗑️ Repetidos Excluídos ({duplicatesOnly.length})</span>
                </button>
              )}

              {categoryExclusions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveCandidatesTab('incompatible_category')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeCandidatesTab === 'incompatible_category'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>🚫 Fora do Nicho Excluídos ({categoryExclusions.length})</span>
                </button>
              )}
            </div>

            {/* Quick Actions per Tab */}
            {activeCandidatesTab === 'unique' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleAll(true)}
                  className="text-xs text-blue-600 hover:underline cursor-pointer"
                >
                  Marcar Todos
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => handleToggleAll(false)}
                  className="text-xs text-slate-500 hover:underline cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={duplicateSearch}
                  onChange={(e) => setDuplicateSearch(e.target.value)}
                  placeholder={activeCandidatesTab === 'incompatible_category' ? 'Filtrar fora do nicho...' : 'Filtrar repetidos...'}
                  className="text-xs px-2.5 py-1 border border-slate-300 rounded-lg text-slate-800 bg-white"
                />
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[500px]">
            {activeCandidatesTab === 'unique' ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-8"></th>
                    <th className="py-2.5 px-3 min-w-[200px]">Empresa / Contato</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Categoria</th>
                    <th className="py-2.5 px-3 min-w-[160px]">WhatsApp (+55)</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Google Meu Negócio & Links</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Localização</th>
                    <th className="py-2.5 px-3 min-w-[80px]">Nota</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Oportunidade / Gancho</th>
                    <th className="py-2.5 px-3 w-16 text-center">Editar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedCandidates.map((candidate, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        candidate.selected ? 'bg-blue-50/15' : 'opacity-60'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={candidate.selected}
                          onChange={() => handleToggleCandidate(idx)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Company & Contact Name */}
                      <td className="py-2.5 px-3">
                        {candidate.isEditing ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={candidate.companyName}
                              onChange={(e) => handleUpdateCandidateField(idx, 'companyName', e.target.value)}
                              placeholder="Nome da Empresa"
                              className="w-full text-xs px-2 py-1 border border-slate-300 rounded font-medium text-slate-900"
                            />
                            <input
                              type="text"
                              value={candidate.contactName || ''}
                              onChange={(e) => handleUpdateCandidateField(idx, 'contactName', e.target.value)}
                              placeholder="Nome do Contato (ex: Dr. Carlos)"
                              className="w-full text-[11px] px-2 py-0.5 border border-slate-300 rounded text-slate-600"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{candidate.companyName}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                No Nicho
                              </span>
                            </div>
                            {candidate.contactName && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-blue-500" />
                                <span>{candidate.contactName}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-2.5 px-3">
                        {candidate.isEditing ? (
                          <input
                            type="text"
                            value={candidate.category || ''}
                            onChange={(e) => handleUpdateCandidateField(idx, 'category', e.target.value)}
                            placeholder="Categoria"
                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded text-slate-800"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            <Tag className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            <span className="truncate max-w-[120px]">{candidate.category || 'Nutricionista'}</span>
                          </span>
                        )}
                      </td>

                      {/* WhatsApp Formatted Phone */}
                      <td className="py-2.5 px-3">
                        {candidate.isEditing ? (
                          <input
                            type="text"
                            value={candidate.phone}
                            onChange={(e) => handleUpdateCandidateField(idx, 'phone', cleanPhoneForWhatsApp(e.target.value))}
                            placeholder="DDD + Número"
                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded font-mono text-emerald-700"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`https://wa.me/${candidate.phone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 p-1 hover:bg-emerald-50 rounded transition-colors"
                              title="Testar conversa no WhatsApp"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <span className="font-mono tabular-nums text-emerald-800 font-semibold">
                              {formatDisplayPhone(candidate.phone)}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Google My Business & Web Links */}
                      <td className="py-2.5 px-3">
                        {candidate.isEditing ? (
                          <div className="space-y-1">
                            <input
                              type="url"
                              value={candidate.googleMapsUrl || ''}
                              onChange={(e) => handleUpdateCandidateField(idx, 'googleMapsUrl', e.target.value)}
                              placeholder="Link do Google Meu Negócio / Maps"
                              className="w-full text-[11px] px-2 py-0.5 border border-slate-300 rounded font-mono text-blue-600"
                            />
                            <input
                              type="url"
                              value={candidate.websiteUrl || ''}
                              onChange={(e) => handleUpdateCandidateField(idx, 'websiteUrl', e.target.value)}
                              placeholder="Site atual ou rede social"
                              className="w-full text-[11px] px-2 py-0.5 border border-slate-300 rounded font-mono text-slate-600"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 items-start">
                            {/* Google Maps / GMB Link */}
                            {candidate.googleMapsUrl && (
                              <a
                                href={candidate.googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-900 border border-blue-200/60 transition-colors"
                                title="Abrir perfil no Google Meu Negócio / Maps"
                              >
                                <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                                <span className="truncate max-w-[130px]">Google Meu Negócio</span>
                                <ExternalLink className="w-2.5 h-2.5 ml-0.5 shrink-0" />
                              </a>
                            )}

                            {/* Website or Social Link */}
                            {candidate.websiteUrl && (
                              <a
                                href={candidate.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                                title={candidate.websiteUrl}
                              >
                                <Globe className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                <span className="truncate max-w-[120px]">
                                  {candidate.websiteUrl.replace(/^https?:\/\/(www\.)?/, '')}
                                </span>
                                <ExternalLink className="w-2 h-2 ml-0.5 shrink-0" />
                              </a>
                            )}

                            {!candidate.googleMapsUrl && !candidate.websiteUrl && (
                              <span className="text-[11px] text-slate-400 italic">Nenhum link detectado</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3">
                        {candidate.isEditing ? (
                          <input
                            type="text"
                            value={candidate.address || candidate.city || ''}
                            onChange={(e) => handleUpdateCandidateField(idx, 'address', e.target.value)}
                            placeholder="Endereço / Cidade"
                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded text-slate-700"
                          />
                        ) : (
                          <div className="text-slate-600 text-[11px]">
                            <div className="font-medium text-slate-800 truncate max-w-[130px]">
                              {candidate.city || activeNiche.city}
                            </div>
                            {candidate.address && (
                              <div className="text-slate-500 truncate max-w-[130px] mt-0.5">
                                {candidate.address}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Rating */}
                      <td className="py-2.5 px-3 font-mono">
                        {candidate.isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="5"
                            value={candidate.googleRating || ''}
                            onChange={(e) =>
                              handleUpdateCandidateField(idx, 'googleRating', e.target.value ? parseFloat(e.target.value) : undefined)
                            }
                            placeholder="4.8"
                            className="w-14 text-xs px-1.5 py-1 border border-slate-300 rounded font-mono"
                          />
                        ) : candidate.googleRating ? (
                          <span className="flex items-center gap-0.5 text-amber-600 font-semibold text-xs">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{candidate.googleRating}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Opportunity / Script */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {candidate.recommendedScript === 'script1'
                              ? 'Script 1 · Mockup'
                              : candidate.recommendedScript === 'script2'
                              ? 'Script 2 · Google'
                              : 'Script 3 · Cold Call'}
                          </span>
                          <div className="text-slate-500 text-[11px] truncate max-w-[180px]">
                            {candidate.opportunityAngle || 'Oportunidade de site moderno'}
                          </div>
                        </div>
                      </td>

                      {/* Edit button */}
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleEditCandidate(idx)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            candidate.isEditing
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title={candidate.isEditing ? 'Salvar edição' : 'Editar dados'}
                        >
                          {candidate.isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeCandidatesTab === 'duplicates' ? (
              /* Repetidos Excluídos Table */
              <div>
                {filteredDuplicates.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="text-xs font-semibold text-slate-800">
                      {duplicateSearch ? 'Nenhum contato repetido corresponde à sua busca.' : 'Nenhum contato repetido pendente!'}
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Todos os contatos da sua planilha estão na lista de contatos únicos mantidos para importação.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-amber-50/80 text-amber-900 border-b border-amber-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-16">Linha</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Empresa / Contato</th>
                        <th className="py-2.5 px-3 min-w-[150px]">WhatsApp</th>
                        <th className="py-2.5 px-3 min-w-[260px]">Motivo da Duplicação</th>
                        <th className="py-2.5 px-3 min-w-[120px]">Status</th>
                        <th className="py-2.5 px-3 min-w-[140px] text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100/70 bg-amber-50/20">
                      {filteredDuplicates.map((dup) => (
                        <tr key={dup.id} className="hover:bg-amber-50/50 transition-colors">
                          {/* Original line */}
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Linha {dup.originalIndex}
                            </span>
                          </td>

                          {/* Company / Contact */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">
                              {dup.candidate.companyName}
                            </div>
                            {dup.candidate.contactName && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-blue-500" />
                                <span>{dup.candidate.contactName}</span>
                              </div>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono tabular-nums text-slate-800 font-medium">
                              {formatDisplayPhone(dup.candidate.phone)}
                            </span>
                          </td>

                          {/* Duplicate Reason Details */}
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                {dup.matchType === 'phone' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-rose-700" />
                                    Telefone Duplicado
                                  </span>
                                ) : dup.matchType === 'name' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                    <Building2 className="w-3 h-3 text-amber-700" />
                                    Nome Duplicado
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-blue-700" />
                                    Já Existe no CRM
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-700 leading-tight">
                                {dup.reason}
                              </p>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                              <X className="w-3 h-3" />
                              Repetido Excluído
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRestoreDuplicate(dup)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                              title="Restaurar este contato para importar junto com os únicos"
                            >
                              <Undo2 className="w-3 h-3" />
                              <span>Restaurar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              /* Fora do Nicho Excluídos Table */
              <div>
                {filteredDuplicates.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="text-xs font-semibold text-slate-800">
                      {duplicateSearch ? 'Nenhum estabelecimento corresponde à sua busca.' : 'Nenhum contato fora do nicho pendente!'}
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Todos os contatos da planilha correspondem perfeitamente ao nicho de {activeNiche.name}.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-rose-50/90 text-rose-900 border-b border-rose-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-16">Linha</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Empresa / Contato</th>
                        <th className="py-2.5 px-3 min-w-[160px]">Categoria Detectada</th>
                        <th className="py-2.5 px-3 min-w-[150px]">WhatsApp</th>
                        <th className="py-2.5 px-3 min-w-[280px]">Motivo da Exclusão do Nicho</th>
                        <th className="py-2.5 px-3 min-w-[130px]">Status</th>
                        <th className="py-2.5 px-3 min-w-[140px] text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100/70 bg-rose-50/15">
                      {filteredDuplicates.map((dup) => (
                        <tr key={dup.id} className="hover:bg-rose-50/40 transition-colors">
                          {/* Original line */}
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Linha {dup.originalIndex}
                            </span>
                          </td>

                          {/* Company / Contact */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">
                              {dup.candidate.companyName}
                            </div>
                            {dup.candidate.contactName && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-blue-500" />
                                <span>{dup.candidate.contactName}</span>
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <Ban className="w-3 h-3 text-rose-600" />
                              <span>{dup.candidate.category || dup.matchedWith || 'Fora do nicho'}</span>
                            </span>
                          </td>

                          {/* Phone */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono tabular-nums text-slate-800 font-medium">
                              {formatDisplayPhone(dup.candidate.phone)}
                            </span>
                          </td>

                          {/* Incompatible Reason */}
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <p className="text-[11px] text-rose-950 font-medium leading-tight">
                                {dup.reason}
                              </p>
                              <span className="text-[10px] text-slate-500">
                                Não corresponde ao perfil de {activeNiche.name.split('&')[0].trim()}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <Ban className="w-3 h-3" />
                              Fora do Nicho
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRestoreDuplicate(dup)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                              title="Restaurar este contato caso deseje incluí-lo na importação"
                            >
                              <Undo2 className="w-3 h-3" />
                              <span>Restaurar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {activeCandidatesTab === 'unique' ? (
              <>
                <div className="text-xs text-slate-600">
                  Total a importar:{' '}
                  <strong className="text-slate-900 font-bold">
                    {parsedCandidates.filter((c) => c.selected).length} leads no nicho
                  </strong>{' '}
                  {(duplicatesOnly.length > 0 || categoryExclusions.length > 0) && (
                    <span className="text-slate-500 font-medium">
                      ({duplicatesOnly.length > 0 ? `${duplicatesOnly.length} repetidos` : ''}
                      {duplicatesOnly.length > 0 && categoryExclusions.length > 0 ? ' e ' : ''}
                      {categoryExclusions.length > 0 ? `${categoryExclusions.length} fora do nicho excluídos automaticamente` : ' excluídos automaticamente'})
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCommitImport}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {destinationMode === 'current'
                      ? `Confirmar e Importar ${parsedCandidates.filter((c) => c.selected).length} Leads do Nicho para ${activeNiche.name}`
                      : `Criar Novo Nicho e Importar ${parsedCandidates.filter((c) => c.selected).length} Leads do Nicho`}
                  </span>
                </button>
              </>
            ) : activeCandidatesTab === 'duplicates' ? (
              <>
                <div className="text-xs text-amber-900 font-medium">
                  {duplicatesOnly.length} contatos repetidos por telefone ou nome foram excluídos automaticamente da lista de importação.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreOnlyDuplicates}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Restaurar Todos os {duplicatesOnly.length} Repetidos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveCandidatesTab('unique')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Voltar aos Contatos no Nicho ({parsedCandidates.length})</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-rose-900 font-medium">
                  {categoryExclusions.length} estabelecimentos com categorias fora do nicho (como Academia, Loja de Suplementos) foram excluídos da planilha.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreOnlyCategoryExclusions}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-lg transition-colors cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Restaurar Todos os {categoryExclusions.length} Fora do Nicho</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveCandidatesTab('unique')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Voltar aos Contatos no Nicho ({parsedCandidates.length})</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
