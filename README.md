# ProspectFlow — CRM de Prospecção Ativa de Vendas de Sites

CRM minimalista multi-nicho (estilo Linear/Notion) desenvolvido com React 19, TypeScript, Tailwind CSS v4, Express e Vite para gestão ágil de prospecção, qualificação, testes A/B de roteiros de vendas (WhatsApp e Cold Call) e fechamento de contratos de sites e recorrência (MRR).

---

## 🚀 Como Executar o Projeto Localmente

### 1. Pré-requisitos
Certifique-se de ter o **Node.js** (versão 18, 20 ou 22+) e o **npm** instalados na sua máquina:
```bash
node -v
npm -v
```

---

### 2. Clonar ou Baixar o Projeto
Se você baixou o arquivo `.zip`, descompacte-o em uma pasta. Se estiver usando o Git:
```bash
git clone <URL_DO_REPOSITORIO>
cd <NOME_DA_PASTA>
```

---

### 3. Instalar as Dependências
No terminal, dentro da pasta do projeto, execute:
```bash
npm install
```

---

### 4. Configurar as Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto (você pode duplicar o `.env.example`):

```bash
cp .env.example .env
```

Abra o arquivo `.env` e configure sua chave do Google Gemini (necessária apenas para os recursos de inteligência artificial de extração automática de planilhas/textos e geração de pitches personalizados):

```env
GEMINI_API_KEY="sua_chave_do_gemini_aqui"
```

> **Dica:** Você pode obter uma chave de API gratuita do Gemini no [Google AI Studio](https://aistudio.google.com/). Caso você não configure a chave, o CRM continuará funcionando normalmente em modo local (cadastro manual, kanban, scripts de vendas, WhatsApp e simulação), desativando apenas a análise automática por IA.

---

### 5. Iniciar o Servidor de Desenvolvimento
Execute o comando:
```bash
npm run dev
```

Abra o seu navegador e acesse:
👉 **[http://localhost:3000](http://localhost:3000)**

---

### 6. Como os Dados São Salvos
- O CRM salva nichos, campanhas, leads, notas e configurações diretamente no **armazenamento local do seu navegador (`localStorage`)**.
- Nenhum banco de dados externo precisa ser configurado.
- Os dados persistem automaticamente mesmo se você reiniciar o computador ou fechar o navegador.

---

### 7. Comandos Disponíveis
- `npm run dev`: Inicia o servidor full-stack (API Express + Vite) na porta 3000.
- `npm run build`: Compila a aplicação frontend otimizada para produção.
- `npm run lint`: Valida o TypeScript em busca de erros de tipo.
- `npm start`: Inicia o servidor em modo de produção.
