import React, { useEffect, useState } from 'react';
import get from 'lodash/get';
import isEqual from 'lodash/isEqual';
import SegmentedControl from 'ui/SegmentedControl';
import VisualDiffContent from 'components/Git/VisualDiffViewer/VisualDiffContent/index';
import VisualDiffUrlBar from 'components/Git/VisualDiffViewer/VisualDiffUrlBar';
import VisualDiffParams from 'components/Git/VisualDiffViewer/VisualDiffParams';
import VisualDiffHeaders from 'components/Git/VisualDiffViewer/VisualDiffHeaders';
import VisualDiffAuth from 'components/Git/VisualDiffViewer/VisualDiffAuth';
import VisualDiffBody from 'components/Git/VisualDiffViewer/VisualDiffBody';
import { formatIpcError } from 'utils/common/error';
import { invokeGit } from '../useGitPanel';
import TextDiff from './TextDiff';

const SECTION_PATHS = {
  url: ['request.url', 'request.method'],
  params: ['request.params'],
  headers: ['request.headers'],
  auth: ['request.auth'],
  body: ['request.body']
};

const sectionHasChanges = (key, oldData, newData) => SECTION_PATHS[key].some((path) => !isEqual(get(oldData, path), get(newData, path)));

const hasRequest = (data) => Boolean(get(data, 'request'));

const SECTIONS = [
  { key: 'url', title: 'URL', Component: VisualDiffUrlBar, hasContent: hasRequest },
  { key: 'params', title: 'Params', Component: VisualDiffParams, hasContent: (data) => get(data, 'request.params', []).length > 0 },
  { key: 'headers', title: 'Headers', Component: VisualDiffHeaders, hasContent: (data) => get(data, 'request.headers', []).length > 0 },
  { key: 'auth', title: 'Auth', Component: VisualDiffAuth, hasContent: (data) => get(data, 'request.auth.mode', 'none') !== 'none' },
  { key: 'body', title: 'Body', Component: VisualDiffBody, hasContent: (data) => get(data, 'request.body.mode', 'none') !== 'none' }
];

const LABELS = {
  staged: ['HEAD', 'Staged'],
  changes: ['Staged or HEAD', 'Working tree']
};

const FileDiff = ({ targetPath, file }) => {
  const [diff, setDiff] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('visual');

  useEffect(() => {
    let cancelled = false;
    setDiff(null);
    setError(null);
    invokeGit('diff', { targetPath, path: file.path, area: file.area === 'staged' ? 'staged' : 'unstaged' })
      .then((result) => !cancelled && setDiff(result))
      .catch((err) => !cancelled && setError(formatIpcError(err) || 'Could not load the diff'));
    return () => {
      cancelled = true;
    };
  }, [targetPath, file.path, file.area]);

  if (error) return <div className="p-4 text-sm" data-testid="git-diff-error">{error}</div>;
  if (!diff) return <div className="p-4 text-sm opacity-70">Loading diff…</div>;

  const [oldLabel, newLabel] = LABELS[file.area] || LABELS.changes;
  const showVisual = diff.visual && view === 'visual';

  return (
    <div className="flex flex-col h-full" data-testid="git-diff" data-path={file.path}>
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="flex-1 text-sm font-medium truncate">{file.path}</span>
        {diff.visual && (
          <SegmentedControl
            ariaLabel="Diff view"
            name="git-diff-view"
            size="sm"
            value={view}
            onChange={setView}
            items={[{ value: 'visual', label: 'Visual' }, { value: 'text', label: 'Text' }]}
          />
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {showVisual ? (
          <>
            <VisualDiffContent
              oldData={diff.oldParsed}
              newData={diff.newParsed}
              sections={SECTIONS}
              sectionHasChanges={sectionHasChanges}
              oldLabel={oldLabel}
              newLabel={newLabel}
            />
            <div className="px-4 py-2 text-xs opacity-70">Scripts, tests, variables and docs are compared in the Text view.</div>
          </>
        ) : (
          <TextDiff oldContent={diff.oldContent} newContent={diff.newContent} />
        )}
      </div>
    </div>
  );
};

export default FileDiff;
