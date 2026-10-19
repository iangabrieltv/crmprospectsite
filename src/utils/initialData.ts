import { NicheCampaign, Lead, ScriptDefinition } from '../types/crm';
import { cleanPhoneForWhatsApp, formatDisplayPhone } from './phone';

export const SCRIPT_LIGACAO: ScriptDefinition = {
  id: 'script_ligacao',
  title: 'Script de Ligação (Cold Call)',
  subtitle: 'Abertura rápida → Validação do responsável → Diagnóstico de Google → Presença e Site → Confiança Online → Convite Reunião 15 min',
  description: 'Roteiro estruturado para contato telefônico direto e qualificação rápida — Kaizen Visual.',
  category: 'Ligação Telefônica',
  goldenRule: {
    order: 'Abertura rápida → Confirmar responsável → Diagnóstico Google vs Indicação → Estrutura de site atual → Confiança online → Convite 15 min',
    primaryGoal: 'Conectar diretamente com o tomador de decisão da empresa e entender sua presença digital.',
    insight: 'Seja natural, consulte e termine com pergunta curta. Mostre que uma conversa de 15 min trará uma análise prática de oportunidades.',
  },
  structure: {
    hook: 'Oi, bom dia! Tudo bem? Com quem eu falo, por favor? Prazer! Meu nome é {SeuNome}, sou da Kaizen Visual. Você consegue falar comigo por dois minutinhos ou tá num momento corrido aí?',
    problem: 'Queria entender uma coisa: hoje vocês recebem clientes pelo Google, quando alguém pesquisa por empresas de {nicho} aqui na região, ou a maior parte dos clientes chega por indicação?',
    solution: 'Eu queria fazer uma análise rápida da presença digital de vocês e te mostrar alguns pontos que podem ser melhorados, caso existam oportunidades.',
    cta: 'Seria uma conversa rápida, de uns 15 minutos. Você conseguiria conversar comigo amanhã ou teria algum outro dia melhor?',
  },
  template: `Oi, bom dia! Tudo bem? Com quem eu falo, por favor?

Prazer! Meu nome é {SeuNome}, sou da Kaizen Visual.

Você consegue falar comigo por dois minutinhos ou tá num momento corrido aí?`,
  followUp1: `Oi, tudo bem? Aqui é o {SeuNome} da Kaizen Visual. Conversamos rapidamente por telefone sobre a análise da presença digital da {empresa}. Conseguiu verificar sua agenda para amanhã?`,
  followUp2: `Oi, tudo bem? Para ser bem breve: queria te mostrar rapidamente os pontos de oportunidade que encontrei na presença digital de vocês. Qual o melhor dia para conversarmos 15 minutos?`,
  objections: [
    {
      id: 'obj-lig-sobre-o-que',
      trigger: 'Sobre o que é a ligação?',
      title: 'Se perguntarem: "Sobre o que é a ligação?"',
      response: `É sobre uma análise rápida que fiz da presença digital da empresa no Google e queria explicar rapidinho para o responsável. Você consegue falar comigo dois minutinhos?`,
    },
    {
      id: 'obj-lig-nao-disponivel',
      trigger: 'O responsável não está no momento',
      title: 'Se o responsável não estiver no momento',
      response: `Tudo bem, sem problema nenhum!

Você sabe me dizer qual horário costuma ser melhor para eu conseguir falar com ele(a)?

E, caso seja mais fácil, você consegue me passar o WhatsApp dele(a) para eu mandar uma mensagem?`,
    },
    {
      id: 'obj-lig-ja-temos-site',
      trigger: 'Nós já temos site ou quem cuide',
      title: 'Se disserem: "Nós já temos site"',
      response: `Que ótimo! O objetivo não é descartar o que vocês já têm, e sim fazer um diagnóstico de como ele está performando no Google quando clientes pesquisam na região. Se puder te mostrar em 15 minutos, faz sentido batermos esse papo?`,
    },
    {
      id: 'obj-lig-manda-whats',
      trigger: 'Pode mandar as informações pelo WhatsApp?',
      title: 'Se pedirem: "Pode mandar pelo WhatsApp?"',
      response: `Claro, com certeza! Esse número mesmo é o seu WhatsApp? Vou mandar um resumo do que encontrei e marcamos uma conversa rápida de 15 minutos.`,
    },
    {
      id: 'obj-lig-quanto-custa',
      trigger: 'Quanto custa o serviço de vocês?',
      title: 'Se perguntarem: "Quanto custa?"',
      response: `Essa primeira análise é 100% gratuita! A ideia é justamente te mostrar o cenário real da empresa na internet. Se vocês quiserem implementar as melhorias com a Kaizen Visual, temos soluções sob medida bem acessíveis.`,
    },
  ],
  stages: [
    {
      id: 'etapa-lig-1',
      stageTitle: 'MENSAGEM 1 — ABERTURA',
      description: 'Gatilho: Primeiro envio para iniciar o contato',
      steps: [
        {
          id: 'lig-step-1',
          title: 'Mensagem 1 — Abertura',
          condition: 'Primeiro envio para iniciar o contato',
          message: `Oi, bom dia! Tudo bem? Com quem eu falo, por favor?

Prazer! Meu nome é {SeuNome}, sou da Kaizen Visual.

Você consegue falar comigo por dois minutinhos ou tá num momento corrido aí?`,
          tip: 'Mensagem simples e inocente para confirmação.',
          format: 'texto',
        },
      ],
    },
    {
      id: 'etapa-lig-2',
      stageTitle: 'MENSAGEM 2 — SE RESPONDER “SIM”',
      description: 'Gatilho: Quando confirmarem o contato',
      steps: [
        {
          id: 'lig-step-2',
          title: 'Mensagem 2 — Se responder “sim”',
          condition: 'Quando confirmarem o contato',
          message: `Legal! Eu tô entrando em contato porque estava conhecendo algumas empresas de {nicho} aqui da região e encontrei a de vocês. Queria entender uma coisa: é você mesmo quem cuida dessa parte de divulgação e presença da empresa na internet, ou seria outra pessoa?`,
          tip: 'Solicitação direta e educada para falar com a profissional.',
          format: 'texto',
        },
      ],
    },
    {
      id: 'etapa-lig-3',
      stageTitle: 'MENSAGEM 3 — APRESENTAÇÃO & DIAGNÓSTICO',
      description: 'Gatilho: Momento ideal de envio',
      steps: [
        {
          id: 'lig-step-3',
          title: 'Nova Mensagem / Passo — Diagnóstico de Clientes',
          condition: 'Momento ideal de envio',
          message: `Ah, legal! Prazer!

Então, eu trabalho com a parte de presença digital das empresas, principalmente com sites profissionais e a presença delas no Google.

Eu queria entender uma coisa: hoje vocês recebem clientes pelo Google, quando alguém pesquisa por {nicho} aqui na região, ou a maior parte dos clientes chega por indicação?`,
          tip: 'Seja natural, consulte e termine com pergunta curta.',
          format: 'texto',
        },
      ],
    },
    {
      id: 'etapa-lig-4',
      stageTitle: 'MENSAGEM 4 — ESTRUTURA ATUAL',
      description: 'Gatilho: Momento ideal de envio',
      steps: [
        {
          id: 'lig-step-4',
          title: 'Nova Mensagem / Passo — Presença e Site Atual',
          condition: 'Momento ideal de envio',
          message: `Ah, bacana! E vocês têm um site próprio também ou trabalham mais com o perfil da empresa no Google e o WhatsApp?`,
          tip: 'Seja natural, consulte e termine com pergunta curta.',
          format: 'texto',
        },
      ],
    },
    {
      id: 'etapa-lig-5',
      stageTitle: 'MENSAGEM 5 — CONFIANÇA NA INTERNET',
      description: 'Gatilho: Momento ideal de envio',
      steps: [
        {
          id: 'lig-step-5',
          title: 'Nova Mensagem / Passo — Confiança na Internet',
          condition: 'Momento ideal de envio',
          message: `Entendi! E quando alguém que ainda não conhece a empresa pesquisa vocês na internet, você sente que a empresa consegue transmitir a mesma confiança que transmite pessoalmente?`,
          tip: 'Seja natural, consulte e termine com pergunta curta.',
          format: 'texto',
        },
      ],
    },
    {
      id: 'etapa-lig-6',
      stageTitle: 'MENSAGEM 6 — CONVITE PARA A REUNIÃO',
      description: 'Gatilho: Momento ideal de envio',
      steps: [
        {
          id: 'lig-step-6',
          title: 'Nova Mensagem / Passo — Convite para Reunião de 15 Min',
          condition: 'Momento ideal de envio',
          message: `Entendi! Olha, a ideia do meu contato é justamente essa.

Eu queria fazer uma análise rápida da presença digital de vocês e te mostrar alguns pontos que podem ser melhorados, caso existam oportunidades.

Aí consigo entender melhor o que vocês precisam e explicar como a Kaizen Visual poderia ajudar.

Seria uma conversa rápida, de uns 15 minutos. Você conseguiria conversar comigo amanhã ou teria algum outro dia melhor?`,
          tip: 'Proponha uma conversa rápida de 15 minutos amanhã ou outro dia melhor.',
          format: 'texto',
        },
      ],
    },
  ],
};

export const SCRIPT_MENSAGEM: ScriptDefinition = {
  id: 'script_mensagem',
  title: 'Script de Mensagem (WhatsApp)',
  subtitle: 'Abertura profissional → Validação do responsável → Diagnóstico de Google → Investigação de estrutura → Percepção de valor → Convite Reunião 15 min',
  description: 'Roteiro oficial de prospecção por WhatsApp da Kaizen Visual.',
  category: 'WhatsApp / Mensagem',
  goldenRule: {
    order: 'Abertura objetiva → Validar responsável → Diagnóstico Google vs Redes → Investigar estrutura → Proposta de valor → Convite 15 min',
    primaryGoal: 'Identificar a pessoa responsável pela divulgação/comercial e agendar uma análise rápida de 15 minutos.',
    insight: 'Nunca envie texto longo no primeiro contato. Faça perguntas curtas que estimulem respostas e facilitem o diálogo.',
  },
  structure: {
    hook: 'Oi, bom dia! Tudo bem? Meu nome é {SeuNome}, sou da Kaizen Visual. Encontrei a empresa de vocês enquanto pesquisava empresas de {nicho} aqui da região e queria falar rapidinho com o responsável pela parte comercial ou de divulgação. Você consegue me ajudar?',
    problem: 'Queria te perguntar uma coisa: hoje vocês conseguem receber contatos de clientes pelo Google ou a maior parte chega por indicação e redes sociais?',
    solution: 'Eu queria fazer uma análise rápida da presença digital de vocês e mostrar alguns pontos que podem ser melhorados, caso existam oportunidades.',
    cta: 'Seria uma conversa rápida, de uns 15 minutos. Você teria disponibilidade amanhã ou em algum outro dia desta semana?',
  },
  template: `Oi, bom dia! Tudo bem?

Meu nome é {SeuNome}, sou da Kaizen Visual.

Encontrei a empresa de vocês enquanto pesquisava empresas de {nicho} aqui da região e queria falar rapidinho com o responsável pela parte comercial ou de divulgação. Você consegue me ajudar?`,
  followUp1: `Oi, tudo bem? Aqui é o {SeuNome} da Kaizen Visual. Passando rapidinho para retomar a mensagem sobre a análise da presença digital da {empresa}. Consegue falar dois minutinhos hoje?`,
  followUp2: `Oi, tudo bem? Para ser bem breve: queria te mostrar rapidamente os pontos que encontrei da presença digital de vocês no Google. Qual dia desta semana fica melhor para você?`,
  objections: [
    {
      id: 'obj-msg-nao-interesse',
      trigger: 'Não temos interesse no momento',
      title: 'Se disserem: "Não tenho interesse"',
      response: `Entendo perfeitamente! Não quero tomar seu tempo. Posso apenas deixar meu contato caso no futuro vocês queiram melhorar a presença no Google e atrair novos clientes pela internet?`,
    },
    {
      id: 'obj-msg-ja-temos',
      trigger: 'Já temos equipe ou agência',
      title: 'Se disserem: "Já temos agência/equipe"',
      response: `Muito bom! O objetivo não é substituir o trabalho atual de vocês, mas sim compartilhar um diagnóstico independente da presença no Google. Se achar útil, posso te mandar um resumo sem compromisso!`,
    },
    {
      id: 'obj-msg-qual-preco',
      trigger: 'Qual é o valor do serviço?',
      title: 'Se perguntarem o valor',
      response: `A nossa análise diagnóstica inicial de 15 minutos é 100% gratuita! Caso vocês queiram implementar as melhorias com a Kaizen Visual, nossos projetos são bem acessíveis e personalizados. Você tem 15 minutinhos amanhã para vermos isso juntos?`,
    },
  ],
  stages: [
    {
      id: 'etapa-msg-1',
      stageTitle: 'MENSAGEM 1 — ABERTURA',
      description: 'Gatilho: Primeiro contato com a empresa.',
      steps: [
        {
          id: 'msg-step-1',
          title: 'Mensagem 1 — Abertura',
          condition: 'Primeiro contato com a empresa.',
          message: `Oi, bom dia! Tudo bem?

Meu nome é {SeuNome}, sou da Kaizen Visual.

Encontrei a empresa de vocês enquanto pesquisava empresas de {nicho} aqui da região e queria falar rapidinho com o responsável pela parte comercial ou de divulgação. Você consegue me ajudar?`,
          tip: 'Primeiro contato com a empresa.',
          format: 'texto',
        },
      ],
    },
    {
      id: 'etapa-msg-2',
      stageTitle: 'MENSAGEM 2 — SE A PESSOA RESPONDER',
      description: 'Gatilho: Quando responderem à primeira mensagem.',
      steps: [
        {
          id: 'msg-step-2',
          title: 'Mensagem 2 — Se a pessoa responder',
          condition: 'Quando responderem à primeira mensagem.',
          message: `Obrigado! É com você mesmo que posso falar sobre essa parte ou teria outra pessoa responsável?`,
          tip: 'Quando responderem à primeira mensagem.',
          format: 'texto',
        },
      ],
    },
    {
      id: 'etapa-msg-3',
      stageTitle: 'MENSAGEM 3 — SE ESTIVER FALANDO COM O RESPONSÁVEL',
      description: 'Gatilho: Quando confirmarem que é a pessoa responsável.',
      steps: [
        {
          id: 'msg-step-3',
          title: 'Mensagem 3 — Se estiver falando com o responsável',
          condition: 'Quando confirmarem que é a pessoa responsável.',
          message: `Prazer! Então, eu trabalho com a presença digital das empresas, principalmente com sites profissionais e a presença delas no Google.

Queria te perguntar uma coisa: hoje vocês conseguem receber contatos de clientes pelo Google ou a maior parte chega por indicação e redes sociais?`,
          tip: 'Quando confirmarem que é a pessoa responsável.',
          format: 'texto',
        },
      ],
    },
    {
      id: 'etapa-msg-4',
      stageTitle: 'MENSAGEM 4 — ENTENDER A ESTRUTURA ATUAL',
      description: 'Gatilho: Depois que a pessoa responder.',
      steps: [
        {
          id: 'msg-step-4',
          title: 'Mensagem 4 — Entender a estrutura atual',
          condition: 'Depois que a pessoa responder.',
          message: `Entendi! E vocês já têm um site próprio para apresentar os projetos e serviços de vocês ou trabalham mais com o Instagram e o perfil da empresa no Google?`,
          tip: 'Depois que a pessoa responder.',
          format: 'texto',
        },
      ],
    },
    {
      id: 'etapa-msg-5',
      stageTitle: 'MENSAGEM 5 — INVESTIGAR UMA OPORTUNIDADE',
      description: 'Gatilho: Quando fizer sentido continuar a conversa.',
      steps: [
        {
          id: 'msg-step-5',
          title: 'Mensagem 5 — Investigar uma oportunidade',
          condition: 'Quando fizer sentido continuar a conversa.',
          message: `Legal! Pergunto porque, quando alguém está pesquisando por {nicho}, ter informações claras sobre a empresa, os serviços e como solicitar um orçamento pode ajudar bastante na decisão.

Vocês estão satisfeitos com a forma como a empresa aparece hoje na internet?`,
          tip: 'Quando fizer sentido continuar a conversa.',
          format: 'texto',
        },
      ],
    },
    {
      id: 'etapa-msg-6',
      stageTitle: 'MENSAGEM 6 — CONVIDAR PARA A REUNIÃO',
      description: 'Gatilho: Quando houver abertura e interesse na conversa.',
      steps: [
        {
          id: 'msg-step-6',
          title: 'Mensagem 6 — Convidar para a reunião',
          condition: 'Quando houver abertura e interesse na conversa.',
          message: `Entendi! Olha, a ideia do meu contato é justamente essa.

Eu queria fazer uma análise rápida da presença digital de vocês e mostrar alguns pontos que podem ser melhorados, caso existam oportunidades.

Aí consigo entender melhor o que vocês precisam e explicar como a Kaizen Visual poderia ajudar.

Seria uma conversa rápida, de uns 15 minutos. Você teria disponibilidade amanhã ou em algum outro dia desta semana?`,
          tip: 'Quando houver abertura e interesse na conversa.',
          format: 'texto',
        },
      ],
    },
  ],
};

