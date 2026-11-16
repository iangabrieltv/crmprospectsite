/**
 * Utilitário local para validar ou aplicar o UID real do administrador único em `firestore.rules`.
 * Nunca inventa UIDs e nunca publica regras automaticamente no Firebase.
 *
 * Uso (apenas verificação):
 *   npm run rules:check
 *
 * Uso (aplicar localmente antes de `firebase deploy --only firestore:rules`):
 *   AUTHORIZED_ADMIN_UID=<seu_uid_real> npm run rules:configure
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export const PLACEHOLDER = 'REPLACE_WITH_YOUR_FIREBASE_UID';
const RETURN_PLACEHOLDER_REGEX = /return\s+['"]REPLACE_WITH_YOUR_FIREBASE_UID['"]\s*;/;

export function isValidUid(uid: string): boolean {
  const trimmed = uid.trim();
  if (!trimmed || trimmed === PLACEHOLDER) return false;
  return trimmed.length >= 6 && trimmed.length <= 128 && /^[a-zA-Z0-9:_\-]+$/.test(trimmed);
}

export function hasPendingUidPlaceholder(rulesContent: string): boolean {
  return RETURN_PLACEHOLDER_REGEX.test(rulesContent);
}

export function applyAdminUidToRulesContent(rulesContent: string, uid: string): string {
  if (!isValidUid(uid)) {
    throw new Error('UID inválido para configuração de firestore.rules.');
  }
  if (!RETURN_PLACEHOLDER_REGEX.test(rulesContent)) {
    throw new Error(
      `Expressão "return '${PLACEHOLDER}';" não encontrada em firestore.rules.`
    );
  }
  return rulesContent.replace(RETURN_PLACEHOLDER_REGEX, `return '${uid.trim()}';`);
}

function main() {
  const shouldWrite = process.argv.includes('--write');
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const currentContent = fs.readFileSync(rulesPath, 'utf-8');

  const hasPlaceholder = hasPendingUidPlaceholder(currentContent);

  if (!shouldWrite) {
    if (hasPlaceholder) {
      console.error(
        `[firestore.rules] PENDENTE: O placeholder '${PLACEHOLDER}' ainda está presente em authorizedAdminUid(). ` +
          `Enquanto não for substituído pelo seu UID real, as regras permanecem em bloqueio total (fail-closed).`
      );
      process.exit(1);
    }
    console.log('[firestore.rules] OK: UID configurado nas regras (sem placeholder ativo).');
    return;
  }

  const envUid = (process.env.AUTHORIZED_ADMIN_UID || '').trim();
  if (!isValidUid(envUid)) {
    console.error(
      'Erro: defina AUTHORIZED_ADMIN_UID com o UID real do Firebase Authentication antes de executar --write.'
    );
    process.exit(1);
  }

  if (!hasPlaceholder) {
    console.error(
      `Aviso: "return '${PLACEHOLDER}';" não foi encontrado em firestore.rules. Verifique o arquivo manualmente antes de prosseguir.`
    );
    process.exit(1);
  }

  const updated = applyAdminUidToRulesContent(currentContent, envUid);
  fs.writeFileSync(rulesPath, updated, 'utf-8');
  console.log(
    '[firestore.rules] UID aplicado localmente com sucesso em authorizedAdminUid(). Execute `firebase emulators:exec --project kaizen-rules-test --only auth,firestore "npm run test:rules"` antes de publicar.'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
