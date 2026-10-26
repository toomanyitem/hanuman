import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { IconHistory } from '@tabler/icons';
import Button from 'ui/Button/index';
import StyledWrapper from './StyledWrapper';

const EXPORT_FORMATS = [
  { format: 'html', label: 'HTML' },
  { format: 'junit', label: 'JUnit' },
  { format: 'json', label: 'JSON' }
];

const invoke = (action, args) => window.ipcRenderer.invoke(`renderer:data-driven:${action}`, args);

const formatSummary = ({ summary, iterationCount }) => {
  const failed = summary.failedRequests + summary.errorRequests;
  const iterations = iterationCount > 1 ? ` · ${iterationCount} iterations` : '';
  return `${summary.totalRequests} requests · ${summary.passedRequests} passed · ${failed} failed · ${summary.skippedRequests} skipped${iterations}`;
};

// Past runs of this collection, kept on this machine. Each can be opened as an HTML report or exported.
const RunHistory = ({ collectionPathname }) => {
  const [runs, setRuns] = useState(null);

  const showError = (error) => toast.error(error?.message || 'Something went wrong');

  const toggle = () => {
    if (runs) {
      setRuns(null);
      return;
    }
    invoke('list-runs', { collectionPathname }).then(setRuns).catch(showError);
  };

  const exportRun = (id, format) =>
    invoke('export-run', { collectionPathname, id, format })
      .then((savedPath) => savedPath && toast.success(`Report saved to ${savedPath}`))
      .catch(showError);

  const clearRuns = () => invoke('clear-runs', { collectionPathname }).then(setRuns).catch(showError);

  return (
    <StyledWrapper>
      <Button type="button" size="sm" variant="filled" color="secondary" icon={<IconHistory />} onClick={toggle} data-testid="run-history-toggle">
        History
      </Button>
      {runs ? (
        <div className="run-history-panel" data-testid="run-history-list">
          {runs.length === 0 ? <div className="text-muted text-xs">No saved runs yet.</div> : null}
          {runs.map((run) => (
            <div key={run.id} className="run-history-row" data-testid="run-history-row">
              <div className="min-w-0">
                <div className="text-xs">{new Date(run.endedAt).toLocaleString()}{run.environmentName ? ` · ${run.environmentName}` : ''}</div>
                <div className="text-muted text-xs">{formatSummary(run)}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button type="button" size="sm" variant="ghost" onClick={() => invoke('open-run', { collectionPathname, id: run.id }).catch(showError)} data-testid="run-history-open">
                  Open
                </Button>
                {EXPORT_FORMATS.map(({ format, label }) => (
                  <Button key={format} type="button" size="sm" variant="ghost" onClick={() => exportRun(run.id, format)} data-testid={`run-history-export-${format}`}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          {runs.length > 0 ? (
            <Button type="button" size="sm" variant="ghost" color="danger" onClick={clearRuns} data-testid="run-history-clear">
              Clear history
            </Button>
          ) : null}
        </div>
      ) : null}
    </StyledWrapper>
  );
};

export default RunHistory;
