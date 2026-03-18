/**
 * Error Monitoring Dashboard Script
 *
 * Handles fetching error data, rendering charts, and managing error interactions.
 */

// State
let currentFilters = {
  errorType: '',
  status: '',
  hours: 24,
  limit: 100,
};
let currentPage = 0;

// API endpoints
const API_BASE = '/api/v1/monitoring/errors';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  setupEventListeners();
  startAutoRefresh();
});

/**
 * Load dashboard data
 */
async function loadDashboard() {
  try {
    await Promise.all([
      loadStats(),
      loadErrors(),
      loadTrend(),
      checkAlerts(),
    ]);
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    showError('Failed to load dashboard data');
  }
}

/**
 * Load error statistics
 */
async function loadStats() {
  try {
    const params = new URLSearchParams({
      action: 'stats',
      hours: currentFilters.hours.toString(),
    });

    if (currentFilters.errorType) params.append('errorType', currentFilters.errorType);
    if (currentFilters.status) params.append('status', currentFilters.status);
    if (currentFilters.limit) params.append('limit', currentFilters.limit.toString());

    const response = await fetch(`${API_BASE}?${params}`);
    if (!response.ok) throw new Error('Failed to fetch stats');

    const data = await response.json();

    // Update overview cards
    document.getElementById('total-errors').textContent = data.aggregation.totalErrors.toLocaleString();

    // Load error rate
    await loadErrorRate();

    // Update error type breakdown
    renderErrorTypeChart(data.aggregation.errorsByType);
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

/**
 * Load error rate metrics
 */
async function loadErrorRate() {
  try {
    const response = await fetch(`${API_BASE}?action=rate&window=5`);
    if (!response.ok) throw new Error('Failed to fetch error rate');

    const data = await response.json();

    const rateElement = document.getElementById('error-rate');
    const trendElement = document.getElementById('error-trend');

    rateElement.textContent = `${data.metrics.currentRate.toFixed(2)}/min`;

    // Update trend with indicator
    const trendIcon = data.metrics.trend === 'increasing' ? '↑' : data.metrics.trend === 'decreasing' ? '↓' : '→';
    const trendColor = data.metrics.trend === 'increasing' ? 'text-red-600' : data.metrics.trend === 'decreasing' ? 'text-green-600' : 'text-gray-600';

    // Safe DOM manipulation instead of innerHTML
    trendElement.textContent = '';
    const span = document.createElement('span');
    span.className = trendColor;
    span.textContent = `${trendIcon} ${data.metrics.percentageChange.toFixed(0)}%`;
    trendElement.appendChild(span);
  } catch (error) {
    console.error('Failed to load error rate:', error);
  }
}

/**
 * Load errors table
 */
async function loadErrors() {
  try {
    const params = new URLSearchParams({
      action: 'recent',
      hours: currentFilters.hours.toString(),
      limit: currentFilters.limit.toString(),
    });

    if (currentFilters.errorType) params.append('errorType', currentFilters.errorType);
    if (currentFilters.status) params.append('status', currentFilters.status);

    const response = await fetch(`${API_BASE}?${params}`);
    if (!response.ok) throw new Error('Failed to fetch errors');

    const data = await response.json();

    renderErrorsTable(data.errors);

    // Update pagination
    document.getElementById('showing-count').textContent = data.count;
    document.getElementById('prev-page').disabled = currentPage === 0;
    document.getElementById('next-page').disabled = data.errors.length < currentFilters.limit;
  } catch (error) {
    console.error('Failed to load errors:', error);
    showError('Failed to load errors');
  }
}

/**
 * Load error trend data
 */
async function loadTrend() {
  try {
    const response = await fetch(`${API_BASE}?action=trend&hours=${currentFilters.hours}`);
    if (!response.ok) throw new Error('Failed to fetch trend');

    const data = await response.json();

    renderTrendChart(data.trend);
  } catch (error) {
    console.error('Failed to load trend:', error);
  }
}

/**
 * Check for alerts
 */
async function checkAlerts() {
  try {
    const response = await fetch(`${API_BASE}?action=critical`);
    if (!response.ok) throw new Error('Failed to fetch alerts');

    const data = await response.json();

    if (data.alerts && data.alerts.length > 0) {
      document.getElementById('active-alerts').textContent = data.alerts.length;
      renderAlerts(data.alerts);
      document.getElementById('alerts-section').classList.remove('hidden');
    } else {
      document.getElementById('active-alerts').textContent = '0';
      document.getElementById('alerts-section').classList.add('hidden');
    }
  } catch (error) {
    console.error('Failed to check alerts:', error);
  }
}

/**
 * Render errors table
 */
function renderErrorsTable(errors) {
  const tbody = document.getElementById('errors-table');
  tbody.innerHTML = ''; // Clear existing content

  if (!errors || errors.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'px-6 py-4 text-center text-gray-500';
    td.textContent = 'No errors found';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  errors.forEach(error => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';

    // Created at
    const tdCreatedAt = document.createElement('td');
    tdCreatedAt.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
    tdCreatedAt.textContent = formatDateTime(error.created_at);
    tr.appendChild(tdCreatedAt);

    // Error type
    const tdType = document.createElement('td');
    tdType.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
    tdType.textContent = error.error_type;
    tr.appendChild(tdType);

    // Error code
    const tdCode = document.createElement('td');
    tdCode.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
    tdCode.textContent = error.error_code;
    tr.appendChild(tdCode);

    // Message
    const tdMessage = document.createElement('td');
    tdMessage.className = 'px-6 py-4 text-sm text-gray-900 max-w-xs truncate';
    tdMessage.textContent = error.message;
    tr.appendChild(tdMessage);

    // Endpoint
    const tdEndpoint = document.createElement('td');
    tdEndpoint.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
    tdEndpoint.textContent = error.endpoint || '-';
    tr.appendChild(tdEndpoint);

    // Status
    const tdStatus = document.createElement('td');
    tdStatus.className = 'px-6 py-4 whitespace-nowrap';
    const statusSpan = document.createElement('span');
    statusSpan.className = `status-badge status-${error.status}`;
    statusSpan.textContent = error.status;
    tdStatus.appendChild(statusSpan);
    tr.appendChild(tdStatus);

    // Actions
    const tdActions = document.createElement('td');
    tdActions.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium';

    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View';
    viewBtn.className = 'text-blue-600 hover:text-blue-900 mr-3';
    viewBtn.onclick = () => viewError(error.id);
    tdActions.appendChild(viewBtn);

    if (error.status === 'active') {
      const resolveBtn = document.createElement('button');
      resolveBtn.textContent = 'Resolve';
      resolveBtn.className = 'text-green-600 hover:text-green-900 mr-3';
      resolveBtn.onclick = () => resolveError(error.id);
      tdActions.appendChild(resolveBtn);

      const ignoreBtn = document.createElement('button');
      ignoreBtn.textContent = 'Ignore';
      ignoreBtn.className = 'text-gray-600 hover:text-gray-900';
      ignoreBtn.onclick = () => ignoreError(error.id);
      tdActions.appendChild(ignoreBtn);
    }

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

/**
 * Render error type breakdown chart
 */
function renderErrorTypeChart(errorsByType) {
  const container = document.getElementById('error-type-chart');
  container.innerHTML = ''; // Clear container

  if (!errorsByType || Object.keys(errorsByType).length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'chart-placeholder';
    placeholder.textContent = 'No data available';
    container.appendChild(placeholder);
    return;
  }

  const colors = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16'
  ];

  const total = Object.values(errorsByType).reduce((sum, count) => sum + count, 0);

  const spaceDiv = document.createElement('div');
  spaceDiv.className = 'space-y-2';

  Object.entries(errorsByType)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count], index) => {
      const percentage = ((count / total) * 100).toFixed(1);
      const color = colors[index % colors.length];

      const flexDiv = document.createElement('div');
      flexDiv.className = 'flex items-center';

      const flexInnerDiv = document.createElement('div');
      flexInnerDiv.className = 'flex-1';

      const justifyDiv = document.createElement('div');
      justifyDiv.className = 'flex items-center justify-between mb-1';

      const typeSpan = document.createElement('span');
      typeSpan.className = 'text-sm font-medium text-gray-700';
      typeSpan.textContent = type;
      justifyDiv.appendChild(typeSpan);

      const countSpan = document.createElement('span');
      countSpan.className = 'text-sm text-gray-500';
      countSpan.textContent = `${count} (${percentage}%)`;
      justifyDiv.appendChild(countSpan);

      flexInnerDiv.appendChild(justifyDiv);

      const bgDiv = document.createElement('div');
      bgDiv.className = 'w-full bg-gray-200 rounded-full h-2';

      const fillDiv = document.createElement('div');
      fillDiv.className = 'h-2 rounded-full';
      fillDiv.style.width = `${percentage}%`;
      fillDiv.style.backgroundColor = color;

      bgDiv.appendChild(fillDiv);
      flexInnerDiv.appendChild(bgDiv);
      flexDiv.appendChild(flexInnerDiv);
      spaceDiv.appendChild(flexDiv);
    });

  container.appendChild(spaceDiv);
}

/**
 * Render trend chart
 */
function renderTrendChart(trend) {
  const container = document.getElementById('error-rate-chart');
  container.innerHTML = ''; // Clear container

  if (!trend || trend.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'chart-placeholder';
    placeholder.textContent = 'No data available';
    container.appendChild(placeholder);
    return;
  }

  const maxCount = Math.max(...trend.map(t => t.count));

  const spaceDiv = document.createElement('div');
  spaceDiv.className = 'space-y-2';

  trend.forEach(point => {
    const height = maxCount > 0 ? (point.count / maxCount) * 100 : 0;

    const flexDiv = document.createElement('div');
    flexDiv.className = 'flex items-center';

    const timeDiv = document.createElement('div');
    timeDiv.className = 'w-16 text-xs text-gray-500 mr-2';
    timeDiv.textContent = formatTime(point.timestamp);
    flexDiv.appendChild(timeDiv);

    const bgDiv = document.createElement('div');
    bgDiv.className = 'flex-1 bg-gray-200 rounded h-8 relative';

    const fillDiv = document.createElement('div');
    fillDiv.className = 'bg-blue-500 rounded h-8 absolute';
    fillDiv.style.width = `${height}%`;

    const countSpan = document.createElement('span');
    countSpan.className = 'absolute right-2 top-1 text-xs text-white font-medium';
    countSpan.textContent = point.count;
    fillDiv.appendChild(countSpan);

    bgDiv.appendChild(fillDiv);
    flexDiv.appendChild(bgDiv);
    spaceDiv.appendChild(flexDiv);
  });

  container.appendChild(spaceDiv);
}

/**
 * Render alerts
 */
function renderAlerts(alerts) {
  const container = document.getElementById('alerts-list');
  container.innerHTML = ''; // Clear container

  alerts.forEach(alert => {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'mb-2';

    const messageP = document.createElement('p');
    messageP.className = 'font-medium';
    messageP.textContent = alert.message;
    alertDiv.appendChild(messageP);

    const recUl = document.createElement('ul');
    recUl.className = 'list-disc list-inside mt-1 text-xs';

    alert.recommendations.forEach(rec => {
      const recLi = document.createElement('li');
      recLi.textContent = rec;
      recUl.appendChild(recLi);
    });

    alertDiv.appendChild(recUl);
    container.appendChild(alertDiv);
  });
}

/**
 * View error details
 */
async function viewError(errorId) {
  try {
    const response = await fetch(`${API_BASE}?action=recent&limit=1000`);
    if (!response.ok) throw new Error('Failed to fetch error');

    const data = await response.json();
    const error = data.errors.find(e => e.id === errorId);

    if (!error) {
      showError('Error not found');
      return;
    }

    const modal = document.getElementById('error-modal');
    const content = document.getElementById('modal-content');
    content.innerHTML = ''; // Clear existing content

    // Build modal content safely using DOM methods
    const spaceDiv = document.createElement('div');
    spaceDiv.className = 'space-y-4';

    // Helper to create field
    const createField = (label, value) => {
      const div = document.createElement('div');
      const labelEl = document.createElement('label');
      labelEl.className = 'block text-sm font-medium text-gray-700';
      labelEl.textContent = label;
      div.appendChild(labelEl);

      const p = document.createElement('p');
      p.className = 'mt-1 text-sm text-gray-900';
      p.textContent = value;
      div.appendChild(p);

      return div;
    };

    spaceDiv.appendChild(createField('Error ID', error.id));
    spaceDiv.appendChild(createField('Error Type', error.error_type));
    spaceDiv.appendChild(createField('Error Code', error.error_code));
    spaceDiv.appendChild(createField('Message', error.message));

    if (error.stack_trace) {
      const div = document.createElement('div');
      const labelEl = document.createElement('label');
      labelEl.className = 'block text-sm font-medium text-gray-700';
      labelEl.textContent = 'Stack Trace';
      div.appendChild(labelEl);

      const pre = document.createElement('pre');
      pre.className = 'mt-1 text-xs bg-gray-50 p-3 rounded overflow-x-auto';
      pre.textContent = error.stack_trace;
      div.appendChild(pre);

      spaceDiv.appendChild(div);
    }

    // Grid for metadata
    const gridDiv = document.createElement('div');
    gridDiv.className = 'grid grid-cols-2 gap-4';

    gridDiv.appendChild(createField('Request ID', error.request_id || '-'));
    gridDiv.appendChild(createField('User ID', error.user_id || '-'));
    gridDiv.appendChild(createField('Endpoint', error.endpoint || '-'));
    gridDiv.appendChild(createField('Method', error.method || '-'));
    gridDiv.appendChild(createField('IP Address', error.ip_address || '-'));
    gridDiv.appendChild(createField('Created At', formatDateTime(error.created_at)));

    spaceDiv.appendChild(gridDiv);

    // Action buttons or resolution info
    if (error.status === 'active') {
      const flexDiv = document.createElement('div');
      flexDiv.className = 'flex gap-2 pt-4';

      const resolveBtn = document.createElement('button');
      resolveBtn.textContent = 'Mark as Resolved';
      resolveBtn.className = 'bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700';
      resolveBtn.onclick = () => resolveError(error.id, true);
      flexDiv.appendChild(resolveBtn);

      const ignoreBtn = document.createElement('button');
      ignoreBtn.textContent = 'Ignore';
      ignoreBtn.className = 'bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-600';
      ignoreBtn.onclick = () => ignoreError(error.id, true);
      flexDiv.appendChild(ignoreBtn);

      spaceDiv.appendChild(flexDiv);
    } else {
      const div = document.createElement('div');
      const labelEl = document.createElement('label');
      labelEl.className = 'block text-sm font-medium text-gray-700';
      labelEl.textContent = 'Resolution';
      div.appendChild(labelEl);

      const p = document.createElement('p');
      p.className = 'mt-1 text-sm text-gray-900';
      p.textContent = `Resolved by ${error.resolved_by} at ${formatDateTime(error.resolved_at)}${error.resolution_note ? ` - ${error.resolution_note}` : ''}`;
      div.appendChild(p);

      spaceDiv.appendChild(div);
    }

    content.appendChild(spaceDiv);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } catch (error) {
    console.error('Failed to view error:', error);
    showError('Failed to load error details');
  }
}

/**
 * Resolve error
 */
async function resolveError(errorId, closeModal = false) {
  const note = prompt('Optional resolution note:');

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resolve',
        errorId,
        note: note || undefined,
      }),
    });

    if (!response.ok) throw new Error('Failed to resolve error');

    if (closeModal) {
      document.getElementById('error-modal').classList.add('hidden');
      document.getElementById('error-modal').classList.remove('flex');
    }

    await loadErrors();
    showSuccess('Error resolved successfully');
  } catch (error) {
    console.error('Failed to resolve error:', error);
    showError('Failed to resolve error');
  }
}

