# Phase 1 — Git UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Git panel tab for every collection and workspace that lives in a Git repo: status and diff, stage and commit, fetch, pull (merge or rebase) and push with ahead/behind, branches, remotes and `git init`, stash, merge-conflict resolution, and per-host access tokens.

**Architecture:** New main-process modules under `bruno-electron/src/utils/git-panel/` run git through `simple-git` (argument arrays only), serialized per repo, and are exposed by one new IPC module `ipc/git-panel.js` (`renderer:git-panel:*`). The renderer gets a new tab type `git` rendered by `components/GitPanel/`, which holds its own state with `useState` (the data is repo state, not app state, so it stays out of Redux). Upstream files change only at plug-in points.

**Tech Stack:** simple-git 3.32, Electron `safeStorage` through `utils/encryption.js`, React + styled-components, `ui/*` primitives, `diff` (line diff), Jest against real temp repos, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-hanuman-design.md` §6 "เฟส 1", §5.4, §9 items 5, 9, 12.

## Global Constraints

- Never copy or decompile code from Bruno's paid edition. Write from the OSS code and the spec only.
- No telemetry. No network call unless the user clicks Fetch, Pull, Push or Clone.
- Old Bruno collections must keep opening. Nothing here writes to collection files except a conflict resolution the user chooses.
- New code goes in new files. Upstream edits are plug-in points only, and each touched upstream file is listed in `docs/UPSTREAM-SYNC.md`.
- Every git failure reaches the user as git's own message (scrubbed of credentials). Nothing returns a silent default.
- Tokens are stored only through `encryptString` (safeStorage when available, AES fallback on Linux without a keyring). Never in collection files, git config, remote URLs or argv.
- Git runs through argument arrays. Paths always follow `--`. Branch names pass `git check-ref-format --branch`. Remote names and URLs must not start with `-`.
- Status, stage, discard, stash and the conflict list are scoped to the collection (or workspace) directory with a pathspec (§9.12). Branch, checkout, pull and push act on the whole repo, and the UI says so when the scope is a subfolder.
- Follow `.claude/rules/` (component-owns-directory, `renderer:*` channel naming, exported testable handler functions, `data-testid` for Playwright).

## Review Focus

1. **Unsaved request drafts during checkout, pull, stash or discard.** Files on disk change under an open draft. Expect a confirm that names how many unsaved requests exist in collections inside the repo. Test: Task 7 `hasUnsavedDraftsInRepo` spec.
2. **Wrong or missing credentials.** Expect a fast failure with git's message, never a hang waiting for a prompt. Test: Task 3 `fails fast when the server asks for credentials`.
3. **Token leakage in error text.** A failing push with a stored token must not echo the token or `user:pass@` in the message. Test: Task 1 `scrubSecrets` spec and Task 3 assertion on the rejected message.
4. **Concurrent operations.** Refresh racing a commit must not hit `index.lock`. Test: Task 1 `withRepoLock runs calls for the same repo in order`.
5. **Rebase and stash-pop conflicts**, not just merge. Expect the same resolver to work and Continue to do the right thing per operation. Test: Task 5 rebase and stash-pop specs.

## Decisions (Friday's calls, for Arm to check)

1. UI follows VS Code's Source Control layout: commit box and change list on the left, diff or conflict editor on the right, branch and sync buttons in the header.
2. Open the panel from the collection "..." menu → **Git**, and for a workspace from the Collections section "..." menu → **Git (workspace)**. Tab uid `${collectionUid}-git`, so one tab per collection.
3. Repo-relative paths come from `git rev-parse --show-toplevel`, not upstream's `findGitRootPath`.
4. **Deviations from §9.9 ("reuse upstream helpers").** Kept as is: `getWorkingFileContentForVisualDiff`, `supportsVisualDiff`, `listStashes`, `applyStash`, `dropStash`, `getGitVersion`. Not used, and why:
   - `getChangedFilesInCollectionGit`: ignores the collection scope and drops index `M` + worktree `D`.
   - `findGitRootPath`: `split('.git')` breaks on a parent folder such as `my.github`.
   - `abortConflictResolution` and `continueMerge`: hardcode `.git/MERGE_HEAD` (breaks worktrees and submodules), cover merge only, and run `exec` with a string.
   - `unstageChanges`: `git reset HEAD` fails before the first commit.
   - `pullGitChanges`: allows only `--no-rebase` and `--ff-only`.
   - `getAheadBehindCount`: swallows errors and returns zeros.
   - `createStash`: no pathspec.
   - `push/pull/fetch` helpers: share the cached simple-git instance, so a token set with `.env()` would stick to later calls.
5. Access tokens: per host (`github.com`, `gitlab.example.com:8443`), with a username, because Bitbucket and Gitea check it. The token is injected only for HTTPS remotes whose host matches, through an env-backed credential helper that replaces the user's helpers for that one command. SSH uses the user's own config (agent, `core.sshCommand`, `GIT_SSH`); with no TTY it fails instead of prompting. (Review change: the first version forced `GIT_SSH_COMMAND=ssh -o BatchMode=yes`, which overrode `core.sshCommand`.)
6. Conflict choices are labelled **Current** and **Incoming**, with a one-line note per operation, because `ours` and `theirs` swap meaning during a rebase.
7. The workspace Git tab does not come back after an app restart (upstream never snapshots scratch-collection tabs). The collection Git tab does.
8. A PR-only CI job runs `tests/git-panel` on Linux. The full e2e suite stays `workflow_dispatch`-only.
9. No commit history view in this phase (the spec doesn't ask for one).

## File Structure

Main process (all new):

| File | Responsibility |
|---|---|
| `packages/bruno-electron/src/utils/git-panel/repo.js` | resolve repo root and scope, per-repo lock, local/network simple-git factories, in-progress operation detection, input validators |
| `packages/bruno-electron/src/utils/git-panel/auth.js` | host from remote URL, credential-helper config and env, `scrubSecrets` |
| `packages/bruno-electron/src/store/git-credentials.js` | encrypted per-host `{ username, token }` store (pattern: `store/ai-keys.js`) |
| `.../git-panel/status.js` | `getPanelStatus` |
| `.../git-panel/changes.js` | stage, unstage, discard, commit, file diff |
| `.../git-panel/sync.js` | fetch, pull, push |
| `.../git-panel/branches.js` | list, create, checkout, delete |
| `.../git-panel/remotes.js` | list, add, set URL, remove, `initRepository` |
| `.../git-panel/stash.js` | push (scoped or repo-wide), list, apply, pop, drop |
| `.../git-panel/conflicts.js` | read conflict, resolve, continue, abort |
| `.../git-panel/index.js` | barrel |
| `packages/bruno-electron/src/ipc/git-panel.js` | `registerGitPanelIpc` plus one exported handler per channel |
| `.../git-panel/__tests__/helpers.js` | temp repo helpers for Jest (bare remote + clones with an identity) |

Renderer (all new unless marked):

| File | Responsibility |
|---|---|
| `packages/bruno-app/src/components/GitPanel/index.js` | container: target path, git-missing gate, layout |
| `GitPanel/useGitPanel/index.js` | status state, `run(op)` wrapper (busy flag, error, refresh) |
| `GitPanel/utils/index.js` | `groupFiles`, `conflictLabels`, `getGitPanelTab`, `hasUnsavedDraftsInRepo` (+ spec) |
| `GitPanel/Toolbar/` | branch button, ahead/behind, Fetch, Pull ▾, Push, Refresh, overflow menu |
| `GitPanel/BranchMenu/` | branch list, checkout, delete, create; stash prompt |
| `GitPanel/ChangeList/` | Conflicts, Staged, Changes sections with row actions |
| `GitPanel/CommitBox/` | message + Commit |
| `GitPanel/FileDiff/` | visual diff for `.bru`/`.yml`, line diff otherwise, toggle |
| `GitPanel/ConflictResolver/` | Current / Incoming / edit with markers, Mark resolved |
| `GitPanel/OperationBanner/` | merge/rebase in progress, Continue, Abort |
| `GitPanel/StashList/` | stash with message, apply, pop, drop |
| `GitPanel/RemotesModal/` | list, add, edit URL, remove |
| `GitPanel/CredentialsModal/` | host tokens list, add, remove |
| `GitPanel/NotARepo/` | Initialize repository |
| `GitPanel/ConfirmModal/` | small confirm dialog over `components/Modal` |

Plug-in edits to upstream files: `bruno-electron/src/index.js` (register), `bruno-app/src/components/RequestTabPanel/index.js`, `RequestTabs/RequestTab/index.js` (`specialTabs`), `RequestTabs/RequestTab/SpecialTab.js`, `Sidebar/Collections/Collection/CollectionRow/index.jsx` (menu item), `Sidebar/Sections/CollectionsSection/index.js` (workspace menu item), `tests/utils/page/locators.ts` and `tests/utils/page/index.ts`, `.github/workflows/tests-linux.yml`.

---

### Task 1: Repo core, auth helpers and token store

**Files:**
- Create: `packages/bruno-electron/src/utils/git-panel/repo.js`, `auth.js`, `__tests__/helpers.js`, `repo.spec.js`, `auth.spec.js`
- Create: `packages/bruno-electron/src/store/git-credentials.js`

**Interfaces:**
- Produces (`repo.js`):
  - `resolveRepo(targetPath: string) => Promise<{ repoRoot: string, scope: string } | null>`: `null` when not inside a repo. `scope` is the posix path of `targetPath` relative to `repoRoot`, `'.'` at the root.
  - `withRepoLock(repoRoot: string, fn: () => Promise<T>) => Promise<T>`: runs calls for the same `repoRoot` one at a time. A failure doesn't block later calls.
  - `localGit(repoRoot) => SimpleGit`: fresh instance, env `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, `GIT_LITERAL_PATHSPECS=1`, `GIT_OPTIONAL_LOCKS=0`.
  - `networkGit(repoRoot, remoteUrl) => SimpleGit`: as `localGit`, plus `timeout: { block: 60000 }`, plus credential config from `auth.js` when a token exists for the URL's host.
  - `getOperation(repoRoot) => Promise<null | 'merge' | 'rebase'>`: uses `rev-parse --git-path MERGE_HEAD | rebase-merge | rebase-apply`.
  - `assertBranchName(git, name)`, `assertSafeArg(value, label)`: throw `Error('<label> is not valid')`.
  - `toGitError(error, secrets?: string[]) => Error`: message is git's stderr through `scrubSecrets`.
