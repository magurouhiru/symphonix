<script lang="ts">
	type ProjectSummary = { name: string; files: number; updatedAt: string };

	let projects = $state<ProjectSummary[] | null>(null);
	let error = $state('');

	$effect(() => {
		fetch('/api/projects')
			.then((r) => r.json())
			.then((data) => (projects = data.projects))
			.catch((e) => (error = String(e)));
	});
</script>

<h1>symphonix</h1>
<p><a href="/">プラン作成に戻る</a> | 成果物 | <a href="/personas">ペルソナ</a> | <a href="/status">LocalAI の状態</a> | <a href="/settings">使うモデル</a></p>

<p>これまでに作ったものを ZIP でダウンロードできます。</p>

{#if error}
	<p style="color: red">{error}</p>
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
							<a href="/api/projects/{encodeURIComponent(project.name)}/download" download>ZIP でダウンロード</a>
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