/**
 * Ignore error
 */
async function ignoreError(errorId, closeModal = false) {
  if (!confirm('Are you sure you want to ignore this error?')) return;

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ignore',
        errorId,
      }),
    });

    if (!response.ok) throw new Error('Failed to ignore error');

    if (closeModal) {
      document.getElementById('error-modal').classList.add('hidden');
      document.getElementById('error-modal').classList.remove('flex');
    }

    await loadErrors();
    showSuccess('Error ignored successfully');
  } catch (error) {
    console.error('Failed to ignore error:', error);
    showError('Failed to ignore error');
  }
}

/**
 * Export errors as CSV
 */
async function exportErrors() {
  try {
    const params = new URLSearchParams({ action: 'export' });

    if (currentFilters.errorType) params.append('errorType', currentFilters.errorType);
    if (currentFilters.status) params.append('status', currentFilters.status);
    if (currentFilters.hours) {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - currentFilters.hours * 60 * 60 * 1000).toISOString();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }

    window.location.href = `${API_BASE}?${params}`;
  } catch (error) {
    console.error('Failed to export errors:', error);
    showError('Failed to export errors');
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Apply filters
  document.getElementById('apply-filters').addEventListener('click', () => {
    currentFilters.errorType = document.getElementById('filter-error-type').value;
    currentFilters.status = document.getElementById('filter-status').value;
    currentFilters.hours = parseInt(document.getElementById('filter-hours').value);
    currentFilters.limit = parseInt(document.getElementById('filter-limit').value);
    currentPage = 0;

    loadDashboard();
  });

  // Pagination
  document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      loadErrors();
    }
  });

  document.getElementById('next-page').addEventListener('click', () => {
    currentPage++;
    loadErrors();
  });

  // Close modal
  document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('error-modal').classList.add('hidden');
    document.getElementById('error-modal').classList.remove('flex');
  });

  // Export
  document.getElementById('export-errors').addEventListener('click', exportErrors);

  // Close modal on outside click
  document.getElementById('error-modal').addEventListener('click', (e) => {
    if (e.target.id === 'error-modal') {
      document.getElementById('error-modal').classList.add('hidden');
      document.getElementById('error-modal').classList.remove('flex');
    }
  });
}

/**
 * Start auto-refresh
 */
function startAutoRefresh() {
  // Refresh every 30 seconds
  setInterval(() => {
    loadDashboard();
  }, 30000);
}

/**
 * Format date time
 */
function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

/**
 * Format time
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show error message
 */
function showError(message) {
  // Simple alert for now, could be improved with a toast notification
  alert(message);
}

/**
 * Show success message
 */
function showSuccess(message) {
  // Simple alert for now, could be improved with a toast notification
  alert(message);
}
