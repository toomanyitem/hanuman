import styled from 'styled-components';

const StyledWrapper = styled.div`
  .data-file-name {
    font-size: ${(props) => props.theme.font.size.sm};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export default StyledWrapper;
