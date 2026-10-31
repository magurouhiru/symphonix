<script lang="ts">
	import { taskLabels, tasks, type Persona, type Task } from '#lib/personas.js';

	let personas = $state<Persona[]>([]);
	let assigned = $state<Record<Task, string> | null>(null);
	let defaultModel = $state('');
	let draft = $state({ name: '', prompt: '', model: '' });
	let message = $state('');
	let error = $state('');

	async function load() {
		const data = await fetch('/api/personas').then((r) => r.json());
		personas = data.personas;
		assigned = data.assignments;
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
			draft = { name: '', prompt: '', model: '' };
		}
	}

	const usedBy = (id: string) => tasks.filter((task) => assigned?.[task] === id).map((task) => taskLabels[task]);

	$effect(() => {
		load().catch((e) => (error = String(e)));
	});
</script>

<h1>symphonix</h1>
<p>
	<a href="/">プラン作成に戻る</a> | <a href="/projects">成果物</a> | ペルソナ |
	<a href="/status">LocalAI の状態</a> | <a href="/settings">使うモデル</a>
</p>

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