- Produces (`auth.js`): `hostFromRemoteUrl(url) => string | null` (lowercase host with port, HTTPS/HTTP only), `credentialConfig() => string[]` (`['credential.helper=', 'credential.helper=!f() { echo "username=$HANUMAN_GIT_USERNAME"; echo "password=$HANUMAN_GIT_TOKEN"; }; f']`), `scrubSecrets(text, secrets) => string` (removes each secret and rewrites `//user:pass@` to `//***@`), `redactUrl(url) => string`.
- Produces (`store/git-credentials.js`): `gitCredentialStore.{ list(): {host, username}[], get(host): {username, token} | null, set(host, username, token), remove(host) }`.

- [ ] **Step 1: Write the test helpers.** `createRemoteAndClones(tmpDir, names = ['a'])` creates `remote.git` (bare, default branch `main`), clones it, sets `user.name`/`user.email` in each clone, writes `collection/bruno.json` and `collection/ping.bru` in the first clone, commits and pushes, then clones the rest. Returns `{ remote, clones: { a, b } }`. Use `execFileSync('git', args, { cwd })`.
- [ ] **Step 2: Write failing specs.**
  - `resolveRepo` returns `{ repoRoot: realpath(clone), scope: 'collection' }` for `clone/collection`, `scope: '.'` for the clone root, `null` for a plain temp dir, and works under a parent folder named `my.github`.
  - `withRepoLock runs calls for the same repo in order`: two calls whose first awaits a 50 ms timer record `['1-start','1-end','2-start','2-end']`, and a rejected first call doesn't stop the second.
  - `getOperation` is `null` on a clean clone and `'merge'` after a conflicting `git merge`.
  - `scrubSecrets('fatal: https://bob:s3cr3t@host/x and s3cr3t', ['s3cr3t'])` contains neither `s3cr3t` nor `bob:`.
  - `hostFromRemoteUrl`: `https://GitHub.com/a/b.git` → `github.com`, `https://h:8443/x` → `h:8443`, `git@github.com:a/b.git` → `null`.
  - `assertBranchName` rejects `-x`, `a..b` and `feature/ok~`, and accepts `feature/x`.
