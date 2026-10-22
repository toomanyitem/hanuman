import styled from 'styled-components';

const StyledWrapper = styled.div`
  .commit-message {
    width: 100%;
    resize: vertical;
    padding: 0.375rem 0.5rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};
    background: ${(props) => props.theme.input.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};
    outline: none;

    &:focus {
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }
`;

export default StyledWrapper;
