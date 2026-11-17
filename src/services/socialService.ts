import {
  Client,
  ProposalContract,
  SocialChannel,
  SocialPost,
  SocialPostStatus,
} from '../types/kaizen';

const SOCIAL_SCOPE_REGEX =
  /rede(s)?\s*sociai(s)?|social\s*media|instagram|facebook|tiktok|linkedin|conte[uú]do|calend[aá]rio\s*editorial|gest[aã]o\s*de\s*redes|posts?\s*fixados?/i;

export function generateSocialChannelId(): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `sch-${Date.now()}-${rand}`;
}

export function generateSocialPostId(): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `post-${Date.now()}-${rand}`;
}

/**
 * Checks whether a Client actually contracted social media management or has it explicitly enabled.
 * Never assumes every client has social management.
 */
export function hasContractedSocialManagement(
  client: Client,
  proposals: ProposalContract[] = [],
  existingChannels: SocialChannel[] = []
): boolean {
  if (client.socialManagementEnabled === true) return true;
  if (client.socialManagementEnabled === false) return false;

  if (client.serviceScope && SOCIAL_SCOPE_REGEX.test(client.serviceScope)) {
    return true;
  }

  const clientChannels = existingChannels.some(
    (ch) => ch.ownerType === 'client' && ch.clientId === client.id
  );
  if (clientChannels) return true;

  const clientProposals = proposals.filter(
    (p) =>
      p.clientId === client.id &&
      p.status !== 'recusada' &&
      p.status !== 'expirada'
  );

  for (const prop of clientProposals) {
    const textPool = [
      prop.title,
      prop.summary || '',
      ...prop.items.map((item) => `${item.title} ${item.description || ''}`),
    ].join(' ');
    if (SOCIAL_SCOPE_REGEX.test(textPool)) {
      return true;
    }
  }

  return false;
}

export function filterSocialEligibleClients(
  clients: Client[],
  proposals: ProposalContract[] = [],
  existingChannels: SocialChannel[] = []
): Client[] {
  return clients.filter((c) =>
    hasContractedSocialManagement(c, proposals, existingChannels)
  );
}

/**
 * Updates production stage inside the editorial pipeline.
 * NEVER promotes an approved post to 'publicado' automatically; that requires confirmSocialPostPublished().
 */
export function transitionSocialPostStage(
  post: SocialPost,
  targetStatus: SocialPostStatus
): SocialPost {
  if (targetStatus === 'publicado') {
    throw new Error(
      'Uma publicação não pode ser marcada como publicada automaticamente; utilize confirmação explícita do administrador.'
    );
  }

  const nowIso = new Date().toISOString();
  return {
    ...post,
    status: targetStatus,
    approvedAt: targetStatus === 'aprovado' ? post.approvedAt || nowIso : post.approvedAt,
    updatedAt: nowIso,
  };
}

/**
 * Explicit admin confirmation that the publication has actually gone live externally.
 */
export function confirmSocialPostPublished(
  post: SocialPost,
  confirmedBy: string
): SocialPost {
  const nowIso = new Date().toISOString();
  return {
    ...post,
    status: 'publicado',
    approvedAt: post.approvedAt || nowIso,
    publishedAt: nowIso,
    publishedConfirmedBy: confirmedBy.trim() || 'Administrador',
    updatedAt: nowIso,
  };
}
