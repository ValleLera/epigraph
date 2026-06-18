# Epigraph — Claude Code instructions

## Stack
- Electron 40, no framework. Single-file renderer: `index.html` (all UI + logic).
- `main.js` — Node/IPC. `preload.js` — contextBridge.
- Data: `epigraph_data.json`. Dev path: `__dirname`. Packaged path: `app.getPath('userData')`.

## Non-negotiable end-of-session checklist

Every session that touches `index.html`, `main.js`, or `preload.js` **must** end with:

1. `git -C /Users/valle/Desktop/epigraph-app add index.html main.js preload.js && git commit`
2. Run `bash update.sh` (builds + installs to `/Applications/Epigraph.app`)
   - If `sudo` fails non-interactively, tell the user to run the install step manually.
3. Quit the packaged app if running, reopen from `/Applications/Epigraph.app`.
4. **Confirm the feature works in the packaged app** — not just `npm start`.
5. Report back explicitly stating "verified in packaged app".

Verifying only via `npm start` and calling it done is not acceptable. The packaged app uses a different data path and binary; a change that works in dev can still be missing or broken there.

## git staging — always name files explicitly

Never use `git add -A` or `git add .` from the repo root. The repo root is `~/` (home directory), which causes permission errors traversing `Library/`. Always stage by name:

```
git -C /Users/valle/Desktop/epigraph-app add index.html main.js preload.js
```

## Git checkpoint commits

Before starting each session's feature work, commit whatever is staged:

```
git -C /Users/valle/Desktop/epigraph-app add index.html main.js preload.js
git -C /Users/valle/Desktop/epigraph-app commit -m "checkpoint before <feature>"
```

If nothing is staged it's a no-op — that's fine, continue.
