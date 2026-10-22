import React from 'react';
import { IconGitBranch } from '@tabler/icons';
import Button from 'ui/Button';

const NotARepo = ({ targetPath, busy, onInit }) => (
  <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center" data-testid="git-not-a-repo">
    <IconGitBranch size={32} strokeWidth={1.5} />
    <div className="font-medium">This folder is not in a Git repository</div>
    <div className="text-xs opacity-70 break-all">{targetPath}</div>
    <Button onClick={onInit} loading={busy} data-testid="git-init">
      Initialize repository
    </Button>
    <div className="text-xs opacity-70">Creates a repository on branch main. Add a remote afterwards from the ⋯ menu.</div>
  </div>
);

export default NotARepo;
