/**
 * LiteStats Pro - Admin Application
 *
 * Main controller for the admin dashboard.
 * Orchestrates all modules and handles UI interactions.
 *
 * @package LiteStats\Pro
 * @since   5.0.0
 */

/* global jQuery, liteStatsProAdmin, LiteStatsMathEngine, LiteStatsState, LiteStatsGridUI, Chart */

(function($, window) {
    'use strict';

    /**
     * LiteStats Admin Application
     */
    var LiteStatsAdmin = {
        /**
         * Application state.
         */
        app: null,

        /**
         * Chart.js instance.
         */
        chart: null,

        /**
         * Color themes for charts.
         */
        themes: {
            'default': ['#2271b1', '#46b450', '#d63638', '#f1c40f', '#9b59b6'],
            'modern': ['#3f51b5', '#00bcd4', '#009688', '#ffc107', '#ff5722'],
            'pastel': ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea'],
            'dark': ['#333333', '#555555', '#777777', '#999999', '#bbbbbb']
        },

        /**
         * Initialize the application.
         */
        init: function() {
            var self = this;

            // Initialize state
            this.initState();

            // Initialize MathEngine calculation
            if (window.LiteStatsMathEngine) {
                window.LiteStatsMathEngine.recalcAll(this.app);
            }

            // Save initial state for history
            if (window.LiteStatsState) {
                window.LiteStatsState.saveState(this.app);
            }

            // Render grid
            this.renderGrid();

            // Bind events
            this.bindEvents();

            // Update status
            this.updateStatus();

            // Auto-select first column
            this.selectColumn(1);
        },

        /**
         * Initialize application state.
         */
        initState: function() {
            // Check if we have chart data from WordPress
            if (liteStatsProAdmin.chartData && liteStatsProAdmin.chartData.config) {
                this.app = {
                    cols: liteStatsProAdmin.chartData.config.cols || this.getDefaultCols(),
                    rows: liteStatsProAdmin.chartData.config.rows || this.getDefaultRows(),
                    settings: liteStatsProAdmin.chartData.settings || this.getDefaultSettings(),
                    selectedCol: null
                };
            } else {
                // New chart - use defaults
                this.app = {
                    cols: this.getDefaultCols(),
                    rows: this.getDefaultRows(),
                    settings: this.getDefaultSettings(),
                    selectedCol: null
                };
            }

            // Sync UI with settings
            this.syncSettingsUI();
        },

        /**
         * Get default columns.
         */
        getDefaultCols: function() {
            return [
                { id: 'c1', name: 'Product', type: 'string', width: 150, props: {} },
                { id: 'c2', name: '2023 Sales', type: 'number', width: 100, props: { prefix: '$' } },
                { id: 'c3', name: '2024 Sales', type: 'number', width: 100, props: { prefix: '$' } },
                { id: 'c4', name: 'Growth', type: 'formula', formula: '=IF({c3}>{c2}, "UP", "DOWN")', width: 100, props: {} }
            ];
        },

        /**
         * Get default rows.
         */
        getDefaultRows: function() {
            return [
                ['Laptop', 1200, 1500, ''],
                ['Phone', 800, 750, ''],
                ['Tablet', 450, 600, '']
            ];
        },

        /**
         * Get default settings.
         */
        getDefaultSettings: function() {
            return {
                chartType: 'bar',
                theme: 'default',
                stacked: false,
                view: 'chart',
                mode: 'value'
            };
        },

        /**
         * Sync UI elements with current settings.
         */
        syncSettingsUI: function() {
            var settings = this.app.settings;

            // Chart type
            $('#chartType').val(settings.chartType);

            // Theme
            $('#themeSelect').val(settings.theme);

            // Mode toggle
            $('#modeValue').toggleClass('active', settings.mode === 'value');
            $('#modePercent').toggleClass('active', settings.mode === 'percent');

            // View toggle
            $('#viewChart').toggleClass('active', settings.view === 'chart');
            $('#viewTable').toggleClass('active', settings.view === 'table');
        },

        /**
         * Bind event handlers.
         */
        bindEvents: function() {
            var self = this;

            // Toolbar buttons
            $('#undoBtn').on('click', function() { self.undo(); });
            $('#redoBtn').on('click', function() { self.redo(); });
            $('#transposeBtn').on('click', function() { self.transposeTable(); });
            $('#importCsvBtn').on('click', function() { self.triggerImport(); });
            $('#savePresetBtn').on('click', function() { self.savePreset(); });
            $('#addRowBtn').on('click', function() { self.addRow(); });
            $('#addColBtn').on('click', function() { self.addCol(); });
            $('#addFormulaColBtn').on('click', function() { self.addFormulaCol(); });

            // Mode toggle
            $('#modeValue, #modePercent').on('click', function() {
                self.setMode($(this).data('mode'));
            });

            // View toggle
            $('#viewChart, #viewTable').on('click', function() {
                self.setView($(this).data('view'));
            });

            // Chart controls
            $('#chartType').on('change', function() { self.updateChartRender(); });
            $('#themeSelect').on('change', function() { self.updateChartRender(); });
            $('#toggleStackBtn').on('click', function() { self.toggleStack(); });
            $('#exportPngBtn').on('click', function() { self.exportPng(); });

            // Column formatting
            $('#colPrefix').on('change', function() { self.updateColMeta('prefix', this.value); });
            $('#colSuffix').on('change', function() { self.updateColMeta('suffix', this.value); });
            $('#colPrecision').on('change', function() { self.updateColMeta('precision', this.value); });
            $('#colIsPercent').on('change', function() { self.updateColMeta('isPercent', this.checked); });

            // Formula input
            $('#formulaInput').on('change', function() {
                if (self.app.selectedCol !== null && self.app.cols[self.app.selectedCol].type === 'formula') {
                    self.saveState();
                    self.app.cols[self.app.selectedCol].formula = this.value;
                    window.LiteStatsMathEngine.recalcAll(self.app);
                    self.renderGrid();
                }
            });

            // Save button
            $('#saveChartBtn').on('click', function() { self.saveChart(); });

            // CSV file input
            $('#csvInput').on('change', function(e) { self.handleCsvImport(e); });

            // Frontend table search
            $('#feSearch').on('keyup', function() { self.filterFrontendTable(); });
        },

        /**
         * Save current state to history.
         */
        saveState: function() {
            if (window.LiteStatsState) {
                window.LiteStatsState.saveState(this.app);
            }
            this.updateStatus();
        },

        /**
         * Render the grid.
         */
        renderGrid: function() {
            var self = this;

            if (window.LiteStatsGridUI) {
                window.LiteStatsGridUI.renderGrid(this.app, {
                    onSelectColumn: function(idx) { self.selectColumn(idx); },
                    onHeaderChange: function(idx, val) { self.updateHeader(idx, val); },
                    onMoveCol: function(idx, dir) { self.moveCol(idx, dir); },
                    onDelCol: function(idx) { self.delCol(idx); },
                    onDelRow: function(idx) { self.delRow(idx); },
                    onCellChange: function(rIdx, cIdx, val) { self.updateCell(rIdx, cIdx, val); },
                    onColumnTypeChange: function(idx, newType) { self.updateColumnType(idx, newType); },
                    onReorder: function() { self.renderGrid(); },
                    onRenderComplete: function() {
                        self.updateStatus();
                        self.updateChartRender();
                    }
                });
            }
        },

        /**
         * Update status bar.
         */
        updateStatus: function() {
            var historyInfo = window.LiteStatsState ? window.LiteStatsState.getHistoryInfo() : { undoCount: 0 };
            $('#statusBar').text(
                'Rows: ' + this.app.rows.length + 
                ' | Cols: ' + this.app.cols.length + 
                ' | History: ' + historyInfo.undoCount
            );
        },

        /**
         * Select a column.
         */
        selectColumn: function(idx) {
            this.app.selectedCol = idx;
            var col = this.app.cols[idx];

            // Highlight logic
            $('.th-title').css('color', 'inherit');
            $('#th-title-' + idx).css('color', 'var(--litestats-primary)');

            // Update Settings Panel
            $('#colPrefix').val(col.props.prefix || '');
            $('#colSuffix').val(col.props.suffix || '');
            $('#colPrecision').val(col.props.precision !== undefined ? col.props.precision : 0);

            // Show/hide percentage option for formula columns
            if (col.type === 'formula') {
                $('#formulaPercentOption').show();
                $('#colIsPercent').prop('checked', col.props.isPercent || false);
            } else {
                $('#formulaPercentOption').hide();
            }

            // Update Formula Bar
            var fInput = $('#formulaInput');
            if (col.type === 'formula') {
                fInput.val(col.formula);
                fInput.prop('disabled', false);
                fInput.focus();
            } else {
                fInput.val('Column ID: {' + col.id + '}');
                fInput.prop('disabled', true);
            }
        },

        /**
         * Undo last action.
         */
        undo: function() {
            var self = this;
            if (window.LiteStatsState && window.LiteStatsState.undo(this.app, function() {
                self.renderGrid();
            })) {
                this.showToast(liteStatsProAdmin.strings.undoSuccess);
            }
        },

        /**
         * Redo last undone action.
         */
        redo: function() {
            var self = this;
            if (window.LiteStatsState && window.LiteStatsState.redo(this.app, function() {
                self.renderGrid();
            })) {
                this.showToast(liteStatsProAdmin.strings.redoSuccess);
            }
        },

        /**
         * Add a new row.
         */
        addRow: function() {
            this.saveState();
            var newRow = this.app.cols.map(function(c) {
                return c.type === 'number' ? 0 : '';
            });
            this.app.rows.push(newRow);
            window.LiteStatsMathEngine.recalcAll(this.app);
            this.renderGrid();
        },

        /**
         * Add a new column.
         */
        addCol: function() {
            this.saveState();
            var newId = 'c' + Date.now();
            this.app.cols.push({ id: newId, name: 'New', type: 'number', width: 100, props: {} });
            this.app.rows.forEach(function(r) { r.push(0); });
            this.renderGrid();
        },

        /**
         * Add a formula column.
         */
        addFormulaCol: function() {
            this.saveState();
            var newId = 'c' + Date.now();
            this.app.cols.push({ id: newId, name: 'Calc', type: 'formula', formula: '=0', width: 100, props: {} });
            this.app.rows.forEach(function(r) { r.push(0); });
            this.renderGrid();
        },

        /**
         * Delete a row.
         */
        delRow: function(idx) {
            this.saveState();
            this.app.rows.splice(idx, 1);
            this.renderGrid();
        },

        /**
         * Delete a column.
         */
        delCol: function(idx) {
            if (this.app.cols.length <= 1) {
                return this.showToast(liteStatsProAdmin.strings.cannotDelete, false);
            }
            this.saveState();
            this.app.cols.splice(idx, 1);
            this.app.rows.forEach(function(r) { r.splice(idx, 1); });
            this.renderGrid();
        },

        /**
         * Update a cell value.
         */
        updateCell: function(rIdx, cIdx, val) {
            this.app.rows[rIdx][cIdx] = val;
            window.LiteStatsMathEngine.recalcAll(this.app);
            this.updateChartRender();
        },

        /**
         * Update header name.
         */
        updateHeader: function(cIdx, val) {
            this.app.cols[cIdx].name = val;
            this.updateChartRender();
        },

        /**
         * Update column type.
         *
         * @param {number} colIdx - The column index.
         * @param {string} newType - The new column type ('string' or 'number').
         */
        updateColumnType: function(colIdx, newType) {
            if (colIdx < 0 || colIdx >= this.app.cols.length) {
                return;
            }
            
            var col = this.app.cols[colIdx];
            
            // Do not allow changing formula columns
            if (col.type === 'formula') {
                return;
            }
            
            this.saveState();
            col.type = newType;
            this.renderGrid();
        },

        /**
         * Move a column.
         */
        moveCol: function(idx, dir) {
            var target = idx + dir;
            if (target < 0 || target >= this.app.cols.length) {
                return;
            }
            this.saveState();

            // Swap cols
            var temp = this.app.cols[idx];
            this.app.cols[idx] = this.app.cols[target];
            this.app.cols[target] = temp;

            // Swap data
            this.app.rows.forEach(function(row) {
                var temp = row[idx];
                row[idx] = row[target];
                row[target] = temp;
            });

            this.renderGrid();
        },

        /**
         * Transpose the table.
         */
        transposeTable: function() {
            this.saveState();

            var newRows = [];
            var newCols = [{ id: 'c_t_0', name: this.app.cols[0].name, type: 'string', props: {} }];

            // Old rows become new headers
            var self = this;
            this.app.rows.forEach(function(row, i) {
                newCols.push({
                    id: 'c_t_' + (i + 1),
                    name: row[0] || ('Row ' + i),
                    type: 'number',
                    props: {}
                });
            });

            // Old columns become rows
            for (var c = 1; c < this.app.cols.length; c++) {
                var newRow = [this.app.cols[c].name];
                this.app.rows.forEach(function(r) {
                    newRow.push(r[c]);
                });
                newRows.push(newRow);
            }

            this.app.cols = newCols;
            this.app.rows = newRows;
            this.renderGrid();
            this.showToast(liteStatsProAdmin.strings.transposed);
        },

        /**
         * Update column metadata.
         */
        updateColMeta: function(key, val) {
            if (this.app.selectedCol === null) {
                return this.showToast(liteStatsProAdmin.strings.selectColumn, false);
            }
            this.saveState();
            this.app.cols[this.app.selectedCol].props[key] = val;
            this.renderGrid();
        },

        /**
         * Set display mode.
         */
        setMode: function(m) {
            this.app.settings.mode = m;
            $('#modeValue').toggleClass('active', m === 'value');
            $('#modePercent').toggleClass('active', m === 'percent');
            this.updateChartRender();
        },

        /**
         * Set view mode.
         */
        setView: function(v) {
            this.app.settings.view = v;
            $('#viewChart').toggleClass('active', v === 'chart');
            $('#viewTable').toggleClass('active', v === 'table');
            this.updateChartRender();
        },

        /**
         * Toggle stack mode.
         */
        toggleStack: function() {
            this.app.settings.stacked = !this.app.settings.stacked;
            this.updateChartRender();
            this.showToast(this.app.settings.stacked ? liteStatsProAdmin.strings.stackingOn : liteStatsProAdmin.strings.stackingOff);
        },

        /**
         * Update chart rendering.
         */
        updateChartRender: function() {
            var self = this;

            // Sync settings
            this.app.settings.chartType = $('#chartType').val();
            this.app.settings.theme = $('#themeSelect').val();

            // Table view
            if (this.app.settings.view === 'table') {
                $('#liveChart').hide();
                $('#tablePreviewBox').show();
                this.renderFrontendTable();
                return;
            } else {
                $('#liveChart').show();
                $('#tablePreviewBox').hide();
            }

            var canvas = document.getElementById('liveChart');
            if (!canvas) {
                return;
            }

            var ctx = canvas.getContext('2d');
            var palette = this.themes[this.app.settings.theme];

            // Data Prep
            var labels = this.app.rows.map(function(r) { return r[0]; });
            var datasets = [];
            var colorIdx = 0;

            for (var i = 1; i < this.app.cols.length; i++) {
                var col = this.app.cols[i];
                var type = this.app.settings.chartType;

                if (type === 'combo') {
                    type = (i === this.app.cols.length - 1) ? 'line' : 'bar';
                }

                if (this.app.settings.chartType === 'pie' && i > 1) {
                    continue;
                }

                datasets.push({
                    type: type === 'combo' ? 'bar' : type,
                    label: col.name,
                    data: this.app.rows.map(function(r) {
                        var val = r[i];
                        if (typeof val === 'string') {
                            val = val.replace(/[$,%]/g, '');
                        }
                        return parseFloat(val) || 0;
                    }),
                    backgroundColor: this.app.settings.chartType === 'pie' ? palette : palette[colorIdx % palette.length],
                    borderColor: this.app.settings.chartType === 'pie' ? '#fff' : palette[colorIdx % palette.length],
                    borderWidth: 2,
                    fill: type === 'line' && !this.app.settings.stacked,
                    tension: 0.4
                });
                colorIdx++;
            }

            // Destroy existing chart
            if (this.chart) {
                this.chart.destroy();
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

            // Create new chart
            this.chart = new Chart(ctx, {
                type: this.app.settings.chartType === 'combo' ? 'bar' : this.app.settings.chartType,
                data: { labels: labels, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: this.app.settings.chartType === 'pie' ? {} : {
                        x: { stacked: this.app.settings.stacked },
                        y: { stacked: this.app.settings.stacked, beginAtZero: true }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    var val = context.raw;
                                    if (self.app.settings.mode === 'percent' && self.app.settings.chartType === 'pie') {
                                        var sum = context.chart._metasets[context.datasetIndex].total;
                                        var p = ((val / sum) * 100).toFixed(1) + '%';
                                        return context.label + ': ' + p;
                                    }
                                    return context.label + ': ' + val;
                                }
                            }
                        }
                    }
                }
            });
        },

        /**
         * Render frontend table preview.
         */
        renderFrontendTable: function() {
            var self = this;
            var thead = $('#feThead');
            var tbody = $('#feTbody');

            var hHtml = '<tr>';
            this.app.cols.forEach(function(c, i) {
                hHtml += '<th data-sort-idx="' + i + '">' + c.name + ' <i class="fas fa-sort" style="font-size:10px; color:#ccc"></i></th>';
            });
            thead.html(hHtml + '</tr>');

            var bHtml = '';
            this.app.rows.forEach(function(r) {
                bHtml += '<tr>';
                r.forEach(function(cell, i) {
                    var formatted = window.LiteStatsGridUI ? window.LiteStatsGridUI.formatValue(cell, self.app.cols[i]) : cell;
                    bHtml += '<td>' + formatted + '</td>';
                });
                bHtml += '</tr>';
            });
            tbody.html(bHtml);

            // Sort handler
            thead.find('th').off('click').on('click', function() {
                var idx = $(this).data('sortIdx');
                self.sortTable(idx);
            });
        },

        /**
         * Filter frontend table.
         */
        filterFrontendTable: function() {
            var term = $('#feSearch').val().toLowerCase();
            $('#feTbody tr').each(function() {
                var txt = $(this).text().toLowerCase();
                $(this).toggle(txt.indexOf(term) !== -1);
            });
        },

        /**
         * Sort frontend table.
         */
        sortTable: function(n) {
            var self = this;
            this.app.rows.sort(function(a, b) {
                var v1 = a[n], v2 = b[n];
                if (self.app.cols[n].type === 'number') {
                    return parseFloat(v1) - parseFloat(v2);
                }
                return v1.toString().localeCompare(v2);
            });
            this.renderFrontendTable();
        },

        /**
         * Trigger CSV import.
         */
        triggerImport: function() {
            $('#csvInput').click();
        },

        /**
         * Handle CSV import.
         */
        handleCsvImport: function(e) {
            var self = this;
            var file = e.target.files[0];
            if (!file) {
                return;
            }

            var reader = new FileReader();
            reader.onload = function(evt) {
                self.saveState();

                var lines = evt.target.result.split('\n').filter(function(l) {
                    return l.trim();
                });
                var headers = lines[0].split(',');

                self.app.cols = headers.map(function(h, i) {
                    return {
                        id: 'c' + Date.now() + i,
                        name: h.trim(),
                        type: i === 0 ? 'string' : 'number',
                        props: {}
                    };
                });

                self.app.rows = lines.slice(1).map(function(l) {
                    return l.split(',').map(function(v) { return v.trim(); });
                });

                self.renderGrid();
                self.showToast(liteStatsProAdmin.strings.csvImported);
            };
            reader.readAsText(file);

            // Reset input
            e.target.value = '';
        },

        /**
         * Save preset.
         */
        savePreset: function() {
            var name = prompt('Enter preset name:', 'My Style 1');
            if (name) {
                var preset = {
                    settings: this.app.settings,
                    props: this.app.cols.map(function(c) { return c.props; })
                };
                localStorage.setItem('litestats_preset_' + name, JSON.stringify(preset));
                this.showToast(liteStatsProAdmin.strings.presetSaved);
            }
        },

        /**
         * Export chart as PNG.
         */
        exportPng: function() {
            var canvas = document.getElementById('liveChart');
            if (canvas) {
                var link = document.createElement('a');
                link.download = 'chart.png';
                link.href = canvas.toDataURL();
                link.click();
            }
        },

        /**
         * Save chart to database.
         */
        saveChart: function() {
            var self = this;
            var title = $('#chartTitle').val() || 'Untitled Chart';
            var chartId = liteStatsProAdmin.chartId || 0;

            // Prepare data
            var config = {
                cols: this.app.cols,
                rows: this.app.rows
            };

            var settings = this.app.settings;

            // AJAX save
            $.ajax({
                url: liteStatsProAdmin.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'litestats_save_chart',
                    nonce: liteStatsProAdmin.nonce,
                    chart_id: chartId,
                    title: title,
                    config: JSON.stringify(config),
                    settings: JSON.stringify(settings)
                },
                success: function(response) {
                    if (response.success) {
                        self.showToast(liteStatsProAdmin.strings.saveSuccess);

                        // Update chart ID if new
                        if (!chartId && response.data.chart_id) {
                            liteStatsProAdmin.chartId = response.data.chart_id;

                            // Update shortcode display
                            $('#scCode').text('[litestats id="' + response.data.chart_id + '"]');

                            // Update URL without reload
                            var newUrl = window.location.href.replace('litestats-pro-new', 'litestats-pro-edit') + 
                                        '&chart_id=' + response.data.chart_id;
                            window.history.replaceState({}, '', newUrl);
                        }
                    } else {
                        self.showToast(response.data.message || liteStatsProAdmin.strings.saveError, false);
                    }
                },
                error: function() {
                    self.showToast(liteStatsProAdmin.strings.saveError, false);
                }
            });
        },

        /**
         * Show toast notification.
         */
        showToast: function(msg, success) {
            success = success !== false;
            var $toast = $('#toast');
            $toast.text(msg);
            $toast.css('background', success ? '#333' : '#d63638');
            $toast.addClass('visible');
            setTimeout(function() {
                $toast.removeClass('visible');
            }, 3000);
        }
    };

    // Initialize on DOM ready
    $(document).ready(function() {
        // Only init if we're on the editor page
        if ($('#mainGrid').length) {
            LiteStatsAdmin.init();
        }
    });

    // Export to window
    window.LiteStatsAdmin = LiteStatsAdmin;

})(jQuery, window);
