// ============================================================
// Player (phone controller) logic. Joins a room, then reacts to
// the shared game state. Only ever writes its own data.
// Reconnect-safe: refreshing the page rejoins as the same player.
// ============================================================

import {
  roomRef, get, set, update, onValue, onDisconnect, remove, warnIfUnconfigured,
} from "./firebase.js?v=5";
import { QUESTIONS } from "./questions.js?v=5";
import {
  avatarDataURI, PLAYER_COLORS, FACES, escapeHTML,
  revealSpectrumHTML, resultRowsHTML, standingsHTML,
} from "./util.js?v=5";
import { sfx, unlockAudio } from "./sounds.js?v=5";

if (warnIfUnconfigured()) throw new Error("Firebase not configured");

const $ = (id) => document.getElementById(id);
const views = ["error", "lobby", "waiting", "slider", "reveal", "final"];
function showView(name) {
  views.forEach((v) => $(`view-${v}`).classList.toggle("hidden", v !== name));
}
function fail(msg) { $("errorMsg").textContent = msg; showView("error"); }

const CODE = (new URLSearchParams(location.search).get("code") || "").toUpperCase();
const pidKey = `dykm_pid_${CODE}`;
let PID = sessionStorage.getItem(pidKey);
let me = null;
let room = null;
let locked = false; // has my slider value been submitted this round?
let leaving = false;
let dc = null;      // onDisconnect handle, so we can cancel it on leave/kick
let lastRoundSeen = 0;

// ---------- boot: join or rejoin ----------
(async function boot() {
  if (CODE.length !== 4) return fail("No room code. Go back and enter one.");

  const snap = await get(roomRef(CODE));
  if (!snap.exists()) return fail(`Room ${CODE} doesn't exist. Double-check the code!`);
  const r = snap.val();
  const existing = r.players || {};

  if (PID && existing[PID]) {
    // rejoining after a refresh or a phone nap
    await update(roomRef(CODE, `players/${PID}`), { connected: true });
  } else {
    if (r.state !== "lobby") return fail("This game already started. Ask the host to finish the round, then join the next game!");
    const count = Object.keys(existing).length;
    if (count >= 10) return fail("This room is full (10 players max).");

    const name = (sessionStorage.getItem("dykm_join_name") || "Player").slice(0, 12);
    const usedColors = Object.values(existing).map((p) => p.color);
    const color = PLAYER_COLORS.findIndex((_, i) => !usedColors.includes(i));
    const storedFace = Number(sessionStorage.getItem("dykm_join_face"));
    const face = Number.isInteger(storedFace) && storedFace >= 0 && storedFace < FACES.length
      ? storedFace : Math.floor(Math.random() * FACES.length);

    PID = "p" + Math.random().toString(36).slice(2, 9);
    sessionStorage.setItem(pidKey, PID);
    await set(roomRef(CODE, `players/${PID}`), {
      name, color: color === -1 ? count % 10 : color, face,
      score: 0, connected: true, joinedAt: Date.now(),
    });
  }

  dc = onDisconnect(roomRef(CODE, `players/${PID}/connected`));
  dc.set(false);
  // phones napping don't always fire disconnect cleanly — re-mark on wake
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      update(roomRef(CODE, `players/${PID}`), { connected: true });
    }
  });

  onValue(roomRef(CODE), (snap2) => {
    room = snap2.val();
    if (!room) return fail("The room was closed.");
    me = room.players?.[PID];
    if (!me || !me.name) {
      if (leaving) return;
      if (dc) dc.cancel().catch(() => {});
      sessionStorage.removeItem(pidKey);
      return fail("You were removed from the room.");
    }
    render();
  });
})();

