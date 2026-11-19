# KAIZEN — RELATÓRIO DA ETAPA 1.1
## APERFEIÇOAMENTO E VALIDAÇÃO DO MECANISMO DE BACKUP

**Data:** 2026-11-19  
**Repositório oficial:** `https://github.com/iangabrieltv/crmprospectsite`  
**Status da Etapa 1.1:** **CONCLUÍDA EM DESENVOLVIMENTO (Mocks e Testes Locais)**  
**Aviso crítico:** **Nenhum backup real foi executado nesta etapa** (ambiente sem credenciais administrativas de leitura e execução real explicitamente proibida nesta etapa).

---

## 1. Problemas encontrados no mecanismo anterior

Durante a auditoria da Etapa 1 da Estabilização (`docs/RELATORIO_ETAPA_1_ESTABILIZACAO_BACKUP.md`), o motor anterior (`v3.1-admin-recursive`) apresentava as seguintes limitações:

1. **Cegueira para documentos "fantasma" (sem campos próprios):** `dumpCollectionRecursive()` dependia exclusivamente de `colRef.get()`. No Firestore, documentos que existem apenas como contêineres pais de subcoleções (sem campos próprios) não retornam em `QuerySnapshot` (`get()`), ocultando suas subcoleções.
2. **Inventário insuficiente de coleções raiz e escopo:** `rootCollectionsDiscovered` listava apenas strings com nomes, sem distinguir coleções internas do Firebase (`__.*__`), coleções externas fora de `workspaces/adm_equipeie` ou outros eventuais workspaces.
3. **Heurística frágil para `GeoPoint` em `serializeFirestoreValue()`:** qualquer objeto de negócio contendo `latitude: number`, `longitude: number` e até 3 chaves era convertido indevidamente em `{ __firestoreType: 'GeoPoint' }`, podendo descartar uma terceira propriedade.
4. **Ausência de validação dos arquivos `.ndjson` gravados em disco:** o script validava apenas `backup_complete.json`, sem conferir existência, legibilidade, sintaxe JSON por linha, coerência de caminho/coleção, contagem ou SHA-256 dos arquivos `.ndjson`.
5. **Risco de colisão nos nomes de arquivos `.ndjson`:** a normalização simples `replace(/[^a-zA-Z0-9_-]/g, '__')` podia gerar o mesmo nome para caminhos distintos (ex.: `a/b` vs `a_b` vs `a.b`) e sobrescrever dados.
6. **Ausência de trava explícita contra ciclos e falha parcial silenciosa em fallback:** não havia rastreamento de caminhos já visitados nem contabilização explícita de documentos sem campos próprios ou coleções vazias.

---

## 2. Arquivos alterados

- `src/services/adminBackupService.ts` — evolução do motor de exportação e validação (`3.2-admin-recursive`, mantendo compatibilidade retroativa com `3.1-admin-recursive`).
- `scripts/backup-firestore.ts` — atualização do runner CLI somente-leitura com validação de destino, gravação segura sem sobrescrita e validação completa (manifesto + NDJSON).
- `tests/adminBackup.test.ts` — ampliação para 6 blocos abrangentes de testes com mocks/fixtures fictícios.
- `package.json` — adição do script utilitário `"test:backup": "tsx --test tests/adminBackup.test.ts"`.
- `docs/RELATORIO_ETAPA_1_1_BACKUP_ENGINE.md` — este relatório técnico.
- `docs/KAIZEN_ROADMAP.md` — registro exclusivo da conclusão da Etapa 1.1 em desenvolvimento.

---

## 3. Correções realizadas

- **Descoberta combinada `colRef.get()` + `colRef.listDocuments()`** com detecção e marcação de `exists` e `hasOwnFields` para cada documento.
- **Inventário separado de coleções raiz** (`rootCollectionsInventory` e `excludedCollections`) distinguindo coleções internas (`__.*__`), coleções externas ao workspace e outros eventuais workspaces (inventariados sem exportação de conteúdo).
- **Prevenção de ciclos e repetições** via `visitedCollectionPaths` e `visitedDocPaths`.
- **Serialização baseada nos tipos oficiais de `firebase-admin/firestore`** (`Timestamp`, `GeoPoint`, `DocumentReference`), preservando objetos comuns com `latitude`/`longitude` intactos e detectando referências circulares na serialização.
- **Nomenclatura determinística sem colisões** para `.ndjson` (`buildDeterministicNdjsonFilename()` com slug legível + hash SHA-256 de 12 hex do caminho exato) + bloqueio contra sobrescrita em disco.
- **Validação integral de pacote em disco** (`validateBackupPackageOnDisk()` e `validateNdjsonFileContent()`), falhando com status `FAILED` e código de saída `1` se houver qualquer divergência no manifesto, nos `.ndjson`, nos checksums ou erros de leitura.
- **Classificação explícita de erros** (`MISSING_CREDENTIALS`, `PERMISSION_DENIED`, `INVALID_DATABASE`, `INVALID_WORKSPACE`, `READ_ERROR`, `SERIALIZATION_ERROR`, `DISK_WRITE_ERROR`, `VALIDATION_FAILED`, `INCOMPLETE_BACKUP`).

