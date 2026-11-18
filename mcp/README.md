# VocabStudy for AI apps (MCP)

Let **Claude Desktop, Claude Code, opencode or Cursor** on your computer add and
edit words in VocabStudy — "add the words from this article", "fix the Arabic
meaning of *deadline*", "what's due today?".

**Your words stay on your computer.** VocabStudy keeps them inside your browser,
and nothing outside the browser can open them. So this is a small *messenger*
(`server.js`, one file, no dependencies) that runs on your computer, listens
only on `127.0.0.1`, and passes your AI app's requests to the open VocabStudy
tab. The tab does the work and shows every change with **Undo**. No server, no
account, nothing uploaded by VocabStudy. (What you type to your AI app goes to
that AI app, as always.)

```
Claude / opencode  ──MCP──▶  server.js (this computer)  ──127.0.0.1──▶  VocabStudy tab ── saves in your browser
```

**Computer only** (Windows, macOS, Linux) with **Chrome or Edge**. Phones can't
run a local helper — words you add here move to your phone with *Move to
another device*.

## What the AI can do

| Tool | What it does |
| --- | --- |
| `get_overview` | Words, due today, new words left, streak, goal |
| `list_words` | Search and filter your library |
| `get_word` | One word in full: meanings, your sentences, your note, its place on the ruler |
| `add_words` | Add up to 50 words; anything left out is filled in by the app's dictionaries |
| `update_word` | Fix a meaning, definition, example, type, tags or your note |
| `add_sentence` | Save a sentence you wrote — only if it passes the app's mistake checks |

There is **no delete**, and the AI can't change your recall schedule.

## Set it up (5 minutes, once)

1. **Install Node.js 18 or newer** from [nodejs.org](https://nodejs.org) (check: `node --version`).
2. **Save the messenger:** download
   [`server.js`](https://raw.githubusercontent.com/nagdista-dev/vocabstudy/main/mcp/server.js)
   to a folder you'll keep, e.g. `C:\Users\you\vocabstudy\server.js` or
   `~/vocabstudy/server.js`. (Or clone this repository and use `mcp/server.js`.)
3. **Add it to your AI app** — use the full path to `server.js`:

   **Claude Desktop** — Settings → Developer → Edit Config (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "vocabstudy": { "command": "node", "args": ["/full/path/to/server.js"] }
     }
   }
   ```
   Then quit and reopen Claude Desktop.

   **Claude Code:**
   ```bash
   claude mcp add vocabstudy -- node /full/path/to/server.js
   ```

   **opencode** — in `opencode.json` (project) or `~/.config/opencode/opencode.json`:
   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "mcp": {
       "vocabstudy": { "type": "local", "command": ["node", "/full/path/to/server.js"], "enabled": true }
     }
   }
   ```

   **Cursor** — `~/.cursor/mcp.json`:
   ```json
   { "mcpServers": { "vocabstudy": { "command": "node", "args": ["/full/path/to/server.js"] } } }
   ```

4. **Turn it on in VocabStudy:** open [vocabstudy.nagdista.com](https://vocabstudy.nagdista.com)
   in Chrome or Edge → Settings → App & data → **AI assistant: On**. If Chrome asks
   to let the site "connect to devices on your local network", allow it — that
   device is your own computer (`127.0.0.1`).
5. Keep the VocabStudy tab open while you talk to your AI app. The setting shows
   **Connected** when everything is ready.

Try: *"Add these words to VocabStudy with short Egyptian Arabic meanings:
deadline, postpone, commute."*

## Safety

- Listens on `127.0.0.1` only — no other device can reach it.
- Only the VocabStudy page may connect (checked by its Origin); other websites
  get "403". No web page at all can call the tools.
- Off by default in the app; turning it off disconnects at once.
- Every change shows in the app with Undo. No delete tool.

Your own copy of VocabStudy on another address? Start the messenger with
`VOCABSTUDY_ORIGINS=https://your.address`. Port busy? `VOCABSTUDY_PORT=…`
(the app uses 47821, so change both only if you build the app yourself).

## Test it

```bash
node mcp/test.js          # protocol and security checks
node mcp/test.js --app    # also through an open VocabStudy tab with AI assistant on
```

---

## بالعربي باختصار

ده "مرسال" صغير بيخلي Claude أو opencode أو Cursor على الكمبيوتر يضيفوا ويعدّلوا كلماتك في VocabStudy.
كلماتك **مبتطلعش من جهازك**: المرسال شغال على الكمبيوتر بس، والتطبيق المفتوح في المتصفح هو اللي بيحفظ، وكل
تغيير بيظهرلك ومعاه Undo، ومفيش مسح. نزّل Node.js، احفظ `server.js`، ضيفه في إعدادات تطبيق الـ AI بتاعك (الأوامر
فوق)، وبعدين في VocabStudy: Settings ← App & data ← **AI assistant: On**، وسيب التاب مفتوح.
