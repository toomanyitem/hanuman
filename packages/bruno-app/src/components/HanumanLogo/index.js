import React from 'react';
// ?inline embeds it as a data URI: packaged builds load from file://, where asset URLs starting with / do not resolve.
import hanumanLogo from 'assets/hanuman-logo.png?inline';

// Generated from assets/brand/hanuman-logo-source.png by scripts/hanuman/make-icons.py
const HanumanLogo = ({ width }) => {
  return <img src={hanumanLogo} width={width} height={width} alt="Hanuman" draggable={false} />;
};

export default HanumanLogo;
