<script lang="ts">
  import { onMount } from 'svelte';
  import { publicConfig } from '#lib/config.ts';
  import { hasAdConsent, hasCurrentGppAdsPermission, setAdPermission, type GppPingData, type TcfPermission } from '../advertising.ts';

  type GoogleFc = {
    callbackQueue?: { push(callbacks: Record<string, () => void>): void };
    showRevocationMessage?: () => void;
    usstatesoptout?: { openConfirmationDialog?: (callback: (optedOut: boolean) => void) => void };
  };
  type TcfApi = (command: string, version: number, callback: (data: TcfPermission | null, success: boolean) => void) => void;
  type GppEvent = { eventName?: string; listenerId?: number; data?: unknown; pingData?: GppPingData & { cmpStatus?: string } };
  type GppApi = (command: string, callback: (event: GppEvent, success: boolean) => void) => void;
  let tcfSubscribed = false;
  let gppSubscribed = false;
  let tcfData: TcfPermission | null = null;
  let tcfSuccess = false;
  let gppReady = false;
  let usStateAllowed = false;

  function updatePermission() {
    const permitted = tcfSuccess && hasAdConsent(tcfData) && gppReady && usStateAllowed;
    setAdPermission(permitted);
    window.dispatchEvent(new CustomEvent('pfoy-ad-permission', { detail: permitted }));
    const ads = (window as Window & { adsbygoogle?: { pauseAdRequests?: number } }).adsbygoogle;
    if (ads) ads.pauseAdRequests = permitted ? 0 : 1;
    if (!permitted) document.querySelectorAll('.pfoy-ad-slot iframe').forEach((frame) => frame.remove());
  }

  onMount(() => {
    if (!publicConfig.adsEnabled) return;
    const target = window as Window & { googlefc?: GoogleFc; __tcfapi?: TcfApi; __gpp?: GppApi };
    const fc = target.googlefc ?? {};
    fc.callbackQueue ??= [];
    target.googlefc = fc;

    const startTcfListener = () => {
      if (tcfSubscribed) return;
      const tcf = target.__tcfapi;
      if (!tcf) return updatePermission();
      tcfSubscribed = true;
      tcf('addEventListener', 2, (data, success) => {
        tcfData = data;
        tcfSuccess = success === true;
        updatePermission();
      });
    };

    const startGppListener = () => {
      if (gppSubscribed) return;
      const gpp = target.__gpp;
      if (!gpp) return updatePermission();
      gppSubscribed = true;
      gpp('addEventListener', (event, success) => {
        if (!success) {
          gppReady = false;
          usStateAllowed = false;
        } else if (event.eventName === 'listenerRegistered' || event.eventName === 'signalStatus') {
          if (event.pingData?.signalStatus === 'ready' &&
              (event.eventName === 'listenerRegistered' || event.data === 'ready')) {
            gppReady = true;
            usStateAllowed = hasCurrentGppAdsPermission(event.pingData);
          } else {
            gppReady = false;
            usStateAllowed = false;
          }
        } else if (event.eventName === 'sectionChange' || event.eventName === 'error' ||
                   (event.eventName === 'cmpStatus' && event.data === 'error')) {
          gppReady = false;
          usStateAllowed = false;
        }
        updatePermission();
      });
    };

    fc.callbackQueue.push({
      CONSENT_API_READY: startTcfListener,
      CONSENT_DATA_READY: startTcfListener,
      INITIAL_US_STATES_OPT_OUT_DATA_READY: startGppListener
    });
    const script = document.createElement('script');
    script.src = publicConfig.ads.cmpUrl;
    script.async = true;
    script.onerror = () => updatePermission();
    document.head.append(script);
    return () => {
      setAdPermission(false);
      window.dispatchEvent(new CustomEvent('pfoy-ad-permission', { detail: false }));
    };
  });

  function reopen() {
    const fc = (window as Window & { googlefc?: GoogleFc }).googlefc;
    if (tcfData?.gdprApplies && fc?.showRevocationMessage) {
      fc.showRevocationMessage();
      return;
    }
    if (fc?.usstatesoptout?.openConfirmationDialog) {
      fc.usstatesoptout.openConfirmationDialog((optedOut) => {
        if (optedOut) {
          gppReady = false;
          usStateAllowed = false;
          updatePermission();
        }
      });
      return;
    }
    fc?.showRevocationMessage?.();
  }
</script>

{#if publicConfig.adsEnabled}
  <button class="privacy-choices" type="button" onclick={reopen} aria-label="Open privacy choices">Privacy choices</button>
{/if}

<style>
  .privacy-choices { position: fixed; z-index: 20; right: 1rem; bottom: 1rem; border: 1px solid #46543c; border-radius: 3px; padding: .65rem .85rem; color: #fff; background: #46543c; font: 12px/1.2 var(--font-body); cursor: pointer; }
  @media print { .privacy-choices { display: none !important; } }
</style>
