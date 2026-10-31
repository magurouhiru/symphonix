<script lang="ts">
	import type { StatusReport } from '#lib/status.js';

	let report = $state<StatusReport | null>(null);
	let error = $state('');

	async function refresh() {
		try {
			const res = await fetch('/api/status');
			report = await res.json();
			error = '';
		} catch (e) {
			error = String(e);
		}
	}

	// 5 秒ごとに更新する
	$effect(() => {
		refresh();
		const timer = setInterval(refresh, 5000);
		return () => clearInterval(timer);
	});

	const serverLabel = { ready: '🟢 稼働中', starting: '🟡 起動中', down: '🔴 停止・接続できない' };

	let downloading = $derived(
		report?.models.filter((m) => !m.installed && m.download?.state === 'downloading').map((m) => m.id) ?? []
	);

	let queued = $derived(report?.models.filter((m) => m.download?.state === 'queued') ?? []);

	function gb(bytes: number) {
		return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
	}
</script>

<h1>symphonix</h1>
<p><a href="/">プラン作成に戻る</a> | LocalAI の状態 | <a href="/settings">使うモデル</a></p>

{#if error}
	<p style="color: red">{error}</p>
{/if}

{#if report}
	<p>
		サーバー: <strong>{serverLabel[report.server]}</strong>
		{#if report.version}（LocalAI {report.version}）{/if}
		{#if report.reason}<br /><small>{report.reason}</small>{/if}
	</p>
	{#each report.gpus as gpu}
		<p>
			GPU: {gpu.name}<br />
			<meter min="0" max={gpu.totalBytes} value={gpu.usedBytes}></meter>
			VRAM {gb(gpu.usedBytes)} / {gb(gpu.totalBytes)}
		</p>
	{/each}

	{#if downloading.length || queued.length}
		<p>
			⬇️ モデルを準備中です（ダウンロード中: {downloading.join(', ') || 'なし'}、順番待ち: {queued.length} 件）。
			終わるまでその用途は使えません。
		</p>
	{/if}

	<table>
		<thead>
			<tr><th>モデル</th><th>用途</th><th>インストール</th><th>メモリ上</th></tr>
		</thead>
		<tbody>
			{#each report.models as model (model.id)}
				<tr>
					<td>{model.id}</td>
					<td>{model.roles.join('・') || '-'}</td>
					<td>
						{#if report.server === 'down'}
							?
						{:else if model.installed}
							✓
						{:else if model.download?.state === 'failed'}
							<span style="color: red">失敗: {model.download.error}</span>
						{:else if model.download?.state === 'queued'}
							⏳ 順番待ち（{model.download.position} 番目）
						{:else if model.download}
							⬇️ ダウンロード中 {Math.round(model.download.progress)}%
							{#if model.download.downloaded && model.download.total}
								（{model.download.downloaded} / {model.download.total}）
							{/if}
							{#if model.download.file}<br /><small>{model.download.file}</small>{/if}
						{:else}
							未
						{/if}
					</td>
					<td>{model.loaded ? `読み込み済み${model.backend ? `（${model.backend}）` : ''}` : '-'}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if report.backends.length}
		<p><small>使えるバックエンド: {report.backends.join(', ')}</small></p>
	{/if}
	<p><small>最終確認: {new Date(report.checkedAt).toLocaleTimeString()}（5 秒ごとに更新）</small></p>
{:else}
	<p>確認中…</p>
{/if}

<style>
	table {
		border-collapse: collapse;
	}
	th,
	td {
		border: 1px solid #ccc;
		padding: 4px 8px;
		text-align: left;
	}
</style>
