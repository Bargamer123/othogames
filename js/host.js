// ============================================================
// Host logic. The host is BOTH the referee (advances state,
// tallies scores) AND a player (has a name, character, plays
// inline). Everything syncs through rooms/{CODE}.
// ============================================================

import {
  db, roomRef, ref, set, get, update, onValue, onDisconnect, remove, warnIfUnconfigured,
} from "./firebase.js";
import { QUESTIONS } from "./questions.js";
import {
  avatarDataURI, PLAYER_COLORS, FACES, randomCode, scoreGuess,
  SPOTLIGHT_BONUS_PER_HIT, escapeHTML,
  revealSpectrumHTML, resultRowsHTML, standingsHTML,
} from "./util.js";
import { sfx, setMuted, isMuted, unlockAudio } from "./sounds.js";

if (warnIfUnconfigured()) throw new Error("Firebase not configured");

const $ = (id) => document.getElementById(id);
const views = ["setup", "lobby", "answering", "guessing", "reveal", "final"];

let CODE = null;
let PID = null;           // the host is also a player
let room = null;
let busy = false;
let prevState = null;
let prevPlayerCount = 0;
let lockedRound = -1;     // which round the host has already answered/guessed
let selectedFace = Math.floor(Math.random() * FACES.length);

function showView(name) {
  views.forEach((v) => $(`view-${v}`).classList.toggle("hidden", v !== name));
}

// ---------- boot ----------
(async function boot() {
  const urlCode = new URLSearchParams(location.search).get("code");
  const savedCode = sessionStorage.getItem("dykm_host_code");
  const savedPid = sessionStorage.getItem("dykm_host_pid");
  const candidate = (urlCode || savedCode || "").toUpperCase();

  // resuming an existing hosted room in the same session
  if (candidate && savedPid) {
    const snap = await get(roomRef(candidate));
    if (snap.exists() && snap.val().players?.[savedPid]) {
      CODE = candidate; PID = savedPid;
      await update(roomRef(CODE, `players/${PID}`), { connected: true });
      afterJoin();
      return;
    }
  }

  // otherwise show setup (pick name + character) and wait for "Create the room"
  buildIconPicker();
  showView("setup");
})();

function buildIconPicker() {
  const grid = $("hostIconGrid");
  grid.innerHTML = "";
  FACES.forEach((f, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn";
    b.title = f.name;
    b.setAttribute("aria-label", f.name);
    b.innerHTML = `<img src="${avatarDataURI(i % 10, i)}" alt="" />`;
    b.addEventListener("click", () => {
      selectedFace = i;
      grid.querySelectorAll(".icon-btn").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
    });
    grid.appendChild(b);
  });
  grid.children[selectedFace].classList.add("selected");
}

$("createBtn").addEventListener("click", async () => {
  unlockAudio();
  const name = ($("hostName").value.trim() || "Host").slice(0, 12);

  // find an unused room code
  for (let i = 0; i < 20 && !CODE; i++) {
    const c = randomCode();
    const snap = await get(roomRef(c));
    if (!snap.exists()) CODE = c;
  }
  if (!CODE) CODE = randomCode();

  PID = "h" + Math.random().toString(36).slice(2, 9);
  await set(roomRef(CODE), { state: "lobby", createdAt: Date.now(), round: 0, host: PID });
  await set(roomRef(CODE, `players/${PID}`), {
    name, color: 0, face: selectedFace, score: 0, connected: true, joinedAt: Date.now(), isHost: true,
  });

  sessionStorage.setItem("dykm_host_code", CODE);
  sessionStorage.setItem("dykm_host_pid", PID);
  afterJoin();
});

function afterJoin() {
  history.replaceState(null, "", `host.html?code=${CODE}`);
  $("roomCode").textContent = CODE;
  $("joinURL").textContent = location.origin + location.pathname.replace(/host\.html$/, "");

  onDisconnect(roomRef(CODE, `players/${PID}/connected`)).set(false);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && PID) {
      update(roomRef(CODE, `players/${PID}`), { connected: true });
    }
  });

  onValue(roomRef(CODE), (snap) => {
    room = snap.val();
    if (!room) return;
    soundCues();
    render();
    referee();
  });
}

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
function goalReached() { return playerIds().some((id) => (players()[id].score ?? 0) >= pointsGoal()); }
function gameOverNext() { return room.round >= totalRounds() || goalReached(); }
function me() { return players()[PID]; }

function chipHTML(p, withScore = true, kickId = null) {
  return `<div class="chip ${p.connected ? "" : "chip--offline"}">
    <img class="avatar" src="${avatarDataURI(p.color, p.face)}" alt="" />
    <span>${escapeHTML(p.name)}${p.isHost ? " 👑" : ""}</span>
    ${withScore ? `<span class="pts">${p.score ?? 0}</span>` : ""}
    ${kickId ? `<button class="kick" data-pid="${kickId}" title="Remove ${escapeHTML(p.name)}" aria-label="Remove ${escapeHTML(p.name)}">✕</button>` : ""}
  </div>`;
}
function scoreboardHTML() { return playerIds().map((id) => chipHTML(players()[id])).join(""); }

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

