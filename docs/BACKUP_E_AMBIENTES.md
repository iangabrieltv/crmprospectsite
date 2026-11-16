# Estratégia de Backup Completo e Isolamento de Ambientes — Kaizen

## 1. Backup Completo e Recursivo do Banco Atual

O banco de produção está hospedado no projeto **`gen-lang-client-0798002034`**, instância nomeada do Cloud Firestore **`ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`**, workspace **`adm_equipeie`**.

### Camada A — Exportação Gerenciada Oficial (Google Cloud / Cloud Storage)
Preserva integralmente documentos, subcoleções recursivas e IDs em formato oficial de recuperação do Firestore:

```bash
gcloud firestore export gs://<SEU-BUCKET-PRIVADO-DE-BACKUP>/manual-$(date +%F-%H%M) \
  --project=gen-lang-client-0798002034 \
  --database="ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea"
```

### Camada B — Script Admin Somente-Leitura com Descoberta Recursiva (`scripts/backup-firestore.ts`)
O script é estritamente **somente-leitura** e:
- Valida a presença de credencial (`GOOGLE_APPLICATION_CREDENTIALS` ou ADC válido) antes de iniciar; se ausente, aborta imediatamente sem fabricar dados nem simular execução.
- Conecta exatamente ao projeto `gen-lang-client-0798002034` e ao banco nomeado `ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`.
- Lê o documento raiz `workspaces/adm_equipeie`, descobre **dinamicamente** todas as coleções via `listCollections()` (não assumindo apenas `leads`, `niches` e `importedSheets`) e percorre **recursivamente** todas as subcoleções aninhadas em qualquer profundidade.
- Preserva IDs originais, caminho completo e todos os campos de cada documento.
- Registra contagens por coleção, contagem total e eventuais erros de leitura em `errors[]`.
- Grava `backup_complete.json`, arquivos `.ndjson` por coleção/subcoleção e executa validação pós-gravação (`validation_report.json`) conferindo JSON válido, projeto, banco, workspace, recontagem recursiva e hash SHA-256.

Execução local:
```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account-readonly.json npm run backup:firestore
```
Os arquivos são salvos localmente em `backups/firestore-<data>/` (pasta ignorada pelo `.gitignore`).

### Camada C — Backup v3.0 pela Interface do CRM (Visão Geral)
- Inclui `leads` (com notas, reuniões e retornos), `niches` (com scripts e cidades), `importedSheets`, metadados de identificação (sem credenciais) e `integrityHash`.
- A restauração exige validação de integridade, análise prévia de duplicidades, download opcional automático de cópia de segurança do estado atual antes de gravar e confirmação explícita do usuário.

---

## 2. Arquitetura Recomendada para Backup Diário Automático (Não Provisionada Sem Autorização)

Para automatizar backups diários sem criar recursos pagos neste momento:
1. **Bucket Cloud Storage dedicado** (região compatível com o Firestore) com **Object Lifecycle Management** configurada para expiração após **30 a 90 dias**.
2. **Cloud Function (Gen 2) ou Cloud Run Job** invocando `FirestoreAdminClient.exportDocuments` especificando o banco `ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`.
3. **Cloud Scheduler** diário (`0 3 * * *`) com alerta em falha.
4. **Custos envolvidos:** Cloud Storage (GB/mês + Classe A/B) e leituras do Firestore no volume de documentos exportados. **Nenhuma conta, bucket ou serviço pago foi provisionado nesta etapa.**

---

## 3. Separação Clara de Ambientes (Desenvolvimento, Testes e Produção)

Nunca execute testes experimentais escrevendo diretamente no banco real de produção.

| Camada | Produção (`main`) | Desenvolvimento / Homologação | Testes Automatizados (`Emulator`) |
|---|---|---|---|
| **Branch GitHub** | `main` | Branch de trabalho / Preview | Local / CI |
| **Vercel** | Production Deployment (somente após aprovação) | Preview Deployments | Não aplicável |
| **Projeto Firebase** | `gen-lang-client-0798002034` | Projeto separado ou `VITE_USE_FIREBASE_EMULATOR=true` | Projeto isolado `kaizen-rules-test` no Emulator |
| **Banco Firestore** | `ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea` | Banco de staging ou Emulator local | `TEST_FIRESTORE_DATABASE_ID` (padrão lê `firebase-applet-config.json`) no Emulator local |
| **Dados** | Dados reais do administrador Ian | Dados fictícios/de teste | Dados sintéticos criados em memória durante o teste |
| **Regras de Segurança** | `firestore.rules` publicada somente após validação e aprovação | `firestore.rules` validada no projeto de homologação | `firestore.rules` carregada dinamicamente no Firestore Emulator |

### Variáveis Necessárias por Ambiente
- **Backend (`.env` / Vercel):**
  - `FIREBASE_PROJECT_ID` *(obrigatório)*
  - `AUTHORIZED_ADMIN_UID` *(obrigatório — bloqueia se vazio ou placeholder)*
  - `AUTHORIZED_ADMIN_EMAIL` *(opcional — camada extra, nunca substitui `AUTHORIZED_ADMIN_UID`)*
  - `GEMINI_API_KEY` *(servidor apenas)*
  - `GOOGLE_APPLICATION_CREDENTIALS` *(para `npm run backup:firestore` local)*
- **Frontend (`.env` / Vercel):**
  - `VITE_AUTHORIZED_ADMIN_UID` *(obrigatório — sem ele o login permanece bloqueado)*
  - `VITE_WORKSPACE_ID` *(padrão `adm_equipeie`)*
  - `VITE_APP_ENV` (`development` | `staging` | `production`)
  - `VITE_USE_FIREBASE_EMULATOR` (`true` somente para testes locais com Emulator)
