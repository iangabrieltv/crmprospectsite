import { NicheCampaign, Lead, ScriptDefinition } from '../types/crm';
import { cleanPhoneForWhatsApp, formatDisplayPhone } from './phone';

export const SCRIPT_1_MOCKUP: ScriptDefinition = {
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
  followUp1: `Oi! Passando só para não deixar minha mensagem perdida por aqui 😅

Eu fiz uma prévia da {Empresa} justamente porque encontrei vocês durante uma pesquisa de clínicas da região.

Não é compromisso de compra. Só queria mostrar o que montei para vocês.

Posso te enviar?`,
  followUp2: `Oi, {NomeContato}. Vou ser direto para não tomar seu tempo.

Eu montei uma prévia do site da {Empresa} e já está pronta para te mostrar.

Se quiser ver, me responde só com “pode enviar” que eu mando aqui.`,
  objections: [
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
      ],
    },
    {
      id: 'etapa-3',
      stageTitle: 'ETAPA 3 — DEPOIS QUE ELA VISUALIZAR',
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
      stageTitle: 'ETAPA 4 — PROPOSTA & FECHAMENTO',
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

export const SCRIPT_2_DIAGNOSTICO_GOOGLE: ScriptDefinition = {
  id: 'script2',
  title: 'Script 2 — Diagnóstico Google',
  subtitle: 'Contato → Descobrir Responsável → Apresentar Análise → Posição no Google → Marcar Reunião',
  description: 'Aborda a posição da clínica no Google e gera curiosidade para agendar uma chamada rápida de 10 minutos.',
  category: 'Diagnóstico Consultivo Google',
  goldenRule: {
    order: 'Contato → descobrir quem é responsável → apresentar a análise → mostrar a posição/oportunidade no Google → gerar curiosidade → marcar reunião',
    primaryGoal: 'O objetivo da abordagem NÃO é vender o site pelo WhatsApp. O objetivo é conseguir a REUNIÃO de 10 minutos.',
    insight: 'Na reunião, você apresenta o diagnóstico e, a partir do que encontrou, mostra como um site e uma estrutura digital podem ajudar a resolver os pontos identificados.',
  },
  structure: {
    hook: 'Boa tarde, tudo bem? Esse número é da {Empresa}?',
    problem: 'Nas pesquisas de {Nicho} em {Cidade}, a clínica aparece mais abaixo enquanto outros negócios aparecem antes.',
    solution: 'Análise objetiva dos pontos que podem ser melhorados na apresentação digital.',
    cta: 'Você teria uns 10 minutos para eu te apresentar isso? Qual horário costuma ser melhor para você?',
  },
  template: `Boa tarde, tudo bem? Esse número é da {Empresa}?`,
  followUp1: `Oi, {NomeContato}. Passando só para retomar aquela mensagem.

Eu estava falando sobre a análise que fiz da {Empresa} no Google.

Encontrei alguns pontos interessantes sobre como vocês aparecem nas pesquisas.

Consigo te mostrar tudo em uma conversa bem rápida.`,
  followUp2: `Oi, {NomeContato}.

Vou ser direto para não tomar seu tempo.

Fiz uma análise da presença da {Empresa} no Google e queria te mostrar alguns pontos que encontrei.

São só 10 minutos.

Qual horário fica melhor para você?`,
  objections: [
    {
      id: 'obj2-manda-whats',
      trigger: 'Pode mandar pelo WhatsApp',
      title: 'Se a pessoa disser: "Pode mandar pelo WhatsApp"',
      response: `Claro.

Eu posso te mandar a análise por aqui.

Mas algumas partes ficam muito mais fáceis de entender quando eu mostro ao vivo.

Podemos fazer uma conversa de uns 10 minutos e eu te mostro tudo de forma bem objetiva.

Qual horário fica melhor para vocês?`,
    },
    {
      id: 'obj2-sem-tempo',
      trigger: 'Não tenho tempo agora',
      title: 'Se disser: "Não tenho tempo"',
      response: `Tranquilo.

Por isso mesmo eu pensei em fazer algo bem rápido.

São cerca de 10 minutos, só para te mostrar o que encontrei.

Se agora estiver corrido, qual outro horário seria melhor?`,
    },
    {
      id: 'obj2-instagram',
      trigger: 'Já temos Instagram',
      title: 'Se disser: "Já temos Instagram"',
      response: `Sim, eu vi que vocês têm presença no Instagram.

A análise que fiz é um pouco diferente.

Estou olhando principalmente para como a clínica aparece quando uma pessoa procura pelo serviço no Google.

É justamente essa parte que eu queria te mostrar na reunião.`,
    },
    {
      id: 'obj2-ja-tem-site',
      trigger: 'Já temos site',
      title: 'Se disser: "Já temos site"',
      response: `Perfeito.

Então a análise fica até mais interessante, porque eu consigo avaliar também como essa presença está sendo utilizada nas pesquisas do Google.

Posso te mostrar o que encontrei em uma conversa rápida?`,
    },
    {
      id: 'obj2-sem-interesse',
      trigger: 'Não tenho interesse',
      title: 'Se disser: "Não tenho interesse"',
      response: `Sem problema.

Eu só queria apresentar porque fiz a análise especificamente da clínica.

Obrigado pelo seu tempo.`,
    },
  ],
  stages: [
    {
      id: 's2-etapa-1',
      stageTitle: '1. PRIMEIRO CONTATO & FILTRO',
      description: 'Abertura para descobrir quem está do outro lado da linha.',
      steps: [
        {
          id: 's2-msg-1',
          title: 'Opção Principal — Abertura',
          condition: 'Primeira mensagem enviada para a empresa',
          message: `Boa tarde, tudo bem? Esse número é da {Empresa}?`,
          tip: 'Mensagem de validação direta e natural.',
        },
        {
          id: 's2-sim',
          title: 'Se responder SIM',
          condition: 'Quando confirmarem que o número é da clínica',
          message: `Perfeito.

Meu nome é {SeuNome}, eu trabalho com presença digital para negócios locais.

Eu estava fazendo uma análise de algumas clínicas de {Cidade} no Google e acabei encontrando a {Empresa}.

Aí eu queria falar rapidinho com vocês sobre uma coisa que encontrei na pesquisa.`,
          tip: 'Gera curiosidade profissional sem tentar vender nada ainda.',
        },
      ],
    },
    {
      id: 's2-etapa-2',
      stageTitle: '2. DESCOBRINDO QUEM ESTÁ DO OUTRO LADO',
      description: 'Descobrir quem é o responsável ou lidar com a secretária.',
      steps: [
        {
          id: 's2-secretaria-filtro',
          title: 'Se disser que é a secretária/recepção',
          condition: 'Quando a secretária se identificar',
          message: `Ah, perfeito. Você consegue me ajudar com uma informação?

Quem é a pessoa responsável por essa parte de marketing ou pela parte digital da clínica?`,
          tip: 'Pergunta educada que quase sempre revela o nome do responsável.',
        },
        {
          id: 's2-nome-responsavel',
          title: 'Se ela disser o nome do responsável',
          condition: 'Assim que ela falar o nome',
          message: `Perfeito. Ele(a) está disponível agora?`,
          tip: 'Verificação rápida de disponibilidade.',
        },
        {
          id: 's2-sobre-o-que',
          title: 'Se a secretária perguntar “Sobre o que?”',
          condition: 'Caso peçam assunto antes de passar a ligação/conversa',
          message: `É sobre uma análise que fiz da clínica no Google.

Eu estava verificando como vocês aparecem quando alguém pesquisa por serviços de {Nicho} aqui em {Cidade} e encontrei alguns pontos que achei interessantes.

Por exemplo, em uma das pesquisas que fiz, a clínica apareceu por volta da 4ª ou 5ª posição.

Enquanto isso, existem outros negócios aparecendo antes.

Queria justamente mostrar essa análise para o responsável e explicar alguns pontos que encontrei.`,
          tip: 'Argumento factual irrefutável: mostra que você fez uma pesquisa real.',
        },
        {
          id: 's2-responsavel-disponivel',
          title: 'Se a secretária disser que o responsável está',
          condition: 'Quando o responsável estiver no local',
          message: `Perfeito, pode me passar para ele(a), por favor?`,
          tip: 'Transferência direta para o decisor.',
        },
        {
          id: 's2-responsavel-indisponivel',
          title: 'Se o responsável NÃO estiver disponível',
          condition: 'Caso ele não esteja no momento',
          message: `Sem problema.

Você consegue me passar o melhor horário para eu falar com ele(a)?

É uma análise rápida que fiz da clínica no Google e queria apresentar diretamente para o responsável.`,
          tip: 'Pega o melhor horário para ligar/mandar mensagem de volta.',
        },
        {
          id: 's2-recado',
          title: 'Se perguntarem se podem anotar um recado',
          condition: 'Quando a secretária oferecer para anotar',
          message: `Claro.

Pode avisar que é o {SeuNome}, e que fiz uma análise da presença da clínica no Google e encontrei alguns pontos que gostaria de apresentar.

Meu objetivo é marcar uma conversa rápida para mostrar essa análise.`,
          tip: 'Recado profissional focado na análise do Google.',
        },
        {
          id: 's2-explica-para-mim',
          title: 'Se a secretária disser “Pode explicar para mim”',
          condition: 'Caso a secretária queira saber antes de repassar',
          message: `Claro.

Basicamente, eu estava analisando como a clínica aparece para pessoas que procuram pelos serviços de vocês no Google.

Encontrei algumas pesquisas em que vocês aparecem mais abaixo e existem outros negócios aparecendo antes.

Além disso, encontrei alguns pontos na apresentação digital da clínica que podem ser melhorados.

Eu consigo mostrar tudo isso visualmente em uma conversa bem rápida.

Se você achar interessante, eu apresento para você e, caso faça sentido, você pode encaminhar para o responsável.`,
          tip: 'Alinha com a secretária tornando-a sua aliada interna.',
        },
      ],
    },
    {
      id: 's2-etapa-3',
      stageTitle: '3. QUANDO FALAR COM O RESPONSÁVEL',
      description: 'Pitch direto de 4 etapas para agendar a reunião de 10 minutos.',
      steps: [
        {
          id: 's2-resp-abertura',
          title: '5. Abertura com o Responsável',
          condition: 'Ao falar com o dono, médico ou gestor',
          message: `Boa tarde, {NomeContato}, tudo bem?

Meu nome é {SeuNome}.

Eu estava fazendo uma análise de algumas clínicas da região no Google e encontrei a {Empresa}.

Fui analisar algumas pesquisas relacionadas aos serviços de vocês e encontrei uma situação que achei interessante mostrar.`,
          tip: 'Apresentação curta e objetiva.',
        },
        {
          id: 's2-resp-problema',
          title: '6. Apresentação do Problema / Posição',
          condition: 'Apresentar a situação da pesquisa no Google',
          message: `Por exemplo, quando pesquisei {Nicho} em {Cidade}, vocês apareceram mais abaixo nas buscas.

E antes de vocês aparecem outros negócios.

O ponto é que, quando uma pessoa faz essa pesquisa, ela acaba vendo essas outras opções primeiro.

E foi justamente por isso que eu parei para analisar o perfil de vocês um pouco melhor.`,
          tip: 'Conecta o problema à perda de pacientes.',
        },
        {
          id: 's2-resp-curiosidade',
          title: '7. Gerar Curiosidade',
          condition: 'Preparar a ponte para a chamada',
          message: `Eu encontrei alguns pontos na presença digital da clínica que podem ser trabalhados.

Não queria ficar te explicando tudo por mensagem/ligação porque acaba ficando confuso.

Eu tenho essa análise aqui e consigo te mostrar de forma muito mais clara.`,
          tip: 'Justifica por que a reunião visual é necessária.',
        },
        {
          id: 's2-resp-cta',
          title: '8. CTA — Marcar a Reunião (10 minutos)',
          condition: 'Fechamento do agendamento',
          message: `Você teria uns 10 minutos para eu te apresentar isso?

Pode ser por uma chamada rápida mesmo.

Eu te mostro o que encontrei, como vocês estão aparecendo hoje e alguns pontos que podem ser melhorados.

Qual horário costuma ser melhor para você?`,
          tip: 'Pergunta com alternativa de horário, não pergunta se quer.',
        },
      ],
    },
    {
      id: 's2-etapa-4',
      stageTitle: '4. FOLLOW-UPS SE NÃO RESPONDER',
      description: 'Retomadas estratégicas após o primeiro contato.',
      steps: [
        {
          id: 's2-fu-1',
          title: 'Follow-up 1 — Reativação Suave',
          condition: '24h a 48h sem retorno',
          message: `Oi, {NomeContato}. Passando só para retomar aquela mensagem.

Eu estava falando sobre a análise que fiz da {Empresa} no Google.

Encontrei alguns pontos interessantes sobre como vocês aparecem nas pesquisas.

Consigo te mostrar tudo em uma conversa bem rápida.`,
          tip: 'Lembrete curto e respeitoso.',
        },
        {
          id: 's2-fu-2',
          title: 'Follow-up 2 — Mais Direto (10 minutos)',
          condition: 'Após 48h sem retorno do follow-up 1',
          message: `Oi, {NomeContato}.

Vou ser direto para não tomar seu tempo.

Fiz uma análise da presença da {Empresa} no Google e queria te mostrar alguns pontos que encontrei.

São só 10 minutos.

Qual horário fica melhor para você?`,
          tip: 'Direto ao ponto com pergunta clara de horário.',
        },
      ],
    },
  ],
};

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

export const DEFAULT_SCRIPTS: Record<string, ScriptDefinition> = {
  script1: SCRIPT_1_MOCKUP,
  script2: SCRIPT_2_DIAGNOSTICO_GOOGLE,
  script3: SCRIPT_3_COLD_CALL,
};

export const INITIAL_NICHES: NicheCampaign[] = [
  {
    id: 'niche-clinicas-locais',
    name: 'Clínicas & Consultórios',
    segment: 'Clínicas Médicas & Odontológicas',
    city: 'São Paulo - SP',
    emoji: '🩺',
    targetMrr: 5000,
    createdAt: new Date().toISOString(),
    scripts: { ...DEFAULT_SCRIPTS },
  },
];

// LISTA DE CONTATOS LIMPA CONFORME SOLICITADO PELO USUÁRIO
export const INITIAL_LEADS: Lead[] = [];

export const SAMPLE_IMPORT_LEADS = [
  {
    companyName: 'Clínica Odonto Prime Moema',
    contactName: 'Dra. Camila',
    phone: '11984210011',
    city: 'São Paulo - SP',
    address: 'Av. Moema, 450',
    googleRating: 4.9,
    recommendedScript: 'script1',
    opportunityAngle: 'Clínica com ótimas avaliações precisando de prévia de site',
  },
  {
    companyName: 'Sorriso & Arte Odontologia',
    contactName: 'Dr. Fernando',
    phone: '11971123344',
    city: 'São Paulo - SP',
    address: 'Rua Augusta, 1890',
    googleRating: 4.8,
    recommendedScript: 'script1',
    opportunityAngle: 'Sem agendamento online no perfil do Google',
  },
  {
    companyName: 'Consultório Odonto Pinheiros',
    contactName: 'Dr. Lucas',
    phone: '11985449988',
    city: 'São Paulo - SP',
    address: 'Rua dos Pinheiros, 830',
    googleRating: 4.7,
    recommendedScript: 'script1',
    opportunityAngle: 'Site antigo não adaptado para smartphones',
  },
];
