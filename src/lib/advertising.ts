export type AdsConfigInput = {
  enabled: string | undefined;
  cmpUrl: string | undefined;
  publisherId: string | undefined;
  firstSlot: string | undefined;
  secondSlot: string | undefined;
  privacyUrl: string | undefined;
  sellerLine: string | undefined;
};

export type AdsConfig = {
  enabled: boolean;
  cmpUrl: string;
  publisherId: string;
  firstSlot: string;
  secondSlot: string | null;
  privacyUrl: string;
  sellerLine: string;
};

const emptyConfig: AdsConfig = {
  enabled: false, cmpUrl: '', publisherId: '', firstSlot: '', secondSlot: null, privacyUrl: '', sellerLine: ''
};

export function validateAdsConfig(input: AdsConfigInput): AdsConfig {
  if (input.enabled === undefined || input.enabled === '' || input.enabled === 'false') return emptyConfig;
  if (input.enabled !== 'true') throw new Error('VITE_ADS_ENABLED must be exactly true or false.');
  const required: (keyof AdsConfigInput)[] = ['cmpUrl', 'publisherId', 'firstSlot', 'privacyUrl', 'sellerLine'];
  for (const key of required) if (!input[key]?.trim()) throw new Error(`Advertising is enabled but ${key} is missing.`);
  const cmp = new URL(input.cmpUrl!);
  if (cmp.protocol !== 'https:' || cmp.hostname !== 'fundingchoicesmessages.google.com' || cmp.username || cmp.password || cmp.port || cmp.hash || cmp.pathname !== `/i/${input.publisherId!.slice(3)}`) {
    throw new Error('VITE_ADS_CMP_URL must be the HTTPS account-generated Funding Choices script URL for the configured publisher ID.');
  }
  if (!/^ca-pub-\d{16}$/.test(input.publisherId!)) throw new Error('VITE_ADS_PUBLISHER_ID must be a real AdSense publisher ID (ca-pub- followed by 16 digits).');
  const slot = (value: string, key: string) => {
    if (!/^\d{10}$/.test(value)) throw new Error(`${key} must be a numeric AdSense slot ID.`);
    return value;
  };
  const firstSlot = slot(input.firstSlot!, 'VITE_ADS_FIRST_SLOT');
  const secondSlot = input.secondSlot?.trim() ? slot(input.secondSlot.trim(), 'VITE_ADS_SECOND_SLOT') : null;
  if (firstSlot === secondSlot) throw new Error('AdSense slot IDs must be distinct.');
  const privacy = new URL(input.privacyUrl!);
  if (privacy.protocol !== 'https:' || privacy.username || privacy.password || privacy.hash) throw new Error('VITE_ADS_PRIVACY_URL must be an approved HTTPS privacy-policy URL.');
  const seller = input.sellerLine!.trim();
  const match = /^google\.com,\s*(pub-\d{16}),\s*DIRECT,\s*f08c47fec0942fa0$/.exec(seller);
  if (!match || `ca-${match[1]}` !== input.publisherId) throw new Error('VITE_ADS_SELLER_LINE must be the real Google DIRECT seller line matching the publisher ID.');
  return { enabled: true, cmpUrl: cmp.href, publisherId: input.publisherId!, firstSlot, secondSlot, privacyUrl: privacy.href, sellerLine: seller };
}

export const LONG_ARTICLE_THRESHOLD_WORDS = 1200;

export type PlacementSegment = { html: string; card: boolean };
export type AdPlacement = { afterSegment: number; slot: 'first' | 'second' };
export function isArticleAdEligible(item: { kind: string; path: string; title: string }): boolean {
  return item.kind !== 'page' && !/(privacy|terms|disclaimer)/i.test(`${item.path} ${item.title}`);
}

function substantialParagraphs(html: string): number {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)].filter((match) =>
    (match[1]!.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0) >= 25
  ).length;
}

