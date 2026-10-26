import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

// The data file remembered for a collection (path, row count, columns, or a load error).
const useIterationDataFile = (collectionPathname) => {
  const [dataFile, setDataFile] = useState(null);

  const run = useCallback(
    (action) =>
      window.ipcRenderer
        .invoke(`renderer:data-driven:${action}`, { collectionPathname })
        .then(setDataFile)
        .catch((error) => toast.error(error?.message || 'Could not read the data file')),
    [collectionPathname]
  );

  useEffect(() => {
    run('get-file');
  }, [run]);

  return {
    dataFile,
    pickDataFile: () => run('pick-file'),
    reloadDataFile: () => run('get-file'),
    clearDataFile: () => run('clear-file')
  };
};

export default useIterationDataFile;
