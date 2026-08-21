export const uiPolishJs = `

(() => {
  const CATEGORY_ORDER = ['important', 'note', 'ticket'];
  const CATEGORY_LABELS = { note: 'Notes', ticket: 'Tickets', important: 'Important' };
  const fallbackStorage = new Map();
  const getStorage = () => { try { return window.localStorage; } catch { return null; } };
  const storageGet = (key) => { const s = getStorage(); if (s) { try { return s.getItem(key); } catch {} } return fallbackStorage.get(key) ?? null; };
  const storageSet = (key, value) => { const s = getStorage(); if (s) { try { s.setItem(key, value); return; } catch {} } fallbackStorage.set(key, String(value)); };

  const style = document.createElement('style');
  style.textContent = '.categoryGroup{grid-column:1 / -1;display:grid;gap:.7rem}.categoryHeader{display:flex;align-items:center;gap:.65rem;width:100%;padding:.6rem .8rem;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.03);color:var(--text);font:inherit;text-align:left;cursor:pointer}.categoryHeader:hover{border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.05)}.categoryTitle{font-weight:700}.categoryCount{color:var(--muted);font-size:.86rem}.categoryIndicator{width:.65rem;height:.65rem;margin-inline-start:auto;border-inline-end:2px solid currentColor;border-block-end:2px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .15s ease}.categoryGroup.isCollapsed .categoryIndicator{transform:rotate(-45deg) translateY(2px)}.categoryCards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;align-items:start}.categoryCards[hidden]{display:none}.publicHideRow{display:grid;gap:.5rem}.publicHideToggle{width:1.15rem;height:1.15rem}';
  document.head.appendChild(style);

  function installExplainCleanup() {
    const clean = (root = document) => root.querySelectorAll('.blockFlags').forEach((flags) => {
      const labels = flags.querySelectorAll('label');
      if (labels.length < 2) return;
      labels[1].remove();
    });
    clean();
    const app = document.getElementById('app');
    if (app) new MutationObserver(() => clean(app)).observe(app, { childList: true, subtree: true });
  }

  function installHideControls() {
    const app = document.getElementById('app');
    if (!app) return;
    const install = () => {
      app.querySelectorAll('.editorCard').forEach((card) => {
        if (card.querySelector('.publicHideRow')) return;
        const stateRow = Array.from(card.querySelectorAll('.editorRow')).find((row) => {
          const label = row.firstElementChild;
          return label && label.textContent.trim() === 'State';
        });
        if (!stateRow) return;
        const row = document.createElement('div');
        row.className = 'editorRow publicHideRow';
        const label = document.createElement('label');
        label.textContent = 'Visibility';
        const control = document.createElement('label');
        control.style.display = 'flex';
        control.style.alignItems = 'center';
        control.style.gap = '.4rem';
        control.style.color = 'var(--muted)';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'publicHideToggle';
        checkbox.checked = card.dataset.publicHidden === 'true';
        checkbox.addEventListener('change', () => {
          card.dataset.publicHidden = checkbox.checked ? 'true' : 'false';
        });
        control.append(checkbox, ' Hide from public');
        row.append(label, control);
        stateRow.insertAdjacentElement('afterend', row);
      });
    };
    install();
    new MutationObserver(install).observe(app, { childList: true, subtree: true });
  }

  function getEditorCardForRequest(url, method) {
    if (!document.getElementById('app')) return null;
    if (method === 'PUT') {
      const pathname = new URL(url, window.location.origin).pathname;
      const id = decodeURIComponent(pathname.split('/').pop() || '');
      for (const card of document.querySelectorAll('.editorCard')) {
        if (card.dataset.id === id) return card;
      }
    }
    return document.activeElement?.closest('.editorCard') || null;
  }

  function installRequestMigration() {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const requestUrl = typeof input === 'string' ? input : input?.url || '';
      const method = String(init.method || (typeof input !== 'string' ? input?.method : 'GET') || 'GET').toUpperCase();
      if (
        document.getElementById('app') &&
        (method === 'POST' || method === 'PUT') &&
        requestUrl.includes('/api/notes')
      ) {
        const card = getEditorCardForRequest(requestUrl, method);
        const control = card?.querySelector('.publicHideToggle');
        if (control && typeof init.body === 'string') {
          try {
            const payload = JSON.parse(init.body);
            payload.hidden = !!control.checked;
            init = { ...init, body: JSON.stringify(payload) };
          } catch {
            // Leave non-JSON requests untouched.
          }
        }
      }
      const response = await originalFetch(input, init);
      if (
        document.getElementById('notes') &&
        method === 'GET' &&
        requestUrl.includes('/api/notes') &&
        response.headers.get('content-type')?.includes('application/json')
      ) {
        try {
          const data = await response.clone().json();
          const visible = Array.isArray(data?.notes) ? data.notes.filter((note) => !note.hidden) : [];
          return new Response(JSON.stringify({ ...data, notes: visible }), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch {
          return response;
        }
      }
      return response;
    };
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
  installHideControls();
  installRequestMigration();
  installCategories();
})();

`;
