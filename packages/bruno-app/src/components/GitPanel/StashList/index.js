import React, { useState } from 'react';
import { IconArchive, IconArrowUpRight, IconCheck, IconTrash } from '@tabler/icons';
import ActionIcon from 'ui/ActionIcon';
import Button from 'ui/Button';
import ConfirmModal from '../ConfirmModal';
import StyledWrapper from './StyledWrapper';

const StashList = ({ stashes, hasChanges, busyAction, onStash, run }) => {
  const [message, setMessage] = useState('');
  const [stashToDrop, setStashToDrop] = useState(null);

  const stash = async () => {
    const { ok } = await onStash(message);
    if (ok) setMessage('');
  };

  return (
    <StyledWrapper className="p-3 flex flex-col gap-2" data-testid="git-stashes">
      <div className="text-xs font-semibold uppercase opacity-70">Stashes</div>
      <div className="flex gap-2">
        <input
          className="stash-message flex-1"
          placeholder="Stash message (optional)"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          data-testid="git-stash-message"
        />
        <Button size="sm" variant="ghost" icon={<IconArchive size={14} />} disabled={!hasChanges} loading={busyAction === 'stash-push'} onClick={stash} data-testid="git-stash-push">
          Stash
        </Button>
      </div>
      {stashes.map((entry) => (
        <div key={entry.hash || entry.index} className="flex items-center gap-1 text-sm" data-testid="git-stash-item">
          <span className="flex-1 truncate" title={entry.message}>{entry.message}</span>
          <ActionIcon size="sm" label="Apply (keep stash)" onClick={() => run('stash-apply', { index: entry.index }, { successMessage: 'Stash applied' })} data-testid="git-stash-apply">
            <IconCheck size={14} strokeWidth={1.5} />
          </ActionIcon>
          <ActionIcon size="sm" label="Pop (apply and remove)" onClick={() => run('stash-pop', { index: entry.index }, { successMessage: 'Stash popped' })} data-testid="git-stash-pop">
            <IconArrowUpRight size={14} strokeWidth={1.5} />
          </ActionIcon>
          <ActionIcon size="sm" label="Drop" onClick={() => setStashToDrop(entry)} data-testid="git-stash-drop">
            <IconTrash size={14} strokeWidth={1.5} />
          </ActionIcon>
        </div>
      ))}
      {stashToDrop && (
        <ConfirmModal
          title="Drop stash?"
          confirmText="Drop"
          testId="git-stash-drop-confirm"
          onCancel={() => setStashToDrop(null)}
          onConfirm={() => {
            const { index } = stashToDrop;
            setStashToDrop(null);
            run('stash-drop', { index });
          }}
        >
          “{stashToDrop.message}” is deleted for good.
        </ConfirmModal>
      )}
    </StyledWrapper>
  );
};

export default StashList;
