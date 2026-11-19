# KAIZEN — RELATÓRIO DA ETAPA 1 DA ESTABILIZAÇÃO
## BACKUP PREVENTIVO REAL, RECURSIVO E VALIDADO DO FIRESTORE

**Data e hora da auditoria:** 2026-11-19T06:38:00-08:00  
**Status da execução do backup:** **ABORTADO** (ausência de credenciais administrativas autorizadas com permissão de leitura neste ambiente)  
**Status da Etapa 1:** **ABORTADA** (Fase 1 — Auditoria concluída; Fase 2 — Verificação de credenciais interrompeu a execução com segurança, conforme Seção 4 do protocolo)

---

## A. Identificação

- **Data e hora da verificação:** 2026-11-19T06:38:00-08:00
- **Projeto Firebase (`firebase-applet-config.json`):** `gen-lang-client-0798002034`
- **Banco Firestore (`firebase-applet-config.json`):** `ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea` *(banco nomeado; não utiliza `(default)`)*
- **Workspace (`src/config/env.ts` e `scripts/backup-firestore.ts`):** `adm_equipeie`
- **Ambiente utilizado:** Container Linux Cloud Run / Google AI Studio Build (`ais-dev-y6g6nw7iqr64ztyqu6myr2`, Node.js v22, disco disponível `188 GB` livres em `/`, `tar` e `gzip` disponíveis, `zip` ausente).
- **Diretório planejado para gravação:** `backups/firestore-AAAA-MM-DD-HH-MM-SS/` (não criado porque a etapa foi interrompida antes da Fase 4; `backups/` já está listado em `.gitignore`).

---

## B. Auditoria técnica

### Arquivos analisados integralmente
1. `scripts/backup-firestore.ts` (182 linhas)
2. `src/services/adminBackupService.ts` (553 linhas)
3. `firebase-applet-config.json` (13 linhas)
4. `package.json` (47 linhas)
5. `.gitignore` (15 linhas), `firebase.json` (19 linhas), `src/config/env.ts` (58 linhas) e `tests/adminBackup.test.ts` (325 linhas)

### Como a leitura recursiva funciona
- `scripts/backup-firestore.ts` lê `projectId` e `firestoreDatabaseId` de `firebase-applet-config.json` (permitindo override por `FIREBASE_PROJECT_ID` e `FIREBASE_DATABASE_ID`) e define `workspaceId = 'adm_equipeie'` (ou `process.env.WORKSPACE_ID`).
- Inicializa `firebase-admin` com `applicationDefault()` e abre explicitamente o banco nomeado via `getFirestore(app, firestoreDatabaseId)`.
- Chama `exportWorkspaceTreeReadOnly()` em `src/services/adminBackupService.ts`:
  1. Descobre coleções raiz via `db.listCollections()` (apenas para registro diagnóstico em `rootCollectionsDiscovered`).
  2. Lê o documento `workspaces/{workspaceId}` via `workspaceRef.get()`.
  3. Descobre dinamicamente as subcoleções diretamente abaixo de `workspaces/{workspaceId}` via `workspaceRef.listCollections()`, garantindo também fallback explícito para `['leads', 'niches', 'importedSheets']`.
  4. Executa `dumpCollectionRecursive(colRef, depth)` em cada subcoleção: lê todos os documentos via `colRef.get()` e, para cada documento retornado, chama `docSnap.ref.listCollections()` para percorrer recursivamente subcoleções aninhadas sem limite fixo de profundidade (`depth + 1`).
- **Garantia somente-leitura:** Não há nenhuma chamada a `.set()`, `.add()`, `.update()`, `.delete()`, `WriteBatch` ou `Transaction` em `scripts/backup-firestore.ts` nem em `src/services/adminBackupService.ts`.

