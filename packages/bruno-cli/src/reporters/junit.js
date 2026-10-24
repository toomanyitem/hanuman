const os = require('os');
const fs = require('fs');
const xmlbuilder = require('xmlbuilder');
const { buildJUnitReport } = require('@usebruno/common/runner');

const makeJUnitOutput = async (results, outputPath) => {
  const output = buildJUnitReport(results, { hostname: os.hostname() });
  fs.writeFileSync(outputPath, xmlbuilder.create(output).end({ pretty: true }));
};

module.exports = makeJUnitOutput;
