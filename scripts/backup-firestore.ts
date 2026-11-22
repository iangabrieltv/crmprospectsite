/**
 * Script administrativo SOMENTE-LEITURA para backup completo e recursivo do Firestore
 * (projeto correto, banco Firestore nomeado, workspace `adm_equipeie`, descoberta dinâmica
 * de todas as coleções e subcoleções aninhadas, preservação de IDs e validação pós-gravação).
 *
 * Nunca altera, cria ou exclui documentos no Firestore.
 * Requer credencial somente-leitura via `GOOGLE_APPLICATION_CREDENTIALS` ou ADC válido.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account-readonly.json npm run backup:firestore
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  exportWorkspaceTreeReadOnly,
  validateRecursiveBackupManifest,
  ReadableFirestore,
  RecursiveBackupDocNode,
} from '../src/services/adminBackupService';

function loadConfig(): { projectId: string; firestoreDatabaseId: string } {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf-8');
  const parsed = JSON.parse(raw) as { projectId: string; firestoreDatabaseId: string };
  return {
    projectId: (process.env.FIREBASE_PROJECT_ID || parsed.projectId || '').trim(),
    firestoreDatabaseId: (process.env.FIREBASE_DATABASE_ID || parsed.firestoreDatabaseId || '').trim(),
  };
}

function checkCredentialsAvailability(): { ok: boolean; detail?: string } {
  const credPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (credPath) {
    const resolved = path.resolve(credPath);
    if (!fs.existsSync(resolved)) {
      return {
        ok: false,
        detail: `Arquivo GOOGLE_APPLICATION_CREDENTIALS não encontrado em: ${resolved}`,
      };
    }
    return { ok: true };
  }

  // Fallback check: standard gcloud ADC path when GOOGLE_APPLICATION_CREDENTIALS is omitted
  const adcPath = path.join(
    process.env.HOME || '',
    '.config',
    'gcloud',
    'application_default_credentials.json'
  );
  if (adcPath && fs.existsSync(adcPath)) {
    return { ok: true };
  }

  return {
    ok: false,
    detail:
      'Nenhuma credencial de leitura disponível (GOOGLE_APPLICATION_CREDENTIALS e Application Default Credentials ausentes). Nenhum backup real foi executado.',
  };
}

function writeNdjsonRecursive(
  outputDir: string,
  collectionPath: string,
  nodes: RecursiveBackupDocNode[]
): void {
  const safeFileName = collectionPath.replace(/[^a-zA-Z0-9_-]/g, '__') + '.ndjson';
  const lines = nodes.map((n) => JSON.stringify({ id: n.id, path: n.path, data: n.data }));
  fs.writeFileSync(
    path.join(outputDir, safeFileName),
    lines.join('\n') + (lines.length ? '\n' : ''),
    'utf-8'
  );

  for (const node of nodes) {
    for (const [subName, subNodes] of Object.entries(node.subcollections || {})) {
      writeNdjsonRecursive(outputDir, `${node.path}/${subName}`, subNodes);
    }
  }
}

async function runReadOnlyBackup() {
  const credCheck = checkCredentialsAvailability();
  if (!credCheck.ok) {
    console.error(`[Backup Firestore] ABORTADO: ${credCheck.detail}`);
    process.exit(1);
  }

  const { projectId, firestoreDatabaseId } = loadConfig();
  const workspaceId = (process.env.WORKSPACE_ID || 'adm_equipeie').trim();

  if (!projectId || !firestoreDatabaseId) {
    console.error(
      '[Backup Firestore] ABORTADO: projectId ou firestoreDatabaseId não configurados.'
    );
    process.exit(1);
  }

  const app = !getApps().length
    ? initializeApp({
        credential: applicationDefault(),
        projectId,
      })
    : getApp();

  const db = getFirestore(app, firestoreDatabaseId);
  const manifest = await exportWorkspaceTreeReadOnly(
    db as unknown as ReadableFirestore,
    {
      projectId,
      firestoreDatabaseId,
      workspaceId,
    }
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(process.cwd(), 'backups', `firestore-${timestamp}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const completeJsonPath = path.join(outputDir, 'backup_complete.json');
  fs.writeFileSync(completeJsonPath, JSON.stringify(manifest, null, 2), 'utf-8');

  for (const [topName, nodes] of Object.entries(manifest.collections)) {
    writeNdjsonRecursive(outputDir, `workspaces/${workspaceId}/${topName}`, nodes);
  }

  // Validate written file back from disk
  const rawSavedJson = fs.readFileSync(completeJsonPath, 'utf-8');
  const validation = validateRecursiveBackupManifest(rawSavedJson, {
    projectId,
    firestoreDatabaseId,
    workspaceId,
  });

  const reportPath = path.join(outputDir, 'validation_report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        status: validation.valid ? 'SUCCESS' : 'FAILED',
        validatedAt: new Date().toISOString(),
        outputDir,
        ...validation,
      },
      null,
      2
    ),
    'utf-8'
  );

  if (!validation.valid) {
    console.error('[Backup Firestore] FALHA NA VALIDAÇÃO DO BACKUP:');
    console.error(JSON.stringify(validation, null, 2));
    process.exit(1);
  }

  console.log('[Backup Firestore] SUCESSO — Backup recursivo somente-leitura validado:');
  console.log(
    JSON.stringify(
      {
        outputDir,
        completeJsonPath,
        reportPath,
        ...validation.summary,
        countsByCollection: manifest.countsByCollection,
      },
      null,
      2
    )
  );
}

runReadOnlyBackup().catch((err) => {
  console.error(
    '[Backup Firestore] Erro ao executar backup somente-leitura:',
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
