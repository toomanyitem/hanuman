// Postman's pm.iterationData / pm.info.iteration(Count), exposed on bru.runner.
// Outside a data-driven run it is an empty row, iteration 0 of 1, like Postman.
const createIterationApi = (iteration) => {
  const data = iteration?.data || {};
  return {
    iterationData: {
      get: (key) => data[key],
      has: (key) => Object.prototype.hasOwnProperty.call(data, key),
      toObject: () => ({ ...data })
    },
    iteration: iteration?.index ?? 0,
    iterationCount: iteration?.count ?? 1
  };
};

module.exports = { createIterationApi };
