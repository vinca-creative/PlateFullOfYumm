import sanitizeHtml from 'sanitize-html';
import { parseFragment, serialize } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import type { PublicContentItem } from './types.ts';

const ALLOWED_TAGS = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'dd', 'del', 'details', 'div',
  'dl', 'dt', 'em', 'figcaption', 'figure', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
  'ins', 'li', 'ol', 'p', 'pre', 'q', 's', 'small', 'span', 'strong', 'sub', 'summary', 'sup',
  'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'
];

const SANITIZER_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    '*': ['id'],
    a: ['href', 'title'],
    div: ['data-pfoy-recipe-card'],
    img: ['src', 'srcset', 'sizes', 'width', 'height', 'alt', 'loading', 'decoding'],
    td: ['colspan', 'rowspan', 'headers'],
    th: ['colspan', 'rowspan', 'scope', 'headers']
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: false,
  transformTags: {
    img: (tagName, attributes) => {
      const source = attributes.src;
      if (!source) {
        delete attributes.srcset;
        return { tagName, attribs: attributes };
      }
      let sourceUrl: URL;
      try {
        sourceUrl = new URL(source);
      } catch {
        delete attributes.src;
        delete attributes.srcset;
        return { tagName, attribs: attributes };
      }
      if (
        (sourceUrl.protocol !== 'https:' && sourceUrl.protocol !== 'http:') ||
        sourceUrl.username !== '' ||
        sourceUrl.password !== ''
      ) {
        delete attributes.src;
        delete attributes.srcset;
        return { tagName, attribs: attributes };
      }

      const srcset = attributes.srcset;
      if (!srcset) return { tagName, attribs: attributes };
      const candidates = srcset.split(',').map((candidate) => candidate.trim());
      const safeCandidates: string[] = [];
      for (const candidate of candidates) {
        const match = /^(https?:\/\/\S+)\s+(\d+w|(?:\d+(?:\.\d+)?)x)$/.exec(candidate);
        if (!match) {
          delete attributes.srcset;
          return { tagName, attribs: attributes };
        }
        try {
          const variant = new URL(match[1]);
          if (
            variant.host !== sourceUrl.host ||
            variant.username !== '' ||
            variant.password !== ''
          ) {
            delete attributes.srcset;
            return { tagName, attribs: attributes };
          }
        } catch {
          delete attributes.srcset;
          return { tagName, attribs: attributes };
        }
        safeCandidates.push(`${match[1]} ${match[2]}`);
      }
      attributes.srcset = safeCandidates.join(', ');
      return { tagName, attribs: attributes };
    }
  }
};

function createMarker(item: PublicContentItem, at: string): boolean {
  const id = item.card_id === null ? '' : String(item.card_id);
  const cardId = /^mv-creation-(\d+)$/.exec(at);
  return cardId !== null && id === cardId[1];
}

export interface ContentOrigins {
  publicOrigin: string;
  cmsOrigin: string;
}

function normalizedOrigin(value: string, at: string): string {
  const url = new URL(value);
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error(`${at} must be an HTTP(S) origin without credentials or a path`);
  }
  return url.origin;
}

function canonicalForPublicOrigin(canonical: string, publicOrigin: string, cmsOrigin: string): string {
  const url = new URL(canonical);
  if (url.origin === cmsOrigin) {
    return new URL(`${url.pathname}${url.search}${url.hash}`, publicOrigin).href;
  }
  if (url.origin !== publicOrigin) {
    throw new Error(`Canonical URL ${canonical} is outside the configured public origin`);
  }
  return url.href;
}

function publicLink(href: string, publicOrigin: string, cmsOrigin: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (url.origin === cmsOrigin && !url.pathname.startsWith('/wp-content/uploads/')) {
    return new URL(`${url.pathname}${url.search}${url.hash}`, publicOrigin).href;
  }
  return url.href;
}

export function normalizeContentItem(item: PublicContentItem, origins?: ContentOrigins): PublicContentItem {
  const publicOrigin = origins ? normalizedOrigin(origins.publicOrigin, 'publicOrigin') : null;
  const cmsOrigin = origins ? normalizedOrigin(origins.cmsOrigin, 'cmsOrigin') : null;
  const canonical = publicOrigin && cmsOrigin
    ? canonicalForPublicOrigin(item.seo.canonical, publicOrigin, cmsOrigin)
    : item.seo.canonical;
  const fragment = parseFragment(item.content_html);
  let cardCount = 0;

  function normalizeChildren(parent: DefaultTreeAdapterMap['parentNode']): void {
    for (const node of parent.childNodes) {
      if (!('tagName' in node)) continue;
      const id = node.attrs.find((attribute) => attribute.name === 'id')?.value ?? '';
      const className = node.attrs.find((attribute) => attribute.name === 'class')?.value ?? '';
      const dataCardId = node.attrs.find((attribute) => attribute.name === 'data-mv-create-id')?.value ?? '';
      const isCardRegion = /^mv-creation-\d+$/.test(id) ||
        className.split(/\s+/).some((name) => name === 'mv-create-card' || name.startsWith('mv-create-card-')) ||
        dataCardId !== '';

      if (isCardRegion) {
        if (item.kind !== 'recipe' || !createMarker(item, id)) {
          throw new Error(`Post ${item.post_id} contains a Create card that does not match its declared content kind and card ID`);
        }
        cardCount += 1;
        node.tagName = 'div';
        node.nodeName = 'div';
        node.attrs = [{ name: 'data-pfoy-recipe-card', value: String(item.card_id) }];
        node.childNodes = [];
        continue;
      }

      if (node.tagName === 'a' && publicOrigin && cmsOrigin) {
        const href = node.attrs.find((attribute) => attribute.name === 'href');
        if (href) href.value = publicLink(href.value, publicOrigin, cmsOrigin);
      }
      normalizeChildren(node);
      if ('content' in node) normalizeChildren(node.content);
    }
  }

  normalizeChildren(fragment);
  if (item.kind === 'recipe' && cardCount !== 1) {
    throw new Error(`Post ${item.post_id} expected one embedded Create card ${item.card_id}, found ${cardCount}`);
  }
  if (item.kind !== 'recipe' && cardCount !== 0) {
    throw new Error(`Post ${item.post_id} is not a recipe but contains a Create card`);
  }

  return {
    ...item,
    seo: { ...item.seo, canonical },
    content_html: sanitizeHtml(serialize(fragment), SANITIZER_OPTIONS)
  };
}
