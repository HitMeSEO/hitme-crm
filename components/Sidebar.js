'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import {
  LayoutDashboard, Users, CheckSquare, FileText, Activity,
  Sun, Moon, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/activity', label: 'Activity', icon: Activity },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const [prevCount, setPrevCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function fetchCount() {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Not Started', 'In Progress', 'Pending Client Approval', 'Blocked']);
      const n = count || 0;
      if (n > prevCount) setPrevCount(n); // track increases for pulse trigger
      setPendingTaskCount(n);
    }
    fetchCount();
    // Poll every 60 seconds so the badge stays fresh
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const w = collapsed ? 64 : 220;

  return (
    <>
    <aside className="crm-sidebar" style={{
      width: w,
      minWidth: w,
      height: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s ease, min-width 0.2s ease',
      position: 'sticky',
      top: 0,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 12px' : '20px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 65,
      }}>
        {!collapsed && (
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--accent)' }}>Hit Me</span>{' '}
            <span style={{ color: 'var(--text-primary)' }}>SEO</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Main Nav */}
      <nav style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          padding: collapsed ? '8px 4px' : '8px 12px',
          display: collapsed ? 'none' : 'block',
        }}>
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const isTasksItem = item.href === '/tasks';
          const showBadge = isTasksItem && pendingTaskCount > 0;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={collapsed ? (isTasksItem && pendingTaskCount > 0 ? `Tasks (${pendingTaskCount} pending)` : item.label) : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? 'var(--accent-muted)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                transition: 'all 0.15s ease',
                marginBottom: 2,
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Icon — with dot badge when collapsed */}
              <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
                <Icon size={18} />
                {showBadge && collapsed && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#ef4444',
                    animation: 'badge-pulse 2s ease-in-out infinite',
                  }} />
                )}
              </span>

              {/* Label + count badge when expanded */}
              {!collapsed && (
                <>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {showBadge && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 10,
                      background: '#ef4444', color: 'white',
                      lineHeight: 1.4,
                      animation: 'badge-pulse 2s ease-in-out infinite',
                    }}>
                      {pendingTaskCount}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: Theme + Logout */}
      <div style={{
        padding: collapsed ? '12px 8px' : '12px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: collapsed ? 'column' : 'row',
        alignItems: 'center',
        gap: 8,
      }}>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>

    {/* Mobile bottom nav — shown only on small screens via CSS */}
    <nav className="crm-bottom-nav">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        const isTasksItem = item.href === '/tasks';
        const showBadge = isTasksItem && pendingTaskCount > 0;
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              borderTop: active ? '2px solid var(--accent)' : '2px solid transparent',
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              padding: '6px 0',
              minHeight: 'unset',
              position: 'relative',
            }}
          >
            <span style={{ position: 'relative', display: 'flex' }}>
              <Icon size={20} />
              {showBadge && (
                <span style={{
                  position: 'absolute', top: -3, right: -6,
                  fontSize: 9, fontWeight: 700,
                  padding: '1px 4px', borderRadius: 8,
                  background: '#ef4444', color: 'white', lineHeight: 1.4,
                  animation: 'badge-pulse 2s ease-in-out infinite',
                }}>
                  {pendingTaskCount > 99 ? '99+' : pendingTaskCount}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
    </>
  );
}