- [ ] **Step 3: Run** `npm test --workspace=packages/bruno-electron -- src/utils/git-panel` and confirm the specs fail.
- [ ] **Step 4: Implement** `repo.js`, `auth.js` and `store/git-credentials.js`.
- [ ] **Step 5: Run the specs. Expected: PASS.**
- [ ] **Step 6: Commit** `feat(git-panel): repo resolution, per-repo lock and credential helpers`.

### Task 2: Status and changes

**Files:** Create `git-panel/status.js`, `changes.js`, `status.spec.js`, `changes.spec.js`.

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `getPanelStatus(targetPath) => Promise<PanelStatus>`:
    ```
    PanelStatus = { isRepo: false } | {
      isRepo: true, repoRoot, scope, hasCommits, branch: string|null, detached: boolean,
      upstream: string|null, ahead: number, behind: number, operation: null|'merge'|'rebase',
      repoHasTrackedChanges: boolean,           // repo-wide, for the checkout prompt
      files: Array<{ path: string /* repo-relative posix */, from?: string,
                     staged: 'A'|'M'|'D'|'R'|null, unstaged: 'M'|'D'|'?'|null, conflicted: boolean }>,
      remotes: Array<{ name, url /* redacted */ }>
    }
    ```
    The file list comes from `status(['--', scope])`. `hasCommits` comes from `rev-parse --verify HEAD`.
  - `stageFiles(targetPath, paths[])`, `unstageFiles(targetPath, paths[])`, `discardFiles(targetPath, paths[])`, `commit(targetPath, message) => { commit: string }`, `getFileDiff(targetPath, { path, area: 'staged'|'unstaged' }) => { oldContent, newContent, oldParsed, newParsed, visual: boolean }`.
  - Every `paths` entry is repo-relative and must lie inside the scope, or the call throws `Path is outside this collection`.

