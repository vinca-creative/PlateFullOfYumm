<script lang="ts">
  import { onMount } from 'svelte';
  import { hasCurrentAdPermission } from '../advertising.ts';
  import { publicConfig } from '#lib/config.ts';

  let { slot }: { slot: string } = $props();
  let container = $state<HTMLElement | undefined>(undefined);
  let active = $state(false);
  let initialized = false;
  let observer: IntersectionObserver | null = null;
  let scriptLoading: Promise<void> | null = null;

  function loadAdsense(): Promise<void> {
    if (scriptLoading) return scriptLoading;
    scriptLoading = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-pfoy-adsense]');
      if (existing) {
        if ((window as Window & { adsbygoogle?: unknown[] }).adsbygoogle) resolve();
        else { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('AdSense unavailable')), { once: true }); }
        return;
      }
      const script = document.createElement('script');
      script.dataset.pfoyAdsense = 'true';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publicConfig.ads.publisherId)}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('AdSense unavailable'));
      document.head.append(script);
    });
    return scriptLoading;
  }

  async function activate() {
    if (initialized || !publicConfig.adsEnabled) return;
    initialized = true;
    try {
      await loadAdsense();
      const target = container;
      if (!active || !target?.isConnected) return;
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.dataset.adClient = publicConfig.ads.publisherId;
      ins.dataset.adSlot = slot;
      ins.dataset.adFormat = 'auto';
      ins.dataset.fullWidthResponsive = 'true';
      target.append(ins);
      const ads = (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle;
      if (ads) ads.push({});
    } catch { /* Ads unavailable: keep the bounded, unobtrusive reserve. */ }
  }

  function onPermission(event: Event) {
    active = (event as CustomEvent<boolean>).detail;
    if (active && container) observer?.observe(container);
    else {
      observer?.disconnect();
      container?.querySelectorAll('iframe, ins').forEach((element) => element.remove());
    }
  }
  onMount(() => {
    window.addEventListener('pfoy-ad-permission', onPermission);
    active = hasCurrentAdPermission();
    if ('IntersectionObserver' in window && container) {
      observer = new IntersectionObserver((entries) => {
        if (active && entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          observer = null;
          void activate();
        }
      }, { rootMargin: '300px' });
      observer.observe(container);
    }
    return () => {
      observer?.disconnect();
      window.removeEventListener('pfoy-ad-permission', onPermission);
    };
  });
</script>

{#if publicConfig.adsEnabled}
  <aside bind:this={container} class="pfoy-ad-slot" aria-label="Advertisements">
    <span>Advertisements</span>
  </aside>
{/if}

<style>
  .pfoy-ad-slot { box-sizing: border-box; width: 100%; min-height: 280px; margin: 1.5rem 0; overflow: visible; text-align: center; background: #f1eee6; }
  .pfoy-ad-slot > span { display: block; padding: .35rem; color: #5d655b; font: 10px/1 var(--font-body); text-transform: uppercase; letter-spacing: .08em; }
  @media print { .pfoy-ad-slot { display: none !important; } }
</style>
