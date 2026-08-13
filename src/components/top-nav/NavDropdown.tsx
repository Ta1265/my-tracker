'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Dropdown } from 'flowbite-react';
import { usePathname } from 'next/navigation';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { useSingleStat } from '../../context/SingleStatContext';
import { useSummaryVisibility } from '../../context/SummaryVisibilityContext';
import { useTheme, themes, type ThemeId } from '../../context/ThemeContext';
import { useBackground, backgrounds, type BackgroundId } from '../../context/BackgroundContext';

/** Swatch colour shown next to each theme name in the dropdown. */
const themeSwatchColor: Record<ThemeId, string> = {
  'deep-space': '#3b82f6',
  'light': '#2563eb',
  'midnight-purple': '#f97316',
  'forest-dark': '#80cbc4',
  'material': '#80cbc4',
  'slate-gold': '#c49c3f',
};

const NavDropdown: React.FC = () => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isProductPage = pathname?.startsWith('/product');
  const isStatsPage = pathname?.startsWith('/stats') || pathname === '/';
  const { selectedStats, toggleStat, statLabelList } = useSingleStat();
  const { showChart, setShowChart, showSummary, setShowSummary, showBreakdown, setShowBreakdown } = useSummaryVisibility();
  const { theme, setTheme } = useTheme();
  const { background, setBackground } = useBackground();
  const light = theme === 'light';

  return (
    <Dropdown
      className="z-[999]"
      arrowIcon={false}
      inline
      style={
        light
          ? {
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.10)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              color: '#0f172a',
             height: ' 40px',
            }
          : {
             height: ' 40px',
          }
      }
      label={
        <span
          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          style={{
            background: 'var(--user-pill-bg)',
            border: '1px solid var(--user-pill-border)',
            color: 'var(--text-secondary)',
          }}
        >
          {session?.isAuthenticated ? (
            <>
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
            </>
          ) : (<>{'Theme'}</>)}
        </span>
      }
    >
      <div
        className="dropdown-scroll-inner"
        style={{
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#000 transparent',
        }}
      >
        {session?.isAuthenticated && (
          <Dropdown.Header
            className="py-2"
            style={{
              background: 'var(--dropdown-bg)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span
              className="block py-1 text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {session?.user.name}
            </span>
            <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              {session?.user.email}
            </span>
          </Dropdown.Header>
        )}
        {isStatsPage && (
          <>
            <Dropdown.Header
              className="px-4 py-1.5"
              style={{
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span
                className="block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
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
              className="px-4 py-1.5"
              style={{
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span
                className="block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
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
          className="px-4 py-1.5"
          style={{
            background: 'var(--dropdown-bg)',
            borderBottom: '1px solid var(--border-subtle)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <span
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
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
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: themeSwatchColor[t.id],
                flexShrink: 0,
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>{t.label}</span>
          </Dropdown.Item>
        ))}
        <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
        <Dropdown.Header
          className="px-4 py-1.5"
          style={{
            background: 'var(--dropdown-bg)',
            borderBottom: '1px solid var(--border-subtle)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <span
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Background
          </span>
        </Dropdown.Header>
        {backgrounds.map((b) => (
          <Dropdown.Item
            key={b.id}
            className="flex items-center gap-2 px-4 py-1.5 text-sm"
            onClick={() => setBackground(b.id as BackgroundId)}
          >
            {background === b.id ? (
              <CheckBoxIcon className="text-blue-400" fontSize="small" />
            ) : (
              <CheckBoxOutlineBlankIcon className="text-gray-600" fontSize="small" />
            )}
            <span style={{ fontSize: 13, lineHeight: 1, userSelect: 'none' }}>{b.icon}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{b.label}</span>
          </Dropdown.Item>
        ))}
        <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
        {session?.isAuthenticated && (
          <Dropdown.Item
            className="py-2 text-sm"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => signOut()}
          >
            Sign out
          </Dropdown.Item>
        )}
      </div>
    </Dropdown>
  );
};

export default NavDropdown;
