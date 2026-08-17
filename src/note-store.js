import { notes as seedNotes } from './notes.js';
import { normalizeNotes } from './note-model.js';

const STORAGE_KEY = 'notes-v3';

let cachedSeedNotes = null;

async function getSeedNotes() {
  if (cachedSeedNotes) return cachedSeedNotes;
  cachedSeedNotes = normalizeNotes(seedNotes);
  return cachedSeedNotes;
}

export async function bootstrapNotes(env) {
  if (!env.NOTES) return;
  const shouldSeed = String(env.SEED_DEFAULT_NOTES || '').toLowerCase() === 'true';
  if (!shouldSeed) return;

  const existing = await env.NOTES.get(STORAGE_KEY);
  if (existing) return;

  const markerKey = `${STORAGE_KEY}:seeded`;
  const seededMarker = await env.NOTES.get(markerKey);
  if (seededMarker) return;

  const notes = await getSeedNotes();
  await env.NOTES.put(STORAGE_KEY, JSON.stringify({ version: 1, notes }));
  await env.NOTES.put(markerKey, new Date().toISOString());
}

export async function loadNotes(env) {
  if (!env.NOTES) return [];
  let raw = await env.NOTES.get(STORAGE_KEY);
  if (!raw) {
    await bootstrapNotes(env);
    raw = await env.NOTES.get(STORAGE_KEY);
    if (!raw) return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed.notes)
      ? parsed.notes
      : Array.isArray(parsed) ? parsed : [];
    return normalizeNotes(list);
  } catch {
    return [];
  }
}

export async function saveNotes(env, notes) {
  const normalized = normalizeNotes(notes);
  if (env.NOTES) {
    await env.NOTES.put(STORAGE_KEY, JSON.stringify({ version: 1, notes: normalized }));
  }
  return normalized;
}
