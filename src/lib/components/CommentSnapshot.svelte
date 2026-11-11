<script lang="ts">
  import type { PublicComment } from '#lib/content/types.ts';

  let { comments = [], count = 0 }: {
    comments?: PublicComment[];
    count?: number;
  } = $props();
  const snapshotLabel = 'Approved comments from the published snapshot.';
</script>

<section class="discussion" id="comments" aria-labelledby="comments-title">
  <p class="eyebrow">Conversation</p>
  <h2 id="comments-title">Reader notes{#if count} <span>({count})</span>{/if}</h2>
  <p class="snapshot-label">{snapshotLabel}</p>
  {#if comments.length}
    <ol>
      {#each comments as comment (comment.id)}
        <li id="comment-{comment.id}" class:reply={comment.parent !== 0}>
          <header>
            <strong>{comment.author}</strong>
            <time datetime={comment.date}>{new Date(comment.date).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time>
          </header>
          <p>{comment.content}</p>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="empty">There are no approved comments in the published snapshot.</p>
  {/if}
</section>

<style>
  .discussion { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--line); font: 1rem/1.6 var(--font-body); }
  .eyebrow { margin: 0; color: var(--forest); font: 700 .75rem var(--font-body); letter-spacing: .1em; text-transform: uppercase; }
  h2 { margin: .3rem 0; font: normal 1.8rem var(--font-display); }
  h2 span, time { color: var(--muted); font-size: .85rem; }
  .snapshot-label { color: var(--muted); font-size: .9rem; }
  ol { display: grid; gap: .8rem; list-style: none; padding: 0; }
  li { padding: 1rem; background: var(--paper); border: 1px solid var(--line); border-radius: 8px; }
  li.reply { margin-left: clamp(1rem, 5vw, 3rem); }
  header { display: flex; flex-wrap: wrap; gap: .3rem .8rem; align-items: baseline; }
  .empty { padding: 1rem; background: #f0f3eb; border: 1px solid #bdc9b2; border-radius: 8px; }
  @media print { .discussion { display: none !important; } }
</style>
