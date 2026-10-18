import type { RequestHandler } from './$types';
import { rssResponse } from '#lib/server/feed.ts';

export const prerender = true;
export const GET: RequestHandler = () => rssResponse();
