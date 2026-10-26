const fs = require('fs');
const { generateOfflineHtmlReport, groupResultsByIteration } = require('@usebruno/common/runner');
const { CLI_VERSION } = require('../constants');

const makeHtmlOutput = async (results, outputPath, runCompletionTime, environment = null) => {
  let runnerResults = results;
  if (!results) {
    runnerResults = [];
  } else if (results.results) {
    runnerResults = groupResultsByIteration(results.results, results.summary);
  } else if (Array.isArray(results)) {
    runnerResults = results;
  }

  const htmlString = generateOfflineHtmlReport({
    runnerResults: runnerResults,
    version: `Hanuman CLI v${CLI_VERSION}`,
    environment: environment,
    runCompletionTime: runCompletionTime
  });
  fs.writeFileSync(outputPath, htmlString);
};

module.exports = makeHtmlOutput;
