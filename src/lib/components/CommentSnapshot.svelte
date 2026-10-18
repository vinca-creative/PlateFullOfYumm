<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { publicConfig } from '#lib/config.ts';
  import type { PublicComment } from '#lib/content/types.ts';

  let { comments = [], count = 0, postId }: {
    comments?: PublicComment[];
    count?: number;
    postId: number;
  } = $props();
  let canComment = $state(false);
  let hydrated = $state(false);
  let challengeSetup: Promise<void> | undefined;
  let refreshedComments = $state<PublicComment[] | null>(null);
  let refreshedCount = $state<number | null>(null);
  const visibleComments = $derived(refreshedComments ?? comments);
  const snapshotCount = $derived(refreshedCount ?? count);
  let refreshState = $state<'loading' | 'current' | 'stale'>('stale');
  let refreshMessage = $state('Live comment refresh starts after JavaScript loads. The published snapshot remains available.');
  let formName = $state('');
  let formEmail = $state('');
  let formContent = $state('');
  let parentId = $state<number | null>(null);
  let challengeToken = $state('');
  let formMessage = $state('');
  let submitting = $state(false);
  let challengeReady = $state(false);
  let challengeUnavailable = $state(false);
  let challengeContainer = $state<HTMLDivElement | undefined>();
  let widgetId: string | number | undefined;
  let requestController: AbortController | undefined;

  const apiOrigin = publicConfig.cmsOrigin || publicConfig.siteOrigin;
  const commentsUrl = new URL('/wp-json/pfoy/v1/comments', apiOrigin).toString();
  const turnstileSiteKey = publicConfig.turnstileSiteKey;

  type CommentResponse = {
    post_id: number;
    comments_open: boolean;
    page: number;
    per_page: number;
    total_records: number;
    total_pages: number;
    complete: boolean;
    items: PublicComment[];
    context: PublicComment[];
  };

  type TurnstileApi = {
    render: (container: HTMLElement, options: {
      sitekey: string;
      action: 'comment';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    }) => string | number;
    reset: (id?: string | number) => void;
    remove: (id: string | number) => void;
  };

  function isComment(value: unknown): value is PublicComment {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const comment = value as Record<string, unknown>;
    const fields = ['id', 'post_id', 'parent', 'author', 'date', 'content'];
    return Object.keys(comment).every((key) => fields.includes(key))
      && fields.every((key) => key in comment)
      && Number.isSafeInteger(comment.id) && Number(comment.id) > 0
      && comment.post_id === postId
      && Number.isSafeInteger(comment.parent) && Number(comment.parent) >= 0
      && typeof comment.author === 'string'
      && typeof comment.date === 'string' && Number.isFinite(Date.parse(comment.date))
      && typeof comment.content === 'string';
  }

  async function refreshComments() {
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;
    refreshState = 'loading';
    refreshMessage = 'Loading the latest approved comments; the published snapshot remains visible until the full thread is received.';
    try {
      let expectedTotal: number | undefined;
      let expectedPages: number | undefined;
      let expectedCommentsOpen: boolean | undefined;
      let receivedItems = 0;
      let page = 1;
      const records = new Map<number, PublicComment>();
      const context = new Map<number, PublicComment>();
      while (true) {
        const url = new URL(commentsUrl);
        url.searchParams.set('post_id', String(postId));
        url.searchParams.set('page', String(page));
        url.searchParams.set('per_page', '50');
        const response = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]), headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('The comment service could not load the complete thread.');
        const body = await response.json() as Partial<CommentResponse>;
        if (body.post_id !== postId || body.page !== page || body.per_page !== 50
          || typeof body.total_records !== 'number' || !Number.isSafeInteger(body.total_records) || body.total_records < 0
          || typeof body.total_pages !== 'number' || !Number.isSafeInteger(body.total_pages) || body.total_pages < 0
          || typeof body.comments_open !== 'boolean' || typeof body.complete !== 'boolean'
          || !Array.isArray(body.items) || !Array.isArray(body.context)
          || !body.items.every(isComment) || !body.context.every(isComment)) {
          throw new Error('The comment service returned an incomplete or invalid page.');
        }
        if (expectedTotal === undefined) {
          expectedTotal = body.total_records;
          expectedPages = body.total_pages;
          expectedCommentsOpen = body.comments_open;
        } else if (expectedTotal !== body.total_records || expectedPages !== body.total_pages
          || expectedCommentsOpen !== body.comments_open) {
          throw new Error('The approved comment totals changed while pages were loading.');
        }
        if (body.total_pages !== Math.ceil(body.total_records / 50) || page > Math.max(1, body.total_pages)
          || body.complete !== (page >= body.total_pages)
          || body.items.length !== Math.max(0, Math.min(50, body.total_records - (page - 1) * 50))) {
          throw new Error('The comment service returned inconsistent pagination metadata.');
        }
        receivedItems += body.items.length;
        for (const comment of body.items) records.set(comment.id, comment);
        for (const comment of body.context) context.set(comment.id, comment);
        if (page >= body.total_pages) break;
        page += 1;
      }
      if (receivedItems !== expectedTotal || records.size !== expectedTotal) throw new Error('The approved comment pages were incomplete or duplicated.');
      for (const [id, comment] of context) if (!records.has(id)) records.set(id, comment);
      if ([...records.values()].some((comment) => comment.parent !== 0 && !records.has(comment.parent))) {
        throw new Error('The approved comment thread contains a reply without its public parent.');
      }
      refreshedComments = [...records.values()].sort((a, b) => a.id - b.id);
      canComment = expectedCommentsOpen ?? false;
      refreshedCount = expectedTotal ?? 0;
      refreshState = 'current';
      refreshMessage = visibleComments.length
        ? `${expectedTotal} approved ${expectedTotal === 1 ? 'comment' : 'comments'} loaded.`
        : 'There are no approved comments right now.';
      void setupChallenge();
    } catch (error) {
      if (controller.signal.aborted) return;
      canComment = false;
      refreshState = 'stale';
      refreshMessage = error instanceof Error
        ? `${error.message} Showing the published snapshot, which may be out of date.`
        : 'The latest comments could not be confirmed. Showing the published snapshot, which may be out of date.';
    }
  }

  function getTurnstile(): TurnstileApi | undefined {
    return (window as Window & { turnstile?: TurnstileApi }).turnstile;
  }

  function loadTurnstile(): Promise<void> {
    if (getTurnstile()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-pfoy-turnstile]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Challenge service unavailable.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.pfoyTurnstile = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Challenge service unavailable.'));
      document.head.append(script);
    });
  }

  function setupChallenge() {
    if (import.meta.env.DEV) {
      challengeUnavailable = true;
      return Promise.resolve();
    }
    if (!turnstileSiteKey) {
      challengeUnavailable = true;
      return Promise.resolve();
    }
    if (!canComment || widgetId !== undefined) return Promise.resolve();
    if (challengeSetup) return challengeSetup;
    challengeSetup = (async () => {
      await loadTurnstile();
      await tick();
      if (!canComment || !challengeContainer || !getTurnstile()) return;
      widgetId = getTurnstile()?.render(challengeContainer, {
        sitekey: turnstileSiteKey,
        action: 'comment',
        callback: (token) => { challengeToken = token; challengeReady = true; formMessage = 'Anti-spam challenge complete.'; },
        'expired-callback': () => { challengeToken = ''; challengeReady = false; formMessage = 'The anti-spam challenge expired. Complete it again.'; },
        'error-callback': () => { challengeToken = ''; challengeReady = false; formMessage = 'The anti-spam challenge could not be verified. Please retry it.'; }
      });
      challengeReady = true;
    })().catch(() => {
      challengeUnavailable = true;
      formMessage = 'Comment submission is unavailable because the anti-spam challenge could not load.';
    }).finally(() => {
      challengeSetup = undefined;
    });
    return challengeSetup;
  }

  function selectReply(id: number) {
    parentId = id;
    formMessage = `Replying to comment ${id}.`;
    document.getElementById('comment-name')?.focus();
  }

  async function submitComment(event: SubmitEvent) {
    event.preventDefault();
    if (import.meta.env.DEV) {
      formMessage = 'Comment submission is disabled during local development.';
      return;
    }
    if (!turnstileSiteKey) {
      formMessage = 'Comments cannot be submitted because the public Turnstile site key is not configured.';
      return;
    }
    if (!challengeToken) {
      formMessage = 'Complete the anti-spam challenge before submitting.';
      return;
    }
    submitting = true;
    formMessage = 'Sending your comment securely…';
    try {
      const payload: { post_id: number; parent_id?: number; name: string; email: string; content: string; token: string } = {
        post_id: postId,
        name: formName.trim(),
        email: formEmail.trim(),
        content: formContent.trim(),
        token: challengeToken
      };
      if (parentId !== null) payload.parent_id = parentId;
      const response = await fetch(commentsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null) as { accepted?: boolean; status?: string; code?: string } | null;
      challengeToken = '';
      if (widgetId !== undefined) getTurnstile()?.reset(widgetId);
      if (response.status === 202 && result?.accepted === true) {
        if (result.status === 'pending_review') formMessage = 'Thank you. Your comment was received and is pending review; it is not public yet.';
        else if (result.status === 'approved') formMessage = 'Thank you. Your comment was approved and is now public.';
        else if (result.status === 'not_public') formMessage = 'Your comment was accepted, but this discussion is not currently public.';
        else formMessage = 'The comment service accepted the submission but returned an unknown visibility outcome. It is not safe to claim it is public.';
      } else if (result?.code === 'pfoy_rate_limited' || response.status === 429) {
        formMessage = 'Too many comments were submitted recently. Please wait and try again.';
      } else if (result?.code === 'pfoy_challenge_failed') {
        formMessage = 'The anti-spam challenge could not be verified. Complete it again and retry.';
      } else if (result?.code === 'pfoy_challenge_unavailable' || response.status === 503) {
        formMessage = 'Comment verification is temporarily unavailable. Your draft is still here; please try later.';
      } else if (result?.code === 'pfoy_comments_closed' || response.status === 409) {
        canComment = false;
        formMessage = 'This discussion has closed and did not accept the comment.';
      } else if (result?.code === 'pfoy_invalid_input' || result?.code === 'pfoy_invalid_parent' || response.status === 400 || response.status === 403) {
        formMessage = 'The comment was not accepted. Check the name, email, comment, reply target, and anti-spam challenge, then try again.';
      } else if (response.status === 404) {
        canComment = false;
        formMessage = 'This discussion is no longer available and did not accept the comment.';
      } else {
        formMessage = 'The comment service did not confirm acceptance. Your comment may or may not have been recorded; check before retrying.';
      }
    } catch {
      challengeToken = '';
      if (widgetId !== undefined) getTurnstile()?.reset(widgetId);
      formMessage = 'We could not confirm whether your comment was received. It may or may not have been recorded; check before retrying.';
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    hydrated = true;
    void refreshComments();
    void setupChallenge();
    return () => {
      requestController?.abort();
      if (widgetId !== undefined) getTurnstile()?.remove(widgetId);
    };
  });