- [ ] **Step 1: Write failing specs.**
  - A modified tracked file shows as `unstaged: 'M'`. After `stageFiles` it is `staged: 'M', unstaged: null`. A new file shows as `unstaged: '?'`. A file outside `collection/` doesn't appear.
  - `unstageFiles` works in a fresh `git init` repo with no commits.
  - `discardFiles` restores a modified file and deletes an untracked one, and leaves a file outside the scope alone.
  - `commit` without a message throws `Commit message is required`. `commit` returns the new sha, and status is empty afterwards.
  - `getFileDiff` on a modified `.bru` returns `visual: true` and `newParsed.request.url` equal to the new URL.
  - Index `M` + worktree `D` shows as `staged: 'M', unstaged: 'D'`.
  - `getPanelStatus` on a temp dir returns `{ isRepo: false }`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Use `withRepoLock` around every write. `unstageFiles` uses `restore --staged --` when `hasCommits` is true, otherwise `rm --cached --`. `discardFiles` uses `checkout --` for tracked files and `clean -f --` for untracked ones. `getFileDiff` reuses upstream `getWorkingFileContentForVisualDiff` and `supportsVisualDiff`.
- [ ] **Step 4: Run. Expected: PASS.**
- [ ] **Step 5: Commit** `feat(git-panel): scoped status, stage, unstage, discard, commit and diff`.

### Task 3: Fetch, pull, push with tokens

**Files:** Create `git-panel/sync.js`, `sync.spec.js`.

**Interfaces:**
- Produces: `fetchRemote(targetPath, { remote? })` (all remotes with `--prune` when omitted), `pull(targetPath, { mode: 'merge'|'rebase' })`, `push(targetPath, { remote = 'origin' })`.
  - `push` sets upstream (`push -u <remote> HEAD`) when the branch has none.
  - `pull` throws `This branch has no upstream. Push it first or set one.` when there's no upstream.
  - All three use `networkGit` with the remote's URL, and reject through `toGitError(err, [token])`.

- [ ] **Step 1: Write failing specs** against the bare remote.
  - A pushes a commit and B pulls (merge): B's `HEAD` matches A's.
  - Pull with `mode: 'rebase'` over a local commit gives linear history (`rev-list --merges` is empty).
  - Push on a new branch sets upstream.
  - `pull` with no upstream rejects with the message above.
  - `fails fast when the server asks for credentials`: start a local `http` server that answers 401 with `WWW-Authenticate: Basic`, add it as remote `x` with a token stored for its host. `fetchRemote(..., { remote: 'x' })` rejects within 15 s, and the message doesn't contain the token.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Set env `HANUMAN_GIT_USERNAME` and `HANUMAN_GIT_TOKEN` only on the `networkGit` instance.
- [ ] **Step 4: Run. Expected: PASS.**
- [ ] **Step 5: Commit** `feat(git-panel): fetch, pull (merge/rebase) and push with per-host tokens`.

### Task 4: Branches, remotes and init

**Files:** Create `git-panel/branches.js`, `remotes.js`, `branches.spec.js`, `remotes.spec.js`.

