export const uiPolishJs = `

(() => {
  const CATEGORY_ORDER = ['note', 'ticket', 'important'];
  const CATEGORY_LABELS = { note: 'Notes', ticket: 'Tickets', important: 'Important' };
  const fallbackStorage = new Map();
  const getStorage = () => { try { return window.localStorage; } catch { return null; } };
  const storageGet = (key) => { const s = getStorage(); if (s) { try { return s.getItem(key); } catch {} } return fallbackStorage.get(key) ?? null; };
  const storageSet = (key, value) => { const s = getStorage(); if (s) { try { s.setItem(key, value); return; } catch {} } fallbackStorage.set(key, String(value)); };

  const style = document.createElement('style');
  style.textContent = `
    .categoryGroup { grid-column: 1 / -1; display: grid; gap: 0.7rem; }
    .categoryHeader { display: flex; align-items: center; gap: 0.65rem; width: 100%; padding: 0.6rem 0.8rem; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: rgba(255,255,255,0.03); color: var(--text); font: inherit; text-align: left; cursor: pointer; }
    .categoryHeader:hover { border-color: rgba(255,255,255,0.16); background: rgba(255,255,255,0.05); }
    .categoryTitle { font-weight: 700; }
    .categoryCount { color: var(--muted); font-size: 0.86rem; }
    .categoryIndicator { width: 0.65rem; height: 0.65rem; margin-inline-start: auto; border-inline-end: 2px solid currentColor; border-block-end: 2px solid currentColor; transform: rotate(45deg) translateY(-2px); transition: transform 0.15s ease; }
    .categoryGroup.isCollapsed .categoryIndicator { transform: rotate(-45deg) translateY(2px); }
    .categoryCards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; align-items: start; }
    .categoryCards[hidden] { display: none; }
  `;
  document.head.appendChild(style);

  function installExplainCleanup() {
    const clean = (root = document) => root.querySelectorAll('.blockFlags').forEach((flags) => {
      const labels = flags.querySelectorAll('label');
      if (labels.length < 2) return;
      const input = labels[1].querySelector('input[type="checkbox"]');
      if (!input) return;
      input.checked = false;
      input.disabled = true;
      labels[1].hidden = true;
    });
    clean();
    const app = document.getElementById('app');
    if (app) new MutationObserver(() => clean(app)).observe(app, { childList: true, subtree: true });
  }

  function makeCategory(kind, cards) {
    const section = document.createElement('section');
    section.className = 'categoryGroup';
    section.dataset.category = kind;
    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'categoryHeader';
    const title = document.createElement('span');
    title.className = 'categoryTitle';
    title.textContent = CATEGORY_LABELS[kind] || kind;
    const count = document.createElement('span');
    count.className = 'categoryCount';
    count.textContent = String(cards.length);
    const indicator = document.createElement('span');
    indicator.className = 'categoryIndicator';
    indicator.setAttribute('aria-hidden', 'true');
    header.append(title, count, indicator);
    const body = document.createElement('div');
    body.className = 'categoryCards';
    cards.forEach((card) => body.appendChild(card));
    const key = 'my-notes.category.' + kind;
    const collapsed = storageGet(key) === '1';
    body.hidden = collapsed;
    section.classList.toggle('isCollapsed', collapsed);
    header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    header.addEventListener('click', () => {
      const next = !body.hidden;
      body.hidden = next;
      section.classList.toggle('isCollapsed', next);
      header.setAttribute('aria-expanded', next ? 'false' : 'true');
      storageSet(key, next ? '1' : '0');
    });
    section.append(header, body);
    return section;
  }

  function regroup() {
    const list = document.getElementById('notes');
    if (!list || list.dataset.categoryGrouping === 'working') return;
    const cards = Array.from(list.children).filter((child) => child.classList.contains('defaultBox'));
    if (!cards.length) return;
    list.dataset.categoryGrouping = 'working';
    const grouped = new Map();
    cards.forEach((card) => {
      const kind = CATEGORY_ORDER.find((candidate) => card.classList.contains(candidate + 'Box')) || 'note';
      if (!grouped.has(kind)) grouped.set(kind, []);
      grouped.get(kind).push(card);
    });
    const fragment = document.createDocumentFragment();
    CATEGORY_ORDER.forEach((kind) => {
      const group = grouped.get(kind);
      if (group?.length) fragment.appendChild(makeCategory(kind, group));
    });
    list.replaceChildren(fragment);
    list.dataset.categoryGrouping = '';
  }

  function installCategories() {
    const list = document.getElementById('notes');
    if (!list) return;
    new MutationObserver(() => { if (list.dataset.categoryGrouping !== 'working') regroup(); }).observe(list, { childList: true });
    regroup();
  }

  installExplainCleanup();
  installCategories();
})();

`;