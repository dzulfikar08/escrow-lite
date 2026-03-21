/**
 * Badge Renderer
 *
 * Client-side badge rendering logic for the JavaScript widget
 * Handles DOM manipulation and styling without external dependencies
 */

import type { BadgeWidgetConfig, BadgeStatsResponse } from './api-client';

export interface BadgeRendererOptions {
  container: HTMLElement;
  config: BadgeWidgetConfig;
  stats: BadgeStatsResponse;
  verificationUrl: string;
}

/**
 * Badge Renderer class
 */
export class BadgeRenderer {
  private container: HTMLElement;
  private config: BadgeRendererOptions['config'];
  private stats: BadgeRendererOptions['stats'];
  private verificationUrl: string;
  private element: HTMLElement | null = null;

  constructor(options: BadgeRendererOptions) {
    this.container = options.container;
    this.config = options.config;
    this.stats = options.stats;
    this.verificationUrl = options.verificationUrl;
  }

  /**
   * Render the badge widget
   */
  render(): HTMLElement {
    // Create badge wrapper element
    const wrapper = this.createWrapper();

    // Create badge header
    const header = this.createHeader();
    wrapper.appendChild(header);

    // Create stats section if enabled
    if (this.config.showStats) {
      const stats = this.createStats();
      wrapper.appendChild(stats);
    }

    // Store reference
    this.element = wrapper;

    // Append to container
    this.container.appendChild(wrapper);

    return wrapper;
  }

  /**
   * Update badge with new stats
   */
  update(stats: BadgeStatsResponse): void {
    if (!this.element) {
      throw new Error('Badge not rendered yet');
    }

    this.stats = stats;

    // Re-render the badge
    const newWrapper = this.createWrapper();
    const header = this.createHeader();
    newWrapper.appendChild(header);

    if (this.config.showStats) {
      const statsSection = this.createStats();
      newWrapper.appendChild(statsSection);
    }

    // Replace old element with new one
    this.element.replaceWith(newWrapper);
    this.element = newWrapper;
  }

  /**
   * Remove badge from DOM
   */
  destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    }
  }

  /**
   * Create wrapper element
   */
  private createWrapper(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = this.getWrapperClasses();

    // Apply inline styles for dimensions
    const sizeStyles = this.getSizeStyles();
    Object.assign(wrapper.style, sizeStyles);

    // Make clickable
    wrapper.addEventListener('click', () => {
      window.open(this.verificationUrl, '_blank', 'noopener,noreferrer');
    });

    return wrapper;
  }

  /**
   * Create header section
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'el-badge-header';

    // Create logo section
    const logo = this.createLogo();
    header.appendChild(logo);

    // Create verification badge if enabled
    if (this.config.showRating) {
      const verification = this.createVerificationBadge();
      header.appendChild(verification);
    }

    return header;
  }

  /**
   * Create logo section
   */
  private createLogo(): HTMLElement {
    const logo = document.createElement('div');
    logo.className = 'el-badge-logo';

    // Shield icon
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
    icon.appendChild(path);

    logo.appendChild(icon);

    // Title text
    const title = document.createElement('span');
    title.className = 'el-badge-title';
    title.textContent = 'Protected by Escrow Lite';
    logo.appendChild(title);

    return logo;
  }

  /**
   * Create verification badge
   */
  private createVerificationBadge(): HTMLElement {
    const badge = document.createElement('div');
    badge.className = 'el-badge-verification';

    // Add verified icon if KYC verified
    if (this.stats.seller.kycVerified) {
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      icon.setAttribute('width', '14');
      icon.setAttribute('height', '14');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('stroke-linejoin', 'round');
      icon.setAttribute('class', 'el-badge-verified-icon');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '10');
      icon.appendChild(circle);

      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path1.setAttribute('d', 'M22 11.08V12a10 10 0 1 1-5.93-9.14');
      icon.appendChild(path1);

      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', '22 4 12 14.01 9 11.01');
      icon.appendChild(polyline);

      badge.appendChild(icon);
    }

    // Verification text
    const text = document.createElement('span');
    text.className = 'el-badge-verification-text';
    text.textContent = this.getVerificationText();
    badge.appendChild(text);

    return badge;
  }

  /**
   * Create stats section
   */
  private createStats(): HTMLElement {
    const stats = document.createElement('div');
    stats.className = 'el-badge-stats';

    // Transactions stat
    const transactions = this.createStatItem(
      'Transactions',
      this.formatNumber(this.stats.stats.totalTransactions)
    );
    stats.appendChild(transactions);

    // Success rate stat
    const successRate = this.createStatItem(
      'Success Rate',
      `${this.stats.stats.successRate}%`,
      this.getSuccessRateColor(this.stats.stats.successRate)
    );
    stats.appendChild(successRate);

    return stats;
  }

  /**
   * Create a stat item
   */
  private createStatItem(label: string, value: string, colorClass?: string): HTMLElement {
    const item = document.createElement('div');
    item.className = 'el-badge-stat-item';

    const labelEl = document.createElement('span');
    labelEl.className = 'el-badge-stat-label';
    labelEl.textContent = label;
    item.appendChild(labelEl);

    const valueEl = document.createElement('span');
    valueEl.className = `el-badge-stat-value ${colorClass || ''}`;
    valueEl.textContent = value;
    item.appendChild(valueEl);

    return item;
  }

  /**
   * Get wrapper CSS classes
   */
  private getWrapperClasses(): string {
    const classes = ['el-badge-widget'];

    // Theme
    classes.push(`el-badge-${this.config.theme}`);

    // Color
    classes.push(`el-badge-${this.config.color}`);

    // Size
    classes.push(`el-badge-${this.config.size}`);

    return classes.join(' ');
  }

  /**
   * Get size-specific styles
   */
  private getSizeStyles(): Record<string, string> {
    const sizeConfig = {
      small: { width: '150px', height: '60px' },
      medium: { width: '200px', height: '80px' },
      large: { width: '250px', height: '100px' },
    };

    return {
      width: sizeConfig[this.config.size].width,
      height: sizeConfig[this.config.size].height,
      cursor: 'pointer',
    };
  }

  /**
   * Get verification text based on KYC status
   */
  private getVerificationText(): string {
    const { kycTier, kycVerified } = this.stats.seller;

    if (kycVerified && kycTier === 'full') {
      return 'Verified Seller';
    }
    if (kycVerified && kycTier === 'basic') {
      return 'Basic Verified';
    }
    return 'Seller';
  }

  /**
   * Get success rate color class
   */
  private getSuccessRateColor(rate: number): string {
    if (rate >= 95) return 'el-badge-success-green';
    if (rate >= 85) return 'el-badge-success-blue';
    if (rate >= 70) return 'el-badge-success-yellow';
    return 'el-badge-success-gray';
  }

  /**
   * Format number with Indonesian locale
   */
  private formatNumber(num: number): string {
    return new Intl.NumberFormat('id-ID').format(num);
  }
}

