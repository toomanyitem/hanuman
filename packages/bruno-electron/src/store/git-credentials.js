const Store = require('electron-store');
const { encryptString, decryptString } = require('../utils/encryption');

// Hosts are keys of one object because electron-store reads dots in a key ("github.com") as a nested path.
class GitCredentialStore {
  constructor() {
    this.store = new Store({
      name: 'git-credentials',
      clearInvalidConfig: true
    });
  }

  getHosts() {
    return this.store.get('hosts', {}) || {};
  }

  list() {
    return Object.entries(this.getHosts())
      .map(([host, { username }]) => ({ host, username }))
      .sort((a, b) => a.host.localeCompare(b.host));
  }

  get(host) {
    const entry = this.getHosts()[host];
    if (!entry) return null;
    try {
      const token = decryptString(entry.token);
      return token ? { username: entry.username, token } : null;
    } catch (err) {
      console.error(`Failed to decrypt the Git token for ${host}:`, err.message);
      return null;
    }
  }

  set(host, username, token) {
    const hosts = this.getHosts();
    hosts[host] = { username, token: encryptString(token) };
    this.store.set('hosts', hosts);
  }

  remove(host) {
    const hosts = this.getHosts();
    delete hosts[host];
    this.store.set('hosts', hosts);
  }
}

const gitCredentialStore = new GitCredentialStore();

module.exports = { gitCredentialStore };
