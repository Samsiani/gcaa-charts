/**
 * LiteStats Pro - Grid UI Module
 *
 * Handles grid rendering, drag & drop, and DOM manipulation.
 * Extracted from index.html prototype.
 *
 * @package LiteStats\Pro
 * @since   5.0.0
 */

/* global LiteStatsMathEngine, LiteStatsState */

(function(window) {
    'use strict';

    /**
     * Grid UI Manager.
     */
    const GridUI = {
        /**
         * Current drag row index.
         * @type {number|null}
         */
        dragRowIdx: null,

        /**
         * Format a cell value based on column properties.
         *
         * @param {*} val - The cell value.
         * @param {Object} col - The column configuration.
         * @returns {string} Formatted value.
         */
        formatValue: function(val, col) {
            if (col.type === 'string') {
                return val;
            }

            var num = parseFloat(val);
            if (isNaN(num)) {
                return val;
            }

            // Precision
            if (col.props && col.props.precision) {
                num = num.toFixed(col.props.precision);
            }

            // Prefix/Suffix
            var prefix = (col.props && col.props.prefix) ? col.props.prefix : '';
            var suffix = (col.props && col.props.suffix) ? col.props.suffix : '';

            return prefix + num + suffix;
        },

        /**
         * Render the grid table.
         *
         * @param {Object} app - The application state.
         * @param {Object} options - Render options with callbacks.
         */
        renderGrid: function(app, options) {
            var self = this;
            options = options || {};

            var thead = document.getElementById('gridHead');
            var tbody = document.getElementById('gridBody');

            if (!thead || !tbody) {
                return;
            }

            // 1. Render Headers
            var hHtml = '<tr><th style="width:40px; background:#f0f0f0;"></th>';
            
            app.cols.forEach(function(col, idx) {
                var isSelected = app.selectedCol === idx ? 'color:var(--litestats-primary)' : '';
                var typeLabel = col.type === 'formula' ? 'ƒ(x)' : (col.type === 'number' ? '123' : 'ABC');
                
                hHtml += '<th>' +
                    '<div class="th-inner" data-col-idx="' + idx + '">' +
                        '<div class="th-top">' +
                            '<span class="col-move-left" data-idx="' + idx + '">◀</span>' +
                            '<span>' + typeLabel + '</span>' +
                            '<span class="col-delete" data-idx="' + idx + '">✕</span>' +
                        '</div>' +
                        '<input class="th-title" id="th-title-' + idx + '" value="' + self.escapeHtml(col.name) + '" ' +
                               'style="' + isSelected + '" data-col-idx="' + idx + '">' +
                    '</div>' +
                '</th>';
            });
            
            hHtml += '</tr>';
            thead.innerHTML = hHtml;

            // 2. Render Rows
            var bHtml = '';
            
            app.rows.forEach(function(row, rIdx) {
                bHtml += '<tr>';

                // Drag Handle Cell
                bHtml += '<td class="row-handle" draggable="true" data-row-idx="' + rIdx + '">' +
                    '<i class="fas fa-grip-vertical"></i>' +
                    '<i class="fas fa-times del-row" data-row-idx="' + rIdx + '"></i>' +
                '</td>';

                // Data Cells
                row.forEach(function(cell, cIdx) {
                    var col = app.cols[cIdx];
                    var isFormula = col.type === 'formula';

                    // Display formatted value
                    var displayVal = isFormula ? cell : self.formatValue(cell, col);

                    var cls = 'cell-input';
                    if (isFormula) {
                        cls += ' cell-calculated';
                    }

                    // Conditional Formatting
                    if (col.name.toLowerCase().indexOf('growth') !== -1 || col.name.indexOf('%') !== -1) {
                        var num = parseFloat(cell);
                        if (num > 0) cls += ' val-pos';
                        if (num < 0) cls += ' val-neg';
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

            // Attach event listeners
            this.attachGridEvents(app, options);

            // Update status and chart
            if (typeof options.onRenderComplete === 'function') {
                options.onRenderComplete();
            }
        },

        /**
         * Attach event listeners to grid elements.
         *
         * @param {Object} app - The application state.
         * @param {Object} options - Options with callbacks.
         */
        attachGridEvents: function(app, options) {
            var self = this;
            options = options || {};

            // Column header clicks (select column)
            document.querySelectorAll('.th-inner').forEach(function(el) {
                el.addEventListener('click', function(e) {
                    if (e.target.classList.contains('col-move-left') || 
                        e.target.classList.contains('col-delete') ||
                        e.target.classList.contains('th-title')) {
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

                el.addEventListener('dragover', function(e) {
                    e.preventDefault();
                });

                el.addEventListener('drop', function(e) {
                    var targetIdx = parseInt(this.dataset.rowIdx, 10);
                    self.handleDrop(e, app, targetIdx, options);
                });
            });
        },

        /**
         * Handle drag start event.
         *
         * @param {Event} e - The drag event.
         * @param {number} idx - The row index.
         */
        handleDragStart: function(e, idx) {
            this.dragRowIdx = idx;
            e.dataTransfer.effectAllowed = 'move';
            e.target.closest('tr').style.opacity = '0.5';
        },

        /**
         * Handle drop event.
         *
         * @param {Event} e - The drop event.
         * @param {Object} app - The application state.
         * @param {number} targetIdx - The target row index.
         * @param {Object} options - Options with callbacks.
         */
        handleDrop: function(e, app, targetIdx, options) {
            e.preventDefault();

            if (this.dragRowIdx === null) {
                return;
            }

            // Save state before change
            if (window.LiteStatsState) {
                window.LiteStatsState.saveState(app);
            }

            // Move row
            var row = app.rows.splice(this.dragRowIdx, 1)[0];
            app.rows.splice(targetIdx, 0, row);

            this.dragRowIdx = null;

            // Re-render
            if (typeof options.onReorder === 'function') {
                options.onReorder();
            }
        },

        /**
         * Escape HTML entities.
         *
         * @param {string} str - String to escape.
         * @returns {string} Escaped string.
         */
        escapeHtml: function(str) {
            if (typeof str !== 'string') {
                return str;
            }
            var div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    };

    // Export to window
    window.LiteStatsGridUI = GridUI;

})(window);
