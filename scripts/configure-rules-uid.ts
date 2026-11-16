/**
 * Utilitário local para validar ou aplicar o UID real do administrador único em `firestore.rules`.
 * Nunca inventa UIDs e nunca publica regras automaticamente no Firebase.
 *
 * Uso (apenas verificação):
 *   npm run rules:check
 *
 * Uso (aplicar localmente antes de `firebase deploy --only firestore:rules`):
 *   AUTHORIZED_ADMIN_UID=<seu_uid_real> npx tsx scripts/configure-rules-uid.ts --write
 */
import fs from 'fs';
import path from 'path';

const PLACEHOLDER = 'REPLACE_WITH_YOUR_FIREBASE_UID';

function isValidUid(uid: string): boolean {
  const trimmed = uid.trim();
  if (!trimmed || trimmed === PLACEHOLDER) return false;
  return trimmed.length >= 6 && trimmed.length <= 128 && /^[a-zA-Z0-9:_\-]+$/.test(trimmed);
}

function main() {
  const shouldWrite = process.argv.includes('--write');
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const currentContent = fs.readFileSync(rulesPath, 'utf-8');

  const hasPlaceholder = currentContent.includes(PLACEHOLDER);

  if (!shouldWrite) {
    if (hasPlaceholder) {
      console.error(
        `[firestore.rules] PENDENTE: O placeholder '${PLACEHOLDER}' ainda está presente. ` +
          `Enquanto não for substituído pelo seu UID real, as regras permanecem em bloqueio total (fail-closed).`
      );
      process.exit(1);
    }
    console.log('[firestore.rules] OK: UID configurado nas regras (sem placeholder).');
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
      `Aviso: '${PLACEHOLDER}' não foi encontrado em firestore.rules. Verifique o arquivo manualmente antes de prosseguir.`
    );
    process.exit(1);
  }

  const updated = currentContent.replace(PLACEHOLDER, envUid);
  fs.writeFileSync(rulesPath, updated, 'utf-8');
  console.log(
    '[firestore.rules] UID aplicado localmente com sucesso. Execute `firebase emulators:exec --only auth,firestore "npm run test:rules"` antes de publicar.'
  );
}

main();
