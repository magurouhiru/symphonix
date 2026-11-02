import { getStatus } from '#lib/ai/localai-status.server.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => Response.json(await getStatus());
