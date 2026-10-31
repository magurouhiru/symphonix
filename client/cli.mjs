#!/usr/bin/env node
// symphonix のクライアントを起動する。
//   node client/cli.mjs --server http://localhost:5173 --root ./workspace [--name 名前] [--allow node,npm,python3]
import { parseArgs } from 'node:util';
import { createClient } from './core.mjs';

const { values } = parseArgs({
	options: {
		server: { type: 'string', default: process.env.SYMPHONIX_URL ?? 'http://localhost:5173' },
		root: { type: 'string', default: '.' },
		name: { type: 'string' },
		allow: { type: 'string' }
	}
});

const client = createClient({
	server: values.server,
	root: values.root,
	name: values.name,
	allow: values.allow ? values.allow.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
	log: (message) => console.log(`[${new Date().toLocaleTimeString()}] ${message}`)
});

process.on('SIGINT', () => {
	client.stop();
	process.exit(0);
});
await client.start();