**Interfaces:**
- Produces:
  - `listBranches(targetPath) => { current, local: [{ name, upstream, ahead, behind }], remote: string[] /* 'origin/x', excludes '*/HEAD' */ }`.
  - `createBranch(targetPath, { name, startPoint? })` (creates and checks out).
  - `checkoutBranch(targetPath, { name })`: for `origin/x` with no local `x`, `checkout --track`. Otherwise a plain checkout.
  - `deleteBranch(targetPath, { name, force = false })`: rejects deleting the current branch.
  - `listRemotes`, `addRemote(targetPath, { name, url })`, `setRemoteUrl(targetPath, { name, url })`, `removeRemote(targetPath, { name })`.
  - `initRepository(targetPath)`: `git init` at `targetPath`, then `symbolic-ref HEAD refs/heads/main`. Rejects if `targetPath` is already inside a repo.

- [ ] **Step 1: Write failing specs.**
  - Create `feature/x` and confirm `current === 'feature/x'`.
  - Check out `origin/dev` (pushed from A) in B, and confirm a local `dev` tracks `origin/dev`.
  - Deleting an unmerged branch without force rejects with git's "not fully merged" text. With force it succeeds.
  - Deleting the current branch rejects.
  - Bad names reject.
  - `addRemote` then `setRemoteUrl` changes `remote get-url`.
  - `initRepository` on a plain dir gives `branch === 'main'` and `hasCommits === false`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run. Expected: PASS.**
- [ ] **Step 5: Commit** `feat(git-panel): branches, remotes and git init`.

### Task 5: Stash and conflicts

**Files:** Create `git-panel/stash.js`, `conflicts.js`, `stash.spec.js`, `conflicts.spec.js`.

**Interfaces:**
- Produces:
  - `stashPush(targetPath, { message, repoWide = false })`: `stash push -u -m <message> [-- scope]`.
  - `listStashes(targetPath)` (upstream shape).
  - `stashApply`, `stashPop` and `stashDrop`, each `(targetPath, { index })`.
  - `getConflict(targetPath, { path }) => { path, operation, content: string|null, current: string|null, incoming: string|null }`.
  - `resolveConflict(targetPath, { path, choice: 'current'|'incoming'|'content', content? })`:
    - `current` maps to `checkout --ours`, `incoming` maps to `--theirs`.
    - If the chosen side has no version, use `git rm --`.
    - `content` writes the file.
    - Each choice then runs `add --`.
    - Rejects `content` that still has a `<<<<<<<` line.
  - `continueOperation(targetPath)`:
    - merge: `commit --no-edit`.
    - rebase: `rebase --continue` with env `GIT_EDITOR=true`.
    - none: throws `No merge or rebase in progress`.
    - Rejects while conflicts remain.
  - `abortOperation(targetPath)`: `merge --abort` or `rebase --abort`.

- [ ] **Step 1: Write failing specs.**
  - Stash, then pop: the file is restored and the list is empty.
  - Stash with a scope leaves a change outside the scope in place.
  - **Merge conflict:** A and B edit the same line and B pulls with merge, which rejects. Status shows `conflicted: true` and `operation: 'merge'`. Resolve `incoming` and continue: the merge commit exists and the file equals A's version.
  - **Rebase conflict:** the same setup with `mode: 'rebase'` gives `operation: 'rebase'`. Resolve `current` and continue, and the operation becomes `null`.
  - **Stash-pop conflict:** pop over a conflicting change gives a conflicted file with `operation: null`. `resolveConflict` with content succeeds, and the stash is still listed.
  - `resolveConflict` with content that still holds markers rejects.
  - `abortOperation` during a merge restores B's pre-pull `HEAD`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run. Expected: PASS.**
- [ ] **Step 5: Commit** `feat(git-panel): stash and merge/rebase conflict resolution`.

### Task 6: IPC module

**Files:**
- Create: `packages/bruno-electron/src/ipc/git-panel.js`, `ipc/git-panel.spec.js`, `utils/git-panel/index.js`
- Modify: `packages/bruno-electron/src/index.js` (require and call `registerGitPanelIpc(mainWindow)` beside `registerGitIpc`)

**Interfaces:**
- Produces channels (one object argument each, `targetPath` required on all but the credential ones):
  - `renderer:git-panel:status`, `:stage`, `:unstage`, `:discard`, `:commit`, `:diff`
  - `:fetch`, `:pull`, `:push`
  - `:branches`, `:create-branch`, `:checkout`, `:delete-branch`
  - `:remotes`, `:add-remote`, `:set-remote-url`, `:remove-remote`, `:init`
  - `:stash-push`, `:stashes`, `:stash-apply`, `:stash-pop`, `:stash-drop`
  - `:conflict`, `:resolve-conflict`, `:continue`, `:abort`
  - `:credentials`, `:set-credential`, `:remove-credential`
