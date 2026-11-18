import {
  Client,
  SOCIAL_POST_STATUS_OPTIONS,
  SocialChannel,
  SocialFormat,
  SocialPlatform,
  SocialPost,
  SocialPostStatus,
  getSocialFormatLabel,
  getSocialPlatformLabel,
  getSocialPostStatusMeta,
} from '../../types/kaizen';
import { ResolvedAnalyticsPeriod } from '../../types/analytics';
import {
  buildTimeBucketsForPeriod,
  computeRatioPct,
  extractLocalYmd,
  getBucketKeyForYmd,
  isDateInRange,
} from './periodService';

export interface SocialEditorialPoint {
  key: string;
  label: string;
  plannedCount: number;
  publishedCount: number;
}

export interface SocialAnalyticsSnapshot {
  period: ResolvedAnalyticsPeriod;
  totalChannels: number;
  activeChannelsCount: number;
  totalPostsBase: number;
  plannedInPeriodCount: number;
  publishedInPeriodCount: number;
  previousPublishedInPeriodCount: number;
  awaitingApprovalCount: number;
  approvedNotPublishedCount: number;
  overduePlannedCount: number;
  kaizenPostsInPeriod: number;
  clientPostsInPeriod: number;
  publicationComplianceRatePct: number | null;
  byStatus: { status: SocialPostStatus; label: string; count: number }[];
  byPlatform: { platform: SocialPlatform; label: string; total: number; published: number }[];
  byFormat: { format: SocialFormat; label: string; total: number; published: number }[];
  byOwnerEntity: {
    key: string;
    label: string;
    ownerType: 'kaizen' | 'client';
    totalInPeriod: number;
    publishedInPeriod: number;
    overdueCount: number;
  }[];
  overduePosts: {
    id: string;
    title: string;
    ownerLabel: string;
    platformLabel: string;
    plannedDate: string;
    statusLabel: string;
  }[];
  timeSeries: SocialEditorialPoint[];
  externalMetricsConnected: false;
  externalMetricsLimitationNote: string;
}

