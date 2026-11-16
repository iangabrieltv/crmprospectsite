# KAIZEN — RELATÓRIO DA ETAPA 0.4
## Validação Final de Segurança, Firebase Emulator Real, Schema, Backup e Sincronização

**Data de conclusão da verificação técnica:** 16/11/2026  
**Projeto Firebase:** `gen-lang-client-0798002034`  
**Banco Firestore nomeado (produção):** `ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`  
**Workspace preservado:** `adm_equipeie`  
**Repositório oficial:** `https://github.com/iangabrieltv/crmprospectsite`  
**Branch alvo:** `security/etapa-0-3-final-validation` (branch `main` não modificada)  
**Status Geral:** **PARCIALMENTE CONCLUÍDA** *(código, regras, build e todos os testes locais e em Firebase Emulator real 100% aprovados; sincronização remota no GitHub, substituição do UID real de produção e backup real na nuvem dependem exclusivamente de credenciais externas do proprietário Ian)*

---

## Seção A — Correção do Health Check dos Emulators (Fase 1)

### Causa raiz identificada
- A porta `8080` do ambiente de execução já está ocupada por um servidor `nginx/1.22.1` que responde `HTTP 200` em `text/html` (página HTML/fallback SPA), gerando falsos positivos quando um health check ingênuo verifica apenas se a porta TCP aceita conexões ou retorna status HTTP `200`.
- Além disso, na versão do Cloud Firestore Emulator utilizada (`standard edition`, Firebase CLI `15.34.1`), o endpoint `/emulator/v1/projects/:project/databases` retorna `HTTP 404` e `GET /` retorna texto puro `Ok`, enquanto o endpoint JSON oficial estável do Firestore Emulator é:
  - `GET /emulator/v1/projects/:projectId:ruleCoverage` -> `HTTP 200 application/json` contendo `{ "rules": { "files": [...] } }`.
- O Auth Emulator responde oficialmente em:
  - `GET /` -> `HTTP 200 application/json` contendo `{ "authEmulator": { "ready": true, ... } }`.

### Correções aplicadas
1. **`/firebase.json` e `/src/utils/firebase.ts`:** porta do Firestore Emulator alterada de `8080` para `8088`, eliminando o conflito com o `nginx` na porta `8080`.
2. **`/src/services/emulatorHealthCheck.ts`:** implementadas as funções estritas `checkAuthEmulatorHealth`, `checkFirestoreEmulatorHealth`, `verifyEmulatorsHealth` e `assertEmulatorsRunning`, exigindo:
   - Status HTTP `2xx`;
   - Cabeçalho `Content-Type` contendo `application/json`;
   - Payload JSON válido parseado em objeto;
   - Campos específicos do Firebase Emulator (`authEmulator.ready === true` no Auth; `rules` / `report` / `databases` no Firestore).
3. **`/firestore.rules.test.ts`:** utiliza `assertEmulatorsRunning()` na inicialização da suíte, abortando com saída diferente de zero (`exit 1`) caso os emuladores estejam desligados ou falsos. Zero `t.skip()`.

### Resultados dos 8 cenários unitários (`tests/emulatorHealthCheck.test.ts`)
| # | Cenário testado | Resultado |
|---|---|---|
| 1 | Ambos emuladores ativos com JSON oficial | **PASS** |
| 2 | Apenas Firestore ativo (Auth indisponível) | **PASS** (rejeita explicitamente) |
| 3 | Apenas Auth ativo (Firestore indisponível) | **PASS** (rejeita explicitamente) |
| 4 | Ambos emuladores indisponíveis | **PASS** (rejeita explicitamente) |
| 5 | Porta ocupada por servidor HTTP JSON comum (não-emulador) | **PASS** (rejeitado) |
| 6 | Porta ocupada retornando `HTTP 200 text/html` (ex: `nginx` / SPA na porta 8080) | **PASS** (rejeitado) |
| 7 | `HTTP 200` + `application/json` com corpo malformado / truncado | **PASS** (rejeitado) |
| 8 | Erro HTTP `404`/`500` mesmo com `Content-Type: application/json` | **PASS** (rejeitado) |

