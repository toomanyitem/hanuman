import React from 'react';

// Source artwork: assets/brand/hanuman-mark.svg
const HanumanLogo = ({ width }) => {
  return (
    <svg width={width} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hanuman">
      <circle cx="11" cy="37" r="8" fill="#EA580C" />
      <circle cx="53" cy="37" r="8" fill="#EA580C" />
      <circle cx="11" cy="37" r="4" fill="#FDBA74" />
      <circle cx="53" cy="37" r="4" fill="#FDBA74" />
      <circle cx="32" cy="39" r="19" fill="#EA580C" />
      <path
        d="M32 31.5c-2.2-3.4-5.4-4.6-8.2-4.1-4.2.8-6.4 4.9-5.4 9.3.5 2.1 1.6 3.6 2.6 4.8-.9 1.6-1.3 3.4-1.1 5.3.7 6.2 6 9.7 12.1 9.7s11.4-3.5 12.1-9.7c.2-1.9-.2-3.7-1.1-5.3 1-1.2 2.1-2.7 2.6-4.8 1-4.4-1.2-8.5-5.4-9.3-2.8-.5-6 .7-8.2 4.1z"
        fill="#FFF1E0"
      />
      <ellipse cx="25.5" cy="36" rx="2.4" ry="3" fill="#1C1917" />
      <ellipse cx="38.5" cy="36" rx="2.4" ry="3" fill="#1C1917" />
      <circle cx="30" cy="45" r="1.1" fill="#9A3412" />
      <circle cx="34" cy="45" r="1.1" fill="#9A3412" />
      <path d="M27.5 49.5q4.5 3.6 9 0" fill="none" stroke="#9A3412" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M32 24.5c1.3 1.6 1.6 3.4 0 5.6-1.6-2.2-1.3-4 0-5.6z" fill="#DC2626" />
      <path
        d="M21 21.5L25.5 15h2.2L30 8.5 32 2l2 6.5 2.3 6.5h2.2l4.5 6.5z"
        fill="#FBBF24"
        stroke="#B45309"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect x="19.5" y="19.5" width="25" height="4.5" rx="2.25" fill="#FBBF24" stroke="#B45309" strokeWidth="1.2" />
      <circle cx="32" cy="21.75" r="1.6" fill="#DC2626" />
    </svg>
  );
};

export default HanumanLogo;
