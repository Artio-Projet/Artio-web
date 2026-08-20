/**
 * legal-footer.js — Artio
 * Injecte les liens légaux (CGU, CGV, Politique de confidentialité) dans le footer de chaque page.
 * À inclure en bas de chaque page HTML : <script src="legal-footer.js"></script>
 */
(function () {
  const LINKS = [
    { label: 'Mentions légales',         href: '/mentions-legales.html' },
    { label: 'CGU',                      href: '/cgu.html' },
    { label: 'CGV',                      href: '/cgv.html' },
    { label: 'Politique de confidentialité', href: '/confidentialite.html' },
    { label: 'contact@monartio.fr',      href: 'mailto:contact@monartio.fr' },
  ];

  const style = document.createElement('style');
  style.textContent = `
    .legal-footer-bar {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 6px 18px;
      padding: 12px 24px;
      border-top: 1px solid rgba(255,255,255,0.07);
      font-size: 11px;
      color: #6b7494;
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: transparent;
    }
    .legal-footer-bar a {
      color: #6b7494;
      text-decoration: none;
      transition: color .2s;
    }
    .legal-footer-bar a:hover {
      color: #f5a742;
    }
    .legal-footer-sep {
      color: rgba(255,255,255,0.15);
      user-select: none;
    }
  `;
  document.head.appendChild(style);

  function buildLegalBar() {
    const bar = document.createElement('div');
    bar.className = 'legal-footer-bar';

    const copy = document.createElement('span');
    copy.textContent = '© 2026 Artio';
    bar.appendChild(copy);

    LINKS.forEach((link, i) => {
      const sep = document.createElement('span');
      sep.className = 'legal-footer-sep';
      sep.textContent = '·';
      bar.appendChild(sep);

      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.label;
      if (!link.href.startsWith('mailto')) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      bar.appendChild(a);
    });

    return bar;
  }

  function inject() {
    // Si un footer existe déjà, on lui ajoute la barre légale en dessous
    const existingFooter = document.querySelector('footer');
    if (existingFooter) {
      // Éviter la double injection
      if (existingFooter.querySelector('.legal-footer-bar')) return;
      existingFooter.appendChild(buildLegalBar());
    } else {
      // Sinon on crée un footer complet
      const footer = document.createElement('footer');
      footer.style.cssText = 'position:relative;z-index:1;';
      footer.appendChild(buildLegalBar());
      document.body.appendChild(footer);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