---

## Seção B — Sincronização Oficial do Repositório e Branch (Fase 2)

### Diagnóstico do ambiente Git / GitHub local
- `/app/applet` **não possui diretório `.git`** (`NO_GIT_REPO`).
- CLI `gh` não está instalado, não há chaves SSH em `~/.ssh` e `GIT_TERMINAL_PROMPT=0 git ls-remote https://github.com/iangabrieltv/crmprospectsite.git` falhou com `fatal: could not read Username for 'https://github.com': No such device or address`.
- Nenhum token ou credencial GitHub foi inventado, solicitado via chat ou gravado em arquivo. Nenhuma alteração foi feita na branch `main`.

### Passos exatos para o proprietário (Ian) sincronizar na branch `security/etapa-0-3-final-validation`
Execute em sua máquina local com acesso autenticado ao GitHub (`iangabrieltv/crmprospectsite`):

```bash
# 1. Clonar o repositório oficial e sincronizar a base
git clone https://github.com/iangabrieltv/crmprospectsite.git
cd crmprospectsite
git fetch origin

# 2. Criar ou atualizar a branch de trabalho (NUNCA trabalhar direto na main)
git checkout -B security/etapa-0-3-final-validation origin/main

# 3. Copiar os arquivos gerados/atualizados do workspace AI Studio para este clone local
# (ou aplicar um git bundle / archive exportado do projeto)

# 4. Conferir exatamente o que será commitado e validar que não há segredos ou .env
git status
git diff --stat

# 5. Validar localmente antes do push
npm test
npm run lint
npm run build
npx firebase emulators:exec --project kaizen-rules-test --only auth,firestore "npm run test:rules"

# 6. Commitar e enviar somente para security/etapa-0-3-final-validation
git add -A
git commit -m "chore(security): etapa 0.4 - emulator real suite, schema audit e backup lossless"
git push -u origin security/etapa-0-3-final-validation

# Alternativa offline via git bundle (caso transfira via pacote único):
# No diretório já commitado:
git bundle create kaizen-etapa-0-4.bundle HEAD security/etapa-0-3-final-validation
# Em outra máquina com GitHub auth:
# git fetch /caminho/kaizen-etapa-0-4.bundle security/etapa-0-3-final-validation:security/etapa-0-3-final-validation
# git push -u origin security/etapa-0-3-final-validation
```

---

## Seção C — Execução Real dos 10 Cenários de Segurança no Firebase Emulator (Fase 3)

### Ambiente real executado
- **Runtime Java instalado no container:** OpenJDK `21.0.13` (`openjdk-21-jre-headless`).
- **Firebase CLI:** `firebase-tools@15.34.1`.
- **Comando exato executado:**  
  `npx firebase emulators:exec --project kaizen-rules-test --only auth,firestore "npm run test:rules"`
- **Banco Firestore alvo nos testes:** `ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea` (emulado isoladamente no projeto `kaizen-rules-test`, sem jamais tocar o projeto de produção `gen-lang-client-0798002034`).
- **Correção crítica descoberta durante o teste real:** No Firestore Emulator, o reload de regras via `PUT /emulator/v1/projects/:project:securityRules` sem especificar o parâmetro `database` atualizava apenas `(default)` e mantinha o banco nomeado com as regras iniciais do disco. `loadRulesFromFile` em `/firestore.rules.test.ts` foi atualizado para enviar `PUT /emulator/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}:securityRules` com `{ database: "projects/.../databases/...", rules: ... }`.

