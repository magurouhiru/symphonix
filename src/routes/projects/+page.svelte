<script lang="ts">
	import ClientPicker from '#lib/ClientPicker.svelte';

	type ProjectSummary = { name: string; files: number; updatedAt: string };

	let clientId = $state('');
	let projects = $state<ProjectSummary[] | null>(null);
	let error = $state('');

	$effect(() => {
		if (!clientId) return;
		projects = null;
		error = '';
		fetch(`/api/projects?client=${encodeURIComponent(clientId)}`)
			.then((r) => r.json())
			.then((data) => {
				if (data.error) error = data.error;
				else projects = data.projects;
			})
			.catch((e) => (error = String(e)));
	});
</script>

<h1>symphonix</h1>
<p><a href="/">プラン作成に戻る</a> | 成果物 | <a href="/personas">ペルソナ</a> | <a href="/status">LocalAI の状態</a> | <a href="/settings">使うモデル</a></p>

<p>クライアントの作業フォルダにあるものを ZIP でダウンロードできます。</p>
<p>クライアント: <ClientPicker bind:selected={clientId} /></p>

{#if error}
	<p style="color: red">{error}</p>
{:else if !clientId}
	<p></p>
{:else if !projects}
	<p>読み込み中…</p>
{:else if projects.length === 0}
	<p>まだ何も作っていません。</p>
{:else}
	<table>
		<thead>
			<tr><th>プロジェクト</th><th>ファイル数</th><th>更新日時</th><th></th></tr>
		</thead>
		<tbody>
			{#each projects as project}
				<tr>
					<td>{project.name}</td>
					<td>{project.files}</td>
					<td>{new Date(project.updatedAt).toLocaleString()}</td>
					<td>
						{#if project.files}
							<a href="/api/projects/{encodeURIComponent(project.name)}/download?client={encodeURIComponent(clientId)}" download>ZIP でダウンロード</a>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
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
