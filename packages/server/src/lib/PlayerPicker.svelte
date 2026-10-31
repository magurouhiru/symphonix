<script lang="ts">
	import type { PlayerInfo } from '@symphonix/protocol';

	// selected はプレイヤーの id。前回選んだものを覚えておく
	let { selected = $bindable(''), player = $bindable<PlayerInfo | undefined>() } = $props();
	let players = $state<PlayerInfo[]>([]);
	const origin = typeof location === 'undefined' ? '' : location.origin;

	async function load() {
		players = (await fetch('/api/players').then((r) => r.json())).players;
		const connected = players.filter((c) => c.connected);
		if (!connected.some((c) => c.id === selected)) {
			let remembered = '';
			try {
				remembered = localStorage.getItem('symphonix-player-root') ?? '';
			} catch {}
			selected = (connected.find((c) => c.root === remembered) ?? connected[0])?.id ?? '';
		}
	}

	$effect(() => {
		player = players.find((c) => c.id === selected);
		try {
			if (player) localStorage.setItem('symphonix-player-root', player.root);
		} catch {}
	});

	$effect(() => {
		load().catch(() => {});
		const timer = setInterval(() => load().catch(() => {}), 5000);
		return () => clearInterval(timer);
	});
</script>

{#if players.some((c) => c.connected)}
	<select bind:value={selected}>
		{#each players.filter((c) => c.connected) as c}
			<option value={c.id}>{c.name}（{c.root}）</option>
		{/each}
	</select>
{:else}
	<span style="color: #b00">
		プレイヤーがつながっていません。symphonix のリポジトリで <code>pnpm player</code> を実行するか、
		作業したいフォルダで
		<code
			>curl -O {origin}/symphonix-player.js && node symphonix-player.js --server {origin} --root .</code
		>
		を実行してください（別のコンテナからは {origin} の localhost を host.docker.internal に置き換えてください）。
	</span>
{/if}
