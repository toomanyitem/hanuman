import React, { useEffect, useState } from 'react';
import get from 'lodash/get';
import { useSelector } from 'react-redux';
import Button from 'ui/Button';
import CodeEditor from 'components/CodeEditor';
import { useTheme } from 'providers/Theme';
import { formatIpcError } from 'utils/common/error';
import { invokeGit } from '../useGitPanel';
import { conflictLabels } from '../utils';

const editorMode = (filePath) => (filePath.endsWith('.json') ? 'application/ld+json' : filePath.endsWith('.yml') || filePath.endsWith('.yaml') ? 'yaml' : 'text/plain');

const ConflictResolver = ({ targetPath, filePath, busyAction, run }) => {
  const { displayedTheme } = useTheme();
  const preferences = useSelector((state) => state.app.preferences);
  const [conflict, setConflict] = useState(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setConflict(null);
    setError(null);
    invokeGit('conflict', { targetPath, path: filePath })
      .then((result) => {
        if (cancelled) return;
        setConflict(result);
        setContent(result.content || '');
      })
      .catch((err) => !cancelled && setError(formatIpcError(err) || 'Could not read the conflict'));
    return () => {
      cancelled = true;
    };
  }, [targetPath, filePath]);

  if (error) return <div className="p-4 text-sm" data-testid="git-conflict-error">{error}</div>;
  if (!conflict) return <div className="p-4 text-sm opacity-70">Loading conflict…</div>;

  const labels = conflictLabels(conflict.operation);
  const resolve = (choice) => run('resolve-conflict', { path: filePath, choice, ...(choice === 'content' ? { content } : {}) }, { successMessage: 'Marked as resolved' });

  return (
    <div className="flex flex-col h-full" data-testid="git-conflict" data-path={filePath}>
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="text-sm font-medium truncate">{filePath}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" loading={busyAction === 'resolve-conflict'} onClick={() => resolve('current')} data-testid="git-use-current">
            {conflict.current === null ? 'Keep deleted (current)' : 'Use current'}
          </Button>
          <Button size="sm" variant="ghost" loading={busyAction === 'resolve-conflict'} onClick={() => resolve('incoming')} data-testid="git-use-incoming">
            {conflict.incoming === null ? 'Keep deleted (incoming)' : 'Use incoming'}
          </Button>
          <Button size="sm" loading={busyAction === 'resolve-conflict'} onClick={() => resolve('content')} data-testid="git-mark-resolved">
            Save edits and mark resolved
          </Button>
        </div>
        <div className="text-xs opacity-70">
          Current is {labels.current}. Incoming is {labels.incoming}. Or edit the file below, remove every
          {' '}<code>{'<<<<<<<'}</code>, <code>=======</code> and <code>{'>>>>>>>'}</code> line, then mark it resolved.
        </div>
      </div>
      <div className="flex-1 overflow-hidden" data-testid="git-conflict-editor">
        <CodeEditor
          theme={displayedTheme}
          value={content}
          onEdit={setContent}
          mode={editorMode(filePath)}
          font={get(preferences, 'font.codeFont', 'default')}
        />
      </div>
    </div>
  );
};

export default ConflictResolver;
