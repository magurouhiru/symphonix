<script lang="ts">
	import type { PlanStep } from '#lib/plan.js';

	let want = $state('');
	let steps = $state<PlanStep[]>([]);
	let error = $state('');
	let loading = $state(false);

	type StepResult = { status: 'pending' | 'running' | 'done' | 'error'; files: { path: string; content: string }[]; error?: string };
	let project = $state('');
	let projectPath = $state('');
	let results = $state<StepResult[]>([]);
	let running = $state(false);

	// 承認したプランを 1 ステップずつ順番に実装する。失敗したらそこで止める
	async function run() {
		running = true;
		project = '';
		projectPath = '';
		results = steps.map(() => ({ status: 'pending', files: [] }));
		for (let i = 0; i < steps.length; i++) {
			results[i].status = 'running';
			try {
				const res = await fetch('/api/run', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ request: want, steps, index: i, project })
				});
				const data = await res.json();
				project = data.project;
				if (!res.ok) throw new Error(data.error);
				projectPath = data.dir;
				results[i] = { status: 'done', files: data.files };
			} catch (e) {
				results[i] = { status: 'error', files: [], error: e instanceof Error ? e.message : String(e) };
				break;
			}
		}
		running = false;
	}

	const statusLabel = { pending: '待機中', running: '実装中…', done: '完了', error: '失敗' };

	async function generate(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ request: want })
			});
			const data = await res.json();
			if (res.ok) steps = data.steps;
			else error = data.error;
		} catch (e) {
			error = String(e);
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

<h1>symphonix</h1>
<p><a href="/chat">モデル接続確認</a> | <a href="/image">画像生成の確認</a></p>

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
	<button onclick={() => steps.push({ title: '新しいステップ', description: '' })} disabled={running}>ステップを追加</button>
	<button onclick={run} disabled={running}>{running ? '実装中…' : 'このプランで実装する'}</button>
{/if}

{#if results.length}
	<h2>実装結果</h2>
	{#if projectPath}
		<p>書き出し先: <code>{projectPath}</code></p>
	{/if}
	<ol>
		{#each results as result, i}
			<li>
				{steps[i]?.title}: {statusLabel[result.status]}
				{#if result.error}
					<p style="color: red">{result.error}</p>
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
