import { json } from '@sveltejs/kit';
import { listPlayers } from '#lib/server/players.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json({ players: listPlayers() });
