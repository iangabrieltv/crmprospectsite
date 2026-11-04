import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { Lead, NicheCampaign, ImportedSheet } from '../types/crm';
import firebaseConfigData from '../firebase-config';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfigData) : getApp();

// CRITICAL: Initialize Firestore with the database ID specified in config
export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId);
export const auth = getAuth(app);

export const WORKSPACE_ID = 'adm_equipeie';

// Helper error handler conforming to skill requirements
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  console.error(`[Firestore Error] op: ${operationType}, path: ${path}`, errMessage);
}

/**
 * Remove recursivamente todas as propriedades com valor `undefined`,
 * pois o Firestore lança erro se encontrar qualquer campo `undefined` em setDoc ou writeBatch.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as any;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = sanitizeForFirestore(value);
      }
    }
    return result as any;
  }
  return data;
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

/**
 * Escuta em tempo real todas as campanhas/nichos do workspace
 */
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
        list.push(docSnap.data() as NicheCampaign);
      });
      // Sort by creation date
      list.sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/niches`);
      onError?.(err);
    }
  );
}

/**
 * Escuta em tempo real todos os leads do workspace (Kanban + Pipeline)
 * Permite sincronização instantânea entre múltiplos dispositivos.
 */
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
        list.push(docSnap.data() as Lead);
      });
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/leads`);
      onError?.(err);
    }
  );
}

/**
 * Escuta em tempo real o histórico de planilhas importadas
 */
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
        list.push(docSnap.data() as ImportedSheet);
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
// MUTAÇÕES NO BANCO DE DADOS EM TEMPO REAL
// ---------------------------------------------------------------------------

/**
 * Salva ou atualiza um lead no Firestore (com sanitização contra undefined)
 */
export async function syncLeadToFirestore(lead: Lead): Promise<void> {
  try {
    const leadRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
    const cleanLead = sanitizeForFirestore(lead);
    await setDoc(leadRef, cleanLead, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/leads/${lead.id}`);
    throw err;
  }
}

/**
 * Remove um lead do Firestore
 */
export async function deleteLeadFromFirestore(leadId: string): Promise<void> {
  try {
    const leadRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', leadId);
    await deleteDoc(leadRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/leads/${leadId}`);
    throw err;
  }
}

/**
 * Salva ou atualiza um nicho no Firestore (com sanitização contra undefined)
 */
export async function syncNicheToFirestore(niche: NicheCampaign): Promise<void> {
  try {
    const nicheRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', niche.id);
    const cleanNiche = sanitizeForFirestore(niche);
    await setDoc(nicheRef, cleanNiche, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/niches/${niche.id}`);
    throw err;
  }
}

/**
 * Remove um nicho do Firestore
 */
export async function deleteNicheFromFirestore(nicheId: string): Promise<void> {
  try {
    const nicheRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', nicheId);
    await deleteDoc(nicheRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/niches/${nicheId}`);
    throw err;
  }
}

/**
 * Salva o registro de uma planilha importada no Firestore
 */
export async function syncImportedSheetToFirestore(sheet: ImportedSheet): Promise<void> {
  try {
    const sheetRef = doc(db, 'workspaces', WORKSPACE_ID, 'importedSheets', sheet.id);
    const cleanSheet = sanitizeForFirestore(sheet);
    await setDoc(sheetRef, cleanSheet, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/importedSheets/${sheet.id}`);
    throw err;
  }
}

/**
 * Remove o registro de uma planilha importada do Firestore
 */
export async function deleteImportedSheetFromFirestore(sheetId: string): Promise<void> {
  try {
    const sheetRef = doc(db, 'workspaces', WORKSPACE_ID, 'importedSheets', sheetId);
    await deleteDoc(sheetRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/importedSheets/${sheetId}`);
    throw err;
  }
}

/**
 * Importa múltiplos leads em lote (batch) para salvar na nuvem
 * Sanitiza cada documento para garantir que nenhum campo undefined interrompa o commit.
 */
