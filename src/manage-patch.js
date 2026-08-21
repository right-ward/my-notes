export const managePatchJs = `

(() => {
  const hiddenById = new Map();

  function rememberNotes(notes) {
    if (!Array.isArray(notes)) return;
    notes.forEach((note) => {
      if (note && note.id) hiddenById.set(String(note.id), !!note.hidden);
    });
  }

  function patchBlockFlags(root = document) {
    root.querySelectorAll('.blockFlags').forEach((flags) => {
      flags.querySelectorAll('label').forEach((label) => {
        if (!/Explain on hover/i.test(label.textContent || '')) return;
        const legacy = document.createElement('input');
        legacy.type = 'checkbox';
        legacy.hidden = true;
        legacy.checked = false;
        label.replaceWith(legacy);
      });
    });
  }

  function patchVisibility(root = document) {
    root.querySelectorAll('.editorCard').forEach((card) => {
      if (card.querySelector('[data-hidden-toggle]')) return;
      const stateRow = [...card.querySelectorAll('.editorRow')]
        .find((row) => String(row.firstElementChild?.textContent || '').trim() === 'State');
      if (!stateRow) return;

      const row = document.createElement('div');
      row.className = 'editorRow publicHideRow';
      const rowLabel = document.createElement('label');
      rowLabel.textContent = 'Visibility';
      const control = document.createElement('label');
      control.style.display = 'flex';
      control.style.alignItems = 'center';
      control.style.gap = '.4rem';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.hiddenToggle = 'true';
      checkbox.checked = card.dataset.id ? !!hiddenById.get(card.dataset.id) : false;
      checkbox.setAttribute('aria-label', 'Hide this card from the public page');
      control.append(checkbox, ' Hide from public');
      row.append(rowLabel, control);
      stateRow.insertAdjacentElement('afterend', row);
    });
  }

  function patch(root = document) {
    patchBlockFlags(root);
    patchVisibility(root);
  }

  const app = document.getElementById('app');
  if (app) {
    const observer = new MutationObserver(() => patch(app));
    observer.observe(app, { childList: true, subtree: true });
    patch(app);
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    const method = String(init.method || (typeof input !== 'string' ? input?.method : 'GET') || 'GET').toUpperCase();
    const pathname = new URL(requestUrl, window.location.origin).pathname;

    if (method === 'POST' || method === 'PUT') {
      if ((pathname === '/api/notes' || /^\/api\/notes\/[^/]+$/.test(pathname)) && typeof init.body === 'string') {
        try {
          const payload = JSON.parse(init.body);
          if (Array.isArray(payload.blocks)) {
            const activeCard = document.activeElement?.closest('.editorCard');
            const toggle = activeCard?.querySelector('[data-hidden-toggle]');
            if (toggle) {
              payload.hidden = !!toggle.checked;
              init = { ...init, body: JSON.stringify(payload) };
            }
          }
        } catch {}
      }
    }

    const response = await originalFetch(input, init);

    if (method === 'GET' && pathname === '/api/notes') {
      try {
        rememberNotes((await response.clone().json()).notes);
        queueMicrotask(patch);
      } catch {}
    } else if (method === 'POST' || method === 'PUT') {
      try {
        const note = (await response.clone().json()).note;
        if (note?.id) hiddenById.set(String(note.id), !!note.hidden);
      } catch {}
    }

    return response;
  };
})();

`;
