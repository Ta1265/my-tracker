'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Dropdown } from 'flowbite-react';
import AddTransaction from './AddTransaction';
import { usePathname } from 'next/navigation';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { useSingleStat } from '../context/SingleStatContext';
import { useSummaryVisibility } from '../context/SummaryVisibilityContext';
import { useTheme, themes, type ThemeId } from '../context/ThemeContext';

const TopNav: React.FC<{}> = ({}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isProductPage = pathname?.startsWith('/product');
  const isStatsPage = pathname?.startsWith('/stats') || pathname === '/';
  const { selectedStats, toggleStat, statLabelList } = useSingleStat();
  const { showChart, setShowChart, showSummary, setShowSummary, showBreakdown, setShowBreakdown } = useSummaryVisibility();
  const { theme, setTheme } = useTheme();
  const light = theme === 'light';

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
        <div
          className="mx-auto flex w-full max-w-[960px] items-center gap-4 px-4 py-3"
        >
          {/* Logo + Portfolio button */}
          <div className="flex items-center gap-2">
            {/* App logo */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
              style={{ color: 'var(--accent-blue)' }}
            >
              <Image src="/logo.svg" alt="logo" width={32} height={32} style={{ filter: 'none' }} />
            </div>

            {/* Contained Portfolio button */}
            <Link
              href="/stats"
              className="flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold transition-all"
              style={{
                background: 'var(--accent-blue-glow)',
                border: '1px solid var(--add-btn-border)',
                color: 'var(--add-btn-color)',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--add-btn-hover-bg)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--add-btn-hover-border)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--accent-blue-glow)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--add-btn-border)';
              }}
            >
              Portfolio
            </Link>
          </div>

          {/* Add Transaction button */}
          <button
            onClick={() => setIsOpen(true)}
            className="ml-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
            style={{
              background: 'var(--add-btn-bg)',
              border: '1px solid var(--add-btn-border)',
              color: 'var(--add-btn-color)',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--add-btn-hover-bg)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--add-btn-hover-border)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--add-btn-bg)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--add-btn-border)';
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
            Add Transaction
          </button>

          {/* Auth section */}
          <div className="ml-auto flex items-center">
            {status === 'loading' ? null : session?.isAuthenticated ? (
              <Dropdown
                className="z-[999]"
                arrowIcon={false}
                inline
                style={light ? {
                  background: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.10)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  color: '#0f172a',
                } : undefined}
                label={
                  <span
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
                    style={{
                      background: 'var(--user-pill-bg)',
                      border: '1px solid var(--user-pill-border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        background: 'var(--avatar-bg)',
                        color: 'white',
                      }}
                    >
                      {session?.user.username?.[0]?.toUpperCase() || 'U'}
                    </span>
                    {session?.user.username}
                  </span>
                }
              >
                <Dropdown.Header
                  className="py-2"
                  style={{ background: 'var(--dropdown-bg)', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <span className="block py-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {session?.user.name}
                  </span>
                  <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                    {session?.user.email}
                  </span>
                </Dropdown.Header>
                {isStatsPage && (
                  <>
                    <Dropdown.Header
                      className="py-1.5 px-4"
                      style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Visible Sections
                      </span>
                    </Dropdown.Header>
                    {[
                      { label: 'Chart', value: showChart, set: setShowChart },
                      { label: 'Summary', value: showSummary, set: setShowSummary },
                      { label: 'Breakdown', value: showBreakdown, set: setShowBreakdown },
                    ].map(({ label, value, set }) => (
                      <Dropdown.Item
                        key={label}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm"
                        onClick={() => set(!value)}
                      >
                        {value ? (
                          <CheckBoxIcon className="text-blue-400" fontSize="small" />
                        ) : (
                          <CheckBoxOutlineBlankIcon className="text-gray-600" fontSize="small" />
                        )}
                        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      </Dropdown.Item>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                  </>
                )}
                {isProductPage && (
                  <>
                    <Dropdown.Header
                      className="py-1.5 px-4"
                      style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Visible Stats
                      </span>
                    </Dropdown.Header>
                    {statLabelList.map((label) => (
                      <Dropdown.Item
                        key={label}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm"
                        onClick={() => toggleStat(label)}
                      >
                        {selectedStats.includes(label) ? (
                          <CheckBoxIcon className="text-blue-400" fontSize="small" />
                        ) : (
                          <CheckBoxOutlineBlankIcon className="text-gray-600" fontSize="small" />
                        )}
                        <span style={{ color: 'var(--text-secondary)' }}>{label.trim()}</span>
                      </Dropdown.Item>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                  </>
                )}
                <Dropdown.Header
                  className="py-1.5 px-4"
                  style={{ background: 'var(--dropdown-bg)', borderBottom: '1px solid var(--border-subtle)', borderTop: '1px solid var(--border-subtle)' }}
                >
                  <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Theme
                  </span>
                </Dropdown.Header>
                {themes.map((t) => (
                  <Dropdown.Item
                    key={t.id}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm"
                    onClick={() => setTheme(t.id as ThemeId)}
                  >
                    {theme === t.id ? (
                      <CheckBoxIcon className="text-blue-400" fontSize="small" />
                    ) : (
                      <CheckBoxOutlineBlankIcon className="text-gray-600" fontSize="small" />
                    )}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {t.label}
                    </span>
                  </Dropdown.Item>
                ))}
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                <Dropdown.Item
                  className="py-2 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                  onClick={() => signOut()}
                >
                  Sign out
                </Dropdown.Item>
              </Dropdown>
            ) : (
              <button
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
                style={{
                  background: 'var(--user-pill-bg)',
                  border: '1px solid var(--user-pill-border)',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--dropdown-item-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--user-pill-bg)';
                }}
                onClick={() => signIn()}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </nav>

      <AddTransaction
        isOpen={isOpen || false}
        setIsOpen={(value) => setIsOpen(value)}
      />
    </>
  );
};

export default TopNav;
