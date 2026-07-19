/* ──────────────────────────────────────────────────────────────
   tour.js — Tutoriel interactif Artio (multi-pages) — v2
   Source unique de vérité : étapes + moteur + persistance.
   À inclure sur toutes les pages via : <script src="tour.js?v=2"></script>

   v2 — changements :
   - Descriptions alignées sur les nouveaux designs (dashboard, calendrier, dossiers, clients, rédiger)
   - Touche Échap pour quitter le tour à tout moment
   - Bouton croix (✕) en haut à droite de la card
   - Garde-fou anti-boucle : sessionStorage compteur, max 2 redirections vers la même page
   - Garde-fou step invalide : page inconnue → end() au lieu de rediriger
   - Auto-nettoyage si autoStart() lit un état corrompu (étape hors-bornes)
   ────────────────────────────────────────────────────────────── */
(function(){
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // HELPERS — Sidebar ouverte/fermée pour les étapes "menu"
  // ═══════════════════════════════════════════════════════════
  function _openSidebar(){
    const sb = document.querySelector('.sidebar');
    const ov = document.querySelector('.sidebar-overlay');
    if(sb) sb.classList.add('open');
    if(ov) ov.classList.add('open');
    setTimeout(function(){
      if(window.ArtioTour && window.ArtioTour.isActive()) window.ArtioTour.rerender();
    }, 320);
  }
  function _closeSidebar(){
    const sb = document.querySelector('.sidebar');
    const ov = document.querySelector('.sidebar-overlay');
    if(sb) sb.classList.remove('open');
    if(ov) ov.classList.remove('open');
  }

  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION — Les étapes du tour
  // ═══════════════════════════════════════════════════════════
  const TOUR_STEPS = [
    {
      page:"home",
      title:"👋 Bienvenue sur Artio !",
      desc:"En 2 minutes, découvre tout ce qu'Artio fait pour toi — création vocale de devis et factures, rédaction d'emails par IA, suivi de tes dossiers, signature électronique, et plus encore.<br><br>Tu peux quitter le tutoriel à tout moment avec la croix en haut à droite ou la touche <strong>Échap</strong>.",
      target:null, pos:"center"
    },
    {
      page:"home",
      title:"🧭 Le menu — tout commence ici",
      desc:"Voici le menu latéral, ouvert pour toi.<br><br>Tu y trouveras toutes les sections d'Artio : Créer, Dossiers, Rédiger, Clients, Tableau de bord, Calendrier, Paramètres…<br><br>Il s'ouvre depuis n'importe quelle page via l'icône <strong>☰</strong> en haut à gauche.",
      target:".sidebar", pos:"right",
      onEnter: _openSidebar,
      onLeave: _closeSidebar
    },
    {
      page:"home",
      title:"🏠 Ta page d'accueil",
      desc:"C'est ton point de départ. Tu y trouves :<br>• Un <strong>salut personnalisé</strong> avec l'heure et le statut de synchro<br>• Une ligne <strong>« contexte »</strong> qui résume tes actions en cours (devis à relancer, signatures en attente…)<br>• Le <strong>gros bouton orangé</strong> pour créer un devis ou une facture à la voix<br>• Les <strong>tuiles de navigation</strong> vers toutes les sections d'Artio<br><br>Pour tes statistiques (CA, conversion…), rendez-vous dans <strong>Tableau de bord</strong>.",
      target:null, pos:"center"
    },
    {
      page:"app",
      title:"🎙 Créer un document",
      desc:"Deux façons de remplir un devis ou une facture :<br><br>• 🎙 <strong>À la voix</strong> — clique sur l'orbe et dicte :<br><span class=\"tour-example\">« Devis pour M. Martin, coaching sportif mardi 14h, 3 heures, matériel 30 € »</span>• 📝 <strong>Manuellement</strong> — clique sur le bouton « ou remplir manuellement → » sous l'orbe.<br><br>Pour explorer un exemple complet, tu peux aussi utiliser le bouton ci-dessous.",
      target:[".create-orb-wrap", ".create-manual"],
      pos:"right",
      onEnter:"_tourShowOrb",
      forceClick:".create-manual",
      forceClickHint:"👉 Clique sur « ou remplir manuellement → » pour continuer",
      action:{label:"📝 Pré-remplir un exemple", fn:"_tourDemoFill"}
    },
    {
      page:"app",
      title:"👥 Annuaire & autocomplétion",
      desc:"Tape les premières lettres d'un client enregistré : il apparaît dans une liste. Un clic remplit nom, email, téléphone et adresse.<br><br>Tu peux aussi basculer entre <strong>Devis</strong> et <strong>Facture</strong> en haut du formulaire.",
      target:"input[data-fid=\"client_nom\"]", pos:"bottom",
      onEnter:"_tourEnsureManualForm"
    },
    {
      page:"app",
      title:"⚡ Générer le document",
      desc:"Ce bouton produit ton PDF. Une fois les champs remplis :<br>• L'IA rédige la description finale<br>• Les totaux HT/TVA/TTC sont calculés<br>• La numérotation est automatique (DEV-2026-XXX)<br>• Le dossier est créé dans <strong>Dossiers</strong>",
      target:".cf-btn-primary", pos:"top",
      onEnter:"_tourEnsureManualForm"
    },
    {
      page:"rediger",
      title:"✉️ Rédiger — le compositeur IA",
      desc:"Tu colles le message reçu d'un client, tu choisis le ton (<strong>Vouvoiement, Tutoiement, Chaleureux, Formel, Concis, Ferme…</strong>) et l'IA rédige la réponse pour toi.<br><br>Tu peux aussi décrire ta demande en langage naturel et l'IA produit un email complet, signé avec tes coordonnées.<br><br>L'envoi se fait directement depuis Artio si tu as connecté Gmail dans <strong>Paramètres</strong>.",
      target:null, pos:"center"
    },
    {
      page:"dossiers",
      title:"📁 Tes dossiers — vue inbox",
      desc:"Tous tes devis et factures, organisés comme une boîte mail à 3 colonnes :<br>• <strong>Catégories</strong> à gauche (Tous, À relancer, Signés, À facturer, Payés…)<br>• <strong>Liste</strong> des dossiers au centre<br>• <strong>Aperçu</strong> du document à droite<br><br>Le statut « À relancer » apparaît automatiquement à mi-validité du devis. Tu peux convertir un devis signé en facture en un clic.",
      target:null, pos:"center"
    },
    {
      page:"clients",
      title:"👥 Annuaire clients",
      desc:"Vue <strong>master-detail</strong> en plein écran : liste à gauche, fiche détaillée à droite.<br><br>Ajoute tes clients manuellement, ou ils se créent automatiquement quand tu génères un devis.<br><br>Pour les pros, renseigne le <strong>SIRET</strong> : Artio adapte les mentions légales sur tes PDF et peut aller chercher les infos via Pappers.",
      target:null, pos:"center"
    },
    {
      page:"dashboard",
      title:"📊 Tableau de bord",
      desc:"Tes indicateurs clés, repensés pour aller à l'essentiel :<br>• <strong>Hero CA</strong> avec courbe (sparkline) de l'évolution<br>• <strong>Anneau de conversion</strong> devis → facture<br>• <strong>Mini-cartes KPI</strong> (devis envoyés, signés, factures payées)<br>• <strong>Graphique annuel</strong> interactif par mois<br>• <strong>Flux d'activité</strong> en temps réel<br><br>Les calculs CA se basent sur la <strong>date de paiement</strong> (compatible URSSAF encaissement).",
      target:null, pos:"center"
    },
    {
      page:"comptabilite",
      title:"\ud83e\uddfe Comptabilit\u00e9 \u2014 tes 3 flux de factures",
      desc:"Cette page rassemble <strong>toutes</strong> tes factures, en trois onglets :<br><br>\u2022 <strong>\u00c9mises</strong> \u2014 celles que tu envoies \u00e0 tes clients<br>\u2022 <strong>Re\u00e7ues (PDP)</strong> \u2014 celles que tes fournisseurs t'envoient par voie \u00e9lectronique, r\u00e9cup\u00e9r\u00e9es automatiquement<br>\u2022 <strong>Ajout\u00e9es</strong> \u2014 celles que tu d\u00e9poses toi-m\u00eame : tickets de caisse, factures papier, PDF re\u00e7us par email<br><br>Les deux derniers onglets sont tes <strong>pi\u00e8ces de d\u00e9pense</strong> \u2014 les justificatifs que ton comptable r\u00e9clame.",
      target:null, pos:"center"
    },
    {
      page:"comptabilite",
      title:"\ud83d\udce4 Ne plus chercher ce qui a d\u00e9j\u00e0 \u00e9t\u00e9 envoy\u00e9",
      desc:"Chaque pi\u00e8ce de d\u00e9pense porte un statut : <strong>\u00c0 transmettre</strong> ou <strong>\u2713 Transmise</strong>.<br><br>Coche-les au fur et \u00e0 mesure, ou laisse Artio le faire : quand tu envoies un lot \u00e0 ton comptable, elles basculent automatiquement.<br><br>Les <strong>filtres</strong> en haut te montrent d'un coup d'\u0153il ce qu'il te reste \u00e0 envoyer \u2014 fini les relances pour des pi\u00e8ces d\u00e9j\u00e0 fournies.<br><br><small style=\"color:var(--muted)\">\u26a0 \u00ab Transmise \u00bb ne veut pas dire \u00ab supprimable \u00bb : la loi impose de conserver tes justificatifs <strong>10 ans</strong>.</small>",
      target:"#filter-transmission", pos:"bottom",
      onEnter:"_tourShowAjoutees"
    },
    {
      page:"comptabilite",
      title:"\ud83d\udce6 Envoyer un lot \u00e0 ton comptable",
      desc:"Coche les pi\u00e8ces avec les <strong>cases \u00e0 gauche</strong>, puis choisis :<br><br>\u2022 <strong>\ud83d\udce6 T\u00e9l\u00e9charger (ZIP)</strong> \u2014 une archive avec des noms de fichiers lisibles (date, commer\u00e7ant, num\u00e9ro). Disponible sur toutes les offres.<br>\u2022 <strong>\u2709\ufe0f Envoyer au comptable</strong> \u2014 un email avec les PDF en pi\u00e8ces jointes, envoy\u00e9 depuis ton adresse Gmail (offre <strong>Pro</strong>). Les pi\u00e8ces sont marqu\u00e9es transmises automatiquement.<br><br>Tu peux m\u00e9langer factures PDP et pi\u00e8ces ajout\u00e9es dans un m\u00eame envoi.",
      target:null, pos:"center",
      onEnter:"_tourShowAjoutees"
    },
    {
      page:"calendar",
      title:"📅 Calendrier",
      desc:"Vue jour à grand confort avec :<br>• <strong>Mini-calendrier</strong> mensuel à gauche, avec heat mapping (les jours chargés se distinguent)<br>• <strong>Panneau 7 jours</strong> des prochains rendez-vous<br>• Affichage automatique des <strong>jours fériés</strong><br><br>Connecte <strong>Google Calendar</strong> (offre Pro) pour synchroniser dans les deux sens : un événement créé dans Artio apparaît dans Google, et inversement.",
      target:null, pos:"center"
    },
    {
      page:"settings",
      title:"⚙️ Paramètres",
      desc:"Configure tout ce qui personnalise ton expérience :<br>• Profil entreprise (SIRET, TVA, IBAN)<br>• Connexion <strong>Gmail & Google Calendar</strong> (un seul clic, scopes unifiés)<br>• <strong>Contexte IA</strong> — pour des emails et descriptions plus pertinents<br>• Abonnement et facturation Stripe",
      target:null, pos:"center"
    },
    {
      page:"settings",
      title:"🏛️ Facturation électronique",
      desc:"Artio est <strong>Solution Compatible DGFiP</strong> via <strong>FactPulse</strong>, une plateforme agréée. Active-la ici pour émettre tes factures au format électronique.<br><br><strong>⚠ Démarche obligatoire :</strong> tu dois <strong>déclarer FactPulse comme ta plateforme</strong> dans l'annuaire du <strong>Portail Public de Facturation</strong> sur <strong>impots.gouv.fr</strong>. Cette déclaration se fait entreprise par entreprise, avec ton SIRET — Artio ne peut pas la faire à ta place.<br><br>Retrouve la démarche complète dans <strong>Aide → Réforme facturation électronique 2026</strong>.",
      target:null, pos:"center"
    },
    {
      page:"home",
      title:"🎉 Tu es prêt !",
      desc:"Bravo, tu as fait le tour complet d'Artio.<br><br>Retrouve ce tutoriel à tout moment depuis la page <strong style=\"color:var(--amber)\">Aide</strong>.<br><br><small style=\"color:var(--muted)\">La création de documents et l'IA nécessitent un abonnement Solo ou Pro.</small>",
      target:null, pos:"center"
    }
  ];

  // Pages valides — sert au garde-fou anti-step-invalide
  const VALID_PAGES = (function(){
    const s = {};
    TOUR_STEPS.forEach(function(st){ s[st.page] = true; });
    return s;
  })();

  // ═══════════════════════════════════════════════════════════
  // STATE & PERSISTANCE
  // ═══════════════════════════════════════════════════════════
  const LS_STEP   = 'artio_tour_step';
  const LS_ACTIVE = 'artio_tour_active';
  const LS_DONE   = 'artio_tour_done';
  // sessionStorage : compteur de redirections par page (anti-boucle)
  const SS_REDIR_COUNT = 'artio_tour_redir_count';
  const SS_REDIR_PAGE  = 'artio_tour_redir_page';
  const MAX_REDIRECTS_SAME_PAGE = 2;

  const state = { active:false, step:0 };

  // ═══════════════════════════════════════════════════════════
  // DÉTECTION DE PAGE
  // ═══════════════════════════════════════════════════════════
  function _currentPage(){
    const file = (location.pathname.split('/').pop() || '').replace('.html','');
    if(!file || file === 'index') return 'home';
    return file;
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP — nettoyage complet de la persistance
  // ═══════════════════════════════════════════════════════════
  function _cleanupStorage(){
    try {
      localStorage.removeItem(LS_ACTIVE);
      localStorage.removeItem(LS_STEP);
      sessionStorage.removeItem(SS_REDIR_COUNT);
      sessionStorage.removeItem(SS_REDIR_PAGE);
    } catch(e){}
  }

  // ═══════════════════════════════════════════════════════════
  // INJECTION CSS (une seule fois par page)
  // ═══════════════════════════════════════════════════════════
  function _injectCSS(){
    if(document.getElementById('artio-tour-css')) return;
    const style = document.createElement('style');
    style.id = 'artio-tour-css';
    style.textContent = `
      #artio-tour-overlay{position:fixed;inset:0;z-index:99999;pointer-events:none;}
      #artio-tour-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0);transition:background .4s;pointer-events:none;z-index:99996;}
      #artio-tour-backdrop.active{background:rgba(8,11,20,.78);pointer-events:all;}
      #artio-tour-spotlight{position:fixed;border-radius:14px;pointer-events:none;z-index:99997;box-shadow:0 0 0 9999px rgba(8,11,20,.78);transition:top .15s ease-out,left .15s ease-out,width .15s ease-out,height .15s ease-out;display:none;}
      #artio-tour-spotlight.active{display:block;}
      .tour-card{position:fixed;z-index:100001;background:var(--surface,#0e1220);border:1px solid rgba(245,167,66,.35);border-radius:16px;padding:22px 24px 18px;width:340px;max-width:calc(100vw - 24px);max-height:calc(100vh - 32px);overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,.6);pointer-events:all;transition:opacity .25s ease;opacity:0;}
      .tour-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;}
      .tour-card-title{font-family:var(--fh,'Space Grotesk',sans-serif);font-size:15px;font-weight:700;color:var(--text,#e2e5f1);flex:1;min-width:0;}
      .tour-card-meta{display:flex;align-items:center;gap:8px;flex-shrink:0;}
      .tour-card-step{font-size:11px;color:var(--muted,#6b7494);font-weight:500;}
      .tour-card-close{background:none;border:none;color:var(--muted,#6b7494);font-size:18px;cursor:pointer;padding:2px 6px;border-radius:6px;line-height:1;transition:all .15s;}
      .tour-card-close:hover{background:rgba(255,255,255,.06);color:var(--text,#e2e5f1);}
      .tour-card-desc{font-size:13px;color:var(--muted,#9aa3c2);line-height:1.6;margin-bottom:16px;}
      .tour-card-pro{display:inline-flex;align-items:center;gap:5px;background:rgba(245,167,66,.12);border:1px solid rgba(245,167,66,.3);border-radius:20px;padding:3px 10px;font-size:11px;color:var(--amber,#f5a742);font-weight:600;margin-bottom:12px;}
      .tour-progress{display:flex;gap:5px;margin-bottom:14px;flex-wrap:wrap;}
      .tour-dot{width:6px;height:6px;border-radius:50%;background:rgba(120,120,140,.25);transition:all .3s;}
      .tour-dot.active{background:var(--amber,#f5a742);width:18px;border-radius:3px;}
      .tour-dot.done{background:rgba(245,167,66,.45);}
      .tour-actions{display:flex;gap:8px;align-items:center;}
      .tour-btn-next{flex:1;padding:9px;background:var(--amber,#f5a742);color:#080b14;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--fh,'Space Grotesk',sans-serif);}
      .tour-btn-prev{padding:9px 12px;background:var(--surface-3,rgba(255,255,255,.04));color:var(--muted,#6b7494);border:1px solid var(--border,rgba(255,255,255,.07));border-radius:10px;font-size:13px;cursor:pointer;}
      .tour-btn-skip{padding:8px 0;background:none;color:var(--muted,#6b7494);border:none;font-size:11px;cursor:pointer;text-align:center;width:100%;margin-top:8px;text-decoration:underline;text-decoration-color:rgba(120,120,140,.25);transition:color .2s;}
      .tour-btn-skip:hover{color:var(--text,#e2e5f1);text-decoration-color:rgba(120,120,140,.6);}
      .tour-example{display:block;color:var(--amber,#f5a742);padding:10px 12px;background:rgba(245,167,66,.08);border-left:3px solid var(--amber,#f5a742);border-radius:6px;margin:10px 0;font-size:12.5px;font-style:italic;line-height:1.5;}
      .tour-warn{display:block;font-size:11.5px;color:#f5a742;padding:8px 10px;background:rgba(245,167,66,.06);border-radius:6px;margin-top:8px;line-height:1.5;}
      .tour-action-btn{display:block;width:100%;padding:9px;margin:10px 0 0;background:rgba(245,167,66,.12);color:var(--amber,#f5a742);border:1px solid rgba(245,167,66,.3);border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:var(--fb,'Plus Jakarta Sans',sans-serif);transition:all .15s;}
      .tour-action-btn:hover{background:rgba(245,167,66,.2);border-color:rgba(245,167,66,.5);}
      .tour-forceclick-hint{display:flex;align-items:center;gap:8px;padding:12px 14px;background:rgba(245,167,66,.12);border:1px dashed rgba(245,167,66,.45);border-radius:10px;font-size:12.5px;color:var(--amber,#f5a742);font-weight:600;line-height:1.45;margin-bottom:8px;}
      .tour-forceclick-hint .tour-fc-arrow{font-size:18px;animation:tour-fc-arrow 1s ease-in-out infinite;}
      @keyframes tour-fc-arrow{0%,100%{transform:translateX(0);}50%{transform:translateX(4px);}}
      .tour-highlight{position:relative;z-index:100000;border-radius:10px;box-shadow:0 0 0 4px rgba(245,167,66,.45),0 0 40px 10px rgba(245,167,66,.55)!important;animation:tour-pulse 1.8s ease-in-out infinite;}
      @keyframes tour-pulse{
        0%,100%{box-shadow:0 0 0 4px rgba(245,167,66,.45),0 0 32px 8px rgba(245,167,66,.5);}
        50%{box-shadow:0 0 0 7px rgba(245,167,66,.6),0 0 56px 16px rgba(245,167,66,.85);}
      }
    `;
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════
  // MOTEUR — Mount / Render / Position
  // ═══════════════════════════════════════════════════════════
  function _mount(){
    if(!document.getElementById('artio-tour-backdrop')){
      const bd = document.createElement('div');
      bd.id = 'artio-tour-backdrop';
      document.body.appendChild(bd);
      setTimeout(function(){ bd.classList.add('active'); }, 30);
    }
    if(!document.getElementById('artio-tour-spotlight')){
      const sp = document.createElement('div');
      sp.id = 'artio-tour-spotlight';
      document.body.appendChild(sp);
    }
    if(!document.getElementById('artio-tour-overlay')){
      const ov = document.createElement('div');
      ov.id = 'artio-tour-overlay';
      document.body.appendChild(ov);
    }
  }

  function _showFlatBackdrop(){
    const bd = document.getElementById('artio-tour-backdrop');
    if(bd) bd.classList.add('active');
    const sp = document.getElementById('artio-tour-spotlight');
    if(sp) sp.classList.remove('active');
  }

  function _showSpotlight(rect){
    if(!rect){ _showFlatBackdrop(); return; }
    const bd = document.getElementById('artio-tour-backdrop');
    if(bd) bd.classList.remove('active');
    let sp = document.getElementById('artio-tour-spotlight');
    if(!sp){
      sp = document.createElement('div');
      sp.id = 'artio-tour-spotlight';
      document.body.appendChild(sp);
    }
    const pad = 10;
    sp.style.top = (rect.top - pad) + 'px';
    sp.style.left = (rect.left - pad) + 'px';
    sp.style.width = (rect.width + pad * 2) + 'px';
    sp.style.height = (rect.height + pad * 2) + 'px';
    sp.classList.add('active');
  }

  function _removeHighlight(){
    document.querySelectorAll('.tour-highlight').forEach(function(el){
      el.classList.remove('tour-highlight');
    });
  }

  // ── ForceClick ──
  let _forceClickEl = null;
  let _forceClickHandler = null;
  function _detachForceClick(){
    if(_forceClickEl && _forceClickHandler){
      _forceClickEl.removeEventListener('click', _forceClickHandler, true);
    }
    _forceClickEl = null;
    _forceClickHandler = null;
  }
  function _attachForceClick(selector){
    _detachForceClick();
    if(!selector) return;
    let el = null;
    try { el = document.querySelector(selector); } catch(e){}
    if(!el) return;
    _forceClickEl = el;
    _forceClickHandler = function(){
      setTimeout(function(){ if(state.active) next(); }, 100);
    };
    el.addEventListener('click', _forceClickHandler, true);
  }

  // ── Tracking scroll/resize ──
  let _activeTargets = null;
  let _activePos = null;
  let _activePrimary = null;
  let _trackingListener = null;
  let _trackingRaf = null;

  function _onTrackingEvent(){
    if(_trackingRaf) return;
    _trackingRaf = requestAnimationFrame(function(){
      _trackingRaf = null;
      if(!state.active || !_activeTargets || _activeTargets.length === 0) return;
      const rect = _activeTargets.length > 1
        ? _unionRect(_activeTargets)
        : _activeTargets[0].getBoundingClientRect();
      if(rect) _showSpotlight(rect);
    });
  }

  function _attachTrackingListeners(){
    if(_trackingListener) return;
    _trackingListener = _onTrackingEvent;
    document.addEventListener('scroll', _trackingListener, true);
    window.addEventListener('resize', _trackingListener);
  }

  function _detachTrackingListeners(){
    if(!_trackingListener) return;
    document.removeEventListener('scroll', _trackingListener, true);
    window.removeEventListener('resize', _trackingListener);
    _trackingListener = null;
    _activeTargets = null;
    _activePos = null;
    _activePrimary = null;
    if(_trackingRaf){ cancelAnimationFrame(_trackingRaf); _trackingRaf = null; }
  }

  // ── Échap pour quitter ──
  let _keydownListener = null;
  function _attachKeydown(){
    if(_keydownListener) return;
    _keydownListener = function(e){
      if(e.key === 'Escape' || e.keyCode === 27){
        if(state.active){
          e.preventDefault();
          e.stopPropagation();
          end();
        }
      }
    };
    document.addEventListener('keydown', _keydownListener, true);
  }
  function _detachKeydown(){
    if(!_keydownListener) return;
    document.removeEventListener('keydown', _keydownListener, true);
    _keydownListener = null;
  }

  function _esc(s){ return String(s == null ? '' : s); }

  function _scrollTargetIntoView(rect, pos, isMobile){
    const vh = window.innerHeight;
    // Sur mobile, on réserve davantage de place pour la card (qui peut faire ~50% de l'écran).
    // pos:'top' = card AU-DESSUS de la cible → on veut la cible en bas → marge = haut du viewport
    // pos:'bottom' = card EN DESSOUS de la cible → on veut la cible en haut
    const margin = isMobile ? Math.round(vh * 0.45) : 90;
    let delta = 0;
    if(pos === 'bottom'){
      // Cible doit être suffisamment haut pour laisser la place à la card dessous
      delta = rect.top - 90;
    } else if(pos === 'top'){
      // Cible doit être suffisamment bas pour laisser la place à la card dessus
      delta = rect.bottom - (vh - margin);
    } else if(pos === 'right' || pos === 'left'){
      delta = rect.top + rect.height / 2 - vh / 2;
    } else {
      delta = rect.top + rect.height / 2 - vh / 2;
    }
    if(Math.abs(delta) > 4){
      window.scrollBy({ top: delta, behavior: 'auto' });
    }
  }

  function _unionRect(els){
    if(!els || els.length === 0) return null;
    let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    els.forEach(function(el){
      const r = el.getBoundingClientRect();
      if(r.top < top) top = r.top;
      if(r.left < left) left = r.left;
      if(r.right > right) right = r.right;
      if(r.bottom > bottom) bottom = r.bottom;
    });
    return { top: top, left: left, right: right, bottom: bottom, width: right - left, height: bottom - top };
  }

  function _position(card, primaryEl, pos, allTargets){
    if(!primaryEl || pos === 'center'){
      _showFlatBackdrop();
      card.style.top = '50%';
      card.style.left = '50%';
      card.style.transform = 'translate(-50%,-50%)';
      card.style.position = 'fixed';
      requestAnimationFrame(function(){ if(card) card.style.opacity = '1'; });
      return;
    }

    const useUnion = (allTargets && allTargets.length > 1);
    let anchorRect = useUnion ? _unionRect(allTargets) : primaryEl.getBoundingClientRect();

    const vwInit = window.innerWidth;
    const isMobile = vwInit < 760;

    // ── Mobile : on ne tente jamais le placement right/left (trop étroit).
    //    On bascule vers top/bottom selon l'espace dispo, et on garde le spotlight.
    if(isMobile && (pos === 'right' || pos === 'left')){
      const vhPre = window.innerHeight;
      pos = (anchorRect.top + anchorRect.height / 2) < vhPre / 2 ? 'bottom' : 'top';
    }

    _scrollTargetIntoView(anchorRect, pos, isMobile);

    anchorRect = useUnion ? _unionRect(allTargets) : primaryEl.getBoundingClientRect();
    _showSpotlight(anchorRect);

    const rect = anchorRect;
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = Math.min(340, vw - 24);
    const ch = card.offsetHeight || 260;
    const gap = isMobile ? 16 : 24;
    card.style.transform = '';
    card.style.position = 'fixed';

    if(pos === 'right' || pos === 'left'){
      let leftVal;
      if(pos === 'right'){
        leftVal = rect.right + gap;
        if(leftVal + cw > vw - 12) leftVal = rect.left - cw - gap;
      } else {
        leftVal = rect.left - cw - gap;
        if(leftVal < 12) leftVal = rect.right + gap;
      }
      leftVal = Math.max(12, Math.min(leftVal, vw - cw - 12));
      let topVal = rect.top + rect.height / 2 - ch / 2;
      topVal = Math.max(12, Math.min(topVal, vh - ch - 12));
      card.style.left = leftVal + 'px';
      card.style.top = topVal + 'px';
      card.style.opacity = '1';
      return;
    }

    const spaceBelow = vh - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const placeAbove = (pos === 'top') || (spaceBelow < ch + 8 && spaceAbove >= ch + 8);

    let topVal;
    if(placeAbove){
      topVal = rect.top - ch - gap;
    } else {
      topVal = rect.bottom + gap;
    }
    topVal = Math.max(12, Math.min(topVal, vh - ch - 12));
    card.style.top = topVal + 'px';

    let leftVal = rect.left + rect.width / 2 - cw / 2;
    leftVal = Math.max(12, Math.min(leftVal, vw - cw - 12));
    card.style.left = leftVal + 'px';
    card.style.opacity = '1';
  }

  function _render(){
    if(!state.active) return;
    const step = TOUR_STEPS[state.step];
    if(!step) return;

    const overlay = document.getElementById('artio-tour-overlay');
    if(!overlay) return;

    _removeHighlight();
    _detachForceClick();

    const targetEls = [];
    if(step.target){
      const selectors = Array.isArray(step.target) ? step.target : [step.target];
      selectors.forEach(function(sel){
        let el = null;
        try { el = document.querySelector(sel); } catch(e){}
        if(el){
          el.classList.add('tour-highlight');
          targetEls.push(el);
        }
      });
    }
    const primaryEl = targetEls[0] || null;

    const dots = TOUR_STEPS.map(function(_, i){
      const cls = i === state.step ? 'active' : (i < state.step ? 'done' : '');
      return '<div class="tour-dot ' + cls + '"></div>';
    }).join('');

    const proBadge = step.pro ? '<div class="tour-card-pro">✨ Fonctionnalité Pro</div>' : '';

    let actionBtn = '';
    if(step.action && step.action.fn){
      actionBtn = '<button class="tour-action-btn" onclick="window.ArtioTour._runAction(\'' + step.action.fn + '\')">' + _esc(step.action.label) + '</button>';
    }

    const prevBtn = state.step > 0
      ? '<button class="tour-btn-prev" onclick="window.ArtioTour.prev()">←</button>'
      : '';

    const isForceClick = !!step.forceClick;
    let nextBlock;
    if(isForceClick){
      const hintText = step.forceClickHint || '👉 Clique sur l\'élément encadré pour continuer';
      nextBlock =
        '<div class="tour-forceclick-hint">'
          + '<span class="tour-fc-arrow">👉</span>'
          + '<span>' + _esc(hintText.replace(/^👉\s*/, '')) + '</span>'
        + '</div>'
        + (prevBtn ? '<div class="tour-actions">' + prevBtn + '<div style="flex:1"></div></div>' : '');
    } else {
      const nextLabel = state.step === TOUR_STEPS.length - 1 ? 'Terminer 🎉' : 'Suivant →';
      const nextBtn = '<button class="tour-btn-next" onclick="window.ArtioTour.next()">' + nextLabel + '</button>';
      nextBlock = '<div class="tour-actions">' + prevBtn + nextBtn + '</div>';
    }

    const skipBtn = state.step < TOUR_STEPS.length - 1
      ? '<button class="tour-btn-skip" onclick="window.ArtioTour.end()">Quitter le tutoriel (Échap)</button>'
      : '';

    overlay.innerHTML =
      '<div class="tour-card" id="tour-card" style="top:-9999px;left:-9999px;opacity:0;">'
        + '<div class="tour-card-header">'
          + '<span class="tour-card-title">' + _esc(step.title) + '</span>'
          + '<span class="tour-card-meta">'
            + '<span class="tour-card-step">' + (state.step + 1) + ' / ' + TOUR_STEPS.length + '</span>'
            + '<button class="tour-card-close" onclick="window.ArtioTour.end()" title="Quitter le tutoriel (Échap)" aria-label="Quitter">✕</button>'
          + '</span>'
        + '</div>'
        + '<div class="tour-progress">' + dots + '</div>'
        + proBadge
        + '<div class="tour-card-desc">' + step.desc + '</div>'
        + actionBtn
        + nextBlock
        + skipBtn
      + '</div>';

    const card = document.getElementById('tour-card');
    if(!card) return;

    _activeTargets = targetEls;
    _activePos = step.pos;
    _activePrimary = primaryEl;

    const hasOnEnter = !!step.onEnter;
    const delay = hasOnEnter ? 320 : 30;
    setTimeout(function(){
      if(!state.active || TOUR_STEPS[state.step] !== step) return;
      _position(card, primaryEl, step.pos, targetEls);
      if(isForceClick) _attachForceClick(step.forceClick);
      _attachTrackingListeners();
    }, delay);
  }

  // ═══════════════════════════════════════════════════════════
  // CROSS-PAGE NAVIGATION — avec garde-fou anti-boucle
  // ═══════════════════════════════════════════════════════════
  function _redirectTo(step){
    // Garde-fou : compteur de redirections vers la même page
    let count = 0;
    let lastPage = '';
    try {
      count = parseInt(sessionStorage.getItem(SS_REDIR_COUNT) || '0', 10);
      lastPage = sessionStorage.getItem(SS_REDIR_PAGE) || '';
    } catch(e){}

    if(lastPage === step.page){
      count += 1;
    } else {
      count = 1;
    }

    if(count > MAX_REDIRECTS_SAME_PAGE){
      console.warn('[ArtioTour] Boucle de redirection détectée vers ' + step.page + ' — nettoyage et abandon.');
      _cleanupStorage();
      try { localStorage.setItem(LS_DONE, '1'); } catch(e){}
      state.active = false;
      return;
    }

    try {
      sessionStorage.setItem(SS_REDIR_COUNT, String(count));
      sessionStorage.setItem(SS_REDIR_PAGE, step.page);
      localStorage.setItem(LS_STEP, String(state.step));
      localStorage.setItem(LS_ACTIVE, '1');
    } catch(e){}
    location.href = step.page + '.html?tour=1';
  }

  // ═══════════════════════════════════════════════════════════
  // HOOKS
  // ═══════════════════════════════════════════════════════════
  function _callHook(hook){
    if(!hook) return;
    if(typeof hook === 'function'){
      try { hook(); } catch(e){ console.error('[ArtioTour] Hook function failed:', e); }
    } else if(typeof hook === 'string' && typeof window[hook] === 'function'){
      try { window[hook](); } catch(e){ console.error('[ArtioTour] Hook ' + hook + ' failed:', e); }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // API PUBLIQUE
  // ═══════════════════════════════════════════════════════════
  function start(stepIndex){
    state.active = true;
    state.step = typeof stepIndex === 'number' && stepIndex >= 0 && stepIndex < TOUR_STEPS.length
      ? stepIndex : 0;

    const step = TOUR_STEPS[state.step];
    if(!step){ end(); return; }

    // Garde-fou : si la page de l'étape n'existe pas dans nos étapes connues, on quitte
    if(!VALID_PAGES[step.page]){
      console.warn('[ArtioTour] Étape avec page inconnue : ' + step.page + ' — abandon.');
      end();
      return;
    }

    if(step.page !== _currentPage()){
      _redirectTo(step);
      return;
    }

    // On est arrivé à destination sans boucler — reset compteur
    try { sessionStorage.removeItem(SS_REDIR_COUNT); sessionStorage.removeItem(SS_REDIR_PAGE); } catch(e){}

    try {
      localStorage.setItem(LS_ACTIVE, '1');
      localStorage.setItem(LS_STEP, String(state.step));
    } catch(e){}
    _injectCSS();
    _mount();
    _attachKeydown();
    _callHook(step && step.onEnter);
    _render();
  }

  function next(){
    if(state.step >= TOUR_STEPS.length - 1){ end(); return; }
    _removeHighlight();
    _detachForceClick();
    _detachTrackingListeners();
    const curStep = TOUR_STEPS[state.step];
    _callHook(curStep && curStep.onLeave);

    const nextIdx = state.step + 1;
    const nextStep = TOUR_STEPS[nextIdx];
    state.step = nextIdx;

    if(nextStep.page !== _currentPage()){
      _redirectTo(nextStep);
      return;
    }

    try { localStorage.setItem(LS_STEP, String(state.step)); } catch(e){}
    _callHook(nextStep.onEnter);
    _render();
  }

  function prev(){
    if(state.step <= 0) return;
    _removeHighlight();
    _detachForceClick();
    _detachTrackingListeners();
    const curStep = TOUR_STEPS[state.step];
    _callHook(curStep && curStep.onLeave);

    const prevIdx = state.step - 1;
    const prevStep = TOUR_STEPS[prevIdx];
    state.step = prevIdx;

    if(prevStep.page !== _currentPage()){
      _redirectTo(prevStep);
      return;
    }

    try { localStorage.setItem(LS_STEP, String(state.step)); } catch(e){}
    _callHook(prevStep.onEnter);
    _render();
  }

  function end(){
    _removeHighlight();
    _detachForceClick();
    _detachTrackingListeners();
    _detachKeydown();
    const curStep = TOUR_STEPS[state.step];
    _callHook(curStep && curStep.onLeave);
    state.active = false;
    state.step = 0;
    try {
      localStorage.setItem(LS_DONE, '1');
      localStorage.removeItem(LS_ACTIVE);
      localStorage.removeItem(LS_STEP);
      sessionStorage.removeItem(SS_REDIR_COUNT);
      sessionStorage.removeItem(SS_REDIR_PAGE);
    } catch(e){}
    const ov = document.getElementById('artio-tour-overlay');
    if(ov) ov.remove();
    const bd = document.getElementById('artio-tour-backdrop');
    if(bd) bd.remove();
    const sp = document.getElementById('artio-tour-spotlight');
    if(sp) sp.remove();
  }

  function _runAction(fnName){
    if(typeof window[fnName] === 'function'){
      try { window[fnName](); } catch(e){ console.error('[ArtioTour] Action failed:', e); }
    } else {
      console.warn('[ArtioTour] Action introuvable sur cette page :', fnName);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // AUTO-START
  // ═══════════════════════════════════════════════════════════
  function autoStart(opts){
    opts = opts || {};
    const qs = new URLSearchParams(location.search).get('tour');
    const isResume = localStorage.getItem(LS_ACTIVE) === '1';

    if(qs === 'restart'){
      _cleanupStorage();
      try { localStorage.removeItem(LS_DONE); } catch(e){}
      try {
        const url = new URL(location.href);
        url.searchParams.delete('tour');
        const newSearch = url.searchParams.toString();
        history.replaceState(null, '', url.pathname + (newSearch ? '?' + newSearch : '') + url.hash);
      } catch(e){}
      setTimeout(function(){ start(0); }, 600);
      return true;
    }

    if(qs === '1' || isResume){
      if(qs === '1'){
        try {
          const url = new URL(location.href);
          url.searchParams.delete('tour');
          const newSearch = url.searchParams.toString();
          history.replaceState(null, '', url.pathname + (newSearch ? '?' + newSearch : '') + url.hash);
        } catch(e){}
      }
      const savedStep = parseInt(localStorage.getItem(LS_STEP) || '0', 10);

      // Garde-fou : étape hors-bornes → reset propre
      if(isNaN(savedStep) || savedStep < 0 || savedStep >= TOUR_STEPS.length){
        console.warn('[ArtioTour] Étape sauvegardée invalide (' + savedStep + ') — nettoyage.');
        _cleanupStorage();
        return false;
      }

      // Garde-fou : si l'étape sauvegardée pointe vers une page qui n'a jamais été atteinte
      // après MAX_REDIRECTS_SAME_PAGE redirections, _redirectTo() avorte tout seul.
      setTimeout(function(){ start(savedStep); }, 600);
      return true;
    }

    if(opts.firstTime && !localStorage.getItem(LS_DONE)){
      setTimeout(function(){ start(0); }, 800);
      return true;
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // EXPOSE
  // ═══════════════════════════════════════════════════════════
  window.ArtioTour = {
    start: start,
    next: next,
    prev: prev,
    end: end,
    autoStart: autoStart,
    rerender: _render,
    _runAction: _runAction,
    isActive: function(){ return state.active; },
    reset: function(){
      _cleanupStorage();
      try { localStorage.removeItem(LS_DONE); } catch(e){}
    },
    steps: TOUR_STEPS
  };
})();
