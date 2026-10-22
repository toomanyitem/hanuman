import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import ErrorBanner from 'ui/ErrorBanner';
import Button from 'ui/Button';
import GitNotFoundModal from 'components/Git/GitNotFoundModal';
import useGitPanel from './useGitPanel';
import { groupFiles, countUnsavedDraftsInRepo, getRepoRootInAppPaths } from './utils';
import Toolbar from './Toolbar';
import NotARepo from './NotARepo';
import OperationBanner from './OperationBanner';
import CommitBox from './CommitBox';
import ChangeList from './ChangeList';
import StashList from './StashList';
import FileDiff from './FileDiff';
import ConflictResolver from './ConflictResolver';
import BranchesModal from './BranchesModal';
import RemotesModal from './RemotesModal';
import CredentialsModal from './CredentialsModal';
import ConfirmModal from './ConfirmModal';
import StyledWrapper from './StyledWrapper';

const GitPanelContent = ({ targetPath }) => {
  const collections = useSelector((state) => state.collections.collections);
  const { status, stashes, busyAction, error, clearError, refresh, run } = useGitPanel(targetPath);
  const [selected, setSelected] = useState(null);
  const [openModal, setOpenModal] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const errorBanner = error && (
    <div data-testid="git-error">
      <ErrorBanner errors={[{ title: 'Git', message: error }]} onClose={clearError} />
    </div>
  );

  if (!status) {
    return error ? (
      <>
        {errorBanner}
        <div className="p-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearError(); refresh();
            }}
            data-testid="git-retry"
          >
            Retry
          </Button>
        </div>
      </>
    ) : (
      <div className="p-4 text-sm opacity-70">Reading the repository…</div>
    );
  }

  if (!status.isRepo) {
    return (
      <>
        {errorBanner}
        <NotARepo targetPath={targetPath} busy={busyAction === 'init'} onInit={() => run('init', {}, { successMessage: 'Repository initialized' })} />
      </>
    );
  }

  const groups = groupFiles(status.files);
  const selectedFile = selected && groups[selected.area].some((file) => file.path === selected.path) ? selected : null;
  const unsavedDrafts = countUnsavedDraftsInRepo(collections, getRepoRootInAppPaths(targetPath, status.scope));

  // Resolves with the action's result, or { ok: false } when the user cancels.
  const askToConfirm = ({ title, confirmText, message }, action) =>
    new Promise((resolve) => {
      setPendingConfirm({
        title,
        confirmText,
        message,
        onConfirm: () => resolve(action()),
        onCancel: () => resolve({ ok: false })
      });
    });

  // Checkout, pull, stash and discard rewrite files on disk under any request still being edited in a tab.
  const confirmDrafts = async (actionLabel, action) => {
    if (unsavedDrafts === 0) return action();
    return askToConfirm({
      title: 'Unsaved requests',
      confirmText: 'Continue',
      message: `${unsavedDrafts} unsaved request change${unsavedDrafts === 1 ? '' : 's'} in this repository. ${actionLabel} changes files on disk, and the unsaved edits may no longer match them. Save first if you want them included.`
    }, action);
  };

  const discard = (paths) =>
    askToConfirm({
      title: 'Discard changes?',
      confirmText: 'Discard',
      message: `Discard changes to ${paths.length} file${paths.length === 1 ? '' : 's'}? Untracked files are deleted. This cannot be undone.`
    }, () => confirmDrafts('Discarding', () => run('discard', { paths })));

  const commitDisabledReason = status.operation ? `Finish the ${status.operation} with the button above` : null;

  return (
    <>
      <Toolbar
        status={status}
        busyAction={busyAction}
        onOpenBranches={() => setOpenModal('branches')}
        onFetch={() => run('fetch', {}, { successMessage: 'Fetched' })}
        onPull={(mode) => confirmDrafts('Pulling', () => run('pull', { mode }, { successMessage: 'Pulled' }))}
        onPush={() => run('push', {}, { successMessage: 'Pushed' })}
        onRefresh={refresh}
        onOpenRemotes={() => setOpenModal('remotes')}
        onOpenTokens={() => setOpenModal('tokens')}
      />
      {errorBanner}
      {status.operation && <OperationBanner operation={status.operation} conflictCount={groups.conflicts.length} busyAction={busyAction} run={run} />}
      <div className="git-body flex flex-1 min-h-0">
        <div className="git-sidebar flex flex-col overflow-auto">
          <CommitBox
            stagedCount={groups.staged.length}
            stagedOutsideScope={status.stagedOutsideScope}
            disabledReason={commitDisabledReason}
            busy={busyAction === 'commit'}
            onCommit={(message) => run('commit', { message }, { successMessage: 'Committed' })}
          />
          <div className="flex-1">
            <ChangeList
              groups={groups}
              scope={status.scope}
              selected={selectedFile}
              onSelect={setSelected}
              onStage={(paths) => run('stage', { paths })}
              onUnstage={(paths) => run('unstage', { paths })}
              onDiscard={discard}
            />
          </div>
          <StashList
            stashes={stashes}
            hasChanges={status.files.length > 0}
            busyAction={busyAction}
            onStash={(message) => confirmDrafts('Stashing', () => run('stash-push', { message }, { successMessage: 'Stashed' }))}
            run={run}
          />
        </div>
        <div className="git-detail flex-1 min-w-0">
          {selectedFile && selectedFile.area === 'conflicts' && (
            <ConflictResolver key={selectedFile.path} targetPath={targetPath} filePath={selectedFile.path} busyAction={busyAction} run={run} />
          )}
          {selectedFile && selectedFile.area !== 'conflicts' && <FileDiff targetPath={targetPath} file={selectedFile} />}
          {!selectedFile && <div className="p-4 text-sm opacity-70">Select a file to see its changes.</div>}
        </div>
      </div>

      {openModal === 'branches' && (
        <BranchesModal targetPath={targetPath} status={status} busyAction={busyAction} run={run} confirmDrafts={confirmDrafts} onClose={() => setOpenModal(null)} />
      )}
      {openModal === 'remotes' && <RemotesModal remotes={status.remotes} busyAction={busyAction} run={run} onClose={() => setOpenModal(null)} />}
      {openModal === 'tokens' && <CredentialsModal onClose={() => setOpenModal(null)} />}
      {pendingConfirm && (
        <ConfirmModal
          title={pendingConfirm.title}
          confirmText={pendingConfirm.confirmText}
          onCancel={() => {
            pendingConfirm.onCancel();
            setPendingConfirm(null);
          }}
          onConfirm={() => {
            pendingConfirm.onConfirm();
            setPendingConfirm(null);
          }}
        >
          {pendingConfirm.message}
        </ConfirmModal>
      )}
    </>
  );
};

const GitPanel = ({ collection }) => {
  const gitVersion = useSelector((state) => state.app.gitVersion);
  const workspaces = useSelector((state) => state.workspaces.workspaces);
  const [showGitHelp, setShowGitHelp] = useState(false);

  // A workspace's Git tab lives on its scratch collection, whose own folder is a temp dir.
  const workspace = workspaces.find((w) => w.scratchCollectionUid === collection.uid);
  const targetPath = workspace ? workspace.pathname : collection.pathname;

  return (
    <StyledWrapper className="flex flex-col h-full" data-testid="git-panel" data-target={targetPath}>
      {gitVersion ? (
        <GitPanelContent key={targetPath} targetPath={targetPath} />
      ) : (
        <div className="flex flex-col items-center gap-3 p-8 text-sm" data-testid="git-missing">
          Git was not found on this computer. Install Git, then restart Hanuman.
          <Button size="sm" variant="ghost" onClick={() => setShowGitHelp(true)}>
            How to install Git
          </Button>
          {showGitHelp && <GitNotFoundModal onClose={() => setShowGitHelp(false)} />}
        </div>
      )}
    </StyledWrapper>
  );
};

export default GitPanel;
