/**
 * Utilitários para análise e classificação de categorias de empresas
 * e validação de relevância em relação ao nicho alvo de prospecção.
 */

export interface NicheFitResult {
  category: string;
  isNicheMatch: boolean;
  mismatchReason?: string;
}

const normalize = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Deduz a categoria do negócio a partir do nome ou da categoria bruta da planilha
 */
export const inferCategory = (companyName: string, rawCategory?: string): string => {
  if (rawCategory && rawCategory.trim().length > 1) {
    const cleanRaw = rawCategory.trim();
    // Se a categoria veio com código ou prefixo esquisito, limpa
    return cleanRaw.charAt(0).toUpperCase() + cleanRaw.slice(1);
  }

  const norm = normalize(companyName);

  // Nutrição / Nutrologia
  if (norm.includes('nutri') || norm.includes('nutricao')) {
    if (norm.includes('clinica')) return 'Clínica de Nutrição';
    if (norm.includes('consultorio')) return 'Consultório de Nutrição';
    if (norm.includes('esportiv')) return 'Nutrição Esportiva';
    if (norm.includes('funcional')) return 'Nutrição Funcional';
    return 'Nutricionista';
  }
  if (norm.includes('nutrolog')) return 'Nutrologia / Médico Nutrólogo';
  if (norm.includes('emagrecimento')) return 'Clínica de Emagrecimento';

  // Fora do nicho de nutrição (muito frequentes em buscas de nutricionista)
  if (norm.includes('academia') || norm.includes('gym') || norm.includes('iron fit') || norm.includes('smart fit') || norm.includes('bluefit')) {
    return 'Academia';
  }
  if (norm.includes('suplement') || norm.includes('suplemento') || norm.includes('nutri shop') || norm.includes('whey')) {
    return 'Loja de Suplementos';
  }
  if (norm.includes('crossfit') || norm.includes('box cross') || norm.includes('treinamento funcional')) {
    return 'Crossfit / Centro de Treinamento';
  }
  if (norm.includes('personal') || norm.includes('treinador')) {
    return 'Personal Trainer';
  }
  if (norm.includes('farmacia') || norm.includes('drogaria') || norm.includes('manipulacao')) {
    return 'Farmácia de Manipulação';
  }
  if (norm.includes('restaurante') || norm.includes('marmita') || norm.includes('fitness food') || norm.includes('marmitaria')) {
    return 'Restaurante / Marmitas Fitness';
  }

  // Odonto
  if (norm.includes('odonto') || norm.includes('dentista') || norm.includes('orto') || norm.includes('sorriso')) {
    return 'Consultório Odontológico';
  }

  // Medicina / Saúde geral
  if (norm.includes('clinica')) return 'Clínica';
  if (norm.includes('consultorio')) return 'Consultório';
  if (norm.includes('hospital') || norm.includes('policlinica')) return 'Policlínica';
  if (norm.includes('estetica') || norm.includes('spa')) return 'Estética / Spa';

  // Advocacia
  if (norm.includes('advocacia') || norm.includes('advogad') || norm.includes('juridic')) {
    return 'Escritório de Advocacia';
  }

  return 'Negócio Local';
};

/**
 * Avalia se a categoria identificada faz sentido para o nicho atual de prospecção.
 * Por exemplo: na planilha de nutricionista, descarta 'Academia', 'Loja de Suplementos', 'Crossfit', etc.
 */
