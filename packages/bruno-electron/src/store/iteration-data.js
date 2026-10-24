const Store = require('electron-store');
const { toCollectionKey } = require('../utils/run-history');

// The last data file used per collection. Paths are values of one object because
// electron-store reads dots in a key (a path like "/a/b.c") as a nested path.
class IterationDataStore {
  constructor() {
    this.store = new Store({ name: 'iteration-data', clearInvalidConfig: true });
  }

  getAll() {
    return this.store.get('dataFiles', {}) || {};
  }

  get(collectionPathname) {
    return this.getAll()[toCollectionKey(collectionPathname)] || null;
  }

  set(collectionPathname, dataFilePath) {
    this.store.set('dataFiles', { ...this.getAll(), [toCollectionKey(collectionPathname)]: dataFilePath });
  }

  remove(collectionPathname) {
    const dataFiles = this.getAll();
    delete dataFiles[toCollectionKey(collectionPathname)];
    this.store.set('dataFiles', dataFiles);
  }
}

module.exports = { iterationDataStore: new IterationDataStore() };
