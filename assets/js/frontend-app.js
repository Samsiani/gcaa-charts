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
     * True when the column TYPE explicitly asks for numeric formatting.
     *
     * Deliberately does not consider props.precision: the admin precision
     * <select> has no "none" option and pre-selects 0, so a precision gets
     * attached to columns whose author never asked for number formatting —
     * and that would silently switch the identifier guard below back off.
     */
    function hasExplicitFormat(col) {
        return col.type === 'currency' || col.type === 'percentage' || col.type === 'formula';
    }

    /**
     * Column precision as a number, or null when none is set.
     *
     * A precision of "0" is a real choice (no decimals); the old truthiness
     * checks treated it as unset.
     */
    function columnPrecision(col) {
        var p = col.props ? col.props.precision : null;
        if (p === undefined || p === null || p === '') return null;
        p = parseInt(p, 10);
        return isNaN(p) ? null : p;
    }

    /**
     * Format a value based on column properties.
     *
     * Identifier-style text is rendered exactly as authored. A value is only
     * treated as a number when the WHOLE string parses to a finite number and
     * that number round-trips back to the same text, so "000001" stays "000001"
     * (parseFloat would have made it 1) and "4D" stays "4D" (parseFloat: 4).
     */
    function formatValue(val, col) {
        col = col || {};

        var raw = (val === null || val === undefined) ? '' : String(val);

        if (col.type === 'string') {
            return escapeHtml(raw);
        }

        // Date type
        if (col.type === 'date') {
            // Test the original value: a stored 0 or false is "no date", not 1 Jan 2000.
            if (!val) return '';
            try {
                var d = new Date(raw);
                if (!isNaN(d.getTime())) {
                    return escapeHtml(d.toLocaleDateString());
                }
            } catch(e) { /* fall through */ }
            return escapeHtml(raw);
        }

        var trimmed = raw.trim();
        if (trimmed === '') return '';

        var num = Number(trimmed);

        // Not a clean, finite number ("1,234", "12abc", "4D", "28.02.2008\u10EC").
        if (!isFinite(num)) {
            return escapeHtml(raw);
        }

        var prefix = (col.props && col.props.prefix) ? col.props.prefix : '';
        var suffixStr = (col.props && col.props.suffix) ? col.props.suffix : '';

        // Text a number cannot round-trip: "000001", "007", "+5", "1e3", "01.50".
        if (String(num) !== trimmed && !hasExplicitFormat(col)) {
            return escapeHtml(prefix + raw + suffixStr);
        }

        // Percentage display for formula columns
        if (col.type === 'formula' && col.props && col.props.isPercent) {
            num = num * 100;
        }

        // Currency
        if (col.type === 'currency') {
            var symbol = (col.props && col.props.currencySymbol) ? col.props.currencySymbol : (prefix || '$');
            var cp = columnPrecision(col);
            if (cp === null) cp = 2;
            return escapeHtml(symbol + num.toLocaleString(undefined, { minimumFractionDigits: cp, maximumFractionDigits: cp }));
        }

        // Percentage type
        if (col.type === 'percentage') {
            var pp = columnPrecision(col);
            if (pp === null) pp = 1;
            var pSuffix = suffixStr || '%';
            return escapeHtml(num.toFixed(pp) + pSuffix);
        }

        var precision = columnPrecision(col);
        var out;
        if (precision !== null) {
            out = num.toFixed(precision);
        } else if (col.type === 'formula' && num !== Math.floor(num)) {
            out = num.toFixed(2);
        } else {
            out = String(num);
        }

        if (col.type === 'formula' && col.props && col.props.isPercent) {
            suffixStr = suffixStr + '%';
        }

        return escapeHtml(prefix + out + suffixStr);
    }

    /**
     * Escape for use in HTML text *and* in a double-quoted attribute.
     *
     * The old div.textContent round trip left quotes intact, so a value
     * containing " broke out of the attributes it is written into
     * (data-group="..." in the group sidebar, for one).
     */
    /**
     * Localized UI string with a fallback.
     */
    function strings(key, fallback) {
        if (typeof liteStatsProFrontend !== 'undefined' &&
            liteStatsProFrontend.strings &&
            liteStatsProFrontend.strings[key]) {
            return liteStatsProFrontend.strings[key];
        }
        return fallback;
    }

    function escapeHtml(str) {
        return String(str === null || str === undefined ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
        var groupCol = (typeof settings.groupByCol !== 'undefined') ? settings.groupByCol : -1;
        var isGroupFiltered = !!chartData._groupFiltered;

        // When a specific group is selected and label col is the group col, shift labels
        if (isGroupFiltered && groupCol >= 0 && labelCol === groupCol) {
            for (var li = 0; li < cols.length; li++) {
                if (li !== groupCol) { labelCol = li; break; }
            }
        }

        // When showing "All" and labelCol === groupByCol, aggregate rows by group
        var needsAggregation = !isGroupFiltered && groupCol >= 0 && labelCol === groupCol;
        var chartRows = rows;
        if (needsAggregation) {
            var groupMap = {};
            var groupOrder = [];
            rows.forEach(function(row) {
                var key = String(row[labelCol] || '');
                if (!groupMap[key]) {
                    groupMap[key] = [];
                    groupOrder.push(key);
                }
                groupMap[key].push(row);
            });
            // Sum numeric values per group
            chartRows = groupOrder.map(function(key) {
                var groupRows = groupMap[key];
                var aggregated = cols.map(function(col, ci) {
                    if (ci === labelCol) return key;
                    if (col.type === 'string' || col.type === 'date') return groupRows[0][ci];
                    var sum = 0;
                    groupRows.forEach(function(r) {
                        var v = r[ci];
                        if (typeof v === 'string') v = v.replace(/[$,%]/g, '');
                        sum += parseFloat(v) || 0;
                    });
                    return sum;
                });
                return aggregated;
            });
        }

        var dataCols = getDataColumnIndices(cols, settings);

        // Labels
        var labels = chartRows.map(function(r) { return r[labelCol]; });
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
                data: chartRows.map(function(r) {
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

        // Apply pie max width constraint
        if (isPie && settings.pieMaxWidth && settings.pieMaxWidth > 0) {
            var contentArea = container.querySelector('.litestats-content-area') || container;
            contentArea.style.maxWidth = settings.pieMaxWidth + 'px';
            contentArea.style.margin = '0 auto';
        }

        try {
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
                            display: settings.showLegend !== false,
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'rectRounded',
                                padding: 16,
                                font: { size: 12 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                title: function(items) {
                                    if (!items || !items.length) return '';
                                    var c = items[0];
                                    var t = c.chart.config.type;
                                    if (t === 'pie' || t === 'doughnut') {
                                        return c.label || '';
                                    }
                                    return c.label || '';
                                },
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
        } catch (e) {
            console.error('LiteStats: Chart render failed', e);
            canvas.parentNode.innerHTML = '<div style="padding:20px;color:#dc2626;text-align:center;">Chart rendering error</div>';
        }

    }

    /**
     * Put the table in its own horizontal scroll box and keep the scroll hints in sync.
     *
     * The shortcode emits this markup, but a page served from a full-page cache
     * (LiteSpeed, Cloudflare) can still be older HTML in which the table is a direct
     * child of the wrapper — so build the boxes here when they are missing, rather
     * than letting the table spill outside the card again.
     *
     * @param {Element} tableWrapper The .litestats-table-wrapper element.
     * @return {Function} Callback that refreshes the scroll-hint classes.
     */
    function setupTableScroll(tableWrapper) {
        var noop = function() {};
        var table = tableWrapper.querySelector('.litestats-table');
        if (!table) return noop;

        var scroll = tableWrapper.querySelector('.litestats-table-scroll');
        var viewport = tableWrapper.querySelector('.litestats-table-viewport');

        if (!scroll) {
            viewport = document.createElement('div');
            viewport.className = 'litestats-table-viewport';

            scroll = document.createElement('div');
            scroll.className = 'litestats-table-scroll';
            scroll.setAttribute('tabindex', '0');
            scroll.setAttribute('role', 'region');
            // role="region" needs an accessible name, same as the PHP-emitted box.
            scroll.setAttribute('aria-label', strings('tableData', 'Table data'));

            table.parentNode.insertBefore(viewport, table);
            viewport.appendChild(scroll);
            scroll.appendChild(table);
        }

        if (!viewport) {
            viewport = scroll.parentNode;
        }
        if (!viewport) return noop;

        var update = function() {
            var max = scroll.scrollWidth - scroll.clientWidth;
            viewport.classList.toggle('litestats-more-left', scroll.scrollLeft > 1);
            viewport.classList.toggle('litestats-more-right', max > 1 && scroll.scrollLeft < max - 1);
        };

        scroll.addEventListener('scroll', update, { passive: true });

        if (window.ResizeObserver) {
            var ro = new ResizeObserver(update);
            ro.observe(scroll);
            ro.observe(table);
        } else {
            window.addEventListener('resize', update);
        }

        return update;
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
        if (!table) return;

        var syncScroll = setupTableScroll(tableWrapper);

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

        // Apply search filter
        function applyFilters() {
            filteredRows = allRows.filter(function(row) {
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
                return true;
            });
        }

        /**
         * Total ordering for one column.
         *
         * Values that do not parse (a stray "N/A" in a number column, an unparsable
         * date) used to make the comparator return NaN, which leaves the sort order
         * implementation-defined. They now sort after everything that does parse.
         */
        function compareBy(col, v1, v2) {
            if (col.type === 'number' || col.type === 'currency' || col.type === 'percentage') {
                var n1 = parseFloat(v1);
                var n2 = parseFloat(v2);
                var ok1 = !isNaN(n1);
                var ok2 = !isNaN(n2);
                if (ok1 && ok2) return n1 - n2;
                if (ok1) return -1;
                if (ok2) return 1;
            } else if (col.type === 'date') {
                var t1 = new Date(v1).getTime();
                var t2 = new Date(v2).getTime();
                var d1 = !isNaN(t1);
                var d2 = !isNaN(t2);
                if (d1 && d2) return t1 - t2;
                if (d1) return -1;
                if (d2) return 1;
            }
            return String(v1 === null || v1 === undefined ? '' : v1)
                .localeCompare(String(v2 === null || v2 === undefined ? '' : v2));
        }

        // Sort
        function applySort() {
            if (sortCol < 0) return;
            var col = cols[sortCol];
            if (!col) return;
            filteredRows.sort(function(a, b) {
                var result = compareBy(col, a[sortCol], b[sortCol]);
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

            // Column widths change with the visible rows, so re-measure.
            syncScroll();
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

            var strings = (typeof liteStatsProFrontend !== 'undefined' && liteStatsProFrontend.strings) ? liteStatsProFrontend.strings : {};
            var start = (currentPage - 1) * rowsPerPage + 1;
            var end = Math.min(currentPage * rowsPerPage, filteredRows.length);
            var html = '<div class="litestats-page-info">' +
                '<strong>' + start + '\u2013' + end + '</strong> ' + (strings.of || 'of') + ' ' + filteredRows.length +
            '</div>';
            html += '<div class="litestats-page-btns">';
            html += '<button class="litestats-btn litestats-page-prev"' + (currentPage <= 1 ? ' disabled' : '') + '>\u2039 ' + (strings.prev || 'Prev') + '</button>';

            // Page numbers (max 7)
            var startPage = Math.max(1, currentPage - 3);
            var endPage = Math.min(totalPages, startPage + 6);
            if (endPage - startPage < 6) startPage = Math.max(1, endPage - 6);

            for (var p = startPage; p <= endPage; p++) {
                html += '<button class="litestats-btn litestats-page-num' + (p === currentPage ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
            }

            html += '<button class="litestats-btn litestats-page-next"' + (currentPage >= totalPages ? ' disabled' : '') + '>' + (strings.next || 'Next') + ' \u203a</button>';
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
            var wrapper = tableWrapper.querySelector('.litestats-search-wrapper');
            var searchInput = tableWrapper.querySelector('.litestats-search');
            var clearBtn = tableWrapper.querySelector('.litestats-search-clear');

            if (searchInput) {
                var doSearch = function() {
                    searchTerm = searchInput.value.toLowerCase();
                    if (wrapper) wrapper.classList.toggle('has-value', searchInput.value.length > 0);
                    applyFilters();
                    applySort();
                    currentPage = 1;
                    renderBody();
                    renderPagination();
                };

                var searchTimer = null;
                searchInput.addEventListener('input', function() {
                    clearTimeout(searchTimer);
                    searchTimer = setTimeout(doSearch, 250);
                });

                if (clearBtn) {
                    clearBtn.addEventListener('click', function() {
                        searchInput.value = '';
                        searchInput.focus();
                        doSearch();
                    });
                }
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

                    // U+FEFF: without a BOM Excel reads the file as ANSI and the
                    // Georgian headers and values open as mojibake.
                    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
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
        applyFilters();
        applySort();
        renderBody();
        renderPagination();
        bindSearch();
        bindExport();

        // Fonts and late layout can change the table width after the first paint.
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(syncScroll);
        }
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

        // Group sidebar is chart-only
        if (typeof groupCol === 'undefined' || groupCol < 0 || settings.view === 'table') return;

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

        // "All" button in header
        var allBtn = sidebar.querySelector('.litestats-group-all');

        // Build sidebar list (groups only, no "All")
        var html = '';
        groups.forEach(function(g) {
            var count = rows.filter(function(r) { return String(r[groupCol] || '') === g; }).length;
            html += '<li class="litestats-group-item" data-group="' + escapeHtml(g) + '">' +
                '<span class="litestats-group-name">' + escapeHtml(g) + '</span>' +
                '<span class="litestats-group-count">' + count + '</span></li>';
        });
        list.innerHTML = html;

        // Shared filter handler
        function handleGroupClick(group, activeEl) {
            // Remove active from all
            if (allBtn) allBtn.classList.remove('active');
            list.querySelectorAll('.litestats-group-item').forEach(function(el) { el.classList.remove('active'); });
            activeEl.classList.add('active');

            var filteredRows;
            if (group === '__all__') {
                filteredRows = rows;
            } else {
                filteredRows = rows.filter(function(r) { return String(r[groupCol] || '') === group; });
            }

            var filteredData = {
                id: chartData.id,
                config: { cols: config.cols, rows: filteredRows },
                settings: settings,
                _groupFiltered: (group !== '__all__')
            };

            var contentArea = container.querySelector('.litestats-content-area');
            if (!contentArea) return;

            var oldCanvas = contentArea.querySelector('.litestats-canvas');
            if (oldCanvas) {
                var existingChart = Chart.getChart(oldCanvas);
                if (existingChart) existingChart.destroy();
                var newCanvas = document.createElement('canvas');
                newCanvas.className = 'litestats-canvas';
                oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
            }
            renderChart(containerId, filteredData);
        }

        // "All" click
        if (allBtn) {
            allBtn.addEventListener('click', function() {
                handleGroupClick('__all__', this);
            });
        }

        // Group item clicks
        list.querySelectorAll('.litestats-group-item').forEach(function(li) {
            li.addEventListener('click', function() {
                handleGroupClick(this.dataset.group, this);
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
