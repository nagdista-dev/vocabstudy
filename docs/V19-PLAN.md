# V19 — wallet folders: General, Shared, and yours

> Status: planned. The wallet becomes a small filing cabinet instead of one
> long pocket: quick saves land in **General**, words sent by a friend land in
> **Shared**, and the learner can make folders such as **Film** and move words
> into them. A folder can be studied as one batch.

## Deep review

### What the wallet is today

`state.wallet` is one flat list of `{ id, word, sentence, source, kind?,
arabic?, added }`, newest last, capped at 300 (`core/store.js`). An entry's
`id` is the word, so the same word cannot be kept twice. `walletAdd(word,
sentence, source, kind, arabic)` refuses a word already in the library and
reports a duplicate; `kind` is only a label (`"shared"`, `"meaning"`) and does
not organize anything.

The page (`views/wallet.js`) is a pocket of slips:

- the pocket holds one capture line, an optional sentence, the saved count and
  a bulk **Make all with AI** action;
- the slips are newest first, with search appearing after six words;
- each slip has two doors — **Make with AI** and **Add now** — plus remove;
- **Clear wallet** clears everything after a confirm;
- **Reset progress** keeps the wallet, **Start over** deletes it;
- `exportJSON` includes it, `mergeJSON` unions by id, `importJSON` replaces
  the state and `walletRestore` puts entries back for Undo.

### Where words come from

- The wallet pocket calls `VS.walletCapture` (`views/wallet.js`).
- Today's compact add box calls the same `VS.walletCapture`
  (`views/library.js`).
- A word card's **Keep in wallet** calls `walletAdd` with the line's kind
  (`views/shared.js`).
- A short share-target text calls `walletAdd(..., "shared")` (`app.js`).
- A received shared list's **Save for later** calls `walletAdd(..., "shared")`
  (`views/share.js`).
- Adding a wallet word to the library removes it (`views/import.js`).

### What is missing

The flat list works for ten words and stops working for sixty. Search only
finds a word if the learner remembers it; there is no way to keep a film's
words together, no way to study only that film's words, and **Make all with
AI** always means every slip. **Clear wallet** is equally global, so a learner
standing in a folder has no safe way to clear just that folder.

### Constraints the design must keep

- Local-first: no server, no account, folders travel only in the backup.
- Old saves must open: v18 entries have no folder.
- Undo stays: remove, clear and move are reversible.
- Arabic is first-class: folder names may be Arabic, names are escaped, and
  the Arabic scale applies.
- One page, two shapes: a sticky pocket and slips on desktop; one column on
  phones.
- The app's own parts: native `<dialog class="sheet">`, `.field`, `.btn`,
  tokens, 44px targets, Light/Night/Glass.
- Nothing is studied from the wallet until the learner chooses a door.

## Decisions

