<script lang="ts">
	import { taskLabels, tasks, type Persona, type Task } from '#lib/personas/types.js';
	import { PipelineRun, statusLabel } from '#lib/pipeline/runner.svelte.js';
	import type { PlanStep } from '#lib/pipeline/types.js';
	import PlayerPicker from '#lib/players/PlayerPicker.svelte';
	import { postJson } from '#lib/shared/api.js';
	import { errorMessage } from '#lib/shared/errors.js';
	import type { PlayerInfo } from '@symphonix/protocol';

	// 作業ごとの担当ペルソナ（表示用）
	let staff = $state<{ task: Task; name: string; model: string }[]>([]);
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
						return { task, name: p?.name ?? '?', model: p?.model || data.defaultModel };
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
	let folder = $state('');

	const pipeline = new PipelineRun();

	function run() {
		pipeline.start({
			request: want,
			steps,
			player: playerId,
			playerRoot: player?.root ?? '',
			folder,
			hasReviewers: reviewerNames.length > 0
		});
	}

	async function generate(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		error = '';
		try {
			steps = (await postJson<{ steps: PlanStep[] }>('/api/plan', { request: want })).steps;
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
		{#each staff as s, i}{i ? '、' : ''}{taskLabels[s.task]}は{s.name}（{s.model}）{/each}、レビューは{reviewerNames.length
			? reviewerNames.join('と')
			: 'なし'}
		<a href="/personas">変更</a>
	</p>
{/if}

<form onsubmit={generate}>
	<textarea bind:value={want} rows="4" cols="60" placeholder="作りたいもの（例: TODOアプリ）"></textarea>
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
	<p>
		作る場所: <PlayerPicker bind:selected={playerId} bind:player />
		/ <input bind:value={folder} size="20" placeholder="フォルダ名（空なら日時）" disabled={pipeline.running} />
	</p>
	<button onclick={() => run()} disabled={pipeline.running || !playerId}>{pipeline.running ? '実装中…' : 'このプランで実装する'}</button>
{/if}

{#if pipeline.results.length}
	<h2>実装結果</h2>
	{#if pipeline.projectPath}
		<p>書き出し先: <code>{pipeline.projectPath}</code></p>
		{#if !pipeline.running && pipeline.project}
			<p><a href="/api/projects/{encodeURIComponent(pipeline.project)}/download?player={encodeURIComponent(playerId)}" download>ZIP でダウンロード</a></p>
		{/if}
	{/if}
	<ol>
		{#each pipeline.results as result, i}
			<li>
				{steps[i]?.title}: {statusLabel[result.status]}
				{#if result.error}
					<p style="color: red">{result.error}</p>
				{/if}
				{#each result.rounds as round, n}
					<div class="reviews">
						<small>{n + 1} 回目</small>
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
				{#if result.status === 'rejected' && !pipeline.running}
					<p>
						<button onclick={() => pipeline.approveAnyway(i)}>このまま承認して次へ進む</button>
						<button onclick={() => pipeline.stop(i)}>ここで止める</button>
					</p>
				{/if}
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

<style>
	.reviews {
		margin: 4px 0 4px 1em;
	}
	.comment {
		white-space: pre-wrap;
	}
</style>
