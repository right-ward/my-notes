export const manageExportAppJs = `

(() => {
  const EXPORT_BUTTON_ID = 'selectedHtmlBtn';
  const MODAL_ID = 'selectedHtmlModal';

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') node.className = value;
      else if (key === 'textContent') node.textContent = value;
      else if (key === 'checked') node.checked = value;
      else if (key === 'disabled') node.disabled = value;
      else if (key === 'hidden') node.hidden = value;
      else if (key === 'dataset') {
        for (const [dKey, dVal] of Object.entries(value)) node.dataset[dKey] = dVal;
      } else {
        node.setAttribute(key, value);
      }
    }
    for (const child of children.flat()) {
      if (child == null) continue;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = '';
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);
    clearTimeout(showToast._timer);
    clearTimeout(showToast._hideTimer);
    toast.style.visibility = 'visible';
    toast.style.opacity = '1';
    showToast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      showToast._hideTimer = setTimeout(() => {
        toast.style.visibility = 'hidden';
        toast.innerHTML = '';
      }, 250);
    }, 10000);
  }

  async function requestNotes() {
    const response = await fetch('/api/notes', {
      credentials: 'same-origin',
      headers: { 'accept': 'application/json' },
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
    if (!response.ok) {
      throw new Error((data && data.error) || 'Failed to load cards');
    }
    return Array.isArray(data && data.notes)
      ? data.notes.slice().sort((a, b) => (a.index || 0) - (b.index || 0))
      : [];
  }

  function closeModal(modal, onKeydown) {
    if (onKeydown) document.removeEventListener('keydown', onKeydown);
    if (!modal) return;
    modal.remove();
    document.documentElement.classList.remove('modalOpen');
  }

  function openModal(notes) {
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    const modal = el('div', {
      id: MODAL_ID,
      className: 'copyModal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'selectedHtmlTitle',
    });
    const backdrop = el('div', { className: 'copyModalBackdrop' });
    const card = el('section', { className: 'copyModalCard' });
    const header = el('div', { className: 'copyModalHeader' });
    const headingWrap = el('div');
    const title = el('h2', { id: 'selectedHtmlTitle', textContent: 'Export selected cards' });
    const meta = el('div', { className: 'copyModalMeta' });
    const close = el('button', {
      type: 'button',
      className: 'copyModalClose',
      'aria-label': 'Close',
      textContent: 'Close',
    });
    headingWrap.append(title, meta);
    header.append(headingWrap, close);

    const hint = el('div', {
      className: 'copyModalHint',
      textContent: 'Choose the cards to include in the offline HTML export.',
    });

    const form = el('div', { className: 'copyModalForm' });
    const selectAll = el('button', {
      type: 'button',
      className: 'copyModalButton',
      textContent: 'Select all',
    });
    const clearAll = el('button', {
      type: 'button',
      className: 'copyModalButton',
      textContent: 'Clear all',
    });
    const selectionActions = el('div', { className: 'copyModalActions' }, selectAll, clearAll);
    const checkboxes = [];

    notes.forEach((note) => {
      const label = el('label', { className: 'copyModalField' });
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.justifyContent = 'space-between';
      label.style.gap = '0.75rem';
      label.style.padding = '0.55rem 0.7rem';
      label.style.border = '1px solid rgba(255,255,255,0.06)';
      label.style.borderRadius = '10px';
      label.style.background = 'rgba(255,255,255,0.02)';

      const checkbox = el('input', { type: 'checkbox', checked: true, value: note.id || '' });
      checkbox.style.width = '1.15rem';
      checkbox.style.minWidth = '1.15rem';
      checkbox.style.height = '1.15rem';
      checkbox.style.minHeight = '1.15rem';
      checkbox.style.padding = '0';
      checkbox.style.flex = '0 0 auto';
      const titleText = el('span', { textContent: note.title || 'Untitled' });
      titleText.style.overflowWrap = 'anywhere';
      label.append(titleText, checkbox);
      form.appendChild(label);
      checkboxes.push(checkbox);
    });

    const empty = el('div', {
      className: 'copyModalEmpty',
      hidden: notes.length > 0,
      textContent: 'There are no cards to export.',
    });
    const cancel = el('button', {
      type: 'button',
      className: 'copyModalClose',
      textContent: 'Cancel',
    });
    const exportButton = el('button', {
      type: 'button',
      className: 'copyModalButton primary',
      textContent: 'Export selected',
      disabled: notes.length === 0,
    });
    const actions = el('div', { className: 'copyModalActions' }, cancel, exportButton);

    const updateSelection = () => {
      const count = checkboxes.filter((checkbox) => checkbox.checked).length;
      meta.textContent = count + ' of ' + notes.length + ' selected';
      exportButton.disabled = count === 0;
    };

    checkboxes.forEach((checkbox) => checkbox.addEventListener('change', updateSelection));
    selectAll.addEventListener('click', () => {
      checkboxes.forEach((checkbox) => { checkbox.checked = true; });
      updateSelection();
    });
    clearAll.addEventListener('click', () => {
      checkboxes.forEach((checkbox) => { checkbox.checked = false; });
      updateSelection();
    });

    let closed = false;
    const onKeydown = (event) => {
      if (event.key === 'Escape') dismiss();
    };
    const dismiss = () => {
      if (closed) return;
      closed = true;
      closeModal(modal, onKeydown);
    };

    close.addEventListener('click', dismiss);
    cancel.addEventListener('click', dismiss);
    backdrop.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKeydown);

    exportButton.addEventListener('click', async () => {
      const ids = checkboxes
        .filter((checkbox) => checkbox.checked && checkbox.value)
        .map((checkbox) => checkbox.value);
      if (!ids.length) return;

      exportButton.disabled = true;
      exportButton.textContent = 'Exporting...';
      try {
        const response = await fetch('/manage/export.html', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', 'accept': 'text/html' },
          body: JSON.stringify({ ids }),
        });
        const html = await response.text();
        if (!response.ok) throw new Error(html || 'Failed to export selected HTML');

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'my-notes-selected.html';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        dismiss();
        showToast('Selected HTML exported');
      } catch (error) {
        console.error(error);
        exportButton.disabled = false;
        exportButton.textContent = 'Export selected';
        showToast(error.message || 'Export failed');
      }
    });

    card.append(header, hint, selectionActions, form, empty, actions);
    modal.append(backdrop, card);
    document.body.appendChild(modal);
    document.documentElement.classList.add('modalOpen');
    updateSelection();
  }

  async function openSelectedExport() {
    try {
      const notes = await requestNotes();
      openModal(notes);
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Failed to load cards');
    }
  }

  function installButton(top) {
    if (!top || top.querySelector('#' + EXPORT_BUTTON_ID)) return;
    const htmlButton = top.querySelector('#htmlBtn');
    if (!htmlButton) return;

    const button = el('button', {
      type: 'button',
      id: EXPORT_BUTTON_ID,
      textContent: 'Export Selected HTML',
    });
    button.addEventListener('click', openSelectedExport);
    htmlButton.insertAdjacentElement('afterend', button);
  }

  const observer = new MutationObserver(() => {
    installButton(document.querySelector('.manageTop'));
  });
  observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  installButton(document.querySelector('.manageTop'));
})();

`;
