const redirects: Record<string, string> = {
  '/recipe-search/': '/recipes/',
  '/recipe-search-results/': '/recipes/',
  '/recipe-category/': '/recipes/',
  '/recipe-box/': '/recipes/',
  '/easy-instantpot-caramelised-onions/': '/easy-caramelised-onions/',
  '/ishtu-potato-stew/': '/ishtu/'
};

export function getLegacyRouteRedirect(path: string, basePath = ''): string | undefined {
  const target = redirects[path];
  return target ? `${basePath}${target}` : undefined;
}

export function getLegacyRouteEntries(): string[] {
  return Object.keys(redirects).map((path) => path.replace(/^\/+|\/+$/g, ''));
}
