/**
 * LiteStats Pro - Frontend Application
 *
 * Handles chart and table rendering on the frontend via shortcodes.
 * Features: pagination, column filters, CSV export, print, responsive tables.
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
     */
    function formatValue(val, col) {
        if (col.type === 'string') {
            return escapeHtml(val);
        }

        // Date type
        if (col.type === 'date') {
            if (!val || val === '') return '';
            try {
                var d = new Date(val);
                if (!isNaN(d.getTime())) {
                    return d.toLocaleDateString();
                }
            } catch(e) { /* fall through */ }
            return escapeHtml(val);
        }

        var num = parseFloat(val);
        if (isNaN(num)) {
            return escapeHtml(val);
        }

        // Percentage display for formula columns
        if (col.type === 'formula' && col.props && col.props.isPercent) {
            num = num * 100;
        }

        // Currency
        if (col.type === 'currency') {
            var symbol = (col.props && col.props.currencySymbol) ? col.props.currencySymbol : ((col.props && col.props.prefix) ? col.props.prefix : '$');
            var cp = (col.props && col.props.precision) ? parseInt(col.props.precision, 10) : 2;
            return symbol + num.toLocaleString(undefined, { minimumFractionDigits: cp, maximumFractionDigits: cp });
        }

        // Percentage type
        if (col.type === 'percentage') {
            var pp = (col.props && col.props.precision) ? parseInt(col.props.precision, 10) : 1;
            var suffix = (col.props && col.props.suffix) ? col.props.suffix : '%';
            return num.toFixed(pp) + suffix;
        }

        var precision = (col.props && col.props.precision) ? col.props.precision : null;
        if (precision !== null) {
            num = num.toFixed(precision);
        } else if (col.type === 'formula' && num !== Math.floor(num)) {
            num = num.toFixed(2);
        }

        var prefix = (col.props && col.props.prefix) ? col.props.prefix : '';
        var suffixStr = (col.props && col.props.suffix) ? col.props.suffix : '';

        if (col.type === 'formula' && col.props && col.props.isPercent) {
            suffixStr = suffixStr + '%';
        }

        return prefix + num + suffixStr;
    }

    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Get data column indices based on chart settings.
     */
    function getDataColumnIndices(cols, settings) {
        var labelCol = settings.chartLabelCol || 0;

        if (settings.chartDataCols && settings.chartDataCols.length > 0) {
            return settings.chartDataCols;
        }

        var indices = [];
        for (var i = 0; i < cols.length; i++) {
            if (i === labelCol) continue;
            if (cols[i].type !== 'string' && cols[i].type !== 'date') {
                indices.push(i);
            }
        }
        return indices;
    }

    /**
     * Render a chart.
     */
    function renderChart(containerId, chartData) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var canvas = container.querySelector('.litestats-canvas');
        if (!canvas) return;

        var config = chartData.config || {};
        var settings = chartData.settings || {};
        var cols = config.cols || [];
        var rows = config.rows || [];

        var ctx = canvas.getContext('2d');
        var palette = themes[settings.theme] || themes['default'];
        var labelCol = settings.chartLabelCol || 0;

        // When grouping is active and label col is the group col, shift to next column
        if (typeof settings.groupByCol !== 'undefined' && settings.groupByCol >= 0 && labelCol === settings.groupByCol) {
            for (var li = 0; li < cols.length; li++) {
                if (li !== settings.groupByCol) { labelCol = li; break; }
            }
        }

        var dataCols = getDataColumnIndices(cols, settings);

        // Labels
        var labels = rows.map(function(r) { return r[labelCol]; });
        var datasets = [];
        var colorIdx = 0;

        for (var di = 0; di < dataCols.length; di++) {
            var colIdx = dataCols[di];
            var col = cols[colIdx];
            var type = settings.chartType || 'bar';

            if (type === 'combo') {
                type = (di === dataCols.length - 1) ? 'line' : 'bar';
            }

            if ((settings.chartType === 'pie' || settings.chartType === 'doughnut') && di > 0) {
                continue;
            }

            var seriesColor = (settings.seriesColors && settings.seriesColors[colIdx]) || palette[colorIdx % palette.length];

            datasets.push({
                type: type === 'combo' ? 'bar' : type,
                label: col.name,
                data: rows.map(function(r) {
                    var val = r[colIdx];
                    if (typeof val === 'string') {
                        val = val.replace(/[$,%]/g, '');
                    }
                    return parseFloat(val) || 0;
                }),
                backgroundColor: (settings.chartType === 'pie' || settings.chartType === 'doughnut') ? palette : seriesColor,
                borderColor: (settings.chartType === 'pie' || settings.chartType === 'doughnut') ? '#fff' : seriesColor,
                borderWidth: 2,
                fill: (type === 'line') ? (settings.fillArea || false) : false,
                tension: settings.lineTension || 0.4
            });
            colorIdx++;
        }

        if (typeof Chart === 'undefined') {
            console.error('Chart.js library not loaded.');
            return;
        }

        var isPie = settings.chartType === 'pie' || settings.chartType === 'doughnut';

        new Chart(ctx, {
            type: settings.chartType === 'combo' ? 'bar' : (settings.chartType || 'bar'),
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: isPie ? {} : {
                    x: {
                        stacked: settings.stacked || false,
                        title: {
                            display: !!settings.xAxisLabel,
                            text: settings.xAxisLabel || ''
                        }
                    },
                    y: {
                        stacked: settings.stacked || false,
                        beginAtZero: settings.beginAtZero !== false,
                        title: {
                            display: !!settings.yAxisLabel,
                            text: settings.yAxisLabel || ''
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: settings.legendPosition || 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                var label = context.label || '';
                                var value = context.raw;

                                if (context.chart.config.type === 'pie' || context.chart.config.type === 'doughnut') {
                                    var dataset = context.dataset;
                                    var meta = context.chart.getDatasetMeta(context.datasetIndex);
                                    var total = meta.total;
                                    if (!total) {
                                        total = dataset.data.reduce(function(acc, val) {
                                            return acc + (parseFloat(val) || 0);
                                        }, 0);
                                    }
                                    var percentage = parseFloat((value / total * 100).toFixed(1));
                                    return value + ' (' + percentage + '%)';
                                }

                                return label + ': ' + value;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render a table with pagination, filters, export, and responsive support.
     */
    function renderTable(containerId, chartData) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var tableWrapper = container.querySelector('.litestats-table-wrapper');
        if (!tableWrapper) return;

        var config = chartData.config || {};
        var settings = chartData.settings || {};
        var cols = config.cols || [];
        var allRows = config.rows || [];
        var condRules = settings.conditionalRules || [];

        var table = tableWrapper.querySelector('.litestats-table');
        var thead = table.querySelector('thead');
        var tbody = table.querySelector('tbody');
        var paginationEl = tableWrapper.querySelector('.litestats-pagination');

        // State
        var currentPage = 1;
        var rowsPerPage = settings.tableRowsPerPage || 25;
        var sortCol = -1;
        var sortAsc = true;
        var searchTerm = '';
        var columnFilters = {};
        var filteredRows = allRows.slice();

        // Render headers
        function renderHeaders() {
            var hHtml = '<tr>';
            cols.forEach(function(col, i) {
                hHtml += '<th data-sort-idx="' + i + '">' + escapeHtml(col.name) + ' <span class="sort-icon">\u2195</span></th>';
            });
            thead.innerHTML = hHtml + '</tr>';

            thead.querySelectorAll('th').forEach(function(th) {
                th.addEventListener('click', function() {
                    var idx = parseInt(this.dataset.sortIdx, 10);
                    if (sortCol === idx) {
                        sortAsc = !sortAsc;
                    } else {
                        sortCol = idx;
                        sortAsc = true;
                    }
                    applySort();
                    renderBody();
                    renderPagination();
                });
            });
        }

        // Column filters
        function renderColumnFilters() {
            var filtersEl = tableWrapper.querySelector('.litestats-column-filters');
            if (!filtersEl || !settings.tableColumnFilters) return;

            var html = '<div class="litestats-filter-row">';
            cols.forEach(function(col, i) {
                if (col.type === 'number' || col.type === 'currency' || col.type === 'percentage') {
                    html += '<div class="litestats-filter-cell">' +
                        '<input type="number" class="litestats-filter-min" data-col="' + i + '" placeholder="Min">' +
                        '<input type="number" class="litestats-filter-max" data-col="' + i + '" placeholder="Max">' +
                    '</div>';
                } else if (col.type === 'date') {
                    html += '<div class="litestats-filter-cell">' +
                        '<input type="date" class="litestats-filter-date-from" data-col="' + i + '">' +
                        '<input type="date" class="litestats-filter-date-to" data-col="' + i + '">' +
                    '</div>';
                } else {
                    html += '<div class="litestats-filter-cell">' +
                        '<input type="text" class="litestats-filter-text" data-col="' + i + '" placeholder="Filter...">' +
                    '</div>';
                }
            });
            html += '</div>';
            filtersEl.innerHTML = html;

            // Bind filter events
            filtersEl.querySelectorAll('input').forEach(function(input) {
                input.addEventListener('input', function() {
                    applyFilters();
                    currentPage = 1;
                    renderBody();
                    renderPagination();
                });
            });
        }

        // Apply search + column filters
        function applyFilters() {
            filteredRows = allRows.filter(function(row) {
                // Global search
                if (searchTerm) {
                    var match = false;
                    for (var i = 0; i < row.length; i++) {
                        if (String(row[i]).toLowerCase().indexOf(searchTerm) !== -1) {
                            match = true;
                            break;
                        }
                    }
                    if (!match) return false;
                }

                // Column filters
                if (settings.tableColumnFilters) {
                    var filtersEl = tableWrapper.querySelector('.litestats-column-filters');
                    if (filtersEl) {
                        // Text filters
                        var textFilters = filtersEl.querySelectorAll('.litestats-filter-text');
                        for (var t = 0; t < textFilters.length; t++) {
                            var tf = textFilters[t];
                            if (tf.value) {
                                var ci = parseInt(tf.dataset.col, 10);
                                if (String(row[ci]).toLowerCase().indexOf(tf.value.toLowerCase()) === -1) return false;
                            }
                        }
                        // Min/Max filters
                        var minFilters = filtersEl.querySelectorAll('.litestats-filter-min');
                        for (var m = 0; m < minFilters.length; m++) {
                            if (minFilters[m].value !== '') {
                                var mci = parseInt(minFilters[m].dataset.col, 10);
                                if (parseFloat(row[mci]) < parseFloat(minFilters[m].value)) return false;
                            }
                        }
                        var maxFilters = filtersEl.querySelectorAll('.litestats-filter-max');
                        for (var mx = 0; mx < maxFilters.length; mx++) {
                            if (maxFilters[mx].value !== '') {
                                var mxci = parseInt(maxFilters[mx].dataset.col, 10);
                                if (parseFloat(row[mxci]) > parseFloat(maxFilters[mx].value)) return false;
                            }
                        }
                        // Date filters
                        var dateFroms = filtersEl.querySelectorAll('.litestats-filter-date-from');
                        for (var df = 0; df < dateFroms.length; df++) {
                            if (dateFroms[df].value) {
                                var dci = parseInt(dateFroms[df].dataset.col, 10);
                                if (new Date(row[dci]) < new Date(dateFroms[df].value)) return false;
                            }
                        }
                        var dateTos = filtersEl.querySelectorAll('.litestats-filter-date-to');
                        for (var dt = 0; dt < dateTos.length; dt++) {
                            if (dateTos[dt].value) {
                                var dtci = parseInt(dateTos[dt].dataset.col, 10);
                                if (new Date(row[dtci]) > new Date(dateTos[dt].value)) return false;
                            }
                        }
                    }
                }

                return true;
            });
        }

        // Sort
        function applySort() {
            if (sortCol < 0) return;
            filteredRows.sort(function(a, b) {
                var v1 = a[sortCol], v2 = b[sortCol];
                var col = cols[sortCol];
                var result;
                if (col.type === 'number' || col.type === 'currency' || col.type === 'percentage') {
                    result = parseFloat(v1) - parseFloat(v2);
                } else if (col.type === 'date') {
                    result = new Date(v1) - new Date(v2);
                } else {
                    result = String(v1).localeCompare(String(v2));
                }
                return sortAsc ? result : -result;
            });
        }

        // Render body with pagination
        function renderBody() {
            var totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;

            var start = (currentPage - 1) * rowsPerPage;
            var pageRows = filteredRows.slice(start, start + rowsPerPage);

            var bHtml = '';
            pageRows.forEach(function(row) {
                bHtml += '<tr>';
                row.forEach(function(cell, i) {
                    var formatted = formatValue(cell, cols[i]);
                    var cellStyle = getCellStyle(cell, i, condRules);
                    bHtml += '<td' + (cellStyle ? ' style="' + cellStyle + '"' : '') + '>' + formatted + '</td>';
                });
                bHtml += '</tr>';
            });
            tbody.innerHTML = bHtml;
        }

        // Conditional formatting
        function getCellStyle(value, colIdx, rules) {
            if (!rules || !rules.length) return '';
            var styles = {};
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                if (parseInt(rule.colIdx, 10) !== colIdx) continue;
                if (matchesRule(value, rule)) {
                    if (rule.style) {
                        if (rule.style.bg) styles['background-color'] = rule.style.bg;
                        if (rule.style.color) styles['color'] = rule.style.color;
                        if (rule.style.bold) styles['font-weight'] = 'bold';
                    }
                }
            }
            var parts = [];
            for (var key in styles) {
                if (styles.hasOwnProperty(key)) parts.push(key + ':' + styles[key]);
            }
            return parts.join(';');
        }

        function matchesRule(value, rule) {
            var op = rule.operator;
            var rv = rule.value;
            if (op === 'contains') return String(value).toLowerCase().indexOf(String(rv).toLowerCase()) !== -1;
            if (op === 'empty') return value === '' || value === null || value === undefined;
            if (op === 'not_empty') return value !== '' && value !== null && value !== undefined;
            var nv = parseFloat(value), nr = parseFloat(rv);
            if (isNaN(nv) || isNaN(nr)) {
                if (op === '==') return String(value) === String(rv);
                if (op === '!=') return String(value) !== String(rv);
                return false;
            }
            switch (op) {
                case '>': return nv > nr;
                case '<': return nv < nr;
                case '>=': return nv >= nr;
                case '<=': return nv <= nr;
                case '==': return nv === nr;
                case '!=': return nv !== nr;
                case 'between':
                    var nr2 = parseFloat(rule.value2);
                    return !isNaN(nr2) && nv >= nr && nv <= nr2;
                default: return false;
            }
        }

        // Pagination
        function renderPagination() {
            if (!paginationEl) return;
            var totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;

            if (totalPages <= 1) {
                paginationEl.innerHTML = '';
                return;
            }

            var html = '<div class="litestats-page-info">' +
                'Page ' + currentPage + ' of ' + totalPages +
                ' (' + filteredRows.length + ' rows)' +
            '</div>';
            html += '<div class="litestats-page-btns">';
            html += '<button class="litestats-btn litestats-page-prev"' + (currentPage <= 1 ? ' disabled' : '') + '>&laquo; Prev</button>';

            // Page numbers (max 7)
            var startPage = Math.max(1, currentPage - 3);
            var endPage = Math.min(totalPages, startPage + 6);
            if (endPage - startPage < 6) startPage = Math.max(1, endPage - 6);

            for (var p = startPage; p <= endPage; p++) {
                html += '<button class="litestats-btn litestats-page-num' + (p === currentPage ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
            }

            html += '<button class="litestats-btn litestats-page-next"' + (currentPage >= totalPages ? ' disabled' : '') + '>Next &raquo;</button>';
            html += '</div>';

            paginationEl.innerHTML = html;

            // Bind
            paginationEl.querySelector('.litestats-page-prev').addEventListener('click', function() {
                if (currentPage > 1) { currentPage--; renderBody(); renderPagination(); }
            });
            paginationEl.querySelector('.litestats-page-next').addEventListener('click', function() {
                if (currentPage < totalPages) { currentPage++; renderBody(); renderPagination(); }
            });
            paginationEl.querySelectorAll('.litestats-page-num').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    currentPage = parseInt(this.dataset.page, 10);
                    renderBody();
                    renderPagination();
                });
            });
        }

        // Search
        function bindSearch() {
            var searchInput = tableWrapper.querySelector('.litestats-search');
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    searchTerm = this.value.toLowerCase();
                    applyFilters();
                    applySort();
                    currentPage = 1;
                    renderBody();
                    renderPagination();
                });
            }
        }

        // Export CSV
        function bindExport() {
            var exportBtn = tableWrapper.querySelector('.litestats-export-csv');
            if (exportBtn) {
                exportBtn.addEventListener('click', function() {
                    var csv = '';
                    // Header
                    csv += cols.map(function(c) { return '"' + c.name.replace(/"/g, '""') + '"'; }).join(',') + '\n';
                    // Rows (filtered)
                    filteredRows.forEach(function(row) {
                        csv += row.map(function(cell) {
                            return '"' + String(cell).replace(/"/g, '""') + '"';
                        }).join(',') + '\n';
                    });

                    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    var url = URL.createObjectURL(blob);
                    var link = document.createElement('a');
                    link.href = url;
                    link.download = 'litestats-export.csv';
                    link.click();
                    URL.revokeObjectURL(url);
                });
            }

            var printBtn = tableWrapper.querySelector('.litestats-print');
            if (printBtn) {
                printBtn.addEventListener('click', function() {
                    var printWin = window.open('', '_blank');
                    var html = '<html><head><title>Print</title><style>' +
                        'table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}' +
                        'th{background:#f8f9fa;font-weight:600}tr:nth-child(even){background:#f9f9f9}' +
                        '</style></head><body>';
                    html += table.outerHTML;
                    html += '</body></html>';
                    printWin.document.write(html);
                    printWin.document.close();
                    printWin.print();
                });
            }
        }

        // Init
        renderHeaders();
        renderColumnFilters();
        applyFilters();
        applySort();
        renderBody();
        renderPagination();
        bindSearch();
        bindExport();
    }

    /**
     * Initialize group sidebar for a container.
     * Extracts unique values from groupByCol, renders sidebar items,
     * and filters data on click before re-rendering chart/table.
     */
    function initGroupSidebar(containerId, chartData) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var settings = chartData.settings || {};
        var config = chartData.config || {};
        var groupCol = settings.groupByCol;

        if (typeof groupCol === 'undefined' || groupCol < 0) return;

        var rows = config.rows || [];
        var sidebar = container.querySelector('.litestats-group-sidebar');
        if (!sidebar) return;

        var list = sidebar.querySelector('.litestats-group-list');
        if (!list) return;

        // Extract unique group values preserving order
        var seen = {};
        var groups = [];
        rows.forEach(function(row) {
            var val = String(row[groupCol] || '');
            if (!seen[val]) {
                seen[val] = true;
                groups.push(val);
            }
        });

        // Build sidebar list
        var strings = (typeof liteStatsProFrontend !== 'undefined' && liteStatsProFrontend.strings) ? liteStatsProFrontend.strings : {};
        var allLabel = strings.all || 'All';
        var html = '<li class="litestats-group-item active" data-group="__all__">' + escapeHtml(allLabel) + ' <span class="litestats-group-count">' + rows.length + '</span></li>';
        groups.forEach(function(g) {
            var count = rows.filter(function(r) { return String(r[groupCol] || '') === g; }).length;
            html += '<li class="litestats-group-item" data-group="' + escapeHtml(g) + '">' + escapeHtml(g) + ' <span class="litestats-group-count">' + count + '</span></li>';
        });
        list.innerHTML = html;

        // Click handler
        list.querySelectorAll('.litestats-group-item').forEach(function(li) {
            li.addEventListener('click', function() {
                // Update active state
                list.querySelectorAll('.litestats-group-item').forEach(function(el) { el.classList.remove('active'); });
                this.classList.add('active');

                var group = this.dataset.group;
                var filteredRows;
                if (group === '__all__') {
                    filteredRows = rows;
                } else {
                    filteredRows = rows.filter(function(r) { return String(r[groupCol] || '') === group; });
                }

                // Create filtered chart data
                var filteredData = {
                    id: chartData.id,
                    config: { cols: config.cols, rows: filteredRows },
                    settings: settings
                };

                // Clear and re-render content area
                var contentArea = container.querySelector('.litestats-content-area');
                if (!contentArea) return;

                if (settings.view === 'table') {
                    // Reset table content
                    var tw = contentArea.querySelector('.litestats-table-wrapper');
                    if (tw) {
                        var thead = tw.querySelector('thead');
                        var tbody = tw.querySelector('tbody');
                        var pagination = tw.querySelector('.litestats-pagination');
                        if (thead) thead.innerHTML = '';
                        if (tbody) tbody.innerHTML = '';
                        if (pagination) pagination.innerHTML = '';
                    }
                    renderTable(containerId, filteredData);
                } else {
                    // Destroy existing chart canvas and create new one
                    var oldCanvas = contentArea.querySelector('.litestats-canvas');
                    if (oldCanvas) {
                        // Get existing Chart instance and destroy it
                        var existingChart = Chart.getChart(oldCanvas);
                        if (existingChart) existingChart.destroy();
                        var newCanvas = document.createElement('canvas');
                        newCanvas.className = 'litestats-canvas';
                        oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
                    }
                    renderChart(containerId, filteredData);
                }
            });
        });
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

            // Initialize group sidebar if groupByCol is set
            initGroupSidebar(containerId, chartData);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCharts);
    } else {
        initCharts();
    }

})(window, document);
