/**
 * LiteStats Pro - Grid UI Module
 *
 * Handles grid rendering with Excel-style column letters (A, B, C...)
 * and row numbers (1, 2, 3...).
 *
 * @package LiteStats\Pro
 * @since   5.1.0
 */

/* global LiteStatsMathEngine, LiteStatsState, LiteStatsColToLetter */

(function(window) {
    'use strict';

    /**
     * Grid UI Manager.
     */
    var GridUI = {
        /**
         * Current drag row index.
         */
        dragRowIdx: null,

        /**
         * Format a cell value based on column properties.
         */
        formatValue: function(val, col) {
            if (col.type === 'string') {
                return val;
            }

            var num = parseFloat(val);
            if (isNaN(num)) {
                return val;
            }

            // Percentage display for formula columns
            if (col.type === 'formula' && col.props && col.props.isPercent) {
                num = num * 100;
            }

            var precision = (col.props && col.props.precision) ? col.props.precision : null;
            if (precision !== null) {
                num = num.toFixed(precision);
            } else if (col.type === 'formula' && num !== Math.floor(num)) {
                // Auto-round formula results to 2 decimals when no precision is set
                num = num.toFixed(2);
            }

            var prefix = (col.props && col.props.prefix) ? col.props.prefix : '';
            var suffix = (col.props && col.props.suffix) ? col.props.suffix : '';

            if (col.type === 'formula' && col.props && col.props.isPercent) {
                suffix = suffix + '%';
            }

            return prefix + num + suffix;
        },

        /**
         * Render the grid table with Excel-style headers.
         */
        renderGrid: function(app, options) {
            var self = this;
            options = options || {};

            var thead = document.getElementById('gridHead');
            var tbody = document.getElementById('gridBody');
            if (!thead || !tbody) return;

            var colToLetter = window.LiteStatsColToLetter || function(i) {
                var s = ''; i++;
                while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); }
                return s;
            };

            // === HEADERS ===
            // Row number column + data columns
            var hHtml = '<tr><th class="row-num-header"></th>';

            app.cols.forEach(function(col, idx) {
                var letter = colToLetter(idx);
                var isSelected = app.selectedCol === idx ? 'color:var(--litestats-primary)' : '';
                var typeLabel;

                if (col.type === 'formula') {
                    typeLabel = '<span class="col-type-label">\u0192(x)</span>';
                } else {
                    typeLabel = '<select class="col-type-select" data-col-idx="' + idx + '">' +
                        '<option value="string"' + (col.type === 'string' ? ' selected' : '') + '>ABC</option>' +
                        '<option value="number"' + (col.type === 'number' ? ' selected' : '') + '>123</option>' +
                    '</select>';
                }

                hHtml += '<th>' +
                    '<div class="th-inner" data-col-idx="' + idx + '">' +
                        '<div class="th-top">' +
                            '<span class="col-letter">' + letter + '</span>' +
                            '<span class="col-move-left" data-idx="' + idx + '">\u25C0</span>' +
                            typeLabel +
                            '<span class="col-delete" data-idx="' + idx + '">\u2715</span>' +
                        '</div>' +
                        '<input class="th-title" id="th-title-' + idx + '" value="' + self.escapeHtml(col.name) + '" ' +
                               'style="' + isSelected + '" data-col-idx="' + idx + '">' +
                    '</div>' +
                '</th>';
            });

            hHtml += '</tr>';
            thead.innerHTML = hHtml;

            // === ROWS ===
            var bHtml = '';

            app.rows.forEach(function(row, rIdx) {
                var rowNum = rIdx + 1;
                bHtml += '<tr>';

                // Row number + handle + delete
                bHtml += '<td class="row-handle" draggable="true" data-row-idx="' + rIdx + '">' +
                    '<span class="row-num">' + rowNum + '</span>' +
                    '<i class="fas fa-grip-vertical row-grip"></i>' +
                    '<i class="fas fa-times del-row" data-row-idx="' + rIdx + '"></i>' +
                '</td>';

                // Data cells
                row.forEach(function(cell, cIdx) {
                    var col = app.cols[cIdx];
                    var isFormula = col.type === 'formula';
                    var displayVal = self.formatValue(cell, col);

                    var cls = 'cell-input';
                    if (isFormula) cls += ' cell-calculated';

                    // Conditional formatting
                    if (col.name.toLowerCase().indexOf('growth') !== -1 || col.name.indexOf('%') !== -1) {
                        var n = parseFloat(cell);
                        if (n > 0) cls += ' val-pos';
                        if (n < 0) cls += ' val-neg';
                    }

                    var readonly = isFormula ? 'readonly' : '';

                    bHtml += '<td>' +
                        '<input class="' + cls + '" value="' + self.escapeHtml(String(displayVal)) + '" ' +
                               readonly + ' data-row-idx="' + rIdx + '" data-col-idx="' + cIdx + '">' +
                    '</td>';
                });

                bHtml += '</tr>';
            });

            tbody.innerHTML = bHtml;

            this.attachGridEvents(app, options);

            if (typeof options.onRenderComplete === 'function') {
                options.onRenderComplete();
            }
        },

        /**
         * Attach event listeners to grid elements.
         */
        attachGridEvents: function(app, options) {
            var self = this;
            options = options || {};

            // Column header clicks
            document.querySelectorAll('.th-inner').forEach(function(el) {
                el.addEventListener('click', function(e) {
                    if (e.target.classList.contains('col-move-left') ||
                        e.target.classList.contains('col-delete') ||
                        e.target.classList.contains('th-title') ||
                        e.target.classList.contains('col-type-select')) {
                        return;
                    }
                    var idx = parseInt(this.dataset.colIdx, 10);
                    if (typeof options.onSelectColumn === 'function') {
                        options.onSelectColumn(idx);
                    }
                });
            });

            // Header title changes
            document.querySelectorAll('.th-title').forEach(function(el) {
                el.addEventListener('change', function() {
                    var idx = parseInt(this.dataset.colIdx, 10);
                    if (typeof options.onHeaderChange === 'function') {
                        options.onHeaderChange(idx, this.value);
                    }
                });
            });

            // Column move left
            document.querySelectorAll('.col-move-left').forEach(function(el) {
                el.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var idx = parseInt(this.dataset.idx, 10);
                    if (typeof options.onMoveCol === 'function') {
                        options.onMoveCol(idx, -1);
                    }
                });
            });

            // Column delete
            document.querySelectorAll('.col-delete').forEach(function(el) {
                el.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var idx = parseInt(this.dataset.idx, 10);
                    if (typeof options.onDelCol === 'function') {
                        options.onDelCol(idx);
                    }
                });
            });

            // Column type change
            document.querySelectorAll('.col-type-select').forEach(function(el) {
                el.addEventListener('change', function(e) {
                    e.stopPropagation();
                    var idx = parseInt(this.dataset.colIdx, 10);
                    if (typeof options.onColumnTypeChange === 'function') {
                        options.onColumnTypeChange(idx, this.value);
                    }
                });
                el.addEventListener('click', function(e) { e.stopPropagation(); });
            });

            // Cell input changes
            document.querySelectorAll('.cell-input').forEach(function(el) {
                el.addEventListener('change', function() {
                    var rIdx = parseInt(this.dataset.rowIdx, 10);
                    var cIdx = parseInt(this.dataset.colIdx, 10);
                    if (typeof options.onCellChange === 'function') {
                        options.onCellChange(rIdx, cIdx, this.value);
                    }
                });
            });

            // Row delete
            document.querySelectorAll('.del-row').forEach(function(el) {
                el.addEventListener('click', function() {
                    var idx = parseInt(this.dataset.rowIdx, 10);
                    if (typeof options.onDelRow === 'function') {
                        options.onDelRow(idx);
                    }
                });
            });

            // Drag & Drop
            document.querySelectorAll('.row-handle').forEach(function(el) {
                el.addEventListener('dragstart', function(e) {
                    self.handleDragStart(e, parseInt(this.dataset.rowIdx, 10));
                });
                el.addEventListener('dragover', function(e) { e.preventDefault(); });
                el.addEventListener('drop', function(e) {
                    self.handleDrop(e, app, parseInt(this.dataset.rowIdx, 10), options);
                });
            });
        },

        handleDragStart: function(e, idx) {
            this.dragRowIdx = idx;
            e.dataTransfer.effectAllowed = 'move';
            e.target.closest('tr').style.opacity = '0.5';
        },

        handleDrop: function(e, app, targetIdx, options) {
            e.preventDefault();
            if (this.dragRowIdx === null) return;

            if (window.LiteStatsState) {
                window.LiteStatsState.saveState(app);
            }

            var row = app.rows.splice(this.dragRowIdx, 1)[0];
            app.rows.splice(targetIdx, 0, row);
            this.dragRowIdx = null;

            if (typeof options.onReorder === 'function') {
                options.onReorder();
            }
        },

        escapeHtml: function(str) {
            if (typeof str !== 'string') return str;
            var div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    };

    window.LiteStatsGridUI = GridUI;

})(window);