### Como são preservados IDs, caminhos e tipos do Firestore
- Cada nó (`RecursiveBackupDocNode`) registra explicitamente `id: docSnap.id`, `path: docSnap.ref.path`, `data` serializado e `subcollections`.
- `serializeFirestoreValue()` preserva:
  - `Timestamp` -> `{ __firestoreType: 'Timestamp', seconds, nanoseconds, iso }`
  - `Date` -> `{ __firestoreType: 'Date', iso }`
  - `Uint8Array` / `Buffer` -> `{ __firestoreType: 'Bytes', base64 }`
  - `DocumentReference` -> `{ __firestoreType: 'DocumentReference', path }`
  - `GeoPoint` -> `{ __firestoreType: 'GeoPoint', latitude, longitude }`
  - Arrays e mapas aninhados -> percorridos recursivamente com chaves ordenadas alfabeticamente (`Object.keys(obj).sort()`); chaves com valor `undefined` são omitidas.
  - Valores `null` -> preservados intactos.
  - Documentos sem campos -> serializados com `data: {}`, mantendo `id`, `path` e eventuais `subcollections`.
  - Subcoleções vazias -> registradas em `discoveredCollections` com `countsByCollection[path] = 0` e array `[]`.
- Além de `backup_complete.json` (versão `3.1-admin-recursive`), `writeNdjsonRecursive()` grava um arquivo `.ndjson` por coleção/subcoleção encontrada.

### Como funciona a validação
- Após gravar `backup_complete.json` e os `.ndjson`, o script relê `backup_complete.json` do disco e chama `validateRecursiveBackupManifest()`, que verifica:
  - Parse válido do JSON e `version === '3.1-admin-recursive'`.
  - Correspondência exata de `projectId`, `firestoreDatabaseId` e `workspaceId`.
  - Recontagem recursiva de todos os documentos (`recountRecursiveNodes`) confrontada com `totalDocuments` e com cada entrada de `countsByCollection`.
  - Recálculo do hash `SHA-256` (`computeManifestSha256`) confrontado com `checksumSha256`.
  - Ausência total de erros em `manifest.errors` (`errors.length === 0`).
- Grava `validation_report.json` e encerra com código de saída diferente de zero se `validation.valid === false`.

### Limitações encontradas na auditoria
1. **Escopo restrito ao documento `workspaces/{workspaceId}`:** embora `db.listCollections()` registre os nomes das coleções raiz em `rootCollectionsDiscovered`, o script **não exporta documentos de outras coleções fora de `workspaces/adm_equipeie`** (nem outros eventuais workspaces ou coleções raiz como `test`).
2. **Documentos "fantasma" (sem campos próprios):** `dumpCollectionRecursive` usa `colRef.get()`, que no Firestore retorna apenas documentos materializados. Se existir algum documento sem campos próprios criado apenas como contêiner de uma subcoleção, `colRef.get()` não o lista e suas subcoleções não seriam descobertas (para isso seria necessário `colRef.listDocuments()` no Admin SDK).
3. **Fallback fixo limitado a 3 coleções:** se `workspaceRef.listCollections()` falhar por permissão parcial, o fallback da linha 333 de `adminBackupService.ts` adiciona apenas `leads`, `niches` e `importedSheets`, não cobrindo as demais 26 subcoleções das Etapas 2–7 (embora o erro fique registrado em `manifest.errors` e faça a validação falhar de forma segura).
4. **Heurística de `GeoPoint`:** objetos comuns de negócio que tenham `latitude: number`, `longitude: number` e até 3 chaves são convertidos em `{ __firestoreType: 'GeoPoint', latitude, longitude }`, podendo descartar uma 3ª propriedade nesse caso raro.
5. **Validação dos `.ndjson` e segunda leitura independente:** `validateRecursiveBackupManifest()` valida integralmente `backup_complete.json`, mas **não relê nem verifica os arquivos `.ndjson`** em disco, nem compara o resultado com uma segunda leitura independente do Firestore; além disso, `collectionPath.replace(/[^a-zA-Z0-9_-]/g, '__')` pode colidir nomes caso IDs contenham `/` ou `.` equivalentes.
6. **Leitura completa em memória:** `colRef.get()` e `JSON.stringify(manifest, null, 2)` operam em memória (adequado ao porte atual da agência, mas exigiria paginação/streaming em bases muito grandes).
7. **Carregamento de credenciais em `scripts/backup-firestore.ts`:** o script não importa `dotenv/config` automaticamente (depende de variáveis já exportadas no shell ou do arquivo ADC padrão do `gcloud`) e exige `GOOGLE_APPLICATION_CREDENTIALS` ou `~/.config/gcloud/application_default_credentials.json`.