/**
 * Inject CSS styles into the page
 */
export function injectStyles(): void {
  // Check if styles already injected
  if (document.getElementById('el-badge-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'el-badge-styles';
  style.textContent = getBadgeStyles();
  document.head.appendChild(style);
}

/**
 * Get badge CSS styles
 */
function getBadgeStyles(): string {
  return `
.el-badge-widget {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  border-radius: 8px;
  border: 1px solid;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  transition: all 0.2s ease;
  text-decoration: none;
}

.el-badge-widget:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Light theme */
.el-badge-light {
  background-color: #ffffff;
  border-color: #e5e7eb;
}

.el-badge-light.el-badge-blue {
  border-color: #3b82f6;
}

.el-badge-light.el-badge-green {
  border-color: #10b981;
}

.el-badge-light.el-badge-neutral {
  border-color: #9ca3af;
}

/* Dark theme */
.el-badge-dark {
  background-color: #1f2937;
  border-color: #374151;
}

.el-badge-dark.el-badge-blue {
  border-color: #3b82f6;
}

.el-badge-dark.el-badge-green {
  border-color: #10b981;
}

.el-badge-dark.el-badge-neutral {
  border-color: #6b7280;
}

/* Header */
.el-badge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.el-badge-logo {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.el-badge-light .el-badge-logo {
  color: #2563eb;
}

.el-badge-light.el-badge-green .el-badge-logo {
  color: #059669;
}

.el-badge-light.el-badge-neutral .el-badge-logo {
  color: #4b5563;
}

.el-badge-dark .el-badge-logo {
  color: #60a5fa;
}

.el-badge-title {
  font-weight: 600;
  font-size: 0.75rem;
  white-space: nowrap;
}

.el-badge-verification {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.el-badge-verified-icon {
  color: #10b981;
  flex-shrink: 0;
}

.el-badge-verification-text {
  font-size: 0.65rem;
  font-weight: 500;
  white-space: nowrap;
}

.el-badge-light .el-badge-verification-text {
  color: #6b7280;
}

.el-badge-dark .el-badge-verification-text {
  color: #d1d5db;
}

/* Stats */
.el-badge-stats {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.el-badge-stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.el-badge-stat-label {
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.el-badge-light .el-badge-stat-label {
  color: #6b7280;
}

.el-badge-dark .el-badge-stat-label {
  color: #9ca3af;
}

.el-badge-stat-value {
  font-weight: 700;
  font-size: 0.875rem;
  line-height: 1;
}

.el-badge-light .el-badge-stat-value {
  color: #111827;
}

.el-badge-dark .el-badge-stat-value {
  color: #f3f4f6;
}

.el-badge-success-green {
  color: #10b981 !important;
}

.el-badge-success-blue {
  color: #3b82f6 !important;
}

.el-badge-success-yellow {
  color: #f59e0b !important;
}

.el-badge-success-gray {
  color: #9ca3af !important;
}

/* Size variants */
.el-badge-small {
  padding: 0.5rem;
}

.el-badge-small .el-badge-title {
  font-size: 0.625rem;
}

.el-badge-small .el-badge-verification-text {
  font-size: 0.5625rem;
}

.el-badge-small .el-badge-stat-label {
  font-size: 0.5625rem;
}

.el-badge-small .el-badge-stat-value {
  font-size: 0.75rem;
}

.el-badge-medium {
  padding: 0.75rem;
}

.el-badge-large {
  padding: 1rem;
}

.el-badge-large .el-badge-title {
  font-size: 0.875rem;
}

.el-badge-large .el-badge-verification-text {
  font-size: 0.75rem;
}

.el-badge-large .el-badge-stat-label {
  font-size: 0.6875rem;
}

.el-badge-large .el-badge-stat-value {
  font-size: 1rem;
}
`;
}

/**
 * Find optimal position for badge
 */
export function findOptimalPosition(position: string): HTMLElement | null {
  if (position === 'auto') {
    // Try to find a suitable container
    const selectors = [
      'footer',
      '.footer',
      '[role="contentinfo"]',
      'body',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element as HTMLElement;
      }
    }
  } else if (position === 'left') {
    return document.body;
  } else if (position === 'center') {
    return document.body;
  } else if (position === 'right') {
    return document.body;
  }

  return document.body;
}