### Matriz dos 10 cenários obrigatórios no Emulator Real (`14/14` pass, `0` fail, `0` skipped)
| Cenário | Descrição | Resultado | Evidência técnica |
|---|---|---|---|
| **1 & 2** | Admin único autorizado (`request.auth.uid == authorizedAdminUid()`) cria, lê, lista, atualiza e exclui `leads`, `niches`, `importedSheets`; `get` na raiz do workspace permitido e listagem/escrita na raiz bloqueadas | **PASS** | `PATCH/GET/DELETE` `200`, `get` raiz `200`/`404` (intruder `403`), `PATCH` raiz `403` |
| **3** | Outro UID autenticado (`intruderUser`) negado em leitura, listagem, escrita e exclusão | **PASS** | Todos `HTTP 403 PERMISSION_DENIED` |
| **4** | Usuário anônimo (sem `Authorization`) negado em leitura e escrita | **PASS** | Todos `HTTP 403 PERMISSION_DENIED` |
| **5** | Outro workspace (inclusive legado `kaizenvisual123` e `outro_workspace`) negado mesmo para admin | **PASS** | Todos `HTTP 403 PERMISSION_DENIED` |
| **6** | Placeholder `REPLACE_WITH_YOUR_FIREBASE_UID` (fail-closed) bloqueia inclusive admin autenticado | **PASS** | `PATCH` e `GET` retornam `HTTP 403` |
| **7** | Schema inválido, campos extras não permitidos (`isAdmin: true`), tipo errado (`totalLeads` string) e `companyName` vazio são negados | **PASS** | Todos `HTTP 403 PERMISSION_DENIED` |
| **8** | IDs inválidos (`lead com espaco`, `lead.com.ponto`, `lead$invalido`, `129` chars) negados em leitura e escrita | **PASS** | Todos `HTTP 403 PERMISSION_DENIED` |
| **9** | Coleções e caminhos não autorizados (`secrets`, subcoleção `leads/*/privateNotes`, coleção raiz `users/*`) negados | **PASS** | Todos `HTTP 403 PERMISSION_DENIED` |
| **10** | Token malformado (`not-a-valid-jwt`), esquema `Basic`, `Bearer ` vazio, payload JSON corrompido, JWT sem `sub`/`user_id` e JWT com `sub` adulterado para outro UID bloqueados | **PASS** | Rejeições `HTTP 400 / 403 / 500` (nunca `200`); `sub` adulterado `403` |

> **Nota técnica transparente sobre JWT no Firebase Emulator:** Conforme alerta oficial do próprio Auth Emulator (`"Auth Emulator does not validate JWTs and IS NOT SECURE"`), o Firestore Emulator aceita tokens locais `alg: "none"` sem verificar assinatura criptográfica ou claim `exp` localmente. Em produção, assinatura RS256 e expiração são validadas pelo Firebase Auth / Google Identity Toolkit, e no backend Express a rejeição estrita de tokens inválidos e expirados é comprovada em `/tests/apiSecurity.test.ts` (passes `HTTP 401` e `HTTP 403`).

---

## Seção D — Configuração do UID Real do Administrador e Variáveis de Ambiente (Fase 4)

### Bug crítico corrigido em `scripts/configure-rules-uid.ts` e `firestore.rules`
- **Problema encontrado:** Versões anteriores usavam `.replace('REPLACE_WITH_YOUR_FIREBASE_UID', uid)` simples e o comentário na linha 17 de `firestore.rules` continha literalmente a string `REPLACE_WITH_YOUR_FIREBASE_UID`, fazendo com que a substituição pudesse atingir o comentário ou mascarar o placeholder real na função `authorizedAdminUid()`.
- **Correção:**
  1. Removida a string literal `REPLACE_WITH_YOUR_FIREBASE_UID` do bloco de comentários de `firestore.rules`.
  2. `scripts/configure-rules-uid.ts` agora inspeciona e substitui estritamente o padrão `/return\s+['"]REPLACE_WITH_YOUR_FIREBASE_UID['"]\s*;/` dentro de `authorizedAdminUid()`, mantendo intacta a guarda `uid != 'REPLACE_WITH_YOUR_FIREBASE_UID'` em `hasValidAdminUidConfig()`.
  3. Validação executada: `npm run rules:check` retornou **`exit 1`** confirmando que `firestore.rules` permanece em modo **fail-closed** aguardando o UID real do Ian (nenhum UID fictício foi gravado).