---

## 4. Estratégia de descoberta recursiva

1. Validação prévia do alvo (`validateBackupTargetConfig`): exige `projectId`, `firestoreDatabaseId` diferente de `(default)` e `workspaceId` válido.
2. Mapeamento das coleções raiz (`db.listCollections()`):
   - Coleções `__.*__` são classificadas como internas do Firebase e excluídas do escopo.
   - Coleções raiz externas a `workspaces` têm nome, caminho e estimativa de quantidade (`listDocuments().length` ou `get().docs.length`) registradas em `excludedCollections`, sem dump de documentos.
   - Dentro de `workspaces`, documentos diferentes de `adm_equipeie` são registrados em `excludedCollections` (`other_workspace`) sem leitura de conteúdo.
3. Leitura do documento `workspaces/adm_equipeie` e listagem de todas as suas subcoleções (`workspaceRef.listCollections()`, com fallback mínimo apenas se a listagem falhar, preservando o erro no manifesto).
4. Para cada coleção/subcoleção (`dumpCollectionRecursive`):
   - Lê documentos materializados via `colRef.get()`.
   - Complementa com todas as referências via `colRef.listDocuments()` (quando disponível) para encontrar documentos sem campos próprios / *phantom containers*.
   - Para cada documento não visitado ainda (`visitedDocPaths`), obtém `exists`/`hasOwnFields`, serializa campos próprios (se houver) e chama `docRef.listCollections()` recursivamente sem limite artificial de profundidade.
   - Registra coleções vazias em `emptyCollections` e documentos sem campos próprios em `documentsWithoutFieldsCount` / `documentsWithoutFieldsPaths`.

---

## 5. Estratégia de serialização

- `Timestamp`: detecta instância `Timestamp` de `firebase-admin/firestore` (ou objeto compatível com `seconds`/`nanoseconds`/`toDate()`) -> `{ __firestoreType: 'Timestamp', seconds, nanoseconds, iso }`.
- `Date`: `{ __firestoreType: 'Date', iso }`.
- `Uint8Array` / `Buffer`: `{ __firestoreType: 'Bytes', base64 }`.
- `GeoPoint`: detecta exclusivamente `value instanceof GeoPoint` (ou protótipo `GeoPoint` com `isEqual()`) -> `{ __firestoreType: 'GeoPoint', latitude, longitude }`. Mapas comuns `{ latitude, longitude, ... }` permanecem objetos comuns preservando 100% de suas chaves.
- `DocumentReference`: `value instanceof DocumentReference` (ou mock com `path`, `id`, `firestore`) -> `{ __firestoreType: 'DocumentReference', path }`.
- `Arrays` e `Mapas`: serializados recursivamente com chaves ordenadas alfabeticamente (`Object.keys(obj).sort()`) para garantir SHA-256 determinístico, preservando `null` e omitindo `undefined`.
- Proteção contra ciclos em objetos/arrays durante serialização com erro estruturado `SERIALIZATION_ERROR`.

---

## 6. Estratégia de validação

A função `writeAndValidateBackupPackage()` grava todos os `.ndjson` (sem colisão via `${slug}__${sha256_12}.ndjson`), calcula tamanho/contagem/SHA-256 de cada arquivo, incorpora `ndjsonFiles` e `generatedFiles` ao manifesto `3.2-admin-recursive`, assina `checksumSha256`, grava `backup_complete.json` e executa `validateBackupPackageOnDisk()`:

1. Relê e valida o manifesto `backup_complete.json` (`version` `3.1` ou `3.2`, `projectId`, `firestoreDatabaseId`, `workspaceId`, recontagem recursiva total, por coleção, por subcoleção, documentos sem campos próprios, ausência de caminhos duplicados, checksum SHA-256 e `errors.length === 0`).
2. Para cada entrada de `ndjsonFiles`, relê o `.ndjson` no disco e valida:
   - Existência e legibilidade do arquivo.
   - Inexistência de colisão de nomes no pacote.
   - Correspondência exata do SHA-256 do arquivo em disco.
   - Parse JSON válido em todas as linhas.
   - Presença obrigatória de `id`, `path` e `data` (objeto) em cada linha.
   - Correspondência exata `path === "${collectionPath}/${id}"`.
   - Contagem de documentos e de documentos sem campos próprios igual ao manifesto.