| Area | Decision |
| --- | --- |
| Data model | `state.walletFolders` is `[{ id, name }]`, built-ins first. Every wallet entry gets `folder`, an id. The word id is still the word, so a word exists once in the whole wallet, not once per folder. |
| Built-ins | `general` → "General", `shared` → "Shared". Stable ids; names may be renamed. They cannot be deleted. New words default to General, shared words to Shared. |
| Migration | On load, old entries without a folder go to Shared when `kind === "shared"`, otherwise General. Missing built-ins are added. Unknown folder ids fall back the same way. |
| Names | Trimmed, whitespace collapsed, max 40 chars, case-insensitive unique, "All" reserved. At most 50 folders. Errors are inline in the sheet, not toasts. |
| Creating | A **New folder** chip opens the folder sheet with the name field focused. Creating selects the new folder and closes the sheet, so the next save lands there. |
| Managing | The same sheet lists every folder with its count. Built-ins carry a **Default** badge and can be renamed, not deleted. Custom folders can be renamed inline or deleted after a confirm. Deleting moves its words to General; no word is lost. |
| Moving a word | A folder tag on each slip opens a small move sheet with a radio list. Moving is immediate and the toast offers Undo. |
| Filtering | A chip row above the grid: **All**, then every folder with its count, then **New folder**. Chips are links (`#/wallet?folder=<id>`), so a folder survives refresh and can be linked. On phones the row scrolls; on wider screens it wraps. |
| Pocket destination | The pocket says **Saving to <folder>**. In a folder it saves there; in All it saves to General. The typed draft survives a folder switch. |
| Header and empty states | All: the existing count. A folder: its count and name. An empty folder gets its own empty state with **Show all words**; an empty wallet keeps the desk photo and says where new words go. |
| Search | Searches the selected folder only. The no-results line names the folder. The search box appears when the folder has more than six words. |
| Bulk AI | **Make all with AI** uses the selected folder's words, up to 30, not the whole wallet. A folder batch prefills the Add screen's batch tag with the folder name (visible and editable), so the added words can be studied together. After adding, a **Study** toast opens that tag's cards. |
| Clear | In All, **Clear wallet** clears everything. In a folder, **Clear folder** clears only that folder. Both confirm and offer Undo. |
| URL | `#/wallet` is All; `#/wallet?folder=film` is one folder. An unknown/deleted id falls back to All and the address is cleaned. Renaming keeps the id, so links keep working. |
| Backup | `exportJSON` includes `walletFolders` and each entry's `folder`. `mergeJSON` merges folders by id, then by case-insensitive name, remaps incoming entries and skips words now in the library. `importJSON` normalizes old backups. `resetProgress` keeps folders; `startOver` resets to the two built-ins. |
| Dialogs | Native `<dialog class="sheet">`, `showModal()`, `autofocus` on the primary field/current choice, no manual focus trap or `role="dialog"`. The folder sheet stays in the body so a page re-render behind it does not close it. Esc and backdrop close. |
| Counts | The tab badge stays the whole wallet. Chips and the sheet show per-folder counts. |
| Non-goals | Nested folders, drag-and-drop, folder colours/icons, sharing a folder as a unit, syncing folders between devices outside the backup, and a separate folder-level study scheduler. |

## Tasks

1. **Store model and migration**
   - Add `walletFolders` to `DEFAULTS`; add `folder` to the entry comment.
   - Add `cleanFolderName`, `MAX_FOLDERS`, `newFolderId` and
     `normalizeWallet(st)`.
   - Call `normalizeWallet` from `load()` and `importJSON()`.
   - Add getters `walletFolders`, `walletFolder`, `walletFolderName`.
   - Add `walletFolderCreate`, `walletFolderRename`, `walletFolderDelete`,
     `walletSetFolder`.
   - Update `walletAdd` (optional folder, default by kind), `walletClear`
     (optional folder) and `walletRestore` (normalize a restored folder).
   - Update `mergeJSON` to merge/remap folders and entries.
   - Keep `walletFolders` in `resetProgress`; `startOver` resets to built-ins.

2. **Icon and CSS foundations**
   - Add a `folder` icon to `core/icons.js`.
   - Add the chip row, destination line, folder tag, folder sheet, rename
     form, move list and folder-empty styles to `views/wallet.css`.
   - 44px targets on coarse pointers, one focus ring, Light/Night/Glass,
     reduced motion, no horizontal page scroll.

3. **Route and view state**
   - Parse the wallet query in `app.js`.
   - Add `start(p)` to `views/wallet.js`: validate `folder`, clean an invalid
     URL, reset search when the folder changes, keep the typed draft.
   - Add `leave()` to close wallet dialogs.
   - Add `st.folder`, `st.draft`, `st.draftSentence`, `st.list`.
   - Validate `st.folder` again in `render()` for imports/resets that happen
     while the page is open.

4. **Folder bar and pocket**
   - Render All + folder chips with counts and active state; wrap on wide
     screens, scroll on phones.
   - Add the **New folder** button and the `wallet-folders` action.
   - Show **Saving to <folder>** in the pocket; pass the folder to
     `VS.walletCapture`; keep the draft across folder switches.
   - Scope the header, pocket count, bulk button, search, no-results line and
     empty states to the selected folder.
   - Scope **Clear** to the folder; update its confirm and toast.

5. **Slips: folder tag and move sheet**
   - Add the folder tag to each slip's action row with an accessible label.
   - Build the move sheet with one radio per folder, the current folder
     checked and focused; submit moves the word, closes, renders, toasts and
     offers Undo.
   - Focus the moved slip's folder tag after the sheet closes, or the view.

