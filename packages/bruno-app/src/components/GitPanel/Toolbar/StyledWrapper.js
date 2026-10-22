import styled from 'styled-components';

const StyledWrapper = styled.div`
  border-bottom: 1px solid ${(props) => props.theme.border.border1};

  .sync-counts {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .upstream {
    max-width: 14rem;
  }

  .repo-note {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;