3. Grava `validation_report.json` com `status: 'SUCCESS' | 'FAILED'` e resumo detalhado. Qualquer falha faz `scripts/backup-firestore.ts` encerrar com código `1`.

---

## 7. Novos testes (`tests/adminBackup.test.ts`)

Todos executados exclusivamente com mocks/fixtures fictícios em memória e diretórios temporários (`os.tmpdir()`), com trava explícita que lança erro em qualquer tentativa de `set`, `add`, `update`, `delete`, `batch` ou `runTransaction`:

1. Descoberta recursiva com coleções raiz, separação de coleções internas `__.*__`, inventário de coleções externas e outro workspace fora de escopo, coleções vazias, documentos com campos, documentos sem campos próprios (`exists: true` com `{}` e *phantom container* `exists: false` via `listDocuments()`), múltiplos níveis de subcoleções e `0` escritas.
2. Serialização determinística de `Timestamp` real, `GeoPoint` real, objetos comuns com `latitude`/`longitude` (com 2 e 3 propriedades, sem conversão indevida para `GeoPoint`), `DocumentReference`, `Bytes`/`Buffer`, `Date`, `null`, arrays e mapas aninhados.
3. Prevenção de colisão de nomes NDJSON para `a/b`, `a_b`, `a.b` e `a-b`.
4. Gravação em disco e validação completa do pacote (manifesto + NDJSON + recusa de sobrescrita) + detecção de falha em: workspace incorreto, NDJSON incompleto, NDJSON com JSON inválido, NDJSON com caminho inconsistente, NDJSON ausente no disco, checksum adulterado e contagem divergente.
5. Tratamento explícito de credenciais ausentes, banco `(default)` proibido, workspace inválido, permissão negada (`PERMISSION_DENIED`) e falha de leitura (`READ_ERROR`).
6. Compatibilidade retroativa de `validateRecursiveBackupManifest()` com manifestos `3.1-admin-recursive`.

---

## 8. Resultados dos testes e verificações

Executados após as últimas alterações:

- `npm test` -> **101 / 101 aprovados** (`0` falhas, `0` ignorados/skipped)
- `npm run test:backup` -> **6 / 6 aprovados**
- `npm run lint` (`tsc --noEmit`) -> **0 erros**
- `npm run build` (`vite build`) -> **Concluído com sucesso**
- `npm run backup:firestore` -> **Não executado** (proibido nesta etapa e ambiente sem credenciais de leitura)

---

## 9. Limitações restantes

1. **Credenciais no ambiente AI Studio:** o container continua sem `GOOGLE_APPLICATION_CREDENTIALS` e sem `gcloud` ADC autorizado; o backup real deve ser executado fora deste sandbox ou após autorização adequada em ambiente seguro.
2. **Leitura de coleções muito grandes em memória:** `colRef.get()` + `JSON.stringify` ainda carregam cada coleção na memória RAM (adequado ao porte atual de agência privada, mas requeriria paginação por cursor se uma coleção crescer para dezenas de milhares de documentos).
3. **Segunda leitura independente:** o script realiza leitura única seguida de validação integral em disco (`backup_complete.json` + `.ndjson`); não executa uma segunda rodada completa contra o Firestore em seguida (evitando dobrar cota de leituras).
4. **Restauração:** não existe nem foi implementado fluxo de restauração automática (fora de escopo por segurança).

---

## 10. Instruções futuras para execução local autenticada (fora do Git)

Quando o proprietário estiver em uma máquina local confiável sincronizada com o repositório e com acesso de leitura ao projeto `gen-lang-client-0798002034`:

1. Configure autenticação somente-leitura fora do repositório (preferencialmente `gcloud auth application-default login` na conta proprietária após `gcloud config set project gen-lang-client-0798002034`, ou variável `GOOGLE_APPLICATION_CREDENTIALS` apontando para uma Service Account dedicada com papel mínimo **`roles/datastore.viewer`** salva fora do Git).
2. Execute:
   ```bash
   npm run backup:firestore
   ```
3. Confirme no terminal que a saída exibe `SUCESSO` e que `validation_report.json` dentro de `backups/firestore-.../` contém `"status": "SUCCESS"`, `"valid": true` e `"errorsCount": 0`.
4. Compacte e armazene a pasta `backups/firestore-.../` em local privado seguro fora do GitHub (`backups/` permanece bloqueada em `.gitignore`).
