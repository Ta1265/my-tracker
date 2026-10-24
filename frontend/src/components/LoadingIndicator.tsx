'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 0,
      }}
    >
      {/* Animated ring */}
      <div style={{ position: 'relative', width: 64, height: 64, marginBottom: 28 }}>
        {/* Track ring */}
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          style={{ position: 'absolute', inset: 0 }}
        >
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            style={{ stroke: 'var(--border-subtle)' }}
            strokeWidth="3"
          />
        </svg>
        {/* Spinning arc */}
        <motion.svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          style={{ position: 'absolute', inset: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        >
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            style={{ stroke: 'var(--accent-blue)' }}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="50 113"
            strokeDashoffset="0"
          />
        </motion.svg>
        {/* Center icon */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 3v18h18"
              style={{ stroke: 'var(--accent-blue)', opacity: 0.7 }}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 16l4-4 4 4 4-6"
              style={{ stroke: 'var(--accent-blue)', opacity: 0.7 }}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Text */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        style={{
          color: 'var(--text-secondary)',
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '0.01em',
          marginBottom: 8,
        }}
      >
        Loading your data
      </motion.p>

      {/* Animated dots */}
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
            style={{
              display: 'block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--accent-blue)',
              opacity: 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}
