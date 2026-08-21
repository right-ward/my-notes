import { publicAppJs } from './public-app.js';
import { manageAppJs } from './manage-app.js';
import {
  normalizeNote,
  snapshotNote,
  pushHistory,
  sortByIndex,
  uniqueId,
} from './note-model.js';
import { loadNotes, saveNotes } from './note-store.js';
import { publicShell, manageLoginShell, manageShell } from './shells.js';

const ADMIN_PASSWORD = '##I##ENCRYPT##';
const COOKIE_NAME = 'dp_notes_auth';
const cookieDays = 30;

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  const target = name + '=';
  for (const part of cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) return decodeURIComponent(trimmed.slice(target.length));
  }
  return '';
}

function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  return crypto.subtle.digest('SHA-256', data).then((buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  );
}

const AUTH_TOKEN = await sha256Hex(ADMIN_PASSWORD);

function isAuthed(request) {
  return getCookie(request, COOKIE_NAME) === AUTH_TOKEN;
}

function authHeaders(value) {
  return {
    'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * cookieDays}`,
  };
}

function clearAuthHeaders() {
  return {
    'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
  };
}

function response(text, status = 200, headers = {}) {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function backupPayload(notes) {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    notes: sortByIndex(notes),
  };
}

async function parseBackupPayload(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file') || form.get('backup') || form.get('data');
    if (file && typeof file.text === 'function') return JSON.parse(await file.text());
    const raw = form.get('json') || form.get('payload');
    if (typeof raw === 'string' && raw.trim()) return JSON.parse(raw);
    return {};
  }
  return await parseBody(request);
}

async function replaceAllNotes(env, payload) {
  const notes = Array.isArray(payload?.notes) ? payload.notes : Array.isArray(payload) ? payload : [];
  return await saveNotes(env, notes);
}

function exportHtmlAttachment(notes, filename = 'my-notes-offline.html') {
  return response(publicShell(notes), 200, {
    'content-disposition': `attachment; filename=\"${filename}\"`,
  });
}

async function exportSelectedHtml(env, ids) {
  const selectedIds = new Set(
    (Array.isArray(ids) ? ids : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );
  const notes = sortByIndex(await loadNotes(env));
  const selected = notes.filter((note) => selectedIds.has(String(note.id)) && !note.hidden);
  if (!selected.length) throw new Error('Select at least one existing visible card');
  return exportHtmlAttachment(selected, 'my-notes-selected.html');
}

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
}

async function parseBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return await request.json().catch(() => ({}));
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }
  return {};
}

async function createNote(env, body) {
  const notes = await loadNotes(env);
  const title = String(body.title || '').trim();
  if (!title) throw new Error('Title is required');
  const note = normalizeNote({
    id: uniqueId(notes, title),
    title,
    kind: body.kind,
    done: !!body.done,
    hidden: !!body.hidden,
    blocks: Array.isArray(body.blocks) ? body.blocks : [],
    history: [],
    index: notes.length + 1,
  }, notes.length + 1);
  const updated = sortByIndex([...notes, note]).map((n, i) => ({ ...n, index: i + 1 }));
  await saveNotes(env, updated);
  return note;
}

async function updateNote(env, id, body) {
  const notes = await loadNotes(env);
  const index = notes.findIndex((note) => note.id === id);
  if (index < 0) throw new Error('Note not found');
  const current = notes[index];
  const next = normalizeNote({
    ...current,
    title: body.title ?? current.title,
    kind: body.kind ?? current.kind,
    done: typeof body.done === 'boolean' ? body.done : current.done,
    hidden: typeof body.hidden === 'boolean' ? body.hidden : current.hidden,
    blocks: Array.isArray(body.blocks) ? body.blocks : current.blocks,
    id: current.id,
    index: current.index,
    history: [],
  }, current.index);
  next.history = pushHistory(current, next, 'edit');
  notes[index] = next;
  await saveNotes(env, notes);
  return next;
}

