// ============================================================
// Host logic. The host page is the referee: it creates the room,
// advances the game state, tallies scores. Player devices only
// write their own answers. Everything syncs through rooms/{CODE}.
// ============================================================

import {
  db, roomRef, ref, set, get, update, onValue, remove, warnIfUnconfigured,
} from "./firebase.js";
import { QUESTIONS } from "./questions.js";
import {
  avatarDataURI, randomCode, scoreGuess, SPOTLIGHT_BONUS_PER_HIT, escapeHTML,
} from "./util.js";
import { sfx, setMuted, isMuted, unlockAudio } from "./sounds.js";

if (warnIfUnconfigured()) throw new Error("Firebase not configured");

const $ = (id) => document.getElementById(id);
const views = ["lobby", "answering", "guessing", "reveal", "final"];

let CODE = null;
let room = null;          // latest room snapshot
let busy = false;         // guards state transitions
let prevState = null;     // for sound cues
let prevPlayerCount = 0;

// ---------- boot: resume an existing room or create a new one ----------
(async function boot() {
  const urlCode = new URLSearchParams(location.search).get("code");
  const saved = sessionStorage.getItem("dykm_host_code");
  const candidate = (urlCode || saved || "").toUpperCase();

  if (candidate) {
    const snap = await get(roomRef(candidate));
    if (snap.exists()) { CODE = candidate; }
  }
  if (!CODE) {
    for (let i = 0; i < 20 && !CODE; i++) {
      const c = randomCode();
      const snap = await get(roomRef(c));
      if (!snap.exists()) CODE = c;
    }
    await set(roomRef(CODE), {
      state: "lobby",
      createdAt: Date.now(),
      round: 0,
    });
  }
  sessionStorage.setItem("dykm_host_code", CODE);
  history.replaceState(null, "", `host.html?code=${CODE}`);

  $("roomCode").textContent = CODE;
  $("joinURL").textContent = location.origin + location.pathname.replace(/host\.html$/, "");

  onValue(roomRef(CODE), (snap) => {
    room = snap.val();
    if (!room) return;
    soundCues();
    render();
    referee();
  });
})();

// ---------- helpers ----------
function players() {
  const raw = room?.players || {};
  const clean = {};
  for (const [id, p] of Object.entries(raw)) if (p && p.name) clean[id] = p;
  return clean;
}
function playerIds() { return Object.keys(players()); }
function connectedIds() { return playerIds().filter((id) => players()[id].connected); }
function spotlight() { return players()[room.spotlight]; }
function question() { return QUESTIONS[room.qIndex]; }
function totalRounds() { return room.settings?.rounds ?? room.order?.length ?? 0; }
function pointsGoal() { return room.settings?.goal ?? Infinity; }
function goalReached() {
  return playerIds().some((id) => (players()[id].score ?? 0) >= pointsGoal());
}
function gameOverNext() { return room.round >= totalRounds() || goalReached(); }

function showView(name) {
  views.forEach((v) => $(`view-${v}`).classList.toggle("hidden", v !== name));
}

function chipHTML(p, withScore = true, kickId = null) {
  return `<div class="chip ${p.connected ? "" : "chip--offline"}">
    <img class="avatar" src="${avatarDataURI(p.color, p.face)}" alt="" />
    <span>${escapeHTML(p.name)}</span>
    ${withScore ? `<span class="pts">${p.score ?? 0}</span>` : ""}
    ${kickId ? `<button class="kick" data-pid="${kickId}" title="Remove ${escapeHTML(p.name)}" aria-label="Remove ${escapeHTML(p.name)}">✕</button>` : ""}
  </div>`;
}