6. **Folder sheet**
   - Build the body-level folder sheet: create form, error line, list with
     counts, **Default** badges, inline rename, delete.
   - Create selects the new folder; rename repaints the sheet and the page
     behind it; delete confirms, moves words to General and falls back to All
     when the active folder is gone.
   - Reset the rename state on close; return focus to the **New folder**
     button; test nested `VS.confirm` over the sheet.

7. **Capture destinations and messages**
   - `VS.walletCapture` accepts an optional folder and toasts the folder name;
     a duplicate names the folder it is already in.
   - Today's box says **saves to General** (using the current name); its toast
     comes from `walletCapture`.
   - Share target saves to Shared, toasts **Shared** and opens
     `#/wallet?folder=shared`; an existing word opens its own folder.
   - A received list's **Save for later** opens Shared; the done screen names
     the folder.
   - Word-card keeps default to General.

8. **Bulk AI and the study bridge**
   - Scope `wallet-ai-all` to the selected folder.
   - Pass the folder name as `tag` in `VS.walletDraft` for a folder batch.
   - In `views/import.js`, prefill `st.ai.tags`, remember `fromFolder`, and
     after a successful add show a toast with **Study** for the batch tag.
   - Reset `fromFolder` on tab changes and after adding.

9. **Docs**
   - Update `DESIGN.md` wallet section (model, folders, page, destinations,
     loss).
   - Update `docs/ARCHITECTURE.md` wallet section (shape, store API, merge,
     reset, route).
   - Update `docs/SHARE.md` (Shared destination and links).
   - Keep this plan's Result section for the end.

10. **Build, browser matrix and self-review**
    - `python3 tools/build.py`, `python3 tools/check.py`, `node mcp/test.js`.
    - Browser checks at 320/390/430/768/1280, Light/Night/Glass, 1.25× text,
      keyboard, dialogs, deep links, old save, backup merge, share target.
    - Review the diff, fix, commit, push, verify the Pages deploy, report.

## Verification matrix

| Check | How |
| --- | --- |
| Old save opens | Seed a v18 wallet with a shared entry and a normal entry, no `walletFolders`; reload: General/Shared exist, the shared entry is in Shared, the other in General. |
| Home quick save | Save a word from Today: toast says General; the wallet chip General gains it; the word is not in Shared. |
| Share target | Open `?share-text=serendipity&share-title=Book`: toast says Shared and the app lands on `#/wallet?folder=shared` with the word. |
| Shared list | **Save for later** on a received list lands in Shared; **Open your wallet** opens Shared. |
| Word card | **Keep in wallet** from a word card lands in General. |
| Create | New folder → name → Create: sheet closes, the new chip is active, the pocket says **Saving to <name>**; the next word lands there. |
| Rename | Rename a custom folder and a built-in: chips, breadcrumb, pocket, sheet and home note use the new name; the URL id is unchanged. |
| Name rules | Empty, 41 chars, `All`, `film` vs `Film`, and the 51st folder show inline errors; no duplicate chip. |
| Delete | Delete a custom folder with words: confirm names the count and General; the words are in General; the chip is gone; the built-ins have no delete button. |
| Move | Move a word from General to Film: chip counts change, the slip shows Film, Undo puts it back. |
| Search | Search in a folder only matches that folder; the no-results line names it; All searches everything. |
| Bulk AI | Film selected → Make all with AI: Add → With AI lists only Film words; the batch tag is Film; after adding, **Study** opens `#/pick/cards?tag=Film`. |
| Clear | Clear folder removes only that folder's words and Undo restores them; Clear wallet in All removes everything. |
| Empty states | Empty folder shows its own state and **Show all words**; empty wallet keeps the desk photo and names General. |
| Deep link | `#/wallet?folder=film` reloads into Film; `?folder=gone` falls back to All and cleans the address. |
| Backup | Export includes folders; import restores them; merge with a same-name/different-id folder remaps entries and never duplicates a word. |
| Reset | Reset progress keeps folders and wallet; Start over returns to General + Shared. |
| Responsive | 320/390/430/768/1280: chips scroll or wrap without page scroll; sheets fit and scroll; folder tags and buttons stay 44px on touch. |
| Keyboard | Tab to chips, New folder, sheet fields, pencil/trash, move radios; Enter submits; Esc closes; focus returns sensibly. |
| Theme/text | Light, Night and Glass; 1.25× text; no clipping in chips, sheets or slip actions. |
| Build | `python3 tools/build.py`, `python3 tools/check.py`, `node mcp/test.js` all pass. |

