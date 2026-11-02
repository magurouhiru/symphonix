import { listPlayers } from '#lib/players/registry.server.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => Response.json({ players: listPlayers() });