function scoreboardHTML() {
  return playerIds().map((id) => chipHTML(players()[id])).join("");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickQuestion(used) {
  const unused = QUESTIONS.map((_, i) => i).filter((i) => !used.includes(i));
  const pool = unused.length ? unused : QUESTIONS.map((_, i) => i);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- sound cues on state changes ----------
function soundCues() {
  const st = room.state;
  const count = playerIds().length;
  if (st === "lobby" && count > prevPlayerCount && prevState === "lobby") sfx.join();
  prevPlayerCount = count;
  if (st !== prevState) {
    if (st === "answering") sfx.start();
    if (st === "guessing") sfx.tick();
    if (st === "reveal") sfx.reveal();
    if (st === "final") sfx.fanfare();
    prevState = st;
  }
}

// ---------- rendering ----------
function render() {
  const st = room.state;
  showView(st === "final" ? "final" : st);

  if (st === "lobby") {
    const ids = playerIds();
    $("playerCount").textContent = ids.length ? `(${ids.length}/10)` : "";
    $("lobbyPlayers").innerHTML = ids.length
      ? ids.map((id) => chipHTML(players()[id], false, id)).join("")
      : `<p class="center" style="color:var(--ink-soft);font-weight:800;">No one yet — send everyone the code!</p>`;
    const enough = connectedIds().length >= 2;
    $("startBtn").disabled = !enough;
    $("startBtn").textContent = enough ? "Start the game!" : "Waiting for players…";
  }

  if (st === "answering" && spotlight()) {
    $("roundPillA").textContent = `Round ${room.round} of ${totalRounds()} · first to ${pointsGoal()} wins`;
    $("spotlightIntroA").innerHTML =
      `<img class="avatar avatar--big" src="${avatarDataURI(spotlight().color, spotlight().face)}" alt="" />
       <div class="display" style="font-size:1.3rem;">${escapeHTML(spotlight().name)} is in the spotlight!</div>`;
    $("questionA").textContent = question().q;
    $("leftA").textContent = question().left;
    $("rightA").textContent = question().right;
    $("answerWait").innerHTML =
      `${escapeHTML(spotlight().name)} is answering secretly on their device<span class="wait-dots"></span>`;
    $("scoreboardA").innerHTML = scoreboardHTML();
  }

  if (st === "guessing" && spotlight()) {
    $("roundPillG").textContent = `Round ${room.round} of ${totalRounds()}`;
    $("questionG").textContent = `How well do you know ${spotlight().name}? ${question().q}`;
    $("leftG").textContent = question().left;
    $("rightG").textContent = question().right;
    const guessers = connectedIds().filter((id) => id !== room.spotlight);
    const got = Object.keys(room.answers?.guesses || {}).filter((id) => guessers.includes(id));
    $("guessProgress").innerHTML =
      `${got.length} of ${guessers.length} guesses in<span class="wait-dots"></span>`;
    $("scoreboardG").innerHTML = scoreboardHTML();
  }

  if (st === "reveal" && room.lastResult) renderReveal();

  if (st === "final") renderStandings("finalStandings");
}

function renderReveal() {
  const r = room.lastResult;
  const q = QUESTIONS[r.qIndex];
  $("roundPillR").textContent = `Round ${r.round} of ${totalRounds()} — the truth!`;
  $("questionR").textContent = q.q;
  $("leftR").textContent = q.left;
  $("rightR").textContent = q.right;

  const sp = $("revealSpectrum");
  sp.innerHTML = "";
  Object.entries(r.guesses || {}).forEach(([id, g]) => {
    const p = players()[id];
    if (!p) return;
    sp.insertAdjacentHTML("beforeend",
      `<img class="token" style="left:${g.value * 100}%" src="${avatarDataURI(p.color, p.face)}"
            alt="${escapeHTML(p.name)}" title="${escapeHTML(p.name)}" />`);
  });
  const spPlayer = players()[r.spotlight];
  const spName = spPlayer?.name || "?";
  sp.insertAdjacentHTML("beforeend",
    `<span class="token token--answer" style="left:${r.answer * 100}%">
       <img class="avatar" style="width:100%;height:100%;" src="${avatarDataURI(spPlayer?.color ?? 0, spPlayer?.face ?? 0)}" alt="" />
       <span class="token-tag">${escapeHTML(spName)}'s answer</span>
     </span>`);

  const rows = Object.entries(r.guesses || {})
    .sort((a, b) => b[1].points - a[1].points)
    .map(([id, g]) => {
      const p = players()[id];
      if (!p) return "";
      return `<div class="result-row">
        <img class="avatar" src="${avatarDataURI(p.color, p.face)}" alt="" />
        <span class="name">${escapeHTML(p.name)}</span>
        <span class="earn ${g.points >= 75 ? "earn--hit" : g.points === 0 ? "earn--0" : ""}">+${g.points}</span>
      </div>`;
    }).join("");
  const bonusRow = `<div class="result-row">
      <img class="avatar" src="${avatarDataURI(spPlayer?.color ?? 0, spPlayer?.face ?? 0)}" alt="" />
      <span class="name">${escapeHTML(spName)} — friends who really know them</span>
      <span class="earn ${r.spotlightBonus ? "earn--hit" : "earn--0"}">+${r.spotlightBonus}</span>
    </div>`;
  $("revealResults").innerHTML = rows + bonusRow +
    `<h3 class="mt center">Standings · first to ${pointsGoal()} wins</h3><div id="revealStandings"></div>`;
  renderStandings("revealStandings");

  $("nextRoundBtn").textContent = gameOverNext() ? "See final results" : "Next round";
}

function renderStandings(containerId) {
  const goal = pointsGoal();
  const ranked = playerIds()
    .map((id) => players()[id])
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  $(containerId).innerHTML = ranked.map((p, i) => `
    <div class="standing ${i === 0 ? "standing--first" : ""}">
      <span class="rank">${i + 1}</span>
      <img class="avatar" src="${avatarDataURI(p.color, p.face)}" alt="" />
      <span>${escapeHTML(p.name)}${(p.score ?? 0) >= goal ? " 🎯" : ""}</span>
      <span class="score">${p.score ?? 0}</span>
    </div>`).join("");
}

// ---------- referee: automatic transitions ----------
async function referee() {
  if (busy) return;

  // spotlight player left mid-round — move on without them
  if ((room.state === "answering" || room.state === "guessing") && !players()[room.spotlight]) {
    busy = true;
    try {
      if (room.round >= totalRounds() || connectedIds().length < 2) {
        await update(roomRef(CODE), { state: playerIds().length ? "final" : "lobby" });
      } else {
        await startRound(room.round + 1, room.order, room.usedQ || []);
      }
    } finally { busy = false; }
    return;
  }

  if (room.state === "answering" && room.answers?.spotlight != null) {
    busy = true;
    await update(roomRef(CODE), { state: "guessing" });
    busy = false;
    return;
  }

  if (room.state === "guessing") {
    const guessers = connectedIds().filter((id) => id !== room.spotlight);
    const got = Object.keys(room.answers?.guesses || {});
    if (guessers.length > 0 && guessers.every((id) => got.includes(id))) {
      await doReveal();
    }
  }
}

async function doReveal() {
  if (busy || room.state !== "guessing") return;
  busy = true;
  try {
    const answer = room.answers?.spotlight;
    if (answer == null) return;
    const rawGuesses = room.answers?.guesses || {};
    const guesses = {};
    let hits = 0;
    const updates = {};

    for (const [id, value] of Object.entries(rawGuesses)) {
      if (id === room.spotlight || !players()[id]) continue;
      const points = scoreGuess(Math.abs(value - answer));
      guesses[id] = { value, points };
      if (points >= 75) hits++;
      updates[`players/${id}/score`] = (players()[id].score ?? 0) + points;
    }
    const spotlightBonus = hits * SPOTLIGHT_BONUS_PER_HIT;
    updates[`players/${room.spotlight}/score`] =
      (players()[room.spotlight].score ?? 0) + spotlightBonus;

    updates["lastResult"] = {
      round: room.round, qIndex: room.qIndex, spotlight: room.spotlight,
      answer, guesses, spotlightBonus,
    };
    updates["state"] = "reveal";
    await update(roomRef(CODE), updates);
  } finally {
    busy = false;
  }
}

// ---------- round control ----------
// Spotlight cycles through the shuffled order, repeating if rounds > players
async function startRound(round, order, usedQ) {
  // pick the next spotlight, skipping anyone who has left the room
  let spot = null;
  for (let i = 0; i < order.length; i++) {
    const cand = order[(round - 1 + i) % order.length];
    if (players()[cand]) { spot = cand; break; }
  }
  if (!spot) { await update(roomRef(CODE), { state: "lobby", round: 0 }); return; }
  const qIndex = pickQuestion(usedQ);
  await update(roomRef(CODE), {
    state: "answering",
    round,
    order,
    spotlight: spot,
    qIndex,
    usedQ: [...usedQ, qIndex],
    answers: null,
  });
}

// settings sliders
const roundsSlider = $("roundsSlider");
const goalSlider = $("goalSlider");
roundsSlider.addEventListener("input", () => { $("roundsOut").textContent = roundsSlider.value; });
goalSlider.addEventListener("input", () => { $("goalOut").textContent = goalSlider.value; });

$("startBtn").addEventListener("click", async () => {
  unlockAudio();
  const order = shuffle(connectedIds());
  await update(roomRef(CODE), {
    settings: { rounds: Number(roundsSlider.value), goal: Number(goalSlider.value) },
  });
  await startRound(1, order, room.usedQ || []);
});

$("nextRoundBtn").addEventListener("click", async () => {
  if (gameOverNext()) {
    await update(roomRef(CODE), { state: "final" });
  } else {
    await startRound(room.round + 1, room.order, room.usedQ || []);
  }
});

$("skipSpotlightBtn").addEventListener("click", async () => {
  if (room.round >= totalRounds()) {
    await update(roomRef(CODE), { state: "final" });
  } else {
    await startRound(room.round + 1, room.order, room.usedQ || []);
  }
});

$("revealNowBtn").addEventListener("click", doReveal);

$("playAgainBtn").addEventListener("click", async () => {
  const updates = { state: "lobby", round: 0, answers: null, lastResult: null };
  playerIds().forEach((id) => { updates[`players/${id}/score`] = 0; });
  await update(roomRef(CODE), updates);
});

// kick a player from the lobby
$("lobbyPlayers").addEventListener("click", async (e) => {
  const b = e.target.closest(".kick");
  if (!b) return;
  await remove(roomRef(CODE, `players/${b.dataset.pid}`));
});

// host joins the game as a player in a second tab
$("hostJoinBtn").addEventListener("click", () => {
  unlockAudio();
  window.open(`index.html?code=${CODE}`, "_blank");
});

// home button: warn if a game is running (the room stays alive; this tab can
// rejoin it this session via Host a game, or any time via host.html?code=XXXX)
$("hostHomeBtn").addEventListener("click", (e) => {
  const inGame = room && room.state !== "lobby" && room.state !== "final";
  if (inGame && !confirm("Go home? The game will pause until you reopen this room (host.html?code=" + CODE + ").")) {
    e.preventDefault();
  }
});

// mute toggle
$("muteBtn").addEventListener("click", () => {
  setMuted(!isMuted());
  $("muteBtn").textContent = isMuted() ? "🔇" : "🔊";
  if (!isMuted()) { unlockAudio(); sfx.ding(); }
});
