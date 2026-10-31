import { json } from '@sveltejs/kit';
import { listPlayers } from '#lib/players/registry.server.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json({ players: listPlayers() });
