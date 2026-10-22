module.exports = {
  ...require('./status'),
  ...require('./changes'),
  ...require('./sync'),
  ...require('./branches'),
  ...require('./remotes'),
  ...require('./stash'),
  ...require('./conflicts')
};
