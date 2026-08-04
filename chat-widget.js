/**
 * Artio — Chat Widget IA flottant
 * À inclure sur toutes les pages après supabase-js
 * Conversation persistante via localStorage
 */

(function () {
  // ── CONFIG ────────────────────────────────────────────
  const SUPABASE_URL  = "https://mwmexkoeqeyueqgdkkni.supabase.co";
  const SUPABASE_KEY  = "sb_publishable_dbf0DrGQr377jyftcE-rYw_SK5nzZJw";
  const FUNCTIONS_URL = "https://mwmexkoeqeyueqgdkkni.supabase.co/functions/v1";
  const STORAGE_KEY   = "artio_chat_history";
  const MODEL         = "claude-sonnet-4-20250514";
  const MAX_TOKENS    = 512;
  const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

  // Fin de l'offre de lancement (tarif Fondateurs) : 31 août 2026 23:59 Europe/Paris.
  // Passé cette date, le bot doit parler au passé de l'offre et donner les tarifs normaux.
  const FOUNDER_OFFER_END = new Date("2026-09-01T00:00:00+02:00");

  // Obligation de RÉCEPTION facturation électronique (toutes entreprises) : 1er sept. 2026.
  const EINVOICE_RECEPTION_START = new Date("2026-09-01T00:00:00+02:00");

  function getTemporalContext() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const founderOfferActive = now < FOUNDER_OFFER_END;
    const einvoiceReceptionLive = now >= EINVOICE_RECEPTION_START;

    let block = `== CONTEXTE TEMPOREL (à toujours respecter, ne jamais contredire) ==\nNous sommes le ${dateStr}.\n`;

    block += founderOfferActive
      ? `L'offre de lancement (tarif Fondateurs) est ACTIVE : Solo 14 €/mois ou 140 €/an, Pro 29 €/mois ou 290 €/an, tarif figé à vie. Elle se termine le 31 août 2026 — tu peux créer un sentiment d'urgence légitime si l'utilisateur hésite.\n`
      : `L'offre de lancement (tarif Fondateurs) est TERMINÉE depuis le 1er septembre 2026. Les tarifs normaux s'appliquent : Solo 19 €/mois ou 190 €/an, Pro 39 €/mois ou 390 €/an. N'évoque plus l'offre Fondateurs comme disponible — si l'utilisateur la mentionne, précise qu'elle a pris fin mais que les abonnés qui l'ont souscrite avant la fin du lancement gardent leur tarif figé à vie.\n`;

    block += einvoiceReceptionLive
      ? `L'obligation de RÉCEPTION des factures électroniques est déjà EN VIGUEUR pour toutes les entreprises françaises (depuis le 1er septembre 2026). Ne parle plus de cette échéance au futur.\n`
      : `L'obligation de RÉCEPTION des factures électroniques entre en vigueur le 1er septembre 2026 pour toutes les entreprises (compte à rebours en cours). L'obligation d'ÉMISSION suit un calendrier différent selon la taille de l'entreprise (1er septembre 2026 pour grandes entreprises/ETI, 1er septembre 2027 pour PME et micro-entrepreneurs).\n`;

    return block;
  }

  const SYSTEM_PROMPT_BASE = `Tu es l'assistant IA officiel d'Artio, une application SaaS française pour les professionnels indépendants (freelancers, artisans, coaches, photographes, plombiers, électriciens, etc.).

== PRÉSENTATION D'ARTIO ==
Artio permet de :
- Créer des devis et factures par dictée vocale (IA) ou manuellement
- Gérer les dossiers clients (création, historique, suivi)
- Tableau de bord avec KPIs financiers (CA mensuel, factures en attente, évolution)
- Calendrier et rendez-vous (synchronisé avec Google Calendar)
- Signature électronique des devis (lien envoyé au client, valide 72h, audit trail complet)
- Intégration Gmail : connexion OAuth unique pour Gmail + Calendar
- Envoi d'emails générés par IA depuis son compte Gmail
- Numérotation automatique des factures conforme (FAC-YYYY-NNN)
- Facturation électronique B2B via FactPulse (conformité DGFiP 2026)
- Interface light/dark mode
- Application mobile en cours (React Native, parité feature web)

== PLANS ET TARIFS ==
- Gratuit : accès limité, consultation de l'historique uniquement
- Solo : 19 €/mois ou 190 €/an — création de devis, factures, clients, calendrier
- Pro : 39 €/mois ou 390 €/an — tout Solo + signature électronique, envoi d'emails Gmail via Rédiger, relances IA, rappels de paiement IA, branding PDF, templates sauvegardés, facturation électronique via FactPulse
- (Le statut de l'offre de lancement Fondateurs — active ou terminée — est précisé dans le contexte temporel ci-dessus, toujours s'y référer plutôt qu'à une date fixe.)
- Paiement par carte bancaire via Stripe. Résiliation à tout moment sans frais, effet en fin de période.
- Satisfaction 7 jours : remboursement intégral du 1er mois si usage non significatif.

== PAGES DE L'APPLICATION ==
- home.html → page d'accueil après connexion
- app.html → création de devis et factures par dictée vocale ou formulaire (onglets : Devis, Facture uniquement)
- dossiers.html → consultation de tous les dossiers clients, statuts des devis et factures, envoi en signature, conversion devis→facture
- rediger.html → rédaction d'emails assistée par IA
- clients.html → gestion des fiches clients
- dashboard.html → tableau de bord financier (CA, stats, évolution)
- calendar.html → agenda et rendez-vous (sync Google Calendar)
- settings.html → paramètres entreprise, abonnement, connexion Google, facturation électronique (FactPulse)
- aide.html → documentation et FAQ complète

== SUPPORT — PROBLÈMES FRÉQUENTS ET SOLUTIONS ==

COMPTE ET CONNEXION :
- "Je n'arrive pas à me connecter" → Vérifier email/mot de passe. Si oublié, utiliser "Mot de passe oublié" sur login.html. Si compte tout nouveau, vérifier l'email de confirmation reçu à l'inscription.
- "Je n'ai pas reçu l'email de confirmation" → Vérifier les spams. Si toujours absent, contacter contact@monartio.fr.
- "Mon compte est bloqué en mode lecture" → Le plan gratuit est en lecture seule. Pour créer des documents, souscrire au plan Solo ou Pro depuis Paramètres → Abonnement.

DEVIS ET FACTURES :
- "Comment créer un devis ?" → Aller dans Application → onglet Devis → utiliser la dictée vocale (bouton micro) ou remplir manuellement. Cliquer sur Générer puis télécharger le PDF.
- "Comment convertir un devis en facture ?" → Dans Dossiers, ouvrir le dossier du devis signé → cliquer sur "Créer la facture". La conversion est manuelle et volontaire.
- "Mon devis n'apparaît pas dans les dossiers" → Vérifier que le devis a bien été généré et sauvegardé. Les dossiers sont accessibles dans l'onglet Dossiers de l'application.
- "Comment envoyer un devis pour signature ?" → Fonctionnalité Pro. Dans Dossiers → ouvrir le devis → bouton "Signature". Un lien est envoyé au client, valide 72h.
- "Le lien de signature a expiré" → Régénérer un nouveau lien depuis le dossier. La validité est de 72h après ouverture du lien par le client.

ABONNEMENT ET FACTURATION :
- "Comment m'abonner ?" → Paramètres → Abonnement → choisir Solo ou Pro → paiement via Stripe.
- "Comment résilier ?" → Paramètres → Abonnement → bouton Résilier. Effet à la fin de la période en cours, aucun remboursement au prorata.
- "Je veux changer de plan" → Paramètres → Abonnement. En cas de passage Pro → Solo, certaines fonctionnalités Pro deviennent inaccessibles.
- "Offre Fondateurs : comment en bénéficier ?" → Se référer au statut de l'offre indiqué dans le contexte temporel (active ou terminée) pour répondre précisément. Si active : disponible sur monartio.fr jusqu'à la fin du lancement, tarif figé à vie. Si terminée : l'offre n'est plus accessible aux nouveaux abonnés, mais ceux qui l'ont souscrite pendant le lancement gardent leur tarif à vie.

GMAIL ET GOOGLE :
- "Comment connecter Gmail ?" → Paramètres → Gmail → cliquer sur Connecter Gmail → suivre le flux OAuth Google. Un seul OAuth pour Gmail + Google Calendar.
- "Gmail est déconnecté" → Paramètres → Gmail → Reconnecter. Cela peut arriver après une expiration de token.
- "Est-ce qu'Artio lit mes emails ?" → Non, Artio n'accède qu'à l'envoi d'emails via l'onglet Rédiger. Il ne lit jamais le contenu de votre boîte de réception.

SIGNATURE ÉLECTRONIQUE :
- "La signature est-elle légale ?" → Oui, c'est une signature électronique simple au sens du règlement eIDAS. Elle est juridiquement valable pour les devis commerciaux.
- "Mon client n'a pas reçu le lien" → Vérifier l'adresse email du client dans le dossier. Le lien peut aussi être copié manuellement et envoyé par SMS ou autre moyen.
- "Que se passe-t-il quand mon client signe ?" → Vous recevez un email + une notification push instantanément. Le dossier passe automatiquement en statut "Devis accepté" et le bouton "Créer la facture" devient disponible. Pas besoin de rafraîchir la page.
- "Mon devis vient d'être signé mais je vois encore 'Devis envoyé'" → La page Dossiers se rafraîchit automatiquement toutes les 30 secondes. Le statut apparaîtra sous peu sans action de votre part. Vous pouvez aussi changer d'onglet et revenir : le rafraîchissement est immédiat au retour de focus.

DEVIS ET FACTURES (suite) :
- "Mon devis n'apparaît pas tout de suite après création" → Après la génération, vous êtes redirigé automatiquement vers la page Dossiers avec le dossier ouvert. Si ce n'est pas le cas, rendez-vous sur Dossiers — il y sera.
- "Le statut de mon devis ne change pas" → La page Dossiers se met à jour automatiquement en arrière-plan. Le statut bascule dès qu'un événement intervient (signature client, paiement, etc.) sans nécessiter de rafraîchissement manuel.
- "Comment marquer une facture comme payée ?" → Dossiers → ouvrir le dossier → bouton vert "💶 Marquer payée" sur chaque facture non réglée. La date de paiement est enregistrée, le dossier passe en "Terminé".
- "Comment envoyer un rappel de paiement ?" → Bouton "📨 Rappel" sur une facture impayée. L'IA génère un email de rappel professionnel avec le montant, numéro de facture et IBAN si renseigné (Paramètres → Mon entreprise).
- "Comment sont numérotées mes factures ?" → Format automatique FAC-YYYY-NNN (ex : FAC-2026-001), séquentiel et continu. Cette numérotation ne peut pas être modifiée manuellement — c'est une exigence fiscale.

FACTURATION ÉLECTRONIQUE :
- "Qu'est-ce que la facturation électronique ?" → Réforme obligatoire pour les entreprises françaises. Se référer au contexte temporel pour savoir si l'obligation de réception (1er septembre 2026, toutes entreprises y compris micro-entrepreneurs en franchise TVA) est déjà en vigueur ou à venir, et formuler la réponse au bon temps grammatical en conséquence. L'obligation d'émission arrive le 1er septembre 2026 pour les grandes entreprises et ETI, et le 1er septembre 2027 pour les PME et micro-entrepreneurs. Artio est Solution Compatible DGFiP via FactPulse, une plateforme agréée.
- "Comment activer FactPulse ?" → Paramètres → Facturation électronique → Activer FactPulse. Fonctionnalité incluse dans l'offre Pro, aucun compte ou token FactPulse à créer, tout est intégré à Artio.
- "Dois-je faire une démarche sur impots.gouv.fr ?" → Oui, c'est obligatoire. Chaque entreprise doit déclarer elle-même sa plateforme dans l'annuaire du Portail Public de Facturation (PPF) sur impots.gouv.fr, avec son propre SIRET. Artio ne peut pas faire cette démarche à votre place. Étapes : se connecter à son espace professionnel → rubrique Facturation électronique → Annuaire → sélectionner FactPulse comme plateforme. À faire avant le 1er septembre 2026. Article complet dans Aide → Réforme facturation électronique 2026.
- "Je suis micro-entrepreneur en franchise TVA, suis-je concerné ?" → Oui. Depuis la mise à jour de la réforme, tous les micro-entrepreneurs — y compris ceux en franchise en base de TVA (art. 293 B CGI) — sont concernés par l'obligation de réception dès le 1er septembre 2026. L'obligation d'émission arrive le 1er septembre 2027.

TABLEAU DE BORD ET INDICATEURS :
- "À quoi sert le tableau de bord ?" → Il affiche vos indicateurs clés : CA Facturé total, CA du mois en cours, Devis en attente (envoyés non acceptés), Devis acceptés (signés non convertis en facture), Taux de conversion devis→facture.
- "Comment filtrer par période ?" → Menu en haut à droite du tableau de bord : Mois en cours, Année en cours, ou période personnalisée. Le graphique CA mensuel a son propre filtre indépendant (6 derniers mois / année / personnalisé).
- "Comment calculer ma TVA ?" → Si vous êtes assujetti à la TVA (à activer dans Paramètres), une section du tableau de bord affiche la TVA nette à reverser, la ventilation par taux (10%/20%) et la période selon votre régime. Attention : le calcul ne tient pas compte de la TVA déductible sur les achats, consultez votre comptable pour le montant net réel.

REGISTRE DES ACHATS (Comptabilité) :
- "Qu'est-ce que le registre des achats ?" → Réservé au plan Pro. Permet de conserver dans Artio les factures fournisseurs reçues par email ou papier (PDF), au même endroit que celles reçues via la plateforme de dématérialisation.
- "Comment déposer une facture d'achat ?" → Comptabilité → onglet "Ajoutées" → glisser-déposer les PDF (15 Mo max/fichier) → renseigner fournisseur, numéro, date, montants HT/TTC (facultatif mais utile pour la recherche et le comptable).
- "Comment envoyer mes factures au comptable ?" → Comptabilité → sélectionner plusieurs factures → "Télécharger (ZIP)" ou "Envoyer au comptable" (email direct depuis Artio). Chaque facture peut être marquée comme transmise, avec filtres "À transmettre" / "Transmises". Notification mensuelle si au moins 3 pièces restent non transmises.

RÉSILIATION ET RÉCEPTION FACTURES ÉLECTRONIQUES :
- "Que se passe-t-il pour mes factures fournisseurs si je résilie ?" → Sujet critique à ne pas manquer. Au moment de la résiliation, votre SIRET reste déclaré à l'annuaire de facturation via Artio pendant une période de grâce d'un mois. Pendant ce mois, la réception continue de fonctionner. À la fin de la période de grâce, la réception s'arrête définitivement et votre SIRET est retiré de l'annuaire. Des rappels par email sont envoyés avant échéance.
- "Que dois-je faire avant de résilier si je reçois des factures via Artio ?" → Trois démarches obligatoires : (1) souscrire à une autre plateforme conforme (ce n'est pas optionnel — toute entreprise assujettie doit pouvoir recevoir des factures électroniques), (2) vous référencer auprès de cette nouvelle plateforme qui déclarera votre SIRET à l'annuaire à votre place, (3) informer vos fournisseurs de vos nouvelles coordonnées de facturation.
- "Comment exporter mes factures avant de partir ?" → Comptabilité → cocher les factures à conserver (ou toutes) → "Télécharger (ZIP)". La résiliation ne décharge pas des obligations légales de conservation.
- "J'ai résilié mais je change d'avis" → Tant que la période de grâce n'est pas écoulée, réactiver l'abonnement depuis Paramètres → Abonnement rétablit la réception sans démarche supplémentaire.

SÉCURITÉ ET DONNÉES PERSONNELLES :
- "Où sont hébergées mes données ?" → Sur Supabase (hébergement AWS Europe). Toutes les communications sont chiffrées HTTPS/TLS.
- "Un autre utilisateur peut-il voir mes données ?" → Non, techniquement impossible grâce au système Row Level Security (RLS) de Supabase, qui isole chaque espace utilisateur.
- "Mes dictées vocales sont-elles stockées par l'IA ?" → Non. L'IA (Claude par Anthropic) est appelée via une clé centralisée Artio. Vos dictées et prompts ne sont pas stockés et ne servent pas à entraîner les modèles.
- "Artio est-il conforme RGPD ?" → Oui. Les données ne sont jamais revendues à des tiers. Les données bancaires ne sont pas stockées par Artio (paiements gérés par Stripe). Les signatures clients sont supprimées automatiquement après expiration.

SUPPRESSION DE COMPTE :
- "Comment supprimer mon compte ?" → Paramètres → Compte → Supprimer mon compte. La procédure est directement in-app, pas besoin d'écrire un email.
- "Qu'est-ce qui est supprimé ?" → Profil et informations entreprise, dossiers/devis/documents, carnet clients, agenda et rendez-vous, connexion Gmail.
- "Qu'est-ce qui est conservé après suppression ?" → Vos factures (obligation légale de conservation 10 ans — Code général des impôts) et un enregistrement minimal (email + identifiant Stripe) pour prévenir les abus d'essai gratuit.
- "Que devient mon abonnement si je supprime mon compte ?" → Il est annulé automatiquement. Aucun remboursement au prorata. La suppression est définitive et irréversible — pensez à télécharger vos documents importants avant.

DIVERS :
- "Comment contacter le support ?" → Par email à contact@monartio.fr ou via ce chat. Réponse sous 24-48h.
- "L'application est lente ou bugguée" → Essayer de rafraîchir la page. Si le problème persiste, contacter contact@monartio.fr avec une description du problème.

== RÈGLES DE COMPORTEMENT ==
- Réponds TOUJOURS en français, de façon chaleureuse et claire. Reste concis par défaut (4-5 phrases max) pour les questions simples ; pour les sujets à plusieurs volets (ex : calendrier de la réforme facturation électronique, différence entre plans, démarche PPF), tu peux structurer la réponse en quelques points courts plutôt que de tout compresser en une seule phrase dense — la clarté prime sur la brièveté quand le sujet a plusieurs facettes.
- Si tu ne sais pas, dis-le honnêtement et oriente vers contact@monartio.fr.
- Ne jamais inventer de fonctionnalités qui n'existent pas dans Artio.
- Pour les questions de comptabilité, fiscalité ou droit : donner l'information générale disponible dans l'app mais recommander de consulter un expert-comptable.
- Quand la question est résolue, terminer naturellement par "Y a-t-il autre chose que je puisse faire pour vous ?" ou "Est-ce que cela répond à votre question ?"
- Si l'utilisateur dit "non merci", "c'est bon", "merci", "parfait" ou similaire : remercier chaleureusement puis terminer par [CONVERSATION_CLOSE].`;

  function getSystemPrompt() {
    let prompt = getTemporalContext() + "\n" + SYSTEM_PROMPT_BASE;

    if (subscriptionStatus) {
      const planLabel = { free: "Gratuit (lecture seule)", solo: "Solo", pro: "Pro" }[subscriptionStatus] || subscriptionStatus;
      prompt += `\n\n== PLAN DE L'UTILISATEUR ACTUEL ==\nCet utilisateur est actuellement sur le plan ${planLabel}. Personnalise tes réponses en conséquence : s'il demande une fonctionnalité réservée à un plan supérieur, précise-le clairement et propose la mise à niveau (Paramètres → Abonnement) sans être insistant. Ne lui présente jamais une fonctionnalité qu'il a déjà comme un avantage à débloquer.`;
    }

    if (contexteIA) {
      prompt += `\n\nINFORMATIONS SUR L'ENTREPRISE DE L'UTILISATEUR :\n${contexteIA}\n\nUtilise ces informations pour répondre de façon personnalisée aux questions sur l'activité, les offres, les tarifs ou les services de cet utilisateur.`;
    }

    return prompt;
  }

  // ── STATE ─────────────────────────────────────────────
  let apiKey          = null;
  let contexteIA      = null; // contexte métier de l'utilisateur
  let userId          = null; // pour le logging des tokens
  let userEmail       = null;
  let accessToken     = null;
  let subscriptionStatus = null; // 'free' | 'solo' | 'pro' — pour personnaliser les réponses
  let isOpen          = false;
  let isLoading       = false;
  let history         = loadHistory();
  let hasUnread       = localStorage.getItem("artio_chat_unread") === "1";

  function markUnread() {
    if (!isOpen) {
      hasUnread = true;
      try { localStorage.setItem("artio_chat_unread", "1"); } catch(e) {}
    }
  }
  function clearUnread() {
    hasUnread = false;
    try { localStorage.removeItem("artio_chat_unread"); } catch(e) {}
  }
  let inactivityTimer = null;

  // ── SUPABASE ──────────────────────────────────────────
  async function initUser() {
    try {
      const sbClient = window.sb || supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) return;
      userEmail = session.user.email;
      userId    = session.user.id;
      accessToken = session.access_token;
      const { data: profil } = await sbClient
        .from("profils").select("contexte_ia, subscription_status")
        .eq("user_id", session.user.id).single();
      if (profil?.contexte_ia) contexteIA = profil.contexte_ia;
      if (profil?.subscription_status) subscriptionStatus = profil.subscription_status;
    } catch (e) { console.warn("Chat widget:", e.message); }
  }

  // ── PERSISTENCE ───────────────────────────────────────
  // Durée de rétention de l'historique en localStorage : 7 jours.
  // Au-delà, on repart d'une conversation neuve plutôt que de rouvrir
  // un fil probablement oublié par l'utilisateur.
  const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  function loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!raw || !raw.savedAt || !Array.isArray(raw.messages)) return [];
      if (Date.now() - raw.savedAt > HISTORY_TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return [];
      }
      return raw.messages;
    } catch { return []; }
  }
  function saveHistory() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), messages: history })); }
    catch {}
  }
  function clearHistory() {
    history = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── LOG TOKENS (silencieux) ───────────────────────────
  async function logTokens(usage) {
    try {
      if (!usage || !userId) return;
      const sbClient = window.sb || supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const input  = usage.input_tokens  || 0;
      const output = usage.output_tokens || 0;
      const cout   = (input * 0.000003) + (output * 0.000015);
      await sbClient.from("token_logs").insert({
        user_id:       userId,
        feature:       "chatbot",
        input_tokens:  input,
        output_tokens: output,
        total_tokens:  input + output,
        cout_estime:   cout
      });
    } catch(e) { console.debug("widget logTokens:", e.message); }
  }

  // ── EMAIL RÉCAP ───────────────────────────────────────
  async function sendRecapEmail(conv) {
    if (!userEmail || conv.length === 0) return;
    try {
      // Le HTML du récap est désormais rendu CÔTÉ SERVEUR (échappé).
      // On n'envoie plus que des données structurées : le serveur
      // n'accepte plus de HTML brut ni de destinataire arbitraire.
      await fetch(`${SUPABASE_URL}/functions/v1/send-contact-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          mode: "recap",
          email: userEmail,
          sujet: "Récap de votre conversation Artio",
          conversation: conv.map(m => ({ role: m.role, content: m.content }))
        })
      });
    } catch (e) { console.warn("Récap email:", e.message); }
  }

  // ── INACTIVITÉ ────────────────────────────────────────
  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (history.length === 0) return;
    inactivityTimer = setTimeout(async () => {
      const conv = [...history];
      history.push({ role: "assistant", content: "Cette conversation a été fermée après 10 minutes d'inactivité. Un récap vous a été envoyé par email. N'hésitez pas à revenir ! 👋" });
      markUnread();
      saveHistory();
      renderMessages();
      await sendRecapEmail(conv);
      setTimeout(() => { clearHistory(); renderMessages(); }, 6000);
    }, INACTIVITY_MS);
  }

  // ── CLÔTURE NATURELLE ─────────────────────────────────
  async function handleClose(cleanReply) {
    history.push({ role: "assistant", content: cleanReply });
    markUnread();
    saveHistory();
    renderMessages();
    const conv = [...history];
    await sendRecapEmail(conv);
    // 8 secondes pour lire, puis réduire
    setTimeout(() => {
      clearHistory();
      if (inactivityTimer) clearTimeout(inactivityTimer);
      renderMessages();
      isOpen = false;
      document.getElementById("artio-chat-panel")?.classList.remove("open");
    }, 8000);
  }

  // ── RENDER ────────────────────────────────────────────
  function renderMessages() {
    const container = document.getElementById("artio-chat-messages");
    if (!container) return;
    container.innerHTML = "";

    if (history.length === 0) {
      container.innerHTML = `
        <div class="artio-chat-empty">
          <strong>Bonjour ! 👋</strong>
          Je suis votre assistant Artio. Comment puis-je vous aider ?
          <div class="artio-suggestions">
            <button class="artio-chip" onclick="artioAsk(this)">Comment créer un devis ?</button>
            <button class="artio-chip" onclick="artioAsk(this)">Comment fonctionne la signature ?</button>
            <button class="artio-chip" onclick="artioAsk(this)">Différence Solo / Pro ?</button>
          </div>
        </div>`;
      return;
    }

    history.forEach(msg => {
      const div = document.createElement("div");
      div.className = `artio-msg ${msg.role === "user" ? "user" : "bot"}`;
      div.textContent = msg.content;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;

    const badge = document.getElementById("artio-chat-badge");
    if (badge) badge.style.display = (!isOpen && hasUnread) ? "block" : "none";
  }

  // Suggestion chip handler (global)
  window.artioAsk = function(btn) {
    const input = document.getElementById("artio-chat-input");
    if (input) { input.value = btn.textContent; sendMessage(); }
  };

  // ── ATTENTE CONTEXTUELLE ─────────────────────────────
  // Pour les sujets à plusieurs facettes, on affiche une petite phrase
  // au-dessus des points "typing" pour meubler l'attente au lieu du silence.
  // Retourne null pour les questions simples (dans ce cas, points seuls).
  function getWaitingMessage(text) {
    const q = text.toLowerCase();
    if (q.includes("facturation électronique") || q.includes("factpulse") || q.includes("pdp") || q.includes("réforme") || q.includes("dgfip") || q.includes("impots.gouv")) {
      return "Je regarde ce qui s'applique à votre situation…";
    }
    if (q.includes("signature") || q.includes("signer") || q.includes("eidas")) {
      return "Je vérifie comment ça marche pour la signature…";
    }
    if (q.includes("plan") || q.includes("tarif") || q.includes("prix") || q.includes("solo") || q.includes("pro") || q.includes("abonnement")) {
      return "Je regarde les options qui vous correspondent…";
    }
    if (q.includes("résilier") || q.includes("supprimer") || q.includes("annuler")) {
      return "Je regarde la procédure…";
    }
    if (q.includes("gmail") || q.includes("google") || q.includes("calendar") || q.includes("oauth")) {
      return "Je vérifie la connexion Google…";
    }
    return null;
  }

  function showTyping(waitingMsg) {
    const c = document.getElementById("artio-chat-messages");
    if (!c) return;
    const d = document.createElement("div");
    d.className = "artio-msg typing"; d.id = "artio-typing";
    const dotsHtml = `<div class="artio-dots"><span></span><span></span><span></span></div>`;
    if (waitingMsg) {
      d.innerHTML = `<div class="artio-waiting">${waitingMsg}</div>${dotsHtml}`;
    } else {
      d.innerHTML = dotsHtml;
    }
    c.appendChild(d); c.scrollTop = c.scrollHeight;
  }
  function removeTyping() {
    document.getElementById("artio-typing")?.remove();
  }

  // ── SEND ──────────────────────────────────────────────
  async function sendMessage() {
    const input = document.getElementById("artio-chat-input");
    const sendBtn = document.getElementById("artio-chat-send");
    if (!input || isLoading) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";
    isLoading = true;
    if (sendBtn) sendBtn.disabled = true;
    resetInactivityTimer();

    history.push({ role: "user", content: text });
    saveHistory();
    renderMessages();
    showTyping(getWaitingMessage(text));

    let reply;

    if (accessToken) {
      try {
        const messages = history.slice(-20).map(m => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }));
        const res = await fetch(FUNCTIONS_URL + "/claude-proxy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + accessToken
          },
          body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: getSystemPrompt(), messages, feature: "chat-widget" })
        });
        if (res.ok) {
          const d = await res.json();
          reply = d.content?.[0]?.text || fallback(text);
        } else {
          reply = fallback(text);
        }
      } catch { reply = fallback(text); }
    } else {
      reply = fallback(text);
    }

    removeTyping();

    if (reply.includes("[CONVERSATION_CLOSE]")) {
      await handleClose(reply.replace("[CONVERSATION_CLOSE]", "").trim());
    } else {
      history.push({ role: "assistant", content: reply });
      markUnread();
      saveHistory();
      renderMessages();
      resetInactivityTimer();
    }

    isLoading = false;
    if (sendBtn) sendBtn.disabled = false;
    if (!reply.includes("[CONVERSATION_CLOSE]")) input?.focus();
  }

  // ── FALLBACK ───────────────────────────────────────────
  // Utilisé quand l'appel à claude-proxy échoue (déconnexion, erreur API, etc.)
  // ou pour un visiteur sans session. Le ton est honnête sur la limitation :
  // ne pas prétendre pouvoir tenir une vraie conversation, mais donner l'info
  // utile la plus proche du sujet et orienter vers de vraies ressources.
  function fallback(text) {
    const q = text.toLowerCase();
    const suffix = " Je fonctionne en mode limité pour l'instant — pour une réponse plus complète, réessayez dans un instant ou écrivez à contact@monartio.fr.";

    // Devis / factures
    if (q.includes("devis") && (q.includes("créer") || q.includes("créé") || q.includes("faire") || q.includes("comment"))) {
      return "Pour créer un devis, allez dans l'onglet Application, choisissez l'onglet Devis, puis utilisez la dictée vocale (bouton micro) ou remplissez manuellement. Cliquez sur Générer pour obtenir le PDF." + suffix;
    }
    if (q.includes("facture") && (q.includes("créer") || q.includes("faire") || q.includes("convertir") || q.includes("devis"))) {
      return "Une facture se crée depuis un dossier existant : ouvrez le dossier du devis signé et cliquez sur \"Créer la facture\". La conversion est manuelle et volontaire." + suffix;
    }
    if (q.includes("devis")) return "Vos devis se gèrent dans l'onglet Application, et se retrouvent ensuite dans Dossiers." + suffix;
    if (q.includes("facture")) return "Vos factures se gèrent dans l'onglet Application et Dossiers, avec conversion possible depuis un devis signé." + suffix;

    // Signature
    if (q.includes("signature") || q.includes("signer")) {
      return "La signature électronique (offre Pro) se déclenche depuis un dossier de devis : bouton \"Signature\" → un lien est envoyé au client, valide 72h. La signature est conforme au règlement eIDAS." + suffix;
    }

    // Facturation électronique / PDP / FactPulse
    if (q.includes("facturation électronique") || q.includes("factpulse") || q.includes("pdp") || q.includes("réforme") || q.includes("dgfip") || q.includes("impots.gouv")) {
      return "Artio est Solution Compatible DGFiP via FactPulse (plateforme agréée par l'État). Vous devez déclarer FactPulse dans votre espace impots.gouv.fr → rubrique Facturation électronique → Annuaire. L'article complet est dans Aide → Réforme facturation électronique 2026." + suffix;
    }

    // Abonnement / plans / tarifs
    if (q.includes("abonnement") || q.includes("résilier") || q.includes("plan") || q.includes("tarif") || q.includes("prix") || q.includes("solo") || q.includes("pro") || q.includes("payer")) {
      return "Vos options d'abonnement sont dans Paramètres → Abonnement. Vous pouvez souscrire, changer de plan ou résilier à tout moment (effet en fin de période, sans remboursement au prorata)." + suffix;
    }

    // Gmail / Google
    if (q.includes("gmail") || q.includes("google") || q.includes("calendar") || q.includes("agenda") || q.includes("oauth")) {
      return "La connexion Gmail + Google Calendar se fait dans Paramètres → Gmail, en un seul flux OAuth. Si vous êtes déconnecté, reconnectez-vous depuis le même écran." + suffix;
    }

    // Clients
    if (q.includes("client")) {
      return "Vos clients se gèrent dans l'onglet Clients : ajout manuel, ou récupération automatique via le SIRET (lookup Pappers)." + suffix;
    }

    // Support / contact
    if (q.includes("support") || q.includes("contact") || q.includes("aide") || q.includes("problème") || q.includes("bug")) {
      return "Vous pouvez me poser vos questions ici quand la connexion est rétablie, ou écrire directement à contact@monartio.fr (réponse sous 24-48h).";
    }

    // Salutations
    if (q.includes("bonjour") || q.includes("salut") || q.includes("hello") || q === "hey" || q === "coucou") {
      return "Bonjour ! Je fonctionne en mode limité pour l'instant. Vous pouvez tout de même me poser une question, je vais essayer d'aider — sinon écrivez à contact@monartio.fr.";
    }

    // Remerciements / fin de conversation
    if (q.includes("merci") || q.includes("bonne journée") || q === "ok" || q === "d'accord") {
      return "Avec plaisir ! N'hésitez pas à revenir quand vous voulez.";
    }

    return "Je fonctionne en mode limité pour l'instant, donc je ne peux pas répondre précisément à cette question. Pour une réponse fiable, réessayez dans un instant ou écrivez à contact@monartio.fr — nous répondons sous 24 à 48h.";
  }

  // ── TOGGLE ────────────────────────────────────────────
  function togglePanel() {
    const panel = document.getElementById("artio-chat-panel");
    const badge = document.getElementById("artio-chat-badge");
    if (!isOpen) {
      isOpen = true;
      panel.classList.add("open");
      clearUnread();
      if (badge) badge.style.display = "none";
      renderMessages();
      setTimeout(() => document.getElementById("artio-chat-input")?.focus(), 200);
    } else {
      isOpen = false;
      panel.classList.remove("open");
      if (badge) badge.style.display = hasUnread ? "block" : "none";
    }
  }

  // ── BUILD ─────────────────────────────────────────────
  function buildWidget() {
    const style = document.createElement("style");
    style.textContent = `
      #artio-chat-bubble{position:fixed;bottom:24px;right:24px;z-index:9999;font-family:'Plus Jakarta Sans','Space Grotesk',sans-serif}
      #artio-chat-btn{width:56px;height:56px;border-radius:50%;background:#f5a742;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(245,167,66,.4);transition:transform .2s,box-shadow .2s;position:relative}
      #artio-chat-btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(245,167,66,.5)}
      #artio-chat-btn svg{color:#080b14}
      #artio-chat-badge{position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:#3ecfcf;border:2px solid #080b14;display:none}
      #artio-chat-panel{position:absolute;bottom:68px;right:0;width:360px;height:600px;background:#0e1220;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(12px) scale(.97);pointer-events:none;transition:opacity .25s,transform .25s}
      #artio-chat-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:all}
      #artio-chat-header{padding:14px 16px;background:#141829;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
      #artio-chat-header-left{display:flex;align-items:center;gap:10px}
      .artio-avatar{width:38px;height:38px;border-radius:50%;background:#fff5e6;object-fit:contain;object-position:center bottom;flex-shrink:0;border:1.5px solid rgba(245,167,66,0.25);padding:2px}
      [data-theme="light"] .artio-avatar{background:#fff5e6;border-color:rgba(217,119,6,0.25)}
      #artio-chat-header-title{font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;color:#e2e5f1}
      #artio-chat-header-sub{font-size:11px;color:#6b7494;margin-top:1px}
      .artio-hbtn{background:none;border:none;color:#6b7494;cursor:pointer;padding:5px;border-radius:6px;display:flex;align-items:center;transition:color .2s,background .2s}
      .artio-hbtn:hover{color:#e2e5f1;background:rgba(255,255,255,.06)}
      #artio-chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
      #artio-chat-messages::-webkit-scrollbar{width:4px}
      #artio-chat-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
      .artio-msg{max-width:85%;padding:9px 12px;border-radius:12px;font-size:13px;line-height:1.5;word-break:break-word}
      .artio-msg.user{background:rgba(245,167,66,.15);color:#e2e5f1;border:1px solid rgba(245,167,66,.25);align-self:flex-end;border-bottom-right-radius:4px}
      .artio-msg.bot{background:#1a2035;color:#e2e5f1;border:1px solid rgba(255,255,255,.07);align-self:flex-start;border-bottom-left-radius:4px}
      .artio-msg.typing{background:#1a2035;border:1px solid rgba(255,255,255,.07);align-self:flex-start;padding:12px 16px}
      .artio-waiting{font-size:12px;color:#8b93b0;margin-bottom:6px;font-style:italic}
      .artio-dots{display:flex;gap:4px;align-items:center}
      .artio-dots span{width:6px;height:6px;background:#6b7494;border-radius:50%;animation:artio-bounce 1.2s infinite}
      .artio-dots span:nth-child(2){animation-delay:.2s}
      .artio-dots span:nth-child(3){animation-delay:.4s}
      @keyframes artio-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
      #artio-chat-footer{padding:10px 12px;border-top:1px solid rgba(255,255,255,.07);display:flex;gap:8px;align-items:flex-end;background:#0e1220;flex-shrink:0}
      #artio-chat-input{flex:1;background:#1a2035;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 12px;font-size:13px;color:#e2e5f1;font-family:inherit;outline:none;resize:none;max-height:100px;min-height:36px;transition:border-color .2s;line-height:1.5}
      #artio-chat-input:focus{border-color:rgba(245,167,66,.4)}
      #artio-chat-input::placeholder{color:#6b7494}
      #artio-chat-send{width:36px;height:36px;border-radius:10px;background:#f5a742;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .2s,transform .1s}
      #artio-chat-send:hover{opacity:.85;transform:scale(1.05)}
      #artio-chat-send:disabled{opacity:.4;cursor:not-allowed;transform:none}
      .artio-chat-empty{text-align:center;color:#6b7494;font-size:13px;margin:auto;padding:24px 20px;line-height:1.7}
      .artio-chat-empty strong{display:block;color:#e2e5f1;font-size:15px;margin-bottom:8px}
      .artio-suggestions{margin-top:16px;display:flex;flex-direction:column;gap:6px}
      .artio-chip{background:#1a2035;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 12px;font-size:12px;color:#a0a8c0;cursor:pointer;text-align:left;transition:background .2s,color .2s;font-family:inherit}
      .artio-chip:hover{background:rgba(245,167,66,.1);color:#e2e5f1;border-color:rgba(245,167,66,.2)}
      @media(max-width:420px){#artio-chat-panel{width:calc(100vw - 32px);height:70vh;right:0}}

      /* ── Light mode overrides ── */
      [data-theme="light"] #artio-chat-panel{background:#ffffff;border-color:rgba(20,18,12,0.12);box-shadow:0 16px 48px rgba(20,18,12,0.15)}
      [data-theme="light"] #artio-chat-header{background:#f3efe6;border-bottom-color:rgba(20,18,12,0.10)}
      [data-theme="light"] #artio-chat-header-title{color:#1a1a1f}
      [data-theme="light"] #artio-chat-header-sub{color:#6a6b78}
      [data-theme="light"] .artio-hbtn{color:#6a6b78}
      [data-theme="light"] .artio-hbtn:hover{color:#1a1a1f;background:rgba(20,18,12,0.06)}
      [data-theme="light"] #artio-chat-messages::-webkit-scrollbar-thumb{background:rgba(20,18,12,0.15)}
      [data-theme="light"] .artio-msg.user{background:rgba(217,119,6,0.12);color:#1a1a1f;border-color:rgba(217,119,6,0.3)}
      [data-theme="light"] .artio-msg.bot{background:#f3efe6;color:#1a1a1f;border-color:rgba(20,18,12,0.10)}
      [data-theme="light"] .artio-msg.typing{background:#f3efe6;border-color:rgba(20,18,12,0.10)}
      [data-theme="light"] .artio-waiting{color:#6a6b78}
      [data-theme="light"] .artio-dots span{background:#6a6b78}
      [data-theme="light"] #artio-chat-footer{background:#ffffff;border-top-color:rgba(20,18,12,0.10)}
      [data-theme="light"] #artio-chat-input{background:#f3efe6;border-color:rgba(20,18,12,0.15);color:#1a1a1f}
      [data-theme="light"] #artio-chat-input::placeholder{color:#6a6b78}
      [data-theme="light"] #artio-chat-send{background:#d97706}
      [data-theme="light"] .artio-chat-empty{color:#6a6b78}
      [data-theme="light"] .artio-chat-empty strong{color:#1a1a1f}
      [data-theme="light"] .artio-chip{background:#f3efe6;border-color:rgba(20,18,12,0.12);color:#6a6b78}
      [data-theme="light"] .artio-chip:hover{background:rgba(217,119,6,0.10);color:#1a1a1f;border-color:rgba(217,119,6,0.25)}
      #artio-chat-mascot{width:42px;height:42px;object-fit:contain;object-position:center bottom;pointer-events:none}
      #artio-chat-btn{padding:0!important;overflow:visible!important}
      [data-theme="light"] #artio-chat-badge{border-color:#ffffff}
    `;
    document.head.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.id = "artio-chat-bubble";
    wrapper.innerHTML = `
      <div id="artio-chat-panel">
        <div id="artio-chat-header">
          <div id="artio-chat-header-left">
            <img src="mascotte-artio.png" class="artio-avatar" alt="Artio">
            <div>
              <div id="artio-chat-header-title">Assistant Artio</div>
              <div id="artio-chat-header-sub">Disponible pour vous aider</div>
            </div>
          </div>
          <button class="artio-hbtn" id="artio-chat-minimize" title="Réduire">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div id="artio-chat-messages"></div>
        <div id="artio-chat-footer">
          <textarea id="artio-chat-input" placeholder="Posez votre question…" rows="1"></textarea>
          <button id="artio-chat-send" title="Envoyer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#080b14" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
      <button id="artio-chat-btn" title="Aide IA Artio">
        <div id="artio-chat-badge"></div>
        <img src="mascotte-artio.png" id="artio-chat-mascot" alt="Artio">
      </button>
    `;
    document.body.appendChild(wrapper);
  }

  // ── EVENTS ────────────────────────────────────────────
  function bindEvents() {
    document.getElementById("artio-chat-btn")?.addEventListener("click", togglePanel);
    document.getElementById("artio-chat-minimize")?.addEventListener("click", togglePanel);
    document.getElementById("artio-chat-send")?.addEventListener("click", sendMessage);
    const input = document.getElementById("artio-chat-input");
    if (input) {
      input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      });
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 100) + "px";
      });
    }
  }

  // ── INIT ──────────────────────────────────────────────
  async function init() {
    // Le widget ne doit exister que pour un utilisateur connecte.
    // On verifie la session AVANT de construire quoi que ce soit :
    // pas de bulle, pas de panneau, pas de bouton pour un visiteur anonyme.
    await initUser();
    if (!accessToken) return;

    buildWidget();
    bindEvents();
    if (history.length > 0) {
      const badge = document.getElementById("artio-chat-badge");
      if (badge) badge.style.display = "block";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
