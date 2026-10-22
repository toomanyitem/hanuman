import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { formatIpcError } from 'utils/common/error';

export const invokeGit = (action, args) => window.ipcRenderer.invoke(`renderer:git-panel:${action}`, args);

const useGitPanel = (targetPath) => {
  const [status, setStatus] = useState(null);
  const [stashes, setStashes] = useState([]);
  const [busyAction, setBusyAction] = useState(null);
  const [error, setError] = useState(null);

  const latestRefresh = useRef(0);

  // Refreshes overlap (window focus plus an action finishing); only the newest reply is applied.
  const refresh = useCallback(async () => {
    if (!targetPath) return;
    const requestId = ++latestRefresh.current;
    try {
      const nextStatus = await invokeGit('status', { targetPath });
      const nextStashes = nextStatus.isRepo && nextStatus.hasCommits ? await invokeGit('stashes', { targetPath }) : [];
      if (requestId !== latestRefresh.current) return;
      setStatus(nextStatus);
      setStashes(nextStashes);
    } catch (err) {
      if (requestId !== latestRefresh.current) return;
      setError(formatIpcError(err) || 'Could not read the Git status');
    }
  }, [targetPath]);

  // Files change outside the app too (terminal, editor), so the panel re-reads when the window regains focus.
  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  const run = useCallback(async (action, args = {}, { successMessage } = {}) => {
    setBusyAction(action);
    setError(null);
    try {
      const result = await invokeGit(action, { targetPath, ...args });
      if (successMessage) toast.success(successMessage);
      return { ok: true, result };
    } catch (err) {
      const message = formatIpcError(err) || 'Git command failed';
      setError(message);
      toast.error(message.split('\n')[0]);
      return { ok: false, error: message };
    } finally {
      setBusyAction(null);
      await refresh();
    }
  }, [targetPath, refresh]);

  const clearError = useCallback(() => setError(null), []);

  return { status, stashes, busyAction, error, clearError, refresh, run };
};

export default useGitPanel;
