import React from 'react';
import classnames from 'classnames';
import { IconPlus, IconMinus, IconArrowBackUp, IconAlertTriangle } from '@tabler/icons';
import ActionIcon from 'ui/ActionIcon';
import { STATUS_LABELS } from '../utils';
import StyledWrapper from './StyledWrapper';

const displayPath = (filePath, scope) => (scope && scope !== '.' && filePath.startsWith(`${scope}/`) ? filePath.slice(scope.length + 1) : filePath);

const FileRow = ({ file, area, scope, selected, onSelect, actions }) => {
  const code = area === 'staged' ? file.staged : area === 'changes' ? file.unstaged : '!';
  return (
    <div
      className={classnames('file-row flex items-center gap-2 px-3 py-1 cursor-pointer', { selected })}
      onClick={() => onSelect({ path: file.path, area })}
      data-testid="git-file-row"
      data-path={file.path}
      data-area={area}
      title={file.from ? `${file.from} → ${file.path}` : file.path}
    >
      <span className="file-name flex-1 truncate">{displayPath(file.path, scope)}</span>
      <span className="file-actions flex items-center" onClick={(event) => event.stopPropagation()}>
        {actions.map(({ id, label, Icon, onClick }) => (
          <ActionIcon key={id} size="sm" label={label} onClick={() => onClick(file)} data-testid={`git-${id}`}>
            <Icon size={14} strokeWidth={1.5} />
          </ActionIcon>
        ))}
      </span>
      <span className={classnames('status-code', `status-${{ '?': 'untracked', '!': 'conflict' }[code] || code}`)} title={STATUS_LABELS[code] || 'Conflict'}>
        {code === '!' ? <IconAlertTriangle size={12} strokeWidth={2} /> : code === '?' ? 'U' : code}
      </span>
    </div>
  );
};

const Section = ({ title, files, area, scope, selected, onSelect, rowActions, headerActions, testId }) => {
  if (!files.length) return null;
  return (
    <div className="section" data-testid={testId}>
      <div className="section-header flex items-center px-3 py-1">
        <span className="flex-1">
          {title} <span className="count">{files.length}</span>
        </span>
        {headerActions.map(({ id, label, Icon, onClick }) => (
          <ActionIcon key={id} size="sm" label={label} onClick={onClick} data-testid={`git-${id}`}>
            <Icon size={14} strokeWidth={1.5} />
          </ActionIcon>
        ))}
      </div>
      {files.map((file) => (
        <FileRow
          key={`${area}:${file.path}`}
          file={file}
          area={area}
          scope={scope}
          selected={selected && selected.path === file.path && selected.area === area}
          onSelect={onSelect}
          actions={rowActions}
        />
      ))}
    </div>
  );
};

const ChangeList = ({ groups, scope, selected, onSelect, onStage, onUnstage, onDiscard }) => {
  const { conflicts, staged, changes } = groups;
  const paths = (files) => files.map((file) => file.path);

  if (!conflicts.length && !staged.length && !changes.length) {
    return <StyledWrapper><div className="empty px-3 py-4" data-testid="git-no-changes">No changes</div></StyledWrapper>;
  }

  return (
    <StyledWrapper>
      <Section
        title="Merge conflicts"
        testId="git-section-conflicts"
        files={conflicts}
        area="conflicts"
        scope={scope}
        selected={selected}
        onSelect={onSelect}
        rowActions={[]}
        headerActions={[]}
      />
      <Section
        title="Staged changes"
        testId="git-section-staged"
        files={staged}
        area="staged"
        scope={scope}
        selected={selected}
        onSelect={onSelect}
        rowActions={[{ id: 'unstage', label: 'Unstage', Icon: IconMinus, onClick: (file) => onUnstage([file.path]) }]}
        headerActions={[{ id: 'unstage-all', label: 'Unstage all', Icon: IconMinus, onClick: () => onUnstage(paths(staged)) }]}
      />
      <Section
        title="Changes"
        testId="git-section-changes"
        files={changes}
        area="changes"
        scope={scope}
        selected={selected}
        onSelect={onSelect}
        rowActions={[
          { id: 'discard', label: 'Discard changes', Icon: IconArrowBackUp, onClick: (file) => onDiscard([file.path]) },
          { id: 'stage', label: 'Stage', Icon: IconPlus, onClick: (file) => onStage([file.path]) }
        ]}
        headerActions={[
          { id: 'discard-all', label: 'Discard all changes', Icon: IconArrowBackUp, onClick: () => onDiscard(paths(changes)) },
          { id: 'stage-all', label: 'Stage all', Icon: IconPlus, onClick: () => onStage(paths(changes)) }
        ]}
      />
    </StyledWrapper>
  );
};

export default ChangeList;