- Handlers are exported as `handleGitPanel(channelSuffix, args)`. It validates that `targetPath` is an absolute string, then calls the util. Errors propagate as rejections (CRUD convention). `:credentials` returns hosts and usernames, never tokens.

- [ ] **Step 1: Write failing specs.**
  - `handleGitPanel('status', { targetPath: 'relative' })` rejects with `targetPath must be an absolute path`.
  - `handleGitPanel('nope', {})` rejects.
  - `handleGitPanel('credentials')` returns no `token` key after a `set-credential`. Mock `electron-store` and `utils/encryption` as `store/tests` does.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement** a channel map plus a `register` loop. Add the line to `index.js`.
- [ ] **Step 4: Run the whole bruno-electron suite. Expected: PASS.**
- [ ] **Step 5: Commit** `feat(git-panel): IPC channels`.

### Task 7: Tab plumbing, container, toolbar

**Files:**
- Create: `GitPanel/index.js`, `StyledWrapper.js`, `useGitPanel/index.js`, `utils/index.js`, `utils/index.spec.js`, `Toolbar/`, `NotARepo/`, `ConfirmModal/`
- Modify: `RequestTabPanel/index.js` (one `if (focusedTab.type === 'git')` block after the collection lookup), `RequestTab/index.js` (`'git'` in `specialTabs`), `SpecialTab.js` (case `git`: `IconGitBranch`, label `Git`), `CollectionRow/index.jsx` (menu item `id: 'git'`, `testId: 'collection-actions-git'`, next to `sync-openapi`), `CollectionsSection/index.js` (item `Git (workspace)`, hidden when `activeWorkspace.type === 'default'`)

**Interfaces:**
- Produces:
  - `getGitPanelTab(collectionUid) => { uid: \`${collectionUid}-git\`, collectionUid, type: 'git', preview: false }`.
  - `hasUnsavedDraftsInRepo(collections, repoRoot) => number`: counts item and collection drafts in collections whose `pathname` is inside `repoRoot`, compared with `normalizePath`.
  - `groupFiles(files) => { conflicts, staged, changes }`.
  - `useGitPanel(targetPath) => { status, busy, error, clearError, refresh, run(channelSuffix, args, { confirmDrafts? }) }`. `run` invokes `renderer:git-panel:<suffix>`, sets `error` to `formatIpcError(err)` and shows a toast on failure, and always refreshes afterwards.
  - The panel's target path is `collection.pathname`, or `activeWorkspace.pathname` for the scratch collection.
- `data-testid`s: `git-panel`, `git-branch-button`, `git-ahead`, `git-behind`, `git-fetch`, `git-pull`, `git-pull-merge`, `git-pull-rebase`, `git-push`, `git-refresh`, `git-init`, `git-error`, `git-repo-wide-note`.

- [ ] **Step 1: Write failing unit specs** for `groupFiles` (a conflicted file goes only to `conflicts`, a file with both staged and unstaged goes to both) and `hasUnsavedDraftsInRepo` (counts drafts under the repo and ignores a collection outside it).
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - When `gitVersion` is null, render `GitNotFoundModal`.
  - `NotARepo` shows the target path and an **Initialize repository** button.
  - The toolbar shows the branch name, `↑ahead ↓behind`, Fetch, Pull ▾ (MenuDropdown: "Pull (merge)" and "Pull (rebase)"), Push, Refresh, and an overflow menu (Remotes…, Access tokens…).
  - When `scope !== '.'`, show the note "Branch, pull and push affect the whole repository".
  - Pull, checkout, stash and discard call `run` with `confirmDrafts: true`, which shows `ConfirmModal` when `hasUnsavedDraftsInRepo > 0`.
- [ ] **Step 4: Run the bruno-app specs. Expected: PASS. Then `npm run dev`:** "..." → Git opens one tab, a second click focuses it, and a non-repo collection shows Initialize.
- [ ] **Step 5: Commit** `feat(git-panel): Git tab, toolbar and repo init`.

### Task 8: Change list, commit box, diff

**Files:** Create `GitPanel/ChangeList/`, `CommitBox/`, `FileDiff/` (+ `FileDiff/TextDiff/`).

