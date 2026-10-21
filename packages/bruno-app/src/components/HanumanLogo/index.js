import React from 'react';
import hanumanLogo from 'assets/hanuman-logo.png';

// Generated from assets/brand/hanuman-logo-source.png by scripts/hanuman/make-icons.py
const HanumanLogo = ({ width }) => {
  return <img src={hanumanLogo} width={width} height={width} alt="Hanuman" draggable={false} />;
};

export default HanumanLogo;