async function restoreNote(env, body) {
  const snapshot = snapshotNote(body.note || body);
  const notes = await loadNotes(env);
  const index = notes.findIndex((note) => note.id === snapshot.id);

  if (index >= 0) {
    const current = notes[index];
    const restored = normalizeNote({ ...snapshot, id: current.id, index: current.index, history: [] }, current.index);
    restored.history = pushHistory(current, restored, 'restore');
    notes[index] = restored;
    await saveNotes(env, notes);
    return restored;
  }

  const restored = normalizeNote({
    ...snapshot,
    index: Number(snapshot.index || notes.length + 1),
    history: [],
  }, Number(snapshot.index || notes.length + 1));
  const updated = sortByIndex([...notes, restored]).map((n, i) => ({ ...n, index: i + 1 }));
  await saveNotes(env, updated);
  return restored;
}

async function deleteHistory(env, id, body) {
  const notes = await loadNotes(env);
  const index = notes.findIndex((note) => note.id === id);
  if (index < 0) throw new Error('Note not found');

  const current = notes[index];
  let history = Array.isArray(current.history) ? current.history : [];
  if (body && body.all) {
    history = [];
  } else if (body && body.historyId) {
    const before = history.length;
    history = history.filter((entry) => entry.id !== String(body.historyId));
    if (history.length === before) throw new Error('Snapshot not found');
  } else {
    throw new Error('Snapshot id is required');
  }

  notes[index] = normalizeNote({ ...current, history }, current.index);
  await saveNotes(env, notes);
  return notes[index];
}

async function recordUsage(env, id, body = {}) {
  const notes = await loadNotes(env);
  const index = notes.findIndex((note) => note.id === id);
  if (index < 0) throw new Error('Note not found');

  const current = notes[index];
  const stats = {
    opens: Math.max(0, Number((current.stats && current.stats.opens) || 0)),
    copies: Math.max(0, Number((current.stats && current.stats.copies) || 0)),
    lastOpenedAt: String((current.stats && current.stats.lastOpenedAt) || ''),
    lastCopiedAt: String((current.stats && current.stats.lastCopiedAt) || ''),
  };
  const action = String(body.action || body.event || '').trim().toLowerCase();
  const now = new Date().toISOString();

  if (action === 'open' || action === 'view') {
    stats.opens += 1;
    stats.lastOpenedAt = now;
  } else if (action === 'copy') {
    stats.copies += 1;
    stats.lastCopiedAt = now;
  } else {
    throw new Error('Usage action is required');
  }

  notes[index] = normalizeNote({ ...current, stats }, current.index);
  await saveNotes(env, notes);
  return notes[index];
}

