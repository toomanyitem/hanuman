import React, { useState } from 'react';
import Button from 'ui/Button';
import StyledWrapper from './StyledWrapper';

const CommitBox = ({ stagedCount, stagedOutsideScope = 0, disabledReason, busy, onCommit }) => {
  const [message, setMessage] = useState('');
  const canCommit = stagedCount > 0 && message.trim().length > 0 && !disabledReason;

  const commit = async () => {
    if (!canCommit) return;
    const { ok } = await onCommit(message);
    if (ok) setMessage('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commit();
    }
  };

  return (
    <StyledWrapper className="flex flex-col gap-2 p-3">
      <textarea
        className="commit-message"
        rows={3}
        placeholder={disabledReason || 'Commit message (Ctrl/Cmd+Enter to commit)'}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={Boolean(disabledReason)}
        data-testid="git-commit-message"
      />
      {stagedOutsideScope > 0 && (
        <div className="text-xs" data-testid="git-staged-outside-scope">
          {stagedOutsideScope} file{stagedOutsideScope === 1 ? ' is' : 's are'} also staged outside this collection and will be committed too.
        </div>
      )}
      <Button fullWidth size="sm" disabled={!canCommit} loading={busy} onClick={commit} data-testid="git-commit">
        {stagedCount > 0 ? `Commit ${stagedCount} staged file${stagedCount === 1 ? '' : 's'}` : 'Commit'}
      </Button>
    </StyledWrapper>
  );
};

export default CommitBox;