function personalize(text) {
  const out = text
    .replace(/\bare they\b/gi, "are you").replace(/\bdo they\b/gi, "do you")
    .replace(/\bcould they\b/gi, "could you").replace(/\bwould they\b/gi, "would you")
    .replace(/\bthey like\b/gi, "you like").replace(/\btheir\b/gi, "your")
    .replace(/\bthey\b/gi, "you").replace(/\bthem\b/gi, "you");
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function setThumb(sliderId) {
  const uri = avatarDataURI(me().color, me().face);
  let styleEl = $("thumbStyle");
  if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "thumbStyle"; document.head.appendChild(styleEl); }
  styleEl.textContent =
    `input[type="range"].guess::-webkit-slider-thumb{background-image:url("${uri}");}
     input[type="range"].guess::-moz-range-thumb{background-image:url("${uri}");}`;
}

// ---------- sound cues ----------
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
  if (!PID || !me()) return; // still in setup, or removed
  const st = room.state;
  showView(st === "final" ? "final" : st);

  const isSpot = room.spotlight === PID;

  if (st === "lobby") {
    const ids = playerIds();
    $("playerCount").textContent = ids.length ? `(${ids.length}/10)` : "";
    $("lobbyPlayers").innerHTML = ids.length
      ? ids.map((id) => chipHTML(players()[id], false, id === PID ? null : id)).join("")
      : `<p class="center" style="color:var(--ink-soft);font-weight:800;">Just you so far — send everyone the code!</p>`;
    const enough = connectedIds().length >= 2;
    $("startBtn").disabled = !enough;
    $("startBtn").textContent = enough ? "Start the game!" : "Waiting for players…";
  }

  if (st === "answering" && spotlight()) {
    $("roundPillA").textContent = `Round ${room.round} of ${totalRounds()} · first to ${pointsGoal()} wins`;
    $("spotlightIntroA").innerHTML =
      `<img class="avatar avatar--big" src="${avatarDataURI(spotlight().color, spotlight().face)}" alt="" />
       <div class="display" style="font-size:1.3rem;">${escapeHTML(spotlight().name)}${isSpot ? " (you)" : ""} is in the spotlight!</div>`;
    const answered = room.answers?.spotlight != null;
    // host is the spotlight and hasn't answered → show their slider
    if (isSpot && !answered && lockedRound !== room.round) {
      $("questionA").textContent = personalize(question().q);
      $("hostSliderA").classList.remove("hidden");
      $("hostSpectrumA").classList.add("hidden");
      $("answerWait").textContent = "Answer honestly — everyone will guess where you land!";
      setThumb("sliderA");
    } else {
      $("questionA").textContent = question().q;
      $("hostSliderA").classList.add("hidden");
      $("hostSpectrumA").classList.remove("hidden");
      $("answerWait").innerHTML = isSpot
        ? "Your answer's locked! Now everyone guesses<span class='wait-dots'></span>"
        : `${escapeHTML(spotlight().name)} is answering secretly<span class="wait-dots"></span>`;
    }
    $("leftA").textContent = question().left;
    $("rightA").textContent = question().right;
    $("scoreboardA").innerHTML = scoreboardHTML();
  }

  if (st === "guessing" && spotlight()) {
    $("roundPillG").textContent = `Round ${room.round} of ${totalRounds()}`;
    $("leftG").textContent = question().left;
    $("rightG").textContent = question().right;
    const guessers = connectedIds().filter((id) => id !== room.spotlight);
    const got = Object.keys(room.answers?.guesses || {}).filter((id) => guessers.includes(id));
    const iGuessed = room.answers?.guesses?.[PID] != null || lockedRound === room.round;
    // host guesses too (unless host is the spotlight)
    if (!isSpot && !iGuessed) {
      $("questionG").textContent = `What did ${spotlight().name} say? ${question().q}`;
      $("hostSliderG").classList.remove("hidden");
      $("hostSpectrumG").classList.add("hidden");
      setThumb("sliderG");
    } else {
      $("questionG").textContent = `How well does everyone know ${spotlight().name}? ${question().q}`;
      $("hostSliderG").classList.add("hidden");
      $("hostSpectrumG").classList.remove("hidden");
    }
    $("guessProgress").innerHTML = `${got.length} of ${guessers.length} guesses in<span class="wait-dots"></span>`;
    $("scoreboardG").innerHTML = scoreboardHTML();
  }

  if (st === "reveal" && room.lastResult) renderReveal();
  if (st === "final") {
    $("finalStandings").innerHTML = standingsHTML(players(), pointsGoal(), PID);
  }
}

