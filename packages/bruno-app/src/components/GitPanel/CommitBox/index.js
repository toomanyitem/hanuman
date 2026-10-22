import React, { useState } from 'react';
import Button from 'ui/Button';
import StyledWrapper from './StyledWrapper';

const CommitBox = ({ stagedCount, disabledReason, busy, onCommit }) => {
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
      <Button fullWidth size="sm" disabled={!canCommit} loading={busy} onClick={commit} data-testid="git-commit">
        {stagedCount > 0 ? `Commit ${stagedCount} staged file${stagedCount === 1 ? '' : 's'}` : 'Commit'}
      </Button>
    </StyledWrapper>
  );
};

export default CommitBox;
