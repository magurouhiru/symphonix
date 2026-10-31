<script lang="ts">
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// 全ページ共通のリンク。今いるページはリンクにしない
	const links = [
		{ href: '/', label: 'プラン作成' },
		{ href: '/projects', label: '成果物' },
		{ href: '/personas', label: 'ペルソナ' },
		{ href: '/settings', label: '使うモデル' },
		{ href: '/status', label: 'LocalAI の状態' },
		{ href: '/chat', label: 'モデル接続確認' },
		{ href: '/image', label: '画像生成の確認' },
		{ href: '/voice', label: '音声で話しかける' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<h1>symphonix</h1>
<nav>
	{#each links as link, i}
		{#if i}
			|
		{/if}
		{#if page.url.pathname === link.href}
			<strong>{link.label}</strong>
		{:else}
			<a href={link.href}>{link.label}</a>
		{/if}
	{/each}
</nav>

{@render children()}

<style>
	nav {
		margin-bottom: 1em;
	}
</style>