function renderReveal() {
  const r = room.lastResult;
  const q = QUESTIONS[r.qIndex];
  $("roundPillR").textContent = `Round ${r.round} of ${totalRounds()} — the truth!`;
  $("questionR").textContent = q.q;
  $("leftR").textContent = q.left;
  $("rightR").textContent = q.right;

  // personal "you earned" banner
  $("myEarnBanner").innerHTML = myEarnHTML(r);

  $("revealSpectrum").innerHTML = revealSpectrumHTML(r, players());
  $("revealResults").innerHTML = resultRowsHTML(r, players(), PID);
  $("standingsHeadR").textContent = `Standings · first to ${pointsGoal()} wins`;
  $("revealStandings").innerHTML = standingsHTML(players(), pointsGoal(), PID);
  $("nextRoundBtn").textContent = gameOverNext() ? "See final results" : "Next round";
}

function myEarnHTML(r) {
  if (r.spotlight === PID) {
    return `<div class="big-points">+${r.spotlightBonus}</div>
      <p style="font-weight:800;margin:0;">${r.spotlightBonus > 0 ? "Your friends really know you! 🎯" : "Nobody guessed close — you're a mystery!"}</p>`;
  }
  const g = r.guesses?.[PID];
  const pts = g ? g.points : 0;
  return `<div class="big-points">+${pts}</div>
    <p style="font-weight:800;margin:0;">${pts >= 75 ? "Bullseye! You really know them 🎯" : pts > 0 ? "Not bad!" : "Oof — way off this time!"}</p>`;
}

// ---------- referee ----------
async function referee() {
  if (busy || !PID) return;

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
    if (guessers.length > 0 && guessers.every((id) => got.includes(id))) await doReveal();
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
    updates[`players/${room.spotlight}/score`] = (players()[room.spotlight].score ?? 0) + spotlightBonus;
    updates["lastResult"] = { round: room.round, qIndex: room.qIndex, spotlight: room.spotlight, answer, guesses, spotlightBonus };
    updates["state"] = "reveal";
    await update(roomRef(CODE), updates);
  } finally { busy = false; }
}

// ---------- round control ----------
async function startRound(round, order, usedQ) {
  let spot = null;
  for (let i = 0; i < order.length; i++) {
    const cand = order[(round - 1 + i) % order.length];
    if (players()[cand]) { spot = cand; break; }
  }
  if (!spot) { await update(roomRef(CODE), { state: "lobby", round: 0 }); return; }
  const qIndex = pickQuestion(usedQ);
  await update(roomRef(CODE), {
    state: "answering", round, order, spotlight: spot, qIndex,
    usedQ: [...usedQ, qIndex], answers: null,
  });
}

// ---------- host's own answer/guess ----------
$("lockA").addEventListener("click", async () => {
  if (room.state !== "answering" || room.spotlight !== PID || lockedRound === room.round) return;
  unlockAudio(); sfx.lock();
  lockedRound = room.round;
  await set(roomRef(CODE, "answers/spotlight"), Number($("sliderA").value) / 100);
});

$("lockG").addEventListener("click", async () => {
  if (room.state !== "guessing" || room.spotlight === PID || lockedRound === room.round) return;
  unlockAudio(); sfx.lock();
  lockedRound = room.round;
  await set(roomRef(CODE, `answers/guesses/${PID}`), Number($("sliderG").value) / 100);
});

// ---------- settings + controls ----------
const roundsSlider = $("roundsSlider");
const goalSlider = $("goalSlider");
roundsSlider.addEventListener("input", () => { $("roundsOut").textContent = roundsSlider.value; });
goalSlider.addEventListener("input", () => { $("goalOut").textContent = goalSlider.value; });

$("startBtn").addEventListener("click", async () => {
  unlockAudio();
  const order = shuffle(connectedIds());
  await update(roomRef(CODE), { settings: { rounds: Number(roundsSlider.value), goal: Number(goalSlider.value) } });
  await startRound(1, order, room.usedQ || []);
});

$("nextRoundBtn").addEventListener("click", async () => {
  if (gameOverNext()) await update(roomRef(CODE), { state: "final" });
  else await startRound(room.round + 1, room.order, room.usedQ || []);
});

$("skipSpotlightBtn").addEventListener("click", async () => {
  if (room.round >= totalRounds()) await update(roomRef(CODE), { state: "final" });
  else await startRound(room.round + 1, room.order, room.usedQ || []);
});

$("revealNowBtn").addEventListener("click", doReveal);

$("playAgainBtn").addEventListener("click", async () => {
  const updates = { state: "lobby", round: 0, answers: null, lastResult: null };
  playerIds().forEach((id) => { updates[`players/${id}/score`] = 0; });
  await update(roomRef(CODE), updates);
});

$("lobbyPlayers").addEventListener("click", async (e) => {
  const b = e.target.closest(".kick");
  if (!b) return;
  await remove(roomRef(CODE, `players/${b.dataset.pid}`));
});

$("hostHomeBtn").addEventListener("click", (e) => {
  const inGame = room && room.state !== "lobby" && room.state !== "final";
  if (inGame && !confirm("Go home? The game will pause until you reopen this room (host.html?code=" + CODE + ").")) {
    e.preventDefault();
  }
});

$("muteBtn").addEventListener("click", () => {
  setMuted(!isMuted());
  $("muteBtn").textContent = isMuted() ? "🔇" : "🔊";
  if (!isMuted()) { unlockAudio(); sfx.ding(); }
});