export function computeSocialAnalytics(params: {
  channels: SocialChannel[];
  posts: SocialPost[];
  clients: Client[];
  period: ResolvedAnalyticsPeriod;
  todayStr: string;
  timezone?: string;
}): SocialAnalyticsSnapshot {
  const { channels, posts, clients, period, todayStr, timezone } = params;
  const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));

  const activeChannelsCount = channels.filter((c) => c.active).length;

  let plannedInPeriodCount = 0;
  let publishedInPeriodCount = 0;
  let previousPublishedInPeriodCount = 0;
  let awaitingApprovalCount = 0;
  let approvedNotPublishedCount = 0;
  let overduePlannedCount = 0;
  let kaizenPostsInPeriod = 0;
  let clientPostsInPeriod = 0;

  const statusCounts = new Map<SocialPostStatus, number>();
  const platformAgg = new Map<SocialPlatform, { total: number; published: number }>();
  const formatAgg = new Map<SocialFormat, { total: number; published: number }>();
  const entityAgg = new Map<
    string,
    {
      label: string;
      ownerType: 'kaizen' | 'client';
      totalInPeriod: number;
      publishedInPeriod: number;
      overdueCount: number;
    }
  >();

  const overduePosts: SocialAnalyticsSnapshot['overduePosts'] = [];

  const buckets = buildTimeBucketsForPeriod(period);
  const seriesMap = new Map<string, SocialEditorialPoint>();
  for (const b of buckets) {
    seriesMap.set(b.key, {
      key: b.key,
      label: b.label,
      plannedCount: 0,
      publishedCount: 0,
    });
  }

  for (const post of posts) {
    statusCounts.set(post.status, (statusCounts.get(post.status) || 0) + 1);

    const pCur = platformAgg.get(post.platform) || { total: 0, published: 0 };
    pCur.total += 1;
    if (post.status === 'publicado') pCur.published += 1;
    platformAgg.set(post.platform, pCur);

    const fCur = formatAgg.get(post.format) || { total: 0, published: 0 };
    fCur.total += 1;
    if (post.status === 'publicado') fCur.published += 1;
    formatAgg.set(post.format, fCur);

    if (post.status === 'revisao') awaitingApprovalCount += 1;
    if (post.status === 'aprovado') approvedNotPublishedCount += 1;

    const plannedInPeriod = Boolean(
      post.plannedDate &&
        isDateInRange(post.plannedDate, period.startDate, period.endDate, timezone)
    );
    const publishedDateRef = post.publishedAt || (post.status === 'publicado' ? post.updatedAt || post.plannedDate : undefined);
    const publishedInPeriod =
      post.status === 'publicado' &&
      Boolean(
        publishedDateRef &&
          isDateInRange(publishedDateRef, period.startDate, period.endDate, timezone)
      );
    const publishedInPrevPeriod =
      post.status === 'publicado' &&
      Boolean(
        publishedDateRef &&
          isDateInRange(
            publishedDateRef,
            period.previousStartDate,
            period.previousEndDate,
            timezone
          )
      );

    if (plannedInPeriod) {
      plannedInPeriodCount += 1;
      const bKey = getBucketKeyForYmd(post.plannedDate as string, buckets);
      if (bKey && seriesMap.has(bKey)) seriesMap.get(bKey)!.plannedCount += 1;
    }
    if (publishedInPeriod) {
      publishedInPeriodCount += 1;
      const pubYmd = extractLocalYmd(publishedDateRef, timezone);
      if (pubYmd) {
        const bKey = getBucketKeyForYmd(pubYmd, buckets);
        if (bKey && seriesMap.has(bKey)) seriesMap.get(bKey)!.publishedCount += 1;
      }
    }
    if (publishedInPrevPeriod) {
      previousPublishedInPeriodCount += 1;
    }

    const inEditorialPeriod = plannedInPeriod || publishedInPeriod;
    if (inEditorialPeriod) {
      if (post.ownerType === 'kaizen') kaizenPostsInPeriod += 1;
      else clientPostsInPeriod += 1;
    }

    const isOverdue =
      post.status !== 'publicado' &&
      Boolean(post.plannedDate) &&
      (post.plannedDate as string) < todayStr;
    const ownerLabel =
      post.ownerType === 'kaizen'
        ? 'Agência Kaizen'
        : (post.clientId ? clientMap.get(post.clientId) : '') || 'Cliente não identificado';

    if (isOverdue) {
      overduePlannedCount += 1;
      overduePosts.push({
        id: post.id,
        title: post.title,
        ownerLabel,
        platformLabel: getSocialPlatformLabel(post.platform, post.customPlatformName),
        plannedDate: post.plannedDate as string,
        statusLabel: getSocialPostStatusMeta(post.status).label,
      });
    }

    const entityKey =
      post.ownerType === 'kaizen' ? 'kaizen' : post.clientId || 'client_unlinked';
    const curEntity = entityAgg.get(entityKey) || {
      label: ownerLabel,
      ownerType: post.ownerType,
      totalInPeriod: 0,
      publishedInPeriod: 0,
      overdueCount: 0,
    };
    if (inEditorialPeriod) curEntity.totalInPeriod += 1;
    if (publishedInPeriod) curEntity.publishedInPeriod += 1;
    if (isOverdue) curEntity.overdueCount += 1;
    entityAgg.set(entityKey, curEntity);
  }

  overduePosts.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));

  const byStatus = SOCIAL_POST_STATUS_OPTIONS.map((opt) => ({
    status: opt.id,
    label: opt.label,
    count: statusCounts.get(opt.id) || 0,
  }));

  const byPlatform = Array.from(platformAgg.entries())
    .map(([platform, v]) => ({
      platform,
      label: getSocialPlatformLabel(platform),
      total: v.total,
      published: v.published,
    }))
    .sort((a, b) => b.total - a.total);

  const byFormat = Array.from(formatAgg.entries())
    .map(([format, v]) => ({
      format,
      label: getSocialFormatLabel(format),
      total: v.total,
      published: v.published,
    }))
    .sort((a, b) => b.total - a.total);

  const byOwnerEntity = Array.from(entityAgg.entries())
    .map(([key, v]) => ({ key, ...v }))
    .filter((x) => x.totalInPeriod > 0 || x.publishedInPeriod > 0 || x.overdueCount > 0)
    .sort((a, b) => b.totalInPeriod - a.totalInPeriod);

  return {
    period,
    totalChannels: channels.length,
    activeChannelsCount,
    totalPostsBase: posts.length,
    plannedInPeriodCount,
    publishedInPeriodCount,
    previousPublishedInPeriodCount,
    awaitingApprovalCount,
    approvedNotPublishedCount,
    overduePlannedCount,
    kaizenPostsInPeriod,
    clientPostsInPeriod,
    publicationComplianceRatePct: computeRatioPct(
      publishedInPeriodCount,
      plannedInPeriodCount
    ),
    byStatus,
    byPlatform,
    byFormat,
    byOwnerEntity,
    overduePosts,
    timeSeries: Array.from(seriesMap.values()),
    externalMetricsConnected: false,
    externalMetricsLimitationNote:
      'Métricas externas de engajamento (alcance, impressões, curtidas, comentários e seguidores) não estão conectadas neste ambiente. Este painel mede exclusivamente o fluxo editorial, prazos e confirmações manuais de publicação.',
  };
}
