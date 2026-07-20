// ============================================================
// Shared helpers: avatar characters, room codes, scoring.
// ============================================================

// 10 player colors — bright and distinguishable
export const PLAYER_COLORS = [
  "#ff5d73", "#ffc53d", "#2dd4bf", "#8b7cf6", "#f97316",
  "#22c55e", "#38bdf8", "#f472b6", "#a3e635", "#c084fc",
];

const INK = "#221c53";

// ---- 24 characters. Each is the inner SVG drawn on the colored circle. ----
const eyesDots = `<circle cx="23" cy="27" r="4.5" fill="${INK}"/><circle cx="41" cy="27" r="4.5" fill="${INK}"/>`;
const smile = `<path d="M22 40 q10 9 20 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;

export const FACES = [
  { name: "Classic", svg: eyesDots + smile },
  { name: "Beaming", svg: `<path d="M18 27 q5 -6 10 0 M36 27 q5 -6 10 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M21 38 q11 12 22 0" stroke="${INK}" stroke-width="4" fill="${INK}" stroke-linecap="round"/>` },
  { name: "Wink", svg: `<circle cx="23" cy="27" r="4.5" fill="${INK}"/><path d="M36 27 h10" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` + smile },
  { name: "Cool", svg: `<rect x="14" y="22" width="16" height="11" rx="4" fill="${INK}"/><rect x="34" y="22" width="16" height="11" rx="4" fill="${INK}"/><path d="M30 25 h4 M10 24 h6 M48 24 h6" stroke="${INK}" stroke-width="3"/><path d="M24 42 q8 6 16 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { name: "Cat", svg: `<path d="M12 16 L16 4 L26 12 Z M52 16 L48 4 L38 12 Z" fill="${INK}"/>` + eyesDots + `<path d="M29 38 l3 3 l3 -3" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M6 32 L18 34 M6 40 L18 38 M58 32 L46 34 M58 40 L46 38" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>` },
  { name: "Robot", svg: `<rect x="17" y="21" width="11" height="11" rx="2" fill="${INK}"/><rect x="36" y="21" width="11" height="11" rx="2" fill="${INK}"/><rect x="24" y="40" width="16" height="5" rx="2" fill="${INK}"/><path d="M32 10 V2" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="2" r="3" fill="${INK}"/>` },
  { name: "Alien", svg: `<ellipse cx="23" cy="28" rx="6" ry="9" fill="${INK}"/><ellipse cx="41" cy="28" rx="6" ry="9" fill="${INK}"/><path d="M28 44 h8" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` },
  { name: "Sleepy", svg: `<path d="M18 28 q5 4 10 0 M36 28 q5 4 10 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="32" cy="42" r="4" fill="${INK}"/><path d="M46 10 h8 l-8 7 h8" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>` },
  { name: "Whoa", svg: eyesDots + `<circle cx="32" cy="42" r="6" fill="${INK}"/>` },
  { name: "LOL", svg: `<path d="M18 25 l10 4 M46 25 l-10 4" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M20 37 q12 16 24 0 Z" fill="${INK}"/>` },
  { name: "Fancy", svg: eyesDots + `<path d="M20 38 q6 -5 12 0 q6 5 12 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { name: "Professor", svg: `<circle cx="23" cy="27" r="8" fill="none" stroke="${INK}" stroke-width="3"/><circle cx="41" cy="27" r="8" fill="none" stroke="${INK}" stroke-width="3"/><path d="M31 27 h2 M10 25 h5 M49 25 h5" stroke="${INK}" stroke-width="3"/><circle cx="23" cy="27" r="2.5" fill="${INK}"/><circle cx="41" cy="27" r="2.5" fill="${INK}"/><path d="M25 43 q7 5 14 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { name: "Starstruck", svg: `<path d="M23 20 l2.2 5 5.3 .5 -4 3.6 1.2 5.2 -4.7 -2.8 -4.7 2.8 1.2 -5.2 -4 -3.6 5.3 -.5 Z" fill="${INK}"/><path d="M41 20 l2.2 5 5.3 .5 -4 3.6 1.2 5.2 -4.7 -2.8 -4.7 2.8 1.2 -5.2 -4 -3.6 5.3 -.5 Z" fill="${INK}"/><path d="M24 41 q8 7 16 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { name: "Smitten", svg: `<path d="M23 22 q-6 -6 -8 0 q-1 4 8 9 q9 -5 8 -9 q-2 -6 -8 0 Z" fill="${INK}"/><path d="M41 22 q-6 -6 -8 0 q-1 4 8 9 q9 -5 8 -9 q-2 -6 -8 0 Z" fill="${INK}"/><path d="M25 42 q7 5 14 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { name: "Bleh", svg: eyesDots + `<path d="M22 38 h20" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><rect x="29" y="38" width="10" height="12" rx="5" fill="${INK}"/>` },
  { name: "Grump", svg: `<path d="M16 20 l12 5 M48 20 l-12 5" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="30" r="3.5" fill="${INK}"/><circle cx="40" cy="30" r="3.5" fill="${INK}"/><path d="M24 44 q8 -6 16 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { name: "Nervous", svg: eyesDots + `<path d="M22 41 q3 -4 5 0 q3 4 5 0 q3 -4 5 0 q3 4 5 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` },
  { name: "Royalty", svg: `<path d="M16 14 L21 4 L27 11 L32 2 L37 11 L43 4 L48 14 Z" fill="${INK}"/>` + eyesDots.replaceAll("27", "30") + `<path d="M24 42 q8 6 16 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { name: "DJ", svg: `<path d="M12 30 q0 -20 20 -20 q20 0 20 20" stroke="${INK}" stroke-width="5" fill="none"/><rect x="7" y="26" width="9" height="14" rx="4" fill="${INK}"/><rect x="48" y="26" width="9" height="14" rx="4" fill="${INK}"/>` + eyesDots.replaceAll("27", "32") + `<path d="M26 44 q6 4 12 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { name: "Pirate", svg: `<circle cx="23" cy="27" r="4.5" fill="${INK}"/><rect x="33" y="20" width="15" height="13" rx="3" fill="${INK}"/><path d="M14 18 L52 26" stroke="${INK}" stroke-width="3"/><path d="M24 42 q8 5 16 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { name: "Shy", svg: eyesDots + `<circle cx="16" cy="36" r="4" fill="${INK}" opacity="0.35"/><circle cx="48" cy="36" r="4" fill="${INK}" opacity="0.35"/><path d="M27 42 q5 3 10 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { name: "Spooky", svg: eyesDots + `<path d="M23 38 q9 8 18 0 l-3 0 -2 5 -2 -5 -4 0 -2 5 -2 -5 Z" fill="${INK}"/>` },
  { name: "Mustache", svg: eyesDots + `<path d="M32 36 q-4 -4 -10 -1 q-3 6 8 4 q2 -1 2 -3 q0 2 2 3 q11 2 8 -4 q-6 -3 -10 1 Z" fill="${INK}"/>` },
  { name: "Party", svg: `<path d="M22 14 L32 -2 L42 14 Z" fill="${INK}"/><circle cx="32" cy="-1" r="3" fill="${INK}"/>` + eyesDots.replaceAll("27", "29") + `<path d="M20 38 q12 12 24 0 Z" fill="${INK}"/>` },
];

// A tinted round face. Original art, no Miis harmed.
export function avatarSVG(colorIdx, faceIdx = 0) {
  const c = PLAYER_COLORS[(colorIdx ?? 0) % PLAYER_COLORS.length];
  const face = FACES[(faceIdx ?? 0) % FACES.length];
  return `
  <svg viewBox="-2 -4 68 70" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <circle cx="32" cy="32" r="29" fill="${c}" stroke="${INK}" stroke-width="4"/>
    ${face.svg}
  </svg>`;
}

export function avatarDataURI(colorIdx, faceIdx = 0) {
  return "data:image/svg+xml," + encodeURIComponent(avatarSVG(colorIdx, faceIdx).trim());
}

// 4-letter room code (no confusing letters)
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ";
export function randomCode() {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// Points for a guess, by distance from the real answer (both 0–1)
export function scoreGuess(diff) {
  if (diff <= 0.05) return 100;
  if (diff <= 0.12) return 75;
  if (diff <= 0.22) return 50;
  if (diff <= 0.35) return 25;
  return 0;
}

export const SPOTLIGHT_BONUS_PER_HIT = 25; // per guess scoring 75+

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
}


// ============================================================
// Shared result-screen builders (used by host AND player pages
// so everyone sees the same reveal).
// ============================================================

export function revealSpectrumHTML(result, playersMap) {
  let html = "";
  for (const [id, g] of Object.entries(result.guesses || {})) {
    const p = playersMap?.[id];
    if (!p || !p.name) continue;
    html += `<img class="token" style="left:${g.value * 100}%" src="${avatarDataURI(p.color, p.face)}"
      alt="${escapeHTML(p.name)}" title="${escapeHTML(p.name)}" />`;
  }
  const sp = playersMap?.[result.spotlight];
  html += `<span class="token token--answer" style="left:${result.answer * 100}%">
      <img class="avatar" style="width:100%;height:100%;" src="${avatarDataURI(sp?.color ?? 0, sp?.face ?? 0)}" alt="" />
      <span class="token-tag">${escapeHTML(sp?.name || "?")}'s answer</span>
    </span>`;
  return html;
}

export function resultRowsHTML(result, playersMap, highlightPid = null) {
  const rows = Object.entries(result.guesses || {})
    .sort((a, b) => b[1].points - a[1].points)
    .map(([id, g]) => {
      const p = playersMap?.[id];
      if (!p || !p.name) return "";
      return `<div class="result-row ${id === highlightPid ? "result-row--me" : ""}">
        <img class="avatar" src="${avatarDataURI(p.color, p.face)}" alt="" />
        <span class="name">${escapeHTML(p.name)}${id === highlightPid ? " (you)" : ""}</span>
        <span class="earn ${g.points >= 75 ? "earn--hit" : g.points === 0 ? "earn--0" : ""}">+${g.points}</span>
      </div>`;
    }).join("");
  const sp = playersMap?.[result.spotlight];
  const bonusRow = `<div class="result-row ${result.spotlight === highlightPid ? "result-row--me" : ""}">
      <img class="avatar" src="${avatarDataURI(sp?.color ?? 0, sp?.face ?? 0)}" alt="" />
      <span class="name">${escapeHTML(sp?.name || "?")}${result.spotlight === highlightPid ? " (you)" : ""} — friends who really know them</span>
      <span class="earn ${result.spotlightBonus ? "earn--hit" : "earn--0"}">+${result.spotlightBonus}</span>
    </div>`;
  return rows + bonusRow;
}

export function standingsHTML(playersMap, goal = Infinity, highlightPid = null) {
  const entries = Object.entries(playersMap || {}).filter(([, p]) => p && p.name);
  const ranked = entries.sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0));
  return ranked.map(([id, p], i) => `
    <div class="standing ${i === 0 ? "standing--first" : ""} ${id === highlightPid ? "standing--me" : ""}">
      <span class="rank">${i + 1}</span>
      <img class="avatar" src="${avatarDataURI(p.color, p.face)}" alt="" />
      <span>${escapeHTML(p.name)}${id === highlightPid ? " (you)" : ""}${(p.score ?? 0) >= goal ? " 🎯" : ""}</span>
      <span class="score">${p.score ?? 0}</span>
    </div>`).join("");
}