## Plan review

Reviewed the plan against the actual code paths before writing any code. The
adjustments that came out of that review:

- The router currently drops the wallet query (`app.js` line 63). Without
  `query`, the deep link cannot work. Add it in the same change as `start(p)`.
- `walletClear` is global. Leaving it global while the page is filtered would
  make **Clear** in a folder destroy words the learner cannot see. Scope it.
- `resetProgress` preserves `wallet` by name. It must also preserve
  `walletFolders`, or Reset progress would silently lose the organization.
- `importJSON` replaces the state without normalization. An old backup would
  produce entries with no folder and no chips. Normalize there too.
- `mergeJSON` unions wallets by id. It must first merge folders by id and then
  by case-insensitive name, remap incoming `folder` ids, and fall back when
  the folder is unknown. Otherwise two devices' "Film" folders would split.
- Switching folders is a hash navigation and re-renders the view. Without a
  draft in module state, a typed word would disappear. Keep the draft and the
  optional sentence across the switch.
- Built-in folders need stable ids, not names: renaming General to Arabic must
  not change where quick saves go, and old links must keep working.
- The folder sheet must live in the body, not inside `#view`: renaming or
  deleting calls `VS.app.render()` to update the chips behind it, and a
  dialog inside the view would be destroyed by that render.
- `VS.confirm` opens its own native dialog. Stacking it over the folder sheet
  is valid, but it needs a real test; the alternative (closing the sheet
  first) would lose the learner's place.
- The tab badge should stay global. A folder count on the tab would hide the
  words in other folders and make the badge lie.
- `VS.walletCapture` is shared by Today and the pocket. A required folder
  argument would break Today; make it optional and default by kind.
- The received-list done screen links to `#/wallet`; it should link to the
  Shared folder so the new words are visible, not buried in All.
- A folder batch's tag must be visible and editable on the Add screen. It is
  a suggestion from the folder name, not a hidden write. After adding, the
  Study toast makes the tag useful.
- Deleting a folder loses organization but not words. A confirm is enough; an
  Undo would need to recreate ids and reassign entries, and the words are
  already safe in General.
- The `All` chip is a view, not a folder: it has no rename/delete, is never in
  the folder list, and is reserved as a name.

## Result

Shipped. The wallet is now a small filing cabinet, and every part of the
promise above is live:

- **Store.** `walletFolders` and each entry's `folder` are in `core/store.js`;
  old saves migrate (shared entries to Shared, everything else to General);
  names are trimmed, collapsed, capped at 40 and unique by case; the built-ins
  have stable ids and can be renamed, not deleted; deleting a custom folder
  moves its words to General; the limit is 50. `walletClear` takes an optional
  folder. Backup includes folders; merge joins them by id then name and remaps
  entries; Reset progress keeps them; Start over returns to General + Shared.
- **Page.** All / folder chips are links (`#/wallet?folder=<id>`), the pocket
  says where the next save lands, the header/search/bulk AI/Clear follow the
  selected folder, and an empty folder has its own state. A slip's folder tag
  opens the move sheet; moving and clearing offer Undo. A folder batch carries
  its name as the Add screen's tag, and a successful add offers **Study**.
- **Destinations.** Today and word-card keeps land in General; the share
  target and a received list's **Save for later** land in Shared and open that
  folder; a duplicate toast names the folder the word is already in.
- **Chrome.** The install invitation is now a native modal `<dialog>` with a
  dimmed backdrop; the brand lockup is only the mark and "VocabStudy"; action
  toasts stay 6 s, pause on hover/focus, and have a 10 s hard cap.
- **Checked.** Build and check pass; `node mcp/test.js` passes. Browser passes:
  old-save migration, merge by folder name, 50-folder limit, deep links and
  invalid-folder cleanup, create/rename/delete with validation, move + Undo,
  search scoping, scoped clear + Undo, share target, received list, word-card
  link, folder/move sheet keyboard and Escape, 320/390/430/768/1280, Light,
  Night and Glass, 1.25× text.
- **Follow-up.** The v20 visual pass replaces the last rounded/pill-heavy
  wallet details (folder row rules, card footer lines, clear action) with the
  app's rectangular filing-card language. No behaviour changes.
