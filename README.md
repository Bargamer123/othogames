# Do You Know Me?! 🎉

A free, browser-based party quiz for 2–10 players, inspired by the *Do U Know Mii* mode
from Wii Party U. One player answers a personality question on a sliding scale; everyone
else guesses where they put it. Closest guesses score the most points.

- **Host screen** (laptop/TV) runs the game and shows the reveals
- **Players** join on their phones with a 4-letter room code
- Hosted free on **GitHub Pages**, synced in real time with **Firebase Realtime Database**

## Setup (10 minutes)

### 1. Paste in your Firebase config
Open `js/firebase.js`. Replace the placeholder `firebaseConfig` object with yours:
Firebase console → ⚙️ Project settings → Your apps → SDK setup and configuration → **Config**.

(This config is safe to publish in a public repo — it identifies your project;
security comes from the database rules below.)

### 2. Put these files in your GitHub repo
Upload everything in this folder to the root of your repo (keep the folder structure:
`css/`, `js/`, and the three HTML files at the top level). Commit to `main`.

If GitHub Pages is enabled (Settings → Pages → Deploy from branch → `main` / root),
your game is live at `https://YOURNAME.github.io/YOURREPO/` within a minute.

### 3. Play
1. Open the site on a laptop/TV → **Host a game**
2. Friends open the same URL on their phones → enter the room code + a name
3. Host presses **Start the game!**

Each player gets one turn in the spotlight per game. Guessers earn up to 100 points for
a bullseye; the spotlight player earns +25 for every friend who guesses close.

## Before your 30-day Firebase "test mode" expires

Replace your database rules (Realtime Database → **Rules** tab) with these — they keep
the game working but block anything outside `/rooms` and reject junk data:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$code": {
        ".read": true,
        ".write": true,
        ".validate": "$code.length === 4"
      }
    }
  }
}
```

This is party-game-grade security (anyone with a room code can write to that room),
which is the same trust model as the living room it's played in. Don't reuse this
database for anything sensitive.

## Nice-to-know

- **Reconnects:** if a phone locks or refreshes, reopening the same link rejoins as the
  same player with their score intact.
- **Stuck round?** The host has **Reveal now** (proceeds with the guesses received) and
  **Skip this player** (if the spotlight player wandered off).
- **Old rooms** just sit in the database harmlessly. You can delete them in the Firebase
  console, or later add a scheduled cleanup if you ever care.
- **Add questions** in `js/questions.js` — each one is a question plus its two slider
  extremes. The game won't repeat a question within a session.

## Local development

From this folder: `npx serve` then open `http://localhost:3000`. Open `host.html` in one
window and a couple of `player.html` tabs to simulate a party.