// ---------- rendering ----------
function render() {
  $("mePill").style.display = "inline-block";
  $("mePill").innerHTML =
    `<img class="avatar" style="width:20px;height:20px;vertical-align:-4px;" src="${avatarDataURI(me.color, me.face)}" alt="" />
     ${escapeHTML(me.name)} · ${me.score ?? 0} pts · room ${CODE}`;

  // new round? unlock the slider
  if (room.round !== lastRoundSeen) { locked = false; lastRoundSeen = room.round; }

  const st = room.state;
  const isSpot = room.spotlight === PID;
  const q = QUESTIONS[room.qIndex];
  const spotName = room.players?.[room.spotlight]?.name || "Someone";
  const goal = room.settings?.goal ?? Infinity;
  const totalRounds = room.settings?.rounds ?? room.order?.length ?? 0;

  if (st === "lobby") return showView("lobby");

  if (st === "answering") {
    if (isSpot && room.answers?.spotlight == null) {
      return showSlider("You're in the spotlight! Answer honestly…", q, personalize(q.q, true));
    }
    if (isSpot) return showWaiting("Answer locked! 🔒", "Now everyone guesses what you said. Sweat time.");
    return showWaiting(`${spotName} is in the spotlight`, `They're secretly answering: "${q.q}" — get ready to guess!`);
  }

  if (st === "guessing") {
    if (isSpot) return showWaiting("They're guessing about you…", "How well do your friends really know you? Watch the big screen.");
    const guessed = room.answers?.guesses?.[PID] != null;
    if (guessed || locked) return showWaiting("Guess locked! 🔒", "Waiting for the others…");
    return showSlider(`What did ${spotName} say?`, q, q.q);
  }

  if (st === "reveal") {
    const r = room.lastResult;
    if (!r) return showWaiting("Results…", "Coming up!");
    const q = QUESTIONS[r.qIndex];
    const cleanPlayers = {};
    for (const [id, p] of Object.entries(room.players || {})) if (p && p.name) cleanPlayers[id] = p;

    $("roundPillR").textContent = `Round ${r.round} of ${totalRounds} — the truth!`;
    $("revealTitle").textContent = q.q;
    $("leftR").textContent = q.left;
    $("rightR").textContent = q.right;

    // personal "you earned" banner
    if (r.spotlight === PID) {
      $("myEarnBanner").innerHTML =
        `<div class="big-points">+${r.spotlightBonus}</div>
         <p style="font-weight:800;margin:0;">${r.spotlightBonus > 0 ? "Your friends really know you! 🎯" : "Nobody guessed close — you're a mystery!"}</p>`;
    } else {
      const g = r.guesses?.[PID];
      const pts = g ? g.points : 0;
      $("myEarnBanner").innerHTML =
        `<div class="big-points">+${pts}</div>
         <p style="font-weight:800;margin:0;">${pts >= 75 ? "Bullseye! You really know them 🎯" : pts > 0 ? "Not bad!" : "Oof — way off this time!"}</p>`;
    }

    $("revealSpectrum").innerHTML = revealSpectrumHTML(r, cleanPlayers);
    $("revealResults").innerHTML = resultRowsHTML(r, cleanPlayers, PID);
    $("standingsHeadR").textContent = `Standings · first to ${goal} wins`;
    $("revealStandings").innerHTML = standingsHTML(cleanPlayers, goal, PID);
    return showView("reveal");
  }

  if (st === "final") {
    const ranked = Object.entries(room.players)
      .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0));
    const rank = ranked.findIndex(([id]) => id === PID) + 1;
    const medals = ["🥇", "🥈", "🥉"];
    $("finalTitle").textContent = `${medals[rank - 1] || "🎉"} You finished #${rank}`;
    $("finalScore").textContent = `${me.score ?? 0} pts`;
    return showView("final");
  }
}

// turn "How scared of heights are they?" into a you-question for the spotlight player
function personalize(text, secondPerson) {
  if (!secondPerson) return text;
  const out = text
    .replace(/\bare they\b/gi, "are you")
    .replace(/\bdo they\b/gi, "do you")
    .replace(/\bcould they\b/gi, "could you")
    .replace(/\bwould they\b/gi, "would you")
    .replace(/\bthey like\b/gi, "you like")
    .replace(/\btheir\b/gi, "your")
    .replace(/\bthey\b/gi, "you")
    .replace(/\bthem\b/gi, "you");
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function showWaiting(title, body) {
  $("waitTitle").textContent = title;
  $("waitBody").textContent = body;
  showView("waiting");
}

function showSlider(pill, q, questionText) {
  $("sliderPill").textContent = pill;
  $("sliderQuestion").textContent = questionText;
  $("sliderLeft").textContent = q.left;
  $("sliderRight").textContent = q.right;
  // put my face on the slider thumb
  const uri = avatarDataURI(me.color, me.face);
  let styleEl = $("thumbStyle");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "thumbStyle";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent =
    `input[type="range"].guess::-webkit-slider-thumb{background-image:url("${uri}");}
     input[type="range"].guess::-moz-range-thumb{background-image:url("${uri}");}`;
  showView("slider");
}

async function leaveRoom() {
  const inGame = room && room.state !== "lobby" && room.state !== "final";
  if (inGame && !confirm("Leave the game? You'll be removed and lose your points.")) return;
  leaving = true;
  try {
    if (dc) await dc.cancel();
    await remove(roomRef(CODE, `players/${PID}`));
  } catch (e) { /* already gone is fine */ }
  sessionStorage.removeItem(pidKey);
  location.href = "index.html";
}

$("homeBtn").addEventListener("click", leaveRoom);
$("leaveBtn").addEventListener("click", leaveRoom);

$("lockBtn").addEventListener("click", async () => {
  if (!room || locked) return;
  unlockAudio();
  sfx.lock();
  const value = Number($("slider").value) / 100;
  const isSpot = room.spotlight === PID;

  if (room.state === "answering" && isSpot) {
    locked = true;
    await set(roomRef(CODE, "answers/spotlight"), value);
  } else if (room.state === "guessing" && !isSpot) {
    locked = true;
    await set(roomRef(CODE, `answers/guesses/${PID}`), value);
  }
});
