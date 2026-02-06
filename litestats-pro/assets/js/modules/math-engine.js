/**
 * LiteStats Pro - Math Engine Module
 *
 * Handles all formula calculations including SUM, AVG, MIN, MAX, IF, CONCAT.
 * Uses a safe expression parser instead of eval() for security.
 *
 * @package LiteStats\Pro
 * @since   5.0.0
 */

/* global liteStatsProAdmin */

(function(window) {
    'use strict';

    /**
     * Safe Expression Parser.
     * Parses and evaluates mathematical expressions without using eval().
     */
    const ExpressionParser = {
        /**
         * Available functions.
         */
        functions: {
            SUM: function() {
                var args = Array.prototype.slice.call(arguments);
                return args.reduce(function(a, b) { return a + (parseFloat(b) || 0); }, 0);
            },
            AVG: function() {
                var args = Array.prototype.slice.call(arguments);
                var sum = args.reduce(function(a, b) { return a + (parseFloat(b) || 0); }, 0);
                return args.length > 0 ? sum / args.length : 0;
            },
            MAX: function() {
                var args = Array.prototype.slice.call(arguments).map(function(v) { return parseFloat(v) || 0; });
                return Math.max.apply(null, args);
            },
            MIN: function() {
                var args = Array.prototype.slice.call(arguments).map(function(v) { return parseFloat(v) || 0; });
                return Math.min.apply(null, args);
            },
            IF: function(cond, trueVal, falseVal) {
                return cond ? trueVal : falseVal;
            },
            CONCAT: function() {
                return Array.prototype.slice.call(arguments).join('');
            },
            ABS: function(val) {
                return Math.abs(parseFloat(val) || 0);
            },
            ROUND: function(val, decimals) {
                var num = parseFloat(val) || 0;
                var dec = parseInt(decimals) || 0;
                return Number(num.toFixed(dec));
            }
        },

        /**
         * Tokenize an expression string.
         * @param {string} expr - The expression to tokenize.
         * @returns {Array} Array of tokens.
         */
        tokenize: function(expr) {
            var tokens = [];
            var current = '';
            var inString = false;
            var stringChar = '';
            var parenDepth = 0;
            
            for (var i = 0; i < expr.length; i++) {
                var char = expr[i];
                
                // Handle strings
                if ((char === '"' || char === "'") && !inString) {
                    inString = true;
                    stringChar = char;
                    current += char;
                    continue;
                }
                
                if (char === stringChar && inString) {
                    inString = false;
                    current += char;
                    continue;
                }
                
                if (inString) {
                    current += char;
                    continue;
                }
                
                // Track parentheses depth
                if (char === '(') parenDepth++;
                if (char === ')') parenDepth--;
                
                // Skip whitespace
                if (char === ' ' && parenDepth === 0) {
                    if (current) {
                        tokens.push(current);
                        current = '';
                    }
                    continue;
                }
                
                // Handle operators at depth 0
                if (parenDepth === 0 && '+-*/><!='.indexOf(char) !== -1) {
                    if (current) {
                        tokens.push(current);
                        current = '';
                    }
                    
                    // Check for multi-char operators
                    var nextChar = expr[i + 1];
                    if ((char === '>' || char === '<' || char === '=' || char === '!') && nextChar === '=') {
                        tokens.push(char + nextChar);
                        i++;
                    } else {
                        tokens.push(char);
                    }
                    continue;
                }
                
                current += char;
            }
            
            if (current) {
                tokens.push(current);
            }
            
            return tokens;
        },

        /**
         * Parse and evaluate a value or function call.
         * @param {string} token - The token to parse.
         * @returns {*} The evaluated value.
         */
        parseValue: function(token) {
            if (token === undefined || token === null) {
                return 0;
            }
            
            token = String(token).trim();
            
            // Handle strings
            if ((token.startsWith('"') && token.endsWith('"')) || 
                (token.startsWith("'") && token.endsWith("'"))) {
                return token.slice(1, -1);
            }
            
            // Handle numbers
            var num = parseFloat(token);
            if (!isNaN(num) && String(num) === token) {
                return num;
            }
            
            // Handle function calls
            var funcMatch = token.match(/^([A-Z]+)\((.+)\)$/);
            if (funcMatch) {
                var funcName = funcMatch[1];
                var argsStr = funcMatch[2];
                
                if (this.functions[funcName]) {
                    var args = this.parseArguments(argsStr);
                    return this.functions[funcName].apply(null, args);
                }
            }
            
            // Handle parentheses
            if (token.startsWith('(') && token.endsWith(')')) {
                return this.evaluate(token.slice(1, -1));
            }
            
            // Return as string if nothing else matches
            return token;
        },

        /**
         * Parse function arguments, handling nested functions.
         * @param {string} argsStr - The arguments string.
         * @returns {Array} Array of parsed argument values.
         */
        parseArguments: function(argsStr) {
            var args = [];
            var current = '';
            var depth = 0;
            var inString = false;
            var stringChar = '';
            
            for (var i = 0; i < argsStr.length; i++) {
                var char = argsStr[i];
                
                // Track strings
                if ((char === '"' || char === "'") && !inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar && inString) {
                    inString = false;
                }
                
                // Track parentheses
                if (!inString && char === '(') depth++;
                if (!inString && char === ')') depth--;
                
                // Split on comma at depth 0
                if (char === ',' && depth === 0 && !inString) {
                    args.push(this.evaluate(current.trim()));
                    current = '';
                } else {
                    current += char;
                }
            }
            
            if (current.trim()) {
                args.push(this.evaluate(current.trim()));
            }
            
            return args;
        },

        /**
         * Evaluate a comparison expression.
         * @param {*} left - Left operand.
         * @param {string} op - Operator.
         * @param {*} right - Right operand.
         * @returns {boolean} Comparison result.
         */
        compare: function(left, op, right) {
            var l = parseFloat(left);
            var r = parseFloat(right);
            var useNumbers = !isNaN(l) && !isNaN(r);
            
            if (useNumbers) {
                left = l;
                right = r;
            }
            
            switch (op) {
                case '>': return left > right;
                case '<': return left < right;
                case '>=': return left >= right;
                case '<=': return left <= right;
                case '==': return left == right;
                case '!=': return left != right;
                default: return false;
            }
        },

        /**
         * Evaluate an expression.
         * @param {string} expr - The expression to evaluate.
         * @returns {*} The result.
         */
        evaluate: function(expr) {
            if (expr === undefined || expr === null) {
                return 0;
            }
            
            expr = String(expr).trim();
            
            // Handle empty expression
            if (!expr) {
                return 0;
            }
            
            // Tokenize
            var tokens = this.tokenize(expr);
            
            if (tokens.length === 0) {
                return 0;
            }
            
            if (tokens.length === 1) {
                return this.parseValue(tokens[0]);
            }
            
            // Handle comparisons first
            var compOps = ['>=', '<=', '!=', '==', '>', '<'];
            for (var c = 0; c < compOps.length; c++) {
                var compIdx = tokens.indexOf(compOps[c]);
                if (compIdx !== -1) {
                    var left = this.evaluate(tokens.slice(0, compIdx).join(' '));
                    var right = this.evaluate(tokens.slice(compIdx + 1).join(' '));
                    return this.compare(left, compOps[c], right);
                }
            }
            
            // Handle addition/subtraction (left to right)
            var result = this.parseValue(tokens[0]);
            for (var i = 1; i < tokens.length; i += 2) {
                var op = tokens[i];
                var val = this.parseValue(tokens[i + 1]);
                
                if (op === '+') {
                    result = (parseFloat(result) || 0) + (parseFloat(val) || 0);
                } else if (op === '-') {
                    result = (parseFloat(result) || 0) - (parseFloat(val) || 0);
                } else if (op === '*') {
                    result = (parseFloat(result) || 0) * (parseFloat(val) || 0);
                } else if (op === '/') {
                    var divisor = parseFloat(val) || 0;
                    result = divisor !== 0 ? (parseFloat(result) || 0) / divisor : '#DIV/0';
                }
            }
            
            return result;
        }
    };

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

            var expression = formula.substring(1); // Remove '='

            // 1. Replace Column IDs {c1} with actual values
            cols.forEach(function(col, idx) {
                var val = row[idx];
                // Preserve strings in quotes, convert numbers
                if (typeof val === 'string' && isNaN(parseFloat(val))) {
                    // Escape backslashes first, then double quotes
                    val = '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
                } else {
                    val = parseFloat(val) || 0;
                }
                var regex = new RegExp('\\{' + col.id + '\\}', 'g');
                expression = expression.replace(regex, val);
            });

            // 2. Evaluate using safe parser
            try {
                return ExpressionParser.evaluate(expression);
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

            var self = this;
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
    window.LiteStatsExpressionParser = ExpressionParser;

})(window);
