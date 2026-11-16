import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDocFromServer,
} from 'firebase/firestore';
import { Lead, NicheCampaign, ImportedSheet } from '../types/crm';
import { firebaseConfig, WORKSPACE_ID as CONFIG_WORKSPACE_ID, USE_FIREBASE_EMULATOR } from '../config/env';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with the database ID specified in config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Isolated local emulator wiring (only active when VITE_USE_FIREBASE_EMULATOR=true)
let emulatorsConnected = false;
if (USE_FIREBASE_EMULATOR && !emulatorsConnected && typeof window !== 'undefined') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8088);
    emulatorsConnected = true;
  } catch (err) {
    console.warn('[Firebase Emulator] Falha ao conectar nos emuladores locais:', err);
  }
}

export const WORKSPACE_ID = CONFIG_WORKSPACE_ID;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
  };
  console.error(`[Firestore Error] op: ${operationType}, path: ${path}`, errInfo.error);
  return errInfo;
}

/**
 * Remove recursivamente todas as propriedades com valor `undefined`,
 * pois o Firestore lança erro se encontrar qualquer campo `undefined` em setDoc ou writeBatch.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as unknown as T;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = sanitizeForFirestore(value);
      }
    }
    return result as T;
  }
  return data;
}

function withVersionMetadata<T extends { schemaVersion?: number; updatedAt?: string }>(data: T): T {
  return {
    ...data,
    schemaVersion: data.schemaVersion ?? 1,
    updatedAt: new Date().toISOString(),
  };
}

// Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'workspaces', WORKSPACE_ID));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `workspaces/${WORKSPACE_ID}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// REAL-TIME FIRESTORE SUBSCRIPTIONS
// ---------------------------------------------------------------------------

export function subscribeToNiches(
  onUpdate: (niches: NicheCampaign[]) => void,
  onError?: (error: Error) => void
) {
  const nichesCol = collection(db, 'workspaces', WORKSPACE_ID, 'niches');
  return onSnapshot(
    nichesCol,
    (snapshot) => {
      const list: NicheCampaign[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as NicheCampaign;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/niches`);
      onError?.(err);
    }
  );
}

export function subscribeToLeads(
  onUpdate: (leads: Lead[]) => void,
  onError?: (error: Error) => void
) {
  const leadsCol = collection(db, 'workspaces', WORKSPACE_ID, 'leads');
  return onSnapshot(
    leadsCol,
    (snapshot) => {
      const list: Lead[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Lead;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/leads`);
      onError?.(err);
    }
  );
}

export function subscribeToImportedSheets(
  onUpdate: (sheets: ImportedSheet[]) => void,
  onError?: (error: Error) => void
) {
  const sheetsCol = collection(db, 'workspaces', WORKSPACE_ID, 'importedSheets');
  return onSnapshot(
    sheetsCol,
    (snapshot) => {
      const list: ImportedSheet[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ImportedSheet;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort((a, b) => new Date(b.importedAt || '').getTime() - new Date(a.importedAt || '').getTime());
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/importedSheets`);
      onError?.(err);
    }
  );
}

// ---------------------------------------------------------------------------
// LEITURA COMPLETA PARA BACKUP & DIAGNÓSTICO
// ---------------------------------------------------------------------------

export async function fetchFullWorkspaceSnapshot(): Promise<{
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
}> {
  const [nichesSnap, leadsSnap, sheetsSnap] = await Promise.all([
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'niches')),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'leads')),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'importedSheets')),
  ]);

  const niches: NicheCampaign[] = [];
  nichesSnap.forEach((d) => niches.push({ ...(d.data() as NicheCampaign), id: d.id }));

  const leads: Lead[] = [];
  leadsSnap.forEach((d) => leads.push({ ...(d.data() as Lead), id: d.id }));

  const importedSheets: ImportedSheet[] = [];
  sheetsSnap.forEach((d) => importedSheets.push({ ...(d.data() as ImportedSheet), id: d.id }));

  return { niches, leads, importedSheets };
}

// ---------------------------------------------------------------------------
// MUTAÇÕES NO BANCO DE DADOS EM TEMPO REAL
// ---------------------------------------------------------------------------

export async function syncLeadToFirestore(lead: Lead): Promise<void> {
  try {
    const leadRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
    const cleanLead = sanitizeForFirestore(withVersionMetadata(lead));
    await setDoc(leadRef, cleanLead, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/leads/${lead.id}`);
    throw err;
  }
}

export async function deleteLeadFromFirestore(leadId: string): Promise<void> {
  try {
    const leadRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', leadId);
    await deleteDoc(leadRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/leads/${leadId}`);
    throw err;
  }
}

export async function syncNicheToFirestore(niche: NicheCampaign): Promise<void> {
  try {
    const nicheRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', niche.id);
    const cleanNiche = sanitizeForFirestore(withVersionMetadata(niche));
    await setDoc(nicheRef, cleanNiche, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/niches/${niche.id}`);
    throw err;
  }
}

export async function deleteNicheFromFirestore(nicheId: string): Promise<void> {
  try {
    const nicheRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', nicheId);
    await deleteDoc(nicheRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/niches/${nicheId}`);
    throw err;
  }
}

export async function batchDeleteLeadsFromFirestore(leadIds: string[]): Promise<void> {
  if (leadIds.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, 'workspaces', WORKSPACE_ID, 'leads', id));
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/leads (batchDelete)`);
      throw err;
    }
  }
}

export async function reassignLeadsNicheInFirestore(
  leadIds: string[],
  targetNicheId: string
): Promise<void> {
  if (leadIds.length === 0) return;
  const chunkSize = 400;
  const updatedAt = new Date().toISOString();
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'leads', id),
        { nicheId: targetNicheId, updatedAt },
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `workspaces/${WORKSPACE_ID}/leads (reassignNiche)`);
      throw err;
    }
  }
}

export async function syncImportedSheetToFirestore(sheet: ImportedSheet): Promise<void> {
  try {
    const sheetRef = doc(db, 'workspaces', WORKSPACE_ID, 'importedSheets', sheet.id);
    const cleanSheet = sanitizeForFirestore(withVersionMetadata(sheet));
    await setDoc(sheetRef, cleanSheet, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/importedSheets/${sheet.id}`);
    throw err;
  }
}

export async function deleteImportedSheetFromFirestore(sheetId: string): Promise<void> {
  try {
    const sheetRef = doc(db, 'workspaces', WORKSPACE_ID, 'importedSheets', sheetId);
    await deleteDoc(sheetRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/importedSheets/${sheetId}`);
    throw err;
  }
}

export async function batchSyncLeadsToFirestore(leads: Lead[]): Promise<void> {
  if (leads.length === 0) return;

  const chunkSize = 400;
  for (let i = 0; i < leads.length; i += chunkSize) {
    const chunk = leads.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const lead of chunk) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
      const cleanLead = sanitizeForFirestore(withVersionMetadata(lead));
      batch.set(ref, cleanLead, { merge: true });
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/leads (batch)`);
      throw err;
    }
  }
}

export async function batchSyncNichesToFirestore(niches: NicheCampaign[]): Promise<void> {
  if (niches.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < niches.length; i += chunkSize) {
    const chunk = niches.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const niche of chunk) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'niches', niche.id);
      batch.set(ref, sanitizeForFirestore(withVersionMetadata(niche)), { merge: true });
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/niches (batch)`);
      throw err;
    }
  }
}

export async function batchSyncImportedSheetsToFirestore(sheets: ImportedSheet[]): Promise<void> {
  if (sheets.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < sheets.length; i += chunkSize) {
    const chunk = sheets.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const sheet of chunk) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'importedSheets', sheet.id);
      batch.set(ref, sanitizeForFirestore(withVersionMetadata(sheet)), { merge: true });
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/importedSheets (batch)`);
      throw err;
    }
  }
}

/**
 * Inicializa nicho padrão no Firestore apenas se a coleção estiver vazia (nunca sobrescreve existentes).
 */
