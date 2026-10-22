import styled from 'styled-components';

const StyledWrapper = styled.div`
  border-top: 1px solid ${(props) => props.theme.border.border1};

  .stash-message {
    padding: 0.25rem 0.5rem;
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
