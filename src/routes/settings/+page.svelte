<script lang="ts">
	import { roleLabels, roles, type Role } from '#lib/roles.js';
	import type { StatusReport } from '#lib/status.js';

	type RoleSetting = { model: string; default: string };

	let settings = $state<Record<Role, RoleSetting> | null>(null);
	let drafts = $state<Record<string, string>>({});
	let installed = $state<string[]>([]);
	let message = $state('');
	let error = $state('');

	async function load() {
		const [s, st] = await Promise.all([
			fetch('/api/settings').then((r) => r.json()),
			fetch('/api/status').then((r) => r.json() as Promise<StatusReport>)
		]);
		settings = s.models;
		drafts = Object.fromEntries(roles.map((role) => [role, s.models[role].model]));
		installed = st.models.filter((m) => m.installed).map((m) => m.id);
	}

	async function save(role: Role, model: string) {
		message = '';
		error = '';
		const res = await fetch('/api/settings', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role, model })
		});
		const data = await res.json();
		if (!res.ok) {
			error = data.error;
			return;
		}
		message = installed.includes(data.model)
			? `${roleLabels[role]}のモデルを ${data.model} にしました。`
			: `${roleLabels[role]}のモデルを ${data.model} にしました。未インストールなので自動でダウンロードします（進み具合は状態ページで確認できます）。`;
		await load();
	}

	$effect(() => {
		load().catch((e) => (error = String(e)));
	});
</script>

<h1>symphonix</h1>
<p><a href="/">プラン作成に戻る</a> | <a href="/status">LocalAI の状態</a> | 使うモデル</p>

<p>
	用途ごとに使うモデルを選べます。インストール済みのモデルから選ぶか、
	<a href="https://models.localai.io" target="_blank" rel="noreferrer">LocalAI のモデルギャラリー</a>
	の名前を入力してください。未インストールのモデルは自動でダウンロードされます。
</p>

<datalist id="installed-models">
	{#each installed as id}
		<option value={id}></option>
	{/each}
</datalist>

{#if settings}
	<table>
		<thead>
			<tr><th>用途</th><th>モデル</th><th></th></tr>
		</thead>
		<tbody>
			{#each roles as role}
				<tr>
					<td>{roleLabels[role]}</td>
					<td>
						<input list="installed-models" bind:value={drafts[role]} size="40" />
						{#if !installed.includes(settings[role].model)}<br /><small>未インストール</small>{/if}
					</td>
					<td>
						<button
							onclick={() => save(role, drafts[role])}
							disabled={!drafts[role]?.trim() || drafts[role] === settings[role].model}>変更</button
						>
						<button
							onclick={() => save(role, '')}
							disabled={settings[role].model === settings[role].default}
							title={`既定: ${settings[role].default}`}>既定に戻す</button
						>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p>読み込み中…</p>
{/if}

{#if message}
	<p>{message}</p>
{/if}
{#if error}
	<p style="color: red">{error}</p>
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
