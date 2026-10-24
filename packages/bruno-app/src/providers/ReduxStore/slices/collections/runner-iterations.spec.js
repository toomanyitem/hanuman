import reducer, { runFolderEvent } from 'providers/ReduxStore/slices/collections';

const COLLECTION_UID = 'col-1';
const ITEM_UID = 'req-1';

const initialState = () => ({
  collections: [
    {
      uid: COLLECTION_UID,
      pathname: '/coll',
      items: [{ uid: ITEM_UID, name: 'get', type: 'http-request', request: { url: 'http://x/', method: 'GET' } }]
    }
  ],
  collectionSortOrder: 'default',
  activeWorkspaceUid: null
});

const emit = (state, payload) => reducer(state, runFolderEvent({ collectionUid: COLLECTION_UID, folderUid: null, itemUid: ITEM_UID, ...payload }));

describe('runFolderEvent with iterations', () => {
  it('records the iteration on each queued item and the count on the run', () => {
    let state = emit(initialState(), { type: 'testrun-started', cancelTokenUid: 'c' });
    expect(state.collections[0].runnerResult.info.iterationCount).toBe(1);

    for (const iterationIndex of [0, 1]) {
      state = emit(state, { type: 'request-queued', requestUid: `r${iterationIndex}`, iterationIndex, iterationCount: 2 });
      state = emit(state, { type: 'test-results', testResults: [{ description: `row ${iterationIndex}`, status: 'pass' }], iterationIndex, iterationCount: 2 });
    }

    const { info, items } = state.collections[0].runnerResult;
    expect(info.iterationCount).toBe(2);
    expect(items.map((item) => [item.requestUid, item.iterationIndex, item.testResults[0].description])).toEqual([
      ['r0', 0, 'row 0'],
      ['r1', 1, 'row 1']
    ]);
  });

  it('defaults to iteration 0 for runs without iterations', () => {
    let state = emit(initialState(), { type: 'testrun-started', cancelTokenUid: 'c' });
    state = emit(state, { type: 'request-queued', requestUid: 'r0' });
    expect(state.collections[0].runnerResult.items[0].iterationIndex).toBe(0);
    expect(state.collections[0].runnerResult.info.iterationCount).toBe(1);
  });
});
