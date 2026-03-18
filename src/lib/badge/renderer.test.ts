/**
 * Badge Renderer Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BadgeRenderer, injectStyles, findOptimalPosition } from './renderer';
import type { BadgeWidgetConfig, BadgeStatsResponse } from './api-client';

describe('BadgeRenderer', () => {
  let renderer: BadgeRenderer;
  let container: HTMLElement;
  let mockConfig: BadgeWidgetConfig;
  let mockStats: BadgeStatsResponse;

  beforeEach(() => {
    // Create a container element
    container = document.createElement('div');
    document.body.appendChild(container);

    mockConfig = {
      sellerId: 'test-seller-id',
      size: 'medium',
      theme: 'light',
      color: 'blue',
      showRating: true,
      showStats: true,
      position: 'auto',
    };

    mockStats = {
      seller: {
        id: 'test-seller-id',
        name: 'Test Seller',
        kycTier: 'full',
        kycVerified: true,
      },
      stats: {
        totalTransactions: 100,
        successRate: 95,
        totalAmount: 50000000,
      },
      verification: {
        level: 'Verified',
        isVerified: true,
      },
    };

    renderer = new BadgeRenderer({
      container,
      config: mockConfig,
      stats: mockStats,
      verificationUrl: 'https://escrow-lite.id/badge/test-seller-id/verify',
    });
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should create instance with options', () => {
      expect(renderer).toBeInstanceOf(BadgeRenderer);
    });
  });

  describe('render', () => {
    it('should render badge widget', () => {
      const element = renderer.render();

      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.className).toContain('el-badge-widget');
      expect(element.className).toContain('el-badge-light');
      expect(element.className).toContain('el-badge-blue');
      expect(element.className).toContain('el-badge-medium');
      expect(container.contains(element)).toBe(true);
    });

    it('should render header section', () => {
      const element = renderer.render();
      const header = element.querySelector('.el-badge-header');

      expect(header).toBeTruthy();
    });

    it('should render stats section when enabled', () => {
      const element = renderer.render();
      const stats = element.querySelector('.el-badge-stats');

      expect(stats).toBeTruthy();
    });

    it('should not render stats section when disabled', () => {
      const config = { ...mockConfig, showStats: false };
      const rendererWithoutStats = new BadgeRenderer({
        container,
        config,
        stats: mockStats,
        verificationUrl: 'https://escrow-lite.id/badge/test-seller-id/verify',
      });

      const element = rendererWithoutStats.render();
      const stats = element.querySelector('.el-badge-stats');

      expect(stats).toBeFalsy();
    });

    it('should render verification badge when enabled', () => {
      const element = renderer.render();
      const verification = element.querySelector('.el-badge-verification');

      expect(verification).toBeTruthy();
    });

    it('should not render verification badge when disabled', () => {
      const config = { ...mockConfig, showRating: false };
      const rendererWithoutRating = new BadgeRenderer({
        container,
        config,
        stats: mockStats,
        verificationUrl: 'https://escrow-lite.id/badge/test-seller-id/verify',
      });

      const element = rendererWithoutRating.render();
      const verification = element.querySelector('.el-badge-verification');

      expect(verification).toBeFalsy();
    });

    it('should render logo with shield icon', () => {
      const element = renderer.render();
      const logo = element.querySelector('.el-badge-logo');
      const icon = logo?.querySelector('svg');

      expect(logo).toBeTruthy();
      expect(icon).toBeTruthy();
    });

    it('should render transactions stat', () => {
      const element = renderer.render();
      const statItems = element.querySelectorAll('.el-badge-stat-item');

      expect(statItems.length).toBe(2);
      expect(statItems[0].querySelector('.el-badge-stat-label')?.textContent).toBe('Transactions');
      expect(statItems[0].querySelector('.el-badge-stat-value')?.textContent).toBe('100');
    });

    it('should render success rate stat', () => {
      const element = renderer.render();
      const statItems = element.querySelectorAll('.el-badge-stat-item');

      expect(statItems.length).toBe(2);
      expect(statItems[1].querySelector('.el-badge-stat-label')?.textContent).toBe('Success Rate');
      expect(statItems[1].querySelector('.el-badge-stat-value')?.textContent).toBe('95%');
    });

    it('should make badge clickable', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const element = renderer.render();
      element.click();

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://escrow-lite.id/badge/test-seller-id/verify',
        '_blank',
        'noopener,noreferrer'
      );

      windowOpenSpy.mockRestore();
    });
  });

  describe('update', () => {
    it('should update badge with new stats', () => {
      const element = renderer.render();
      const initialStats = element.querySelectorAll('.el-badge-stat-value');

      const newStats = {
        ...mockStats,
        stats: {
          totalTransactions: 200,
          successRate: 98,
          totalAmount: 100000000,
        },
      };

      renderer.update(newStats);

      const updatedStats = container.querySelectorAll('.el-badge-stat-value');
      expect(updatedStats[0].textContent).toBe('200');
      expect(updatedStats[1].textContent).toBe('98%');
    });

    it('should throw error if badge not rendered yet', () => {
      const newStats = { ...mockStats };

      expect(() => renderer.update(newStats)).toThrow('Badge not rendered yet');
    });
  });

  describe('destroy', () => {
    it('should remove badge from DOM', () => {
      const element = renderer.render();
      expect(container.contains(element)).toBe(true);

      renderer.destroy();

      expect(container.contains(element)).toBe(false);
    });

    it('should not throw error if badge not rendered', () => {
      expect(() => renderer.destroy()).not.toThrow();
    });
  });

  describe('size variants', () => {
    it('should render small size correctly', () => {
      const config = { ...mockConfig, size: 'small' as const };
      const smallRenderer = new BadgeRenderer({
        container,
        config,
        stats: mockStats,
        verificationUrl: 'https://escrow-lite.id/badge/test-seller-id/verify',
      });

      const element = smallRenderer.render();
      expect(element.style.width).toBe('150px');
      expect(element.style.height).toBe('60px');
      expect(element.className).toContain('el-badge-small');
    });

    it('should render medium size correctly', () => {
      const element = renderer.render();
      expect(element.style.width).toBe('200px');
      expect(element.style.height).toBe('80px');
      expect(element.className).toContain('el-badge-medium');
    });

    it('should render large size correctly', () => {
      const config = { ...mockConfig, size: 'large' as const };
      const largeRenderer = new BadgeRenderer({
        container,
        config,
        stats: mockStats,
        verificationUrl: 'https://escrow-lite.id/badge/test-seller-id/verify',
      });

      const element = largeRenderer.render();
      expect(element.style.width).toBe('250px');
      expect(element.style.height).toBe('100px');
      expect(element.className).toContain('el-badge-large');
    });
  });

  describe('theme variants', () => {
    it('should render light theme correctly', () => {
      const element = renderer.render();
      expect(element.className).toContain('el-badge-light');
    });

    it('should render dark theme correctly', () => {
      const config = { ...mockConfig, theme: 'dark' as const };
      const darkRenderer = new BadgeRenderer({
        container,
        config,
        stats: mockStats,
        verificationUrl: 'https://escrow-lite.id/badge/test-seller-id/verify',
      });

      const element = darkRenderer.render();
      expect(element.className).toContain('el-badge-dark');
    });
  });

  describe('color variants', () => {
    it('should render blue color correctly', () => {
      const element = renderer.render();
      expect(element.className).toContain('el-badge-blue');
    });

    it('should render green color correctly', () => {
      const config = { ...mockConfig, color: 'green' as const };
      const greenRenderer = new BadgeRenderer({
        container,
        config,
        stats: mockStats,
        verificationUrl: 'https://escrow-lite.id/badge/test-seller-id/verify',
      });

      const element = greenRenderer.render();
      expect(element.className).toContain('el-badge-green');
    });

    it('should render neutral color correctly', () => {
      const config = { ...mockConfig, color: 'neutral' as const };
      const neutralRenderer = new BadgeRenderer({
        container,
        config,
        stats: mockStats,
        verificationUrl: 'https://escrow-lite.id/badge/test-seller-id/verify',
      });

      const element = neutralRenderer.render();
      expect(element.className).toContain('el-badge-neutral');
    });
  });
});

describe('injectStyles', () => {
  beforeEach(() => {
    // Remove any existing styles
    const existing = document.getElementById('el-badge-styles');
    if (existing) {
      existing.remove();
    }
  });

  it('should inject styles into head', () => {
    injectStyles();

    const styleElement = document.getElementById('el-badge-styles');
    expect(styleElement).toBeTruthy();
    expect(styleElement?.tagName).toBe('STYLE');
  });

  it('should not inject styles twice', () => {
    injectStyles();
    injectStyles();

    const styleElements = document.querySelectorAll('#el-badge-styles');
    expect(styleElements.length).toBe(1);
  });
});

describe('findOptimalPosition', () => {
  beforeEach(() => {
    // Reset document body
    document.body.innerHTML = '';
  });

  it('should find footer element when position is auto', () => {
    const footer = document.createElement('footer');
    document.body.appendChild(footer);

    const result = findOptimalPosition('auto');
    expect(result).toBe(footer);
  });

  it('should find element with .footer class', () => {
    const footer = document.createElement('div');
    footer.className = 'footer';
    document.body.appendChild(footer);

    const result = findOptimalPosition('auto');
    expect(result).toBe(footer);
  });

  it('should find element with role="contentinfo"', () => {
    const contentinfo = document.createElement('div');
    contentinfo.setAttribute('role', 'contentinfo');
    document.body.appendChild(contentinfo);

    const result = findOptimalPosition('auto');
    expect(result).toBe(contentinfo);
  });

  it('should return body when no suitable element found', () => {
    const result = findOptimalPosition('auto');
    expect(result).toBe(document.body);
  });

  it('should return body when position is left', () => {
    const result = findOptimalPosition('left');
    expect(result).toBe(document.body);
  });

  it('should return body when position is center', () => {
    const result = findOptimalPosition('center');
    expect(result).toBe(document.body);
  });

  it('should return body when position is right', () => {
    const result = findOptimalPosition('right');
    expect(result).toBe(document.body);
  });
});
