const fs = require('node:fs/promises');
const path = require('node:path');
const { parseIterationData, resolveIterationCount } = require('@usebruno/common/runner');

const MAX_DATA_FILE_BYTES = 50 * 1024 * 1024;

const readIterationDataFile = async (filePath) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('Data file path must be an absolute path');
  }
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch {
    throw new Error(`Data file not found: ${filePath}`);
  }
  if (!stats.isFile()) {
    throw new Error(`Data file is not a file: ${filePath}`);
  }
  if (stats.size > MAX_DATA_FILE_BYTES) {
    throw new Error(`Data file is larger than ${MAX_DATA_FILE_BYTES / 1024 / 1024} MB: ${filePath}`);
  }
  return parseIterationData(await fs.readFile(filePath, 'utf8'), filePath);
};

// `allowedDataFilePath` is the file the user chose for this collection; a run never reads another one.
const loadIterationPlan = async (iterationOptions, allowedDataFilePath = null) => {
  const { dataFilePath = null, iterationCount = null } = iterationOptions || {};
  if (dataFilePath && dataFilePath !== allowedDataFilePath) {
    throw new Error('Choose the data file in the runner before running');
  }
  const rows = dataFilePath ? await readIterationDataFile(dataFilePath) : [];
  return { rows, count: resolveIterationCount(rows, iterationCount) };
};

module.exports = { readIterationDataFile, loadIterationPlan, MAX_DATA_FILE_BYTES };
