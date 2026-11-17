import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { NicheCampaign, Lead, ImportedSheet } from '../types/crm';
import { cleanPhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';
import { SAMPLE_IMPORT_LEADS } from '../utils/initialData';
import { ConfirmDialog } from './ui';
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
  Ban,
  Bot,
  Send
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
  importedSheets?: ImportedSheet[];
  onImportLeadsToNiche: (
    nicheId: string,
    leads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[],
    sheetMetadata?: { name: string; format?: string; size?: number }
  ) => void;
  onCreateNicheWithLeads: (
    newNiche: { name: string; segment: string; city: string; emoji: string },
    leads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[],
    sheetMetadata?: { name: string; format?: string; size?: number }
  ) => void;
  onDeleteImportedSheet?: (sheetId: string) => void;
  onDeleteLeads?: (leadIds: string[]) => void;
  onSwitchToKanban: () => void;
}

export const ImporterView: React.FC<ImporterViewProps> = ({
  activeNiche,
  existingLeads,
  importedSheets = [],
  onImportLeadsToNiche,
  onCreateNicheWithLeads,
  onDeleteImportedSheet,
  onDeleteLeads,
  onSwitchToKanban,
}) => {
  const [inputMethod, setInputMethod] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [showRawTextPreview, setShowRawTextPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [newNicheName, setNewNicheName] = useState('');
  const [newNicheSegment, setNewNicheSegment] = useState('');
  const [newNicheCity, setNewNicheCity] = useState(activeNiche.city);
  const [newNicheEmoji, setNewNicheEmoji] = useState('💆‍♀️');
  const [sheetToDelete, setSheetToDelete] = useState<ImportedSheet | null>(null);

  // Candidate leads: raw from spreadsheet, unique (kept), and duplicates (excluded)
  const [rawParsedCandidates, setRawParsedCandidates] = useState<ParsedLeadCandidate[]>([]);
  const [parsedCandidates, setParsedCandidates] = useState<ParsedLeadCandidate[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateDetail[]>([]);
  const [activeCandidatesTab, setActiveCandidatesTab] = useState<'unique' | 'duplicates' | 'incompatible_category' | 'category_excluded'>('unique');
  const [duplicateSearch, setDuplicateSearch] = useState('');

  // Category Exclusion Filter (Direct, Deterministic, 100% Client-Side)
  const [categorySearchOrSelect, setCategorySearchOrSelect] = useState('');
  const [categoryFeedbackMessage, setCategoryFeedbackMessage] = useState<string | null>(null);
  const [categoryExcludedLeads, setCategoryExcludedLeads] = useState<{
    id: string;
    candidate: ParsedLeadCandidate;
    reason: string;
    matchedCategory: string;
    query: string;
    originalIndex: number;
  }[]>([]);
  const [excludedCategoriesList, setExcludedCategoriesList] = useState<string[]>([]);
  const [filterUndoStack, setFilterUndoStack] = useState<{
    candidates: ParsedLeadCandidate[];
    excluded: {
      id: string;
      candidate: ParsedLeadCandidate;
      reason: string;
      matchedCategory: string;
      query: string;
      originalIndex: number;
    }[];
    excludedCategories: string[];
  }[]>([]);

  // Antiduplication & Niche Category filters
  const [dedupCheckPhone, setDedupCheckPhone] = useState(true);
  const [dedupCheckName, setDedupCheckName] = useState(false);
  const [dedupCheckCrm, setDedupCheckCrm] = useState(false);
  const [dedupCheckCategory, setDedupCheckCategory] = useState(false);
  const [dedupAutoExclude, setDedupAutoExclude] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Check if a category / company belongs or is incompatible with the active campaign niche
  // Check if a category / company belongs or is incompatible with the target campaign niche
  const checkNicheCategoryRelevance = (
    rawCategory: string | undefined,
    companyName: string,
    targetName: string,
    targetSegment: string
  ): { isIncompatible: boolean; reason: string; matchedCategory: string } => {
    const normCat = (rawCategory || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const normCompany = (companyName || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const normTarget = `${targetName} ${targetSegment}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const combinedText = `${normCat} ${normCompany}`;

    // 1. Clínicas de Estética / Beleza / Harmonização / Dermatologia
    const isEstetica =
      normTarget.includes('estetica') ||
      normTarget.includes('beleza') ||
      normTarget.includes('harmonizac') ||
      normTarget.includes('dermatolog') ||
      normTarget.includes('depilac') ||
      normTarget.includes('spa') ||
      normTarget.includes('sobrancelha');

    if (isEstetica) {
      const hasEsteticaCore = /\b(estetica|esteticista|harmonizacao|beleza|dermatolog|laser|depilacao|facial|corporal|sobrancelha|micropigmentacao|spa|biomedicina|cosmetologia|massagem)\b/i.test(combinedText);
      const incompatibleRules = [
        { pattern: /\b(dentista|odonto|odontologia|ortodontia|protese dentaria|consultorio odontologico|implantodontia)\b/i, label: 'Dentistas / Odontologia' },
        { pattern: /\b(academia|academias|crossfit|gym|fitness|musculacao|centro de treinamento|box de crossfit)\b/i, label: 'Academia / Centro Fitness' },
        { pattern: /\b(suplemento|suplementos|loja de suplementos|produtos naturais|whey)\b/i, label: 'Loja de Suplementos' },
        { pattern: /\b(farmacia|drogaria|remedios|medicamentos)\b/i, label: 'Farmácia / Drogaria' },
        { pattern: /\b(mecanica|auto pecas|oficina|funilaria|auto center|lanternagem|borracharia)\b/i, label: 'Oficina Mecânica' },
        { pattern: /\b(advocacia|advogado|juridico|escritorio de advocacia|direito)\b/i, label: 'Escritório de Advocacia' },
        { pattern: /\b(restaurante|pizzaria|hamburgueria|lanchonete|marmitaria|buffet)\b/i, label: 'Restaurante / Alimentação' },
        { pattern: /\b(pet shop|veterinari[ao]|agropecuaria|banho e tosa)\b/i, label: 'Pet Shop / Veterinária' },
        { pattern: /\b(otica|oticas|contabilidade|imobiliaria)\b/i, label: 'Setor Comercial Distinto' },
      ];

      for (const rule of incompatibleRules) {
        if (rule.pattern.test(normCat) || rule.pattern.test(normCompany)) {
          if (!hasEsteticaCore) {
            return {
              isIncompatible: true,
              reason: `Categoria "${rawCategory || rule.label}" é ${rule.label}, fora do nicho de Clínicas de Estética.`,
              matchedCategory: rule.label,
            };
          }
        }
      }
    }

    // 2. Nutricionistas & Nutrologia Rules
    const isNutri =
      normTarget.includes('nutri') ||
      normTarget.includes('nutricionista') ||
      normTarget.includes('nutrolog');

    if (isNutri) {
      const hasNutriCore = /\b(nutri|nutricionista|nutrolog[ao]|nutricao|dieta|consultorio de nutricao|emagrecimento integrativo|nutri infantil)\b/i.test(combinedText);
      const nutriIncompatible = [
        { pattern: /\b(academia|academias|crossfit|gym|fitness center|centro de treinamento|musculacao|treino funcional|ct |box de crossfit|escola de natacao|studio pilates|pilates)\b/i, label: 'Academia / Centro Fitness' },
        { pattern: /\b(loja de suplemento|loja de suplementos|suplementos alimentares|suplementacao|suplemento|suplementos|produtos naturais|emporio natural|loja de produtos naturais|mundo verde)\b/i, label: 'Loja de Suplementos / Produtos' },
        { pattern: /\b(farmacia|drogaria|farmacia de manipulacao|manipulacao|remedios)\b/i, label: 'Farmácia / Drogaria' },
        { pattern: /\b(marmitaria|restaurante|lanchonete|refeicoes fitness|buffet|comida fitness|delivery fitness|pizzaria|hamburgueria)\b/i, label: 'Restaurante / Marmitaria' },
        { pattern: /\b(pet shop|veterinari[ao]|agropecuaria|banho e tosa)\b/i, label: 'Pet Shop / Veterinária' },
        { pattern: /\b(dentista|odonto|odontologia|ortodontia)\b/i, label: 'Dentistas' },
        { pattern: /\b(mecanica|auto pecas|imobiliaria|advocacia|contabilidade|lava rapido)\b/i, label: 'Setor não relacionado' },
      ];

      for (const rule of nutriIncompatible) {
        if ((rule.pattern.test(normCat) || rule.pattern.test(normCompany)) && !hasNutriCore) {
          return {
            isIncompatible: true,
            reason: `Categoria fora do nicho: "${rawCategory || rule.label}". Não é nutricionista ou consultório de nutrição.`,
            matchedCategory: rule.label,
          };
        }
      }
    }

    // 3. Odontologia / Dentistas
    const isOdonto =
      normTarget.includes('odonto') ||
      normTarget.includes('dentist');

    if (isOdonto) {
      const odontoIncompatible = [
        { pattern: /\b(laboratorio de protese|protese dentaria|protetico|dental |produtos odontologicos)\b/i, label: 'Laboratório / Fornecedor Odontológico' },
        { pattern: /\b(farmacia|drogaria|academia|restaurante|pet shop|mecanica|estetica)\b/i, label: 'Setor não odontológico' },
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

    // 4. Advocacia / Jurídico
    const isAdvocacia =
      normTarget.includes('advoc') ||
      normTarget.includes('advogad') ||
      normTarget.includes('juridic') ||
      normTarget.includes('direito');

    if (isAdvocacia) {
      const advocaciaIncompatible = [
        { pattern: /\b(dentista|odonto|medico|clinica|hospital|academia|estetica|mecanica|oficina|restaurante)\b/i, label: 'Setor não jurídico' },
      ];
      for (const rule of advocaciaIncompatible) {
        if (rule.pattern.test(normCat) || rule.pattern.test(normCompany)) {
          return {
            isIncompatible: true,
            reason: `Categoria "${rawCategory || rule.label}" não é escritório de advocacia.`,
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
      if (!isDuplicate && checkCategory && autoExclude) {
        const catCheck = checkNicheCategoryRelevance(
          candidate.category,
          candidate.companyName,
          newNicheName.trim() || activeNiche.name,
          newNicheSegment.trim() || newNicheName.trim() || activeNiche.segment
        );
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

  // Aggregated unique categories detected in currently kept candidates
  const detectedCategories = React.useMemo(() => {
    const counts = new Map<string, number>();
    parsedCandidates.forEach((c) => {
      const cat = (c.category || '').trim() || 'Sem categoria';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [parsedCandidates]);

  // Summary of excluded categories with count
  const excludedCategoriesSummary = React.useMemo(() => {
    const counts = new Map<string, number>();
    categoryExcludedLeads.forEach((item) => {
      const cat = (item.matchedCategory || item.candidate.category || item.query || '').trim() || 'Sem categoria';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [categoryExcludedLeads]);

  // Direct Category Exclusion (Zero AI dependency, 100% Deterministic)
  const handleExcludeCategory = (categoryNameOrQuery: string) => {
    const rawQuery = categoryNameOrQuery.trim();
    if (!rawQuery) return;
    const query = rawQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Save snapshot for Undo
    setFilterUndoStack((prev) => [
      ...prev,
      {
        candidates: [...parsedCandidates],
        excluded: [...categoryExcludedLeads],
        excludedCategories: [...excludedCategoriesList],
      },
    ]);

    const kept: ParsedLeadCandidate[] = [];
    const newlyExcluded: typeof categoryExcludedLeads = [];

    parsedCandidates.forEach((cand, idx) => {
      const cat = (cand.category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const comp = (cand.companyName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Check match: category equals or contains query, or company name contains query if category empty
      const isMatch =
        cat === query ||
        cat.includes(query) ||
        (query.length >= 4 && query.includes(cat) && cat.length >= 4) ||
        comp.includes(query);

      if (isMatch) {
        newlyExcluded.push({
          id: `cat-exc-${idx}-${Date.now()}`,
          candidate: cand,
          reason: `Excluído pelo filtro de nicho/categoria: "${rawQuery}"`,
          matchedCategory: cand.category || rawQuery,
          query: rawQuery,
          originalIndex: cand.originalLineNumber || idx + 1,
        });
      } else {
        kept.push(cand);
      }
    });

    if (newlyExcluded.length > 0) {
      setParsedCandidates(kept);
      setCategoryExcludedLeads((prev) => [...prev, ...newlyExcluded]);
      setExcludedCategoriesList((prev) => Array.from(new Set([...prev, rawQuery])));
      setCategoryFeedbackMessage(
        `✅ Foram excluídos ${newlyExcluded.length} contatos da categoria "${rawQuery}". Restam ${kept.length} contatos no nicho.`
      );
      setCategorySearchOrSelect('');
    } else {
      setCategoryFeedbackMessage(`Nenhum contato encontrado correspondente à categoria "${rawQuery}".`);
    }
  };

  const handleRestoreCategory = (categoryName: string) => {
    const rawQuery = categoryName.trim();
    const query = rawQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const toRestore: ParsedLeadCandidate[] = [];
    const remaining: typeof categoryExcludedLeads = [];

    categoryExcludedLeads.forEach((item) => {
      const cat = (item.matchedCategory || item.candidate.category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const q = (item.query || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (cat === query || cat.includes(query) || q === query) {
        toRestore.push({ ...item.candidate, selected: true });
      } else {
        remaining.push(item);
      }
    });

    if (toRestore.length > 0) {
      setParsedCandidates((prev) => [...prev, ...toRestore]);
      setCategoryExcludedLeads(remaining);
      setExcludedCategoriesList((prev) => prev.filter((c) => c.toLowerCase() !== rawQuery.toLowerCase()));
      setCategoryFeedbackMessage(`Restaurados ${toRestore.length} contatos da categoria "${rawQuery}".`);
    }
  };

  const handleRestoreSingleCategoryExcludedLead = (item: { id: string; candidate: ParsedLeadCandidate }) => {
    setCategoryExcludedLeads((prev) => prev.filter((x) => x.id !== item.id));
    setParsedCandidates((prev) => [...prev, { ...item.candidate, selected: true }]);
  };

  const handleUndoLastExclusion = () => {
    if (filterUndoStack.length === 0) return;
    const lastSnapshot = filterUndoStack[filterUndoStack.length - 1];
    setParsedCandidates(lastSnapshot.candidates);
    setCategoryExcludedLeads(lastSnapshot.excluded);
    setExcludedCategoriesList(lastSnapshot.excludedCategories);
    setFilterUndoStack((prev) => prev.slice(0, -1));
    setCategoryFeedbackMessage('Última exclusão desfeita com sucesso.');
  };

  const handleRestoreAllExcludedCategories = () => {
    const toRestore = categoryExcludedLeads.map((item) => ({ ...item.candidate, selected: true }));
    setParsedCandidates((prev) => [...prev, ...toRestore]);
    setCategoryExcludedLeads([]);
    setExcludedCategoriesList([]);
    setCategoryFeedbackMessage(`Todos os ${toRestore.length} contatos excluídos foram restaurados.`);
  };

  const handleExcludeAllOutOfNiche = () => {
    const targetName = newNicheName.trim() || activeNiche.name;
    const targetSegment = newNicheSegment.trim() || targetName;

    setFilterUndoStack((prev) => [
      ...prev,
      {
        candidates: [...parsedCandidates],
        excluded: [...categoryExcludedLeads],
        excludedCategories: [...excludedCategoriesList],
      },
    ]);

    const kept: ParsedLeadCandidate[] = [];
    const newlyExcluded: typeof categoryExcludedLeads = [];
    const excludedCatsSet = new Set<string>();

    parsedCandidates.forEach((cand, idx) => {
      const check = checkNicheCategoryRelevance(cand.category, cand.companyName, targetName, targetSegment);
      if (check.isIncompatible) {
        newlyExcluded.push({
          id: `cat-exc-${idx}-${Date.now()}`,
          candidate: cand,
          reason: check.reason,
          matchedCategory: cand.category || check.matchedCategory,
          query: 'Fora do Nicho',
          originalIndex: cand.originalLineNumber || idx + 1,
        });
        if (cand.category) excludedCatsSet.add(cand.category);
      } else {
        kept.push(cand);
      }
    });

    if (newlyExcluded.length > 0) {
      setParsedCandidates(kept);
      setCategoryExcludedLeads((prev) => [...prev, ...newlyExcluded]);
      setExcludedCategoriesList((prev) => Array.from(new Set([...prev, ...Array.from(excludedCatsSet)])));
      setCategoryFeedbackMessage(
        `🎯 Foram excluídos ${newlyExcluded.length} contatos incompatíveis com o nicho de "${targetName}". Restam ${kept.length} contatos mantidos.`
      );
    } else {
      setCategoryFeedbackMessage(`Todos os contatos atuais já são compatíveis com o nicho "${targetName}"!`);
    }
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

    // Detect delimiter by counting occurrences
    const firstLine = rawLines[0];
    const detectDelimiter = (line: string): string => {
      const tabs = (line.match(/\t/g) || []).length;
      const semis = (line.match(/;/g) || []).length;
      const commas = (line.match(/,/g) || []).length;
      const pipes = (line.match(/\|/g) || []).length;
      if (tabs >= semis && tabs >= commas && tabs >= pipes && tabs > 0) return '\t';
      if (semis >= commas && semis >= pipes && semis > 0) return ';';
      if (commas >= pipes && commas > 0) return ',';
      if (pipes > 0) return '|';
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

    // Check sample rows to verify if columns have numbers/phones or names (support 8 to 15 digits)
    const sampleRows = rawLines.slice(0, 30).map((l) => splitCsvOrTsvLine(l, delimiter));
    const phoneCountPerCol: number[] = firstRowParts.map(() => 0);
    sampleRows.forEach((rowParts) => {
      rowParts.forEach((part, colIdx) => {
        const digits = part.replace(/\D/g, '');
        if (digits.length >= 8 && digits.length <= 15) {
          phoneCountPerCol[colIdx] = (phoneCountPerCol[colIdx] || 0) + 1;
        }
      });
    });

    firstRowParts.forEach((part, idx) => {
      const norm = normalizeHeader(part);

      // Phone (explicit phone names, celulares or WhatsApp)
      if (
        norm.includes('tel') ||
        norm.includes('cel') ||
        norm.includes('whats') ||
        norm.includes('fone') ||
        norm.includes('phone') ||
        norm.includes('mobile') ||
        norm.includes('zap') ||
        norm.includes('wpp') ||
        norm.includes('numero') ||
        norm.includes('num') ||
        norm === 'contatotel' ||
        norm === 'contatowhats' ||
        norm === 'telefone' ||
        norm === 'celular' ||
        norm === 'whatsapp' ||
        norm === 'fone'
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
        norm.includes('doutora') ||
        norm.includes('dr') ||
        norm.includes('dra') ||
        norm.includes('contact') ||
        norm.includes('owner') ||
        norm.includes('atendente')
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
        norm.includes('paciente') ||
        norm.includes('loja')
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

    // Check if the first row contains phone numbers (indicating it's data rather than header)
    const firstRowHasPhone = firstRowParts.some((part) => {
      const d = part.replace(/\D/g, '');
      return d.length >= 8 && d.length <= 15;
    });

    const hasRecognizedHeader =
      headerPhoneIndex !== -1 ||
      headerCompanyIndex !== -1 ||
      firstRowParts.some((part) => {
        const norm = normalizeHeader(part);
        return (
          norm.includes('empresa') ||
          norm.includes('nome') ||
          norm.includes('cliente') ||
          norm.includes('telefone') ||
          norm.includes('celular') ||
          norm.includes('categoria') ||
          norm.includes('cidade') ||
          norm.includes('endereco')
        );
      });

    const hasHeaderMatch =
      headerCompanyIndex !== -1 ||
      headerContactIndex !== -1 ||
      headerCategoryIndex !== -1 ||
      headerPhoneIndex !== -1 ||
      headerMapsIndex !== -1 ||
      headerWebIndex !== -1 ||
      headerCityIndex !== -1 ||
      headerAddressIndex !== -1 ||
      headerRatingIndex !== -1;

    // If recognized header AND does not look like pure data row with phone, skip row 0; otherwise include row 0!
    const startIndex = hasRecognizedHeader && !firstRowHasPhone ? 1 : (hasRecognizedHeader ? 1 : 0);

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
        if (/\b(estetica|esteticista|harmonizacao|beleza|depilacao|laser|spa|biomedicina|sobrancelha|micropigmentacao)\b/i.test(textToTest)) {
          categoryCandidate = 'Clínica de Estética';
        } else if (/\b(consultorio odontologico|consultorio odonto)\b/i.test(textToTest)) {
          categoryCandidate = 'Consultório Odontológico';
        } else if (/\b(dentista|odonto|odontologia|ortodontia|implantodontia|protese dentaria)\b/i.test(textToTest)) {
          categoryCandidate = 'Dentistas';
        } else if (/\b(academia|academias|gym|crossfit|musculacao|centro de treinamento|box de crossfit|studio pilates|pilates)\b/i.test(textToTest)) {
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
        } else if (/\b(advocacia|advogado|juridico|direito)\b/i.test(textToTest)) {
          categoryCandidate = 'Escritório de Advocacia';
        } else if (/\b(mecanica|auto pecas|oficina|auto center|borracharia)\b/i.test(textToTest)) {
          categoryCandidate = 'Oficina Mecânica';
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

        // Detect phone in any cell if not found by header
        if (!phoneCandidate) {
          const digits = p.replace(/\D/g, '');
          if (digits.length >= 8 && digits.length <= 15) {
            phoneCandidate = digits;
          }
        }
      }

      // Regex fallback for phone in full line
      if (!phoneCandidate) {
        const matchDigits = line.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}|\b\d{8,15}\b/);
        if (matchDigits) {
          phoneCandidate = matchDigits[0].replace(/\D/g, '');
        }
      }

      // Company fallback: use first part if empty
      if (!company) {
        // Exclude if first part was purely a phone or URL
        const isPurePhone = Boolean(
          parts[0] &&
            parts[0].replace(/\D/g, '').length >= 8 &&
            parts[0].replace(/[\d\s\(\)\-\+\.]/g, '').length === 0
        );
        if (parts[0] && !isPurePhone && !classifyUrl(parts[0])) {
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

  // Validate and read spreadsheet file (.xlsx, .xls, .csv, .tsv, .txt, .ods, .xlsm, .xlsb)
  const validateAndProcessFile = (file: File) => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();

    // 1. Explicitly block non-spreadsheets (Word, Slides, PDFs, Media)
    const disallowedWord = ['.doc', '.docx', '.odt', '.rtf', '.pages', '.dot', '.dotx'];
    const disallowedPresentation = ['.ppt', '.pptx', '.pps', '.ppsx', '.odp', '.key'];
    const disallowedPdf = ['.pdf'];
    const disallowedMedia = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.mp3', '.zip', '.rar', '.7z'];

    if (disallowedWord.includes(ext)) {
      setErrorMessage(
        `❌ O arquivo "${file.name}" é um documento de texto (.doc/.docx). O sistema aceita apenas planilhas (.xlsx, .xls, .csv, .tsv, .ods). Por favor, exporte como planilha ou copie as linhas.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (disallowedPresentation.includes(ext)) {
      setErrorMessage(
        `❌ O arquivo "${file.name}" é uma apresentação de slides (.ppt/.pptx). Por favor, envie um arquivo de planilha (.xlsx, .xls ou .csv).`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (disallowedPdf.includes(ext)) {
      setErrorMessage(
        `❌ O arquivo "${file.name}" é um PDF. Por favor, exporte como planilha (.xlsx, .csv).`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (disallowedMedia.includes(ext)) {
      setErrorMessage(
        `❌ O arquivo "${file.name}" não é uma planilha. Envie arquivos de planilha (.xlsx, .xls, .csv, .ods).`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setErrorMessage(null);
    setIsReadingFile(true);

    // Auto-populate new campaign name and segment from the file name
    const cleanFileName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[_\-]+/g, ' ')
      .trim();
    if (cleanFileName) {
      const suggestedName = cleanFileName.charAt(0).toUpperCase() + cleanFileName.slice(1);
      setNewNicheName((prev) => (prev && prev !== 'Nova Campanha' ? prev : suggestedName));
      setNewNicheSegment((prev) => (prev ? prev : suggestedName));
    }

    // Process all formats (.xlsx, .xls, .ods, .csv, .tsv, .txt) via ArrayBuffer + SheetJS
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('A planilha está vazia ou não possui abas legíveis.');
        }

        // Find the sheet that actually has text/data rows (handles empty first sheet)
        let chosenSheetName = workbook.SheetNames[0];
        let tsvText = '';

        for (const sName of workbook.SheetNames) {
          const ws = workbook.Sheets[sName];
          if (ws) {
            const candidateCsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
            if (candidateCsv.trim().length > 0) {
              chosenSheetName = sName;
              tsvText = candidateCsv;
              break;
            }
          }
        }

        // If sheet_to_csv produced nothing, try reading as raw text (fallback for unusual CSVs)
        if (!tsvText.trim()) {
          try {
            const decoder = new TextDecoder('utf-8');
            tsvText = decoder.decode(data);
          } catch {
            // ignore
          }
        }

        if (!tsvText.trim()) {
          throw new Error(`A planilha selecionada está vazia (nenhuma linha encontrada).`);
        }

        const lines = tsvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        setRawText(tsvText);
        setUploadedFile({
          name: file.name,
          size: file.size,
          format:
            ext === '.xlsx'
              ? 'Excel (.xlsx)'
              : ext === '.xls'
              ? 'Excel (.xls)'
              : ext === '.ods'
              ? 'OpenDocument (.ods)'
              : ext === '.csv'
              ? 'CSV (.csv)'
              : ext === '.tsv'
              ? 'TSV (.tsv)'
              : 'Planilha / Texto',
          sheetName: chosenSheetName,
          rowCount: Math.max(0, lines.length - 1),
        });

        // Extract candidates & run antiduplication
        const candidates = parseRawTextHeuristic(tsvText);
        if (candidates.length > 0) {
          runDeduplication(candidates);
          setErrorMessage(null);
        } else {
          setParsedCandidates([]);
          setDuplicateCandidates([]);
          setErrorMessage('Nenhum telefone válido foi detectado automaticamente nas linhas da planilha. Verifique a coluna de telefones do arquivo.');
        }
      } catch (err: any) {
        // Fallback for CSV files if SheetJS throws
        if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
          const textReader = new FileReader();
          textReader.onload = (ev) => {
            try {
              const text = (ev.target?.result as string) || '';
              if (!text.trim()) throw new Error('O arquivo está vazio.');
              const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
              setRawText(text);
              setUploadedFile({
                name: file.name,
                size: file.size,
                format: ext === '.csv' ? 'CSV (.csv)' : ext === '.tsv' ? 'TSV (.tsv)' : 'Texto (.txt)',
                rowCount: Math.max(0, lines.length - 1),
              });
              const candidates = parseRawTextHeuristic(text);
              if (candidates.length > 0) {
                runDeduplication(candidates);
                setErrorMessage(null);
              } else {
                setErrorMessage('Nenhum telefone detectado no arquivo.');
              }
            } catch (innerErr: any) {
              setErrorMessage(`Falha ao ler arquivo: ${innerErr.message || 'Erro de leitura'}`);
            } finally {
              setIsReadingFile(false);
            }
          };
          textReader.onerror = () => {
            setErrorMessage('Erro ao ler arquivo do computador.');
            setIsReadingFile(false);
          };
          textReader.readAsText(file);
          return;
        }

        setErrorMessage(`Falha ao ler planilha: ${err.message || 'Arquivo corrompido ou formato ilegível'}`);
      } finally {
        setIsReadingFile(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Erro ao ler arquivo do computador.');
      setIsReadingFile(false);
    };

    reader.readAsArrayBuffer(file);
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
    setCategoryExcludedLeads([]);
    setExcludedCategoriesList([]);
    setFilterUndoStack([]);
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

    const targetNicheTitle = newNicheName.trim() || uploadedFile?.name?.replace(/\.[^/.]+$/, '') || activeNiche.name || 'Nova Campanha';
    const targetSegment = newNicheSegment.trim() || targetNicheTitle;
    const targetCity = newNicheCity.trim() || activeNiche.city;

    const payload: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[] = selected.map((c) => ({
      companyName: c.companyName,
      contactName: c.contactName,
      phone: c.phone,
      displayPhone: formatDisplayPhone(c.phone),
      category: c.category || targetSegment,
      city: c.city || targetCity,
      address: c.address,
      googleRating: c.googleRating,
      googleMapsUrl: c.googleMapsUrl,
      websiteUrl: c.websiteUrl,
      stage: 'leads_sem_contato',
      scriptUsed: c.recommendedScript || 'script1',
      opportunityAngle: c.opportunityAngle,
    }));

    const sheetMeta = {
      name:
        uploadedFile?.name ||
        `Planilha - ${targetNicheTitle}`,
      format: uploadedFile?.format || (inputMethod === 'file' ? 'Arquivo' : 'Texto Copiado'),
      size: uploadedFile?.size,
    };

    onCreateNicheWithLeads(
      {
        name: targetNicheTitle,
        segment: targetSegment,
        city: targetCity,
        emoji: newNicheEmoji || '💆‍♀️',
      },
      payload,
      sheetMeta
    );

    setSuccessCount(payload.length);
    setRawParsedCandidates([]);
    setParsedCandidates([]);
    setDuplicateCandidates([]);
    setCategoryExcludedLeads([]);
    setExcludedCategoriesList([]);
    setFilterUndoStack([]);
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

  const filteredCategoryExcluded = categoryExcludedLeads.filter((item) => {
    if (!duplicateSearch.trim()) return true;
    const q = duplicateSearch.toLowerCase();
    return (
      item.candidate.companyName.toLowerCase().includes(q) ||
      (item.candidate.contactName && item.candidate.contactName.toLowerCase().includes(q)) ||
      (item.candidate.category && item.candidate.category.toLowerCase().includes(q)) ||
      item.candidate.phone.includes(q) ||
      item.reason.toLowerCase().includes(q) ||
      item.query.toLowerCase().includes(q) ||
      item.matchedCategory.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-[var(--kz-border-subtle)] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="kz-page-title">Importador de Planilhas & Google Meu Negócio</h2>
          <p className="kz-subtitle mt-1">
            Reconhecimento inteligente de nome, telefone WhatsApp, links do Google Meu Negócio/Maps e site. A prévia já identifica tudo automaticamente.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadSampleLeads}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--kz-accent-text)] bg-[var(--kz-accent-soft)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-accent-border)] rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-current text-[var(--kz-accent)]" />
          <span>Carregar Exemplo com Links do Maps</span>
        </button>
      </div>

      {/* Success Notification */}
      {successCount !== null && (
        <div className="p-4 bg-[var(--kz-success-bg)] border border-[var(--kz-success-border)] rounded-xl text-xs text-[var(--kz-text-primary)] flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[var(--kz-success-text)] shrink-0" />
            <span>
              <strong>{successCount} leads importados com sucesso!</strong> Os contatos com telefones e links do Google Meu Negócio foram organizados na coluna <em>1. Leads sem Contato</em>.
            </span>
          </div>
          <button
            onClick={() => {
              setSuccessCount(null);
              onSwitchToKanban();
            }}
            className="px-3 py-1.5 bg-[var(--kz-success-solid)] hover:brightness-110 text-white rounded-lg font-semibold transition-all cursor-pointer shadow-[var(--kz-shadow-xs)] shrink-0"
          >
            Ver no Kanban
          </button>
        </div>
      )}

      {/* Error alert with strict format reminder */}
      {errorMessage && (
        <div className="p-3.5 bg-[var(--kz-danger-bg)] border border-[var(--kz-danger-border)] rounded-xl text-xs text-[var(--kz-text-primary)] flex items-start gap-2.5 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-[var(--kz-danger-text)] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-[var(--kz-danger-text)]">{errorMessage}</p>
            <p className="text-[11px] text-[var(--kz-text-secondary)] mt-1">
              Formatos aceitos: <strong>.xlsx, .xls, .csv, .tsv</strong>. Não é permitido: Word (.doc/.docx), apresentações (.ppt/.pptx) ou PDFs.
            </p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[var(--kz-danger-text)] hover:text-[var(--kz-text-primary)] p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Input Area (File or Text) & Destination Option */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: File Upload or Raw Data */}
        <div className="lg:col-span-8 bg-[var(--kz-bg-surface)] rounded-xl border border-[var(--kz-border-subtle)] p-5 shadow-[var(--kz-shadow-xs)] space-y-4">
          {/* Method Selector Tabs */}
          <div className="flex items-center justify-between border-b border-[var(--kz-border-subtle)] pb-3 flex-wrap gap-2">
            <div className="flex items-center bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setInputMethod('file')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  inputMethod === 'file'
                    ? 'bg-[var(--kz-bg-surface)] text-[var(--kz-accent-text)] border border-[var(--kz-accent-border)] shadow-[var(--kz-shadow-xs)]'
                    : 'text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)]'
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
                    ? 'bg-[var(--kz-bg-surface)] text-[var(--kz-accent-text)] border border-[var(--kz-accent-border)] shadow-[var(--kz-shadow-xs)]'
                    : 'text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Colar Texto / Tabela Livre</span>
              </button>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] font-medium">
                Aceita: Excel (.xlsx, .xls) e CSV
              </span>
              <span className="px-2 py-0.5 rounded bg-[var(--kz-bg-subtle)] text-[var(--kz-text-muted)] border border-[var(--kz-border-subtle)] font-medium hidden sm:inline">
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
                      ? 'border-[var(--kz-accent)] bg-[var(--kz-accent-soft)] scale-[1.005]'
                      : 'border-[var(--kz-border-default)] hover:border-[var(--kz-accent)] hover:bg-[var(--kz-bg-hover)] bg-[var(--kz-bg-subtle)]'
                  }`}
                >
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] text-[var(--kz-accent)] flex items-center justify-center shadow-[var(--kz-shadow-xs)]">
                      {isReadingFile ? (
                        <RotateCcw className="w-6 h-6 animate-spin text-[var(--kz-accent)]" />
                      ) : (
                        <UploadCloud className="w-6 h-6" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-[var(--kz-text-primary)]">
                        {isReadingFile
                          ? 'Identificando dados e contatos da planilha...'
                          : 'Clique para escolher a planilha ou arraste o arquivo aqui'}
                      </p>
                      <p className="text-xs text-[var(--kz-text-muted)] mt-1">
                        Formatos aceitos: <strong className="text-[var(--kz-text-secondary)]">Excel (.xlsx, .xls)</strong> e <strong className="text-[var(--kz-text-secondary)]">CSV (.csv, .tsv)</strong>
                      </p>
                    </div>

                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[var(--kz-accent-fg)] bg-[var(--kz-accent)] hover:bg-[var(--kz-accent-hover)] rounded-lg shadow-[var(--kz-shadow-xs)] transition-colors">
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Selecionar Arquivo do Computador</span>
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-[var(--kz-text-subtle)]">
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--kz-warning-text)]" />
                      <span>Documentos do Word (.doc/.docx) ou slides (.ppt) não são aceitos</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Card for Already Uploaded File */
                <div className="border border-[var(--kz-success-border)] bg-[var(--kz-success-bg)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--kz-success-solid)] text-white flex items-center justify-center shrink-0 shadow-[var(--kz-shadow-xs)]">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--kz-text-primary)] truncate max-w-[260px]">
                          {uploadedFile.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--kz-bg-surface)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] font-medium">
                          {uploadedFile.format}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5 flex items-center gap-2">
                        <span>{formatFileSize(uploadedFile.size)}</span>
                        <span>•</span>
                        <span>
                          <strong className="text-[var(--kz-text-primary)]">{uploadedFile.rowCount}</strong> linhas de contatos analisadas
                        </span>
                        {uploadedFile.sheetName && (
                          <>
                            <span>•</span>
                            <span className="text-[var(--kz-text-secondary)]">Aba: {uploadedFile.sheetName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setShowRawTextPreview(!showRawTextPreview)}
                      className="text-xs text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--kz-border-default)] bg-[var(--kz-bg-surface)] hover:bg-[var(--kz-bg-hover)] transition-colors cursor-pointer"
                    >
                      <span>{showRawTextPreview ? 'Ocultar Linhas' : 'Ver Linhas'}</span>
                      {showRawTextPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-[var(--kz-accent-text)] hover:text-[var(--kz-text-primary)] font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--kz-accent-border)] bg-[var(--kz-accent-soft)] hover:bg-[var(--kz-bg-hover)] transition-colors cursor-pointer"
                    >
                      Trocar Arquivo
                    </button>

                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="text-xs text-[var(--kz-danger-text)] hover:text-[var(--kz-text-primary)] font-semibold p-1.5 rounded-lg hover:bg-[var(--kz-danger-bg)] transition-colors cursor-pointer"
                      title="Remover arquivo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Collapsible raw text preview */}
              {showRawTextPreview && uploadedFile && rawText && (
                <div className="p-3 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] rounded-lg animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[11px] text-[var(--kz-text-muted)] mb-1.5">
                    <span>Linhas brutas da planilha:</span>
                    <span>Mostrando início</span>
                  </div>
                  <pre className="text-[11px] font-mono text-[var(--kz-text-secondary)] max-h-36 overflow-y-auto whitespace-pre-wrap bg-[var(--kz-bg-canvas)] p-2.5 rounded border border-[var(--kz-border-subtle)]">
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
                <span className="text-xs font-semibold text-[var(--kz-text-secondary)]">
                  Cole os dados copiados do Excel, Google Sheets, Maps ou Bloco de Notas:
                </span>
                <span className="text-[11px] text-[var(--kz-text-subtle)]">Aceita links, telefones e nomes</span>
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
                className="w-full text-xs p-3 rounded-lg border border-[var(--kz-border-default)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] bg-[var(--kz-bg-subtle)]"
              />
            </div>
          )}

          {/* Action Buttons: Atualizar Prévia dos Dados */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--kz-border-subtle)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunHeuristicParse}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[var(--kz-text-primary)] bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-border-default)] rounded-lg transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                <span>Atualizar Prévia dos Dados</span>
              </button>
            </div>

            {parsedCandidates.length > 0 && (
              <span className="text-xs text-[var(--kz-success-text)] font-medium bg-[var(--kz-success-bg)] px-2.5 py-1 rounded-md border border-[var(--kz-success-border)] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{parsedCandidates.length} contatos prontos com informações extraídas</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Destination Config (Nicho da Planilha) */}
        <div className="lg:col-span-4 bg-[var(--kz-bg-surface)] rounded-xl border border-[var(--kz-border-subtle)] p-5 shadow-[var(--kz-shadow-xs)] space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--kz-border-subtle)] pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--kz-text-primary)] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[var(--kz-accent)]" />
              Destino dos Leads
            </span>
            <span className="text-[10px] bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] border border-[var(--kz-accent-border)] font-bold px-2 py-0.5 rounded-full">
              Nicho da Planilha
            </span>
          </div>

          <p className="text-[11px] text-[var(--kz-text-muted)]">
            Defina o nome da campanha onde os contatos desta planilha serão importados:
          </p>

          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">Ícone</label>
                <input
                  type="text"
                  value={newNicheEmoji}
                  onChange={(e) => setNewNicheEmoji(e.target.value)}
                  maxLength={2}
                  className="w-full text-center text-sm px-2 py-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] font-bold focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)] focus:outline-none"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                  Nome do Nicho / Campanha *
                </label>
                <input
                  type="text"
                  value={newNicheName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewNicheName(val);
                    if (!newNicheSegment && val) {
                      const seg = val.split(/ em | no | na | - /i)[0].trim();
                      if (seg) setNewNicheSegment(seg);
                    }
                  }}
                  onBlur={() => {
                    if (rawParsedCandidates.length > 0 && dedupCheckCategory) {
                      runDeduplication(
                        rawParsedCandidates,
                        dedupCheckPhone,
                        dedupCheckName,
                        dedupCheckCrm,
                        dedupAutoExclude,
                        dedupCheckCategory
                      );
                    }
                  }}
                  placeholder="Ex: Clínicas de Estética em Arapiraca"
                  className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] font-medium focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                Segmento / Especialidade
              </label>
              <input
                type="text"
                value={newNicheSegment}
                onChange={(e) => setNewNicheSegment(e.target.value)}
                onBlur={() => {
                  if (rawParsedCandidates.length > 0 && dedupCheckCategory) {
                    runDeduplication(
                      rawParsedCandidates,
                      dedupCheckPhone,
                      dedupCheckName,
                      dedupCheckCrm,
                      dedupAutoExclude,
                      dedupCheckCategory
                    );
                  }
                }}
                placeholder="Ex: Clínicas de Estética"
                className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                Cidade Principal
              </label>
              <input
                type="text"
                value={newNicheCity}
                onChange={(e) => setNewNicheCity(e.target.value)}
                placeholder="Ex: Arapiraca - AL"
                className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)] focus:outline-none"
              />
            </div>

            <div className="text-[11px] text-[var(--kz-text-secondary)] bg-[var(--kz-accent-soft)] p-2.5 rounded-lg border border-[var(--kz-accent-border)]">
              💡 Os contatos aprovados serão salvos diretamente na campanha <strong className="text-[var(--kz-accent-text)]">"{newNicheName.trim() || 'Nova Campanha'}"</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Live Candidates Preview Table with Antiduplication Panel */}
      {(parsedCandidates.length > 0 || duplicateCandidates.length > 0) && (
        <div className="bg-[var(--kz-bg-surface)] rounded-xl border border-[var(--kz-border-subtle)] p-5 shadow-[var(--kz-shadow-xs)] space-y-4 animate-in fade-in duration-200">
          {/* Antiduplication & Niche Category Control Panel & Status */}
          <div className="bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-xl p-4 shadow-[var(--kz-shadow-xs)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] text-[var(--kz-accent)] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[var(--kz-text-primary)]">
                      Filtro Antiduplicidade & Nicho Ativo
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {parsedCandidates.length} No Nicho Mantidos
                    </span>
                    {duplicatesOnly.length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border border-[var(--kz-warning-border)] flex items-center gap-1">
                        <Trash2 className="w-3 h-3 text-[var(--kz-warning-text)]" />
                        {duplicatesOnly.length} Repetidos Excluídos
                      </span>
                    )}
                    {categoryExclusions.length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border border-[var(--kz-danger-border)] flex items-center gap-1">
                        <Ban className="w-3 h-3 text-[var(--kz-danger-text)]" />
                        {categoryExclusions.length} Fora do Nicho Excluídos
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--kz-text-muted)] mt-1">
                    {categoryExclusions.length > 0 || duplicatesOnly.length > 0 || categoryExcludedLeads.length > 0 ? (
                      <span>
                        Analisamos {rawParsedCandidates.length} registros para a campanha{' '}
                        <strong className="text-[var(--kz-text-primary)]">{newNicheName.trim() || activeNiche.name}</strong>.
                        {categoryExcludedLeads.length > 0 && (
                          <span className="text-[var(--kz-danger-text)] font-medium">
                            {' '}{categoryExcludedLeads.length} contatos de nichos/categorias excluídas foram removidos.{' '}
                          </span>
                        )}
                        {categoryExclusions.length > 0 && (
                          <span className="text-[var(--kz-danger-text)] font-medium">
                            {' '}{categoryExclusions.length} contatos fora do nicho excluídos.{' '}
                          </span>
                        )}
                        {duplicatesOnly.length > 0 && (
                          <span className="text-[var(--kz-warning-text)]">
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
              {(duplicatesOnly.length > 0 || categoryExclusions.length > 0 || categoryExcludedLeads.length > 0) && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {categoryExcludedLeads.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveCandidatesTab(activeCandidatesTab === 'category_excluded' ? 'unique' : 'category_excluded')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        activeCandidatesTab === 'category_excluded'
                          ? 'bg-[var(--kz-danger-solid)] text-white border-[var(--kz-danger-border)] hover:brightness-110'
                          : 'bg-[var(--kz-bg-surface)] text-[var(--kz-danger-text)] border-[var(--kz-danger-border)] hover:bg-[var(--kz-danger-bg)]'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {activeCandidatesTab === 'category_excluded'
                          ? 'Voltar aos Mantidos'
                          : `Ver ${categoryExcludedLeads.length} Excluídos por Categoria`}
                      </span>
                    </button>
                  )}

                  {duplicatesOnly.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveCandidatesTab(activeCandidatesTab === 'duplicates' ? 'unique' : 'duplicates')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        activeCandidatesTab === 'duplicates'
                          ? 'bg-[var(--kz-warning-solid)] text-[#0B0B0D] border-[var(--kz-warning-border)] hover:brightness-110'
                          : 'bg-[var(--kz-bg-surface)] text-[var(--kz-warning-text)] border-[var(--kz-warning-border)] hover:bg-[var(--kz-warning-bg)]'
                      }`}
                    >
                      <CopyX className="w-3.5 h-3.5" />
                      <span>
                        {activeCandidatesTab === 'duplicates'
                          ? 'Voltar aos Mantidos'
                          : `Ver ${duplicatesOnly.length} Repetidos`}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Criteria check filters */}
            <div className="pt-2 border-t border-[var(--kz-border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center gap-1">
                  <Filter className="w-3 h-3 text-[var(--kz-accent)]" />
                  Critérios de Análise:
                </span>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] select-none">
                  <input
                    type="checkbox"
                    checked={dedupCheckPhone}
                    onChange={(e) => handleToggleDedupPhone(e.target.checked)}
                    className="rounded accent-[var(--kz-accent)] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] font-medium">Por Telefone / WhatsApp</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] select-none">
                  <input
                    type="checkbox"
                    checked={dedupCheckName}
                    onChange={(e) => handleToggleDedupName(e.target.checked)}
                    className="rounded accent-[var(--kz-accent)] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] font-medium">Por Nome (Empresa ou Contato)</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] select-none">
                  <input
                    type="checkbox"
                    checked={dedupCheckCategory}
                    onChange={(e) => handleToggleDedupCategory(e.target.checked)}
                    className="rounded accent-rose-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-[var(--kz-danger-text)] flex items-center gap-1">
                    <Ban className="w-3 h-3 text-[var(--kz-danger-text)]" />
                    Excluir Categorias Fora do Nicho ({newNicheName.trim() || activeNiche.name})
                  </span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] select-none">
                  <input
                    type="checkbox"
                    checked={dedupAutoExclude}
                    onChange={(e) => handleToggleAutoExclude(e.target.checked)}
                    className="rounded accent-[var(--kz-accent)] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold text-[var(--kz-accent-text)]">Excluir Automaticamente</span>
                </label>
              </div>

              {duplicateCandidates.length > 0 && (
                <button
                  type="button"
                  onClick={handleRestoreAllDuplicates}
                  className="text-[11px] font-semibold text-[var(--kz-accent-text)] hover:text-[var(--kz-text-primary)] hover:underline cursor-pointer flex items-center gap-1"
                  title="Restaurar todos os contatos excluídos para a lista de importação"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Restaurar todos os repetidos</span>
                </button>
              )}
            </div>
          </div>

          {/* Gerenciador de Filtro & Exclusão de Categorias da Planilha (100% Direto e Visual) */}
          <div className="bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-xl p-4 sm:p-5 shadow-[var(--kz-shadow-xs)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--kz-border-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] text-[var(--kz-accent)] flex items-center justify-center shrink-0 font-bold">
                  <Filter className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[var(--kz-text-primary)] flex items-center gap-2">
                    <span>Filtro de Categorias & Nichos da Planilha</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] border border-[var(--kz-accent-border)]">
                      Filtro Ativo
                    </span>
                  </h3>
                  <p className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
                    Selecione ou digite categorias indesejadas para remover da importação com 1 clique (ex: excluir <em>"Dentistas"</em> ou <em>"Consultório Odontológico"</em> e manter apenas <em>"{newNicheName.trim() || 'o nicho alvo'}"</em>).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {filterUndoStack.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndoLastExclusion}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--kz-text-secondary)] bg-[var(--kz-bg-surface)] hover:bg-[var(--kz-bg-hover)] hover:text-[var(--kz-text-primary)] border border-[var(--kz-border-default)] rounded-lg transition-colors cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-[var(--kz-text-muted)]" />
                    <span>Desfazer Última Exclusão</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExcludeAllOutOfNiche}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--kz-danger-text)] bg-[var(--kz-danger-bg)] hover:bg-[var(--kz-danger-solid)] hover:text-white border border-[var(--kz-danger-border)] rounded-lg transition-colors cursor-pointer"
                  title="Exclui automaticamente tudo que não combina com o nicho definido"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Excluir Fora do Nicho ({newNicheName.trim() || 'Alvo'})</span>
                </button>
              </div>
            </div>

            {/* Quick Action Input & Dropdown Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Dropdown with all detected categories */}
              <div className="sm:w-64 shrink-0">
                <select
                  value={categorySearchOrSelect}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategorySearchOrSelect(val);
                    if (val) handleExcludeCategory(val);
                  }}
                  className="w-full text-xs px-3 py-2.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-xl text-[var(--kz-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)] font-medium cursor-pointer"
                >
                  <option value="">▼ Selecionar nicho para excluir...</option>
                  {detectedCategories.map((c) => (
                    <option key={c.name} value={c.name}>
                      Excluir: {c.name} ({c.count} contatos)
                    </option>
                  ))}
                </select>
              </div>

              {/* Free-text input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[var(--kz-text-subtle)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={categorySearchOrSelect}
                  onChange={(e) => setCategorySearchOrSelect(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleExcludeCategory(categorySearchOrSelect);
                    }
                  }}
                  placeholder="Ou digite o nome do nicho/categoria que quer excluir... Ex: Dentistas, Odontologia, Oficina"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-xl text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)] font-medium"
                />
              </div>

              <button
                type="button"
                onClick={() => handleExcludeCategory(categorySearchOrSelect)}
                disabled={!categorySearchOrSelect.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[var(--kz-danger-solid)] hover:brightness-110 disabled:opacity-50 rounded-xl transition-all cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir da Planilha</span>
              </button>
            </div>

            {/* Visual Category Badges Found in Spreadsheet */}
            {detectedCategories.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--kz-text-secondary)]">
                  <span>Nichos e Categorias Detectados na Planilha ({detectedCategories.length}):</span>
                  <span className="text-[10px] text-[var(--kz-text-subtle)]">Clique no botão [Excluir] para retirar todos os contatos do nicho</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {detectedCategories.map((c) => {
                    const isTargetMatch =
                      newNicheName &&
                      c.name.toLowerCase().includes(newNicheSegment.toLowerCase() || newNicheName.toLowerCase());

                    return (
                      <div
                        key={c.name}
                        className={`inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border text-xs transition-all ${
                          isTargetMatch
                            ? 'bg-[var(--kz-success-bg)] border-[var(--kz-success-border)] text-[var(--kz-text-primary)] font-bold'
                            : 'bg-[var(--kz-bg-surface)] border-[var(--kz-border-default)] text-[var(--kz-text-secondary)]'
                        }`}
                      >
                        <Tag className={`w-3.5 h-3.5 ${isTargetMatch ? 'text-[var(--kz-success-text)]' : 'text-[var(--kz-text-subtle)]'}`} />
                        <span>
                          <strong className="text-[var(--kz-text-primary)]">{c.name}</strong> ({c.count})
                        </span>

                        {isTargetMatch && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--kz-bg-surface)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] font-bold">
                            Nicho Alvo
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleExcludeCategory(c.name)}
                          className="px-2 py-0.5 text-[11px] font-bold text-[var(--kz-danger-text)] hover:text-white hover:bg-[var(--kz-danger-solid)] rounded-lg transition-colors cursor-pointer ml-1 flex items-center gap-1 border border-[var(--kz-danger-border)]"
                          title={`Excluir todos os ${c.count} contatos de "${c.name}"`}
                        >
                          <Trash2 className="w-3 h-3" />
                          Excluir
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Excluded Categories Summary */}
            {categoryExcludedLeads.length > 0 && (
              <div className="p-3 bg-[var(--kz-danger-bg)] border border-[var(--kz-danger-border)] rounded-xl space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[var(--kz-danger-text)] flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5 text-[var(--kz-danger-text)]" />
                    Categorias Excluídas da Importação ({categoryExcludedLeads.length} contatos retirados):
                  </span>
                  <button
                    type="button"
                    onClick={handleRestoreAllExcludedCategories}
                    className="text-xs font-bold text-[var(--kz-danger-text)] hover:text-[var(--kz-text-primary)] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Undo2 className="w-3 h-3" />
                    Restaurar Todos os {categoryExcludedLeads.length} Contatos
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {excludedCategoriesSummary.map((item) => (
                    <div
                      key={item.name}
                      className="inline-flex items-center gap-2 px-2.5 py-1 bg-[var(--kz-bg-surface)] border border-[var(--kz-danger-border)] rounded-lg text-xs font-semibold text-[var(--kz-text-primary)]"
                    >
                      <span>✕ {item.name} ({item.count})</span>
                      <button
                        type="button"
                        onClick={() => handleRestoreCategory(item.name)}
                        className="text-[11px] text-[var(--kz-accent-text)] hover:text-[var(--kz-text-primary)] hover:underline font-bold cursor-pointer"
                      >
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notification / Feedback Banner */}
            {categoryFeedbackMessage && (
              <div className="text-xs font-medium text-[var(--kz-text-primary)] bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] p-2.5 rounded-lg flex items-center justify-between gap-2 animate-in fade-in">
                <span>{categoryFeedbackMessage}</span>
                <button
                  type="button"
                  onClick={() => setCategoryFeedbackMessage(null)}
                  className="text-[var(--kz-text-subtle)] hover:text-[var(--kz-text-primary)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Navigation Tabs (Contatos no Nicho vs Excluídos por Categoria vs Repetidos vs Fora do Nicho) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--kz-border-subtle)] pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveCandidatesTab('unique')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeCandidatesTab === 'unique'
                    ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] shadow-[var(--kz-shadow-xs)]'
                    : 'bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-hover)] hover:text-[var(--kz-text-primary)] border border-[var(--kz-border-subtle)]'
                }`}
              >
                <span>✨ Contatos Mantidos ({parsedCandidates.length})</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeCandidatesTab === 'unique'
                    ? 'bg-black/20 text-[var(--kz-accent-fg)]'
                    : 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-muted)]'
                }`}>
                  {parsedCandidates.filter((c) => c.selected).length} selecionados
                </span>
              </button>

              {categoryExcludedLeads.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveCandidatesTab('category_excluded')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeCandidatesTab === 'category_excluded'
                      ? 'bg-[var(--kz-danger-solid)] text-white shadow-[var(--kz-shadow-xs)]'
                      : 'bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border border-[var(--kz-danger-border)] hover:brightness-110'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>🚫 Excluídos por Categoria ({categoryExcludedLeads.length})</span>
                </button>
              )}

              {duplicatesOnly.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveCandidatesTab('duplicates')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeCandidatesTab === 'duplicates'
                      ? 'bg-[var(--kz-warning-solid)] text-[#0B0B0D] shadow-[var(--kz-shadow-xs)]'
                      : 'bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border border-[var(--kz-warning-border)] hover:brightness-110'
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
                      ? 'bg-[var(--kz-danger-solid)] text-white shadow-[var(--kz-shadow-xs)]'
                      : 'bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border border-[var(--kz-danger-border)] hover:brightness-110'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>⚠️ Fora do Nicho Excluídos ({categoryExclusions.length})</span>
                </button>
              )}
            </div>

            {/* Quick Actions per Tab */}
            {activeCandidatesTab === 'unique' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleAll(true)}
                  className="text-xs text-[var(--kz-accent-text)] hover:underline cursor-pointer font-semibold"
                >
                  Marcar Todos
                </button>
                <span className="text-[var(--kz-text-subtle)]">·</span>
                <button
                  type="button"
                  onClick={() => handleToggleAll(false)}
                  className="text-xs text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)] hover:underline cursor-pointer"
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
                  className="text-xs px-2.5 py-1 border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] bg-[var(--kz-bg-subtle)] focus:outline-none focus:border-[var(--kz-accent)]"
                />
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[500px]">
            {activeCandidatesTab === 'unique' ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] border-b border-[var(--kz-border-default)] z-10">
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
                <tbody className="divide-y divide-[var(--kz-border-subtle)]">
                  {parsedCandidates.map((candidate, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-[var(--kz-bg-hover)] transition-colors ${
                        candidate.selected ? 'bg-[var(--kz-accent-soft)]/30' : 'opacity-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={candidate.selected}
                          onChange={() => handleToggleCandidate(idx)}
                          className="rounded accent-[var(--kz-accent)] cursor-pointer"
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
                              className="w-full text-xs px-2 py-1 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded font-medium text-[var(--kz-text-primary)]"
                            />
                            <input
                              type="text"
                              value={candidate.contactName || ''}
                              onChange={(e) => handleUpdateCandidateField(idx, 'contactName', e.target.value)}
                              placeholder="Nome do Contato (ex: Dr. Carlos)"
                              className="w-full text-[11px] px-2 py-0.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded text-[var(--kz-text-secondary)]"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-[var(--kz-text-primary)] flex items-center gap-1.5 flex-wrap">
                              <Building2 className="w-3.5 h-3.5 text-[var(--kz-text-subtle)] shrink-0" />
                              <span>{candidate.companyName}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)]">
                                No Nicho
                              </span>
                            </div>
                            {candidate.contactName && (
                              <div className="text-[11px] text-[var(--kz-text-muted)] flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-[var(--kz-accent)]" />
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
                            className="w-full text-xs px-2 py-1 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded text-[var(--kz-text-primary)]"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] border border-[var(--kz-accent-border)]">
                              <Tag className="w-2.5 h-2.5 text-[var(--kz-accent)] shrink-0" />
                              <span className="truncate max-w-[130px]">{candidate.category || newNicheSegment || 'Geral'}</span>
                            </span>
                            {candidate.category && (
                              <button
                                type="button"
                                onClick={() => handleExcludeCategory(candidate.category!)}
                                className="text-[10px] text-[var(--kz-danger-text)] hover:text-white hover:bg-[var(--kz-danger-solid)] px-1.5 py-0.5 rounded transition-colors cursor-pointer border border-[var(--kz-danger-border)] font-medium shrink-0"
                                title={`Excluir todos os contatos da categoria "${candidate.category}"`}
                              >
                                ✕ Excluir
                              </button>
                            )}
                          </div>
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
                            className="w-full text-xs px-2 py-1 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded font-mono text-[var(--kz-success-text)]"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`https://wa.me/${candidate.phone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--kz-success-text)] hover:text-[var(--kz-text-primary)] p-1 hover:bg-[var(--kz-success-bg)] rounded transition-colors"
                              title="Testar conversa no WhatsApp"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <span className="font-mono tabular-nums text-[var(--kz-success-text)] font-semibold">
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
                              className="w-full text-[11px] px-2 py-0.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded font-mono text-[var(--kz-info-text)]"
                            />
                            <input
                              type="url"
                              value={candidate.websiteUrl || ''}
                              onChange={(e) => handleUpdateCandidateField(idx, 'websiteUrl', e.target.value)}
                              placeholder="Site atual ou rede social"
                              className="w-full text-[11px] px-2 py-0.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded font-mono text-[var(--kz-text-secondary)]"
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
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--kz-info-bg)] text-[var(--kz-info-text)] hover:brightness-110 border border-[var(--kz-info-border)] transition-all"
                                title="Abrir perfil no Google Meu Negócio / Maps"
                              >
                                <MapPin className="w-3 h-3 text-[var(--kz-info-text)] shrink-0" />
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
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-hover)] hover:text-[var(--kz-text-primary)] border border-[var(--kz-border-subtle)] transition-colors"
                                title={candidate.websiteUrl}
                              >
                                <Globe className="w-2.5 h-2.5 text-[var(--kz-text-muted)] shrink-0" />
                                <span className="truncate max-w-[120px]">
                                  {candidate.websiteUrl.replace(/^https?:\/\/(www\.)?/, '')}
                                </span>
                                <ExternalLink className="w-2 h-2 ml-0.5 shrink-0" />
                              </a>
                            )}

                            {!candidate.googleMapsUrl && !candidate.websiteUrl && (
                              <span className="text-[11px] text-[var(--kz-text-subtle)] italic">Nenhum link detectado</span>
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
                            className="w-full text-xs px-2 py-1 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded text-[var(--kz-text-primary)]"
                          />
                        ) : (
                          <div className="text-[var(--kz-text-muted)] text-[11px]">
                            <div className="font-medium text-[var(--kz-text-primary)] truncate max-w-[130px]">
                              {candidate.city || activeNiche.city}
                            </div>
                            {candidate.address && (
                              <div className="text-[var(--kz-text-muted)] truncate max-w-[130px] mt-0.5">
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
                            className="w-14 text-xs px-1.5 py-1 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded font-mono text-[var(--kz-text-primary)]"
                          />
                        ) : candidate.googleRating ? (
                          <span className="flex items-center gap-0.5 text-amber-400 font-semibold text-xs">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{candidate.googleRating}</span>
                          </span>
                        ) : (
                          <span className="text-[var(--kz-text-subtle)] text-[11px]">-</span>
                        )}
                      </td>

                      {/* Opportunity / Script */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] border border-[var(--kz-border-subtle)]">
                            {candidate.recommendedScript === 'script1'
                              ? 'Script 1 · Mockup'
                              : candidate.recommendedScript === 'script2'
                              ? 'Script 2 · Google'
                              : 'Script 3 · Cold Call'}
                          </span>
                          <div className="text-[var(--kz-text-muted)] text-[11px] truncate max-w-[180px]">
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
                              ? 'bg-[var(--kz-success-solid)] text-white hover:brightness-110'
                              : 'text-[var(--kz-text-subtle)] hover:text-[var(--kz-text-primary)] hover:bg-[var(--kz-bg-hover)]'
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
                  <div className="p-8 text-center bg-[var(--kz-bg-subtle)] rounded-lg border border-dashed border-[var(--kz-border-default)] space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-[var(--kz-success-text)] mx-auto" />
                    <p className="text-xs font-semibold text-[var(--kz-text-primary)]">
                      {duplicateSearch ? 'Nenhum contato repetido corresponde à sua busca.' : 'Nenhum contato repetido pendente!'}
                    </p>
                    <p className="text-[11px] text-[var(--kz-text-muted)] max-w-sm mx-auto">
                      Todos os contatos da sua planilha estão na lista de contatos únicos mantidos para importação.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[var(--kz-bg-subtle)] text-[var(--kz-warning-text)] border-b border-[var(--kz-warning-border)] z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-16">Linha</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Empresa / Contato</th>
                        <th className="py-2.5 px-3 min-w-[150px]">WhatsApp</th>
                        <th className="py-2.5 px-3 min-w-[260px]">Motivo da Duplicação</th>
                        <th className="py-2.5 px-3 min-w-[120px]">Status</th>
                        <th className="py-2.5 px-3 min-w-[140px] text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--kz-border-subtle)] bg-[var(--kz-warning-bg)]/30">
                      {filteredDuplicates.map((dup) => (
                        <tr key={dup.id} className="hover:bg-[var(--kz-warning-bg)] transition-colors">
                          {/* Original line */}
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border border-[var(--kz-warning-border)]">
                              Linha {dup.originalIndex}
                            </span>
                          </td>

                          {/* Company / Contact */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[var(--kz-text-primary)]">
                              {dup.candidate.companyName}
                            </div>
                            {dup.candidate.contactName && (
                              <div className="text-[11px] text-[var(--kz-text-muted)] flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-[var(--kz-accent)]" />
                                <span>{dup.candidate.contactName}</span>
                              </div>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono tabular-nums text-[var(--kz-text-secondary)] font-medium">
                              {formatDisplayPhone(dup.candidate.phone)}
                            </span>
                          </td>

                          {/* Duplicate Reason Details */}
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                {dup.matchType === 'phone' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border border-[var(--kz-danger-border)] flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-[var(--kz-danger-text)]" />
                                    Telefone Duplicado
                                  </span>
                                ) : dup.matchType === 'name' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border border-[var(--kz-warning-border)] flex items-center gap-1">
                                    <Building2 className="w-3 h-3 text-[var(--kz-warning-text)]" />
                                    Nome Duplicado
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--kz-info-bg)] text-[var(--kz-info-text)] border border-[var(--kz-info-border)] flex items-center gap-1">
                                    <Check className="w-3 h-3 text-[var(--kz-info-text)]" />
                                    Já Existe no CRM
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[var(--kz-text-secondary)] leading-tight">
                                {dup.reason}
                              </p>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border border-[var(--kz-warning-border)]">
                              <X className="w-3 h-3" />
                              Repetido Excluído
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRestoreDuplicate(dup)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[var(--kz-accent-text)] bg-[var(--kz-bg-surface)] hover:bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] rounded-lg transition-colors cursor-pointer"
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
            ) : activeCandidatesTab === 'incompatible_category' ? (
              /* Fora do Nicho Excluídos Table */
              <div>
                {filteredDuplicates.length === 0 ? (
                  <div className="p-8 text-center bg-[var(--kz-bg-subtle)] rounded-lg border border-dashed border-[var(--kz-border-default)] space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-[var(--kz-success-text)] mx-auto" />
                    <p className="text-xs font-semibold text-[var(--kz-text-primary)]">
                      {duplicateSearch ? 'Nenhum estabelecimento corresponde à sua busca.' : 'Nenhum contato fora do nicho pendente!'}
                    </p>
                    <p className="text-[11px] text-[var(--kz-text-muted)] max-w-sm mx-auto">
                      Todos os contatos da planilha correspondem perfeitamente ao nicho de {activeNiche.name}.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[var(--kz-bg-subtle)] text-[var(--kz-danger-text)] border-b border-[var(--kz-danger-border)] z-10">
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
                    <tbody className="divide-y divide-[var(--kz-border-subtle)] bg-[var(--kz-danger-bg)]/30">
                      {filteredDuplicates.map((dup) => (
                        <tr key={dup.id} className="hover:bg-[var(--kz-danger-bg)] transition-colors">
                          {/* Original line */}
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border border-[var(--kz-danger-border)]">
                              Linha {dup.originalIndex}
                            </span>
                          </td>

                          {/* Company / Contact */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[var(--kz-text-primary)]">
                              {dup.candidate.companyName}
                            </div>
                            {dup.candidate.contactName && (
                              <div className="text-[11px] text-[var(--kz-text-muted)] flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-[var(--kz-accent)]" />
                                <span>{dup.candidate.contactName}</span>
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border border-[var(--kz-danger-border)]">
                              <Ban className="w-3 h-3 text-[var(--kz-danger-text)]" />
                              <span>{dup.candidate.category || dup.matchedWith || 'Fora do nicho'}</span>
                            </span>
                          </td>

                          {/* Phone */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono tabular-nums text-[var(--kz-text-secondary)] font-medium">
                              {formatDisplayPhone(dup.candidate.phone)}
                            </span>
                          </td>

                          {/* Incompatible Reason */}
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <p className="text-[11px] text-[var(--kz-danger-text)] font-medium leading-tight">
                                {dup.reason}
                              </p>
                              <span className="text-[10px] text-[var(--kz-text-muted)]">
                                Não corresponde ao perfil de {activeNiche.name.split('&')[0].trim()}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border border-[var(--kz-danger-border)]">
                              <Ban className="w-3 h-3" />
                              Fora do Nicho
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRestoreDuplicate(dup)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[var(--kz-danger-text)] bg-[var(--kz-bg-surface)] hover:bg-[var(--kz-danger-bg)] border border-[var(--kz-danger-border)] rounded-lg transition-colors cursor-pointer"
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
            ) : (
              /* Excluídos por Categoria / Nicho Table */
              <div>
                {filteredCategoryExcluded.length === 0 ? (
                  <div className="p-8 text-center bg-[var(--kz-danger-bg)]/40 rounded-lg border border-dashed border-[var(--kz-danger-border)] space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-[var(--kz-success-text)] mx-auto" />
                    <p className="text-xs font-semibold text-[var(--kz-text-primary)]">
                      {duplicateSearch ? 'Nenhum estabelecimento corresponde à sua busca.' : 'Nenhum contato excluído por categoria!'}
                    </p>
                    <p className="text-[11px] text-[var(--kz-text-muted)] max-w-sm mx-auto">
                      Todos os contatos da planilha pertencem ao nicho mantido.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[var(--kz-bg-subtle)] text-[var(--kz-danger-text)] border-b border-[var(--kz-danger-border)] z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-16">Linha</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Empresa / Contato</th>
                        <th className="py-2.5 px-3 min-w-[160px]">Categoria Excluída</th>
                        <th className="py-2.5 px-3 min-w-[150px]">WhatsApp</th>
                        <th className="py-2.5 px-3 min-w-[280px]">Motivo da Exclusão</th>
                        <th className="py-2.5 px-3 min-w-[130px]">Status</th>
                        <th className="py-2.5 px-3 min-w-[140px] text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--kz-border-subtle)] bg-[var(--kz-danger-bg)]/30">
                      {filteredCategoryExcluded.map((exc) => (
                        <tr key={exc.id} className="hover:bg-[var(--kz-danger-bg)] transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border border-[var(--kz-danger-border)]">
                              Linha {exc.originalIndex}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[var(--kz-text-primary)]">
                              {exc.candidate.companyName}
                            </div>
                            {exc.candidate.contactName && (
                              <div className="text-[11px] text-[var(--kz-text-muted)] flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-[var(--kz-danger-text)]" />
                                <span>{exc.candidate.contactName}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border border-[var(--kz-danger-border)]">
                              <Tag className="w-3 h-3 text-[var(--kz-danger-text)]" />
                              <span>{exc.candidate.category || exc.matchedCategory}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono tabular-nums text-[var(--kz-text-secondary)] font-medium">
                              {formatDisplayPhone(exc.candidate.phone)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <p className="text-[11px] text-[var(--kz-danger-text)] font-medium leading-tight">
                                {exc.reason}
                              </p>
                              {exc.query && (
                                <span className="text-[10px] text-[var(--kz-text-muted)]">
                                  Filtro aplicado: "{exc.query}"
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border border-[var(--kz-danger-border)]">
                              <Ban className="w-3 h-3" />
                              Excluído do Nicho
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRestoreSingleCategoryExcludedLead(exc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[var(--kz-danger-text)] bg-[var(--kz-bg-surface)] hover:bg-[var(--kz-danger-bg)] border border-[var(--kz-danger-border)] rounded-lg transition-colors cursor-pointer"
                              title="Restaurar este contato de volta para a lista de contatos mantidos"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--kz-border-subtle)]">
            {activeCandidatesTab === 'unique' ? (
              <>
                <div className="text-xs text-[var(--kz-text-secondary)]">
                  Total a importar:{' '}
                  <strong className="text-[var(--kz-text-primary)] font-bold">
                    {parsedCandidates.filter((c) => c.selected).length} leads mantidos no nicho
                  </strong>{' '}
                  {(duplicatesOnly.length > 0 || categoryExclusions.length > 0 || categoryExcludedLeads.length > 0) && (
                    <span className="text-[var(--kz-text-muted)] font-medium">
                      (
                      {categoryExcludedLeads.length > 0 ? `${categoryExcludedLeads.length} excluídos por categoria` : ''}
                      {categoryExcludedLeads.length > 0 && (duplicatesOnly.length > 0 || categoryExclusions.length > 0) ? ', ' : ''}
                      {duplicatesOnly.length > 0 ? `${duplicatesOnly.length} repetidos` : ''}
                      {duplicatesOnly.length > 0 && categoryExclusions.length > 0 ? ' e ' : ''}
                      {categoryExclusions.length > 0 ? `${categoryExclusions.length} fora do nicho excluídos automaticamente` : ''}
                      )
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCommitImport}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-[var(--kz-accent-fg)] bg-[var(--kz-accent)] hover:bg-[var(--kz-accent-hover)] active:bg-[var(--kz-accent-active)] rounded-lg shadow-[var(--kz-shadow-sm)] transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Criar Nicho "{newNicheName.trim() || 'Novo Nicho'}" e Importar {parsedCandidates.filter((c) => c.selected).length} Leads Mantidos
                  </span>
                </button>
              </>
            ) : activeCandidatesTab === 'category_excluded' ? (
              <>
                <div className="text-xs text-[var(--kz-danger-text)] font-medium">
                  {categoryExcludedLeads.length} contatos foram excluídos pelo filtro de categoria/nicho da planilha.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreAllExcludedCategories}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[var(--kz-danger-text)] bg-[var(--kz-danger-bg)] hover:brightness-110 border border-[var(--kz-danger-border)] rounded-lg transition-all cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Restaurar Todos os {categoryExcludedLeads.length} Excluídos por Categoria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveCandidatesTab('unique')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--kz-accent-fg)] bg-[var(--kz-accent)] hover:bg-[var(--kz-accent-hover)] rounded-lg shadow-[var(--kz-shadow-xs)] transition-colors cursor-pointer"
                  >
                    <span>Voltar aos Contatos Mantidos ({parsedCandidates.length})</span>
                  </button>
                </div>
              </>
            ) : activeCandidatesTab === 'duplicates' ? (
              <>
                <div className="text-xs text-[var(--kz-warning-text)] font-medium">
                  {duplicatesOnly.length} contatos repetidos por telefone ou nome foram excluídos automaticamente da lista de importação.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreOnlyDuplicates}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[var(--kz-warning-text)] bg-[var(--kz-warning-bg)] hover:brightness-110 border border-[var(--kz-warning-border)] rounded-lg transition-all cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Restaurar Todos os {duplicatesOnly.length} Repetidos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveCandidatesTab('unique')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--kz-accent-fg)] bg-[var(--kz-accent)] hover:bg-[var(--kz-accent-hover)] rounded-lg shadow-[var(--kz-shadow-xs)] transition-colors cursor-pointer"
                  >
                    <span>Voltar aos Contatos Mantidos ({parsedCandidates.length})</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-[var(--kz-danger-text)] font-medium">
                  {categoryExclusions.length} estabelecimentos com categorias fora do nicho ({newNicheName.trim() || activeNiche.name}) foram excluídos da planilha.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreOnlyCategoryExclusions}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[var(--kz-danger-text)] bg-[var(--kz-danger-bg)] hover:brightness-110 border border-[var(--kz-danger-border)] rounded-lg transition-all cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Restaurar Todos os {categoryExclusions.length} Fora do Nicho</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveCandidatesTab('unique')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--kz-accent-fg)] bg-[var(--kz-accent)] hover:bg-[var(--kz-accent-hover)] rounded-lg shadow-[var(--kz-shadow-xs)] transition-colors cursor-pointer"
                  >
                    <span>Voltar aos Contatos Mantidos ({parsedCandidates.length})</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* HISTÓRICO DE PLANILHAS IMPORTADAS NA NUVEM */}
      {importedSheets && importedSheets.length > 0 && (
        <div className="bg-[var(--kz-bg-surface)] rounded-xl border border-[var(--kz-border-subtle)] shadow-[var(--kz-shadow-xs)] overflow-hidden mt-6">
          <div className="p-4 sm:p-5 border-b border-[var(--kz-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--kz-bg-subtle)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--kz-success-bg)] border border-[var(--kz-success-border)] text-[var(--kz-success-text)] flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--kz-text-primary)]">
                  Planilhas Importadas Salvas na Nuvem ({importedSheets.length})
                </h3>
                <p className="text-xs text-[var(--kz-text-muted)]">
                  Estas planilhas e seus contatos ficam salvos permanentemente no seu banco de dados mesmo se você sair da conta.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onSwitchToKanban}
              className="px-3.5 py-1.5 text-xs font-semibold text-[var(--kz-accent-text)] bg-[var(--kz-accent-soft)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-accent-border)] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>Ver no Pipeline</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[var(--kz-border-subtle)]">
            {importedSheets.map((sheet) => (
              <div
                key={sheet.id}
                className="p-4 hover:bg-[var(--kz-bg-hover)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] flex items-center justify-center shrink-0 mt-0.5">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--kz-text-primary)]">{sheet.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] border border-[var(--kz-accent-border)]">
                        {sheet.nicheName}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)]">
                        {sheet.totalLeads} contatos na pipeline
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--kz-text-muted)] mt-1 flex items-center gap-2">
                      <span>Importada em {new Date(sheet.importedAt).toLocaleDateString('pt-BR')} às {new Date(sheet.importedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {sheet.format && <span>• {sheet.format}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={onSwitchToKanban}
                    className="px-3 py-1.5 text-xs font-semibold text-[var(--kz-text-secondary)] hover:text-[var(--kz-accent-text)] bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-accent-soft)] border border-[var(--kz-border-default)] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Ir para Pipeline</span>
                  </button>
                  {onDeleteImportedSheet && (
                    <button
                      type="button"
                      onClick={() => setSheetToDelete(sheet)}
                      className="p-1.5 text-[var(--kz-text-subtle)] hover:text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)] rounded-lg transition-colors cursor-pointer"
                      title="Excluir do histórico"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(sheetToDelete)}
        onClose={() => setSheetToDelete(null)}
        onConfirm={() => {
          if (sheetToDelete && onDeleteImportedSheet) {
            onDeleteImportedSheet(sheetToDelete.id);
          }
          setSheetToDelete(null);
        }}
        title="Remover Planilha do Histórico"
        description={
          sheetToDelete ? (
            <span>
              Remover do histórico a planilha <strong className="text-[var(--kz-text-primary)]">{sheetToDelete.name}</strong>? Os leads já
              importados continuarão normalmente no funil.
            </span>
          ) : (
            ''
          )
        }
        confirmLabel="Remover do Histórico"
        variant="danger"
      />
    </div>
  );
};
