import { style } from './style.js';
import { publicAppJs } from './public-app.js';
import { manageAppJs } from './manage-app.js';
import { manageExportAppJs } from './manage-export.js';
import { uiPolishJs } from './ui-polish.js';
import { managePatchJs } from './manage-patch.js';
import { APP_VERSION } from './version.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function publicShell(embedNotes = null) {
  const embedded = Array.isArray(embedNotes) ? `
  <script>window.__EMBEDDED_NOTES__ = ${safeScriptJson(embedNotes)};</script>` : '';
  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <link rel="icon" href="data:,">
  <title>My Notes</title>
  <style>${style}</style>
</head>
<body>
  <main>
    <section class="topBar" dir="ltr">
      <input id="searchBox" type="search" placeholder="Search notes, tickets, text..." autocomplete="off" spellcheck="false">
      <select id="statusFilter" aria-label="Filter cards">
        <option value="all">All</option>
        <option value="active">Active only</option>
        <option value="done">Done only</option>
      </select>
      <span class="meta pageVersion">v${APP_VERSION}</span>
      <span class="meta" id="cardCount">Loading...</span>
    </section>
    <section id="notes" class="container" aria-live="polite" dir="auto"></section>
  </main>
  <div id="toast" style="visibility:hidden; opacity:0;"></div>${embedded}
  <script type="module">${publicAppJs}</script>
  <script type="module">${uiPolishJs}</script>
</body>
</html>`;
}

export function manageLoginShell(message = '') {
  const error = message
    ? `<p class="manageHint" style="color:#ffb4b4">${escapeHtml(message)}</p>`
    : '';
  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <link rel="icon" href="data:,">
  <title>Access</title>
  <style>${style}</style>
</head>
<body>
  <main class="authWrap" dir="ltr">
    <section class="authCard" dir="ltr">
      <h1>Access</h1>
      <form class="authForm" method="post" action="/manage/login">
        <input name="passphrase" type="password" placeholder="Passphrase" autocomplete="current-password" required>
        <button type="submit">Enter</button>
      </form>
      ${error}
    </section>
  </main>
</body>
</html>`;
}

export function manageShell() {
  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <link rel="icon" href="data:,">
  <title>Manage</title>
  <style>${style}</style>
</head>
<body>
  <main>
    <div class="pageVersion manageVersion">v${APP_VERSION}</div>
    <div id="app" dir="ltr"></div>
  </main>
  <div id="toast" style="visibility:hidden; opacity:0;"></div>
  <script type="module">${manageAppJs}</script>
  <script type="module">${manageExportAppJs}</script>
  <script type="module">${uiPolishJs}</script>
  <script type="module">${managePatchJs}</script>
</body>
</html>`;
}