export async function batchSyncLeadsToFirestore(leads: Lead[]): Promise<void> {
  if (leads.length === 0) return;

  // Firestore batches have limit of 500 writes
  const chunkSize = 400;
  for (let i = 0; i < leads.length; i += chunkSize) {
    const chunk = leads.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const lead of chunk) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
      const cleanLead = sanitizeForFirestore(lead);
      batch.set(ref, cleanLead, { merge: true });
    }

    try {
      await batch.commit();
      console.log(`[Firestore] ${chunk.length} leads salvos com sucesso na nuvem.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/leads (batch)`);
      throw err;
    }
  }
}

/**
 * Inicializa nichos no Firestore se o banco estiver vazio (NUNCA insere leads fictícios)
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
        batch.set(nRef, sanitizeForFirestore(niche));
      }
      await batch.commit();
      console.log(`[Firestore] ${initialNiches.length} campanhas/nichos inicializados na nuvem.`);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/seed`);
  }
}

/**
 * Remove todos os contatos da nuvem (Firestore) para começar 100% do zero.
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
    console.log(`[Firestore] ${count} leads removidos da nuvem com sucesso.`);
    return count;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/leads (clearAll)`);
    throw err;
  }
}

/**
 * Remove todas as planilhas importadas da nuvem (Firestore)
 */
export async function clearAllImportedSheetsFromFirestore(): Promise<number> {
  try {
    const sheetsCol = collection(db, 'workspaces', WORKSPACE_ID, 'importedSheets');
    const snap = await getDocs(sheetsCol);
    if (snap.empty) return 0;

    const count = snap.size;
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();
    console.log(`[Firestore] ${count} planilhas importadas removidas da nuvem.`);
    return count;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/importedSheets (clearAll)`);
    throw err;
  }
}

/**
 * Remove nichos antigos legados (advogados, clínicas de estética, carros, etc.) da nuvem
 */
export async function purgeOldSampleNichesFromFirestore(
  cleanBaselineNiches: NicheCampaign[]
): Promise<void> {
  try {
    const nichesCol = collection(db, 'workspaces', WORKSPACE_ID, 'niches');
    const snap = await getDocs(nichesCol);
    if (snap.empty) return;

    const isOldSample = (id: string, name: string) => {
      const lowerId = (id || '').toLowerCase();
      const lowerName = (name || '').toLowerCase();
      return (
        lowerId.includes('estetica-automotiva') ||
        lowerId.includes('clinicas-locais') ||
        lowerId.includes('nutricionistas') ||
        lowerId.includes('odontologia') ||
        lowerName.includes('estética automotiva') ||
        lowerName.includes('clínicas & consultórios') ||
        lowerName.includes('advogad') ||
        lowerName.includes('advocacia') ||
        lowerName.includes('carro') ||
        lowerName.includes('automot')
      );
    };

    const batch = writeBatch(db);
    let deletedCount = 0;
    for (const d of snap.docs) {
      const data = d.data() as NicheCampaign;
      if (isOldSample(d.id, data.name || '')) {
        batch.delete(d.ref);
        deletedCount++;
      }
    }

    // Ensure clean baseline niche exists
    for (const clean of cleanBaselineNiches) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'niches', clean.id);
      batch.set(ref, sanitizeForFirestore(clean), { merge: true });
    }

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`[Firestore] ${deletedCount} nichos legados removidos com sucesso.`);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/niches (purge)`);
  }
}

/**
 * Reseta o banco de dados inteiro para o estado inicial 100% limpo:
 * - Remove todos os leads (500 contatos, contatados, etc.)
 * - Remove todas as planilhas importadas
 * - Limpa todos os nichos e mantém apenas o nicho padrão de prospecção
 */
export async function resetFirestoreToCleanBaseline(
  cleanBaselineNiches: NicheCampaign[]
): Promise<void> {
  try {
    await clearAllLeadsFromFirestore();
    await clearAllImportedSheetsFromFirestore();

    const nichesCol = collection(db, 'workspaces', WORKSPACE_ID, 'niches');
    const snap = await getDocs(nichesCol);
    const batch = writeBatch(db);

    for (const d of snap.docs) {
      batch.delete(d.ref);
    }

    for (const clean of cleanBaselineNiches) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'niches', clean.id);
      batch.set(ref, sanitizeForFirestore(clean));
    }

    await batch.commit();
    console.log('[Firestore] Banco de dados resetado para o estado limpo inicial.');
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/resetToClean`);
    throw err;
  }
}