---

## C. Credenciais

- **Verificação realizada neste ambiente (sem exibição de segredos):**
  - `GOOGLE_APPLICATION_CREDENTIALS`: **não definida** (`False`), tanto no shell quanto no `.env`.
  - Arquivo `~/.config/gcloud/application_default_credentials.json`: **inexistente** (`False`).
  - `CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE` e `FIREBASE_TOKEN`: **não definidos** (`False`).
  - Metadados do container Cloud Run / AI Studio: conta de serviço de runtime padrão do sandbox (`ais-sandbox@ais-us-east1-8692ca3cc73e4493a.iam.gserviceaccount.com`), compartilhada pelo ambiente de execução do AI Studio e **sem permissão IAM concedida** para acesso administrativo ao projeto `gen-lang-client-0798002034`.
- **Conformidade com a Fase 2:** Como não há credencial administrativa autorizada para leitura disponível neste ambiente, **o processo foi interrompido antes da Fase 4**. Nenhuma Service Account foi criada, nenhuma permissão IAM foi alterada e nenhuma chave privada foi solicitada nesta conversa.

### Qual credencial e permissão são necessárias (fora do Git)
- **Permissão mínima necessária (menor privilégio / somente-leitura):**
  - Papel IAM recomendado: **`roles/datastore.viewer`** (*Visualizador do Cloud Datastore*) no projeto `gen-lang-client-0798002034` (permite ler documentos e listar coleções do Firestore sem permitir escrita, alteração ou exclusão).
  - Observação importante: caso `gen-lang-client-0798002034` seja um projeto gerenciado pelo Google AI Studio (*Starter Tier* sem conta de faturamento vinculada), o acesso via Firebase Admin SDK / IAM administrativo pode não estar habilitado diretamente até eventual upgrade do projeto para projeto padrão do Google Cloud controlado pelo proprietário — ou pode ser necessário verificar no Console do Google Cloud / Firebase se você é o proprietário com acesso ao IAM e ao `gcloud`.

### Instruções seguras para executar o backup em ambiente local do proprietário (fora do Git)
1. **Opção recomendada (Application Default Credentials via `gcloud`, sem arquivo JSON de chave privada):**
   - Em uma máquina pessoal/confiável fora do GitHub, autentique sua conta Google proprietária com:
     ```bash
     gcloud config set project gen-lang-client-0798002034
     gcloud auth application-default login
     ```
   - Em seguida, execute na raiz do projeto sincronizado:
     ```bash
     npm run backup:firestore
     ```
2. **Opção alternativa (Service Account dedicada somente-leitura, caso já possua IAM no projeto):**
   - No Google Cloud Console (IAM), utilize/vincule uma conta dedicada apenas com **`roles/datastore.viewer`**.
   - Se utilizar chave JSON local, mantenha o arquivo **estritamente fora do repositório** (ou nomeado como `service-account-*.json`, já bloqueado no `.gitignore`, preferencialmente em pasta privada como `~/.secrets/`).
   - Aponte a variável apenas na sessão do terminal e execute:
     ```bash
     export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/kaizen-firestore-readonly.json"
     npm run backup:firestore
     ```
3. **Verificação pós-execução local:** confirme que `backups/` e `service-account*.json` não aparecem em `git status` antes de qualquer commit futuro.

---

## D. Resultado

- **Status:** **ABORTADO**
- **Motivo:** Ausência de `GOOGLE_APPLICATION_CREDENTIALS` ou Application Default Credentials (`gcloud`) autorizadas para leitura no container do Google AI Studio.
- **Quantidade de coleções lidas:** `0` (execução não iniciada por falta de credencial)
- **Quantidade de subcoleções lidas:** `0`
- **Quantidade total de documentos exportados:** `0`
- **Quantidade de arquivos de backup gerados:** `0`
- **Localização do backup:** Nenhum diretório `backups/firestore-*` foi criado.
- **Tamanho total dos arquivos:** `0 bytes` (apenas este relatório foi gravado em `docs/`).