### Checklist completo de variáveis de ambiente
| Variável | Escopo | Obrigatória | Estado no container | Observação de segurança |
|---|---|---|---|---|
| `VITE_AUTHORIZED_ADMIN_UID` | Frontend / Vercel | **Sim** | **PENDENTE (Proprietário)** | Sem fallback permissivo; bloqueia painel se ausente |
| `AUTHORIZED_ADMIN_UID` | Backend Express / Vercel | **Sim** | **PENDENTE (Proprietário)** | Exigido em `/api/gemini/*` (`HTTP 403` se ausente) |
| `FIREBASE_PROJECT_ID` | Backend Express / Vercel | **Sim** | **PENDENTE (Proprietário)** | Deve ser `gen-lang-client-0798002034` (`HTTP 503` se ausente) |
| `GEMINI_API_KEY` | Backend Express / Vercel | **Sim (IA)** | **PENDENTE (Proprietário)** | **Zero vazamento no bundle:** `grep -c GEMINI_API_KEY dist/assets/index-*.js` = **`0`** |
| `GOOGLE_APPLICATION_CREDENTIALS` | Script local CLI backup | Somente backup local | **PENDENTE (Proprietário)** | Caminho para Service Account JSON somente-leitura (fora do Git) |
| `AUTHORIZED_ADMIN_EMAIL` | Backend (camada extra) | Opcional | Não obrigatória | Nunca substitui `AUTHORIZED_ADMIN_UID` |
| `VITE_WORKSPACE_ID` | Frontend | Sim (padrão) | `adm_equipeie` | Preserva o workspace real de produção |
| `VITE_APP_ENV` / `VITE_USE_FIREBASE_EMULATOR` | Frontend | Opcional | `development` / `false` | Em produção Vercel usar `production` e `false` |

### Comandos para Ian aplicar o UID real antes do deploy de regras
```bash
# 1. Obter seu UID real no Firebase Console -> Authentication -> Users
# 2. Aplicar com segurança apenas no return authorizedAdminUid():
AUTHORIZED_ADMIN_UID=<SEU_UID_REAL> npm run rules:configure

# 3. Conferir que não há placeholder pendente (esperado exit 0):
npm run rules:check

# 4. Testar as regras configuradas e publicar (quando desejar publicar):
# firebase deploy --only firestore:rules
```

---

## Seção E — Backup Real Somente-Leitura do Firestore (Fase 5)

### Melhorias implementadas em `/src/services/adminBackupService.ts`
- **Serialização lossless de tipos especiais do Firestore:**
  - `Timestamp` -> `{ __firestoreType: "Timestamp", seconds, nanoseconds, iso }`
  - `Date` -> `{ __firestoreType: "Date", iso }`
  - `GeoPoint` -> `{ __firestoreType: "GeoPoint", latitude, longitude }`
  - `DocumentReference` -> `{ __firestoreType: "DocumentReference", path }`
  - `Bytes` (`Buffer` / `Uint8Array`) -> `{ __firestoreType: "Bytes", base64 }`
- **Métricas recursivas reais no manifesto `3.1-admin-recursive`:**
  - `subcollectionsCount`: quantidade total de subcoleções descobertas em toda a árvore;
  - `preservedPathsCount`: total de nós com `path` completo preservado;
  - `maxDepth`: profundidade máxima alcançada na árvore;
  - `checksumSha256`: integridade verificada por `validateRecursiveBackupManifest()`.
- **Operação 100% somente-leitura:** utiliza apenas `.listCollections()`, `.get()` e ordenação determinística; nenhuma função de `set`, `update`, `delete` ou migração existe no módulo.

### Execução real de `npm run backup:firestore` no container
- **Saída real obtida:**
  `[Backup Firestore] ABORTADO: Nenhuma credencial de leitura disponível (GOOGLE_APPLICATION_CREDENTIALS e Application Default Credentials ausentes). Nenhum backup real foi executado.` (`exit 1`)
- **Diagnóstico:** Comportamento esperado e seguro. Nenhuma credencial GCP falsa foi usada e nenhuma estatística de produção foi fabricada.

