import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  background: ${(props) => rgba(props.theme.colors.text.warning, 0.12)};
  border-bottom: 1px solid ${(props) => props.theme.border.border1};
`;

export default StyledWrapper;
