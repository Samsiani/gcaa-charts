/**
 * LiteStats Pro - Math Engine Module
 *
 * Excel-style formula engine.
 * Columns are addressed by letters (A, B, C...), rows by numbers (1, 2, 3...).
 * Cell references: A1, B3. Column references: A, B (whole column for current row).
 * Supports: SUM, AVG, MIN, MAX, IF, CONCAT, ABS, ROUND, COUNT.
 * Operators: + - * / > < >= <= == != %
 *
 * @package LiteStats\Pro
 * @since   5.1.0
 */

(function(window) {
    'use strict';

    /**
     * Convert column index (0-based) to Excel letter(s): 0→A, 1→B, 25→Z, 26→AA
     */
    function colToLetter(idx) {
        var s = '';
        idx++;
        while (idx > 0) {
            idx--;
            s = String.fromCharCode(65 + (idx % 26)) + s;
            idx = Math.floor(idx / 26);
        }
        return s;
    }

    /**
     * Convert Excel letter(s) to column index (0-based): A→0, B→1, Z→25, AA→26
     */
    function letterToCol(letters) {
        var n = 0;
        for (var i = 0; i < letters.length; i++) {
            n = n * 26 + (letters.charCodeAt(i) - 64);
        }
        return n - 1;
    }

    // Expose helpers
    window.LiteStatsColToLetter = colToLetter;
    window.LiteStatsLetterToCol = letterToCol;

    /**
     * Built-in functions.
     */
    var FUNCTIONS = {
        SUM: function(args) {
            return args.reduce(function(a, b) { return a + (parseFloat(b) || 0); }, 0);
        },
        AVG: function(args) {
            var sum = args.reduce(function(a, b) { return a + (parseFloat(b) || 0); }, 0);
            return args.length > 0 ? sum / args.length : 0;
        },
        MAX: function(args) {
            var nums = args.map(function(v) { return parseFloat(v) || 0; });
            return Math.max.apply(null, nums);
        },
        MIN: function(args) {
            var nums = args.map(function(v) { return parseFloat(v) || 0; });
            return Math.min.apply(null, nums);
        },
        COUNT: function(args) {
            return args.filter(function(v) { return v !== '' && v !== null && v !== undefined; }).length;
        },
        ABS: function(args) {
            return Math.abs(parseFloat(args[0]) || 0);
        },
        ROUND: function(args) {
            var num = parseFloat(args[0]) || 0;
            var dec = parseInt(args[1]) || 0;
            return Number(num.toFixed(dec));
        },
        IF: function(args) {
            return args[0] ? args[1] : args[2];
        },
        CONCAT: function(args) {
            return args.join('');
        }
    };

    /**
     * Tokenize a formula expression into tokens.
     */
    function tokenize(expr) {
        var tokens = [];
        var i = 0;
        var len = expr.length;

        while (i < len) {
            var ch = expr[i];

            // Skip whitespace
            if (ch === ' ' || ch === '\t') { i++; continue; }

            // String literals
            if (ch === '"' || ch === "'") {
                var quote = ch;
                var str = '';
                i++;
                while (i < len && expr[i] !== quote) {
                    if (expr[i] === '\\') { i++; str += expr[i] || ''; }
                    else { str += expr[i]; }
                    i++;
                }
                i++; // skip closing quote
                tokens.push({ type: 'string', value: str });
                continue;
            }

            // Numbers (including decimals)
            if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < len && expr[i + 1] >= '0' && expr[i + 1] <= '9')) {
                var num = '';
                while (i < len && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
                    num += expr[i]; i++;
                }
                tokens.push({ type: 'number', value: parseFloat(num) });
                continue;
            }

            // Multi-char operators
            if (i + 1 < len) {
                var two = ch + expr[i + 1];
                if (two === '>=' || two === '<=' || two === '==' || two === '!=') {
                    tokens.push({ type: 'op', value: two });
                    i += 2; continue;
                }
            }

            // Single-char operators
            if ('+-*/><(),%'.indexOf(ch) !== -1) {
                tokens.push({ type: 'op', value: ch });
                i++; continue;
            }

            // Identifiers: function names or cell/column refs (e.g. SUM, A, B2, AA1)
            if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_') {
                var id = '';
                while (i < len && ((expr[i] >= 'A' && expr[i] <= 'Z') || (expr[i] >= 'a' && expr[i] <= 'z') || (expr[i] >= '0' && expr[i] <= '9') || expr[i] === '_')) {
                    id += expr[i]; i++;
                }
                tokens.push({ type: 'ident', value: id });
                continue;
            }

            // Unknown char — skip
            i++;
        }
        return tokens;
    }

    /**
     * Parser — recursive descent.
     * Produces an AST from tokens.
     */
    function Parser(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    Parser.prototype.peek = function() {
        return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
    };

    Parser.prototype.consume = function() {
        return this.tokens[this.pos++];
    };

    Parser.prototype.expect = function(type, value) {
        var t = this.consume();
        if (!t || t.type !== type || (value !== undefined && t.value !== value)) {
            throw new Error('Expected ' + type + ' ' + (value || ''));
        }
        return t;
    };

    // Expression: comparison
    Parser.prototype.parseExpression = function() {
        var left = this.parseAddSub();
        var t = this.peek();
        if (t && t.type === 'op' && (t.value === '>' || t.value === '<' || t.value === '>=' || t.value === '<=' || t.value === '==' || t.value === '!=')) {
            var op = this.consume().value;
            var right = this.parseAddSub();
            return { type: 'binop', op: op, left: left, right: right };
        }
        return left;
    };

    // Addition / Subtraction
    Parser.prototype.parseAddSub = function() {
        var node = this.parseMulDiv();
        while (true) {
            var t = this.peek();
            if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
                var op = this.consume().value;
                var right = this.parseMulDiv();
                node = { type: 'binop', op: op, left: node, right: right };
            } else {
                break;
            }
        }
        return node;
    };

    // Multiplication / Division
    Parser.prototype.parseMulDiv = function() {
        var node = this.parseUnary();
        while (true) {
            var t = this.peek();
            if (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
                var op = this.consume().value;
                var right = this.parseUnary();
                node = { type: 'binop', op: op, left: node, right: right };
            } else {
                break;
            }
        }
        return node;
    };

    // Unary minus / plus
    Parser.prototype.parseUnary = function() {
        var t = this.peek();
        if (t && t.type === 'op' && (t.value === '-' || t.value === '+')) {
            var op = this.consume().value;
            var operand = this.parsePostfix();
            if (op === '-') {
                return { type: 'binop', op: '*', left: { type: 'number', value: -1 }, right: operand };
            }
            return operand;
        }
        return this.parsePostfix();
    };

    // Postfix: percent operator (e.g. 5%)
    Parser.prototype.parsePostfix = function() {
        var node = this.parsePrimary();
        var t = this.peek();
        if (t && t.type === 'op' && t.value === '%') {
            this.consume();
            return { type: 'binop', op: '*', left: node, right: { type: 'number', value: 0.01 } };
        }
        return node;
    };

    // Primary: number, string, ref, function call, parenthesized expression
    Parser.prototype.parsePrimary = function() {
        var t = this.peek();
        if (!t) throw new Error('Unexpected end of expression');

        // Number
        if (t.type === 'number') {
            this.consume();
            return { type: 'number', value: t.value };
        }

        // String
        if (t.type === 'string') {
            this.consume();
            return { type: 'string', value: t.value };
        }

        // Parenthesized expression
        if (t.type === 'op' && t.value === '(') {
            this.consume();
            var expr = this.parseExpression();
            this.expect('op', ')');
            return expr;
        }

        // Identifier: function call or cell/column reference
        if (t.type === 'ident') {
            this.consume();
            var name = t.value.toUpperCase();

            // Function call?
            var next = this.peek();
            if (next && next.type === 'op' && next.value === '(') {
                this.consume(); // skip (
                var args = [];
                if (!(this.peek() && this.peek().type === 'op' && this.peek().value === ')')) {
                    args.push(this.parseExpression());
                    while (this.peek() && this.peek().type === 'op' && this.peek().value === ',') {
                        this.consume(); // skip ,
                        args.push(this.parseExpression());
                    }
                }
                this.expect('op', ')');
                return { type: 'call', name: name, args: args };
            }

            // Cell or column reference
            // Pure letters = column ref (A, B, AA), letters+digits = cell ref (A1, B3)
            var match = name.match(/^([A-Z]+)(\d+)?$/);
            if (match) {
                if (match[2]) {
                    // Cell reference: A1 → col=0, row=0
                    return { type: 'cellref', col: letterToCol(match[1]), row: parseInt(match[2]) - 1 };
                } else {
                    // Column reference: A → col=0, same row
                    return { type: 'colref', col: letterToCol(match[1]) };
                }
            }

            throw new Error('Unknown identifier: ' + name);
        }

        throw new Error('Unexpected token: ' + (t.value || t.type));
    };

    /**
     * Evaluate an AST node.
     * @param {Object} node - AST node.
     * @param {Object} ctx - { rows, cols, rowIdx }
     */
    function evalNode(node, ctx) {
        switch (node.type) {
            case 'number': return node.value;
            case 'string': return node.value;

            case 'colref': {
                // Reference to the same row, given column
                var val = ctx.rows[ctx.rowIdx][node.col];
                return (val === '' || val === undefined || val === null) ? 0 : (isNaN(parseFloat(val)) ? val : parseFloat(val));
            }

            case 'cellref': {
                // Reference to specific row and column
                if (node.row < 0 || node.row >= ctx.rows.length) return 0;
                var v = ctx.rows[node.row][node.col];
                return (v === '' || v === undefined || v === null) ? 0 : (isNaN(parseFloat(v)) ? v : parseFloat(v));
            }

            case 'binop': {
                var left = evalNode(node.left, ctx);
                var right = evalNode(node.right, ctx);
                var l = parseFloat(left) || 0;
                var r = parseFloat(right) || 0;

                switch (node.op) {
                    case '+': return l + r;
                    case '-': return l - r;
                    case '*': return l * r;
                    case '/': return r !== 0 ? l / r : '#DIV/0';
                    case '>': return l > r;
                    case '<': return l < r;
                    case '>=': return l >= r;
                    case '<=': return l <= r;
                    case '==': return left == right;
                    case '!=': return left != right;
                    default: return 0;
                }
            }

            case 'call': {
                var fn = FUNCTIONS[node.name];
                if (!fn) throw new Error('Unknown function: ' + node.name);

                // For SUM/AVG/MIN/MAX/COUNT with a single column ref arg, expand to all rows
                if (node.args.length === 1 && node.args[0].type === 'colref' &&
                    (node.name === 'SUM' || node.name === 'AVG' || node.name === 'MIN' || node.name === 'MAX' || node.name === 'COUNT')) {
                    var cIdx = node.args[0].col;
                    var vals = ctx.rows.map(function(row) {
                        var v = row[cIdx];
                        return (v === '' || v === undefined || v === null) ? 0 : (parseFloat(v) || 0);
                    });
                    return fn(vals);
                }

                // For range notation like SUM(B1:B5) — not implemented yet, but could be added
                var argVals = node.args.map(function(a) { return evalNode(a, ctx); });
                return fn(argVals);
            }

            default:
                return 0;
        }
    }

    /**
     * Math Engine — public API.
     */
    var MathEngine = {
        /**
         * Evaluate a formula for a specific row.
         *
         * @param {string} formula - e.g. "=A+B", "=A*B*5%", "=SUM(B)"
         * @param {number} rowIdx - current row index (0-based)
         * @param {Array} rows - all rows data
         * @param {Array} cols - column definitions
         * @returns {*} result or "#ERR"
         */
        evaluate: function(formula, rowIdx, rows, cols) {
            if (!formula || typeof formula !== 'string' || formula.charAt(0) !== '=') {
                return formula;
            }

            var expression = formula.substring(1).trim();
            if (!expression) return 0;

            try {
                var tokens = tokenize(expression);
                var parser = new Parser(tokens);
                var ast = parser.parseExpression();
                return evalNode(ast, { rows: rows, cols: cols, rowIdx: rowIdx });
            } catch (e) {
                console.error('MathEngine error:', formula, e.message);
                return '#ERR';
            }
        },

        /**
         * Recalculate all formula columns.
         * Runs multiple passes to resolve inter-column dependencies.
         *
         * @param {Object} app - { cols, rows }
         */
        recalcAll: function(app) {
            if (!app || !app.cols || !app.rows) return;

            var self = this;

            // Build dependency order: detect which columns each formula references.
            var formulaCols = [];
            app.cols.forEach(function(col, cIdx) {
                if (col.type === 'formula' && col.formula) {
                    formulaCols.push(cIdx);
                }
            });

            // Two passes to handle dependencies between formula columns.
            // Skip columns that reference themselves (would cause infinite recursion).
            for (var pass = 0; pass < 2; pass++) {
                formulaCols.forEach(function(cIdx) {
                    var col = app.cols[cIdx];
                    var letter = colToLetter(cIdx);
                    // Guard: skip self-referential formulas.
                    var formulaUpper = col.formula.toUpperCase();
                    if (formulaUpper.indexOf(letter) !== -1) {
                        // Check if it's actually referencing this column (not just a substring).
                        var selfRef = new RegExp('\\b' + letter + '(?:\\d+|\\b)', 'i');
                        if (selfRef.test(col.formula.substring(1))) {
                            app.rows.forEach(function(row) { row[cIdx] = '#REF'; });
                            return;
                        }
                    }
                    app.rows.forEach(function(row, rIdx) {
                        row[cIdx] = self.evaluate(col.formula, rIdx, app.rows, app.cols);
                    });
                });
            }
        },

        // Expose helpers for other modules
        colToLetter: colToLetter,
        letterToCol: letterToCol
    };

    window.LiteStatsMathEngine = MathEngine;

})(window);