// Aliases for backwards compatibility with any legacy references
export const SCRIPT_1_MOCKUP = SCRIPT_MENSAGEM;
export const SCRIPT_2_VALIDACAO_PROPOSTA = SCRIPT_MENSAGEM;
export const SCRIPT_2_DIAGNOSTICO_GOOGLE = SCRIPT_MENSAGEM;
export const SCRIPT_3_COLD_CALL = SCRIPT_LIGACAO;
export const SCRIPT_NUTRICIONISTA = SCRIPT_LIGACAO;
export const SCRIPT_NUTRICIONISTA_MENSAGENS = SCRIPT_MENSAGEM;
  id: 'script1',
  title: 'Script 1 — Método Mockup (Prévia de Site)',
  subtitle: 'Contato → Confiança → Permissão → Mockup → Opinião → Interesse → Proposta → Preço',
  description: 'Gera impacto e confiança antes de vender. O cliente sente que você realmente olhou para o negócio dele.',
  category: 'Método Simula / Prévia Pronta',
  goldenRule: {
    order: 'Contato → confiança → permissão → mockup → opinião → interesse → proposta → preço',
    primaryGoal: 'O primeiro objetivo NÃO é vender o site. É fazer a pessoa pensar: "Esse cara realmente olhou nossa clínica e fez alguma coisa específica para a gente."',
    insight: 'Depois do mockup, a conversa passa a ser sobre o que você criou — e não simplesmente sobre alguém tentando vender um site.',
  },
  structure: {
    hook: 'Olá, tudo bem? Esse é o WhatsApp da {Empresa}?',
    problem: 'Visual atual não mostra com clareza serviços, localização e agendamento rápido.',
    solution: 'Prévia interativa exclusiva feita pensando especificamente na clínica ({LinkMockup}).',
    cta: 'Pergunta de baixo atrito: "Posso te mostrar?"',
  },
  template: `Olá, tudo bem? Esse é o WhatsApp da {Empresa}?`,
  followUp1: `Oi! Conseguiu dar uma olhada na prévia que te mandei?

Queria muito saber o que você achou da ideia para a [NOME DA CLÍNICA].`,
  followUp2: `Oi, [NOME]! Passando só para finalizar por aqui.

Eu montei essa prévia pensando especificamente na [NOME DA CLÍNICA] e queria pelo menos saber se a ideia fez sentido para vocês.

Gostou da proposta?`,
  followUp3: `Oi, [NOME].

Vou ser direto para não ficar insistindo.

A prévia da [NOME DA CLÍNICA] continua disponível aqui. Caso vocês tenham interesse em desenvolver algo nesse formato, posso te explicar como funciona e o prazo de até 72h para entrega.

Faz sentido conversarmos sobre isso ou não é uma prioridade para vocês no momento?`,
  objections: [
    {
      id: 'obj-ja-tem-equipe',
      trigger: '“Agradecemos o contato, mas já temos uma equipe responsável por isso.”',
      title: 'Objeção: "Já temos equipe responsável por isso"',
      response: `Sem problema! Entendo perfeitamente.

Na verdade, não entrei em contato para substituir a equipe de vocês.

Eu fiz uma prévia específica da clínica e queria apenas mostrar como poderia ficar. Inclusive, pode servir até como uma referência ou ideia para vocês aproveitarem internamente.

Posso te enviar? É rapidinho e sem compromisso.

---
👉 SE RESPONDER “PODE ENVIAR”:
Perfeito! Vou te mandar.

🔗 {linkMockup}

Montei pensando especificamente na clínica de vocês, então não é um modelo genérico.

Depois me fala o que achou. Se fizer sentido para vocês, conversamos melhor sobre como poderia ser desenvolvido.`,
    },
    {
      id: 'obj-caro',
      trigger: 'Está caro / Não tenho verba',
      title: 'Se a pessoa dizer: "Está caro"',
      response: `Entendo.

Nesse caso, posso te falar uma condição que estou usando para algumas empresas que estou prospectando agora.

Estou com uma condição promocional de R$ 397 para o desenvolvimento do site, justamente para fechar alguns projetos dessa nova rodada.

A estrutura continua sendo feita especificamente para a clínica e a entrega também fica em até 72 horas após recebermos as informações necessárias.`,
    },
    {
      id: 'obj-secretaria',
      trigger: 'Caso seja a recepção / secretária',
      title: 'Se for a secretária respondendo',
      response: `Perfeito! É rapidinho mesmo.

Eu fiz essa prévia pensando especificamente na clínica e queria mostrar para vocês. Se fizer sentido, vocês podem encaminhar para o responsável.

Posso te mandar?`,
    },
  ],
  stages: [
    {
      id: 'etapa-1',
      stageTitle: 'ETAPA 1 — PRIMEIRO CONTATO',
      description: 'Validação do contato e permissão para apresentar a prévia criada.',
      steps: [
        {
          id: 'etapa-1-msg-1',
          title: 'Mensagem 1 — Abertura (Validação)',
          condition: 'Primeiro envio para abrir a conversa',
          message: `Olá, tudo bem? Esse é o WhatsApp da {Empresa}?`,
          tip: 'Mensagem curta e inocente que quase todo mundo responde para confirmar se é a empresa.',
        },
        {
          id: 'etapa-1-sim',
          title: 'Se responder que sim',
          condition: 'Quando confirmarem que é da empresa',
          message: `Perfeito! Meu nome é {SeuNome}, trabalho com criação de sites para negócios locais.

Eu estava pesquisando algumas clínicas de {Cidade} e encontrei a {Empresa}. Vi o trabalho de vocês e achei bem interessante.

Inclusive, eu fiz uma prévia de como a clínica poderia ficar com um site próprio, mostrando os serviços, informações e formas de contato.

Posso te mostrar?`,
          tip: 'Aqui você elogia e pede permissão sem tentar vender nada ainda.',
        },
        {
          id: 'etapa-1-secretaria',
          title: 'Se for a secretária / recepção',
          condition: 'Caso a pessoa diga que é da recepção/secretária',
          message: `Perfeito! É rapidinho mesmo.

Eu fiz essa prévia pensando especificamente na clínica e queria mostrar para vocês. Se fizer sentido, vocês podem encaminhar para o responsável.

Posso te mandar?`,
          tip: 'Deixa a secretária confortável sabendo que não terá custo nem compromisso para ela.',
        },
        {
          id: 'etapa-1-ja-tem-equipe',
          title: 'Se disserem: "Já temos uma equipe responsável por isso"',
          condition: 'Quando responderem que já têm equipe, agência ou profissional interno',
          message: `Sem problema! Entendo perfeitamente.

Na verdade, não entrei em contato para substituir a equipe de vocês.

Eu fiz uma prévia específica da clínica e queria apenas mostrar como poderia ficar. Inclusive, pode servir até como uma referência ou ideia para vocês aproveitarem internamente.

Posso te enviar? É rapidinho e sem compromisso.`,
          tip: 'Não dispute espaço com a equipe atual. Posicione a prévia como ideia e cortesia sem compromisso.',
        },
        {
          id: 'etapa-1-followup-1',
          title: 'Se não responder — Follow-up 1',
          condition: 'Enviar 24h a 48h após a primeira mensagem sem retorno',
          message: `Oi! Passando só para não deixar minha mensagem perdida por aqui 😅

Eu fiz uma prévia da {Empresa} justamente porque encontrei vocês durante uma pesquisa de clínicas da região.

Não é compromisso de compra. Só queria mostrar o que montei para vocês.

Posso te enviar?`,
          tip: 'Quebra o medo de ser tentativa forçada de venda.',
        },
        {
          id: 'etapa-1-followup-2',
          title: 'Se ainda não responder — Follow-up 2 direto',
          condition: 'Enviar após 48h sem resposta do follow-up 1',
          message: `Oi, {NomeContato}. Vou ser direto para não tomar seu tempo.

Eu montei uma prévia do site da {Empresa} e já está pronta para te mostrar.

Se quiser ver, me responde só com “pode enviar” que eu mando aqui.`,
          tip: 'Reduz o atrito ao máximo pedindo apenas 2 palavras de resposta.',
        },
      ],
    },
    {
      id: 'etapa-2',
      stageTitle: 'ETAPA 2 — A PESSOA RESPONDE “PODE MOSTRAR”',
      description: 'Envio da demonstração personalizada com direcionamento claro.',
      steps: [
        {
          id: 'etapa-2-envio',
          title: 'Envio do Mockup / Vídeo da Prévia',
          condition: 'Assim que responderem que pode enviar',
          message: `Perfeito! Vou te mandar.

🔗 {LinkMockup}

Montei pensando especificamente na clínica de vocês, então não é um modelo genérico.

A ideia foi deixar o paciente encontrar de forma rápida:

serviços + informações da clínica + localização + contato/agendamento.

Dá uma olhada e me fala o que você achou.`,
          tip: 'Coloque o link ou vídeo da prévia no lugar de {LinkMockup}.',
        },
        {
          id: 'etapa-2-secretaria',
          title: 'Se for a secretária (Complemento)',
          condition: 'Pode acrescentar caso esteja falando com a secretária',
          message: `Se puder, depois me diz o que vocês acharam e, caso faça sentido, você pode mostrar para o responsável também.`,
          tip: 'Estimula a secretária a compartilhar internamente com o doutor(a) ou dono.',
        },
        {
          id: 'etapa-2-envio-pos-equipe',
          title: 'Se responder “Pode enviar” (Pós-objeção de equipe)',
          condition: 'Quando autorizarem o envio após você quebrar a objeção de equipe',
          message: `Perfeito! Vou te mandar.

🔗 {LinkMockup}

Montei pensando especificamente na clínica de vocês, então não é um modelo genérico.

Depois me fala o que achou. Se fizer sentido para vocês, conversamos melhor sobre como poderia ser desenvolvido.`,
          tip: 'Apresenta a prévia como ideia e referência sem forçar venda.',
        },
      ],
    },
    {
      id: 'etapa-followup-mockup',
      stageTitle: 'ETAPA 3 — FOLLOW-UPS APÓS ENVIAR O MOCKUP (SE NÃO RESPONDEREM)',
      description: 'Sequência de 3 toques estratégicos após o envio da prévia/mockup caso o lead não responda.',
      steps: [
        {
          id: 'etapa-mockup-fu-1',
          title: 'Follow-up 1 — Após Enviar o Mockup (Mandar à tarde)',
          condition: 'Enviar à tarde no mesmo dia (ou algumas horas depois de enviar a imagem/link da prévia)',
          message: `Oi! Conseguiu dar uma olhada na prévia que te mandei?

Queria muito saber o que você achou da ideia para a [NOME DA CLÍNICA].`,
          tip: '1º Toque: Envie à tarde. Quebra o silêncio de forma amigável e traz a prévia para o topo do WhatsApp.',
        },
        {
          id: 'etapa-mockup-fu-2',
          title: 'Follow-up 2 — Se Ainda Não Responder (Depois de 24h)',
          condition: 'Enviar após 24 horas sem retorno do mockup e do primeiro follow-up',
          message: `Oi, [NOME]! Passando só para finalizar por aqui.

Eu montei essa prévia pensando especificamente na [NOME DA CLÍNICA] e queria pelo menos saber se a ideia fez sentido para vocês.

Gostou da proposta?`,
          tip: '2º Toque: Envie após 24h. Mostra dedicação personalizada e faz a pergunta decisiva: "Gostou da proposta?".',
        },
        {
          id: 'etapa-mockup-fu-3',
          title: 'Follow-up 3 — Último Follow-up Mais Direto (Depois de 48h)',
          condition: 'Enviar após 48 horas — postura desapegada, objetiva e profissional',
          message: `Oi, [NOME].

Vou ser direto para não ficar insistindo.

A prévia da [NOME DA CLÍNICA] continua disponível aqui. Caso vocês tenham interesse em desenvolver algo nesse formato, posso te explicar como funciona e o prazo de até 72h para entrega.

Faz sentido conversarmos sobre isso ou não é uma prioridade para vocês no momento?`,
          tip: '3º Toque: Envie após 48h. Técnica de Break-Up: reforça entrega em até 72h e pergunta se é prioridade ou não.',
        },
      ],
    },
    {
      id: 'etapa-3',
      stageTitle: 'ETAPA 4 — DEPOIS QUE ELA VISUALIZAR E RESPONDER',
      description: 'Pergunta chave de opinião para validar o interesse real.',
      steps: [
        {
          id: 'etapa-3-pergunta',
          title: 'Pergunta de Validação / Sentido',
          condition: 'Após o lead visualizar o mockup ou vídeo',
          message: `Queria saber principalmente uma coisa:

Você acha que um site nesse formato faria sentido para a clínica de vocês?`,
          tip: 'Não pergunte se vai comprar. Pergunte se faz sentido!',
        },
        {
          id: 'etapa-3-secretaria',
          title: 'Se a secretária demonstrar interesse',
          condition: 'Caso a secretária diga que achou bonito ou interessante',
          message: `Legal! Caso vocês tenham interesse, eu consigo explicar direitinho como funciona e também passar para o responsável.`,
          tip: 'Ponte direta para falar com quem tem o poder de decisão.',
        },
      ],
    },
    {
      id: 'etapa-4',
      stageTitle: 'ETAPA 5 — PROPOSTA & FECHAMENTO',
      description: 'Apresentação do investimento e quebra imediata de objeção de preço.',
      steps: [
        {
          id: 'etapa-4-proposta',
          title: 'Apresentação da Proposta (R$ 597)',
          condition: 'Quando o responsável disser que gostou e quer saber como funciona',
          message: `Que bom que gostou.

Eu consigo desenvolver essa versão completa para vocês, deixando tudo personalizado com a identidade da clínica, serviços, fotos, informações e botão de WhatsApp/agendamento.

O investimento normal para fazer o projeto completo é de R$ 597.

A entrega é feita em até 72 horas após o envio das informações necessárias para o desenvolvimento.

No cartão, pode ser parcelado.
No Pix, podemos fazer 50% no início e 50% na entrega.`,
          tip: 'Transmite clareza de prazo (72h) e facilidade de pagamento (Pix 50/50).',
        },
        {
          id: 'etapa-4-caro',
          title: 'Se a pessoa dizer “ESTÁ CARO” (Condição R$ 397)',
          condition: 'Caso demonstrem objeção de preço ou hesitação',
          message: `Entendo.

Nesse caso, posso te falar uma condição que estou usando para algumas empresas que estou prospectando agora.

Estou com uma condição promocional de R$ 397 para o desenvolvimento do site, justamente para fechar alguns projetos dessa nova rodada.

A estrutura continua sendo feita especificamente para a clínica e a entrega também fica em até 72 horas após recebermos as informações necessárias.`,
          tip: 'Gera alívio financeiro mantendo a entrega rápida e profissional.',
        },
      ],
    },
  ],
};

