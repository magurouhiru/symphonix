<script lang="ts">
	import type { ClientInfo } from './clients.js';

	// selected はクライアントの id。前回選んだものを覚えておく
	let { selected = $bindable(''), client = $bindable<ClientInfo | undefined>() } = $props();
	let clients = $state<ClientInfo[]>([]);

	async function load() {
		clients = (await fetch('/api/clients').then((r) => r.json())).clients;
		const connected = clients.filter((c) => c.connected);
		if (!connected.some((c) => c.id === selected)) {
			let remembered = '';
			try {
				remembered = localStorage.getItem('symphonix-client-root') ?? '';
			} catch {}
			selected = (connected.find((c) => c.root === remembered) ?? connected[0])?.id ?? '';
		}
	}

	$effect(() => {
		client = clients.find((c) => c.id === selected);
		try {
			if (client) localStorage.setItem('symphonix-client-root', client.root);
		} catch {}
	});

	$effect(() => {
		load().catch(() => {});
		const timer = setInterval(() => load().catch(() => {}), 5000);
		return () => clearInterval(timer);
	});
</script>

{#if clients.some((c) => c.connected)}
	<select bind:value={selected}>
		{#each clients.filter((c) => c.connected) as c}
			<option value={c.id}>{c.name}（{c.root}）</option>
		{/each}
	</select>
{:else}
	<span style="color: #b00">
		クライアントがつながっていません。作業したいフォルダで
		<code>node client/cli.mjs --server {typeof location === 'undefined' ? '' : location.origin} --root .</code>
		を実行してください。
	</span>
{/if}