### Passos para o proprietário executar o backup real em produção
```bash
# 1. Gerar chave JSON de Service Account somente-leitura (Cloud Datastore Viewer / Firebase Viewer)
#    no projeto gen-lang-client-0798002034 e salvá-la FORA do repositório.
export GOOGLE_APPLICATION_CREDENTIALS=/caminho/seguro/sa-readonly-kaizen.json

# 2. Executar backup completo recursivo somente-leitura:
npm run backup:firestore

# 3. Verificar arquivo gerado em ./backups/kaizen-firestore-backup-*.json
#    Conferir totalDocuments, countsByCollection (leads, niches, importedSheets), errors=[] e checksumMatch=true.
```

---

## Seção F — Auditoria Completa de Compatibilidade de Schema (Fase 6)

### Escopo auditado no código-fonte real (`src/`)
Foram auditados `src/types/crm.ts`, `src/utils/firebase.ts`, `src/utils/storage.ts`, `src/utils/initialData.ts`, `src/utils/phone.ts`, `src/components/NewLeadModal.tsx`, `src/components/NewNicheModal.tsx`, `src/components/LeadModal.tsx`, `src/components/AgendaView.tsx`, `src/components/ScriptsView.tsx`, `src/components/KanbanView.tsx` e `src/App.tsx`.

### Bug real de produção detectado e corrigido durante os testes
1. **Limite de 1.000 expressões do Firestore Rules (`MAX_EXPRESSIONS = 1000`):**
   - Ao gravar um `Lead` completo com todos os **35/36 campos preenchidos** (incluindo agenda de reunião, callback, pitch IA, URLs e notas) na suíte real do Firestore Emulator (`Compatibilidade 1`), a implementação anterior de `firestore.rules` (com 31 chamadas a `isOptionalString`/`isOptionalNumber` + múltiplas invocações de `authorizedAdminUid()`) excedeu o limite de **1.000 expressões avaliadas por regra** (`"Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached"` -> `HTTP 403`).
   - **Correção aplicada em `firestore.rules`:** otimização com variáveis `let` (`let uid = authorizedAdminUid();`, `let n = data.get('notes', null);`) e helpers enxutos `optStr(data.get(campo, null), maxLen)` / `optNum(data.get(campo, null))`, reduzindo drasticamente o custo da árvore AST sem relaxar nenhum campo permitido, tipo ou limite máximo.
   - **Resultado após a correção:** `Compatibilidade 1` passou com `HTTP 200` gravando todos os 36 campos simultaneamente.
2. **Campos opcionais `null`, tamanhos de URLs e histórico de planilhas:**
   - `notes`, `targetCities`, `scripts` e `leadsSummary` aceitam explicitamente `null` (compatível com registros legados sem os campos).
   - URLs (`googleMapsUrl`, `websiteUrl`, `mockupUrl`, `meetingLink`) aceitam até `2000` caracteres.
   - `leadsSummary` em `importedSheets` suporta até `50` itens resumidos.

### Matriz de compatibilidade por coleção
| Coleção (`workspaces/adm_equipeie/*`) | Campos obrigatórios nas Rules | Total campos permitidos | Padrão de IDs no app vs Rules (`^[a-zA-Z0-9_\-]+$`, `1..128`) | Atualização parcial (`merge: true`) | Status no Emulator Real |
|---|---|---|---|---|---|
| `leads/{leadId}` | `companyName`, `phone`, `stage` | 36 campos | `lead-{ts}-{rand}`, `lead-imp-{ts}-{idx}` | `reassignLeadsNicheInFirestore` (`nicheId`, `updatedAt`) | **PASS** (`Compatibilidade 1 e 2`) |
| `niches/{nicheId}` | `name`, `segment`, `city` | 11 campos | `niche-{ts}`, `niche-nutri-padrao`, etc. | Completo via `saveNicheToFirestore` | **PASS** (`Compatibilidade 3`) |
| `importedSheets/{sheetId}` | `name`, `nicheId`, `totalLeads` | 11 campos | `sheet-{ts}` | Completo + `delete` (`handleDeleteImportedSheet`) | **PASS** (`Compatibilidade 4`) |
| Raiz `/workspaces/adm_equipeie` | N/A | Somente `allow get` | ID fixo `adm_equipeie` | Escrita cliente bloqueada (`false`) | **PASS** (`Segurança 1 e 2`) |

