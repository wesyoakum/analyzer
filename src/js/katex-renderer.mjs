const DEFAULT_RENDER_OPTIONS = {
  throwOnError: false,
  strict: 'warn'
};

/**
 * Render KaTeX for all elements within root that declare a `data-latex` string.
 * Falls back to the element's existing innerHTML if KaTeX is unavailable.
 *
 * @param {ParentNode} [root=document.body]
 */
export function renderLatexFragments(root = document.body) {
  if (!root) return;
  const katex = window.katex;
  if (!katex || typeof katex.render !== 'function') {
    return;
  }

  const elements = root.querySelectorAll('[data-latex]');
  elements.forEach(el => {
    const latex = el.getAttribute('data-latex');
    if (!latex) return;

    if (!el.dataset.katexFallback) {
      el.dataset.katexFallback = el.innerHTML;
    }

    if (el.dataset.katexRendered === latex) {
      return;
    }

    const displayMode = el.dataset.display === 'block';
    try {
      katex.render(latex, el, {
        ...DEFAULT_RENDER_OPTIONS,
        displayMode
      });
      el.dataset.katexRendered = latex;
    } catch (err) {
      console.warn('KaTeX render failed:', latex, err);
      if (el.dataset.katexFallback) {
        el.innerHTML = el.dataset.katexFallback;
      }
      delete el.dataset.katexRendered;
    }
  });
}
