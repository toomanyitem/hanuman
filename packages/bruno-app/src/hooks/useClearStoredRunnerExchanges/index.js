import { useCallback } from 'react';
import { waitForRunHistorySave } from 'hooks/useRunHistorySaver';

const useClearStoredRunnerExchanges = (collectionUid) => {
  return useCallback(async () => {
    try {
      await waitForRunHistorySave(collectionUid);
      await window.ipcRenderer.invoke('datastore:runner_responses:delete_runner_responses_for_collection', {
        collection_uid: collectionUid
      });
    } catch (error) {
      console.error('Failed to clear stored runner payloads', error);
    }
  }, [collectionUid]);
};

export default useClearStoredRunnerExchanges;
