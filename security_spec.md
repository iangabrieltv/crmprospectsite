# Especificação de Segurança — Kaizen CRM (Usuário Único Privado)

## 1. Invariantes de Segurança e Dados
1. **Bloqueio por Padrão (Default Deny & Fail-Closed):** Nenhum documento fora de `/workspaces/adm_equipeie/{leads|niches|importedSheets}` pode ser lido ou gravado pelo cliente Web. Se o placeholder `REPLACE_WITH_YOUR_FIREBASE_UID` permanecer em `firestore.rules`, **todas** as leituras e escritas são bloqueadas mesmo para usuários autenticados.
2. **Autenticação Obrigatória:** Requisições anônimas (`request.auth == null`) recebem `PERMISSION_DENIED` em todas as coleções e subcoleções.
3. **Autorização Estrita de Usuário Único (UID Único):** Apenas o UID exato do administrador único (`request.auth.uid == authorizedAdminUid()`) possui permissão no Firestore, no Frontend (`VITE_AUTHORIZED_ADMIN_UID` obrigatório) e no Backend (`AUTHORIZED_ADMIN_UID` + `FIREBASE_PROJECT_ID` obrigatórios). E-mail nunca substitui o UID.
4. **Conhecimento do `workspaceId` não concede acesso:** Saber que o workspace se chama `adm_equipeie` (ou antigo `kaizenvisual123`) não permite leitura ou escrita.
5. **Validação Estrutural & Limites Anti-Abuso:** IDs de documentos devem respeitar `^[a-zA-Z0-9_\-]+$` (até 128 caracteres), strings obrigatórias devem respeitar tipos e tamanhos máximos, listas são limitadas e campos extras arbitrários são bloqueados por listas explícitas de chaves permitidas mantendo compatibilidade integral com os documentos existentes.

## 2. Estratégia Segura de Configuração do UID em `firestore.rules`
O motor do Firebase Security Rules não lê variáveis `.env` em tempo de execução. Portanto:
1. O arquivo versionado `firestore.rules` mantém `authorizedAdminUid()` com o placeholder explícito `'REPLACE_WITH_YOUR_FIREBASE_UID'` acompanhado de `hasValidAdminUidConfig()`, garantindo bloqueio automático caso não configurado.
2. Nunca inventar nem versionar um UID fictício.
3. Após criar a conta única do administrador no Firebase Authentication e validar o backup inicial, executar localmente:
   ```bash
   AUTHORIZED_ADMIN_UID=<SEU_UID_REAL> npm run rules:configure
   firebase emulators:exec --only auth,firestore "npm run test:rules"
   ```
4. Somente após todos os testes no Emulator passarem (e com aprovação expressa), publicar via `firebase deploy --only firestore:rules` (ou colar o conteúdo validado no Console do Firebase).

## 3. Vetores de Ataque Validados ("Dirty Dozen" e Cenários da Etapa 0.2)
1. Leitura anônima (`request.auth == null`) em `workspaces/adm_equipeie/leads` (`get` e `list`).
2. Escrita anônima (`request.auth == null`) em `workspaces/adm_equipeie/leads/{id}`.
3. Leitura autenticada com UID diferente (`intruder`) em `leads`, `niches` ou `importedSheets`.
4. Escrita autenticada com UID diferente (`intruder`) em `leads`, `niches` ou `importedSheets`.
5. Tentativa de acesso a outro `workspaceId` (`workspaces/kaizenvisual123/leads` ou `workspaces/outro_workspace/leads`) mesmo com UID autorizado.
6. Tentativa de acesso a coleção não autorizada (`/workspaces/adm_equipeie/secrets`, `/users`, `/admins`) mesmo com UID autorizado.
7. Shadow field injection: criação de `Lead` com campo arbitrário não permitido (ex: `isAdmin: true`).
8. Payload sem campos obrigatórios (`Lead` sem `companyName`, `phone` ou `stage`).
9. Type poisoning: `Lead` com `monthlyMrr` como string em vez de número, ou `notes` como string em vez de lista.
10. Resource exhaustion: `Lead.companyName` gigante ou `leadId` inválido.
11. Criação de `NicheCampaign` sem `name`, `segment` ou `city`.
12. Configuração de UID ausente (`REPLACE_WITH_YOUR_FIREBASE_UID` em `firestore.rules`) tentando leitura/escrita autenticado -> bloqueio total (`403`).
