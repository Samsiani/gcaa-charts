/**
 * LiteStats Pro - Frontend Application
 *
 * Handles chart rendering on the frontend via shortcodes.
 *
 * @package LiteStats\Pro
 * @since   5.0.0
 */

/* global liteStatsProFrontend, liteStatsFrontendCharts, Chart */

(function(window, document) {
    'use strict';

    /**
     * Color themes for charts.
     */
    var themes = {
        'default': ['#2271b1', '#46b450', '#d63638', '#f1c40f', '#9b59b6'],
        'modern': ['#3f51b5', '#00bcd4', '#009688', '#ffc107', '#ff5722'],
        'pastel': ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea'],
        'dark': ['#333333', '#555555', '#777777', '#999999', '#bbbbbb']
    };

    /**
     * Format a value based on column properties.
     *
     * @param {*} val - The value to format.
     * @param {Object} col - The column configuration.
     * @returns {string} Formatted value.
     */
    function formatValue(val, col) {
        if (col.type === 'string') {
            return val;
        }

        var num = parseFloat(val);
        if (isNaN(num)) {
            return val;
        }

        if (col.props && col.props.precision) {
            num = num.toFixed(col.props.precision);
        }

        var prefix = (col.props && col.props.prefix) ? col.props.prefix : '';
        var suffix = (col.props && col.props.suffix) ? col.props.suffix : '';

        return prefix + num + suffix;
    }

    /**
     * Render a chart.
     *
     * @param {string} containerId - The container element ID.
     * @param {Object} chartData - The chart data.
     */
    function renderChart(containerId, chartData) {
        var container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        var canvas = container.querySelector('.litestats-canvas');
        if (!canvas) {
            return;
        }

        var config = chartData.config || {};
        var settings = chartData.settings || {};
        var cols = config.cols || [];
        var rows = config.rows || [];

        var ctx = canvas.getContext('2d');
        var palette = themes[settings.theme] || themes['default'];

        // Data Prep
        var labels = rows.map(function(r) { return r[0]; });
        var datasets = [];
        var colorIdx = 0;

        for (var i = 1; i < cols.length; i++) {
            var col = cols[i];
            var type = settings.chartType || 'bar';

            if (type === 'combo') {
                type = (i === cols.length - 1) ? 'line' : 'bar';
            }

            if (settings.chartType === 'pie' && i > 1) {
                continue;
            }

            datasets.push({
                type: type === 'combo' ? 'bar' : type,
                label: col.name,
                data: rows.map(function(r) {
                    var val = r[i];
                    if (typeof val === 'string') {
                        val = val.replace(/[$,%]/g, '');
                    }
                    return parseFloat(val) || 0;
                }),
                backgroundColor: settings.chartType === 'pie' ? palette : palette[colorIdx % palette.length],
                borderColor: settings.chartType === 'pie' ? '#fff' : palette[colorIdx % palette.length],
                borderWidth: 2,
                fill: type === 'line' && !settings.stacked,
                tension: 0.4
            });
            colorIdx++;
        }

        // SAFETY CHECK: Ensure Chart library is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js library not loaded. Skipping chart render.');
            // Optionally display a warning in the UI
            if (ctx) {
                ctx.font = '14px Arial';
                ctx.fillStyle = 'red';
                ctx.fillText('Chart library missing', 10, 50);
            }
            return;
        }

        // Create chart
        new Chart(ctx, {
            type: settings.chartType === 'combo' ? 'bar' : (settings.chartType || 'bar'),
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: settings.chartType === 'pie' ? {} : {
                    x: { stacked: settings.stacked || false },
                    y: { stacked: settings.stacked || false, beginAtZero: true }
                }
            }
        });
    }

    /**
     * Render a table.
     *
     * @param {string} containerId - The container element ID.
     * @param {Object} chartData - The chart data.
     */
    function renderTable(containerId, chartData) {
        var container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        var tableWrapper = container.querySelector('.litestats-table-wrapper');
        if (!tableWrapper) {
            return;
        }

        var config = chartData.config || {};
        var cols = config.cols || [];
        var rows = config.rows || [];

        var table = tableWrapper.querySelector('.litestats-table');
        var thead = table.querySelector('thead');
        var tbody = table.querySelector('tbody');

        // Render headers
        var hHtml = '<tr>';
        cols.forEach(function(col, i) {
            hHtml += '<th data-sort-idx="' + i + '">' + col.name + ' <span class="sort-icon">↕</span></th>';
        });
        thead.innerHTML = hHtml + '</tr>';

        // Render rows
        var bHtml = '';
        rows.forEach(function(row) {
            bHtml += '<tr>';
            row.forEach(function(cell, i) {
                var formatted = formatValue(cell, cols[i]);
                bHtml += '<td>' + formatted + '</td>';
            });
            bHtml += '</tr>';
        });
        tbody.innerHTML = bHtml;

        // Sort functionality
        thead.querySelectorAll('th').forEach(function(th) {
            th.addEventListener('click', function() {
                var idx = parseInt(this.dataset.sortIdx, 10);
                sortTable(tbody, rows, cols, idx);
            });
        });

        // Search functionality
        var searchInput = tableWrapper.querySelector('.litestats-search');
        if (searchInput) {
            searchInput.addEventListener('keyup', function() {
                var term = this.value.toLowerCase();
                var tbodyRows = tbody.querySelectorAll('tr');
                tbodyRows.forEach(function(row) {
                    var text = row.textContent.toLowerCase();
                    row.style.display = text.indexOf(term) !== -1 ? '' : 'none';
                });
            });
        }
    }

    /**
     * Sort table rows.
     *
     * @param {HTMLElement} tbody - The table body element.
     * @param {Array} rows - The data rows.
     * @param {Array} cols - The columns configuration.
     * @param {number} colIdx - The column index to sort by.
     */
    function sortTable(tbody, rows, cols, colIdx) {
        rows.sort(function(a, b) {
            var v1 = a[colIdx];
            var v2 = b[colIdx];
            if (cols[colIdx].type === 'number') {
                return parseFloat(v1) - parseFloat(v2);
            }
            return v1.toString().localeCompare(v2);
        });

        // Re-render tbody
        var bHtml = '';
        rows.forEach(function(row) {
            bHtml += '<tr>';
            row.forEach(function(cell, i) {
                var formatted = formatValue(cell, cols[i]);
                bHtml += '<td>' + formatted + '</td>';
            });
            bHtml += '</tr>';
        });
        tbody.innerHTML = bHtml;
    }

    /**
     * Initialize all charts on the page.
     */
    function initCharts() {
        if (typeof liteStatsFrontendCharts === 'undefined') {
            return;
        }

        Object.keys(liteStatsFrontendCharts).forEach(function(containerId) {
            var chartData = liteStatsFrontendCharts[containerId];

            if (chartData.settings && chartData.settings.view === 'table') {
                renderTable(containerId, chartData);
            } else {
                renderChart(containerId, chartData);
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCharts);
    } else {
        initCharts();
    }

})(window, document);