**Interfaces:**
- Consumes: `useGitPanel`, `groupFiles`, IPC `diff`.
- Rows have `data-testid="git-file-row"`, `data-path=<repo-relative>`, `data-area="staged|changes|conflicts"`, and action buttons `git-stage`, `git-unstage`, `git-discard`. Section actions are `git-stage-all`, `git-unstage-all` and `git-discard-all`.
- Discard always asks through `ConfirmModal` (`Discard changes to N files? Untracked files will be deleted.`).
- `CommitBox`: `git-commit-message` (textarea) and `git-commit` (disabled when nothing is staged or the message is blank). Cmd/Ctrl+Enter commits.
- `FileDiff`: when `visual`, render `VisualDiffContent` with the section config pattern from `OpenAPISyncTab/EndpointChangeSection/EndpointVisualDiff.js` (url, params, headers, auth, body) and labels `HEAD`/`Index` (staged) or `Index`/`Working tree` (changes). Otherwise, or when the "Text" toggle is on, `TextDiff` renders `diffLines(old ?? '', new ?? '')` with `+`/`-` gutters. `data-testid="git-diff"`.

- [ ] **Step 1: Implement the components.**
- [ ] **Step 2: Verify in `npm run dev`** against a scratch repo: edit a request, see it under Changes, view the visual diff, stage, commit, and confirm the list empties.
- [ ] **Step 3: Commit** `feat(git-panel): change list, commit box and diffs`.

### Task 9: Branch menu, stash list, remotes and tokens modals

**Files:** Create `GitPanel/BranchMenu/`, `StashList/`, `RemotesModal/`, `CredentialsModal/`.

**Interfaces:**
- `BranchMenu` (opened by `git-branch-button`):
  - Local and remote branch rows, `data-testid="git-branch-item"` with `data-branch`. Clicking checks out. A trash icon `git-branch-delete` confirms, then offers force when git answers "not fully merged".
  - **Create branch…** (`git-create-branch`) opens an input `git-new-branch-name` with a confirm button `git-create-branch-confirm`.
  - Before checkout or create, if `status.repoHasTrackedChanges`, ask: "You have uncommitted changes. Stash them and switch?" with buttons Stash & switch (`git-stash-and-switch`), Switch anyway, and Cancel. Stash & switch runs `stash-push` with `repoWide: true` and message `Before switching to <name>`.
- `StashList`: `git-stash-message` and `git-stash-push`, rows `git-stash-item` with `git-stash-apply`, `git-stash-pop` and `git-stash-drop` (drop confirms).
- `RemotesModal`: lists remotes with editable URL (`git-remote-url`), add (`git-remote-add-name`, `git-remote-add-url`, `git-remote-add`), remove.
- `CredentialsModal`: lists host and username, plus a form for host, username and token (password input), and remove. It states where tokens are stored: "encrypted on this computer, never written to the collection".

- [ ] **Step 1: Implement the components.**
- [ ] **Step 2: Verify in `npm run dev`:** create and switch branches, the stash prompt, stash pop, adding a remote, and adding and removing a token. The token must not appear in `ai-keys`-style plain JSON (open `git-credentials.json` and confirm the value is ciphertext).
- [ ] **Step 3: Commit** `feat(git-panel): branches, stash, remotes and access tokens UI`.

### Task 10: Conflict resolver and operation banner

**Files:** Create `GitPanel/ConflictResolver/`, `OperationBanner/`.

**Interfaces:**
- `OperationBanner`, shown when `status.operation` is set:
  - Text: "Merge in progress" or "Rebase in progress", plus the count of conflicts.
  - `git-continue` is disabled while conflicts remain. Merge passes no message, because git's `MERGE_MSG` is used.
  - `git-abort` confirms first.
- `ConflictResolver` (shown for a selected conflicted file):
  - Buttons `git-use-current` and `git-use-incoming`, with captions from `conflictLabels(operation)`:
    - merge: Current = "your branch", Incoming = "the branch being merged".
    - rebase: Current = "the branch you are rebasing onto", Incoming = "your commit being replayed".
    - stash pop: Current = "your working tree", Incoming = "the stash".
  - Editing uses `components/CodeEditor` (`git-conflict-editor`) loaded with the marker content, plus `git-mark-resolved`, which sends `choice: 'content'`.
  - Errors from git show in the panel's error banner.

- [ ] **Step 1: Add a `conflictLabels` unit spec** in `utils/index.spec.js` covering the three operations. Run it and confirm it fails.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify in `npm run dev`** with a hand-made merge conflict: both buttons and the manual edit end with a clean status and a merge commit.
- [ ] **Step 4: Commit** `feat(git-panel): conflict resolver and merge/rebase banner`.

