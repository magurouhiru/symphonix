<script lang="ts">
	import { taskLabels, tasks, type Persona, type Task } from '#lib/personas/types.js';
	import { PipelineRun, runStateLabel, statusLabel } from '#lib/pipeline/runner.svelte.js';
	import type { PlanStep, RunSummary } from '#lib/pipeline/types.js';
	import PlayerInstall from '#lib/players/PlayerInstall.svelte';
	import PlayerPicker from '#lib/players/PlayerPicker.svelte';
	import { postJson } from '#lib/shared/api.js';
	import { errorMessage } from '#lib/shared/errors.js';
	import { downloadHref, projectLabel, ROOT_PROJECT } from '#lib/shared/projects.js';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { PlayerInfo } from '@symphonix/protocol';

	// 作業ごとの担当ペルソナ（表示用）
	let staff = $state<{ task: Task; name: string; model: string; translate: boolean }[]>([]);
	let reviewerNames = $state<string[]>([]);
	$effect(() => {
		fetch('/api/personas')
			.then((r) => r.json())
			.then(
				(data: {
					personas: Persona[];
					assignments: Record<Task, string>;
					reviewers: string[];
					defaultModel: string;
				}) => {
					staff = tasks.map((task) => {
						const p = data.personas.find((x) => x.id === data.assignments[task]);
						return { task, name: p?.name ?? '?', model: p?.model || data.defaultModel, translate: !!p?.translate };
					});
					reviewerNames = data.reviewers.map((id) => data.personas.find((x) => x.id === id)?.name ?? '?');
				}
			)
			.catch(() => {});
	});

	let want = $state('');
	let steps = $state<PlanStep[]>([]);
	let error = $state('');
	let loading = $state(false);

	// どのプレイヤーの作業フォルダの、どのフォルダに作るか
	let playerId = $state('');
	let player = $state<PlayerInfo>();
	// プロジェクト一覧の「改修する」から来たら、そのフォルダを選んでおく
	const folderParam = page.url.searchParams.get('folder') ?? '';
	// フォルダを作らず、作業フォルダの直下で作業する
	let atRoot = $state(folderParam === ROOT_PROJECT);
	let folder = $state(folderParam === ROOT_PROJECT ? '' : folderParam);
	const project = $derived(atRoot ? ROOT_PROJECT : folder);

	// 作業フォルダにある既存のプロジェクト。同じ名前のフォルダを選ぶと、それを改修する
	let projects = $state<{ name: string; files: number }[]>([]);
	let rootFiles = $state(0);
	$effect(() => {
		if (!playerId) return;
		fetch(`/api/projects?player=${encodeURIComponent(playerId)}`)
			.then((r) => r.json())
			.then((data) => {
				projects = data.projects ?? [];
				rootFiles = data.rootFiles ?? 0;
			})
			.catch(() => (projects = []));
	});
	const existing = $derived(
		atRoot
			? rootFiles > 0
				? { name: ROOT_PROJECT, files: rootFiles }
				: undefined
			: projects.find((p) => p.name === folder.trim() && p.files > 0)
	);

	// 実装はサーバーで進むので、画面を閉じても止まらない。URL の ?run= で開き直せる
	const pipeline = new PipelineRun();
	let recent = $state<RunSummary[]>([]);

	onMount(() => {
		const id = page.url.searchParams.get('run');
		if (id) {
			pipeline
				.open(id)
				.then(() => {
					const r = pipeline.run!;
					want = r.request;
					steps = r.steps.map((s) => ({ ...s }));
					atRoot = r.project === ROOT_PROJECT;
					folder = atRoot ? '' : r.project;
				})
				.catch((e) => (error = errorMessage(e)));
		}
		fetch('/api/runs')
			.then((r) => r.json())
			.then((data) => (recent = (data.runs ?? []).slice(0, 5)))
			.catch(() => {});
		return () => pipeline.dispose();
	});

	async function run() {
		error = '';
		try {
			await pipeline.start({ request: want, steps, player: playerId, folder: project });
			replaceState(`?run=${encodeURIComponent(pipeline.run!.id)}`, {});
		} catch (e) {
			error = errorMessage(e);
		}
	}

	// 判断（承認・停止・再開）を伝える。失敗したら理由を出す
	function act(f: () => Promise<void>) {
		f().catch((e) => (error = errorMessage(e)));
	}

	async function generate(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		error = '';
		try {
			const target = existing ? { player: playerId, project: existing.name } : {};
			steps = (await postJson<{ steps: PlanStep[] }>('/api/plan', { request: want, ...target })).steps;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	function move(i: number, delta: number) {
		const j = i + delta;
		if (j < 0 || j >= steps.length) return;
		[steps[i], steps[j]] = [steps[j], steps[i]];
	}
</script>

{#if staff.length}
	<p>
		担当:
		{#each staff as s, i}{i ? '、' : ''}{taskLabels[s.task]}は{s.name}（{s.model}{s.translate ? '、英訳' : ''}）{/each}、レビューは{reviewerNames.length
			? reviewerNames.join('と')
			: 'なし'}
		<a href="/personas">変更</a>
	</p>
{/if}

<p>
	作る場所: <PlayerPicker bind:selected={playerId} bind:player />
	/ <input bind:value={folder} list="projects" size="20" placeholder="フォルダ名（空なら日時）" disabled={pipeline.running || atRoot} />
	<label><input type="checkbox" bind:checked={atRoot} disabled={pipeline.running} /> フォルダを作らず直下で作業する</label>
	<datalist id="projects">
		{#each projects as p}<option value={p.name}></option>{/each}
	</datalist>
	{#if existing}
		<small>既存の{atRoot ? '作業フォルダ' : 'フォルダ'}（{existing.files} ファイル）を改修します</small>
	{:else if atRoot || folder.trim()}
		<small>新しく作ります</small>
	{/if}
</p>
<!-- プレイヤーがまだ無ければ開いておく -->
<PlayerInstall open={!player} />

<form onsubmit={generate}>
	<textarea
		bind:value={want}
		rows="4"
		cols="60"
		placeholder={existing ? 'やりたい変更（例: 完了したものを消すボタンを足す）' : '作りたいもの（例: TODOアプリ）'}
	></textarea>
	<div>
		<button type="submit" disabled={loading || !want.trim()}>
			{loading ? 'プラン作成中…' : 'プランを作る'}
		</button>
	</div>
</form>

{#if error}
	<p style="color: red">{error}</p>
{/if}

{#if steps.length}
	<h2>プラン</h2>
	<ol>
		{#each steps as step, i}
			<li>
				<input bind:value={step.title} size="50" />
				<button onclick={() => move(i, -1)} disabled={i === 0}>↑</button>
				<button onclick={() => move(i, 1)} disabled={i === steps.length - 1}>↓</button>
				<button onclick={() => steps.splice(i, 1)}>削除</button>
				<div><textarea bind:value={step.description} rows="2" cols="60"></textarea></div>
			</li>
		{/each}
	</ol>
	<button onclick={() => steps.push({ title: '新しいステップ', description: '' })} disabled={pipeline.running}>ステップを追加</button>
	<button onclick={() => run()} disabled={pipeline.running || !playerId}>{pipeline.running ? '実装中…' : 'このプランで実装する'}</button>
{/if}

{#if pipeline.run}
	{@const r = pipeline.run}
	<h2>実装結果（{runStateLabel[r.state]}）</h2>
	<p>書き出し先: <code>{r.projectPath}</code></p>
	{#if pipeline.error}
		<p style="color: #b00">記録を取りに行けません（{pipeline.error}）。取り直しています…</p>
	{/if}
	<p>
		{#if r.state === 'running'}
			<button onclick={() => act(pipeline.stop)}>止める</button>
			<small>画面を閉じても実装は続きます。この URL を開けば続きを見られます</small>
		{:else}
			<a href={downloadHref(r.player, r.project)} download>ZIP でダウンロード</a>
			{#if r.state === 'interrupted' || r.state === 'error' || r.state === 'stopped'}
				<button onclick={() => act(pipeline.resume)}>止まったステップから再開する</button>
			{/if}
		{/if}
	</p>
	<ol>
		{#each r.results as result, i}
			<li>
				{r.steps[i]?.title}: {statusLabel[result.status]}
				{#if result.error}
					<p style="color: red">{result.error}</p>
				{/if}
				{#each result.rounds as round, n}
					<div class="reviews">
						<small>{n + 1} 回目</small>
						{#if result.rounds.length > 1 && round.files}
							<details>
								<summary>この回に書いたファイル（{round.files.length}）</summary>
								{#each round.files as file}
									<details class="reviews">
										<summary>{file.path}</summary>
										<pre>{file.content}</pre>
									</details>
								{/each}
							</details>
						{/if}
						{#each round.checks as check}
							<details open={!check.ok}>
								<summary>{check.skipped ? '⏭️' : check.ok ? '✅' : '❌'} 自動チェック: {check.name}</summary>
								{#if check.output}<pre class="comment">{check.output}</pre>{/if}
							</details>
						{/each}
						{#each round.reviews as review}
							<details open={!review.approved}>
								<summary>{review.approved ? '✅' : '❌'} {review.name}（{review.model}）</summary>
								<pre class="comment">{review.comment}</pre>
							</details>
						{/each}
					</div>
				{/each}
				{#if result.status === 'rejected' && r.state === 'waiting'}
					<p>
						<button onclick={() => act(pipeline.approveAnyway)}>このまま承認して次へ進む</button>
						<button onclick={() => act(pipeline.stop)}>ここで止める</button>
					</p>
				{/if}
				{#if result.files.length && result.rounds.length > 1}<small>最新のファイル</small>{/if}
				{#each result.files as file}
					<details>
						<summary>{file.path}</summary>
						<pre>{file.content}</pre>
					</details>
				{/each}
			</li>
		{/each}
	</ol>
{/if}

{#if recent.length}
	<h2>最近の実行</h2>
	<ul>
		{#each recent as x}
			<li>
				<a href="?run={encodeURIComponent(x.id)}" data-sveltekit-reload>{x.request.slice(0, 40) || '（依頼なし）'}</a>
				<small>{runStateLabel[x.state]}・{x.done}/{x.steps} ステップ・{projectLabel(x.project)}・{new Date(x.createdAt).toLocaleString()}</small>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.reviews {
		margin: 4px 0 4px 1em;
	}
	.comment {
		white-space: pre-wrap;
	}
</style>