---

## Seção G — Inventário Completo de Arquivos Criados e Modificados

| Arquivo | Ação na Etapa 0.4 | Objetivo |
|---|---|---|
| `src/services/emulatorHealthCheck.ts` | Criado | Verificação HTTP/JSON estrita dos emuladores Auth e Firestore (evita falso positivo HTML/porta ocupada) |
| `tests/emulatorHealthCheck.test.ts` | Criado | 8 testes unitários cobrindo falhas e respostas inválidas/HTML/404 do health check |
| `tests/schemaCompatibility.test.ts` | Criado | 6 testes unitários de IDs, `sanitizeForFirestore`, estágios, `INITIAL_NICHES`, segredos de build e `configure-rules-uid` |
| `firebase.json` | Modificado | Porta do Firestore Emulator ajustada para `8088` (evita conflito com `nginx` na porta `8080`) |
| `src/utils/firebase.ts` | Modificado | Conexão local `connectFirestoreEmulator(db, '127.0.0.1', 8088)` alinhada ao `firebase.json` |
| `firestore.rules` | Modificado | Otimização AST (`let` + `.get(..., null)`) abaixo de 1.000 expressões, suporte a nulos legados/URLs 2000 chars e comentário sem literal do placeholder |
| `scripts/configure-rules-uid.ts` | Modificado | Substituição e detecção estritas em `return '...';` de `authorizedAdminUid()` |
| `src/services/adminBackupService.ts` | Modificado | Serialização lossless (`Timestamp`, `Date`, `GeoPoint`, `DocumentReference`, `Bytes`) e métricas recursivas (`maxDepth`, `subcollectionsCount`, `preservedPathsCount`) |
| `tests/adminBackup.test.ts` | Modificado | Teste de preservação lossless de tipos especiais e métricas recursivas |
| `firestore.rules.test.ts` | Modificado | Fail-fast sem Emulator (`assertEmulatorsRunning`), reload `:securityRules` com escopo no banco nomeado, 10 cenários de segurança e 4 testes reais de schema no Emulator |
| `docs/RELATORIO_ETAPA_0_4_VALIDACAO_FINAL.md` | Criado | Relatório técnico final completo (Seções A–I + Matriz de Aprovação) |

---

## Seção H — Comandos Executados e Resultados Reais

| Comando | Resultado real observado | Código de saída |
|---|---|---|
| `npx firebase emulators:exec --project kaizen-rules-test --only auth,firestore "npm run test:rules"` | **14/14 subtestes aprovados, 0 falhas, 0 ignorados (`skipped: 0`)** contra banco nomeado `ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea` em OpenJDK 21 | `0` |
| `npm run test:rules` *(sem emuladores ativos)* | Falhou explicitamente acusando emuladores inacessíveis (`auth=FAIL; firestore=FAIL`) — zero skips silenciosos | `1` *(esperado)* |
| `npm test` | **33/33 testes unitários aprovados, 0 falhas, 0 ignorados** | `0` |
| `npm run rules:check` | Confirmou placeholder `REPLACE_WITH_YOUR_FIREBASE_UID` ativo (estado fail-closed) | `1` *(esperado)* |
| `npm run backup:firestore` | Abortou limpo por ausência de `GOOGLE_APPLICATION_CREDENTIALS` / ADC sem inventar saída | `1` *(esperado)* |
| `npm run build` | Bundle Vite gerado com sucesso (`1699` módulos em `1.80s`) | `0` |
| `grep -c 'GEMINI_API_KEY' dist/assets/index-*.js` | **`0`** ocorrências (nenhum segredo de backend exposto no cliente) | `0` *(no match)* |
| `GIT_TERMINAL_PROMPT=0 git ls-remote https://github.com/iangabrieltv/crmprospectsite.git` | Sem credencial GitHub neste ambiente (`fatal: could not read Username`) | `128` |

