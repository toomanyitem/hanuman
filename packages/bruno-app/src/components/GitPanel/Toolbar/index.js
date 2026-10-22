import React from 'react';
import { IconGitBranch, IconRefresh, IconArrowDown, IconArrowUp, IconCloudDownload, IconDots, IconChevronDown } from '@tabler/icons';
import ActionIcon from 'ui/ActionIcon';
import Button from 'ui/Button';
import MenuDropdown from 'ui/MenuDropdown';
import StyledWrapper from './StyledWrapper';

const Toolbar = ({ status, busyAction, onOpenBranches, onFetch, onPull, onPush, onRefresh, onOpenRemotes, onOpenTokens }) => {
  const branchLabel = status.detached ? 'detached HEAD' : status.branch;
  const hasRemote = status.remotes.length > 0;

  return (
    <StyledWrapper className="flex flex-wrap items-center gap-2 px-4 py-2">
      <Button size="sm" variant="ghost" icon={<IconGitBranch size={14} />} onClick={onOpenBranches} data-testid="git-branch-button">
        <span data-testid="git-current-branch">{branchLabel}</span>
      </Button>
      <span className="sync-counts flex items-center gap-2" title={status.upstream ? `Tracking ${status.upstream}` : 'No upstream branch'}>
        <span className="flex items-center" data-testid="git-ahead" data-count={status.ahead}>
          <IconArrowUp size={12} />
          {status.ahead}
        </span>
        <span className="flex items-center" data-testid="git-behind" data-count={status.behind}>
          <IconArrowDown size={12} />
          {status.behind}
        </span>
        <span className="upstream truncate">{status.upstream || 'no upstream'}</span>
      </span>
      <div className="flex-1" />
      <Button size="sm" variant="ghost" icon={<IconCloudDownload size={14} />} disabled={!hasRemote} loading={busyAction === 'fetch'} onClick={onFetch} data-testid="git-fetch">
        Fetch
      </Button>
      <MenuDropdown
        placement="bottom-end"
        data-testid="git-pull-menu"
        items={[
          { id: 'pull-merge', label: 'Pull (merge)', onClick: () => onPull('merge') },
          { id: 'pull-rebase', label: 'Pull (rebase)', onClick: () => onPull('rebase') }
        ]}
      >
        <Button size="sm" variant="ghost" icon={<IconArrowDown size={14} />} disabled={!status.upstream} loading={busyAction === 'pull'} data-testid="git-pull">
          Pull <IconChevronDown size={12} />
        </Button>
      </MenuDropdown>
      <Button size="sm" variant="ghost" icon={<IconArrowUp size={14} />} disabled={!hasRemote || !status.hasCommits || status.detached} loading={busyAction === 'push'} onClick={onPush} data-testid="git-push">
        Push
      </Button>
      <ActionIcon label="Refresh" onClick={onRefresh} data-testid="git-refresh">
        <IconRefresh size={16} strokeWidth={1.5} />
      </ActionIcon>
      <MenuDropdown
        placement="bottom-end"
        data-testid="git-more-menu"
        items={[
          { id: 'remotes', label: 'Remotes…', onClick: onOpenRemotes },
          { id: 'tokens', label: 'Access tokens…', onClick: onOpenTokens }
        ]}
      >
        <ActionIcon label="More Git actions" data-testid="git-more">
          <IconDots size={16} strokeWidth={1.5} />
        </ActionIcon>
      </MenuDropdown>
      {status.scope !== '.' && (
        <div className="repo-note w-full" data-testid="git-repo-wide-note">
          Repository {status.repoRoot}. Branch, pull and push affect the whole repository.
        </div>
      )}
    </StyledWrapper>
  );
};

export default Toolbar;