export const SCRIPT_2_VALIDACAO_PROPOSTA: ScriptDefinition = {
  id: 'script2',
  title: 'Script 2 — Validação & Proposta Direta (Estrutura Validada)',
  subtitle: '10 Etapas: Abertura → Elogio → Falta do Site → Permissão → Prévia MVP → Jornada → Validação → Proposta R$ 697 → Fechamento → Plano B R$ 397 → Upsell GMB',
  description: 'Estrutura validada em 10 etapas estratégicas para conduzir o lead com micro-autorizações no WhatsApp, ancoragem de R$ 997 por R$ 697, plano B de R$ 397 e upsell de Google Meu Negócio.',
  category: 'Proposta Direta & Ancoragem de Valor',
  goldenRule: {
    order: 'Abertura → Elogio sincero → Diagnóstico direto → Permissão → Envio da prévia → Jornada do cliente → Validação na rotina → Permissão comercial → Oferta R$ 697 (ancorada em R$ 997) → Fechamento Pix/Cartão → Plano B R$ 397 → Upsell Google',
    primaryGoal: 'Conduzir o lead com micro-autorizações até apresentar a proposta ancorada de R$ 997 por R$ 697 com entrega em 72h.',
    insight: 'Nunca envie a proposta comercial sem antes validar a rotina do lead e pedir permissão explícita para apresentar os valores.',
  },
  structure: {
    hook: 'Boa tarde, tudo bem? Esse número é da {Empresa}?',
    problem: 'Tava olhando vocês na internet e percebi que vocês não têm um site, principalmente quando pesquiso no Google Maps. E isso pode estar fazendo vocês perderem de fechar muitos {ServicosNicho}!',
    solution: 'Essa é a prévia que preparei pensando no seu trabalho e na experiência de quem encontra você pelo Google ou Instagram. {LinkMockup}',
    cta: 'Posso te explicar agora exatamente o que eu entrego e como funciona o investimento?',
  },
  template: `Boa tarde, tudo bem? Esse número é da {Empresa}?`,
  followUp1: `Oi! Conseguiu dar uma olhada na prévia que te mandei da {Empresa}?

Queria muito saber o que você achou da estrutura e se faria sentido para a sua rotina.`,
  followUp2: `Oi, {NomeContato}! Passando só para não deixar nossa conversa perdida por aqui.

Preparei aquela prévia pensando especificamente na {Empresa} para atrair novos clientes pelo Google e WhatsApp.

O que você achou da proposta?`,
  followUp3: `Oi, {NomeContato}.

Vou ser direto para não ficar insistindo.

A prévia da {Empresa} continua disponível aqui com a entrega em até 72 horas. Melhorar a presença digital e fechar novos clientes de {Nicho} é uma prioridade para vocês agora ou prefere que eu encerre por aqui?`,
  objections: [
    {
      id: 'obj2-plano-b-preco',
      trigger: 'Está caro / Pesou no orçamento',
      title: 'Objeção de Preço → Plano B (R$ 397)',
      response: `Entendi! Tenho uma condição especial que consigo abrir para alguns projetos desta rodada: realizo essa mesma estrutura completa por R$ 397 no Pix ou Cartão com o mesmo prazo de 72 horas. Nesse formato, faria sentido para começarmos?`,
    },
    {
      id: 'obj2-ja-tem-equipe',
      trigger: 'Já temos equipe / cuidamos disso internamente',
      title: 'Objeção: "Já temos equipe responsável"',
      response: `Sem problema! Entendo perfeitamente.

Na verdade, não entrei em contato para substituir a equipe de vocês.

Eu fiz essa prévia específica da {Empresa} e queria apenas mostrar como poderia ficar na prática. Inclusive, pode servir até como uma referência ou ideia para vocês aproveitarem internamente.

Posso te enviar? É rapidinho e sem compromisso.`,
    },
    {
      id: 'obj2-preciso-pensar',
      trigger: 'Preciso pensar / vou falar com meu sócio',
      title: 'Objeção: "Preciso pensar / falar com sócio"',
      response: `Perfeito! Só para eu entender melhor: ficou alguma dúvida sobre o que está incluso no projeto de 72h ou é mais uma questão de decidir o momento de investir?

Posso deixar todas as informações e o link da prévia organizados aqui para você avaliar com calma.`,
    },
    {
      id: 'obj2-upsell-gmb',
      trigger: 'Como funciona o Google Meu Negócio pós-venda?',
      title: 'Dúvida / Upsell Google Meu Negócio (R$ 250 + R$ 200/mês)',
      response: `Para quem já é cliente do site, eu faço a estruturação e otimização inicial do Perfil do Google por R$ 250 e a manutenção/atualização mensal por R$ 200/mês.

Quer que a gente já ative essa parte também para começar a atrair mais clientes do Google a partir dessa semana?`,
    },
  ],
  stages: [
    {
      id: 's2-etapa-1',
      stageTitle: '1. ABERTURA E CONFIRMAÇÃO',
      description: 'Envie no WhatsApp da empresa e aguarde confirmar.',
      steps: [
        {
          id: 's2-step-1',
          title: '1️⃣ Abertura e Confirmação',
          condition: 'Envie no WhatsApp da empresa',
          format: 'texto',
          message: `Boa tarde, tudo bem? Esse número é da {Empresa}?`,
          tip: 'Envie no WhatsApp da empresa e aguarde o lead responder e confirmar antes de prosseguir.',
        },
      ],
    },
    {
      id: 's2-etapa-2',
      stageTitle: '2. SINAL PERCEBIDO (ELOGIO SINCERO)',
      description: 'Elogio sincero e validação do espaço físico ou trabalho.',
      steps: [
        {
          id: 's2-step-2',
          title: '2️⃣ Sinal Percebido (Elogio Sincero)',
          condition: 'Aguarde o lead responder e confirmar',
          format: 'texto',
          message: `Tava olhando o Instagram de vocês e também encontrei a {Empresa} no Google Maps. Achei muito legal o espaço e o projeto de vocês! 👏`,
          tip: 'Aguarde o lead responder e agradecer.',
        },
      ],
    },
    {
      id: 's2-etapa-3',
      stageTitle: '3. DIAGNÓSTICO DIRETO (PONTO CEGO E FALTA DO SITE)',
      description: 'Apresentação do ponto cego e oportunidades perdidas nas buscas.',
      steps: [
        {
          id: 's2-step-3',
          title: '3️⃣ Diagnóstico Direto (Ponto Cego e Falta do Site)',
          condition: 'Aguarde o lead responder e agradecer',
          format: 'texto',
          message: `Na verdade queria apresentar um projeto para vocês. Tava olhando vocês na internet e percebi que vocês não têm um site, principalmente quando pesquiso no Google Maps. E isso pode estar fazendo vocês perderem de fechar muitos {ServicosNicho}!`,
          tip: 'Destaca a perda de clientes reais no Google Maps sem agredir ou acusar o lead.',
        },
      ],
    },
    {
      id: 's2-etapa-4',
      stageTitle: '4. PEDIDO DE PERMISSÃO (FILTRO DE INTERESSE)',
      description: 'Filtro de autorização antes de mandar o link ou print da prévia.',
      steps: [
        {
          id: 's2-step-4',
          title: '4️⃣ Pedido de Permissão (Filtro de Interesse)',
          condition: 'Pedir permissão de envio',
          format: 'texto',
          message: `Tô com um projeto que pode ajudar vocês com isso, posso mandar aqui?`,
          tip: 'Aguarde a autorização dele antes de enviar a prévia.',
        },
      ],
    },
    {
      id: 's2-etapa-5',
      stageTitle: '5. ENVIO DA PRÉVIA (MVP)',
      description: 'Envio da demonstração visual personalizada.',
      steps: [
        {
          id: 's2-step-5',
          title: '5️⃣ Envio da Prévia (MVP)',
          condition: 'Assim que ele autorizar',
          format: 'texto',
          message: `Essa é a prévia que preparei pensando no seu trabalho e na experiência de quem encontra você pelo Google ou Instagram. {LinkMockup}`,
          tip: 'Envie o link do protótipo ou um print completo da tela com a legenda acima.',
        },
      ],
    },
    {
      id: 's2-etapa-6',
      stageTitle: '6. EXPLICAÇÃO DA JORNADA DO CLIENTE',
      description: 'Explicação detalhada da experiência do visitante até o agendamento.',
      steps: [
        {
          id: 's2-step-6',
          title: '6️⃣ Explicação da Jornada do Cliente',
          condition: 'Aguarde o WhatsApp marcar a mensagem como visualizada antes de enviar',
          format: 'texto',
          message: `Aqui eu pensei justamente na jornada do cliente. Primeiro ele entende o padrão do trabalho de vocês, depois conhece os {ServicosNicho} e as informações do atendimento e, no final, encontra o caminho para solicitar o agendamento direto pelo WhatsApp.

A ideia é deixar tudo mais claro e profissional e facilitar a conversão desse visitante em contato. O que você achou da estrutura?`,
          tip: 'Aguarde o WhatsApp marcar a mensagem como visualizada antes de enviar.',
        },
      ],
    },
    {
      id: 's2-etapa-7',
      stageTitle: '7. VALIDAÇÃO NA ROTINA DO NEGÓCIO',
      description: 'Pergunta crucial para o lead confirmar que a estrutura resolve a dor.',
      steps: [
        {
          id: 's2-step-7',
          title: '7️⃣ Validação na Rotina do Negócio',
          condition: 'Quando o lead responder que gostou',
          format: 'texto',
          message: `Que bom! E pensando principalmente nessa parte de facilitar o caminho do cliente até o agendamento, você acha que uma estrutura assim realmente faria sentido para a sua rotina?`,
          tip: 'Faz o lead verbalizar o valor e a aplicabilidade da solução na rotina dele.',
        },
      ],
    },
    {
      id: 's2-etapa-8',
      stageTitle: '8. PERMISSÃO PARA A OFERTA COMERCIAL',
      description: 'Micro-compromisso antes de apresentar o valor.',
      steps: [
        {
          id: 's2-step-8',
          title: '8️⃣ Permissão para a Oferta Comercial',
          condition: 'Quando ele disser que sim',
          format: 'texto',
          message: `Perfeito! Foi exatamente pensando nessa necessidade que eu montei a proposta. Posso te explicar agora exatamente o que eu entrego e como funciona o investimento?`,
          tip: 'Nunca pule esta etapa: a permissão desarma qualquer postura defensiva.',
        },
      ],
    },
    {
      id: 's2-etapa-9',
      stageTitle: '9. APRESENTAÇÃO DA OFERTA E ANCORAGEM DE PREÇO (APENAS SITE)',
      description: 'Ancoragem forte de R$ 997 por R$ 697 em até 72 horas.',
      steps: [
        {
          id: 's2-step-9',
          title: '9️⃣ Apresentação da Oferta e Ancoragem de Preço (Apenas Site)',
          condition: 'Assim que ele autorizar',
          format: 'texto',
          message: `O projeto é personalizado para a {Empresa} e inclui toda a estrutura: o site personalizado com a identidade de vocês, apresentação dos serviços, localização e botão de solicitação de agendamento direto pelo WhatsApp.

Faço toda essa implementação com prazo de entrega de até 72 horas após receber os materiais necessários.

Para desenvolver toda essa estrutura, o valor normal do projeto é de R$ 997. Mas estou fechando uma rodada específica para empresas de {Nicho} e, nessa condição, consigo fazer o projeto completo por R$ 697.`,
          tip: 'Ancoragem psicológica de R$ 997 reduzida para R$ 697 com entrega em 72h.',
        },
      ],
    },
    {
      id: 's2-etapa-10',
      stageTitle: '10. FECHAMENTO E CONDIÇÕES DE PAGAMENTO',
      description: 'Condições de pagamento facilitadas e pergunta de viabilidade.',
      steps: [
        {
          id: 's2-step-10',
          title: '🔟 Fechamento e Condições de Pagamento',
          condition: 'Apresentar formas de pagamento',
          format: 'texto',
          message: `No Pix, podemos fazer 50% para iniciar e 50% na entrega. No cartão, em até 12 vezes.

Essa condição fica viável para você?`,
          tip: 'Pergunta direta e sem atrito para fechar o acordo.',
        },
      ],
    },
    {
      id: 's2-etapa-11',
      stageTitle: '11. PLANO B — DESCONTO PROMOCIONAL (SE A OBJEÇÃO FOR PREÇO)',
      description: 'Condição promocional de R$ 397 para fechar na hora.',
      steps: [
        {
          id: 's2-step-11',
          title: '⚠️ Plano B — Desconto Promocional (Se a objeção for Preço)',
          condition: 'Se o cliente disser que o investimento pesou no orçamento',
          format: 'texto',
          message: `Entendi! Tenho uma condição especial que consigo abrir para alguns projetos desta rodada: realizo essa mesma estrutura completa por R$ 397 no Pix ou Cartão com o mesmo prazo de 72 horas. Nesse formato, faria sentido para começarmos?`,
          tip: 'Último recurso se o preço for a única barreira de fechamento.',
        },
      ],
    },
    {
      id: 's2-etapa-12',
      stageTitle: '12. UPSELL DE PÓS-VENDA — GOOGLE MEU NEGÓCIO',
      description: 'Venda de esteira no momento da entrega do site.',
      steps: [
        {
          id: 's2-step-12',
          title: '🚀 Upsell de Pós-Venda — Google Meu Negócio (Na entrega do site)',
          condition: 'Assim que o site estiver 100% aprovado e no ar',
          format: 'texto',
          message: `Seu site tá 100% finalizado e no ar! Ficou excelente.

Agora que a estrutura tá pronta para converter visitantes em clientes, o próximo passo natural é garantir que o Google mostre a {Empresa} no topo das buscas quando alguém pesquisar por {Nicho} na região.

Para quem já é cliente do site, eu faço a estruturação e otimização inicial do Perfil do Google por R$ 250 e a manutenção/atualização mensal por R$ 200/mês.

Quer que a gente já ative essa parte também para começar a atrair mais clientes do Google a partir dessa semana?`,
          tip: 'Momento de ouro (Pós-Venda): cliente feliz com o site fechando otimização GMB (R$ 250 setup + R$ 200/mês MRR).',
        },
      ],
    },
  ],
};

