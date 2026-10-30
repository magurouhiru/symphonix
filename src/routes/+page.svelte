<script lang="ts">
	import type { PlanStep } from '#lib/plan.js';

	let want = $state('');
	let steps = $state<PlanStep[]>([]);
	let error = $state('');
	let loading = $state(false);

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
<p><a href="/chat">モデル接続確認</a></p>

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
	<button onclick={() => steps.push({ title: '新しいステップ', description: '' })}>ステップを追加</button>
{/if}
