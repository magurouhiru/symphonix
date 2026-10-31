<script lang="ts">
	import PlayerPicker from '#lib/players/PlayerPicker.svelte';

	type ProjectSummary = { name: string; files: number; updatedAt: string };

	let playerId = $state('');
	let projects = $state<ProjectSummary[] | null>(null);
	let error = $state('');

	$effect(() => {
		if (!playerId) return;
		projects = null;
		error = '';
		fetch(`/api/projects?player=${encodeURIComponent(playerId)}`)
			.then((r) => r.json())
			.then((data) => {
				if (data.error) error = data.error;
				else projects = data.projects;
			})
			.catch((e) => (error = String(e)));
	});
</script>

<p>プレイヤーの作業フォルダにあるものを ZIP でダウンロードしたり、改修したりできます。</p>
<p>プレイヤー: <PlayerPicker bind:selected={playerId} /></p>

{#if error}
	<p style="color: red">{error}</p>
{:else if !playerId}
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
							<a href="/api/projects/{encodeURIComponent(project.name)}/download?player={encodeURIComponent(playerId)}" download>ZIP でダウンロード</a>
							<a href="/?folder={encodeURIComponent(project.name)}">改修する</a>
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
