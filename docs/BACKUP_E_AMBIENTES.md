# Estratégia de Backup Completo e Isolamento de Ambientes — Kaizen

## 1. Backup Completo do Banco Atual

O banco de produção está hospedado no projeto **`gen-lang-client-0798002034`**, instância nomeada do Cloud Firestore **`ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`**, workspace **`adm_equipeie`**.

### Camada A — Exportação Gerenciada Oficial (Google Cloud / Cloud Storage)
Preserva integralmente documentos, subcoleções e IDs em formato oficial de recuperação do Firestore:

```bash
gcloud firestore export gs://<SEU-BUCKET-PRIVADO-DE-BACKUP>/manual-$(date +%F-%H%M) \
  --project=gen-lang-client-0798002034 \
  --database="ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea"
```

### Camada B — Exportação Complementar Legível via Script Admin (JSON + NDJSON)
O repositório inclui o script **somente-leitura** `scripts/backup-firestore.ts`, que consulta todas as subcoleções do workspace (`leads`, `niches`, `importedSheets` e quaisquer outras encontradas) preservando IDs exatos:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account-readonly.json npm run backup:firestore
```
Os arquivos são salvos localmente em `backups/firestore-<data>/` (pasta ignorada pelo `.gitignore`).

### Camada C — Backup v3.0 pela Interface do CRM (Visão Geral)
- Inclui `leads` (com notas, reuniões e retornos), `niches` (com scripts e cidades), `importedSheets`, metadados de identificação (sem credenciais) e `integrityHash`.
- A restauração exige validação de integridade, análise prévia de duplicidades, download opcional automático de cópia de segurança do estado atual antes de sobrescrever e confirmação explícita do usuário.

---

## 2. Arquitetura Recomendada para Backup Diário Automático (Não Provisionada Sem Autorização)

Para automatizar backups diários sem criar recursos nem gerar cobranças neste momento, a arquitetura recomendada no Google Cloud é:
1. **Bucket Cloud Storage dedicado** (região compatível com o Firestore) com **Object Lifecycle Management** configurada para expiração automática após **30 a 90 dias** (e versionamento se desejado).
2. **Cloud Function (Gen 2) ou Cloud Run Job** invocando a API `FirestoreAdminClient.exportDocuments` especificando o banco `ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`.
3. **Cloud Scheduler** disparando diariamente (ex.: `0 3 * * *` às 03:00 BRT), com alerta em caso de falha via Cloud Monitoring / e-mail.
4. **Custos envolvidos:** Cloud Storage cobra por GB armazenado + operações Classe A/B; Cloud Firestore cobra leituras equivalentes ao número de documentos exportados por dia; Cloud Scheduler tem 3 jobs gratuitos por conta. **Nenhuma criação foi realizada nesta Etapa 0 para evitar cobranças automáticas.**

---

## 3. Isolamento de Ambientes: Desenvolvimento / Homologação vs. Produção

Nunca execute testes experimentais escrevendo diretamente no banco real de produção.

| Camada | Produção (`main`) | Homologação / Preview (`dev` / PRs) | Testes Locais Isolados |
|---|---|---|---|
| **Branch GitHub** | `main` | `develop` / feature branches | Local |
| **Vercel** | Production Deployment | Preview Deployments | `npm run dev` |
| **Projeto Firebase** | `gen-lang-client-0798002034` | Projeto Firebase separado (`kaizen-crm-staging`) | Firebase Emulators (`VITE_USE_FIREBASE_EMULATOR=true`) |
| **Variáveis de Ambiente** | Env Vars `Production` na Vercel + config padrão | Env Vars `Preview` na Vercel (`VITE_APP_ENV=staging` + `VITE_FIREBASE_*` do projeto de testes) | `.env` local apontando para emulador ou projeto de testes |
| **Regras de Segurança** | `firestore.rules` (somente após aprovação) | `DRAFT_firestore.rules` validada antes no projeto de testes | `DRAFT_firestore.rules` via `firebase emulators:exec` |

### Fluxo Seguro de Publicação
1. Desenvolver em branch separada usando emulador local ou projeto Firebase de testes (`VITE_APP_ENV=staging`).
2. Executar `npm run lint`, `npm test` e `npm run build`.
3. Se houver alteração em `firestore.rules`, validar primeiro com `npm run test:rules` (com emuladores ativos) e depois no projeto de homologação.
4. Somente após validação completa no Preview da Vercel, realizar merge para `main`.
