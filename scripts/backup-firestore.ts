/**
 * Script administrativo SOMENTE-LEITURA para backup completo do Firestore
 * (incluindo banco nomeado, todas as subcoleções do workspace e preservação integral de IDs).
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account-readonly.json npx tsx scripts/backup-firestore.ts
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function loadConfig(): { projectId: string; firestoreDatabaseId: string } {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf-8');
  const parsed = JSON.parse(raw) as { projectId: string; firestoreDatabaseId: string };
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || parsed.projectId,
    firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || parsed.firestoreDatabaseId,
  };
}

async function runReadOnlyBackup() {
  const { projectId, firestoreDatabaseId } = loadConfig();
  const workspaceId = process.env.WORKSPACE_ID || 'adm_equipeie';

  const app = !getApps().length
    ? initializeApp({
        credential: applicationDefault(),
        projectId,
      })
    : getApp();

  const db = getFirestore(app, firestoreDatabaseId);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(process.cwd(), 'backups', `firestore-${timestamp}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const workspaceRef = db.collection('workspaces').doc(workspaceId);
  const subcollections = await workspaceRef.listCollections();
  const knownNames = new Set(['leads', 'niches', 'importedSheets', ...subcollections.map((c) => c.id)]);

  const fullDump: Record<string, Array<{ id: string; data: Record<string, unknown> }>> = {};
  const counts: Record<string, number> = {};

  for (const colName of knownNames) {
    const snap = await workspaceRef.collection(colName).get();
    const docs: Array<{ id: string; data: Record<string, unknown> }> = [];
    const ndjsonLines: string[] = [];

    snap.forEach((docSnap) => {
      const record = { id: docSnap.id, data: docSnap.data() };
      docs.push(record);
      ndjsonLines.push(JSON.stringify(record));
    });

    fullDump[colName] = docs;
    counts[colName] = docs.length;

    fs.writeFileSync(
      path.join(outputDir, `${colName}.ndjson`),
      ndjsonLines.join('\n') + (ndjsonLines.length ? '\n' : ''),
      'utf-8'
    );
  }

  const manifest = {
    version: '3.0-admin-export',
    exportedAt: new Date().toISOString(),
    projectId,
    firestoreDatabaseId,
    workspaceId,
    counts,
    collections: fullDump,
  };

  fs.writeFileSync(
    path.join(outputDir, 'backup_complete.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  console.log('Backup somente-leitura concluído com sucesso:');
  console.log(JSON.stringify({ outputDir, projectId, firestoreDatabaseId, workspaceId, counts }, null, 2));
}

runReadOnlyBackup().catch((err) => {
  console.error('Erro ao executar backup somente-leitura do Firestore:', err instanceof Error ? err.message : err);
  process.exit(1);
});
