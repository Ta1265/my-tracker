'use client';

import React from 'react';
import { useBackground, backgrounds } from '../context/BackgroundContext';

/**
 * Full-viewport fixed background image with a dark overlay.
 * Sits at z-index 0, behind all page content (main is at z-index 1).
 */
export default function ImageBackground() {
  const { background } = useBackground();

  const bgSrc = React.useMemo(() => {
    const bg = backgrounds.find((b) => b.id === background);
    return bg?.src
  }, [background]);

  if (!bgSrc) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Photo layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url('${bgSrc}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* Dark overlay — ensures UI elements remain readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(0, 0, 0, .1)`,
        }}
      />
    </div>
  );
}
