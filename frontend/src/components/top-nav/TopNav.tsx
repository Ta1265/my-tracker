'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import PortfolioIcon from '../PortfolioIcon';
import { useAuthSession } from '@/api/generated';
import AddTransaction from '../AddTransaction';
import NavDropdown from './NavDropdown';
import Button from '@mui/material/Button';

export default function TopNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useAuthSession();

  return (
    <>
      <nav
        style={{
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--nav-border)',
          width: '100%',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div className="mx-auto flex w-full max-w-[960px] items-center gap-4 px-4 py-3">
          {/* Logo — links to /stats */}
          <Link
            href="/stats"
            className="flex h-8 w-8 items-center justify-center"
            style={{
              width: 45,
              height: 45,
              borderRadius: 14,
              background: 'var(--accent-blue-glow)',
              border: '1px solid var(--border-accent)',
              boxShadow: '0 0 32px var(--accent-blue-glow)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '0.85';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
            }}
            aria-label="Portfolio Tracker"
          >
            <PortfolioIcon size={26} />
          </Link>

          {/* Add Transaction button */}
          {session?.isAuthenticated && (
            <Button
              onClick={() => setIsOpen(true)}
              variant="outlined"
              size="small"
              sx={{
                background: 'var(--add-btn-bg)',
                borderColor: 'var(--add-btn-border)',
                color: 'var(--add-btn-color)',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                height: '40px',
                borderRadius: '8px',
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                gap: '6px',
                '&:hover': {
                  background: 'var(--add-btn-hover-bg)',
                  borderColor: 'var(--add-btn-hover-border)',
                },
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
              Add Transaction
            </Button>
          )}

          {/* Auth/Theme section */}
          <div className="ml-auto flex items-center">
            <NavDropdown />
          </div>
        </div>
      </nav>

      <AddTransaction isOpen={isOpen || false} setIsOpen={(value) => setIsOpen(value)} />
    </>
  );
};