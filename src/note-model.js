export function normalizeBlock(block = {}) {
  return {
    text: String(block.text || ''),
    copyable: !!block.copyable,
    explain: !!block.explain,
  };
}

export function normalizeUsageStats(stats = {}) {
  return {
    opens: Math.max(0, Number(stats.opens || 0)),
    copies: Math.max(0, Number(stats.copies || 0)),
    lastOpenedAt: String(stats.lastOpenedAt || ''),
    lastCopiedAt: String(stats.lastCopiedAt || ''),
  };
}

export function snapshotNote(note = {}) {
  return {
    id: String(note.id || ''),
    kind: String(note.kind || 'note'),
    title: String(note.title || 'Untitled'),
    index: Number(note.index || 1),
    done: !!note.done,
    blocks: Array.isArray(note.blocks) ? note.blocks.map(normalizeBlock) : [],
    stats: normalizeUsageStats(note.stats),
  };
}

export function normalizeHistoryMeta(meta = {}) {
  return {
    action: String(meta.action || 'snapshot'),
    summary: String(meta.summary || 'Snapshot saved'),
    detail: String(meta.detail || ''),
    diff: String(meta.diff || ''),
  };
}

export function normalizeHistoryEntry(entry = {}) {
  const snapshot = entry.snapshot ? snapshotNote(entry.snapshot) : snapshotNote(entry);
  return {
    id: String(entry.id || crypto.randomUUID()),
    at: String(entry.at || new Date().toISOString()),
    snapshot,
    meta: normalizeHistoryMeta(entry.meta || {}),
  };
}

export function normalizeNote(note = {}, index = 1) {
  const title = String(note.title || 'Untitled');
  const rawKind = String(note.kind || 'note');
  const kind = rawKind === 'warning'
    ? 'important'
    : (['note', 'ticket', 'important'].includes(rawKind) ? rawKind : 'note');
  const blocks = Array.isArray(note.blocks) && note.blocks.length
    ? note.blocks
    : [{ text: '', copyable: false, explain: false }];
  const history = Array.isArray(note.history)
    ? note.history.map(normalizeHistoryEntry).slice(0, 2)
    : [];

  return {
    id: String(note.id || slugify(title)),
    kind,
    title,
    index: Number(note.index || index),
    done: !!note.done,
    blocks: blocks.map(normalizeBlock),
    history,
    stats: normalizeUsageStats(note.stats),
  };
}

export function normalizeNotes(notes) {
  return notes.map((note, index) => normalizeNote(note, index + 1));
}

export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'note';
}

export function sortByIndex(notes) {
  return [...notes].sort((a, b) => (a.index || 0) - (b.index || 0));
}

export function uniqueId(notes, title) {
  const base = slugify(title);
  const existing = new Set(notes.map((note) => note.id));
  let i = 1;
  let id = base;
  while (existing.has(id)) id = `${base}-${i++}`;
  return id;
}

function noteComparableLines(note = {}) {
  const blocks = Array.isArray(note.blocks) ? note.blocks : [];
  const lines = [
    `title: ${String(note.title || '')}`,
    `kind: ${String(note.kind || 'note')}`,
    `done: ${note.done ? 'true' : 'false'}`,
    `blocks: ${blocks.length}`,
  ];

  blocks.forEach((block, index) => {
    lines.push(`block ${index + 1}.copyable: ${block.copyable ? 'true' : 'false'}`);
    lines.push(`block ${index + 1}.explain: ${block.explain ? 'true' : 'false'}`);
    lines.push(`block ${index + 1}.text:`);
    const textLines = String(block.text || '').split(/\r?\n/);
    lines.push(...(textLines.length ? textLines.map((line) => `  ${line}`) : ['']));
  });

  return lines;
}

export function buildUnifiedDiff(beforeNote = {}, afterNote = {}) {
  const before = noteComparableLines(beforeNote);
  const after = noteComparableLines(afterNote);
  const rows = Array.from({ length: before.length + 1 }, () => Array(after.length + 1).fill(0));

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      rows[i][j] = before[i] === after[j]
        ? rows[i + 1][j + 1] + 1
        : Math.max(rows[i + 1][j], rows[i][j + 1]);
    }
  }

  const out = ['--- before', '+++ after', '@@'];
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      out.push(' ' + before[i]);
      i += 1;
      j += 1;
    } else if (rows[i + 1][j] >= rows[i][j + 1]) {
      out.push('-' + before[i]);
      i += 1;
    } else {
      out.push('+' + after[j]);
      j += 1;
    }
  }

  while (i < before.length) out.push('-' + before[i++]);
  while (j < after.length) out.push('+' + after[j++]);

  return out.join('\n');
}

export function summarizeHistoryChange(beforeNote = {}, afterNote = {}, action = 'edit') {
  const bits = [];
  const beforeBlocks = Array.isArray(beforeNote.blocks) ? beforeNote.blocks : [];
  const afterBlocks = Array.isArray(afterNote.blocks) ? afterNote.blocks : [];

  if (beforeNote.title !== afterNote.title) bits.push('title');
  if (beforeNote.kind !== afterNote.kind) bits.push('type');
  if (!!beforeNote.done !== !!afterNote.done) bits.push('done');

  const blockDelta = afterBlocks.length - beforeBlocks.length;
  if (blockDelta > 0) bits.push(`+${blockDelta} block${blockDelta === 1 ? '' : 's'}`);
  if (blockDelta < 0) bits.push(`${blockDelta} block${blockDelta === -1 ? '' : 's'}`);

  const blockLimit = Math.min(beforeBlocks.length, afterBlocks.length);
  let changedBlocks = 0;
  for (let index = 0; index < blockLimit; index += 1) {
    const prev = beforeBlocks[index] || {};
    const next = afterBlocks[index] || {};
    if (
      String(prev.text || '') !== String(next.text || '') ||
      !!prev.copyable !== !!next.copyable ||
      !!prev.explain !== !!next.explain
    ) changedBlocks += 1;
  }

  if (changedBlocks) bits.push(`${changedBlocks} block${changedBlocks === 1 ? '' : 's'} changed`);

  const actionLabel = {
    edit: 'Before edit',
    restore: 'Before restore',
    delete: 'Before delete',
    snapshot: 'Snapshot',
  }[action] || 'Snapshot';

  const summary = bits.length
    ? `${actionLabel}: ${bits.join(', ')}`
    : `${actionLabel}: no visible content change`;
  const detail = bits.length ? bits.join(' • ') : 'No visible content change';

  return {
    action,
    summary,
    detail,
    diff: buildUnifiedDiff(beforeNote, afterNote),
  };
}

export function pushHistory(note, next = null, action = 'edit') {
  const history = Array.isArray(note.history) ? note.history : [];
  return [
    normalizeHistoryEntry({
      snapshot: snapshotNote(note),
      meta: summarizeHistoryChange(note, next || note, action),
    }),
    ...history,
  ].slice(0, 2);
}