---

## E. Integridade

- **Resultado da validação:** **Não executada** (não houve leitura do Firestore nem gravação de `backup_complete.json`, `.ndjson` ou `validation_report.json`).
- **Resultado dos checksums:** Não aplicável (nenhum manifesto gerado).
- **Divergências encontradas:** Não aplicável até a execução com credenciais válidas.
- **Arquivos ausentes:** `backup_complete.json`, arquivos `.ndjson` por coleção/subcoleção e `validation_report.json` não foram gerados neste ambiente.
- **Limitações de validação identificadas na auditoria de código:**
  - Quando o backup for executado futuramente, além da aprovação de `validation_report.json`, recomenda-se conferir se `rootCollectionsDiscovered` contém apenas `workspaces` (ou se há outras coleções raiz fora do escopo do script), se nenhum erro apareceu no array `errors` e validar manualmente a contagem de linhas dos arquivos `.ndjson` gerados.

---

## F. Segurança

- **Nenhuma escrita foi realizada no Firestore:** Confirmado.
- **Nenhuma regra (`firestore.rules` ou `storage.rules`) foi publicada ou alterada:** Confirmado.
- **Nenhum deploy (Firebase ou Vercel) foi realizado:** Confirmado.
- **Nenhum dado foi excluído, migrado ou alterado:** Confirmado.
- **Nenhum código-fonte da aplicação ou do script de backup foi modificado:** Confirmado.
- **Nenhuma credencial, token ou dado real da agência foi gravado no projeto ou incluído neste relatório:** Confirmado.

---

## G. Pendências

1. **Executar o backup real em ambiente autorizado** (máquina local do proprietário com `gcloud auth application-default login` ou Service Account dedicada `roles/datastore.viewer` fora do Git), garantindo acesso ao projeto `gen-lang-client-0798002034` e banco `ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`.
2. **Validar e compactar o pacote após execução real** (ex.: `tar -czf` em ambiente Linux/macOS ou `.zip` localmente) e armazená-lo em local seguro externo ao repositório (ex.: disco criptografado ou nuvem privada do proprietário).
3. **Confirmar se o projeto Firebase permite acesso Admin SDK/IAM** (caso seja um projeto *Starter Tier* hospedado pelo AI Studio sem faturamento/IAM liberado, o download/backup oficial dos dados reais exigirá exportação pelo console/autenticação do usuário autorizado ou upgrade prévio do projeto no Google Cloud Console, sem perder o acesso atual pela interface web já publicada).
4. **Somente após possuir e validar esse backup real em mãos**, prosseguir para a próxima etapa do plano de estabilização (reconciliação GitHub/Vercel e preparação controlada do deploy de regras).

---

## Checklist dos Critérios da Etapa 1 (Seção 10)

- [x] Projeto, banco e workspace confirmados nos arquivos de configuração (`gen-lang-client-0798002034`, `ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`, `adm_equipeie`).
- [ ] Credencial administrativa com acesso adequado de leitura disponível neste ambiente (**AUSENTE — etapa interrompida**).
- [ ] Leitura recursiva contemplou todas as coleções e subcoleções.
- [ ] Manifesto completo (`backup_complete.json`) gravado.
- [ ] Arquivos `.ndjson` gerados.
- [ ] Validação de integridade (`validation_report.json`) aprovada.
- [ ] Checksums verificados.
- [ ] Inventário de documentos registrado.
- [ ] Backup disponível para download/armazenamento seguro.
- [x] Nenhum dado do Firestore foi alterado.
- [x] Nenhuma regra ou aplicação foi publicada.
- [x] Relatório técnico criado em `docs/RELATORIO_ETAPA_1_ESTABILIZACAO_BACKUP.md`.
