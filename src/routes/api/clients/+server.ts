import { json } from '@sveltejs/kit';
import { listClients } from '#lib/server/clients.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json({ clients: listClients() });
