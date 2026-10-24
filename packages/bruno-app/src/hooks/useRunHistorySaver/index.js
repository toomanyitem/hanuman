import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import path from 'utils/common/path';
import { findItemInCollection, findEnvironmentInCollection } from 'utils/collections';

const SETTLED_STATUSES = ['completed', 'error', 'skipped'];

export const buildSaveRunPayload = (collection) => {
  const { info, items } = collection.runnerResult;
  return {
    collectionPathname: collection.pathname,
    collectionName: collection.name,
    environmentName: findEnvironmentInCollection(collection, collection.activeEnvironmentUid)?.name ?? null,
    endedAt: info.runCompletionTime,
    iterationCount: info.iterationCount ?? 1,
    items: items
      .filter((item) => SETTLED_STATUSES.includes(item.status))
      .map((item) => {
        const request = findItemInCollection(collection, item.uid);
        return request && {
          requestUid: item.requestUid,
          iterationIndex: item.iterationIndex ?? 0,
          name: request.name,
          relativePath: path.relative(collection.pathname, request.pathname),
          status: item.status,
          error: item.error ?? null,
          testResults: item.testResults || [],
          assertionResults: item.assertionResults || [],
          preRequestTestResults: item.preRequestTestResults || [],
          postResponseTestResults: item.postResponseTestResults || []
        };
      })
      .filter(Boolean)
  };
};

// Saves every finished collection run to the local run history, once per run.
const useRunHistorySaver = () => {
  const collections = useSelector((state) => state.collections.collections);
  const savedRunsRef = useRef(new Map());

  useEffect(() => {
    collections.forEach((collection) => {
      const info = collection.runnerResult?.info;
      if (info?.status !== 'ended' || !info.runCompletionTime || !collection.pathname) return;
      const runKey = `${info.cancelTokenUid}:${info.runCompletionTime}`;
      if (savedRunsRef.current.get(collection.uid) === runKey) return;
      savedRunsRef.current.set(collection.uid, runKey);
      window.ipcRenderer
        .invoke('renderer:data-driven:save-run', buildSaveRunPayload(collection))
        .catch((error) => console.error('Failed to save the run to history', error));
    });
  }, [collections]);
};

export default useRunHistorySaver;
