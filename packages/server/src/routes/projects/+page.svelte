<script lang="ts">
	import PlayerPicker from '#lib/players/PlayerPicker.svelte';
	import { downloadHref, ROOT_PROJECT } from '#lib/shared/projects.js';

	type ProjectSummary = { name: string; files: number; updatedAt: string };

	let playerId = $state('');
	let projects = $state<ProjectSummary[] | null>(null);
	// 作業フォルダ全体のファイル数（直下で作業したものも含む）
	let rootFiles = $state(0);
	let error = $state('');

	$effect(() => {
		if (!playerId) return;
		projects = null;
		error = '';
		fetch(`/api/projects?player=${encodeURIComponent(playerId)}`)
			.then((r) => r.json())
			.then((data) => {
				if (data.error) error = data.error;
				else {
					projects = data.projects;
					rootFiles = data.rootFiles ?? 0;
				}
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
{:else if rootFiles === 0}
	<p>まだ何も作っていません。</p>
{:else}
	<p>
		作業フォルダ全体（{rootFiles} ファイル）:
		<a href={downloadHref(playerId, ROOT_PROJECT)} download>ZIP でダウンロード</a>
		<a href="/?folder={ROOT_PROJECT}">直下で改修する</a>
	</p>
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
							<a href={downloadHref(playerId, project.name)} download>ZIP でダウンロード</a>
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
