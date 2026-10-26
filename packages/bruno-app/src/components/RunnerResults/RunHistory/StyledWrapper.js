import styled from 'styled-components';

const StyledWrapper = styled.div`
  position: relative;

  .run-history-panel {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 10;
    width: 32rem;
    max-height: 24rem;
    overflow-y: auto;
    padding: 0.5rem;
    background-color: ${(props) => props.theme.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
  }

  .run-history-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.25rem 0;
    border-bottom: 1px solid ${(props) => props.theme.input.border};
  }
`;

export default StyledWrapper;
