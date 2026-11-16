# Especificação de Segurança — Kaizen CRM (Usuário Único Privado)

## 1. Invariantes de Segurança e Dados
1. **Bloqueio por Padrão (Default Deny):** Nenhum documento fora de `/workspaces/adm_equipeie/{leads|niches|importedSheets}` pode ser lido ou gravado pelo cliente Web.
2. **Autenticação Obrigatória:** Requisições anônimas (`request.auth == null`) recebem `PERMISSION_DENIED` em todas as coleções e subcoleções.
3. **Autorização de Usuário Único (UID Único):** Mesmo que outra conta Firebase Authentication exista no projeto, apenas o UID exato do administrador único (`request.auth.uid == authorizedAdminUid()`) possui permissão de leitura e escrita.
4. **Conhecimento do `workspaceId` não concede acesso:** Saber que o workspace se chama `adm_equipeie` não permite leitura ou escrita sem token válido correspondente ao UID autorizado.
5. **Validação Estrutural & Limites Anti-Abuso:** IDs de documentos devem respeitar `^[a-zA-Z0-9_\-]+$` (até 128 caracteres), strings obrigatórias devem respeitar tipos e tamanhos máximos, e campos extras arbitrários são bloqueados por listas explícitas de chaves permitidas mantendo compatibilidade integral com os documentos existentes.

## 2. Vetores de Ataque Validados ("Dirty Dozen" adaptados ao Kaizen)
1. Leitura anônima (`request.auth == null`) em `workspaces/adm_equipeie/leads`.
2. Escrita anônima (`request.auth == null`) em `workspaces/adm_equipeie/leads/{id}`.
3. Leitura autenticada com UID diferente (`uid = attacker-uid`) em `leads`, `niches` ou `importedSheets`.
4. Escrita autenticada com UID diferente (`uid = attacker-uid`) em `leads`, `niches` ou `importedSheets`.
5. Tentativa de acesso a outro `workspaceId` (`workspaces/outro_workspace/leads`) mesmo autenticado com o UID autorizado.
6. Tentativa de acesso a coleção raiz arbitrária (`/users`, `/admins`, `/secrets`).
7. Shadow field injection: criação de `Lead` com campo arbitrário não permitido (ex: `isAdmin: true`).
8. Payload sem campos obrigatórios (`Lead` sem `companyName` ou sem `stage`).
9. Type poisoning: `Lead` com `monthlyMrr` como string em vez de número, ou `notes` como string em vez de lista.
10. Resource exhaustion: `Lead.companyName` com string gigante (> 500 chars) ou `leadId` inválido.
11. Criação de `NicheCampaign` sem `name`, `segment` ou `city`.
12. Criação de `ImportedSheet` sem `name`, `nicheId` ou `totalLeads` numérico.
