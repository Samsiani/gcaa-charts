/**
 * LiteStats Pro - Conditional Formatting Module
 *
 * Evaluates conditional formatting rules against cell values and returns
 * inline styles for matching cells.
 *
 * Rule structure:
 * { colIdx: number, operator: string, value: number|string, value2: number|string,
 *   style: { bg: string, color: string, bold: boolean } }
 *
 * Operators: '>', '<', '>=', '<=', '==', '!=', 'between', 'contains', 'empty', 'not_empty'
 *
 * @package LiteStats\Pro
 * @since   6.0.0
 */

(function(window) {
    'use strict';

    var ConditionalFormat = {

        /**
         * Evaluate all rules against a cell value and return combined inline style string.
         *
         * @param {*} value - The cell value.
         * @param {number} colIdx - The column index.
         * @param {Array} rules - Array of rule objects.
         * @returns {string} Inline style string or empty.
         */
        getCellStyle: function(value, colIdx, rules) {
            if (!rules || !rules.length) return '';

            var styles = {};

            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                if (parseInt(rule.colIdx, 10) !== colIdx) continue;

                if (this.matches(value, rule)) {
                    if (rule.style) {
                        if (rule.style.bg) styles['background-color'] = rule.style.bg;
                        if (rule.style.color) styles['color'] = rule.style.color;
                        if (rule.style.bold) styles['font-weight'] = 'bold';
                    }
                }
            }

            var parts = [];
            for (var key in styles) {
                if (styles.hasOwnProperty(key)) {
                    parts.push(key + ':' + styles[key]);
                }
            }
            return parts.join(';');
        },

        /**
         * Check if a value matches a rule.
         *
         * @param {*} value - The cell value.
         * @param {Object} rule - The rule object.
         * @returns {boolean}
         */
        matches: function(value, rule) {
            var op = rule.operator;
            var rv = rule.value;
            var rv2 = rule.value2;

            // String operators
            if (op === 'contains') {
                return String(value).toLowerCase().indexOf(String(rv).toLowerCase()) !== -1;
            }
            if (op === 'empty') {
                return value === '' || value === null || value === undefined;
            }
            if (op === 'not_empty') {
                return value !== '' && value !== null && value !== undefined;
            }

            // Numeric comparisons
            var numVal = parseFloat(value);
            var numRv = parseFloat(rv);

            if (isNaN(numVal) || isNaN(numRv)) {
                // Fall back to string comparison for == and !=
                if (op === '==') return String(value) === String(rv);
                if (op === '!=') return String(value) !== String(rv);
                return false;
            }

            switch (op) {
                case '>':  return numVal > numRv;
                case '<':  return numVal < numRv;
                case '>=': return numVal >= numRv;
                case '<=': return numVal <= numRv;
                case '==': return numVal === numRv;
                case '!=': return numVal !== numRv;
                case 'between':
                    var numRv2 = parseFloat(rv2);
                    if (isNaN(numRv2)) return false;
                    return numVal >= numRv && numVal <= numRv2;
                default:
                    return false;
            }
        },

        /**
         * Render a single rule editor row.
         *
         * @param {Object} rule - Rule object.
         * @param {number} ruleIdx - Index of the rule.
         * @param {Array} cols - Column definitions for dropdown.
         * @returns {string} HTML string for the rule row.
         */
        renderRuleRow: function(rule, ruleIdx, cols) {
            var operators = [
                { value: '>', label: '>' },
                { value: '<', label: '<' },
                { value: '>=', label: '>=' },
                { value: '<=', label: '<=' },
                { value: '==', label: '=' },
                { value: '!=', label: '!=' },
                { value: 'between', label: 'Between' },
                { value: 'contains', label: 'Contains' },
                { value: 'empty', label: 'Empty' },
                { value: 'not_empty', label: 'Not Empty' }
            ];

            var html = '<div class="cond-rule-row" data-rule-idx="' + ruleIdx + '">';

            // Column selector
            html += '<select class="cond-col-select" data-field="colIdx">';
            for (var c = 0; c < cols.length; c++) {
                var sel = (parseInt(rule.colIdx, 10) === c) ? ' selected' : '';
                html += '<option value="' + c + '"' + sel + '>' + (cols[c].name || 'Col ' + c) + '</option>';
            }
            html += '</select>';

            // Operator
            html += '<select class="cond-op-select" data-field="operator">';
            for (var o = 0; o < operators.length; o++) {
                var osel = (rule.operator === operators[o].value) ? ' selected' : '';
                html += '<option value="' + operators[o].value + '"' + osel + '>' + operators[o].label + '</option>';
            }
            html += '</select>';

            // Value input
            var needsValue = ['>', '<', '>=', '<=', '==', '!=', 'between', 'contains'].indexOf(rule.operator) !== -1;
            var needsValue2 = rule.operator === 'between';

            html += '<input type="text" class="cond-value-input" data-field="value" value="' + (rule.value || '') + '"' +
                    (needsValue ? '' : ' style="display:none"') + ' placeholder="Value">';
            html += '<input type="text" class="cond-value2-input" data-field="value2" value="' + (rule.value2 || '') + '"' +
                    (needsValue2 ? '' : ' style="display:none"') + ' placeholder="Max">';

            // Style pickers
            html += '<input type="color" class="cond-color-pick" data-field="bg" value="' + (rule.style && rule.style.bg ? rule.style.bg : '#ffff00') + '" title="Background">';
            html += '<input type="color" class="cond-color-pick" data-field="color" value="' + (rule.style && rule.style.color ? rule.style.color : '#000000') + '" title="Text color">';
            html += '<label class="cond-bold-label"><input type="checkbox" class="cond-bold-check" data-field="bold"' +
                    (rule.style && rule.style.bold ? ' checked' : '') + '> <strong>B</strong></label>';

            // Delete
            html += '<button class="btn btn-sm cond-delete-rule" data-rule-idx="' + ruleIdx + '" title="Remove">&times;</button>';

            html += '</div>';
            return html;
        }
    };

    window.LiteStatsConditionalFormat = ConditionalFormat;

})(window);