---

## Seção I — Diagnóstico Verdadeiro e Próximos Passos do Proprietário (Ian)

1. **O que está 100% pronto e validado tecnicamente:**
   - Toda a lógica de segurança fail-closed no frontend, middleware Express (`/api/gemini/*`), `firestore.rules`, compatibilidade de schema de produção (`leads`, `niches`, `importedSheets`), backup recursivo lossless e suíte real de testes no Firebase Emulator (`14/14` + `33/33` unitários + `tsc --noEmit` + `vite build`).
   - O banco de produção (`gen-lang-client-0798002034` / `adm_equipeie`) não foi tocado, alterado nem apagado.
2. **O que permanece legitimamente `PENDENTE` de execução externa pelo proprietário (Ian):**
   - **Passo 1:** Sincronizar os arquivos validados na branch `security/etapa-0-3-final-validation` do repositório `https://github.com/iangabrieltv/crmprospectsite` (sem alterar `main` diretamente antes da revisão).
   - **Passo 2:** Executar localmente o backup real somente-leitura (`GOOGLE_APPLICATION_CREDENTIALS=... npm run backup:firestore`) antes de qualquer deploy.
   - **Passo 3:** Configurar o UID real do Ian nas variáveis `VITE_AUTHORIZED_ADMIN_UID`, `AUTHORIZED_ADMIN_UID`, `FIREBASE_PROJECT_ID`, `GEMINI_API_KEY` (Vercel) e em `firestore.rules` (`AUTHORIZED_ADMIN_UID=<UID> npm run rules:configure` -> `npm run rules:check` -> publicar regras no Firebase).

---

## Seção 12 — Matriz de Aprovação Final

| Item | Etapa / Verificação | Status | Observação objetiva |
|---|---|---|---|
| 1 | Health check estrito dos Emulators (Fase 1 — 8 cenários) | **PASS** | `tests/emulatorHealthCheck.test.ts` (`8/8`), rejeita HTML/porta 8080/404 |
| 2 | Diagnóstico de repositório & inventário para branch `security/etapa-0-3-final-validation` (Fase 2) | **PENDENTE** | `/app/applet` sem `.git` e sem auth GitHub; comandos prontos para push local do Ian |
| 3 | Suíte real no Firebase Emulator (`10` cenários de segurança no banco nomeado, Fase 3) | **PASS** | `firebase emulators:exec` em Java 21; zero `t.skip()` |
| 4 | Script `configure-rules-uid.ts` e estado fail-closed de `firestore.rules` (Fase 4) | **PASS** | Bug do comentário corrigido; `rules:check` confirma bloqueio até inserção do UID |
| 5 | Configuração do UID real do Ian + env vars no Vercel & Firebase Console (Fase 4) | **PENDENTE** | Requer UID real e segredos de produção do proprietário (nunca fabricados) |
| 6 | Ausência de segredos (`GEMINI_API_KEY`) no bundle frontend `dist/` (Fase 4) | **PASS** | `grep -c GEMINI_API_KEY dist/assets/index-*.js` = `0` |
| 7 | Backup recursivo lossless (`adminBackupService.ts`) e aborto seguro sem credencial (Fase 5) | **PASS** | Serialização especial + métricas testadas em `tests/adminBackup.test.ts` |
| 8 | Execução real do backup na nuvem de produção (`gen-lang-client-0798002034`) (Fase 5) | **PENDENTE** | Aguarda Service Account JSON somente-leitura do proprietário |
| 9 | Auditoria e correção de compatibilidade total de schema + testes reais no Emulator (Fase 6) | **PASS** | Limite de 1.000 expressões e nulabilidades corrigidos (`4/4` cenários reais no Emulator) |
| 10 | Compilação TypeScript (`npm run lint`) e build Vite (`npm run build`) | **PASS** | Sem erros de tipo ou build |
| 11 | Modificações destrutivas ou alterações diretas em produção / branch `main` | **NÃO APLICÁVEL** | Proibição integral cumprida: zero dados reais ou regras em nuvem tocados |