export const SCRIPT_2_DIAGNOSTICO_GOOGLE = SCRIPT_2_VALIDACAO_PROPOSTA;

export const SCRIPT_3_COLD_CALL: ScriptDefinition = {
  id: 'script3',
  title: 'Script 3 — Cold Call (Ligação Telefônica)',
  subtitle: 'Ligação → Secretária → Pedir Responsável → Descobrir Horário/Contato → Apresentar Posição Google → WhatsApp / Reunião',
  description: 'Roteiro de prospecção por ligação telefônica (Cold Call) desenhado para passar da secretária com naturalidade e conectar com o tomador de decisão da clínica.',
  category: 'Cold Call Telefônica',
  goldenRule: {
    order: 'Ligação → Secretária → Pedir responsável → Descobrir melhor horário/contato → Tentar falar com responsável → Apresentar oportunidade → Levar para WhatsApp/reunião',
    primaryGoal: 'A secretária não é uma barreira: ela precisa entender apenas "Quem é você + por que está ligando + que é rápido + para quem precisa passar".',
    insight: 'Ao falar com o responsável, mostre a oportunidade concreta encontrada no Google (ex: posição nas buscas vs concorrentes) e converta em envio de análise visual no WhatsApp ou call de 10 min.',
  },
  structure: {
    hook: 'Olá, boa tarde! Tudo bem? Meu nome é {SeuNome}. Eu poderia falar com o responsável pela clínica, por favor?',
    problem: 'Fui verificar como vocês estão aparecendo no Google para algumas pesquisas relacionadas aos serviços da clínica e encontrei alguns pontos que achei interessantes. Por exemplo, em uma das buscas, vocês aparecem por volta da [Xª] posição, e existem outras clínicas aparecendo antes.',
    solution: 'Fiz uma análise mais completa disso e queria te mostrar o que encontrei de forma bem visual.',
    cta: 'Posso te mandar no WhatsApp e, se fizer sentido, marcamos uma conversa rápida de uns 10 minutos?',
  },
  template: `Olá, boa tarde! Tudo bem? Meu nome é {SeuNome}. Eu poderia falar com o responsável pela clínica, por favor?`,
  followUp1: `Oi, [NOME]. Passando para retomar aquela conversa rápida por telefone sobre a análise da [NOME DA CLÍNICA] no Google. Conseguiu dar uma olhada no material que enviei?`,
  followUp2: `Oi, [NOME]. Vou ser bem direto para não tomar seu tempo. Queria te mostrar rapidamente o diagnóstico do Google da [NOME DA CLÍNICA]. São só 10 minutos. Qual horário fica melhor para você?`,
  objections: [
    {
      id: 'obj3-sobre-o-que',
      trigger: 'Sobre o que é a ligação?',
      title: 'Se a secretária perguntar: "Sobre o que?"',
      response: `É sobre uma análise que fiz da presença digital da clínica e queria explicar rapidinho para o responsável.

É uma conversa bem rápida mesmo.`,
    },
    {
      id: 'obj3-nao-disponivel',
      trigger: 'Ele(a) não está disponível no momento',
      title: 'Se ela disser: "Ele(a) não está disponível"',
      response: `Tudo bem, sem problema.

Você sabe me dizer qual horário costuma ser melhor para eu conseguir falar com ele(a)?

(Se ela informar o horário):
Perfeito. Então eu posso retornar nesse horário.

E, caso seja mais fácil, você consegue me passar o melhor contato dele(a) para eu falar diretamente?`,
    },
    {
      id: 'obj3-nao-passa-contato',
      trigger: 'Não posso passar o contato pessoal/direto',
      title: 'Se ela não quiser passar o contato direto',
      response: `Sem problema, tranquilo.

Então me ajuda só com uma coisa:

Qual é o melhor horário para eu ligar novamente e conseguir falar com ele(a)?

E, se preferir, eu também posso deixar meu contato com você para encaminhar.`,
    },
    {
      id: 'obj3-manda-whats',
      trigger: 'Pode mandar pelo WhatsApp da clínica',
      title: 'Se ela disser: "Pode mandar pelo WhatsApp"',
      response: `Claro.

Pode me passar o melhor WhatsApp para eu enviar?

(Se for o próprio número da ligação):
Perfeito, vou mandar por aqui.

É uma análise rápida que fiz da presença da clínica no Google e queria apresentar ao responsável.

Você consegue encaminhar para ele(a), por favor?`,
    },
    {
      id: 'obj3-pode-mandar-resp',
      trigger: 'Responsável diz: "Pode mandar"',
      title: 'Se o responsável disser: "Pode mandar"',
      response: `Perfeito.

Vou te mandar agora.

Depois que você olhar, me fala o que achou e a gente marca um horário para eu te explicar os pontos que encontrei.`,
    },
    {
      id: 'obj3-marcar-hora',
      trigger: 'Responsável quer marcar a reunião na hora',
      title: 'Se ele quiser marcar na hora',
      response: `Perfeito.

Tenho disponibilidade em [HORÁRIO 1] ou [HORÁRIO 2].

Qual fica melhor para você?`,
    },
  ],
  stages: [
    {
      id: 's3-etapa-1',
      stageTitle: 'ETAPA 1 — INÍCIO DA LIGAÇÃO',
      description: 'Abertura profissional, educada e direta ao ponto.',
      steps: [
        {
          id: 's3-msg-abertura',
          title: 'Abertura da Ligação (Você)',
          condition: 'Assim que a recepção ou atendente atender a chamada',
          message: `Olá, boa tarde! Tudo bem?

Meu nome é {SeuNome}.

Eu poderia falar com o responsável pela clínica, por favor?`,
          tip: 'Fale de forma calma, pausada e com tom seguro e natural.',
        },
      ],
    },
    {
      id: 's3-etapa-2',
      stageTitle: 'ETAPA 2 — SE A SECRETÁRIA PERGUNTAR "SOBRE O QUE?"',
      description: 'Resposta simples e intrigante sem entregar proposta de venda antes do tomador de decisão.',
      steps: [
        {
          id: 's3-msg-filtro',
          title: 'Resposta Simples de Curiosidade',
          condition: 'Secretária pergunta o assunto da ligação',
          message: `É sobre uma análise que fiz da presença digital da clínica e queria explicar rapidinho para o responsável.

É uma conversa bem rápida mesmo.`,
          tip: 'Não entre em detalhes técnicos com a recepcionista; mantenha o foco em chegar ao decisor.',
        },
      ],
    },
    {
      id: 's3-etapa-3',
      stageTitle: 'ETAPA 3 — SE ELA DISSER "ELE(A) NÃO ESTÁ DISPONÍVEL"',
      description: 'Descobrir o melhor horário e tentar o contato direto.',
      steps: [
        {
          id: 's3-msg-indisponivel',
          title: 'Descobrir Melhor Horário',
          condition: 'Secretária avisa que o responsável está atendendo ou fora',
          message: `Tudo bem, sem problema.

Você sabe me dizer qual horário costuma ser melhor para eu conseguir falar com ele(a)?`,
          tip: 'Descobre a rotina da clínica para ligar no momento exato em que o doutor(a) está livre.',
        },
        {
          id: 's3-msg-informou-horario',
          title: 'Se ela informar o horário: Pedir Contato Direto',
          condition: 'Secretária forneceu o horário que ele(a) costuma estar livre',
          message: `Perfeito. Então eu posso retornar nesse horário.

E, caso seja mais fácil, você consegue me passar o melhor contato dele(a) para eu falar diretamente?`,
          tip: 'Se passar o número pessoal/direto, seu trabalho fica muito mais fácil nas próximas abordagens.',
        },
      ],
    },
    {
      id: 's3-etapa-4',
      stageTitle: 'ETAPA 4 — SE ELA NÃO QUISER PASSAR O CONTATO',
      description: 'Desarme com respeito e garanta o horário do retorno.',
      steps: [
        {
          id: 's3-msg-sem-contato',
          title: 'Contorno Elegante & Confirmação de Retorno',
          condition: 'Secretária diz que não pode passar número pessoal ou celular',
          message: `Sem problema, tranquilo.

Então me ajuda só com uma coisa:

Qual é o melhor horário para eu ligar novamente e conseguir falar com ele(a)?

E, se preferir, eu também posso deixar meu contato com você para encaminhar.`,
          tip: 'Transmite compreensão imediata e garante permissão para retornar a ligação no horário certo.',
        },
      ],
    },
    {
      id: 's3-etapa-5',
      stageTitle: 'ETAPA 5 — SE ELA DISSER "PODE MANDAR PELO WHATSAPP"',
      description: 'Coleta do número e solicitação para repassar ao decisor.',
      steps: [
        {
          id: 's3-msg-qual-whats',
          title: 'Confirmar o Melhor WhatsApp',
          condition: 'Recepção sugere enviar as informações por mensagem',
          message: `Claro.

Pode me passar o melhor WhatsApp para eu enviar?`,
          tip: 'Valida se é o mesmo telefone da ligação ou um contato exclusivo.',
        },
        {
          id: 's3-msg-proprio-numero',
          title: 'Se disser que é o próprio número da clínica',
          condition: 'O próprio número discado já é o WhatsApp da clínica',
          message: `Perfeito, vou mandar por aqui.

É uma análise rápida que fiz da presença da clínica no Google e queria apresentar ao responsável.

Você consegue encaminhar para ele(a), por favor?`,
          tip: 'Peça o encaminhamento com cortesia profissional.',
        },
      ],
    },
    {
      id: 's3-etapa-6',
      stageTitle: 'ETAPA 6 — SE ELA PASSAR O RESPONSÁVEL',
      description: 'Você está frente a frente na linha com o tomador de decisão.',
      steps: [
        {
          id: 's3-msg-com-responsavel',
          title: 'Apresentação da Análise ao Responsável',
          condition: 'O responsável atendeu a ligação',
          message: `Olá, [NOME], tudo bem?

Aqui é o {SeuNome}.

Prometo ser bem rápido.

Eu estava analisando algumas clínicas da região e encontrei a [NOME DA CLÍNICA].

Fui verificar como vocês estão aparecendo no Google para algumas pesquisas relacionadas aos serviços da clínica e encontrei alguns pontos que achei interessantes.

Por exemplo, em uma das buscas, vocês aparecem por volta da [Xª] posição.

E existem outras clínicas aparecendo antes.

Eu fiz uma análise mais completa disso e queria te mostrar o que encontrei.`,
          tip: 'Mostre o dado concreto da posição sem criticar a clínica, apenas apontando a oportunidade.',
        },
      ],
    },
    {
      id: 's3-etapa-7',
      stageTitle: 'ETAPA 7 — LEVAR PARA O PRÓXIMO PASSO',
      description: 'Convite para apresentação visual no WhatsApp ou reunião de 10 min.',
      steps: [
        {
          id: 's3-msg-proximo-passo',
          title: 'Proposta do Próximo Passo (WhatsApp + Call de 10 min)',
          condition: 'Após apresentar a oportunidade da posição no Google',
          message: `Para não ficar tentando explicar tudo por telefone, eu posso te mostrar isso de forma bem mais visual.

Posso te mandar no WhatsApp e, se fizer sentido, marcamos uma conversa rápida de uns 10 minutos?`,
          tip: 'Facilita o "Sim" porque receber no WhatsApp não exige compromisso pesado imediato.',
        },
      ],
    },
    {
      id: 's3-etapa-8',
      stageTitle: 'ETAPA 8 — SE ELE DISSER "PODE MANDAR"',
      description: 'Fechamento do envio imediato no WhatsApp.',
      steps: [
        {
          id: 's3-msg-pode-mandar',
          title: 'Envio Imediato & Gancho para Conversa',
          condition: 'O responsável concorda em receber o material no WhatsApp',
          message: `Perfeito.

Vou te mandar agora.

Depois que você olhar, me fala o que achou e a gente marca um horário para eu te explicar os pontos que encontrei.`,
          tip: 'Envie logo em seguida no WhatsApp com o diagnóstico ou comparativo visual.',
        },
      ],
    },
    {
      id: 's3-etapa-9',
      stageTitle: 'ETAPA 9 — SE ELE QUISER MARCAR NA HORA',
      description: 'Técnica da dupla alternativa para fechar o horário na agenda.',
      steps: [
        {
          id: 's3-msg-marcar-hora',
          title: 'Oferecer 2 Opções de Horário (Dupla Alternativa)',
          condition: 'O responsável prefere já definir o dia e horário na própria chamada',
          message: `Perfeito.

Tenho disponibilidade em [HORÁRIO 1] ou [HORÁRIO 2].

Qual fica melhor para você?`,
          tip: 'Nunca pergunte "qual dia você pode?". Sempre ofereça duas opções claras (ex: Quinta às 14h ou Sexta às 10h).',
        },
      ],
    },
    {
      id: 's3-etapa-10',
      stageTitle: 'ETAPA 10 — SE A SECRETÁRIA NÃO PASSAR O RESPONSÁVEL, MAS DER UM CAMINHO',
      description: 'Objetivo cumprido: registrar tudo no CRM e agendar o próximo toque.',
      steps: [
        {
          id: 's3-msg-registro-crm',
          title: 'Resultado Válido & Registro no CRM',
          condition: 'Você conseguiu: nome do responsável + melhor horário + contato ou WhatsApp da clínica',
          message: `Nesse cenário, o objetivo já foi cumprido!

Você conseguiu:
• Nome do responsável
• Melhor horário para falar
• Contato ou WhatsApp da clínica

Registre os dados e a data/hora combinada no CRM e faça a próxima abordagem no momento exato combinado.`,
          tip: 'Mova o card para "Primeiro Contato" e adicione uma nota com o horário exato de retorno.',
        },
      ],
    },
  ],
};

