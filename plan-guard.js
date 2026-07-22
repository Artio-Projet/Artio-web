// ════════════════════════════════════════════════════════════════
// plan-guard.js — Artio feature gating (Free / Solo / Pro)
//
// 3 niveaux d'accès :
//   - "free"  jamais abonné       → bloqué sauf landing/settings
//   - "free"  ex-abonné           → lecture seule (historique)
//   - "solo"  abonné Solo          → accès complet Solo
//   - "pro"   abonné Pro           → accès complet
//
// Usage dans chaque page :
//   const PAGE_PLAN_REQUIRED = "solo"; // ou "pro"
//   <script src="plan-guard.js"></script>  ← après Supabase
//
// Gater une feature Pro inline :
//   PlanGuard.onReady(() => {
//     if (!PlanGuard.isPro()) PlanGuard.gate("pro", el, "Label");
//   });
// ════════════════════════════════════════════════════════════════

window.PlanGuard = (() => {

  const SB_URL = "https://mwmexkoeqeyueqgdkkni.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bWV4a29lcWV5dWVxZ2Rra25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDEzMzcsImV4cCI6MjA5MDk3NzMzN30.380jxCN_CpWqmnwraob5crwUeBpTQxrXsTe2YDF-Rk8";

  const PLAN_RANK = { free: 0, restricted: 0, solo: 1, pro: 2 };

  let _plan          = null;
  let _isAdmin       = false;
  let _wasSubscribed = false; // a déjà eu un abonnement Stripe
  let _ready         = false;
  let _onReady       = [];

  // ── Styles ────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("pg-styles")) return;
    const style = document.createElement("style");
    style.id = "pg-styles";
    style.textContent = `
      /* Fallbacks si la page ne définit pas les variables de thème */
      :root {
        --pg-surface: var(--surface, #0e1220);
        --pg-bg:      var(--bg, #080b14);
        --pg-text:    var(--text, #e2e5f1);
        --pg-muted:   var(--muted, #6b7494);
        --pg-amber:   var(--amber, #f5a742);
        --pg-amber-dim: var(--amber-dim, rgba(245,167,66,0.12));
        --pg-purple:  var(--purple, #a78bfa);
        --pg-purple-dim: var(--purple-dim, rgba(167,139,250,0.12));
        --pg-border:  var(--border-hi, rgba(255,255,255,0.13));
      }
      /* Overlay Free (jamais abonné) */
      #pg-overlay {
        position:fixed;inset:0;z-index:9000;
        display:flex;align-items:center;justify-content:center;
        background:color-mix(in srgb, var(--pg-bg) 85%, transparent);
        backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
        animation:pg-fade .25s ease;
      }
      @keyframes pg-fade { from{opacity:0} to{opacity:1} }
      #pg-overlay-box {
        background:var(--pg-surface);
        border:1px solid var(--pg-amber-dim);
        border-radius:22px;padding:36px 32px 32px;
        max-width:400px;width:90%;text-align:center;
        box-shadow:0 0 80px rgba(0,0,0,0.25);
        font-family:'Plus Jakarta Sans',sans-serif;
      }
      #pg-overlay-icon { font-size:42px;margin-bottom:12px; }
      #pg-overlay-title {
        font-family:'Space Grotesk',sans-serif;
        font-size:20px;font-weight:700;color:var(--pg-text);
        margin-bottom:8px;letter-spacing:-0.02em;
      }
      #pg-overlay-sub {
        font-size:13px;color:var(--pg-muted);
        line-height:1.65;margin-bottom:24px;
      }
      #pg-overlay-cta {
        display:block;width:100%;padding:13px;
        background:var(--pg-amber);border:none;border-radius:12px;
        color:var(--pg-bg);font-size:14px;font-weight:700;
        font-family:'Space Grotesk',sans-serif;
        cursor:pointer;text-decoration:none;
        box-shadow:0 0 24px var(--pg-amber-dim);
        transition:transform .15s,opacity .2s;
      }
      #pg-overlay-cta:hover { transform:translateY(-1px); }
      #pg-overlay-back {
        display:block;margin-top:12px;
        font-size:12px;color:var(--pg-muted);
        cursor:pointer;background:none;border:none;
        font-family:'Plus Jakarta Sans',sans-serif;
      }
      #pg-overlay-back:hover { color:var(--pg-text); }

      /* Bannière lecture seule (ex-abonné) */
      #pg-readonly-banner {
        position:sticky;top:60px;z-index:800;
        background:var(--pg-amber-dim);
        border-bottom:1px solid var(--pg-amber-dim);
        padding:10px 20px;
        display:flex;align-items:center;justify-content:space-between;
        gap:12px;flex-wrap:wrap;
        font-family:'Plus Jakarta Sans',sans-serif;
        font-size:13px;
      }
      #pg-readonly-banner .pg-rb-left {
        display:flex;align-items:center;gap:8px;
        color:var(--pg-text);
      }
      #pg-readonly-banner .pg-rb-icon { font-size:16px; }
      #pg-readonly-banner strong { color:var(--pg-amber); }
      #pg-readonly-banner a {
        padding:6px 16px;border-radius:8px;
        background:var(--pg-amber);color:var(--pg-bg);
        font-size:12px;font-weight:700;
        font-family:'Space Grotesk',sans-serif;
        text-decoration:none;white-space:nowrap;
        transition:opacity .2s;
      }
      #pg-readonly-banner a:hover { opacity:.85; }

      /* Badge Pro lock */
      .pg-lock {
        display:inline-flex;align-items:center;gap:5px;
        background:var(--pg-purple-dim);
        border:1px solid var(--pg-purple-dim);
        border-radius:100px;padding:3px 10px 3px 7px;
        font-size:11px;font-weight:700;color:var(--pg-purple);
        cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;
        transition:background .2s;vertical-align:middle;
        margin-left:6px;white-space:nowrap;
      }
      .pg-lock:hover { background:var(--pg-purple-dim); }

      /* Wrapper éléments floutés */
      .pg-gated-wrap {
        position:relative;display:inline-block;
      }
      .pg-gated-wrap .pg-lock {
        position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%);
        z-index:10;filter:none !important;
      }

      /* Modal upgrade Pro */
      #pg-modal-overlay {
        position:fixed;inset:0;z-index:9100;
        display:flex;align-items:center;justify-content:center;
        background:color-mix(in srgb, var(--pg-bg) 75%, transparent);
        backdrop-filter:blur(8px);
        animation:pg-fade .2s ease;
      }
      #pg-modal-box {
        background:var(--pg-surface);
        border:1px solid var(--pg-purple-dim);
        border-radius:22px;padding:32px 28px 28px;
        max-width:380px;width:90%;text-align:center;
        box-shadow:0 0 60px rgba(0,0,0,0.25);
        font-family:'Plus Jakarta Sans',sans-serif;
      }
      #pg-modal-badge {
        display:inline-flex;align-items:center;gap:6px;
        background:var(--pg-purple-dim);
        border:1px solid var(--pg-purple-dim);
        border-radius:100px;padding:4px 14px;
        font-size:11px;font-weight:800;color:var(--pg-purple);
        letter-spacing:.06em;margin-bottom:16px;
      }
      #pg-modal-title {
        font-family:'Space Grotesk',sans-serif;
        font-size:18px;font-weight:700;color:var(--pg-text);
        margin-bottom:8px;letter-spacing:-0.02em;
      }
      #pg-modal-sub {
        font-size:13px;color:var(--pg-muted);
        line-height:1.65;margin-bottom:22px;
      }
      #pg-modal-cta {
        display:block;width:100%;padding:12px;
        background:var(--pg-purple);border:none;border-radius:12px;
        color:#fff;font-size:14px;font-weight:700;
        font-family:'Space Grotesk',sans-serif;
        cursor:pointer;text-decoration:none;
        transition:transform .15s;
      }
      #pg-modal-cta:hover { transform:translateY(-1px); }
      #pg-modal-close {
        display:block;margin-top:10px;
        font-size:12px;color:var(--pg-muted);
        cursor:pointer;background:none;border:none;
        font-family:'Plus Jakarta Sans',sans-serif;
      }
      #pg-modal-close:hover { color:var(--pg-text); }
    `;
    document.head.appendChild(style);
  }

  // ── Overlay blocage total (Free jamais abonné) ─────────────────
  function showFreeOverlay() {
    injectStyles();
    if (document.getElementById("pg-overlay")) return;
    const box = document.createElement("div");
    box.id = "pg-overlay";
    box.innerHTML = `
      <div id="pg-overlay-box">
        <div id="pg-overlay-icon">🚀</div>
        <div id="pg-overlay-title">Abonnement requis</div>
        <div id="pg-overlay-sub">
          Cette page nécessite un abonnement <strong style="color:var(--pg-amber)">Solo</strong> ou <strong style="color:var(--pg-purple)">Pro</strong>.<br>
          Choisissez votre plan pour commencer.
        </div>
        <a id="pg-overlay-cta" href="settings.html?tab=abonnement">🚀 Voir les abonnements</a>
        <button id="pg-overlay-back" onclick="history.back()">← Retour</button>
      </div>`;
    document.body.appendChild(box);
  }

  // ── Bannière lecture seule (Free ex-abonné) ────────────────────
  function showReadonlyBanner() {
    injectStyles();
    if (document.getElementById("pg-readonly-banner")) return;
    const banner = document.createElement("div");
    banner.id = "pg-readonly-banner";
    banner.innerHTML = `
      <div class="pg-rb-left">
        <span class="pg-rb-icon">📂</span>
        <span><strong>Mode lecture</strong> — Accès à votre historique. La création de nouveaux documents nécessite un abonnement actif.</span>
      </div>
      <a href="settings.html?tab=abonnement">↩ Se réabonner</a>`;
    // Insérer juste après la topbar (nav fixe)
    const nav = document.querySelector(".topbar") || document.querySelector("header") || document.querySelector("nav");
    if (nav && nav.nextSibling) {
      nav.parentNode.insertBefore(banner, nav.nextSibling);
    } else {
      document.body.prepend(banner);
    }
  }

  // ── Modal upgrade Pro ──────────────────────────────────────────
  function showProModal(featureLabel) {
    injectStyles();
    const existing = document.getElementById("pg-modal-overlay");
    if (existing) existing.remove();
    const box = document.createElement("div");
    box.id = "pg-modal-overlay";
    box.innerHTML = `
      <div id="pg-modal-box">
        <div id="pg-modal-badge">⚡ PRO</div>
        <div id="pg-modal-title">${featureLabel || "Fonctionnalité Pro"}</div>
        <div id="pg-modal-sub">
          Cette fonctionnalité est disponible avec le plan <strong style="color:var(--pg-purple)">Pro</strong> à 39 €/mois.
          Passez au Pro pour débloquer Gmail, la signature électronique, les exports et bien plus.
        </div>
        <a id="pg-modal-cta" href="settings.html?tab=abonnement">⚡ Passer au Pro — 39 €/mois</a>
        <button id="pg-modal-close">Pas maintenant</button>
      </div>`;
    document.body.appendChild(box);
    box.addEventListener("click", e => { if (e.target === box) box.remove(); });
    document.getElementById("pg-modal-close").addEventListener("click", () => box.remove());
  }

  // ── Gater un élément ou remplacer une fonction ─────────────────
  // target = HTMLElement → floute l'élément + badge 🔒
  // target = Function   → retourne une fonction qui ouvre le modal
  function gate(requiredPlan, target, featureLabel) {
    const reqRank  = PLAN_RANK[requiredPlan] ?? 1;
    const userRank = PLAN_RANK[_plan] ?? 0;
    if (userRank >= reqRank) return true; // accès OK

    if (target instanceof HTMLElement) {
      target.style.filter       = "blur(3px)";
      target.style.pointerEvents= "none";
      target.style.userSelect   = "none";
      const wrap = document.createElement("div");
      wrap.className = "pg-gated-wrap";
      target.parentNode.insertBefore(wrap, target);
      wrap.appendChild(target);
      const badge = document.createElement("span");
      badge.className = "pg-lock";
      badge.innerHTML = "🔒 Pro";
      badge.title = featureLabel || "Fonctionnalité Pro";
      badge.addEventListener("click", e => {
        e.stopPropagation();
        showProModal(featureLabel);
      });
      wrap.appendChild(badge);
      return false;
    }

    if (typeof target === "function") {
      return () => showProModal(featureLabel);
    }

    return false;
  }

  // ── Init ───────────────────────────────────────────────────────
  async function init() {
    injectStyles();

    // Lecture rapide depuis sessionStorage pour éviter le round-trip Supabase
    const CACHE_VERSION = "v2"; // incrémenter pour invalider le cache
    const cached = sessionStorage.getItem("artio_plan");
    const cachedWas = sessionStorage.getItem("artio_was_subscribed");
    const cachedV = sessionStorage.getItem("artio_plan_v");
    if (cached && cachedV === CACHE_VERSION) {
      _plan = cached;
      _wasSubscribed = cachedWas === "1";
    }

    try {
      // Réutilise le client Supabase de la page si disponible (évite le double GoTrueClient)
      let sb = window.sb;
      if (!sb) {
        const { createClient } = window.supabase;
        sb = createClient(SB_URL, SB_KEY);
      }
      const { data: { session } } = await sb.auth.getSession();

      if (!session) {
        _plan = "free"; _wasSubscribed = false;
      } else {
        const { data: p } = await sb.from("profils")
          .select("subscription_status, stripe_customer_id, is_admin")
          .eq("user_id", session.user.id)
          .single();

        _isAdmin       = p?.is_admin === true;
        _plan          = _isAdmin ? "pro" : (p?.subscription_status || "free");
        // A déjà été abonné = stripe_customer_id présent en DB
        _wasSubscribed = !!p?.stripe_customer_id;
      }
    } catch(e) {
      _plan = _plan || "free";
      console.warn("PlanGuard: erreur lecture plan", e);
    }

    try {
      sessionStorage.setItem("artio_plan", _plan);
      sessionStorage.setItem("artio_was_subscribed", _wasSubscribed ? "1" : "0");
      sessionStorage.setItem("artio_plan_v", CACHE_VERSION);
    } catch(e) {}

    _ready = true;
    _onReady.forEach(fn => fn(_plan));
    _onReady = [];

    // Vérifier le niveau requis par la page
    const required = window.PAGE_PLAN_REQUIRED; // "solo" ou "pro"
    if (!required) return;

    const reqRank  = PLAN_RANK[required] ?? 1;
    const userRank = PLAN_RANK[_plan] ?? 0;

    if (userRank >= reqRank) return; // accès OK

    if (_wasSubscribed) {
      // Ex-abonné → lecture seule, bannière discrète
      showReadonlyBanner();
      // Signaler aux pages via un event
      document.dispatchEvent(new CustomEvent("pg:readonly"));
    } else {
      // Jamais abonné → overlay de blocage
      showFreeOverlay();
    }
  }

  return {
    init,
    gate,
    showProModal,
    isAdmin:        () => _isAdmin,
    isPro:          () => _plan === "pro" || _isAdmin,
    isSolo:         () => _isAdmin || _plan === "solo" || _plan === "pro",
    isFree:         () => !_isAdmin && (!_plan || _plan === "free" || _plan === "restricted"),
    isReadOnly:     () => (_plan === "free" || _plan === "restricted") && _wasSubscribed,
    wasSubscribed:  () => _wasSubscribed,
    getPlan:        () => _plan,
    onReady:        (fn) => { if (_ready) fn(_plan); else _onReady.push(fn); },
  };

})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => PlanGuard.init());
} else {
  PlanGuard.init();
}
