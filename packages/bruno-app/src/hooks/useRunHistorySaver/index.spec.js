import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import React from 'react';
import useRunHistorySaver, { buildSaveRunPayload, waitForRunHistorySave } from './index';

const collection = (status, runCompletionTime = '2026-10-24T00:00:00.000Z') => ({
  uid: 'c1',
  name: 'Users',
  pathname: '/work/users',
  activeEnvironmentUid: 'e1',
  environments: [{ uid: 'e1', name: 'local', variables: [{ name: 'token', value: 's3cr3t', secret: true, enabled: true }, { name: 'host', value: 'localhost', enabled: true }] }],
  items: [{ uid: 'r1', name: 'Get user', type: 'http-request', pathname: '/work/users/people/Get user.bru' }],
  runnerResult: {
    info: { status, runCompletionTime, cancelTokenUid: 't1', iterationCount: 2 },
    items: [
      { uid: 'r1', requestUid: 'q1', iterationIndex: 0, status: 'completed', testResults: [{ description: 'ok', status: 'pass' }] },
      { uid: 'r1', requestUid: 'q2', iterationIndex: 1, status: 'error', error: 'ECONNREFUSED' },
      { uid: 'r1', requestUid: 'q3', iterationIndex: 1, status: 'queued' }
    ]
  }
});

describe('buildSaveRunPayload', () => {
  it('maps settled runner items to the save-run shape', () => {
    const globalEnvironmentState = {
      activeGlobalEnvironmentUid: 'g1',
      globalEnvironments: [{ uid: 'g1', name: 'g', variables: [{ name: 'apiKey', value: 'k-123', secret: true, enabled: true }] }]
    };
    expect(buildSaveRunPayload(collection('ended'), globalEnvironmentState)).toEqual({
      secretValues: ['s3cr3t', 'k-123'],
      collectionPathname: '/work/users',
      collectionName: 'Users',
      environmentName: 'local',
      endedAt: '2026-10-24T00:00:00.000Z',
      iterationCount: 2,
      items: [
        {
          requestUid: 'q1', iterationIndex: 0, name: 'Get user', relativePath: 'people/Get user.bru', status: 'completed', error: null,
          testResults: [{ description: 'ok', status: 'pass' }], assertionResults: [], preRequestTestResults: [], postResponseTestResults: []
        },
        {
          requestUid: 'q2', iterationIndex: 1, name: 'Get user', relativePath: 'people/Get user.bru', status: 'error', error: 'ECONNREFUSED',
          testResults: [], assertionResults: [], preRequestTestResults: [], postResponseTestResults: []
        }
      ]
    });
  });
});

describe('useRunHistorySaver', () => {
  const renderWith = (initial) => {
    const slice = createSlice({
      name: 'collections',
      initialState: { collections: [initial] },
      reducers: { set: (state, action) => ({ collections: [action.payload] }) }
    });
    const globalEnvironments = () => ({ globalEnvironments: [], activeGlobalEnvironmentUid: null });
    const store = configureStore({ reducer: { collections: slice.reducer, globalEnvironments } });
    const wrapper = ({ children }) => React.createElement(Provider, { store }, children);
    const hook = renderHook(() => useRunHistorySaver(), { wrapper });
    return { store, slice, hook };
  };

  beforeEach(() => {
    window.ipcRenderer = { invoke: jest.fn(() => Promise.resolve({ id: 'x' })) };
  });

  it('saves once when a run ends, and again for the next run', () => {
    const { store, slice, hook } = renderWith(collection('started', undefined));
    expect(window.ipcRenderer.invoke).not.toHaveBeenCalled();

    store.dispatch(slice.actions.set(collection('ended')));
    hook.rerender();
    store.dispatch(slice.actions.set({ ...collection('ended') }));
    hook.rerender();
    expect(window.ipcRenderer.invoke).toHaveBeenCalledTimes(1);
    expect(window.ipcRenderer.invoke).toHaveBeenCalledWith('renderer:data-driven:save-run', expect.objectContaining({ iterationCount: 2 }));

    store.dispatch(slice.actions.set(collection('ended', '2026-10-24T01:00:00.000Z')));
    hook.rerender();
    expect(window.ipcRenderer.invoke).toHaveBeenCalledTimes(2);
  });

  it('lets callers wait for a save that is still reading the stored exchanges', async () => {
    let finishSave;
    window.ipcRenderer = { invoke: jest.fn(() => new Promise((resolve) => { finishSave = resolve; })) };
    const { store, slice, hook } = renderWith(collection('started', undefined));
    store.dispatch(slice.actions.set(collection('ended', '2026-10-24T02:00:00.000Z')));
    hook.rerender();

    let waited = false;
    const wait = waitForRunHistorySave('c1').then(() => { waited = true; });
    await Promise.resolve();
    expect(waited).toBe(false);
    finishSave({ id: 'x' });
    await wait;
    expect(waited).toBe(true);
  });
});
