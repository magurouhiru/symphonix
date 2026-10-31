<script lang="ts">
	import { taskLabels, tasks, type Persona, type Task } from '#lib/personas/types.js';

	let personas = $state<Persona[]>([]);
	let assigned = $state<Record<Task, string> | null>(null);
	let reviewers = $state<string[]>([]);
	let defaultModel = $state('');
	let draft = $state({ name: '', prompt: '', model: '', translate: false });
	let message = $state('');
	let error = $state('');

	async function load() {
		const data = await fetch('/api/personas').then((r) => r.json());
		personas = data.personas;
		assigned = data.assignments;
		reviewers = data.reviewers;
		defaultModel = data.defaultModel;
	}

	async function send(url: string, method: string, body?: unknown, done = '') {
		message = '';
		error = '';
		const res = await fetch(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		const data = await res.json();
		if (!res.ok) {
			error = data.error;
			return false;
		}
		message = done;
		await load();
		return true;
	}

	async function create() {
		if (await send('/api/personas', 'POST', draft, `${draft.name} を追加しました。`)) {
			draft = { name: '', prompt: '', model: '', translate: false };
		}
	}

	const usedBy = (id: string) => [
		...tasks.filter((task) => assigned?.[task] === id).map((task) => taskLabels[task]),
		...(reviewers.includes(id) ? ['レビュー'] : [])
	];

	function toggleReviewer(id: string, on: boolean) {
		const next = on ? [...reviewers, id] : reviewers.filter((r) => r !== id);
		send('/api/personas/reviewers', 'PUT', { reviewers: next }, 'レビュアーを変えました。');
	}

	$effect(() => {
		load().catch((e) => (error = String(e)));
	});
</script>

<p>
	作業ごとに担当する AI のペルソナを決められます。人物像はモデルへの指示の先頭に付きます。
	モデルを空にすると、<a href="/settings">使うモデル</a>の「文章」のモデル（今は {defaultModel}）を使います。
</p>

{#if assigned}
	<h2>担当</h2>
	<table>
		<tbody>
			{#each tasks as task}
				<tr>
					<td>{taskLabels[task]}</td>
					<td>
						<select
							value={assigned[task]}
							onchange={(e) =>
								send('/api/personas/assignments', 'PUT', { task, persona: e.currentTarget.value }, `${taskLabels[task]}の担当を変えました。`)}
						>
							{#each personas as p}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
					</td>
				</tr>
			{/each}
			<tr>
				<td>レビュー</td>
				<td>
					{#each personas as p}
						<label>
							<input
								type="checkbox"
								checked={reviewers.includes(p.id)}
								onchange={(e) => toggleReviewer(p.id, e.currentTarget.checked)}
							/>
							{p.name}
						</label><br />
					{/each}
					<small>実装のたびにチェックした全員がレビューし、全員が承認したら次のステップへ進みます。だれもチェックしなければレビューしません。</small>
				</td>
			</tr>
		</tbody>
	</table>
{/if}

{#if message}
	<p>{message}</p>
{/if}
{#if error}
	<p style="color: red">{error}</p>
{/if}

<h2>ペルソナ</h2>
{#each personas as p (p.id)}
	<fieldset>
		<legend>{p.name}{#if usedBy(p.id).length}（{usedBy(p.id).join('、')}を担当中）{/if}</legend>
		<label>名前 <input bind:value={p.name} size="20" /></label>
		<label>モデル <input bind:value={p.model} size="30" placeholder={defaultModel} /></label>
		<label title="依頼やプランを英語に訳して渡し、返ってきたプランやコメントを日本語に戻します（翻訳には使うモデルの「翻訳」のモデルを使います）">
			<input type="checkbox" bind:checked={p.translate} /> 日本語が苦手なモデル（英語に訳して渡す）
		</label>
		<div><textarea bind:value={p.prompt} rows="3" cols="80" placeholder="人物像（例: You are a senior engineer who...）"></textarea></div>
		<button onclick={() => send(`/api/personas/${p.id}`, 'PUT', p, `${p.name} を保存しました。`)}>保存</button>
		<button
			onclick={() => confirm(`${p.name} を削除しますか？`) && send(`/api/personas/${p.id}`, 'DELETE', undefined, `${p.name} を削除しました。`)}
			disabled={usedBy(p.id).length > 0}
			title={usedBy(p.id).length ? '担当中のペルソナは削除できません' : ''}>削除</button
		>
	</fieldset>
{/each}

<fieldset>
	<legend>新しいペルソナ</legend>
	<label>名前 <input bind:value={draft.name} size="20" /></label>
	<label>モデル <input bind:value={draft.model} size="30" placeholder={defaultModel} /></label>
	<label><input type="checkbox" bind:checked={draft.translate} /> 日本語が苦手なモデル（英語に訳して渡す）</label>
	<div><textarea bind:value={draft.prompt} rows="3" cols="80" placeholder="人物像（例: You are a senior engineer who...）"></textarea></div>
	<button onclick={create} disabled={!draft.name.trim()}>追加</button>
</fieldset>

<style>
	table {
		border-collapse: collapse;
	}
	td {
		border: 1px solid #ccc;
		padding: 4px 8px;
	}
	fieldset {
		margin-bottom: 8px;
	}
</style>