export const evaluateNicheFit = (
  companyName: string,
  rawCategory: string | undefined,
  niche: { name: string; segment: string }
): NicheFitResult => {
  const category = inferCategory(companyName, rawCategory);
  const normCat = normalize(category);
  const normComp = normalize(companyName);
  const normNiche = normalize(niche.name + ' ' + niche.segment);

  // CASO 1: Nicho de Nutricionistas / Nutrição / Nutrologia
  if (normNiche.includes('nutri') || normNiche.includes('emagrecimento')) {
    // Categorias expressamente fora do nicho de nutricionistas
    const offNicheNutrition: { match: string; reason: string }[] = [
      {
        match: 'academia',
        reason: "Categoria 'Academia' não faz sentido no nicho de Nutricionistas (estabelecimento de treino/fitness, não consultório de atendimento nutricional).",
      },
      {
        match: 'suplement',
        reason: "Categoria 'Loja de Suplementos' é comércio varejista de produtos, fora do perfil de prestação de serviços de nutricionistas.",
      },
      {
        match: 'crossfit',
        reason: "Categoria 'Crossfit / Centro de Treinamento' é estabelecimento esportivo, não atendimento de nutrição clínica.",
      },
      {
        match: 'personal',
        reason: "Categoria 'Personal Trainer' é instrutor de educação física, diferente do profissional de nutrição.",
      },
      {
        match: 'farmacia',
        reason: "Categoria 'Farmácia / Drogaria' é comércio de medicamentos, fora do nicho de nutricionistas.",
      },
      {
        match: 'drogaria',
        reason: "Categoria 'Drogaria' é comércio de medicamentos, fora do nicho de nutricionistas.",
      },
      {
        match: 'restaurante',
        reason: "Categoria 'Restaurante / Alimentação' é comércio de refeições prontas, fora de consultório de nutrição.",
      },
      {
        match: 'marmita',
        reason: "Categoria 'Marmitaria' é delivery de alimentos, não consultório de nutricionista.",
      },
      {
        match: 'roupas',
        reason: "Categoria 'Loja de Roupas' não faz sentido no nicho de nutricionistas.",
      },
      {
        match: 'salao',
        reason: "Categoria 'Salão de Beleza' é serviço de cabelo/unha, fora de nutrição.",
      },
      {
        match: 'pet',
        reason: "Categoria 'Pet Shop' incompatível com nutricionistas humanos.",
      },
    ];

    for (const item of offNicheNutrition) {
      if (normCat.includes(item.match) || normComp.includes(item.match)) {
        return {
          category,
          isNicheMatch: false,
          mismatchReason: item.reason,
        };
      }
    }

    // Categorias confirmadas do nicho de nutrição
    const isNutritionist =
      normCat.includes('nutri') ||
      normCat.includes('nutrolog') ||
      normCat.includes('emagrecimento') ||
      normComp.includes('nutri') ||
      normComp.includes('nutrolog');

    if (isNutritionist) {
      return {
        category,
        isNicheMatch: true,
      };
    }

    // Se é apenas "Clínica" ou "Consultório" sem menção de nutrição, permite com ressalva
    if (normCat.includes('clinica') || normCat.includes('consultorio')) {
      return {
        category,
        isNicheMatch: true,
      };
    }

    // Demais categorias desconhecidas
    return {
      category,
      isNicheMatch: true,
    };
  }

  // CASO 2: Nicho de Odontologia / Dentistas
  if (normNiche.includes('odonto') || normNiche.includes('dentist')) {
    const offNicheOdonto = [
      { match: 'protese dentaria laboratorio', reason: "Laboratório de próteses não atende paciente final como consultório dentário." },
      { match: 'materiais odontologicos', reason: "Loja de suprimentos odontológicos não é consultório de dentista." },
      { match: 'academia', reason: "Academia incompatível com nicho odontológico." },
      { match: 'farmacia', reason: "Farmácia fora do nicho de dentistas." },
      { match: 'pet', reason: "Pet shop fora do nicho de dentistas." },
    ];
    for (const item of offNicheOdonto) {
      if (normCat.includes(item.match) || normComp.includes(item.match)) {
        return {
          category,
          isNicheMatch: false,
          mismatchReason: item.reason,
        };
      }
    }
    return { category, isNicheMatch: true };
  }

  // CASO 3: Nicho de Advocacia
  if (normNiche.includes('advoc') || normNiche.includes('jurid')) {
    const offNicheLaw = [
      { match: 'despachante', reason: "Despachante não é escritório de advocacia." },
      { match: 'contabilidade', reason: "Escritório contábil, fora de advocacia." },
      { match: 'imobiliaria', reason: "Imobiliária fora do nicho de advocacia." },
      { match: 'academia', reason: "Academia fora do nicho jurídico." },
    ];
    for (const item of offNicheLaw) {
      if (normCat.includes(item.match) || normComp.includes(item.match)) {
        return {
          category,
          isNicheMatch: false,
          mismatchReason: item.reason,
        };
      }
    }
    return { category, isNicheMatch: true };
  }

  // CASO GENÉRICO: Detecta se a categoria é discrepante evidente
  const commonMismatches = ['academia', 'oficina mecanica', 'pet shop', 'lava rapido', 'motel', 'bar'];
  for (const cm of commonMismatches) {
    if ((normCat.includes(cm) || normComp.includes(cm)) && !normNiche.includes(cm)) {
      return {
        category,
        isNicheMatch: false,
        mismatchReason: `A categoria '${category}' não é coerente com o nicho de '${niche.name}'.`,
      };
    }
  }

  return {
    category,
    isNicheMatch: true,
  };
};
