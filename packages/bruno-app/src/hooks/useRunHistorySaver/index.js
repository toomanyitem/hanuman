import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import path from 'utils/common/path';
import {
  findItemInCollection,
  findEnvironmentInCollection,
  getEnvironmentVariables,
  getEnvironmentVariablesMasked,
  getGlobalEnvironmentVariables,
  getGlobalEnvironmentVariablesMasked
} from 'utils/collections';

const SETTLED_STATUSES = ['completed', 'error', 'skipped'];

// Saves still reading this collection's stored exchanges; clearing them first would empty the saved run.
const pendingSaves = new Map();

export const waitForRunHistorySave = (collectionUid) => pendingSaves.get(collectionUid) || Promise.resolve();

// Values of the variables marked secret in the active collection and global environments,
// so the main process can mask them in URLs and bodies before writing history.
const getSecretValues = (collection, globalEnvironmentState) => {
  const environmentValues = getEnvironmentVariables(collection);
  const globalValues = getGlobalEnvironmentVariables(globalEnvironmentState);
  return [
    ...getEnvironmentVariablesMasked(collection).map((name) => environmentValues[name]),
    ...getGlobalEnvironmentVariablesMasked(globalEnvironmentState).map((name) => globalValues[name])
  ].filter((value) => typeof value === 'string' && value.length > 0);
};

export const buildSaveRunPayload = (collection, globalEnvironmentState = {}) => {
  const { info, items } = collection.runnerResult;
  return {
    secretValues: getSecretValues(collection, globalEnvironmentState),
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
  const globalEnvironmentState = useSelector((state) => state.globalEnvironments);
  const savedRunsRef = useRef(new Map());

  useEffect(() => {
    collections.forEach((collection) => {
      const info = collection.runnerResult?.info;
      if (info?.status !== 'ended' || !info.runCompletionTime || !collection.pathname) return;
      const runKey = `${info.cancelTokenUid}:${info.runCompletionTime}`;
      if (savedRunsRef.current.get(collection.uid) === runKey) return;
      savedRunsRef.current.set(collection.uid, runKey);
      const save = window.ipcRenderer
        .invoke('renderer:data-driven:save-run', buildSaveRunPayload(collection, globalEnvironmentState))
        .catch((error) => console.error('Failed to save the run to history', error))
        .finally(() => {
          if (pendingSaves.get(collection.uid) === save) pendingSaves.delete(collection.uid);
        });
      pendingSaves.set(collection.uid, save);
    });
  }, [collections, globalEnvironmentState]);
};

export default useRunHistorySaver;