</script>

<section class="discussion" id="comments" aria-labelledby="comments-title">
  <p class="eyebrow">Conversation</p>
  <h2 id="comments-title">Reader notes{#if snapshotCount} <span>({snapshotCount})</span>{/if}</h2>
  <p class="snapshot-label">{refreshState === 'current' ? 'Approved comments from the latest complete refresh.' : 'Approved comments from the published snapshot.'}</p>
  <p class="live-status" aria-live="polite" aria-atomic="true">{refreshMessage}</p>
  {#if visibleComments.length}
    <ol>
      {#each visibleComments as comment (comment.id)}
        <li id="comment-{comment.id}" class:reply={comment.parent !== 0}>
          <article><header><strong>{comment.author}</strong><time datetime={comment.date}>{new Date(comment.date).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time></header>
            <p>{comment.content}</p>
            {#if comment.parent}<a class="reply-link" href="#comment-{comment.parent}">In reply to an earlier note</a>{/if}
            {#if hydrated && canComment && !import.meta.env.DEV}<button class="reply-button interaction" type="button" onclick={() => selectReply(comment.id)} aria-label="Reply to {comment.author}">Reply</button>{/if}
          </article>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="empty">{refreshState === 'current' ? 'There are no approved comments right now.' : 'There are no approved comments in the published snapshot.'}</p>
  {/if}
  {#if hydrated && canComment}
    <section class="comment-form interaction" aria-labelledby="comment-form-title">
      <h3 id="comment-form-title">Leave a comment</h3>
      {#if import.meta.env.DEV}
        <p class="availability" role="status">Comment submission is disabled during local development. No comment will be sent.</p>
      {:else if !turnstileSiteKey || challengeUnavailable}
        <p class="availability" role="status">{!turnstileSiteKey ? 'Comment submission is unavailable because the public Turnstile site key is not configured.' : 'Comment submission is unavailable because the anti-spam challenge could not be loaded.'}</p>
      {:else}
        <form onsubmit={submitComment}>
          {#if parentId !== null}<p>Replying to comment {parentId}. <button type="button" class="cancel-reply" onclick={() => { parentId = null; formMessage = ''; }}>Cancel reply</button></p>{/if}
          <label for="comment-name">Name</label><input id="comment-name" bind:value={formName} autocomplete="name" required maxlength="100" />
          <label for="comment-email">Email (not shown publicly)</label><input id="comment-email" type="email" bind:value={formEmail} autocomplete="email" required maxlength="254" />
          <label for="comment-content">Comment</label><textarea id="comment-content" bind:value={formContent} required maxlength="10000" rows="5"></textarea>
          <div bind:this={challengeContainer} class="challenge"></div>
          <button type="submit" disabled={submitting || !challengeReady || !challengeToken}>{submitting ? 'Sending…' : 'Submit comment'}</button>
        </form>
      {/if}
      <p class="form-status" role="status" aria-live="polite" aria-atomic="true">{formMessage}</p>
    </section>
  {:else if hydrated}
    <p class="availability interaction" role="status">{refreshState === 'stale' ? 'New comments and replies are unavailable until the current discussion status can be verified.' : 'Comments are closed for new submissions.'}</p>
  {/if}
  <noscript><p class="noscript-note">Live comment updates and the comment form require JavaScript; the published snapshot above remains readable.</p></noscript>
</section>

<style>
  .discussion { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--line); font: 1rem/1.6 Arial,Helvetica,sans-serif; }
  .eyebrow { margin: 0; color: var(--forest); font: 700 .75rem Arial,Helvetica,sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  h2 { margin: .3rem 0; font: normal 1.8rem Georgia,serif; }
  h2 span { color: var(--muted); font: 400 1rem Arial,Helvetica,sans-serif; }
  .snapshot-label, time, .reply-link { color: var(--muted); font-size: .85rem; }
  ol { display: grid; gap: .8rem; list-style: none; padding: 0; }
  li { padding: 1rem; background: var(--paper); border: 1px solid var(--line); border-radius: 8px; }
  li.reply { margin-left: clamp(1rem, 5vw, 3rem); }
  header { display: flex; flex-wrap: wrap; gap: .3rem .8rem; align-items: baseline; padding: 0; border: 0; background: transparent; }
  .empty, .availability { padding: 1rem; background: #f0f3eb; border: 1px solid #bdc9b2; border-radius: 8px; }
  .noscript-note, .live-status, .form-status { font-size: .9rem; }
  .comment-form { margin-top: 2rem; padding: 1.25rem; background: #f0f3eb; border: 1px solid #bdc9b2; border-radius: 8px; }
  h3 { margin-top: 0; font: normal 1.4rem Georgia,serif; }
  form { display: grid; gap: .65rem; }
  input, textarea { width: 100%; padding: .65rem; border: 1px solid var(--sage); border-radius: 4px; background: var(--paper); color: var(--ink); font: inherit; }
  button { min-height: 2.75rem; padding: .55rem .9rem; border: 1px solid var(--forest); border-radius: 30px; background: var(--forest); color: white; font: 600 .95rem Arial,Helvetica,sans-serif; cursor: pointer; }
  button:focus-visible, input:focus-visible, textarea:focus-visible, a:focus-visible { outline: 3px solid #9c6349; outline-offset: 5px; }
  button:disabled { cursor: not-allowed; opacity: .65; }
  .reply-button { margin-top: .4rem; min-height: 2.25rem; padding: .3rem .65rem; font-size: .85rem; }
  .cancel-reply { min-height: auto; padding: .2rem .4rem; background: transparent; color: var(--forest); }
  .challenge { min-height: 65px; }
  @media print { .interaction, .live-status, .noscript-note { display: none !important; } .discussion { display: none !important; } }
</style>
