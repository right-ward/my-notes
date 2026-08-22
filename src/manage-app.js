export const manageAppJs = `

(() => {
  const app = document.getElementById('app');
  const toast = document.getElementById('toast');

  function showToast(message, actionText = '', onAction = null, duration = 10000) {
    toast.innerHTML = '';
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    clearTimeout(showToast._timer);
    clearTimeout(showToast._hideTimer);

    const hide = () => {
      toast.style.opacity = '0';
      showToast._hideTimer = setTimeout(() => {
        toast.style.visibility = 'hidden';
        toast.innerHTML = '';
      }, 250);
    };

    if (actionText && typeof onAction === 'function') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'toastAction';
      button.textContent = actionText;
      button.addEventListener('click', async () => {
        hide();
        try {
          await onAction();
        } catch (error) {
          console.error(error);
          showToast('Action failed');
        }
      });
      toast.appendChild(button);
    }

    toast.style.visibility = 'visible';
    toast.style.opacity = '1';
    showToast._timer = setTimeout(hide, duration);
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') node.className = value;
      else if (key === 'textContent') node.textContent = value;
      else if (key === 'value') node.value = value;
      else if (key === 'checked') node.checked = value;
      else if (key === 'dataset') {
        for (const [dKey, dVal] of Object.entries(value)) node.dataset[dKey] = dVal;
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2), value);
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

  async function request(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function downloadText(filename, text, type = 'text/plain') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportJsonBackup() {
    const data = await request('/manage/export.json', { method: 'GET' });
    downloadText('my-notes-backup.json', JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
    showToast('Backup exported');
  }

  async function exportOfflineHtml() {
    const res = await fetch('/manage/export.html', { credentials: 'same-origin' });
    const html = await res.text();
    if (!res.ok) throw new Error(html || 'Failed to export HTML');
    downloadText('my-notes-offline.html', html, 'text/html;charset=utf-8');
    showToast('Offline HTML exported');
  }

  async function importBackupFile(file) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file, file.name || 'my-notes-backup.json');
    const res = await fetch('/manage/import', {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    });
    const text = await res.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); } catch { data = { error: text }; }
    }
    if (!res.ok) throw new Error((data && data.error) || 'Failed to import backup');
    return data;
  }

  const PLACEHOLDER_GROUPS = [
    { title: 'Generic', tokens: ['reason', 'date', 'merchant', 'number'] },
    { title: 'Email', tokens: ['phone', 'nationalId', 'fullName', 'trackingId', 'ticketBody', 'operatorName'] },
  ];

  const PLACEHOLDER_LABELS = {
    reason: 'Reason', date: 'Date', merchant: 'Merchant name', number: 'Number', phone: 'Phone',
    nationalId: 'National ID', fullName: "User's full name", trackingId: 'Ticket tracking ID',
    ticketBody: 'Ticket body', operatorName: "Operator's full name",
  };

  function insertAtCursor(textarea, value) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    textarea.value = before + value + after;
    const next = start + value.length;
    textarea.focus();
    textarea.setSelectionRange(next, next);
  }

  function wrapSelection(textarea, prefix, suffix = prefix, placeholder = '') {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const selected = textarea.value.slice(start, end);
    const content = selected || placeholder;
    const insertion = prefix + content + suffix;
    textarea.value = textarea.value.slice(0, start) + insertion + textarea.value.slice(end);
    const nextStart = start + prefix.length;
    const nextEnd = nextStart + content.length;
    textarea.focus();
    textarea.setSelectionRange(nextStart, nextEnd);
  }

  function insertMarkdownLink(textarea) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const selected = textarea.value.slice(start, end).trim() || 'link text';
    const insertion = '[' + selected + '](https://)';
    textarea.value = textarea.value.slice(0, start) + insertion + textarea.value.slice(end);
    const linkStart = start + selected.length + 3;
    const linkEnd = linkStart + 'https://'.length;
    textarea.focus();
    textarea.setSelectionRange(linkStart, linkEnd);
  }

  function sanitizeMarkdownUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw, window.location.origin);
      if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return parsed.href;
    } catch {}
    return '';
  }

  function appendInlineMarkdown(parent, text) {
    const source = String(text ?? '');
    let index = 0;
    let buffer = '';
    const flush = () => { if (buffer) parent.appendChild(document.createTextNode(buffer)); buffer = ''; };

    while (index < source.length) {
      const rest = source.slice(index);
      if (rest[0] === '\\\\' && index + 1 < source.length) {
        buffer += source[index + 1];
        index += 2;
        continue;
      }
      const tokens = [
        { match: rest.match(/^\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/), kind: 'link' },
        { match: rest.match(/^\`([^\`\\n]+)\`/), kind: 'code' },
        { match: rest.match(/^\\*\\*([\\s\\S]+?)\\*\\*/), kind: 'strong' },
        { match: rest.match(/^__([\\s\\S]+?)__/), kind: 'strong' },
        { match: rest.match(/^~~([\\s\\S]+?)~~/), kind: 'strike' },
        { match: rest.match(/^\\*([^*\\n]+)\\*/), kind: 'em' },
        { match: rest.match(/^_([^_\\n]+)_/), kind: 'em' },
      ];
      const token = tokens.find((entry) => entry.match);
      if (!token) {
        buffer += source[index];
        index += 1;
        continue;
      }

      flush();
      const full = token.match[0];
      const first = token.match[1];
      const second = token.match[2];
      if (token.kind === 'link') {
        const anchor = document.createElement('a');
        anchor.textContent = first;
        const href = sanitizeMarkdownUrl(second);
        if (href) {
          anchor.href = href;
          anchor.rel = 'noreferrer noopener';
          anchor.target = '_blank';
        }
        parent.appendChild(anchor);
      } else if (token.kind === 'code') {
        const code = document.createElement('code'); code.textContent = first; parent.appendChild(code);
      } else if (token.kind === 'strong') {
        const strong = document.createElement('strong'); strong.textContent = first; parent.appendChild(strong);
      } else if (token.kind === 'strike') {
        const strike = document.createElement('del'); strike.textContent = first; parent.appendChild(strike);
      } else if (token.kind === 'em') {
        const em = document.createElement('em'); em.textContent = first; parent.appendChild(em);
      }
      index += full.length;
    }
    flush();
  }

  function renderMarkdownPreview(text) {
    const fragment = document.createDocumentFragment();
    const lines = String(text ?? '').replace(/\\r\\n?/g, '\\n').split('\\n');
    let paragraph = null;
    let list = null;
    let listType = '';
    let quote = null;
    const closeParagraph = () => { paragraph = null; };
    const closeList = () => { list = null; listType = ''; };
    const closeQuote = () => { quote = null; };
    const startParagraph = () => {
      if (!paragraph) {
        paragraph = document.createElement('p'); paragraph.className = 'previewParagraph'; fragment.appendChild(paragraph);
      }
      return paragraph;
    };
    const startList = (nextType) => {
      if (!list || listType !== nextType) {
        closeList(); list = document.createElement(nextType); list.className = 'previewList'; fragment.appendChild(list); listType = nextType;
      }
      return list;
    };
    const startQuote = () => {
      if (!quote) { quote = document.createElement('blockquote'); quote.className = 'previewQuote'; fragment.appendChild(quote); }
      return quote;
    };

    for (const rawLine of lines) {
      const line = String(rawLine ?? '');
      const trimmed = line.trim();
      if (!trimmed) { closeParagraph(); closeList(); closeQuote(); continue; }
      const headingMatch = trimmed.match(/^(#{1,6})\\s+(.+)$/);
      if (headingMatch) {
        closeParagraph(); closeList(); closeQuote();
        const heading = document.createElement('h' + headingMatch[1].length);
        heading.className = 'previewHeading'; appendInlineMarkdown(heading, headingMatch[2]); fragment.appendChild(heading); continue;
      }
      const quoteMatch = trimmed.match(/^>\\s?(.*)$/);
      if (quoteMatch) {
        closeParagraph(); closeList(); const blockquote = startQuote();
        const quoteLine = document.createElement('p'); quoteLine.className = 'previewQuoteLine';
        appendInlineMarkdown(quoteLine, quoteMatch[1]); blockquote.appendChild(quoteLine); continue;
      }
      const listMatch = trimmed.match(/^(?:([-*+])|(\\d+)\\.)\\s+(.+)$/);
      if (listMatch) {
        closeParagraph(); closeQuote(); const currentList = startList(listMatch[2] ? 'ol' : 'ul');
        const item = document.createElement('li'); item.className = 'previewListItem'; appendInlineMarkdown(item, listMatch[3]); currentList.appendChild(item); continue;
      }
      const paragraphEl = startParagraph();
      if (paragraphEl.childNodes.length) paragraphEl.appendChild(document.createElement('br'));
      appendInlineMarkdown(paragraphEl, line);
    }
    return fragment;
  }

  function normalizeUsageStats(stats) {
    return {
      opens: Math.max(0, Number((stats && stats.opens) || 0)),
      copies: Math.max(0, Number((stats && stats.copies) || 0)),
      lastOpenedAt: String((stats && stats.lastOpenedAt) || ''),
      lastCopiedAt: String((stats && stats.lastCopiedAt) || ''),
    };
  }

  function usageSummary(note) {
    const stats = normalizeUsageStats(note && note.stats);
    const openLabel = stats.opens === 1 ? 'open' : 'opens';
    const copyLabel = stats.copies === 1 ? 'copy' : 'copies';
    const lastOpen = stats.lastOpenedAt ? ' · last open ' + new Date(stats.lastOpenedAt).toLocaleString() : '';
    const lastCopy = stats.lastCopiedAt ? ' · last copy ' + new Date(stats.lastCopiedAt).toLocaleString() : '';
    return stats.opens + ' ' + openLabel + ' · ' + stats.copies + ' ' + copyLabel + lastOpen + lastCopy;
  }

  function blockRow(block = {}) {
    const wrap = el('div', { className: 'blockItem' });
    const text = el('textarea', { className: 'blockField', rows: '4', placeholder: 'Block text', value: block.text || '' });
    const toolbar = el('div', { className: 'formatToolbar' });
    const makeButton = (label, title, action) => {
      const button = el('button', { type: 'button', className: 'formatButton', title }, label);
      button.addEventListener('click', action); toolbar.appendChild(button); return button;
    };
    makeButton('Bold', 'Wrap selection with bold markdown', () => wrapSelection(text, '**', '**', 'bold text'));
    makeButton('Italic', 'Wrap selection with italic markdown', () => wrapSelection(text, '_', '_', 'italic text'));
    makeButton('Code', 'Wrap selection with inline code markdown', () => wrapSelection(text, '\`', '\`', 'code'));
    makeButton('Strike', 'Wrap selection with strike markdown', () => wrapSelection(text, '~~', '~~', 'struck text'));
    makeButton('Link', 'Insert a markdown link', () => insertMarkdownLink(text));

    const previewWrap = el('div', { className: 'blockPreview', hidden: 'hidden' });
    const previewHeader = el('div', { className: 'blockPreviewHeader' });
    const previewTitle = el('span', { className: 'blockPreviewLabel', textContent: 'Preview' });
    const previewToggle = el('button', { type: 'button', className: 'formatButton subtle', textContent: 'Show preview' });
    const previewBody = el('div', { className: 'blockPreviewBody' });

    function refreshPreview() {
      previewBody.innerHTML = ''; previewBody.appendChild(renderMarkdownPreview(text.value));
    }
    previewToggle.addEventListener('click', () => {
      const isHidden = previewWrap.hidden;
      previewWrap.hidden = !isHidden;
      previewToggle.textContent = isHidden ? 'Hide preview' : 'Show preview';
      if (isHidden) refreshPreview();
    });
    text.addEventListener('input', () => { if (!previewWrap.hidden) refreshPreview(); });

    const helper = el('details', { className: 'placeholderHelp' });
    const summary = el('summary', { textContent: 'Insert placeholders' });
    const helperGrid = el('div', { className: 'placeholderGrid' });
    for (const group of PLACEHOLDER_GROUPS) {
      const groupBox = el('div', { className: 'placeholderGroup' });
      groupBox.append(el('div', { className: 'placeholderGroupTitle', textContent: group.title }));
      const buttons = el('div', { className: 'placeholderButtons' });
      for (const token of group.tokens) {
        const button = el('button', { type: 'button', className: 'placeholderChip', title: PLACEHOLDER_LABELS[token] || token }, '{{' + token + '}}');
        button.addEventListener('click', () => insertAtCursor(text, '{{' + token + '}}')); buttons.appendChild(button);
      }
      groupBox.append(buttons); helperGrid.appendChild(groupBox);
    }
    helper.append(summary, helperGrid);

    const flags = el('div', { className: 'blockFlags' });
    const copyLabel = el('label');
    const copy = el('input', { type: 'checkbox', checked: !!block.copyable });
    copyLabel.append(copy, ' Copyable');
    flags.append(copyLabel);

    const remove = el('button', { type: 'button' }, 'Remove block');
    previewHeader.append(previewTitle, previewToggle);
    previewWrap.append(previewHeader, previewBody);
    wrap.append(toolbar, text, previewWrap, helper, flags, remove);
    remove.addEventListener('click', () => wrap.remove());
    return wrap;
  }

  function historySection(note) {
    const history = Array.isArray(note.history) ? note.history : [];
    const details = el('details', { className: 'historySection' });
    const summary = el('summary', { textContent: 'Version history (' + history.length + ')' });
    const header = el('div', { className: 'historyHeader' },
      el('div', { className: 'historyHeaderMain' },
        el('h3', { textContent: 'Version history' }),
        el('span', { className: 'historyMeta', textContent: history.length ? history.length + ' saved snapshots' : 'No saved snapshots yet' })
      )
    );
    const list = el('div', { className: 'historyList' });
    const actionsBar = el('div', { className: 'historyTopActions' });

    if (history.length) {
      const clearAll = el('button', { type: 'button' }, 'Delete all snapshots');
      clearAll.addEventListener('click', async () => {
        if (!confirm('Delete all saved snapshots for this card?')) return;
        await request('/api/notes/' + encodeURIComponent(note.id) + '/history', { method: 'POST', body: JSON.stringify({ all: true }) });
        showToast('Snapshots deleted'); await refresh();
      });
      actionsBar.appendChild(clearAll);
    }

    if (!history.length) {
      list.appendChild(el('div', { className: 'historyMeta', textContent: 'No previous versions yet.' }));
    } else {
      history.forEach((entry, index) => {
        const snap = entry.snapshot || {};
        const meta = entry.meta || {};
        const item = el('div', { className: 'historyEntry' });
        const when = entry.at ? new Date(entry.at).toLocaleString() : 'Unknown time';
        item.append(el('div', { className: 'historyMeta', textContent: '#' + (history.length - index) + ' · ' + when + ' · ' + (meta.summary || (snap.kind || note.kind || 'note')) }));
        if (meta.detail) item.append(el('div', { className: 'historyMeta', textContent: meta.detail }));
        const diffDetails = el('details', { className: 'historyDiff' });
        diffDetails.append(el('summary', { textContent: 'Show diff' }), el('pre', { className: 'historyDiffText', textContent: meta.diff || '(no diff metadata)' }));
        item.append(diffDetails);

        const actions = el('div', { className: 'historyActions' });
        const restore = el('button', { type: 'button' }, 'Restore version');
        const removeSnapshot = el('button', { type: 'button' }, 'Delete snapshot');
        restore.addEventListener('click', async () => {
          if (!confirm('Restore this version?')) return;
          await request('/api/notes/restore', { method: 'POST', body: JSON.stringify({ note: snap }) });
          showToast('Version restored'); await refresh();
        });
        removeSnapshot.addEventListener('click', async () => {
          if (!confirm('Delete this snapshot?')) return;
          await request('/api/notes/' + encodeURIComponent(note.id) + '/history', { method: 'POST', body: JSON.stringify({ historyId: entry.id }) });
          showToast('Snapshot deleted'); await refresh();
        });
        actions.append(restore, removeSnapshot); item.append(actions); list.appendChild(item);
      });
    }

    details.append(summary, header, actionsBar, list);
    return details;
  }

  function noteCard(note = {}) {
    const original = clone(note);
    const card = el('section', { className: 'editorCard', dataset: { id: note.id || '' } });
    const titleInput = el('input', { className: 'editorField', type: 'text', value: note.title || '', placeholder: 'Card title', dir: 'auto' });
    const kindSelect = el('select', { className: 'editorField' });
    for (const value of ['note', 'ticket', 'important']) {
      const option = el('option', { value, textContent: value === 'important' ? 'important' : value });
      if (value === (note.kind || 'note')) option.selected = true;
      kindSelect.appendChild(option);
    }

    const blocksWrap = el('div', { className: 'blockList' });
    const blocks = Array.isArray(note.blocks) && note.blocks.length ? note.blocks : [{ text: '', copyable: false }];
    for (const block of blocks) blocksWrap.appendChild(blockRow(block));

    const addBlock = el('button', { type: 'button' }, 'Add block');
    const save = el('button', { type: 'button' }, 'Save');
    const duplicate = el('button', { type: 'button' }, 'Duplicate');
    const del = el('button', { type: 'button' }, 'Delete');

    const titleRow = el('div', { className: 'editorRow' }, el('label', { textContent: 'Title' }), titleInput);
    const kindRow = el('div', { className: 'editorRow' }, el('label', { textContent: 'Type' }), kindSelect);

    const doneRow = el('div', { className: 'editorRow' });
    const doneLabel = el('label', { className: 'blockFlags' });
    const done = el('input', { type: 'checkbox', checked: !!note.done, dir: 'ltr' });
    doneLabel.append(done, ' Done for now');
    doneRow.append(el('label', { textContent: 'State' }), doneLabel);

    const visibilityRow = el('div', { className: 'editorRow' });
    const visibilityLabel = el('label', { className: 'blockFlags' });
    const hidden = el('input', { type: 'checkbox', checked: !!note.hidden, dir: 'ltr' });
    visibilityLabel.append(hidden, ' Hide from public');
    visibilityRow.append(el('label', { textContent: 'Visibility' }), visibilityLabel);

    const usageRow = el('div', { className: 'editorRow' }, el('label', { textContent: 'Usage' }), el('div', { className: 'historyMeta usageMeta', textContent: usageSummary(note) }));
    const blocksRow = el('div', { className: 'editorRow' }, el('label', { textContent: 'Blocks' }), blocksWrap, addBlock);
    const footer = el('div', { className: 'noteActions' }, save, duplicate, del);
    const history = historySection(note);

    addBlock.addEventListener('click', () => blocksWrap.appendChild(blockRow()));

    function collectBlocks() {
      const collected = [];
      blocksWrap.querySelectorAll('.blockItem').forEach((item) => {
        const text = item.querySelector('textarea').value;
        const copy = item.querySelector('input[type="checkbox"]');
        collected.push({ text, copyable: !!copy?.checked });
      });
      return collected;
    }

    duplicate.addEventListener('click', async () => {
      if (!card.dataset.id) { showToast('Save this card first'); return; }
      const payload = {
        title: (String(titleInput.value || original.title || 'Untitled').trim() || 'Untitled') + ' (copy)',
        kind: kindSelect.value,
        done: done.checked,
        hidden: hidden.checked,
        blocks: collectBlocks(),
      };
      await request('/api/notes', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Duplicated'); await refresh();
    });

    del.addEventListener('click', async () => {
      const id = card.dataset.id;
      if (!id) { card.remove(); return; }
      if (!confirm('Delete this card?')) return;
      await request('/api/notes/' + encodeURIComponent(id), { method: 'DELETE' });
      showToast('Deleted', 'Undo', async () => {
        await request('/api/notes/restore', { method: 'POST', body: JSON.stringify({ note: original }) });
        await refresh();
      });
      await refresh();
    });

    save.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      const kind = kindSelect.value;
      const collected = collectBlocks();
      if (!title) { showToast('Title is required'); return; }
      if (!collected.length) { showToast('Add at least one block'); return; }

      const payload = { title, kind, done: done.checked, hidden: hidden.checked, blocks: collected };
      const id = card.dataset.id;
      if (id) {
        await request('/api/notes/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Updated', 'Undo', async () => {
          await request('/api/notes/restore', { method: 'POST', body: JSON.stringify({ note: original }) });
          await refresh();
        });
      } else {
        const data = await request('/api/notes', { method: 'POST', body: JSON.stringify(payload) });
        card.dataset.id = data.note.id;
        showToast('Created');
      }
      await refresh();
    });

    card.append(titleRow, kindRow, doneRow, visibilityRow, usageRow, blocksRow, history, footer);
    return card;
  }

  async function refresh() {
    const data = await request('/api/notes', { method: 'GET' });
    app.innerHTML = '';

    const top = el('div', { className: 'manageTop' },
      el('button', { type: 'button', id: 'newCard' }, 'New card'),
      el('button', { type: 'button', id: 'backupBtn' }, 'Export backup'),
      el('button', { type: 'button', id: 'importBtn' }, 'Import backup'),
      el('button', { type: 'button', id: 'htmlBtn' }, 'Export HTML'),
      el('input', { type: 'file', id: 'importFile', accept: 'application/json,.json', hidden: 'hidden' }),
      el('button', { type: 'button', id: 'logoutBtn' }, 'Logout'),
      el('span', { className: 'meta', textContent: data.notes.length + ' cards loaded' })
    );

    const grid = el('div', { className: 'manageGrid' });
    data.notes.sort((a, b) => (a.index || 0) - (b.index || 0)).forEach((note) => grid.appendChild(noteCard(note)));
    app.append(top, grid);

    top.querySelector('#newCard').addEventListener('click', () => {
      grid.prepend(noteCard({ kind: 'note', hidden: false, blocks: [{ text: '', copyable: false }], history: [] }));
      showToast('New card ready');
    });

    top.querySelector('#backupBtn').addEventListener('click', async () => {
      try { await exportJsonBackup(); } catch (error) { console.error(error); showToast(error.message || 'Export failed'); }
    });
    top.querySelector('#htmlBtn').addEventListener('click', async () => {
      try { await exportOfflineHtml(); } catch (error) { console.error(error); showToast(error.message || 'Export failed'); }
    });

    const importBtn = top.querySelector('#importBtn');
    const importFile = top.querySelector('#importFile');
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async () => {
      const [file] = importFile.files || [];
      if (!file) return;
      try {
        await importBackupFile(file);
        showToast('Backup imported'); importFile.value = ''; await refresh();
      } catch (error) {
        console.error(error); showToast(error.message || 'Import failed'); importFile.value = '';
      }
    });

    top.querySelector('#logoutBtn').addEventListener('click', async () => {
      await request('/api/logout', { method: 'POST', body: '{}' });
      location.href = '/';
    });
  }

  refresh().catch((error) => {
    console.error(error);
    app.textContent = 'Failed to load editor';
    showToast('Failed to load editor');
  });
})();

`;
