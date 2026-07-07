# Wake-Up Calculator

A small web app: enter when you need to arrive somewhere and your commute time,
list your morning routine (shower, teeth, breakfast, etc.), and it calculates
the exact time you need to wake up — then sounds an alarm at that time.

## Files

- `index.html` — page structure
- `styles.css` — all styling
- `script.js` — the calculation logic, persistence, and alarm

No build step, no dependencies. It's plain HTML/CSS/JS.

## How to run it

**Easiest:** just double-click `index.html` to open it in your browser.

**Better (some features like Notifications work more reliably over a real server):**
From this folder, run:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## What it does

- You set an arrival time and drive/commute minutes.
- You edit a list of morning routine steps (defaults: shower, teeth, dressing,
  breakfast, a buffer) — add or remove steps, rename them, adjust minutes.
- It works backward from your arrival time through your commute and every
  routine step, in order, and shows the exact time you need to wake up.
- Hit **Arm alarm** and, while this browser tab stays open, it will beep,
  flash, and (if you allow it) show a browser notification at that moment.
- Your routine and last inputs are saved automatically (via `localStorage`),
  so you don't have to re-enter them each time you open the page.

## Important limitation

**A browser tab can't wake a locked phone or a closed laptop.** This works
like a desk/desktop alarm: leave the tab open and your device unlocked
(or at least the browser audible) and it will make noise at wake time.
It is *not* a replacement for your phone's real alarm — think of it as the
"do the math for me" tool, and optionally as a backup alarm on a laptop
that's staying on and plugged in overnight.

## Ideas if you want to extend this with Claude Code

Just describe any of these to Claude Code and it can build on top of what's here:

- Multiple saved "profiles" (e.g. different jobs/gyms with different drive times)
- A day-of-week schedule so weekdays auto-fill different arrival times
- Swap the generated beep for an uploaded MP3/alarm sound
- A weather check that adds extra drive-time buffer automatically on bad-weather days
- Turn it into a PWA so it can be "installed" on a phone home screen
