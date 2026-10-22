import styled from 'styled-components';

const StyledWrapper = styled.div`
  color: ${(props) => props.theme.text};

  .git-sidebar {
    width: 22rem;
    min-width: 16rem;
    border-right: 1px solid ${(props) => props.theme.border.border1};
  }

  .git-detail {
    overflow: auto;
  }
`;

export default StyledWrapper;
