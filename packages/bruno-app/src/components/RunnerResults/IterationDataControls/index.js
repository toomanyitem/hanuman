import React from 'react';
import path from 'utils/common/path';
import Button from 'ui/Button/index';
import StyledWrapper from './StyledWrapper';

const IterationDataControls = ({ dataFile, onPick, onClear, iterationCount, onIterationCountChange }) => {
  const rowCount = dataFile && !dataFile.error ? dataFile.rowCount : null;

  return (
    <StyledWrapper>
      <div className="runner-section-title mt-6">Data</div>
      <div className="runner-section mt-2">
        <label>Data file (CSV with a header row, or a JSON array of objects)</label>
        <div className="flex items-center gap-2 mt-2">
          <Button type="button" size="sm" variant="filled" color="secondary" onClick={onPick} data-testid="iteration-data-select">
            {dataFile ? 'Change file' : 'Choose file'}
          </Button>
          {dataFile ? (
            <>
              <span className="data-file-name" title={dataFile.path} data-testid="iteration-data-file">
                {path.basename(dataFile.path)}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={onClear} data-testid="iteration-data-clear">
                Clear
              </Button>
            </>
          ) : null}
        </div>
        {dataFile?.error ? (
          <div className="danger text-xs mt-1" data-testid="iteration-data-error">{dataFile.error}</div>
        ) : null}
        {rowCount !== null ? (
          <div className="text-muted text-xs mt-1" data-testid="iteration-data-summary">
            {rowCount} {rowCount === 1 ? 'row' : 'rows'} · columns: {dataFile.columns.join(', ')} (use as {'{{column}}'})
          </div>
        ) : null}

        <label className="block mt-4">Iterations</label>
        <input
          type="number"
          min="1"
          className="block textbox w-full mt-2"
          placeholder={String(rowCount || 1)}
          autoComplete="off"
          data-testid="iteration-count-input"
          value={iterationCount}
          onChange={(e) => onIterationCountChange(e.target.value)}
        />
      </div>
    </StyledWrapper>
  );
};

export default IterationDataControls;
