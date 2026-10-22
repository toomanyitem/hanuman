import React, { useState } from 'react';
import Button from 'ui/Button';
import ConfirmModal from '../ConfirmModal';
import StyledWrapper from './StyledWrapper';

const OperationBanner = ({ operation, conflictCount, busyAction, run }) => {
  const [confirmAbort, setConfirmAbort] = useState(false);
  const label = operation === 'rebase' ? 'Rebase in progress' : 'Merge in progress';

  return (
    <StyledWrapper className="flex items-center gap-3 px-4 py-2" data-testid="git-operation-banner" data-operation={operation}>
      <div className="flex-1 text-sm">
        <span className="font-medium">{label}</span>
        <span className="ml-2 opacity-80">
          {conflictCount > 0 ? `${conflictCount} conflicted file${conflictCount === 1 ? '' : 's'} left. Resolve each one below.` : 'All conflicts are resolved.'}
        </span>
      </div>
      <Button
        size="sm"
        disabled={conflictCount > 0}
        loading={busyAction === 'continue'}
        onClick={() => run('continue', {}, { successMessage: operation === 'rebase' ? 'Rebase continued' : 'Merge committed' })}
        data-testid="git-continue"
      >
        {operation === 'rebase' ? 'Continue rebase' : 'Commit merge'}
      </Button>
      <Button size="sm" color="secondary" variant="ghost" onClick={() => setConfirmAbort(true)} data-testid="git-abort">
        Abort
      </Button>
      {confirmAbort && (
        <ConfirmModal
          title={`Abort the ${operation}?`}
          confirmText="Abort"
          testId="git-abort-confirm"
          onCancel={() => setConfirmAbort(false)}
          onConfirm={() => {
            setConfirmAbort(false);
            run('abort');
          }}
        >
          The repository goes back to how it was before the {operation} started. Conflict resolutions made so far are lost.
        </ConfirmModal>
      )}
    </StyledWrapper>
  );
};

export default OperationBanner;