async function deleteNote(env, id) {
  const notes = await loadNotes(env);
  const filtered = notes.filter((note) => note.id !== id);
  if (filtered.length === notes.length) throw new Error('Note not found');
  const renumbered = sortByIndex(filtered).map((note, index) => ({ ...note, index: index + 1 }));
  await saveNotes(env, renumbered);
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/favicon.ico') return new Response('', { status: 204 });
    if (pathname === '/') return response(publicShell());

    if (pathname === '/app.js') {
      return new Response(publicAppJs, {
        headers: {
          'content-type': 'text/javascript; charset=UTF-8',
          'cache-control': 'no-store',
        },
      });
    }

    if (pathname === '/api/notes' && request.method === 'GET') {
      const notes = sortByIndex(await loadNotes(env));
      return json({ notes: isAuthed(request) ? notes : notes.filter((note) => !note.hidden) });
    }

    if (pathname === '/manage/export.json' && request.method === 'GET') {
      if (!isAuthed(request)) return response(manageLoginShell(), 401);
      return json(backupPayload(sortByIndex(await loadNotes(env))), 200, {
        'content-disposition': 'attachment; filename=\"my-notes-backup.json\"',
      });
    }

    if (pathname === '/manage/export.html' && request.method === 'GET') {
      if (!isAuthed(request)) return response(manageLoginShell(), 401);
      return exportHtmlAttachment(sortByIndex(await loadNotes(env)).filter((note) => !note.hidden));
    }

    if (pathname === '/manage/export.html' && request.method === 'POST') {
      if (!isAuthed(request)) return response(manageLoginShell(), 401);
      try {
        const body = await parseBody(request);
        return await exportSelectedHtml(env, body.ids);
      } catch (error) {
        return response(error.message || 'Failed to export selected HTML', 400);
      }
    }

    if (pathname === '/manage/import' && request.method === 'POST') {
      if (!isAuthed(request)) return json({ error: 'Unauthorized' }, 401);
      try {
        const normalized = await replaceAllNotes(env, await parseBackupPayload(request));
        return json({ ok: true, notes: normalized });
      } catch (error) {
        return json({ error: error.message || 'Failed to import backup' }, 400);
      }
    }

    if (pathname === '/manage' && request.method === 'GET') {
      return isAuthed(request) ? response(manageShell()) : response(manageLoginShell());
    }

    if (pathname === '/manage/login' && request.method === 'POST') {
      const body = await parseBody(request);
      if (String(body.passphrase || '') !== ADMIN_PASSWORD) return response(manageLoginShell('Wrong passphrase'), 401);
      return response('', 302, { ...authHeaders(AUTH_TOKEN), Location: '/manage' });
    }

    if (pathname === '/api/logout' && request.method === 'POST') return json({ ok: true }, 200, clearAuthHeaders());

    if (!isAuthed(request) && pathname.startsWith('/api/') && request.method !== 'GET' && !pathname.endsWith('/usage')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (pathname === '/api/notes' && request.method === 'POST') {
      try {
        return json({ note: await createNote(env, await parseBody(request)) }, 201);
      } catch (error) {
        return json({ error: error.message || 'Failed to create note' }, 400);
      }
    }

    if (pathname === '/api/notes/restore' && request.method === 'POST') {
      try {
        return json({ note: await restoreNote(env, await parseBody(request)) });
      } catch (error) {
        return json({ error: error.message || 'Failed to restore note' }, 400);
      }
    }

    if (pathname.startsWith('/api/notes/') && pathname.endsWith('/usage') && request.method === 'POST') {
      try {
        const id = decodeURIComponent(pathname.split('/')[3]);
        return json({ note: await recordUsage(env, id, await parseBody(request)) });
      } catch (error) {
        return json({ error: error.message || 'Failed to record usage' }, 400);
      }
    }

    if (pathname.startsWith('/api/notes/') && pathname.endsWith('/history') && request.method === 'POST') {
      try {
        const id = decodeURIComponent(pathname.split('/')[3]);
        return json({ note: await deleteHistory(env, id, await parseBody(request)) });
      } catch (error) {
        return json({ error: error.message || 'Failed to update history' }, 400);
      }
    }

    if (pathname.startsWith('/api/notes/') && request.method === 'PUT') {
      try {
        const id = decodeURIComponent(pathname.split('/').pop());
        return json({ note: await updateNote(env, id, await parseBody(request)) });
      } catch (error) {
        return json({ error: error.message || 'Failed to update note' }, 400);
      }
    }

    if (pathname.startsWith('/api/notes/') && request.method === 'DELETE') {
      try {
        const id = decodeURIComponent(pathname.split('/').pop());
        await deleteNote(env, id);
        return json({ ok: true });
      } catch (error) {
        return json({ error: error.message || 'Failed to delete note' }, 400);
      }
    }

    if (pathname === '/manage.js') {
      return new Response(manageAppJs, {
        headers: {
          'content-type': 'text/javascript; charset=UTF-8',
          'cache-control': 'no-store',
        },
      });
    }

    if (pathname === '/manage' && request.method === 'GET' && isAuthed(request)) return response(manageShell());
    return notFound();
  },
};
