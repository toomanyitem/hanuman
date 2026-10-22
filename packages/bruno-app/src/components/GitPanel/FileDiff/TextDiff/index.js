import React, { useMemo } from 'react';
import { diffLines } from 'diff';
import StyledWrapper from './StyledWrapper';

const toLines = (value) => value.replace(/\r?\n$/, '').split(/\r\n|\r|\n/);

const TextDiff = ({ oldContent, newContent }) => {
  const rows = useMemo(() => {
    return diffLines(oldContent || '', newContent || '').flatMap((part) => {
      const kind = part.added ? 'added' : part.removed ? 'removed' : 'same';
      return toLines(part.value).map((text) => ({ kind, text }));
    });
  }, [oldContent, newContent]);

  return (
    <StyledWrapper data-testid="git-text-diff">
      {rows.map((row, index) => (
        <div key={index} className={`line ${row.kind}`}>
          <span className="gutter">{row.kind === 'added' ? '+' : row.kind === 'removed' ? '-' : ' '}</span>
          <span className="text">{row.text}</span>
        </div>
      ))}
    </StyledWrapper>
  );
};

export default TextDiff;