export const SCRIPT_NUTRICIONISTA: ScriptDefinition = {
  id: 'script_nutri',
  title: 'Script 1 — Nutricionista | Versão Áudios',
  subtitle: 'Diagnóstico no Google → Problema no Agendamento → Apresentação da Solução → Prévia → Validação → Oferta (R$ 697 / R$ 397)',
  description: 'Roteiro validado em 16 etapas com áudios e textos estratégicos para prospectar, contornar secretárias, apresentar análise real do Google, validar prévia e fechar projetos de site + Perfil da Empresa no Google.',
  category: 'Especialista em Nutrição',
  goldenRule: {
    order: 'Validação → Análise do Google → Caminho do Agendamento → Apresentação da Solução → Prévia → Validação Real → Oferta → Fechamento',
    primaryGoal: 'Mostrar que o problema não é a qualidade do trabalho dela, mas sim a visibilidade digital e o caminho do agendamento, conduzindo naturalmente até a proposta.',
    insight: 'Use texto apenas na mensagem inicial de abertura. As etapas de argumentação, diagnóstico e apresentação da oferta convertem muito mais quando enviadas em áudios profissionais e naturais.',
  },
  structure: {
    hook: 'Olá, tudo bem? Esse é o contato da Dra. [NOME]?',
    problem: 'Perfil aparecendo abaixo nas buscas locais do Google e atrito no agendamento dependendo 100% de conversas longas no WhatsApp.',
    solution: 'Site personalizado com identidade visual, formulário organizado de agendamento e otimização do Perfil da Empresa no Google entregue em até 72h.',
    cta: 'Posso te mostrar o que encontrei? / Quer que eu te mostre a prévia?',
  },
  template: `Olá, tudo bem? Esse é o contato da Dra. [NOME]?`,
  followUp1: `Oi, Dra. [NOME]! Tudo bem?

Conseguiu dar uma olhada na prévia e nos pontos de melhoria que te enviei sobre a sua presença digital?

Queria muito saber a sua opinião sincera sobre a ideia.`,
  followUp2: `Oi, Dra. [NOME]! Passando rapidinho só para saber se você conseguiu avaliar a prévia.

Eu preparei pensando especificamente no seu trabalho para facilitar o caminho dos pacientes até a consulta.

Fez sentido para você?`,
  followUp3: `Oi, Dra. [NOME].

Vou ser direto para não te incomodar.

A estrutura e a condição especial da rodada para nutricionistas continuam disponíveis. Conseguimos entregar todo o projeto e o Google em até 72h.

Faz sentido darmos andamento ou não é uma prioridade para você no momento?`,
  objections: [
    {
      id: 'nutri-obj-caro',
      trigger: 'Objeção: "Está caro"',
      title: 'Objeção: "Está caro" (Não baixe imediatamente)',
      response: `⚠️ Dica: Não baixe o preço imediatamente! Primeiro entenda a real motivação.

🎙️ ÁUDIO 1 (Investigação):
"Entendo. Só para eu entender melhor antes de mexer na proposta: o que pesou mais para você, o investimento ou alguma parte do projeto que você não vê tanta utilidade?"

👉 SE FOR REALMENTE PREÇO (Segunda condição):
🎙️ ÁUDIO 2 (Condição Promocional):
"Entendi. Tenho uma condição que consigo fazer para alguns projetos dessa rodada. Consigo realizar essa mesma estrutura por R$ 397.

O prazo continua em até 72 horas após o recebimento dos materiais necessários.

Nesse formato, faria sentido para você começarmos?"`,
    },
    {
      id: 'nutri-obj-pensar',
      trigger: 'Objeção: "Preciso pensar"',
      title: 'Objeção: "Preciso pensar"',
      response: `🎙️ ÁUDIO:
"Claro, sem problema. Só para eu conseguir entender melhor: ficou alguma dúvida sobre o projeto ou é mais uma questão de decidir o momento de investir?"`,
    },
    {
      id: 'nutri-obj-marido-socio',
      trigger: 'Objeção: "Vou ver com meu marido/sócio"',
      title: 'Objeção: "Vou ver com meu marido / sócio"',
      response: `💬 MENSAGEM / ÁUDIO:
"Perfeito. Posso te deixar todas as informações organizadas por aqui para você encaminhar. Se surgir alguma dúvida sobre o projeto, prazo ou pagamento, pode me chamar."`,
    },
    {
      id: 'nutri-obj-agora-nao',
      trigger: 'Objeção: "Agora não"',
      title: 'Objeção: "Agora não"',
      response: `🎙️ ÁUDIO / MENSAGEM:
"Tranquilo. Você acha que é mais uma questão de momento ou teve alguma parte da proposta que não fez sentido para você?"`,
    },
    {
      id: 'nutri-fechamento-vamos-fazer',
      trigger: 'Fechamento: "Vamos fazer"',
      title: 'Fechamento: "Vamos fazer" (Início Imediato)',
      response: `💬 MENSAGEM:
"Perfeito! Então vamos dar andamento. Vou te passar agora a lista dos materiais que preciso para começar e, assim que eu receber tudo, iniciamos o desenvolvimento. O prazo é de até 72 horas."`,
    },
  ],
  stages: [
    {
      id: 'nutri-etapa-1',
      stageTitle: 'ETAPA 1 — PRIMEIRO CONTATO',
      description: 'Validação do contato direto com a nutricionista.',
      steps: [
        {
          id: 'nutri-etapa-1-msg-inicial',
          title: 'Mensagem Inicial',
          condition: 'Primeiro envio para abrir a conversa',
          format: 'texto',
          message: `Olá, tudo bem? Esse é o contato da Dra. [NOME]?`,
          tip: 'Mensagem em texto simples e direta para confirmar se é a profissional.',
        },
        {
          id: 'nutri-etapa-1-se-sim',
          title: 'Se responder "sim"',
          condition: 'Quando confirmarem o contato',
          format: 'audio',
          message: `Oi, tudo bem? Eu queria falar diretamente com a Dra. [Nome]. É rapidinho. Consigo falar com ela?`,
          tip: 'Grave em áudio com tom calmo, amigável e objetivo.',
        },
      ],
    },
    {
      id: 'nutri-etapa-2',
      stageTitle: 'ETAPA 2 — SE FOR SECRETÁRIA',
      description: 'Como contornar a recepção/secretária com profissionalismo e gerar curiosidade.',
      steps: [
        {
          id: 'nutri-etapa-2-sobre-o-que',
          title: 'Secretária: "Sobre o que seria?"',
          condition: 'Quando a secretária perguntar o motivo do contato',
          format: 'audio',
          message: `Então, eu estou fazendo uma análise de alguns profissionais da área de nutrição aqui em [cidade] e encontrei a Dra. [Nome] pelo Google. Dei uma olhada no posicionamento dela e identifiquei algumas oportunidades que podem ajudar na presença digital e na captação de novos pacientes. Por isso queria mostrar isso diretamente para ela. Consigo falar com ela?`,
          tip: 'Gera autoridade e mostra que não é telemarketing genérico.',
        },
        {
          id: 'nutri-etapa-2-especificamente',
          title: 'Se perguntar especificamente: "O que você encontrou?"',
          condition: 'Se a secretária insistir em detalhes antes de passar o contato',
          format: 'audio',
          message: `É principalmente sobre como uma pessoa encontra a clínica no Google, conhece o trabalho da profissional e chega até o contato e o agendamento. Inclusive eu preparei uma prévia pensando especificamente nela. Posso explicar diretamente para ela?`,
          tip: 'Destacar que você preparou uma prévia específica para a profissional abre portas.',
        },
      ],
    },
    {
      id: 'nutri-etapa-3',
      stageTitle: 'ETAPA 3 — SE FOR A PRÓPRIA NUTRICIONISTA',
      description: 'Abordagem direta com a nutricionista elogiando e gerando permissão para apresentar.',
      steps: [
        {
          id: 'nutri-etapa-3-sou-eu',
          title: 'Ela: "Sou eu. O que deseja?"',
          condition: 'Quando a própria nutricionista atender',
          format: 'audio',
          message: `Oi, Dra. [Nome], tudo bem? Eu estava analisando alguns profissionais de nutrição aqui em [cidade] e encontrei você pelo Google. Dei uma olhada no seu trabalho e gostei bastante do que vi. Mas durante essa análise encontrei alguns pontos que podem melhorar ainda mais a forma como novos pacientes encontram você e chegam até o atendimento. Posso te mostrar o que encontrei?`,
          tip: 'Elogio sincero + identificar oportunidade + pergunta de baixo atrito ("Posso te mostrar?").',
        },
      ],
    },
    {
      id: 'nutri-etapa-4',
      stageTitle: 'ETAPA 4 — ANÁLISE DO GOOGLE',
      description: 'Personalizada: faça a busca real por "nutricionista em [cidade]" antes de enviar.',
      steps: [
        {
          id: 'nutri-etapa-4-busca-google',
          title: 'Diagnóstico da Posição no Google',
          condition: 'Pesquise antes no Google: "nutricionista em [cidade]"',
          format: 'audio',
          message: `Então, [Nome], eu fiz uma busca específica por “nutricionista em [cidade]” e observei os resultados. Uma coisa que me chamou atenção foi a posição em que o seu perfil aparece.

Você está aparecendo mais abaixo em comparação com algumas outras opções.

E isso é importante porque quem pesquisa por uma nutricionista já está demonstrando uma intenção de encontrar alguém naquele momento. Quanto mais difícil for encontrar o seu perfil, maior a possibilidade de essa pessoa conhecer primeiro outro profissional.

Isso não tem relação com a qualidade do seu trabalho. É uma questão de visibilidade e estrutura digital.

Você já tinha percebido como o seu perfil aparece nessa busca?`,
          tip: 'Deixe claro que não é falha técnica dela, mas sim falta de estrutura digital.',
        },
        {
          id: 'nutri-etapa-4-se-disser-nao',
          title: 'Se ela disser "não"',
          condition: 'Quando a profissional disser que não sabia disso',
          format: 'audio',
          message: `Pois é. Foi justamente isso que me fez continuar analisando. Porque você pode ter um excelente trabalho e, mesmo assim, existir gente procurando exatamente pelo que você oferece sem conseguir chegar até você com facilidade.

E quando isso acontece, você pode estar deixando oportunidades de atendimento e faturamento na mesa sem nem perceber.`,
          tip: 'Mostre o custo invisível de não ser encontrada no Google.',
        },
      ],
    },
    {
      id: 'nutri-etapa-5',
      stageTitle: 'ETAPA 5 — O PROBLEMA DO CAMINHO ATÉ O AGENDAMENTO',
      description: 'Demonstrar a fricção entre encontrar a nutricionista e conseguir marcar a consulta.',
      steps: [
        {
          id: 'nutri-etapa-5-caminho-agendamento',
          title: 'O Problema do Caminho até o Agendamento',
          condition: 'Apresentar a perda de pacientes por falta de organização',
          format: 'audio',
          message: `E tem outro ponto que achei importante. Mesmo quando uma pessoa encontra você no Google ou no Instagram, ela ainda precisa descobrir quem você é, quais serviços você oferece, como funciona o atendimento, onde você atende e como pode marcar.

Quando tudo isso depende de procurar informação em vários lugares e iniciar uma conversa do zero pelo WhatsApp, você acaba colocando algumas etapas no caminho.

E quanto mais etapas existem, maior a chance de a pessoa simplesmente deixar para depois.

Hoje, para quem encontra você, esse caminho até o agendamento está bem organizado ou acaba dependendo bastante do WhatsApp?`,
          tip: 'Agora você escuta a resposta dela antes de prosseguir!',
        },
      ],
    },
    {
      id: 'nutri-etapa-6',
      stageTitle: 'ETAPA 6 — APRESENTAÇÃO DA SOLUÇÃO',
      description: 'Criação do caminho simplificado: Google/Instagram → Site → Informações → Solicitação.',
      steps: [
        {
          id: 'nutri-etapa-6-solucao',
          title: 'Depois da resposta: Apresentação da Solução',
          condition: 'Após ela responder sobre a dependência do WhatsApp',
          format: 'audio',
          message: `Foi justamente aí que eu enxerguei uma oportunidade.

A ideia é criar uma estrutura própria para você, onde o paciente consegue chegar, entender quem você é, conhecer seus serviços, ver as principais informações e ter um caminho claro até a solicitação de atendimento.

E junto disso, estruturar melhor o seu Perfil da Empresa no Google para deixar as informações mais completas e organizadas.

Assim, a gente cria um caminho mais simples:

Google ou Instagram → site → informações → solicitação de atendimento.

Isso faria diferença para a sua rotina hoje?`,
          tip: 'Conecte a solução à facilidade na rotina de agendamento.',
        },
      ],
    },
    {
      id: 'nutri-etapa-7',
      stageTitle: 'ETAPA 7 — DIFERENCIAL DO AGENDAMENTO',
      description: 'Como o formulário inteligente de agendamento economiza tempo e qualifica o contato.',
      steps: [
        {
          id: 'nutri-etapa-7-diferencial',
          title: 'Se ela demonstrar interesse: Diferencial do Agendamento',
          condition: 'Quando ela concordar que faria diferença',
          format: 'audio',
          message: `E eu pensei justamente em não deixar o site sendo só uma página bonita.

A ideia é ter uma estrutura de solicitação de agendamento em que o paciente possa informar, por exemplo, o serviço que procura, o dia e o horário de preferência.

Dessa forma, você recebe o contato já com essas informações organizadas e não precisa começar a conversa perguntando tudo novamente.

Isso ajudaria você no dia a dia?`,
          tip: 'Mostre que o contato já chega pronto para confirmação.',
        },
      ],
    },
    {
      id: 'nutri-etapa-8',
      stageTitle: 'ETAPA 8 — PRÉVIA',
      description: 'Gerar desejo mostrando que a prévia foi feita exclusivamente pensando no trabalho dela.',
      steps: [
        {
          id: 'nutri-etapa-8-previa',
          title: 'Apresentar a Prévia Exclusiva',
          condition: 'Transição para mostrar o mockup',
          format: 'audio',
          message: `Foi justamente pensando nisso que eu montei uma prévia específica para você. Não peguei um modelo genérico e simplesmente troquei o nome. Eu pensei a estrutura em cima do seu trabalho e desse caminho que o paciente faz até o atendimento.

Quer que eu te mostre?`,
          tip: 'Se ela disser sim, envie a imagem ou link na etapa seguinte.',
        },
      ],
    },
    {
      id: 'nutri-etapa-9',
      stageTitle: 'ETAPA 9 — ENVIO DA PRÉVIA',
      description: 'Envio da imagem ou link da prévia no WhatsApp.',
      steps: [
        {
          id: 'nutri-etapa-9-envio',
          title: 'Mensagem junto da imagem ou link',
          condition: 'Envie como legenda da foto ou acompanhada do link',
          format: 'texto',
          message: `Essa é a prévia que preparei pensando no seu trabalho e na experiência de quem encontra você pelo Google ou Instagram.

[LINKMOCKUP]`,
          tip: 'Aguarde ela visualizar antes de enviar o próximo áudio!',
        },
      ],
    },
    {
      id: 'nutri-etapa-10',
      stageTitle: 'ETAPA 10 — EXPLICAÇÃO DA PRÉVIA',
      description: 'Conduzir a nutricionista pelos blocos estratégicos da prévia.',
      steps: [
        {
          id: 'nutri-etapa-10-explicacao',
          title: 'Depois que ela visualizar: Explicação da Prévia',
          condition: 'Após o WhatsApp marcar visualizado ou ela responder',
          format: 'audio',
          message: `Aqui eu pensei justamente na jornada do paciente.

Primeiro ele entende quem você é, depois conhece seus serviços e as informações importantes do atendimento e, no final, encontra o caminho para solicitar o atendimento.

A ideia é deixar tudo mais claro e profissional e facilitar a conversão desse visitante em contato.

O que você achou da estrutura?`,
          tip: 'Peça a opinião dela com naturalidade: "O que você achou da estrutura?"',
        },
      ],
    },
    {
      id: 'nutri-etapa-11',
      stageTitle: 'ETAPA 11 — VALIDAÇÃO REAL',
      description: 'Confirmar que a estrutura realmente atende às necessidades da clínica.',
      steps: [
        {
          id: 'nutri-etapa-11-validacao',
          title: 'Se ela responder: "Gostei"',
          condition: 'Quando ela aprovar a prévia',
          format: 'audio',
          message: `Que bom! E pensando principalmente nessa parte de facilitar o caminho do paciente até o atendimento, você acha que uma estrutura assim realmente faria sentido para a sua rotina?`,
          tip: 'Se ela disser sim, responda: "Perfeito. Foi exatamente pensando nessa necessidade que eu montei a proposta."',
        },
      ],
    },
    {
      id: 'nutri-etapa-12',
      stageTitle: 'ETAPA 12 — PEDIR PERMISSÃO PARA APRESENTAR A OFERTA',
      description: 'Pedir permissão explícita antes de falar em valores e investimento.',
      steps: [
        {
          id: 'nutri-etapa-12-permissao-oferta',
          title: 'Pedir Permissão para Apresentar a Oferta',
          condition: 'Antes de apresentar qualquer valor financeiro',
          format: 'audio',
          message: `Posso te explicar agora exatamente o que eu entrego e como funciona o investimento?`,
          tip: 'Aguarde ela responder "Pode" antes de soltar a etapa 13.',
        },
      ],
    },
    {
      id: 'nutri-etapa-13',
      stageTitle: 'ETAPA 13 — OFERTA COMPLETA',
      description: 'Apresentação de tudo o que está incluso no projeto e prazo de 72 horas.',
      steps: [
        {
          id: 'nutri-etapa-13-oferta',
          title: 'Oferta Completa dos Entregáveis',
          condition: 'Quando ela autorizar a explicação da proposta',
          format: 'audio',
          message: `O projeto é personalizado para você e inclui toda a estrutura.

Primeiro, o site personalizado, com sua identidade visual, apresentação profissional, serviços, informações de atendimento, localização e canais de contato.

Também entra a estrutura de solicitação de agendamento, para o paciente enviar as informações de forma organizada.

Além disso, faço a estruturação do seu Perfil da Empresa no Google, organizando as principais informações, serviços, fotos, descrição e canais de contato.

O site também pode ser utilizado no Instagram, WhatsApp e Google, e já deixamos uma estrutura que poderá ser utilizada futuramente em campanhas de tráfego pago.

E faço toda essa implementação com prazo de entrega de até 72 horas após receber os materiais necessários.`,
          tip: 'Destaque o prazo rápido de 72h e a integração completa com o Google.',
        },
      ],
    },
    {
      id: 'nutri-etapa-14',
      stageTitle: 'ETAPA 14 — PREÇO',
      description: 'Ancoragem do preço padrão de R$ 997 e oferta da rodada especial por R$ 697.',
      steps: [
        {
          id: 'nutri-etapa-14-preco',
          title: 'Ancoragem & Preço da Rodada Especial',
          condition: 'Apresentação do valor do investimento',
          format: 'audio',
          message: `Para desenvolver toda essa estrutura, o valor normal do projeto é de R$ 997.

Mas eu estou fechando uma rodada específica de projetos para profissionais da área de nutrição e, nessa condição, consigo fazer o projeto completo por R$ 697.`,
          tip: 'Ancoragem forte de R$ 997 reduzida para R$ 697.',
        },
      ],
    },
    {
      id: 'nutri-etapa-15',
      stageTitle: 'ETAPA 15 — PAGAMENTO',
      description: 'Condições de pagamento no Pix (50/50) ou parcelado em até 12x no cartão.',
      steps: [
        {
          id: 'nutri-etapa-15-pagamento',
          title: 'Opções de Pagamento (Pix ou Cartão)',
          condition: 'Apresentação de como ela pode pagar',
          format: 'audio',
          message: `No Pix, podemos fazer 50% para iniciar e 50% na entrega.

No cartão, posso disponibilizar o pagamento em até 12 vezes, conforme as condições da operadora.

Essa condição fica viável para você?`,
          tip: 'Finalize com: "Essa condição fica viável para você?"',
        },
      ],
    },
    {
      id: 'nutri-etapa-16',
      stageTitle: 'ETAPA 16 — FECHAMENTO',
      description: 'Transição final para o fechamento e solicitação de materiais.',
      steps: [
        {
          id: 'nutri-etapa-16-fechamento',
          title: 'Se disser sim: Início Imediato',
          condition: 'Quando ela concordar com as condições',
          format: 'texto',
          message: `Perfeito! Posso te passar agora tudo que preciso para iniciar o projeto?`,
          tip: 'Avance o card para "Fechado" e envie o formulário/briefing de materiais!',
        },
      ],
    },
  ],
};

