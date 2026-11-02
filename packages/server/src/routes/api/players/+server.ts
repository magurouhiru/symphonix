import { listPlayers } from '#lib/players/registry.server.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => Response.json({ players: listPlayers() });
