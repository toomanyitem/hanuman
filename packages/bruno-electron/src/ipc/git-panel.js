const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');
const gitPanel = require('../utils/git-panel');
const collectionWatcher = require('../app/collection-watcher');
const LastOpenedWorkspaces = require('../store/last-opened-workspaces');
const { gitCredentialStore } = require('../store/git-credentials');

const lastOpenedWorkspaces = new LastOpenedWorkspaces();

const repoHandlers = {
  'status': ({ targetPath }) => gitPanel.getPanelStatus(targetPath),
  'stage': ({ targetPath, paths }) => gitPanel.stageFiles(targetPath, paths),
  'unstage': ({ targetPath, paths }) => gitPanel.unstageFiles(targetPath, paths),
  'discard': ({ targetPath, paths }) => gitPanel.discardFiles(targetPath, paths),
  'commit': ({ targetPath, message }) => gitPanel.commit(targetPath, message),
  'diff': ({ targetPath, path: filePath, area }) => gitPanel.getFileDiff(targetPath, { path: filePath, area }),
  'fetch': ({ targetPath, remote }) => gitPanel.fetchRemote(targetPath, { remote }),
  'pull': ({ targetPath, mode }) => gitPanel.pull(targetPath, { mode }),
  'push': ({ targetPath }) => gitPanel.push(targetPath),
  'branches': ({ targetPath }) => gitPanel.listBranches(targetPath),
  'create-branch': ({ targetPath, name }) => gitPanel.createBranch(targetPath, { name }),
  'checkout': ({ targetPath, name }) => gitPanel.checkoutBranch(targetPath, { name }),
  'delete-branch': ({ targetPath, name, force }) => gitPanel.deleteBranch(targetPath, { name, force: force === true }),
  'remotes': ({ targetPath }) => gitPanel.listRemotes(targetPath),
  'add-remote': ({ targetPath, name, url }) => gitPanel.addRemote(targetPath, { name, url }),
  'set-remote-url': ({ targetPath, name, url }) => gitPanel.setRemoteUrl(targetPath, { name, url }),
  'remove-remote': ({ targetPath, name }) => gitPanel.removeRemote(targetPath, { name }),
  'init': ({ targetPath }) => gitPanel.initRepository(targetPath),
  'stash-push': ({ targetPath, message, repoWide }) => gitPanel.stashPush(targetPath, { message, repoWide: repoWide === true }),
  'stashes': ({ targetPath }) => gitPanel.listStashes(targetPath),
  'stash-apply': ({ targetPath, index, hash }) => gitPanel.stashApply(targetPath, { index, hash }),
  'stash-pop': ({ targetPath, index, hash }) => gitPanel.stashPop(targetPath, { index, hash }),
  'stash-drop': ({ targetPath, index, hash }) => gitPanel.stashDrop(targetPath, { index, hash }),
  'conflict': ({ targetPath, path: filePath }) => gitPanel.getConflict(targetPath, { path: filePath }),
  'resolve-conflict': ({ targetPath, path: filePath, choice, content }) => gitPanel.resolveConflict(targetPath, { path: filePath, choice, content }),
  'continue': ({ targetPath }) => gitPanel.continueOperation(targetPath),
  'abort': ({ targetPath }) => gitPanel.abortOperation(targetPath)
};

const HOST_PATTERN = /^[a-z0-9.-]+(:\d+)?$/i;

// Tokens never travel back to the renderer: the list carries hosts and usernames only.
const credentialHandlers = {
  'credentials': () => gitCredentialStore.list(),
  'set-credential': ({ host, username, token }) => {
    const normalizedHost = typeof host === 'string' ? host.trim().toLowerCase() : '';
    if (!HOST_PATTERN.test(normalizedHost)) {
      throw new Error('Host must look like github.com or git.example.com:8443');
    }
    if (typeof username !== 'string' || !username.trim()) {
      throw new Error('Username is required');
    }
    if (typeof token !== 'string' || !token.trim()) {
      throw new Error('Token is required');
    }
    gitCredentialStore.set(normalizedHost, username.trim(), token.trim());
    return gitCredentialStore.list();
  },
  'remove-credential': ({ host }) => {
    gitCredentialStore.remove(String(host));
    return gitCredentialStore.list();
  }
};

const toRealPath = (p) => {
  try {
    return fs.realpathSync.native(p);
  } catch (error) {
    return path.resolve(p);
  }
};

// Git commands run only in open collections and in workspaces the user has opened (the recent-workspaces list),
// so a stray renderer call can't drive git in an arbitrary folder.
const assertOpenTarget = (targetPath) => {
  const watchedCollections = Object.keys(collectionWatcher.watchers || {}).filter((p) => collectionWatcher.watchers[p]);
  const openRoots = [...watchedCollections, ...lastOpenedWorkspaces.getAll()];
  const target = toRealPath(targetPath);
  if (!openRoots.some((root) => toRealPath(root) === target)) {
    throw new Error('Git actions are only available for open collections and workspaces');
  }
};

const handleGitPanel = async (action, args = {}) => {
  if (Object.prototype.hasOwnProperty.call(credentialHandlers, action)) {
    return credentialHandlers[action](args || {});
  }
  if (!Object.prototype.hasOwnProperty.call(repoHandlers, action)) {
    throw new Error(`Unknown Git action: ${action}`);
  }
  const { targetPath } = args || {};
  if (typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) {
    throw new Error('targetPath must be an absolute path');
  }
  assertOpenTarget(targetPath);
  return repoHandlers[action](args);
};

const GIT_PANEL_ACTIONS = [...Object.keys(repoHandlers), ...Object.keys(credentialHandlers)];

const registerGitPanelIpc = () => {
  GIT_PANEL_ACTIONS.forEach((action) => {
    ipcMain.handle(`renderer:git-panel:${action}`, (event, args) => handleGitPanel(action, args));
  });
};

module.exports = registerGitPanelIpc;
module.exports.handleGitPanel = handleGitPanel;
module.exports.GIT_PANEL_ACTIONS = GIT_PANEL_ACTIONS;
