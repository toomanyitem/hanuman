import React, { useCallback, useEffect, useState } from 'react';
import { IconTrash, IconCheck } from '@tabler/icons';
import Modal from 'components/Modal';
import Portal from 'components/Portal';
import ActionIcon from 'ui/ActionIcon';
import Button from 'ui/Button';
import TextInput from 'ui/TextInput';
import { formatIpcError } from 'utils/common/error';
import { invokeGit } from '../useGitPanel';
import ConfirmModal from '../ConfirmModal';

const BranchesModal = ({ targetPath, status, busyAction, run, confirmDrafts, onClose }) => {
  const [branches, setBranches] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [pendingSwitch, setPendingSwitch] = useState(null);
  const [branchToDelete, setBranchToDelete] = useState(null);

  const loadBranches = useCallback(
    () =>
      invokeGit('branches', { targetPath })
        .then(setBranches)
        .catch((err) => setLoadError(formatIpcError(err) || 'Could not list branches')),
    [targetPath]
  );

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const switchBranch = async ({ action, name, stashFirst }) => {
    if (stashFirst) {
      const stashed = await run('stash-push', { repoWide: true, message: `Before switching to ${name}` });
      if (!stashed.ok) return;
    }
    const result = await run(action, { name }, { successMessage: `Switched to ${name}` });
    if (result.ok) onClose();
  };

  // Checkout rewrites files across the whole repo, so uncommitted work anywhere in it is offered a stash first.
  const requestSwitch = (action, name) =>
    confirmDrafts(action === 'create-branch' ? 'Creating a branch' : 'Switching branches', () => {
      if (status.repoHasTrackedChanges) {
        setPendingSwitch({ action, name });
      } else {
        switchBranch({ action, name, stashFirst: false });
      }
    });

  const deleteBranch = async (name, force) => {
    const result = await run('delete-branch', { name, force }, { successMessage: `Deleted ${name}` });
    if (!result.ok && !force && /not fully merged/i.test(result.error)) {
      setBranchToDelete({ name, needsForce: true });
      return;
    }
    loadBranches();
  };

  return (
    <Portal>
      <Modal size="md" title="Branches" hideFooter handleCancel={onClose} dataTestId="git-branches-modal">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 items-end">
            <TextInput
              className="flex-1"
              label="New branch from the current HEAD"
              placeholder="feature/my-change"
              value={newBranchName}
              onChange={(event) => setNewBranchName(event.target.value)}
              data-testid="git-new-branch-name"
            />
            <Button
              disabled={!newBranchName.trim()}
              loading={busyAction === 'create-branch'}
              onClick={() => requestSwitch('create-branch', newBranchName.trim())}
              data-testid="git-create-branch-confirm"
            >
              Create and switch
            </Button>
          </div>

          {loadError && <div className="text-sm" data-testid="git-branches-error">{loadError}</div>}
          {branches && (
            <>
              <div className="text-xs font-semibold uppercase opacity-70">Local</div>
              {branches.local.map((branch) => (
                <div key={branch.name} className="flex items-center gap-2 text-sm" data-testid="git-branch-item" data-branch={branch.name}>
                  <span className="w-4">{branch.name === branches.current && <IconCheck size={14} />}</span>
                  <span className="flex-1 truncate">{branch.name}</span>
                  {branch.upstream && (
                    <span className="text-xs opacity-70">
                      {branch.upstream} ↑{branch.ahead} ↓{branch.behind}
                    </span>
                  )}
                  {branch.name !== branches.current && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => requestSwitch('checkout', branch.name)} data-testid="git-branch-switch">
                        Switch
                      </Button>
                      <ActionIcon size="sm" label="Delete branch" onClick={() => setBranchToDelete({ name: branch.name, needsForce: false })} data-testid="git-branch-delete">
                        <IconTrash size={14} strokeWidth={1.5} />
                      </ActionIcon>
                    </>
                  )}
                </div>
              ))}
              {branches.remote.length > 0 && <div className="text-xs font-semibold uppercase opacity-70">Remote</div>}
              {branches.remote.map((name) => (
                <div key={name} className="flex items-center gap-2 text-sm" data-testid="git-remote-branch-item" data-branch={name}>
                  <span className="w-4" />
                  <span className="flex-1 truncate">{name}</span>
                  <Button size="sm" variant="ghost" onClick={() => requestSwitch('checkout', name)} data-testid="git-branch-switch">
                    Check out
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      </Modal>

      {pendingSwitch && (
        <ConfirmModal
          title="You have uncommitted changes"
          confirmText="Stash and switch"
          confirmButtonColor="primary"
          testId="git-stash-and-switch"
          onCancel={() => setPendingSwitch(null)}
          onConfirm={() => {
            const next = pendingSwitch;
            setPendingSwitch(null);
            switchBranch({ ...next, stashFirst: true });
          }}
          footerLeft={(
            <Button
              variant="ghost"
              color="secondary"
              onClick={() => {
                const next = pendingSwitch;
                setPendingSwitch(null);
                switchBranch({ ...next, stashFirst: false });
              }}
              data-testid="git-switch-anyway"
            >
              Switch anyway
            </Button>
          )}
        >
          Stash them first so they can be popped back later? Switching anyway carries them over, or fails if they clash
          with {pendingSwitch.name}.
        </ConfirmModal>
      )}

      {branchToDelete && (
        <ConfirmModal
          title={branchToDelete.needsForce ? `${branchToDelete.name} is not merged` : `Delete ${branchToDelete.name}?`}
          confirmText={branchToDelete.needsForce ? 'Delete anyway' : 'Delete'}
          testId="git-branch-delete-confirm"
          onCancel={() => setBranchToDelete(null)}
          onConfirm={() => {
            const { name, needsForce } = branchToDelete;
            setBranchToDelete(null);
            deleteBranch(name, needsForce);
          }}
        >
          {branchToDelete.needsForce
            ? 'Its commits are not on any other branch. Deleting it may lose them.'
            : 'The local branch is deleted. The remote branch, if any, stays.'}
        </ConfirmModal>
      )}
    </Portal>
  );
};

export default BranchesModal;
