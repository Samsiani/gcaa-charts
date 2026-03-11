/**
 * LiteStats Pro - Admin Application
 *
 * Main controller for the admin dashboard.
 * Orchestrates all modules and handles UI interactions.
 *
 * @package LiteStats\Pro
 * @since   5.0.0
 */

/* global jQuery, liteStatsProAdmin, LiteStatsMathEngine, LiteStatsState, LiteStatsGridUI, LiteStatsCsvWizard, LiteStatsConditionalFormat, Chart */

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
            this.initState();

            if (window.LiteStatsMathEngine) {
                window.LiteStatsMathEngine.recalcAll(this.app);
            }

            if (window.LiteStatsState) {
                window.LiteStatsState.saveState(this.app);
            }

            this.renderGrid();
            this.bindEvents();
            this.updateStatus();
            this.selectColumn(1);
            this.updateChartConfigUI();
            this.syncTableSettingsUI();
            this.syncChartPolishUI();
            this.renderCondRules();
        },

        /**
         * Initialize application state.
         */
        initState: function() {
            var defaults = this.getDefaultSettings();

            if (liteStatsProAdmin.chartData && liteStatsProAdmin.chartData.config) {
                var loadedSettings = liteStatsProAdmin.chartData.settings || {};
                this.app = {
                    cols: liteStatsProAdmin.chartData.config.cols || this.getDefaultCols(),
                    rows: liteStatsProAdmin.chartData.config.rows || this.getDefaultRows(),
                    settings: $.extend({}, defaults, loadedSettings),
                    selectedCol: null
                };
            } else {
                this.app = {
                    cols: this.getDefaultCols(),
                    rows: this.getDefaultRows(),
                    settings: $.extend({}, defaults),
                    selectedCol: null
                };
            }

            this.migrateOldFormulas();
            this.syncSettingsUI();
        },

        migrateOldFormulas: function() {
            var cols = this.app.cols;
            var colToLetter = window.LiteStatsColToLetter;
            if (!colToLetter) return;

            var idMap = {};
            cols.forEach(function(col, idx) {
                if (col.id) {
                    idMap[col.id] = colToLetter(idx);
                }
            });

            cols.forEach(function(col) {
                if (col.type === 'formula' && col.formula) {
                    var changed = false;
                    var f = col.formula;
                    Object.keys(idMap).forEach(function(id) {
                        var regex = new RegExp('\\{' + id + '\\}', 'g');
                        if (regex.test(f)) {
                            f = f.replace(regex, idMap[id]);
                            changed = true;
                        }
                    });
                    if (changed) col.formula = f;
                }
            });
        },

        getDefaultCols: function() {
            return [
                { id: 'c1', name: 'Product', type: 'string', width: 150, props: {} },
                { id: 'c2', name: '2023 Sales', type: 'number', width: 100, props: { prefix: '$' } },
                { id: 'c3', name: '2024 Sales', type: 'number', width: 100, props: { prefix: '$' } },
                { id: 'c4', name: 'Growth', type: 'formula', formula: '=IF(C>B, "UP", "DOWN")', width: 100, props: {} }
            ];
        },

        getDefaultRows: function() {
            return [
                ['Laptop', 1200, 1500, ''],
                ['Phone', 800, 750, ''],
                ['Tablet', 450, 600, '']
            ];
        },

        getDefaultSettings: function() {
            return {
                chartType: 'bar',
                theme: 'default',
                stacked: false,
                view: 'chart',
                mode: 'value',
                chartLabelCol: 0,
                chartDataCols: [],
                xAxisLabel: '',
                yAxisLabel: '',
                legendPosition: 'top',
                showLegend: true,
                showDataLabels: false,
                seriesColors: {},
                tableRowsPerPage: 25,
                tableShowSearch: true,
                tableShowExport: true,
                tableColumnFilters: false,
                tableStriped: true,
                conditionalRules: [],
                fillArea: false,
                lineTension: 0.4,
                beginAtZero: true,
                groupByCol: -1
            };
        },

        syncSettingsUI: function() {
            var settings = this.app.settings;
            $('#chartType').val(settings.chartType);
            $('#themeSelect').val(settings.theme);
            $('#viewChart').toggleClass('active', settings.view === 'chart');
            $('#viewTable').toggleClass('active', settings.view === 'table');
        },

        /**
         * Bind event handlers.
         */
        bindEvents: function() {
            var self = this;

            // Toolbar
            $('#undoBtn').on('click', function() { self.undo(); });
            $('#redoBtn').on('click', function() { self.redo(); });
            $('#transposeBtn').on('click', function() { self.transposeTable(); });
            $('#savePresetBtn').on('click', function() { self.savePreset(); });
            $('#addRowBtn').on('click', function() { self.addRow(); });

            // CSV Import via wizard
            $('#importCsvBtn').on('click', function() {
                if (window.LiteStatsCsvWizard) {
                    window.LiteStatsCsvWizard.open(function(result) {
                        self.saveState();
                        self.app.cols = result.cols;
                        self.app.rows = result.rows;
                        self.renderGrid();
                        self.updateChartConfigUI();
                        self.showToast(liteStatsProAdmin.strings.csvImported);
                    });
                } else {
                    self.triggerImport();
                }
            });

            // Add Column dropdown
            $('#addColBtn').on('click', function(e) {
                e.stopPropagation();
                $('#addColMenu').toggle();
            });
            $('#addColMenu a').on('click', function(e) {
                e.preventDefault();
                $('#addColMenu').hide();
                var type = $(this).data('type');
                self.addColWithType(type);
            });
            $(document).on('click', function() { $('#addColMenu').hide(); });

            // View toggle
            $('#viewChart, #viewTable').on('click', function() {
                self.setView($(this).data('view'));
            });

            // Chart controls
            $('#chartType').on('change', function() {
                self.updateChartRender();
                self.toggleLineOptions();
            });
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

            // CSV file input (legacy fallback)
            $('#csvInput').on('change', function(e) { self.handleCsvImport(e); });

            // Frontend table search
            $('#feSearch').on('keyup', function() { self.filterFrontendTable(); });

            // Click-to-copy shortcode badges
            $(document).on('click', '.litestats-sc-badge[data-sc]', function() {
                var sc = $(this).data('sc');
                navigator.clipboard.writeText(sc).then(function() {
                    self.showToast('Copied: ' + sc);
                });
            });

            // Chart Configuration bindings
            $('#chartLabelCol').on('change', function() {
                self.app.settings.chartLabelCol = parseInt(this.value, 10);
                self.updateChartRender();
            });
            $(document).on('change', '.chart-data-col-cb', function() {
                self.app.settings.chartDataCols = [];
                $('.chart-data-col-cb:checked').each(function() {
                    self.app.settings.chartDataCols.push(parseInt(this.value, 10));
                });
                self.updateChartRender();
                self.updateSeriesColors();
            });
            $('#xAxisLabel').on('change', function() {
                self.app.settings.xAxisLabel = this.value;
                self.updateChartRender();
            });
            $('#yAxisLabel').on('change', function() {
                self.app.settings.yAxisLabel = this.value;
                self.updateChartRender();
            });
            $('#legendPosition').on('change', function() {
                self.app.settings.legendPosition = this.value;
                self.updateChartRender();
            });
            $('#showLegend').on('change', function() {
                self.app.settings.showLegend = this.checked;
                self.updateChartRender();
            });
            $('#showDataLabels').on('change', function() {
                self.app.settings.showDataLabels = this.checked;
                self.updateChartRender();
            });

            // Chart polish - line options
            $('#fillArea').on('change', function() {
                self.app.settings.fillArea = this.checked;
                self.updateChartRender();
            });
            $('#lineTension').on('input', function() {
                self.app.settings.lineTension = parseFloat(this.value);
                self.updateChartRender();
            });
            $('#beginAtZero').on('change', function() {
                self.app.settings.beginAtZero = this.checked;
                self.updateChartRender();
            });

            // Group by column
            $('#groupByCol').on('change', function() {
                self.app.settings.groupByCol = parseInt(this.value, 10);
                self.updateChartRender();
            });

            // Series color changes
            $(document).on('change', '.series-color-pick', function() {
                var colIdx = $(this).data('col-idx');
                self.app.settings.seriesColors[colIdx] = this.value;
                self.updateChartRender();
            });

            // Table settings
            $('#tableRowsPerPage').on('change', function() { self.app.settings.tableRowsPerPage = parseInt(this.value, 10) || 25; });
            $('#tableShowSearch').on('change', function() { self.app.settings.tableShowSearch = this.checked; });
            $('#tableShowExport').on('change', function() { self.app.settings.tableShowExport = this.checked; });
            $('#tableColumnFilters').on('change', function() { self.app.settings.tableColumnFilters = this.checked; });
            $('#tableStriped').on('change', function() { self.app.settings.tableStriped = this.checked; });

            // Conditional formatting
            $('#addCondRuleBtn').on('click', function() { self.addCondRule(); });
            $(document).on('change', '.cond-rule-row select, .cond-rule-row input', function() { self.syncCondRules(); });
            $(document).on('click', '.cond-delete-rule', function() {
                var idx = parseInt($(this).data('rule-idx'), 10);
                self.app.settings.conditionalRules.splice(idx, 1);
                self.renderCondRules();
                self.renderGrid();
            });

            // Keyboard shortcuts
            $(document).on('keydown', function(e) {
                // Only on editor pages
                if (!$('#mainGrid').length) return;

                if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    self.undo();
                }
                if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                    e.preventDefault();
                    self.redo();
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    self.saveChart();
                }
            });
        },

        saveState: function() {
            if (window.LiteStatsState) {
                window.LiteStatsState.saveState(this.app);
            }
            this.updateStatus();
        },

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

        updateStatus: function() {
            var historyInfo = window.LiteStatsState ? window.LiteStatsState.getHistoryInfo() : { undoCount: 0 };
            $('#statusBar').text(
                'Rows: ' + this.app.rows.length +
                ' | Cols: ' + this.app.cols.length +
                ' | History: ' + historyInfo.undoCount
            );
        },

        selectColumn: function(idx) {
            this.app.selectedCol = idx;
            var col = this.app.cols[idx];

            $('.th-title').css('color', 'inherit');
            $('#th-title-' + idx).css('color', 'var(--litestats-primary)');

            $('#colPrefix').val(col.props.prefix || '');
            $('#colSuffix').val(col.props.suffix || '');
            $('#colPrecision').val(col.props.precision !== undefined ? col.props.precision : 0);

            if (col.type === 'formula') {
                $('#formulaPercentOption').show();
                $('#colIsPercent').prop('checked', col.props.isPercent || false);
            } else {
                $('#formulaPercentOption').hide();
            }

            var fInput = $('#formulaInput');
            var colToLetter = window.LiteStatsColToLetter;
            var letter = colToLetter ? colToLetter(idx) : '?';
            if (col.type === 'formula') {
                fInput.val(col.formula);
                fInput.prop('disabled', false);
                fInput.attr('placeholder', 'e.g. =B+C, =SUM(B), =B1*5%');
                fInput.focus();
            } else {
                fInput.val('Column ' + letter + ' (' + col.name + ')');
                fInput.prop('disabled', true);
            }
        },

        undo: function() {
            var self = this;
            if (window.LiteStatsState && window.LiteStatsState.undo(this.app, function() {
                self.renderGrid();
                self.updateChartConfigUI();
            })) {
                this.showToast(liteStatsProAdmin.strings.undoSuccess);
            }
        },

        redo: function() {
            var self = this;
            if (window.LiteStatsState && window.LiteStatsState.redo(this.app, function() {
                self.renderGrid();
                self.updateChartConfigUI();
            })) {
                this.showToast(liteStatsProAdmin.strings.redoSuccess);
            }
        },

        addRow: function() {
            this.saveState();
            var newRow = this.app.cols.map(function(c) {
                if (c.type === 'number' || c.type === 'currency' || c.type === 'percentage') return 0;
                return '';
            });
            this.app.rows.push(newRow);
            window.LiteStatsMathEngine.recalcAll(this.app);
            this.renderGrid();
        },

        /**
         * Add a column with specific type.
         */
        addColWithType: function(type) {
            this.saveState();
            var newId = 'c' + Date.now();
            var col = { id: newId, name: 'New', type: type, width: 100, props: {} };

            if (type === 'formula') {
                col.formula = '=0';
            }
            if (type === 'currency') {
                col.props.prefix = '$';
                col.props.precision = '2';
            }
            if (type === 'percentage') {
                col.props.suffix = '%';
                col.props.precision = '1';
            }

            this.app.cols.push(col);
            this.app.rows.forEach(function(r) {
                r.push(type === 'number' || type === 'currency' || type === 'percentage' ? 0 : '');
            });
            this.renderGrid();
            this.updateChartConfigUI();
        },

        addCol: function() {
            this.addColWithType('number');
        },

        addFormulaCol: function() {
            this.addColWithType('formula');
        },

        delRow: function(idx) {
            this.saveState();
            this.app.rows.splice(idx, 1);
            this.renderGrid();
        },

        delCol: function(idx) {
            if (this.app.cols.length <= 1) {
                return this.showToast(liteStatsProAdmin.strings.cannotDelete, false);
            }
            this.saveState();
            this.app.cols.splice(idx, 1);
            this.app.rows.forEach(function(r) { r.splice(idx, 1); });
            this.renderGrid();
            this.updateChartConfigUI();
        },

        updateCell: function(rIdx, cIdx, val) {
            this.app.rows[rIdx][cIdx] = val;
            window.LiteStatsMathEngine.recalcAll(this.app);
            this.updateChartRender();
        },

        updateHeader: function(cIdx, val) {
            this.app.cols[cIdx].name = val;
            this.updateChartRender();
            this.updateChartConfigUI();
        },

        updateColumnType: function(colIdx, newType) {
            if (colIdx < 0 || colIdx >= this.app.cols.length) return;
            var col = this.app.cols[colIdx];
            if (col.type === 'formula') return;

            this.saveState();
            col.type = newType;

            // Reset props for new type
            if (newType === 'currency') {
                col.props.prefix = col.props.prefix || '$';
                col.props.precision = col.props.precision || '2';
            } else if (newType === 'percentage') {
                col.props.suffix = col.props.suffix || '%';
                col.props.precision = col.props.precision || '1';
            }

            this.renderGrid();
        },

        moveCol: function(idx, dir) {
            var target = idx + dir;
            if (target < 0 || target >= this.app.cols.length) return;
            this.saveState();

            var temp = this.app.cols[idx];
            this.app.cols[idx] = this.app.cols[target];
            this.app.cols[target] = temp;

            this.app.rows.forEach(function(row) {
                var temp = row[idx];
                row[idx] = row[target];
                row[target] = temp;
            });

            this.renderGrid();
            this.updateChartConfigUI();
        },

        transposeTable: function() {
            this.saveState();

            var newRows = [];
            var newCols = [{ id: 'c_t_0', name: this.app.cols[0].name, type: 'string', props: {} }];

            this.app.rows.forEach(function(row, i) {
                newCols.push({
                    id: 'c_t_' + (i + 1),
                    name: row[0] || ('Row ' + i),
                    type: 'number',
                    props: {}
                });
            });

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
            this.updateChartConfigUI();
            this.showToast(liteStatsProAdmin.strings.transposed);
        },

        updateColMeta: function(key, val) {
            if (this.app.selectedCol === null) {
                return this.showToast(liteStatsProAdmin.strings.selectColumn, false);
            }
            this.saveState();
            this.app.cols[this.app.selectedCol].props[key] = val;
            this.renderGrid();
        },

        setView: function(v) {
            this.app.settings.view = v;
            $('#viewChart').toggleClass('active', v === 'chart');
            $('#viewTable').toggleClass('active', v === 'table');
            this.updateChartRender();
        },

        toggleStack: function() {
            this.app.settings.stacked = !this.app.settings.stacked;
            this.updateChartRender();
            this.showToast(this.app.settings.stacked ? liteStatsProAdmin.strings.stackingOn : liteStatsProAdmin.strings.stackingOff);
        },

        /**
         * Toggle line chart options visibility.
         */
        toggleLineOptions: function() {
            var type = this.app.settings.chartType;
            var show = (type === 'line' || type === 'combo');
            $('#lineChartOptions').toggle(show);
        },

        /**
         * Sync chart polish UI with state.
         */
        syncChartPolishUI: function() {
            var s = this.app.settings;
            $('#fillArea').prop('checked', s.fillArea);
            $('#lineTension').val(s.lineTension);
            $('#beginAtZero').prop('checked', s.beginAtZero);
            this.toggleLineOptions();
        },

        /**
         * Sync table settings UI with state.
         */
        syncTableSettingsUI: function() {
            var s = this.app.settings;
            $('#tableRowsPerPage').val(s.tableRowsPerPage);
            $('#tableShowSearch').prop('checked', s.tableShowSearch);
            $('#tableShowExport').prop('checked', s.tableShowExport);
            $('#tableColumnFilters').prop('checked', s.tableColumnFilters);
            $('#tableStriped').prop('checked', s.tableStriped);
        },

        /**
         * Update Chart Configuration UI (label col dropdown, data col checkboxes, series colors).
         */
        updateChartConfigUI: function() {
            var self = this;
            var cols = this.app.cols;
            var settings = this.app.settings;

            // Label column dropdown
            var labelHtml = '';
            cols.forEach(function(col, idx) {
                var sel = (settings.chartLabelCol === idx) ? ' selected' : '';
                labelHtml += '<option value="' + idx + '"' + sel + '>' + col.name + '</option>';
            });
            $('#chartLabelCol').html(labelHtml);

            // Data columns checkboxes
            var dataHtml = '';
            cols.forEach(function(col, idx) {
                if (col.type === 'string' || col.type === 'date') return;
                var checked = (settings.chartDataCols.length === 0 || settings.chartDataCols.indexOf(idx) !== -1) ? ' checked' : '';
                dataHtml += '<label class="checkbox-label"><input type="checkbox" class="chart-data-col-cb" value="' + idx + '"' + checked + '> ' + col.name + '</label>';
            });
            $('#chartDataColsContainer').html(dataHtml);

            // Axis labels
            $('#xAxisLabel').val(settings.xAxisLabel || '');
            $('#yAxisLabel').val(settings.yAxisLabel || '');
            $('#legendPosition').val(settings.legendPosition || 'top');
            $('#showLegend').prop('checked', settings.showLegend !== false);
            $('#showDataLabels').prop('checked', settings.showDataLabels || false);

            this.updateSeriesColors();

            // Group by column dropdown
            var groupHtml = '<option value="-1">None</option>';
            cols.forEach(function(col, idx) {
                var sel = (settings.groupByCol === idx) ? ' selected' : '';
                groupHtml += '<option value="' + idx + '"' + sel + '>' + col.name + '</option>';
            });
            $('#groupByCol').html(groupHtml);
        },

        /**
         * Update series color pickers.
         */
        updateSeriesColors: function() {
            var cols = this.app.cols;
            var settings = this.app.settings;
            var dataCols = this.getDataColumnIndices();
            var palette = this.themes[settings.theme] || this.themes['default'];

            var html = '';
            dataCols.forEach(function(idx, i) {
                var color = (settings.seriesColors && settings.seriesColors[idx]) || palette[i % palette.length];
                html += '<div class="series-color-row">' +
                    '<input type="color" class="series-color-pick" data-col-idx="' + idx + '" value="' + color + '">' +
                    '<span>' + (cols[idx].name || 'Col ' + idx) + '</span>' +
                '</div>';
            });
            $('#seriesColorsContainer').html(html);
        },

        /**
         * Get indices of columns that should be used as chart data.
         */
        getDataColumnIndices: function() {
            var cols = this.app.cols;
            var settings = this.app.settings;
            var labelCol = settings.chartLabelCol || 0;

            if (settings.chartDataCols && settings.chartDataCols.length > 0) {
                return settings.chartDataCols;
            }

            // Default: all numeric-like columns except label column
            var indices = [];
            for (var i = 0; i < cols.length; i++) {
                if (i === labelCol) continue;
                if (cols[i].type !== 'string' && cols[i].type !== 'date') {
                    indices.push(i);
                }
            }
            return indices;
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
            if (!canvas) return;

            var ctx = canvas.getContext('2d');
            var settings = this.app.settings;
            var palette = this.themes[settings.theme];
            var labelCol = settings.chartLabelCol || 0;
            var dataCols = this.getDataColumnIndices();

            // Labels
            var labels = this.app.rows.map(function(r) { return r[labelCol]; });

            // Datasets
            var datasets = [];
            var colorIdx = 0;

            for (var di = 0; di < dataCols.length; di++) {
                var colIdx = dataCols[di];
                var col = this.app.cols[colIdx];
                var type = settings.chartType;

                if (type === 'combo') {
                    type = (di === dataCols.length - 1) ? 'line' : 'bar';
                }

                if ((settings.chartType === 'pie' || settings.chartType === 'doughnut') && di > 0) {
                    continue;
                }

                // Per-series color
                var seriesColor = (settings.seriesColors && settings.seriesColors[colIdx]) || palette[colorIdx % palette.length];

                datasets.push({
                    type: type === 'combo' ? 'bar' : type,
                    label: col.name,
                    data: this.app.rows.map(function(r) {
                        var val = r[colIdx];
                        if (typeof val === 'string') {
                            val = val.replace(/[$,%]/g, '');
                        }
                        return parseFloat(val) || 0;
                    }),
                    backgroundColor: (settings.chartType === 'pie' || settings.chartType === 'doughnut') ? palette : seriesColor,
                    borderColor: (settings.chartType === 'pie' || settings.chartType === 'doughnut') ? '#fff' : seriesColor,
                    borderWidth: 2,
                    fill: (type === 'line') ? settings.fillArea : false,
                    tension: settings.lineTension || 0.4
                });
                colorIdx++;
            }

            // Destroy existing chart
            if (this.chart) {
                this.chart.destroy();
            }

            if (typeof Chart === 'undefined') {
                console.error('Chart.js library not loaded.');
                return;
            }

            var isPie = settings.chartType === 'pie' || settings.chartType === 'doughnut';

            // Create new chart
            this.chart = new Chart(ctx, {
                type: settings.chartType === 'combo' ? 'bar' : settings.chartType,
                data: { labels: labels, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: isPie ? {} : {
                        x: {
                            stacked: settings.stacked,
                            title: {
                                display: !!settings.xAxisLabel,
                                text: settings.xAxisLabel || ''
                            }
                        },
                        y: {
                            stacked: settings.stacked,
                            beginAtZero: settings.beginAtZero,
                            title: {
                                display: !!settings.yAxisLabel,
                                text: settings.yAxisLabel || ''
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: settings.showLegend !== false,
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
        },

        renderFrontendTable: function() {
            var self = this;
            var thead = $('#feThead');
            var tbody = $('#feTbody');

            var hHtml = '<tr>';
            this.app.cols.forEach(function(c, i) {
                hHtml += '<th data-sort-idx="' + i + '">' + c.name + ' <i class="fas fa-sort" style="font-size:10px; color:#ccc"></i></th>';
            });
            thead.html(hHtml + '</tr>');

            var condRules = this.app.settings.conditionalRules || [];
            var CF = window.LiteStatsConditionalFormat;

            var bHtml = '';
            this.app.rows.forEach(function(r) {
                bHtml += '<tr>';
                r.forEach(function(cell, i) {
                    var formatted = window.LiteStatsGridUI ? window.LiteStatsGridUI.formatValue(cell, self.app.cols[i]) : cell;
                    var cellStyle = '';
                    if (CF && condRules.length) {
                        cellStyle = CF.getCellStyle(cell, i, condRules);
                    }
                    bHtml += '<td' + (cellStyle ? ' style="' + cellStyle + '"' : '') + '>' + formatted + '</td>';
                });
                bHtml += '</tr>';
            });
            tbody.html(bHtml);

            thead.find('th').off('click').on('click', function() {
                var idx = $(this).data('sortIdx');
                self.sortTable(idx);
            });
        },

        filterFrontendTable: function() {
            var term = $('#feSearch').val().toLowerCase();
            $('#feTbody tr').each(function() {
                var txt = $(this).text().toLowerCase();
                $(this).toggle(txt.indexOf(term) !== -1);
            });
        },

        sortTable: function(n) {
            var self = this;
            this.app.rows.sort(function(a, b) {
                var v1 = a[n], v2 = b[n];
                if (self.app.cols[n].type === 'number' || self.app.cols[n].type === 'currency' || self.app.cols[n].type === 'percentage') {
                    return parseFloat(v1) - parseFloat(v2);
                }
                return v1.toString().localeCompare(v2);
            });
            this.renderFrontendTable();
        },

        triggerImport: function() {
            $('#csvInput').click();
        },

        handleCsvImport: function(e) {
            var self = this;
            var file = e.target.files[0];
            if (!file) return;

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
                self.updateChartConfigUI();
                self.showToast(liteStatsProAdmin.strings.csvImported);
            };
            reader.readAsText(file);
            e.target.value = '';
        },

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
         * Conditional formatting: add a new rule.
         */
        addCondRule: function() {
            if (!this.app.settings.conditionalRules) {
                this.app.settings.conditionalRules = [];
            }
            this.app.settings.conditionalRules.push({
                colIdx: 0,
                operator: '>',
                value: '0',
                value2: '',
                style: { bg: '#ffff00', color: '#000000', bold: false }
            });
            this.renderCondRules();
        },

        /**
         * Render conditional formatting rules.
         */
        renderCondRules: function() {
            var container = document.getElementById('condRulesContainer');
            if (!container) return;

            var CF = window.LiteStatsConditionalFormat;
            if (!CF) { container.innerHTML = ''; return; }

            var rules = this.app.settings.conditionalRules || [];
            var html = '';
            for (var i = 0; i < rules.length; i++) {
                html += CF.renderRuleRow(rules[i], i, this.app.cols);
            }
            container.innerHTML = html;

            // Show/hide value inputs based on operator
            var self = this;
            container.querySelectorAll('.cond-op-select').forEach(function(sel) {
                sel.addEventListener('change', function() {
                    var row = this.closest('.cond-rule-row');
                    var op = this.value;
                    var needsValue = ['>', '<', '>=', '<=', '==', '!=', 'between', 'contains'].indexOf(op) !== -1;
                    var needsValue2 = op === 'between';
                    row.querySelector('.cond-value-input').style.display = needsValue ? '' : 'none';
                    row.querySelector('.cond-value2-input').style.display = needsValue2 ? '' : 'none';
                });
            });
        },

        /**
         * Sync conditional rules from UI to state.
         */
        syncCondRules: function() {
            var rules = [];
            document.querySelectorAll('.cond-rule-row').forEach(function(row) {
                rules.push({
                    colIdx: parseInt(row.querySelector('.cond-col-select').value, 10),
                    operator: row.querySelector('.cond-op-select').value,
                    value: row.querySelector('.cond-value-input').value,
                    value2: row.querySelector('.cond-value2-input').value,
                    style: {
                        bg: row.querySelectorAll('.cond-color-pick')[0].value,
                        color: row.querySelectorAll('.cond-color-pick')[1].value,
                        bold: row.querySelector('.cond-bold-check').checked
                    }
                });
            });
            this.app.settings.conditionalRules = rules;
            this.renderGrid();
        },

        /**
         * Save chart to database.
         */
        saveChart: function() {
            var self = this;
            var title = $('#chartTitle').val() || 'Untitled Chart';
            var chartId = liteStatsProAdmin.chartId || 0;

            var config = {
                cols: this.app.cols,
                rows: this.app.rows
            };

            var settings = this.app.settings;

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

                        if (!chartId && response.data.chart_id) {
                            liteStatsProAdmin.chartId = response.data.chart_id;

                            var cid = response.data.chart_id;
                            $('#scCode').html(
                                '<span class="litestats-sc-badge" data-sc=\'[litestats id="' + cid + '" view="chart"]\'>' +
                                    '<i class="fas fa-chart-bar"></i> [litestats id="' + cid + '" view="chart"]' +
                                '</span>' +
                                '<span class="litestats-sc-badge" data-sc=\'[litestats id="' + cid + '" view="table"]\'>' +
                                    '<i class="fas fa-table"></i> [litestats id="' + cid + '" view="table"]' +
                                '</span>'
                            );

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
        if ($('#mainGrid').length) {
            LiteStatsAdmin.init();
        }
    });

    window.LiteStatsAdmin = LiteStatsAdmin;

})(jQuery, window);