export function articleWordCount(segments: PlacementSegment[]): number {
  return segments.reduce((count, segment) => count + (segment.card ? 0 : (segment.html.replace(/<[^>]*>/g, ' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0)), 0);
}

/** First slot follows substantive authored prose; second is only after the recipe and two substantial paragraphs. */
export function selectAdPlacements(segments: PlacementSegment[], eligible: boolean, hasRecipe: boolean): AdPlacement[] {
  if (!eligible) return [];
  const placements: AdPlacement[] = [];
  const first = segments.findIndex((segment) => !segment.card && substantialParagraphs(segment.html) > 0);
  if (first < 0) return placements;
  placements.push({ afterSegment: first, slot: 'first' });
  if (!hasRecipe || articleWordCount(segments) < LONG_ARTICLE_THRESHOLD_WORDS) return placements;
  const recipe = segments.findIndex((segment) => segment.card);
  if (recipe < 0) return placements;
  let paragraphsSinceRecipe = 0;
  for (let index = recipe + 1; index < segments.length; index += 1) {
    const segment = segments[index]!;
    if (segment.card) continue;
    paragraphsSinceRecipe += substantialParagraphs(segment.html);
    if (paragraphsSinceRecipe >= 2) {
      placements.push({ afterSegment: index, slot: 'second' });
      break;
    }
  }
  return placements;
}

export type TcfPermission = { gdprApplies?: boolean; eventStatus?: string; cmpStatus?: string; purpose?: { consents?: Record<number, boolean> }; vendor?: { consents?: Record<number, boolean> } };
export function hasAdConsent(data: TcfPermission | null | undefined): boolean {
  if (!data || data.cmpStatus !== 'loaded' || !['tcloaded', 'useractioncomplete'].includes(data.eventStatus ?? '')) return false;
  if (data.gdprApplies === false) return true;
  if (data.gdprApplies !== true) return false;
  return [1, 2, 3, 4, 7].every((purpose) => data.purpose?.consents?.[purpose] === true) && data.vendor?.consents?.[755] === true;
}

const usGppSections: Record<number, string> = {
  7: 'usnat', 8: 'usca', 9: 'usva', 10: 'usco', 11: 'usut', 12: 'usct', 13: 'usfl',
  14: 'usmt', 15: 'usor', 16: 'ustx', 17: 'usde', 18: 'usia', 19: 'usne', 20: 'usnh',
  21: 'usnj', 22: 'ustn', 23: 'usmn', 24: 'usmd', 25: 'usin', 26: 'usky', 27: 'usri'
};
export type GppPingData = {
  signalStatus?: string;
  applicableSections?: number[];
  parsedSections?: Record<string, unknown>;
};
/** Only consume a ready, current GPP signal; unknown or opted-out US data denies ad requests. */
export function hasCurrentGppAdsPermission(data: GppPingData | null | undefined): boolean {
  if (!data || data.signalStatus !== 'ready' || !Array.isArray(data.applicableSections) || data.applicableSections.length === 0 ||
      !data.parsedSections || typeof data.parsedSections !== 'object' || Array.isArray(data.parsedSections)) return false;
  for (const sectionId of data.applicableSections) {
    if (sectionId === -1 || sectionId === 2 || sectionId === 3) continue;
    const prefix = usGppSections[sectionId];
    if (!prefix) return false;
    const segments = data.parsedSections[prefix];
    if (!Array.isArray(segments)) return false;
    let foundOptOutField = false;
    for (const segment of segments) {
      if (segment === null || typeof segment !== 'object' || Array.isArray(segment)) return false;
      const fields = segment as Record<string, unknown>;
      if (fields.Gpc === true) return false;
      for (const field of ['SaleOptOut', 'SharingOptOut', 'TargetedAdvertisingOptOut']) {
        if (!(field in fields)) continue;
        const value = fields[field];
        if (value !== 0 && value !== 2) return false;
        foundOptOutField = true;
      }
    }
    if (!foundOptOutField) return false;
  }
  return true;
}

let currentAdPermission = false;
export function setAdPermission(value: boolean): void { currentAdPermission = value; }
export function hasCurrentAdPermission(): boolean { return currentAdPermission; }
