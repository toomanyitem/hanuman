import styled from 'styled-components';

const StyledWrapper = styled.div`
  font-size: ${(props) => props.theme.font.size.sm};

  .section-header {
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
    text-transform: uppercase;
    color: ${(props) => props.theme.colors.text.muted};

    .count {
      margin-left: 0.25rem;
      font-weight: 400;
    }
  }

  .file-row {
    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }

    &.selected {
      background: ${(props) => props.theme.dropdown.hoverBg};
    }

    .file-actions {
      visibility: hidden;
    }

    &:hover .file-actions,
    &.selected .file-actions {
      visibility: visible;
    }
  }

  .status-code {
    width: 1rem;
    text-align: center;
    font-weight: 600;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.warning};
  }

  .status-A,
  .status-untracked {
    color: ${(props) => props.theme.colors.text.green};
  }

  .status-D,
  .status-conflict {
    color: ${(props) => props.theme.colors.text.danger};
  }

  .empty {
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;
