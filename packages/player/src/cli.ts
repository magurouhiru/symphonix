#!/usr/bin/env node
// symphonix のプレイヤーを起動する。
//   symphonix-player --server http://localhost:5173 --root ./workspace [--name 名前] [--allow node,npm,python3]
import { parseArgs } from 'node:util';
import { createPlayer } from './player.js';

const { values } = parseArgs({
	options: {
		server: { type: 'string', default: process.env.SYMPHONIX_URL ?? 'http://localhost:5173' },
		root: { type: 'string', default: '.' },
		name: { type: 'string' },
		allow: { type: 'string' }
	}
});

const player = createPlayer({
	server: values.server!,
	root: values.root!,
	name: values.name,
	allow: values.allow
		?.split(',')
		.map((s) => s.trim())
		.filter(Boolean),
	log: (message) => console.log(`[${new Date().toLocaleTimeString()}] ${message}`)
});

process.on('SIGINT', () => {
	player.stop();
	process.exit(0);
});
await player.start();