export const SCRIPT_NUTRICIONISTA_MENSAGENS: ScriptDefinition = {
  id: 'script_nutri_mensagens',
  title: 'Script 1 — Nutricionista | Versão Mensagens',
  subtitle: 'Prospecção e Fechamento 100% em Mensagens de Texto (Sem Áudio) — 15 Etapas',
  description: 'Roteiro validado em 15 etapas de texto alternando informações estratégicas e perguntas de baixo atrito, desde o primeiro contato até o fechamento por R$ 697 (ou R$ 397).',
  category: 'Especialista em Nutrição',
  goldenRule: {
    order: 'Informação → Pergunta Estratégica → Conectar com Site → Solução → Prévia → Validação → Oferta → Fechamento',
    primaryGoal: 'Conduzir a conversa em texto alternando informação e perguntas nos momentos certos, sem sobrecarregar com perguntas ao final de cada frase.',
    insight: 'As perguntas principais ficam distribuídas nos momentos-chave: "Posso te mostrar o que encontrei?", "Você já tinha percebido isso?", "Isso ajudaria na sua rotina?", "Quer que eu te mostre?", "O que você achou?", "Faria sentido para sua rotina?", "Posso te explicar o investimento?", "Essa condição fica viável para você?".',
  },
  structure: {
    hook: 'Olá, tudo bem? Esse é o contato da Dra. [NOME]?',
    problem: 'Perfil aparecendo mais abaixo no Google e paciente enfrentando várias etapas até conseguir agendar pelo WhatsApp.',
    solution: 'Site personalizado com apresentação profissional, agendamento organizado e Perfil da Empresa no Google estruturado.',
    cta: 'Posso te mostrar o que encontrei? / Quer que eu te mostre a prévia?',
  },
  template: `Olá, tudo bem? Esse é o contato da Dra. [NOME]?`,
  followUp1: `Oi, [Nome]! Passando só para retomar a mensagem que te enviei ontem. Fiz uma análise do seu posicionamento e encontrei alguns pontos que achei realmente interessantes.

Posso te mostrar o que encontrei?`,
  followUp2: `[Nome], voltei aqui porque aquele ponto que encontrei no seu posicionamento pode ser interessante para você. Inclusive preparei uma prévia pensando especificamente no seu trabalho.

Quer que eu te envie?`,
  followUp3: `[Nome], vou encerrar por aqui para não ficar insistindo. Só queria confirmar uma coisa: melhorar a forma como novos pacientes encontram você e chegam até o atendimento é uma prioridade para você neste momento?`,
  objections: [
    {
      id: 'nutri-msg-obj-caro',
      trigger: 'Objeção: "Está caro"',
      title: 'Objeção: "Está caro" (Não dê desconto imediatamente)',
      response: `⚠️ Dica: Não dê desconto imediatamente! Entenda o motivo primeiro.

💬 MENSAGEM 1 (Investigação):
"Entendo. Antes de mexer na proposta, me diz uma coisa: o que pesou mais para você, o investimento ou alguma parte do projeto que você acha que não vai utilizar?"

👉 SE FOR REALMENTE O PREÇO:
💬 MENSAGEM 2 (Condição Promocional):
"Entendi. Tenho uma condição diferente que consigo fazer para alguns projetos dessa rodada. Posso realizar essa estrutura por R$ 397, mantendo o projeto e o prazo de até 72 horas após o recebimento dos materiais.

Nesse formato, faria sentido para você começar?"`,
    },
    {
      id: 'nutri-msg-obj-pensar',
      trigger: 'Objeção: "Preciso pensar"',
      title: 'Objeção: "Preciso pensar"',
      response: `💬 MENSAGEM:
"Claro, sem problema. Só para eu entender melhor: ficou alguma dúvida sobre o projeto ou é mais uma questão de decidir o momento de investir?"`,
    },
    {
      id: 'nutri-msg-obj-ver-depois',
      trigger: 'Objeção: "Vou ver depois"',
      title: 'Objeção: "Vou ver depois"',
      response: `💬 MENSAGEM:
"Sem problema. Você prefere que eu te procure em alguns dias ou acha que neste momento realmente não é uma prioridade?"`,
    },
    {
      id: 'nutri-msg-obj-marido-socio',
      trigger: 'Objeção: "Vou falar com meu marido/sócio"',
      title: 'Objeção: "Vou falar com meu marido / sócio"',
      response: `💬 MENSAGEM:
"Perfeito! Posso deixar todas as informações organizadas por aqui para você encaminhar. Se surgir alguma dúvida sobre o projeto, prazo ou pagamento, pode me chamar."`,
    },
    {
      id: 'nutri-msg-obj-agora-nao',
      trigger: 'Objeção: "Agora não"',
      title: 'Objeção: "Agora não"',
      response: `💬 MENSAGEM:
"Tranquilo. Você acha que é mais uma questão de momento ou teve alguma parte da proposta que não fez sentido para você?"`,
    },
    {
      id: 'nutri-msg-fechamento-vamos-fazer',
      trigger: 'Fechamento: "Vamos fazer"',
      title: 'Fechamento: "Vamos fazer" (Início Imediato)',
      response: `💬 MENSAGEM:
"Perfeito! Então vamos dar andamento. Posso te passar agora os materiais que preciso para iniciar?"`,
    },
  ],
  stages: [
    {
      id: 'nutri-msg-etapa-1',
      stageTitle: '1. PRIMEIRO CONTATO',
      description: 'Validação simples do contato da nutricionista.',
      steps: [
        {
          id: 'nutri-msg-1',
          title: 'Mensagem 1 — Abertura',
          condition: 'Primeiro envio para iniciar o contato',
          format: 'texto',
          message: `Olá, tudo bem? Esse é o contato da Dra. [NOME]?`,
          tip: 'Mensagem simples e inocente para confirmação.',
        },
        {
          id: 'nutri-msg-2',
          title: 'Mensagem 2 — Se responder “sim”',
          condition: 'Quando confirmarem o contato',
          format: 'texto',
          message: `Perfeito! Eu queria falar diretamente com a Dra. [Nome]. Posso falar com ela rapidinho?`,
          tip: 'Solicitação direta e educada para falar com a profissional.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-2',
      stageTitle: '2. SE FOR SECRETÁRIA',
      description: 'Como passar pela recepção com autoridade e curiosidade profissional.',
      steps: [
        {
          id: 'nutri-msg-3',
          title: 'Mensagem 3 — Se perguntar: “Sobre o que seria?”',
          condition: 'Quando a secretária perguntar o assunto',
          format: 'texto',
          message: `Estou fazendo uma análise de alguns profissionais da área de nutrição aqui em [CIDADE] e encontrei o trabalho da Dra. [Nome] pelo Google. Dei uma olhada no posicionamento dela e identifiquei alguns pontos que podem ajudar na presença digital e na captação de novos pacientes. Por isso queria mostrar isso diretamente para ela. Consigo falar com ela?`,
          tip: 'Destaca que você fez uma análise real da cidade.',
        },
        {
          id: 'nutri-msg-4',
          title: 'Mensagem 4 — Se perguntar: “Mas sobre o quê exatamente?”',
          condition: 'Se a secretária insistir em saber detalhes',
          format: 'texto',
          message: `É principalmente sobre como um possível paciente encontra ela no Google, conhece o trabalho e chega até o contato e o agendamento. Inclusive preparei uma prévia pensando especificamente no trabalho dela. Posso explicar diretamente para ela?`,
          tip: 'Citar que preparou uma prévia específica facilita a transferência.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-3',
      stageTitle: '3. SE FOR A PRÓPRIA NUTRICIONISTA',
      description: 'Validação do trabalho dela e pedido de permissão de baixo atrito.',
      steps: [
        {
          id: 'nutri-msg-5',
          title: 'Mensagem 1 — Elogio ao Posicionamento',
          condition: 'Quando a própria nutricionista atender',
          format: 'texto',
          message: `Oi, Dra. [Nome], tudo bem? Eu estava analisando alguns profissionais de nutrição aqui em [CIDADE] e encontrei você pelo Google. Dei uma olhada no seu trabalho e gostei bastante do que vi.`,
          tip: 'Valide o trabalho dela antes de falar de melhorias.',
        },
        {
          id: 'nutri-msg-6',
          title: 'Mensagem 2 — Permissão para Apresentar',
          condition: 'Envie logo em seguida',
          format: 'texto',
          message: `Durante essa análise, encontrei alguns pontos que podem melhorar ainda mais a forma como novos pacientes encontram você e chegam até o atendimento. Posso te mostrar o que encontrei?`,
          tip: 'Se ela disser sim, avance para a análise do Google.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-4',
      stageTitle: '4. ANÁLISE DO GOOGLE',
      description: 'Personalize conforme a busca real que você fez antes de entrar em contato.',
      steps: [
        {
          id: 'nutri-msg-7',
          title: 'Mensagem 3 — Posição no Google',
          condition: 'Exemplo: busca por "nutricionista em [CIDADE]"',
          format: 'texto',
          message: `Fiz uma busca específica por “nutricionista em [CIDADE]” e observei os resultados. Uma coisa que me chamou atenção foi que o seu perfil aparece mais abaixo em relação a algumas outras opções.`,
          tip: 'Constatação objetiva baseada em dados reais.',
        },
        {
          id: 'nutri-msg-8',
          title: 'Mensagem 4 — Intenção de Compra do Paciente',
          condition: 'Envie em seguida',
          format: 'texto',
          message: `Isso é importante porque quem pesquisa por uma nutricionista já está procurando atendimento naquele momento. Então, quando o profissional aparece com menos destaque, existe a possibilidade de outras opções serem vistas primeiro.`,
          tip: 'Mostra que quem pesquisa no Google já está pronto para agendar.',
        },
        {
          id: 'nutri-msg-9',
          title: 'Mensagem 5 + Pergunta Estratégica',
          condition: 'Gatilho para engajar a resposta dela',
          format: 'texto',
          message: `Seu trabalho pode ser excelente, mas se a pessoa não encontra você com facilidade, podem existir oportunidades de atendimento que acabam não chegando até você.

Você já tinha percebido isso no seu perfil?`,
          tip: 'Aguarde ela responder antes de conectar com o site!',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-5',
      stageTitle: '5. CONECTAR COM O SITE',
      description: 'Apresentar a fricção entre encontrar a nutricionista e conseguir agendar.',
      steps: [
        {
          id: 'nutri-msg-10',
          title: 'Mensagem 6 — O problema da jornada espalhada',
          condition: 'Depois da resposta dela',
          format: 'texto',
          message: `E teve outro ponto que achei importante: mesmo quando a pessoa encontra você no Google ou Instagram, ela ainda precisa descobrir quem você é, quais serviços oferece, como funciona o atendimento, onde você atende e como entrar em contato.`,
          tip: 'Mostra a importância de centralizar tudo.',
        },
        {
          id: 'nutri-msg-11',
          title: 'Mensagem 7 + Pergunta sobre o WhatsApp',
          condition: 'Conectar com a dor da sobrecarga de WhatsApp',
          format: 'texto',
          message: `Quando todas essas informações ficam espalhadas e o paciente precisa perguntar tudo pelo WhatsApp, acabam existindo mais etapas até chegar ao atendimento.

Hoje você sente que esse caminho até o agendamento está bem organizado ou acaba dependendo bastante do WhatsApp?`,
          tip: 'Aguarde a resposta dela!',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-6',
      stageTitle: '6. APRESENTAR A IDEIA',
      description: 'Apresentar a oportunidade de ter estrutura própria e Google otimizado.',
      steps: [
        {
          id: 'nutri-msg-12',
          title: 'Mensagem 8 & 9 — Estrutura Própria',
          condition: 'Depois da resposta',
          format: 'texto',
          message: `Foi justamente aí que eu enxerguei uma oportunidade para você.

A ideia é criar uma estrutura própria onde o paciente consiga conhecer você, entender seus serviços, ver as principais informações do atendimento e ter um caminho claro para solicitar o agendamento.`,
          tip: 'Conceito simples e claro da solução.',
        },
        {
          id: 'nutri-msg-13',
          title: 'Mensagem 10 + Pergunta Estratégica',
          condition: 'Perfil do Google + Pergunta de validação',
          format: 'texto',
          message: `E junto disso, organizar melhor o seu Perfil da Empresa no Google, deixando as informações, serviços, fotos, contato e outros dados importantes mais completos.

Você acha que uma estrutura assim ajudaria na sua rotina?`,
          tip: 'Aguarde a validação dela.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-7',
      stageTitle: '7. DIFERENCIAL DO AGENDAMENTO',
      description: 'O formulário de agendamento que economiza tempo de WhatsApp.',
      steps: [
        {
          id: 'nutri-msg-14',
          title: 'Mensagem 11 & 12 — Mais que uma página bonita',
          condition: 'Se ela demonstrar interesse',
          format: 'texto',
          message: `E eu não pensei no site apenas como uma página bonita.

A ideia é ter uma estrutura de solicitação de atendimento em que o paciente possa informar, por exemplo, o serviço que procura, o dia e o horário de preferência.`,
          tip: 'Destaca que o foco é resultado prático.',
        },
        {
          id: 'nutri-msg-15',
          title: 'Mensagem 13 + Pergunta de Utilidade',
          condition: 'Pergunta de impacto na rotina',
          format: 'texto',
          message: `Assim, você recebe essas informações organizadas e não precisa começar a conversa perguntando tudo do zero.

Isso seria útil para você no dia a dia?`,
          tip: 'Aguarde ela confirmar que seria útil.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-8',
      stageTitle: '8. PEDIR PERMISSÃO PARA MOSTRAR A PRÉVIA',
      description: 'Gera expectativa sobre a prévia pensada sob medida.',
      steps: [
        {
          id: 'nutri-msg-16',
          title: 'Mensagem 14 & 15 — Prévia Exclusiva',
          condition: 'Transição para o mockup',
          format: 'texto',
          message: `Foi justamente pensando nisso que eu preparei uma prévia específica para você. Não é um modelo genérico: pensei a estrutura em cima do seu trabalho e da jornada do paciente.

Quer que eu te mostre?`,
          tip: 'Se disser sim, envie a prévia no passo seguinte.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-9',
      stageTitle: '9. APÓS ENVIAR A PRÉVIA',
      description: 'Envio da prévia e explicação da jornada.',
      steps: [
        {
          id: 'nutri-msg-17',
          title: 'Mensagem 16 — Envio da Prévia',
          condition: 'Envie junto com a imagem ou link',
          format: 'texto',
          message: `Essa é a prévia que preparei pensando no seu trabalho e no caminho de quem encontra você pelo Google ou Instagram.

[LINKMOCKUP]`,
          tip: 'Espere ela visualizar antes de enviar a explicação.',
        },
        {
          id: 'nutri-msg-18',
          title: 'Mensagem 17, 18 + Pergunta: O que achou?',
          condition: 'Depois que ela visualizar',
          format: 'texto',
          message: `Aqui eu pensei na jornada completa: apresentação, serviços, informações do atendimento, localização, contato e solicitação de agendamento.

A ideia é que a pessoa entre e consiga entender rapidamente quem você é, o que você oferece e qual é o próximo passo.

O que você achou da estrutura?`,
          tip: 'Pergunta aberta para escutar a opinião sincera dela.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-10',
      stageTitle: '10. VALIDAÇÃO',
      description: 'Confirmação se faz sentido para a rotina da nutricionista.',
      steps: [
        {
          id: 'nutri-msg-19',
          title: 'Mensagem 19 — Se ela disser “gostei”',
          condition: 'Quando ela validar positivamente',
          format: 'texto',
          message: `Que bom! E pensando principalmente nessa parte de facilitar o caminho do paciente até o atendimento, você acha que uma estrutura assim faria sentido para a sua rotina?`,
          tip: 'Se disser sim, use a Mensagem 20.',
        },
        {
          id: 'nutri-msg-20',
          title: 'Mensagem 20 — Confirmação da Necessidade',
          condition: 'Após o sim dela',
          format: 'texto',
          message: `Perfeito. Foi exatamente pensando nessa necessidade que eu montei a proposta.`,
          tip: 'Avança para a permissão da oferta.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-11',
      stageTitle: '11. TRANSIÇÃO PARA A OFERTA',
      description: 'Pedir permissão antes de apresentar os valores.',
      steps: [
        {
          id: 'nutri-msg-21',
          title: 'Mensagem 21 — Permissão para o Investimento',
          condition: 'Antes de apresentar preço',
          format: 'texto',
          message: `Posso te explicar o que está incluso no projeto e como funciona o investimento?`,
          tip: 'Aguarde o sim dela antes de enviar o escopo.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-12',
      stageTitle: '12. APRESENTAÇÃO DA OFERTA',
      description: 'Escopo completo dos entregáveis e prazo de 72 horas.',
      steps: [
        {
          id: 'nutri-msg-22',
          title: 'Mensagem 22 — Escopo Completo do Projeto',
          condition: 'Quando ela autorizar a explicação',
          format: 'texto',
          message: `O projeto é totalmente personalizado para você e inclui:

• Site personalizado da sua marca
apresentação, serviços, informações de atendimento, localização e contato.

• Estrutura de solicitação de agendamento
para organizar as informações enviadas pelo paciente.

• Estruturação do Perfil da Empresa no Google
organização das principais informações, serviços, fotos, descrição e contatos.

• Integração dos canais
para divulgação pelo Instagram, WhatsApp e Google.

• Estrutura preparada para futuras campanhas de tráfego pago
para que você tenha uma página própria para receber esse público.

A implementação é feita por mim e a entrega acontece em até 72 horas após o envio de todos os materiais necessários.`,
          tip: 'Apresentação detalhada que gera alto valor percebido.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-13',
      stageTitle: '13. PREÇO',
      description: 'Ancoragem do valor normal de R$ 997 e preço especial de R$ 697.',
      steps: [
        {
          id: 'nutri-msg-23-24',
          title: 'Mensagem 23 & 24 — Ancoragem & Valor Especial',
          condition: 'Apresentação do investimento',
          format: 'texto',
          message: `O valor normal para desenvolver toda essa estrutura é de R$ 997.

Mas estou fechando uma rodada específica de projetos para profissionais da área de nutrição e, nessa condição, consigo fazer o projeto completo por R$ 697.`,
          tip: 'Ancoragem de R$ 997 reduzida para R$ 697.',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-14',
      stageTitle: '14. PAGAMENTO',
      description: 'Condições facilitadas no Pix e cartão em até 12x.',
      steps: [
        {
          id: 'nutri-msg-25-26',
          title: 'Mensagem 25, 26 + Pergunta de Fechamento',
          condition: 'Formas de pagamento e fechamento',
          format: 'texto',
          message: `No Pix, podemos fazer 50% no início e 50% na entrega.

No cartão, o pagamento pode ser feito em até 12x, conforme as condições da operadora.

Essa condição fica viável para você?`,
          tip: 'Finalize com a pergunta estratégica: "Essa condição fica viável para você?"',
        },
      ],
    },
    {
      id: 'nutri-msg-etapa-15',
      stageTitle: '15. FECHAMENTO',
      description: 'Início imediato do projeto e solicitação de materiais.',
      steps: [
        {
          id: 'nutri-msg-27',
          title: 'Mensagem 27 — Se disser sim: Início do Projeto',
          condition: 'Quando ela aceitar a proposta',
          format: 'texto',
          message: `Perfeito! Então vamos dar andamento. Posso te passar agora os materiais que preciso para iniciar?`,
          tip: 'Avance o card para "Fechado" e envie a lista de materiais!',
        },
      ],
    },
    {
      id: 'nutri-fu-etapa-1',
      stageTitle: 'FOLLOW-UP 1 — NÃO RESPONDEU A ABORDAGEM INICIAL',
      description: 'Gatilho: Enviou a abordagem inicial e o lead não respondeu.',
      steps: [
        {
          id: 'nutri-fu-1-1',
          title: 'Follow-up 1 — 1 dia depois',
          condition: 'D1: Se não respondeu a mensagem de abertura',
          format: 'texto',
          message: `Oi, [Nome]! Passando só para retomar a mensagem que te enviei ontem. Fiz uma análise do seu posicionamento e encontrei alguns pontos que achei realmente interessantes.

Posso te mostrar o que encontrei?`,
          tip: 'Retomada suave focada na oportunidade encontrada.',
        },
        {
          id: 'nutri-fu-1-2',
          title: 'Follow-up 2 — 2 dias depois',
          condition: 'D3: Se continuar sem resposta',
          format: 'texto',
          message: `[Nome], voltei aqui porque aquele ponto que encontrei no seu posicionamento pode ser interessante para você. Inclusive preparei uma prévia pensando especificamente no seu trabalho.

Quer que eu te envie?`,
          tip: 'Menciona a prévia exclusiva para gerar curiosidade.',
        },
        {
          id: 'nutri-fu-1-3',
          title: 'Follow-up 3 — Break-up / 2 a 3 dias depois',
          condition: 'D5/D6: Mensagem de encerramento elegante',
          format: 'texto',
          message: `[Nome], vou encerrar por aqui para não ficar insistindo. Só queria confirmar uma coisa: melhorar a forma como novos pacientes encontram você e chegam até o atendimento é uma prioridade para você neste momento?`,
          tip: 'Pergunta de prioridade que gera alta taxa de resposta no encerramento.',
        },
      ],
    },
    {
      id: 'nutri-fu-etapa-2',
      stageTitle: 'FOLLOW-UP 2 — ELA DISSE “PODE MOSTRAR” E DEPOIS SUMIU',
      description: 'Gatilho: A pessoa autorizou você a mostrar a análise, mas parou antes da próxima etapa.',
      steps: [
        {
          id: 'nutri-fu-2-1',
          title: 'Follow-up 1 — Relembrando o Google',
          condition: 'Se sumiu após dizer "pode mostrar"',
          format: 'texto',
          message: `Oi, [Nome]! Conseguiu ver minha última mensagem? Eu queria te mostrar aquele ponto que encontrei no seu posicionamento no Google.

Posso te enviar agora?`,
          tip: 'Pergunta direta e sem atrito.',
        },
        {
          id: 'nutri-fu-2-2',
          title: 'Follow-up 2 — Material Preparado',
          condition: '2 dias depois',
          format: 'texto',
          message: `[Nome], deixei separado o material que preparei para você. É uma análise bem rápida e já mostra onde enxerguei a oportunidade.

Posso te mandar por aqui?`,
          tip: 'Reforça que a análise é rápida e direta ao ponto.',
        },
        {
          id: 'nutri-fu-2-3',
          title: 'Follow-up 3 — Organização e Encerramento',
          condition: 'Break-up de autorização',
          format: 'texto',
          message: `[Nome], só para eu me organizar por aqui: ainda faz sentido eu te mostrar essa análise ou prefere deixar isso para outro momento?`,
          tip: 'Coloca a decisão na mão dela sem parecer insistente.',
        },
      ],
    },
    {
      id: 'nutri-fu-etapa-3',
      stageTitle: 'FOLLOW-UP 3 — PRÉVIA ENVIADA E ELA NÃO RESPONDEU',
      description: 'Gatilho: Prévia enviada e pergunta "o que achou?", mas ela não respondeu.',
      steps: [
        {
          id: 'nutri-fu-3-1',
          title: 'Follow-up 1 — 1 dia depois da prévia',
          condition: 'D1 após envio da prévia',
          format: 'texto',
          message: `Oi, [Nome]! Conseguiu dar uma olhada na prévia que te enviei?

Queria saber principalmente o que você achou da estrutura.`,
          tip: 'Foco na opinião dela sobre a estrutura.',
        },
        {
          id: 'nutri-fu-3-2',
          title: 'Follow-up 2 — 2 dias depois',
          condition: 'D3 após envio da prévia',
          format: 'texto',
          message: `[Nome], fiquei curioso para saber sua opinião porque montei essa prévia pensando especificamente no seu atendimento, não como um modelo genérico.

O que você achou da ideia?`,
          tip: 'Reforça a personalização exclusiva.',
        },
        {
          id: 'nutri-fu-3-3',
          title: 'Follow-up 3 — Break-up da Prévia',
          condition: 'D5 após envio da prévia',
          format: 'texto',
          message: `[Nome], vou fazer só mais um contato para não ficar insistindo. Essa estrutura de site + agendamento faria sentido para você ou hoje não é uma prioridade?`,
          tip: 'Última tentativa de validação da prévia.',
        },
      ],
    },
    {
      id: 'nutri-fu-etapa-4',
      stageTitle: 'FOLLOW-UP 4 — DISSE “GOSTEI” E SUMIU ANTES DA OFERTA',
      description: 'Gatilho: Ela elogiou a prévia ("Gostei"), mas sumiu antes de validar se faria sentido para a rotina.',
      steps: [
        {
          id: 'nutri-fu-4-1',
          title: 'Follow-up — Conexão com o Investimento',
          condition: 'Quando elogiou a prévia e parou de responder',
          format: 'texto',
          message: `Que bom que gostou, [Nome]. Fiquei com a impressão de que a parte de facilitar o caminho até o atendimento fez sentido para você.

Quer que eu te explique como funciona o projeto e o investimento?`,
          tip: 'Transição suave para liberar a apresentação da proposta.',
        },
      ],
    },
    {
      id: 'nutri-fu-etapa-5',
      stageTitle: 'FOLLOW-UP 5 — ELA AUTORIZOU A OFERTA E SUMIU',
      description: 'Gatilho: Você apresentou os entregáveis e o valor (R$ 697), mas ela não respondeu.',
      steps: [
        {
          id: 'nutri-fu-5-1',
          title: 'Follow-up 1 — Dúvida / Entendimento',
          condition: 'D1 após envio da proposta de investimento',
          format: 'texto',
          message: `Oi, [Nome]! Só passando para confirmar se conseguiu analisar o que te enviei sobre o projeto.

Ficou alguma dúvida sobre o que está incluso ou sobre o investimento?`,
          tip: 'Abre espaço para tirar dúvidas antes de mexer na proposta.',
        },
        {
          id: 'nutri-fu-5-2',
          title: 'Follow-up 2 — Reforço de Valor',
          condition: 'D3 após proposta',
          format: 'texto',
          message: `[Nome], além do site, o projeto inclui a estrutura de solicitação de atendimento e a organização do Perfil da Empresa no Google. Queria só entender se alguma parte da proposta ficou pouco clara para você.

Tem algum ponto que você gostaria que eu explicasse melhor?`,
          tip: 'Relembra os 3 pilares: site + agendamento + Google.',
        },
        {
          id: 'nutri-fu-5-3',
          title: 'Follow-up 3 — Break-up da Proposta',
          condition: 'D5 após proposta',
          format: 'texto',
          message: `[Nome], vou encerrar esse acompanhamento por aqui para não ficar te cobrando. Você ainda tem interesse em colocar essa estrutura em funcionamento ou prefere deixar para outro momento?`,
          tip: 'Desapego total que força a tomada de decisão.',
        },
      ],
    },
    {
      id: 'nutri-fu-etapa-6',
      stageTitle: 'FOLLOW-UP 6 — DISSE “SIM” E VOCÊ PEDIU OS MATERIAIS',
      description: 'Gatilho: Fechou a etapa com "Posso passar agora os materiais necessários para iniciar?" e sumiu.',
      steps: [
        {
          id: 'nutri-fu-6-1',
          title: 'Follow-up 1 — 1 dia depois: Checklist',
          condition: 'D1 após ela aceitar iniciar',
          format: 'texto',
          message: `Oi, [Nome]! Tudo bem? Passando só para confirmar se conseguiu ver minha última mensagem.

Posso te enviar o checklist dos materiais para a gente começar?`,
          tip: 'Objetivo simples: destravar o envio do checklist.',
        },
        {
          id: 'nutri-fu-6-2',
          title: 'Follow-up 2 — 2 dias depois: Preparado',
          condition: 'D3 após o aceite',
          format: 'texto',
          message: `[Nome], já deixei tudo preparado por aqui para iniciar o projeto. Assim que eu receber os materiais, consigo dar andamento na estrutura.

Quer que eu te envie novamente o checklist?`,
          tip: 'Relembra o checklist e a prontidão do desenvolvimento.',
        },
        {
          id: 'nutri-fu-6-3',
          title: 'Follow-up 3 — Break-up de Início',
          condition: 'D5 após o aceite',
          format: 'texto',
          message: `[Nome], só para eu organizar meus projetos por aqui: vamos dar andamento ao seu site agora ou prefere deixar para outro momento?`,
          tip: 'Confirmação final para organizar sua fila de produção.',
        },
      ],
    },
    {
      id: 'nutri-fu-etapa-7',
      stageTitle: 'FOLLOW-UP 7 — PAGOU, MAS NÃO ENVIOU OS MATERIAIS',
      description: 'Gatilho: O cliente já fechou/pagou, mas travou no envio das fotos/textos/briefing.',
      steps: [
        {
          id: 'nutri-fu-7-1',
          title: 'Follow-up 1 — Preparação',
          condition: '1 a 2 dias após o pagamento do sinal',
          format: 'texto',
          message: `Oi, [Nome]! Tudo certo? Já está tudo preparado por aqui para começar.

Conseguiu separar os materiais do projeto?`,
          tip: 'Incentiva o envio sem parecer cobrança pesada.',
        },
        {
          id: 'nutri-fu-7-2',
          title: 'Follow-up 2 — Reforço do Prazo de 72h',
          condition: '3 a 4 dias após pagamento',
          format: 'texto',
          message: `[Nome], assim que eu receber os materiais consigo iniciar e seguir com o prazo que combinamos.

Quer que eu te mande a lista novamente para facilitar?`,
          tip: 'Lembra que o prazo de 72h começa a contar a partir dos materiais.',
        },
        {
          id: 'nutri-fu-7-3',
          title: 'Follow-up 3 — Ajuda para Reunir Materiais',
          condition: '5 a 7 dias após pagamento',
          format: 'texto',
          message: `Oi, [Nome]! Passando só para confirmar se ficou alguma dificuldade para reunir os materiais. Tem alguma coisa que você precisa da minha ajuda para separar?`,
          tip: 'Se oferecer para ajudar destrói a procrastinação do cliente.',
        },
      ],
    },
    {
      id: 'nutri-fu-cadencia',
      stageTitle: 'CADÊNCIA RECOMENDADA DE FOLLOW-UP NO CRM',
      description: 'Estrutura temporal (D0, D1, D3, D5) para prospecção com cadência profissional.',
      steps: [
        {
          id: 'nutri-cad-frio',
          title: 'Cadência: Lead Frio (Primeira Abordagem)',
          condition: 'D0 → D1 → D3 → D5/D6 Break-up',
          format: 'texto',
          message: `📅 CADÊNCIA PARA LEAD FRIO:
• D0: Mensagem Inicial de Abordagem
• D1: Follow-up 1 (Retomada suave)
• D3: Follow-up 2 (Mencionar a prévia)
• D5/D6: Follow-up 3 (Break-up de prioridade)`,
          tip: 'Espaçamento de 1 a 2 dias evita insistência e aumenta respeito.',
        },
        {
          id: 'nutri-cad-previa',
          title: 'Cadência: Lead com Prévia Enviada',
          condition: 'D0 → D1 → D3 → D5 Break-up',
          format: 'texto',
          message: `📅 CADÊNCIA PARA QUEM RECEBEU A PRÉVIA:
• D0: Prévia enviada + pergunta "O que achou?"
• D1: Follow-up 1 (Opinião sobre a estrutura)
• D3: Follow-up 2 (Personalização exclusiva)
• D5: Follow-up 3 (Break-up final)`,
          tip: 'Foco na opinião dela sobre o modelo preparado.',
        },
        {
          id: 'nutri-cad-proposta',
          title: 'Cadência: Lead com Proposta Enviada',
          condition: 'D1 → D3 → D5 Break-up',
          format: 'texto',
          message: `📅 CADÊNCIA PARA QUEM RECEBEU A PROPOSTA:
• D1: Follow-up 1 (Dúvidas sobre o investimento)
• D3: Follow-up 2 (Reforço: Site + Agendamento + Google)
• D5: Follow-up 3 (Break-up)`,
          tip: 'Em caso de objeção de preço, use a condição especial de R$ 397.',
        },
        {
          id: 'nutri-cad-aprovou',
          title: 'Cadência: Lead que Aprovou / Fechou',
          condition: 'D1 → D3 → D5 Confirmação',
          format: 'texto',
          message: `📅 CADÊNCIA PARA QUEM APROVOU / FECHOU:
• D1: Follow-up 1 (Checklist de materiais)
• D3: Follow-up 2 (Tudo preparado: reenvio de checklist)
• D5: Follow-up 3 (Ajuda para separar os materiais)`,
          tip: 'Garante agilidade na entrega de até 72 horas.',
        },
      ],
    },
  ],
};

export const DEFAULT_SCRIPTS: Record<string, ScriptDefinition> = {
  script_mensagem: SCRIPT_MENSAGEM,
  script_ligacao: SCRIPT_LIGACAO,
};

export const INITIAL_NICHES: NicheCampaign[] = [
  {
    id: 'niche-estetica-automotiva',
    name: 'Estética Automotiva',
    segment: 'Estética Automotiva & Polimento',
    city: 'Arapiraca - AL',
    targetCities: ['Arapiraca - AL', 'Maceió - AL', 'Palmeira dos Índios - AL'],
    emoji: '🚗',
    targetMrr: 6000,
    createdAt: new Date().toISOString(),
    scripts: {
      script_mensagem: SCRIPT_MENSAGEM,
      script_ligacao: SCRIPT_LIGACAO,
    },
  },
  {
    id: 'niche-odontologia',
    name: 'Dentistas & Odontologia',
    segment: 'Clínicas Odontológicas & Dentistas',
    city: 'Arapiraca - AL',
    targetCities: ['Arapiraca - AL', 'Maceió - AL', 'Palmeira dos Índios - AL'],
    emoji: '🦷',
    targetMrr: 7000,
    createdAt: new Date().toISOString(),
    scripts: {
      script_mensagem: SCRIPT_MENSAGEM,
      script_ligacao: SCRIPT_LIGACAO,
    },
  },
  {
    id: 'niche-nutricionistas',
    name: 'Nutricionistas & Nutrologia',
    segment: 'Nutricionistas & Nutrologia',
    city: 'Arapiraca - AL',
    targetCities: ['Arapiraca - AL', 'Maceió - AL', 'Palmeira dos Índios - AL'],
    emoji: '🥗',
    targetMrr: 6000,
    createdAt: new Date().toISOString(),
    scripts: {
      script_mensagem: SCRIPT_MENSAGEM,
      script_ligacao: SCRIPT_LIGACAO,
    },
  },
  {
    id: 'niche-clinicas-locais',
    name: 'Clínicas & Consultórios',
    segment: 'Clínicas Médicas & Especialistas',
    city: 'São Paulo - SP',
    targetCities: ['São Paulo - SP', 'Campinas - SP', 'Santos - SP'],
    emoji: '🩺',
    targetMrr: 5000,
    createdAt: new Date().toISOString(),
    scripts: {
      script_mensagem: SCRIPT_MENSAGEM,
      script_ligacao: SCRIPT_LIGACAO,
    },
  },
];

// Base de contatos inicial limpa (começando do zero)
export const INITIAL_LEADS: Lead[] = [];


export const SAMPLE_IMPORT_LEADS = [
  // Clínicas de Estética (Nicho Alvo)
  {
    companyName: 'Clínica Bella Pele Estética Avançada',
    contactName: 'Dra. Vanessa Lima',
    phone: '82996541122',
    category: 'Clínica de Estética',
    city: 'Arapiraca - AL',
    address: 'Rua Domingos Correia, 410',
    googleRating: 4.9,
    googleMapsUrl: 'https://maps.google.com/?q=Bella+Pele+Estetica+Arapiraca',
    websiteUrl: 'https://bellapeleestetica.com.br',
    recommendedScript: 'script1',
    opportunityAngle: 'Clínica de estética renomada sem agendamento direto online',
  },
  {
    companyName: 'Espaço Harmonize Estética & Harmonização Facial',
    contactName: 'Dra. Larissa Ramos',
    phone: '82991223344',
    category: 'Clínica de Estética',
    city: 'Arapiraca - AL',
    address: 'Av. Deputada Ceci Cunha, 820',
    googleRating: 4.8,
    googleMapsUrl: 'https://maps.google.com/?q=Espaco+Harmonize+Arapiraca',
    recommendedScript: 'script1',
    opportunityAngle: 'Sem site cadastrado no perfil do Google Meu Negócio',
  },
  {
    companyName: 'DermaLaser Estética Corporal & Depilação',
    contactName: 'Carla Esteticista',
    phone: '82998877665',
    category: 'Clínica de Estética',
    city: 'Arapiraca - AL',
    address: 'Rua Fernandes Lima, 120',
    googleRating: 4.7,
    googleMapsUrl: 'https://maps.google.com/?q=DermaLaser+Arapiraca',
    websiteUrl: 'https://dermalaserarapiraca.com.br',
    recommendedScript: 'script1',
    opportunityAngle: 'Site antigo não adaptado para smartphones',
  },
  {
    companyName: 'Studio Renovare Estética & Bem-Estar',
    contactName: 'Renata Souza',
    phone: '82987114455',
    category: 'Clínica de Estética',
    city: 'Arapiraca - AL',
    address: 'Praça Marques da Silva, 95',
    googleRating: 5.0,
    googleMapsUrl: 'https://maps.google.com/?q=Studio+Renovare+Arapiraca',
    recommendedScript: 'script1',
    opportunityAngle: 'Nota 5.0 no Google com alto volume de clientes',
  },

  // Dentistas (Categoria a excluir no filtro)
  {
    companyName: 'Sorriso Prime Odontologia - Dra. Beatriz',
    contactName: 'Dra. Beatriz',
    phone: '82988112233',
    category: 'Dentistas',
    city: 'Arapiraca - AL',
    address: 'Rua São Francisco, 310',
    googleRating: 4.8,
    googleMapsUrl: 'https://maps.google.com/?q=Sorriso+Prime+Odontologia+Arapiraca',
    recommendedScript: 'script2',
    opportunityAngle: 'Dentista (Nicho odontológico distinto de clínicas de estética)',
  },
  {
    companyName: 'Dr. Roberto Mendes Dentista Clínico',
    contactName: 'Dr. Roberto',
    phone: '82993322114',
    category: 'Dentistas',
    city: 'Arapiraca - AL',
    address: 'Rua Esperidião Rodrigues, 240',
    googleRating: 4.6,
    googleMapsUrl: 'https://maps.google.com/?q=Dr+Roberto+Dentista+Arapiraca',
    recommendedScript: 'script2',
    opportunityAngle: 'Consultório odontológico fora do nicho de estética',
  },
  {
    companyName: 'Implante & Arte Odontologia Especializada',
    contactName: 'Dra. Fernanda',
    phone: '82987654321',
    category: 'Dentistas',
    city: 'Arapiraca - AL',
    address: 'Rua Estudante José de Oliveira, 78',
    googleRating: 4.5,
    googleMapsUrl: 'https://maps.google.com/?q=Implante+Arte+Odontologia+Arapiraca',
    recommendedScript: 'script2',
    opportunityAngle: 'Odontologia cirúrgica e implantes',
  },

  // Consultório Odontológico (Outra categoria a excluir no filtro)
  {
    companyName: 'Consultório Odontológico Dra. Juliana Paes',
    contactName: 'Dra. Juliana',
    phone: '82996113344',
    category: 'Consultório Odontológico',
    city: 'Arapiraca - AL',
    address: 'Av. Rio Branco, 510',
    googleRating: 4.9,
    googleMapsUrl: 'https://maps.google.com/?q=Consultorio+Juliana+Paes+Arapiraca',
    recommendedScript: 'script2',
    opportunityAngle: 'Consultório odontológico para exclusão no filtro',
  },
  {
    companyName: 'Consultório Odontológico Sorrir Mais',
    contactName: 'Dr. André',
    phone: '82994455667',
    category: 'Consultório Odontológico',
    city: 'Arapiraca - AL',
    address: 'Rua Monsenhor Alfredo, 30',
    googleRating: 4.4,
    googleMapsUrl: 'https://maps.google.com/?q=Sorrir+Mais+Odonto+Arapiraca',
    recommendedScript: 'script2',
    opportunityAngle: 'Consultório odontológico',
  },

  // Teste de Duplicidade (Telefone Repetido)
  {
    companyName: 'Bella Pele Estética - Unidade 2',
    contactName: 'Recepção',
    phone: '82996541122',
    category: 'Clínica de Estética',
    city: 'Arapiraca - AL',
    address: 'Rua Domingos Correia, 412',
    googleRating: 4.9,
    googleMapsUrl: 'https://maps.google.com/?q=Bella+Pele+Estetica+Arapiraca',
    recommendedScript: 'script1',
    opportunityAngle: 'Telefone repetido da Bella Pele para teste do critério de telefone',
  },
];

