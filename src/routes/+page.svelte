<script lang="ts">
	import { MAX_REVISIONS, taskLabels, tasks, type Persona, type Review, type Task } from '#lib/personas.js';
	import type { PlanStep } from '#lib/plan.js';

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

	type GeneratedFile = { path: string; content: string };
	type StepStatus = 'pending' | 'running' | 'reviewing' | 'revising' | 'done' | 'rejected' | 'error';
	// rounds はレビュー 1 回ごとの結果。files はこのステップで書いたファイル（最新の内容）
	type StepResult = { status: StepStatus; files: GeneratedFile[]; rounds: Review[][]; error?: string };
	let project = $state('');
	let projectPath = $state('');
	let results = $state<StepResult[]>([]);
	let running = $state(false);

	async function post(url: string, body: unknown) {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const data = await res.json();
		if (data.project) project = data.project;
		if (!res.ok) throw new Error(data.error);
		return data;
	}

	// 1 ステップを実装し、レビュアー全員が承認するまで指摘を渡して直させる。
	// 直す回数の上限を超えたら rejected で止めて、人に判断してもらう
	async function runStep(i: number): Promise<boolean> {
		const result = results[i];
		let feedback = '';
		for (let attempt = 0; attempt <= MAX_REVISIONS; attempt++) {
			result.status = attempt === 0 ? 'running' : 'revising';
			const data = await post('/api/run', { request: want, steps, index: i, project, feedback });
			projectPath = data.dir;
			const byPath = new Map(result.files.map((f) => [f.path, f]));
			for (const f of data.files as GeneratedFile[]) byPath.set(f.path, f);
			result.files = [...byPath.values()];
			if (reviewerNames.length === 0) break;

			result.status = 'reviewing';
			const { reviews } = (await post('/api/review', {
				request: want,
				steps,
				index: i,
				project,
				paths: result.files.map((f) => f.path)
			})) as { reviews: Review[] };
			result.rounds.push(reviews);
			const rejected = reviews.filter((r) => !r.approved);
			if (rejected.length === 0) break;
			if (attempt === MAX_REVISIONS) {
				result.status = 'rejected';
				return false;
			}
			feedback = rejected.map((r) => `- ${r.name}: ${r.comment}`).join('\n');
		}
		result.status = 'done';
		return true;
	}

	// 承認したプランを 1 ステップずつ順番に実装する。失敗や差し戻しがあればそこで止める
	async function run(from = 0) {
		running = true;
		if (from === 0) {
			project = '';
			projectPath = '';
			results = steps.map(() => ({ status: 'pending', files: [], rounds: [] }));
		}
		for (let i = from; i < steps.length; i++) {
			try {
				if (!(await runStep(i))) break;
			} catch (e) {
				results[i].status = 'error';
				results[i].error = e instanceof Error ? e.message : String(e);
				break;
			}
		}
		running = false;
	}

	// 差し戻されたステップを人が承認して、次のステップから続ける
	function approveAnyway(i: number) {
		results[i].status = 'done';
		run(i + 1);
	}

	const statusLabel: Record<StepStatus, string> = {
		pending: '待機中',
		running: '実装中…',
		reviewing: 'レビュー中…',
		revising: '指摘を直しています…',
		done: '完了',
		rejected: `${MAX_REVISIONS} 回直しても承認されませんでした`,
		error: '失敗'
	};

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
<p><a href="/chat">モデル接続確認</a> | <a href="/image">画像生成の確認</a> | <a href="/voice">音声で話しかける</a> | <a href="/projects">成果物</a> | <a href="/personas">ペルソナ</a> | <a href="/status">LocalAI の状態</a> | <a href="/settings">使うモデル</a></p>

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
	<button onclick={() => steps.push({ title: '新しいステップ', description: '' })} disabled={running}>ステップを追加</button>
	<button onclick={() => run()} disabled={running}>{running ? '実装中…' : 'このプランで実装する'}</button>
{/if}

{#if results.length}
	<h2>実装結果</h2>
	{#if projectPath}
		<p>書き出し先: <code>{projectPath}</code></p>
		{#if !running && project}
			<p><a href="/api/projects/{encodeURIComponent(project)}/download" download>ZIP でダウンロード</a></p>
		{/if}
	{/if}
	<ol>
		{#each results as result, i}
			<li>
				{steps[i]?.title}: {statusLabel[result.status]}
				{#if result.error}
					<p style="color: red">{result.error}</p>
				{/if}
				{#each result.rounds as reviews, round}
					<div class="reviews">
						<small>レビュー {round + 1} 回目</small>
						{#each reviews as review}
							<details open={!review.approved}>
								<summary>{review.approved ? '✅' : '❌'} {review.name}（{review.model}）</summary>
								<pre class="comment">{review.comment}</pre>
							</details>
						{/each}
					</div>
				{/each}
				{#if result.status === 'rejected' && !running}
					<p>
						<button onclick={() => approveAnyway(i)}>このまま承認して次へ進む</button>
						<button onclick={() => Object.assign(results[i], { status: 'error', error: 'ここで止めました' })}>ここで止める</button>
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
