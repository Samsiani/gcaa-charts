/**
 * LiteStats Pro - Math Engine Module
 *
 * Handles all formula calculations including SUM, AVG, MIN, MAX, IF, CONCAT.
 * Extracted from index.html prototype.
 *
 * @package LiteStats\Pro
 * @since   5.0.0
 */

/* global liteStatsProAdmin */

(function(window) {
    'use strict';

    /**
     * Math Engine object for formula evaluation.
     */
    const MathEngine = {
        /**
         * Evaluate a formula for a given row.
         *
         * @param {string} formula - The formula string (e.g., "=SUM({c1}, {c2})").
         * @param {Array} row - The row data array.
         * @param {Array} cols - The columns configuration array.
         * @returns {*} The calculated result or "#ERR" on error.
         */
        evaluate: function(formula, row, cols) {
            if (!formula || !formula.startsWith('=')) {
                return formula;
            }

            let expression = formula.substring(1); // Remove '='

            // 1. Replace Column IDs {c1} with actual values
            cols.forEach(function(col, idx) {
                const val = parseFloat(row[idx]) || 0;
                const regex = new RegExp('\\{' + col.id + '\\}', 'g');
                expression = expression.replace(regex, val);
            });

            // 2. Handle Functions
            try {
                // Define Excel-like functions
                const SUM = function() {
                    return Array.prototype.slice.call(arguments).reduce(function(a, b) {
                        return a + b;
                    }, 0);
                };

                const AVG = function() {
                    const args = Array.prototype.slice.call(arguments);
                    return args.reduce(function(a, b) {
                        return a + b;
                    }, 0) / args.length;
                };

                const MAX = function() {
                    return Math.max.apply(null, arguments);
                };

                const MIN = function() {
                    return Math.min.apply(null, arguments);
                };

                const IF = function(cond, t, f) {
                    return cond ? t : f;
                };

                const CONCAT = function() {
                    return Array.prototype.slice.call(arguments).join('');
                };

                // Make functions available in eval scope
                // Note: In production, consider a proper expression parser
                return eval(expression);
            } catch (e) {
                console.error('MathEngine error:', e);
                return '#ERR';
            }
        },

        /**
         * Recalculate all formula columns in the app state.
         *
         * @param {Object} app - The application state object.
         */
        recalcAll: function(app) {
            if (!app || !app.cols || !app.rows) {
                return;
            }

            const self = this;
            app.cols.forEach(function(col, cIdx) {
                if (col.type === 'formula') {
                    app.rows.forEach(function(row) {
                        row[cIdx] = self.evaluate(col.formula, row, app.cols);
                    });
                }
            });
        }
    };

    // Export to window
    window.LiteStatsMathEngine = MathEngine;

})(window);
