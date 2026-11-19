/**
 * Script administrativo SOMENTE-LEITURA para backup completo e recursivo do Firestore
 * (projeto correto, banco Firestore nomeado, workspace `adm_equipeie`, descoberta dinâmica
 * de todas as coleções e subcoleções aninhadas — inclusive documentos sem campos próprios via
 * `listDocuments()` —, preservação de IDs/caminhos e validação integral de manifesto + NDJSON).
 *
 * Nunca altera, cria ou exclui documentos no Firestore.
 * Requer credencial somente-leitura via `GOOGLE_APPLICATION_CREDENTIALS` ou ADC válido.
 *
 * Uso (fora do Git, com credencial autorizada somente-leitura):
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.secrets/kaizen-readonly.json npm run backup:firestore
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  checkCredentialsAvailability,
  classifyBackupErrorCode,
  exportWorkspaceTreeReadOnly,
  ReadableFirestore,
  validateBackupTargetConfig,
  writeAndValidateBackupPackage,
} from '../src/services/adminBackupService';

function loadConfig(): {
  projectId: string;
  firestoreDatabaseId: string;
  workspaceId: string;
} {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(cfgPath)) {
    throw new Error(`Arquivo de configuração não encontrado: ${cfgPath}`);
  }
  const raw = fs.readFileSync(cfgPath, 'utf-8');
  const parsed = JSON.parse(raw) as { projectId?: string; firestoreDatabaseId?: string };
  return {
    projectId: (process.env.FIREBASE_PROJECT_ID || parsed.projectId || '').trim(),
    firestoreDatabaseId: (
      process.env.FIREBASE_DATABASE_ID ||
      parsed.firestoreDatabaseId ||
      ''
    ).trim(),
    workspaceId: (process.env.WORKSPACE_ID || 'adm_equipeie').trim(),
  };
}

async function runReadOnlyBackup() {
  const credCheck = checkCredentialsAvailability();
  if (!credCheck.ok) {
    console.error(`[Backup Firestore] ABORTADO (${credCheck.code}): ${credCheck.detail}`);
    process.exit(1);
  }

  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(
      '[Backup Firestore] ABORTADO (INVALID_DATABASE): Falha ao carregar firebase-applet-config.json:',
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }

  const targetCheck = validateBackupTargetConfig(config);
  if (!targetCheck.ok) {
    console.error(`[Backup Firestore] ABORTADO (${targetCheck.code}): ${targetCheck.detail}`);
    process.exit(1);
  }

  const app = !getApps().length
    ? initializeApp({
        credential: applicationDefault(),
        projectId: config.projectId,
      })
    : getApp();

  const db = getFirestore(app, config.firestoreDatabaseId);

  let manifest;
  try {
    manifest = await exportWorkspaceTreeReadOnly(db as unknown as ReadableFirestore, config);
  } catch (err) {
    const code = classifyBackupErrorCode(err, 'READ_ERROR');
    console.error(
      `[Backup Firestore] FALHA DE LEITURA (${code}):`,
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(process.cwd(), 'backups', `firestore-${timestamp}`);
  if (fs.existsSync(outputDir)) {
    console.error(
      `[Backup Firestore] ABORTADO (DISK_WRITE_ERROR): Diretório de destino já existe: ${outputDir}`
    );
    process.exit(1);
  }

  let written;
  try {
    written = writeAndValidateBackupPackage(manifest, outputDir, config);
  } catch (err) {
    console.error(
      '[Backup Firestore] FALHA DE GRAVAÇÃO/VALIDAÇÃO (DISK_WRITE_ERROR):',
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }

  if (!written.validation.valid || manifest.errors.length > 0) {
    console.error(
      `[Backup Firestore] FALHA NA VALIDAÇÃO (VALIDATION_FAILED / INCOMPLETE_BACKUP):`,
      JSON.stringify(
        {
          status: written.validation.status,
          reportPath: written.reportPath,
          issues: written.validation.issues,
          readErrors: manifest.errors,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log('[Backup Firestore] SUCESSO — Backup recursivo somente-leitura validado:');
  console.log(
    JSON.stringify(
      {
        outputDir,
        completeJsonPath: written.completeJsonPath,
        reportPath: written.reportPath,
        summary: written.validation.summary,
        countsByCollection: written.manifest.countsByCollection,
        excludedCollectionsCount: written.manifest.excludedCollections?.length || 0,
      },
      null,
      2
    )
  );
}

runReadOnlyBackup().catch((err) => {
  const code = classifyBackupErrorCode(err, 'READ_ERROR');
  console.error(
    `[Backup Firestore] Erro inesperado (${code}):`,
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
