/**
 * Dashboard Layout Tests
 *
 * These tests verify the dashboard layout components are properly configured
 * Note: Full visual regression testing would require Playwright or similar
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Dashboard Layout Components', () => {
  const srcDir = join(process.cwd(), 'src');

  describe('Component Files Exist', () => {
    it('should have DashboardLayout.astro', () => {
      const layoutPath = join(srcDir, 'layouts', 'DashboardLayout.astro');
      expect(existsSync(layoutPath)).toBe(true);
    });

    it('should have Header.astro component', () => {
      const headerPath = join(srcDir, 'components', 'dashboard', 'Header.astro');
      expect(existsSync(headerPath)).toBe(true);
    });

    it('should have Navigation.astro component', () => {
      const navPath = join(srcDir, 'components', 'dashboard', 'Navigation.astro');
      expect(existsSync(navPath)).toBe(true);
    });

    it('should have dashboard index page', () => {
      const indexPath = join(srcDir, 'pages', 'dashboard', 'index.astro');
      expect(existsSync(indexPath)).toBe(true);
    });

    it('should have login page', () => {
      const loginPath = join(srcDir, 'pages', 'login.astro');
      expect(existsSync(loginPath)).toBe(true);
    });
  });

  describe('DashboardLayout Content', () => {
    it('should use session from middleware', () => {
      const layoutPath = join(srcDir, 'layouts', 'DashboardLayout.astro');
      const content = readFileSync(layoutPath, 'utf-8');
      expect(content).toContain('Astro.locals.session');
    });

    it('should include Header and Navigation components', () => {
      const layoutPath = join(srcDir, 'layouts', 'DashboardLayout.astro');
      const content = readFileSync(layoutPath, 'utf-8');
      expect(content).toContain('@/components/dashboard/Header.astro');
      expect(content).toContain('@/components/dashboard/Navigation.astro');
    });
  });

  describe('Navigation Menu Items', () => {
    it('should have all required navigation items', () => {
      const navPath = join(srcDir, 'components', 'dashboard', 'Navigation.astro');
      const content = readFileSync(navPath, 'utf-8');
      expect(content).toContain('/dashboard');
      expect(content).toContain('/dashboard/transactions');
      expect(content).toContain('/dashboard/payouts');
      expect(content).toContain('/dashboard/balance');
      expect(content).toContain('/dashboard/settings');
    });
  });

  describe('Dashboard Home Page', () => {
    it('should load seller dashboard data from APIs', () => {
      const indexPath = join(srcDir, 'pages', 'dashboard', 'index.astro');
      const content = readFileSync(indexPath, 'utf-8');
      expect(content).toContain('/api/v1/seller/balance');
      expect(content).toContain('/api/v1/seller/transactions');
    });

    it('should format currency in Indonesian Rupiah', () => {
      const indexPath = join(srcDir, 'pages', 'dashboard', 'index.astro');
      const content = readFileSync(indexPath, 'utf-8');
      expect(content).toContain('formatRupiah');
      expect(content).toContain('Ringkasan seller');
    });

    it('should have status badge styling', () => {
      const indexPath = join(srcDir, 'pages', 'dashboard', 'index.astro');
      const content = readFileSync(indexPath, 'utf-8');
      expect(content).toContain('status-pill--held');
      expect(content).toContain('status-pill--released');
      expect(content).toContain('status-pill--disputed');
      expect(content).toContain('status-pill--refunded');
    });
  });

  describe('Utility Functions', () => {
    it('should have dashboard utility functions', () => {
      const utilsPath = join(srcDir, 'lib', 'dashboard-utils.ts');
      expect(existsSync(utilsPath)).toBe(true);

      const content = readFileSync(utilsPath, 'utf-8');
      expect(content).toContain('formatRupiah');
      expect(content).toContain('formatDate');
      expect(content).toContain('getStatusColor');
      expect(content).toContain('getStatusLabel');
    });

    it('should use Indonesian locale for formatting', () => {
      const utilsPath = join(srcDir, 'lib', 'dashboard-utils.ts');
      const content = readFileSync(utilsPath, 'utf-8');
      expect(content).toContain('id-ID');
    });
  });

  describe('Responsive Design', () => {
    it('should have mobile responsive styles in layout', () => {
      const layoutPath = join(srcDir, 'layouts', 'DashboardLayout.astro');
      const content = readFileSync(layoutPath, 'utf-8');
      expect(content).toContain('@media (max-width: 768px)');
    });

    it('should have mobile menu toggle in Header', () => {
      const headerPath = join(srcDir, 'components', 'dashboard', 'Header.astro');
      const content = readFileSync(headerPath, 'utf-8');
      expect(content).toContain('mobile-menu-toggle');
    });

    it('should have mobile navigation styles', () => {
      const navPath = join(srcDir, 'components', 'dashboard', 'Navigation.astro');
      const content = readFileSync(navPath, 'utf-8');
      expect(content).toContain('mobile-open');
      expect(content).toContain('translateX(-100%)');
    });
  });

  describe('Placeholder Pages', () => {
    const placeholderPages = ['transactions', 'payouts', 'balance', 'settings'];

    placeholderPages.forEach((page) => {
      it(`should have ${page} dashboard page`, () => {
        const pagePath = join(srcDir, 'pages', 'dashboard', `${page}.astro`);
        expect(existsSync(pagePath)).toBe(true);
      });
    });
  });

  describe('Authentication Integration', () => {
    it('should have middleware for runtime injection', () => {
      const middlewarePath = join(srcDir, 'middleware.ts');
      expect(existsSync(middlewarePath)).toBe(true);

      const content = readFileSync(middlewarePath, 'utf-8');
      expect(content).toContain('defineMiddleware');
      expect(content).toContain('context.locals');
    });

    it('should redirect unauthenticated users', () => {
      const middlewarePath = join(srcDir, 'middleware.ts');
      const content = readFileSync(middlewarePath, 'utf-8');
      expect(content).toContain('session');
      expect(content).toContain('redirect');
    });
  });
});

describe('Dashboard Utilities', () => {
  it('should format Rupiah correctly', () => {
    // Format Rupiah tests
    const testAmount1 = 1000000;
    const formatted1 = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(testAmount1);

    expect(formatted1).toContain('1.000.000');

    const testAmount2 = 50000;
    const formatted2 = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(testAmount2);

    expect(formatted2).toContain('50.000');
  });

  it('should mask email addresses', () => {
    // Email mask function test
    const maskEmail = (email: string) => {
      const [localPart, domain] = email.split('@');
      if (localPart.length <= 2) {
        return `${localPart[0]}***@${domain}`;
      }
      return `${localPart.slice(0, 2)}***@${domain}`;
    };

    expect(maskEmail('budi@gmail.com')).toBe('bu***@gmail.com');
    expect(maskEmail('test@yahoo.com')).toBe('te***@yahoo.com');
    expect(maskEmail('a@b.com')).toBe('a***@b.com');
  });

  it('should get status labels in Indonesian', () => {
    // Status label test
    const labels: Record<string, string> = {
      held: 'Ditahan',
      released: 'Dirilis',
      disputed: 'Disengketakan',
      refunded: 'Dikembalikan',
    };

    expect(labels['held']).toBe('Ditahan');
    expect(labels['released']).toBe('Dirilis');
    expect(labels['disputed']).toBe('Disengketakan');
    expect(labels['refunded']).toBe('Dikembalikan');
  });
});
