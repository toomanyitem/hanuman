import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  font-family: monospace;
  font-size: ${(props) => props.theme.font.size.xs};
  white-space: pre-wrap;
  word-break: break-all;

  .line {
    display: flex;
    padding: 0 0.5rem;
  }

  .gutter {
    width: 1rem;
    flex-shrink: 0;
    opacity: 0.6;
  }

  .added {
    background: ${(props) => rgba(props.theme.colors.text.green, 0.15)};
  }

  .removed {
    background: ${(props) => rgba(props.theme.colors.text.danger, 0.15)};
  }
`;

export default StyledWrapper;