export async function seedFirestoreIfEmpty(
  initialNiches: NicheCampaign[],
  _initialLeads: Lead[] = []
): Promise<void> {
  try {
    const nichesSnap = await getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'niches'));
    if (nichesSnap.empty) {
      const batch = writeBatch(db);
      for (const niche of initialNiches) {
        const nRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', niche.id);
        batch.set(nRef, sanitizeForFirestore(withVersionMetadata(niche)));
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/seed`);
  }
}

/**
 * Remove todos os contatos da nuvem (somente via confirmação explícita manual).
 */
export async function clearAllLeadsFromFirestore(): Promise<number> {
  try {
    const leadsCol = collection(db, 'workspaces', WORKSPACE_ID, 'leads');
    const snap = await getDocs(leadsCol);
    if (snap.empty) return 0;

    const count = snap.size;
    const chunkSize = 400;
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
    return count;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/leads (clearAll)`);
    throw err;
  }
}

/**
 * Remove todas as planilhas importadas da nuvem (somente via confirmação explícita manual).
 */
export async function clearAllImportedSheetsFromFirestore(): Promise<number> {
  try {
    const sheetsCol = collection(db, 'workspaces', WORKSPACE_ID, 'importedSheets');
    const snap = await getDocs(sheetsCol);
    if (snap.empty) return 0;

    const count = snap.size;
    const chunkSize = 400;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
    return count;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/importedSheets (clearAll)`);
    throw err;
  }
}

/**
 * @deprecated Neutralizada na Etapa 0: não exclui mais nichos automaticamente por palavra-chave.
 * Mantida apenas como função inócua de compatibilidade para evitar que chamadas legadas apaguem dados reais.
 */
export async function purgeOldSampleNichesFromFirestore(
  _cleanBaselineNiches: NicheCampaign[]
): Promise<void> {
  console.warn(
    '[Proteção de Dados] purgeOldSampleNichesFromFirestore foi desativada para proteger campanhas comerciais reais.'
  );
}

/**
 * Reseta o banco de dados inteiro para o estado inicial limpo (somente via confirmação explícita manual).
 */
export async function resetFirestoreToCleanBaseline(
  cleanBaselineNiches: NicheCampaign[]
): Promise<void> {
  try {
    await clearAllLeadsFromFirestore();
    await clearAllImportedSheetsFromFirestore();

    const nichesCol = collection(db, 'workspaces', WORKSPACE_ID, 'niches');
    const snap = await getDocs(nichesCol);
    const chunkSize = 400;
    for (let i = 0; i < snap.docs.length; i += chunkSize) {
      const batch = writeBatch(db);
      for (const d of snap.docs.slice(i, i + chunkSize)) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }

    const seedBatch = writeBatch(db);
    for (const clean of cleanBaselineNiches) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'niches', clean.id);
      seedBatch.set(ref, sanitizeForFirestore(withVersionMetadata(clean)));
    }
    await seedBatch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/resetToClean`);
    throw err;
  }
}
