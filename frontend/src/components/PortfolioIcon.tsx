import React from 'react';

interface PortfolioIconProps {
  /** Overall size in px (renders as a square). Defaults to 26. */
  size?: number;
  /** Colour for the axes lines. Defaults to var(--accent-blue). */
  axisColor?: string;
  /** Colour for the chart trend line. Defaults to var(--accent-emerald). */
  lineColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The Portfolio Tracker brand icon: an L-shaped axis with a rising
 * trend line. Used as the login-page icon mark and the app favicon.
 */
export default function PortfolioIcon({
  size = 26,
  axisColor = 'var(--accent-blue)',
  lineColor = 'var(--accent-emerald)',
  className,
  style,
}: PortfolioIconProps) {
  return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={className}
        style={style}
      >
        {/* Axes */}
        <path
          d="M3 3v18h18"
          stroke={axisColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Trend line */}
        <path
          d="M7 16l4-4 4 4 4-6"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
  );
}