### Task 11: E2E and CI

**Files:**
- Create: `tests/utils/page/git/git-panel.ts`, `tests/git-panel/helpers.ts`, `tests/git-panel/commit-push-pull.spec.ts`, `tests/git-panel/conflict.spec.ts`, `tests/git-panel/branch-and-stash.spec.ts`
- Modify: `tests/utils/page/locators.ts` (map `gitPanel` in `buildCommonLocators`), `tests/utils/page/index.ts` (re-export), `.github/workflows/tests-linux.yml` (new job `git-panel-e2e` on `pull_request`: the e2e job's setup steps, then `xvfb-run dbus-run-session -- npx playwright test tests/git-panel --project=default`)

**Interfaces:**
- `tests/git-panel/helpers.ts`:
  - `setupRepos(tmpDir) => { remote, a, b }`: reuses `runGit` from `tests/collection/git/helpers.ts` and mirrors the Jest helper. The collection is `Git Panel Collection` with request `ping`.
  - `requireGit()`: throws when `process.env.CI` is set and git is missing; otherwise it calls `test.skip`.
- Page module actions: `openGitPanel(page, collectionName)`, `stageFile(page, path)`, `commit(page, message)`, `pull(page, mode)`, `push(page)`, `createBranch(page, name)`, `switchBranch(page, name)`, `stashPush(page, message)`, `stashPop(page)`, `selectFile(page, area, path)`.

- [ ] **Step 1: Write `commit-push-pull.spec.ts` (cases 1 and 2).**
  - Open A, change the `ping` URL to `https://example.com/from-a` and save.
  - In the Git panel, stage `collection/ping.bru`, commit "change url from A" and push.
  - **Positive control:** `runGit(remote, ['log','-1','--format=%s'])` equals `change url from A`.
  - `removeCollection`, open B, open the Git panel, check that `git-behind` shows 1 after Fetch, then Pull (merge).
  - Open `ping` and check that the URL editor contains `from-a`.
- [ ] **Step 2: Write `conflict.spec.ts` (case 3).**
  - With shell git in A, set the URL to `from-a`, commit and push.
  - In the app on B, set the URL to `from-b`, save, stage, commit and Pull (merge).
  - `git-operation-banner` shows merge, and the conflicts section has `collection/ping.bru`.
  - Select it, click `git-use-incoming` and then `git-continue`.
  - Expect: the banner is gone, `runGit(b, ['rev-list','--merges','-1','HEAD'])` is non-empty, and the file contains `from-a`.
- [ ] **Step 3: Write `branch-and-stash.spec.ts` (cases 4 and 5).**
  - Create `feature/x`. The branch button reads `feature/x`, and `currentGitBranch(a)` matches.
  - Edit the URL and save, then switch to `main`. Accept Stash & switch. Expect the branch is `main` and one stash row exists.
  - Switch back to `feature/x` and click `git-stash-pop`. Expect the stash list is empty and `ping.bru` contains the edited URL.
- [ ] **Step 4: Run** `npx playwright test tests/git-panel --project=default` locally. Expected: 3 passed.
- [ ] **Step 5: Add the CI job, then commit** `test(git-panel): e2e against a local bare repo, run on PRs`.

### Task 12: Docs, full checks, build, PR

- [ ] **Step 1: Update `docs/UPSTREAM-SYNC.md`** with a "เฟส 1" section listing every upstream file touched in Tasks 6, 7 and 11, plus the CI job. Add a short Git panel section to `readme.md`, in Thai and English.
- [ ] **Step 2: Run the checks.** `npm run lint`, `node scripts/hanuman/check-fork-invariants.js`, `npm test --workspace=packages/bruno-app`, `npm test --workspace=packages/bruno-electron`, and the Playwright run from Task 11. Expected: all pass.
- [ ] **Step 3: Build the macOS arm64 app locally** (`ELECTRON_BUILDER_ARGS='--mac dir --arm64' npm run build:electron` or the repo's `scripts/hanuman` build), launch it, and open a Git tab on a real repo.
- [ ] **Step 4: Request the whole-branch review** (superpowers:requesting-code-review) and fix what it confirms.
- [ ] **Step 5: Push and open the PR** into `main`, stacked on PR #19, with a test summary and the notes from Decisions 7 and 9. Make sure CI is green.
- [ ] **Step 6: Ask Arm** before merging, tagging `v0.2.0` or releasing.
