/**
 * LiteStats Pro - CSV Import Wizard Module
 *
 * 3-step modal wizard for importing CSV files with delimiter auto-detection,
 * column type mapping, and preview.
 *
 * @package LiteStats\Pro
 * @since   6.0.0
 */

(function(window) {
    'use strict';

    var CsvWizard = {
        /**
         * Current wizard step (1, 2, or 3).
         */
        currentStep: 1,

        /**
         * Parsed CSV data.
         */
        rawLines: [],
        detectedDelimiter: ',',
        parsedRows: [],
        columnTypes: [],
        firstRowIsHeader: true,
        callback: null,

        /**
         * Open the CSV wizard modal.
         *
         * @param {Function} cb - Callback receiving { cols, rows } on import.
         */
        open: function(cb) {
            this.callback = cb;
            this.currentStep = 1;
            this.rawLines = [];
            this.parsedRows = [];
            this.columnTypes = [];

            var modal = document.getElementById('csvWizardModal');
            if (modal) {
                modal.style.display = 'flex';
            }

            this.updateStepUI();
            this.bindEvents();
        },

        /**
         * Close the wizard modal.
         */
        close: function() {
            var modal = document.getElementById('csvWizardModal');
            if (modal) {
                modal.style.display = 'none';
            }
            // Reset file input
            var fileInput = document.getElementById('csvWizardFile');
            if (fileInput) fileInput.value = '';
        },

        /**
         * Bind wizard event handlers.
         */
        bindEvents: function() {
            var self = this;

            // Close button
            var closeBtn = document.getElementById('csvWizardClose');
            if (closeBtn) {
                closeBtn.onclick = function() { self.close(); };
            }

            // Overlay click
            var overlay = document.getElementById('csvWizardModal');
            if (overlay) {
                overlay.onclick = function(e) {
                    if (e.target === overlay) self.close();
                };
            }

            // Browse button
            var browseBtn = document.getElementById('csvWizardBrowse');
            if (browseBtn) {
                browseBtn.onclick = function() {
                    document.getElementById('csvWizardFile').click();
                };
            }

            // File input change
            var fileInput = document.getElementById('csvWizardFile');
            if (fileInput) {
                fileInput.onchange = function(e) {
                    if (e.target.files[0]) {
                        self.readFile(e.target.files[0]);
                    }
                };
            }

            // Drag & drop on dropzone
            var dropzone = document.getElementById('csvDropzone');
            if (dropzone) {
                dropzone.ondragover = function(e) {
                    e.preventDefault();
                    dropzone.classList.add('dragover');
                };
                dropzone.ondragleave = function() {
                    dropzone.classList.remove('dragover');
                };
                dropzone.ondrop = function(e) {
                    e.preventDefault();
                    dropzone.classList.remove('dragover');
                    if (e.dataTransfer.files[0]) {
                        self.readFile(e.dataTransfer.files[0]);
                    }
                };
                dropzone.onclick = function(e) {
                    if (e.target === dropzone || e.target.tagName === 'P' || e.target.tagName === 'I') {
                        document.getElementById('csvWizardFile').click();
                    }
                };
            }

            // Next button
            var nextBtn = document.getElementById('csvWizardNext');
            if (nextBtn) {
                nextBtn.onclick = function() { self.nextStep(); };
            }

            // Prev button
            var prevBtn = document.getElementById('csvWizardPrev');
            if (prevBtn) {
                prevBtn.onclick = function() { self.prevStep(); };
            }

            // First row header checkbox
            var headerCb = document.getElementById('csvFirstRowHeader');
            if (headerCb) {
                headerCb.onchange = function() {
                    self.firstRowIsHeader = this.checked;
                    self.renderPreview();
                };
            }
        },

        /**
         * Read uploaded file.
         */
        readFile: function(file) {
            var self = this;
            var reader = new FileReader();

            reader.onload = function(evt) {
                var text = evt.target.result;
                self.rawLines = text.split('\n').filter(function(l) { return l.trim().length > 0; });
                self.detectedDelimiter = self.detectDelimiter(self.rawLines[0] || '');
                self.parsedRows = self.rawLines.map(function(line) {
                    return self.parseLine(line, self.detectedDelimiter);
                });

                // Auto-detect column types
                self.autoDetectTypes();

                // Move to step 2
                self.currentStep = 2;
                self.updateStepUI();
                self.renderPreview();
            };

            reader.readAsText(file);
        },

        /**
         * Auto-detect delimiter (comma, semicolon, tab).
         */
        detectDelimiter: function(line) {
            var counts = {
                ',': (line.match(/,/g) || []).length,
                ';': (line.match(/;/g) || []).length,
                '\t': (line.match(/\t/g) || []).length
            };

            var max = ',';
            if (counts[';'] > counts[max]) max = ';';
            if (counts['\t'] > counts[max]) max = '\t';
            return max;
        },

        /**
         * Parse a single CSV line, respecting quoted fields.
         */
        parseLine: function(line, delimiter) {
            var result = [];
            var current = '';
            var inQuotes = false;

            for (var i = 0; i < line.length; i++) {
                var ch = line[i];
                if (inQuotes) {
                    if (ch === '"' && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else if (ch === '"') {
                        inQuotes = false;
                    } else {
                        current += ch;
                    }
                } else {
                    if (ch === '"') {
                        inQuotes = true;
                    } else if (ch === delimiter) {
                        result.push(current.trim());
                        current = '';
                    } else {
                        current += ch;
                    }
                }
            }
            result.push(current.trim());
            return result;
        },

        /**
         * Auto-detect types for each column from sample data.
         */
        autoDetectTypes: function() {
            if (!this.parsedRows.length) return;

            var startRow = this.firstRowIsHeader ? 1 : 0;
            var colCount = this.parsedRows[0].length;
            this.columnTypes = [];

            for (var c = 0; c < colCount; c++) {
                var type = this.inferType(c, startRow);
                this.columnTypes.push(type);
            }
        },

        /**
         * Infer column type from sample values.
         */
        inferType: function(colIdx, startRow) {
            var samples = [];
            var maxSamples = Math.min(this.parsedRows.length, startRow + 20);

            for (var r = startRow; r < maxSamples; r++) {
                var val = (this.parsedRows[r] && this.parsedRows[r][colIdx]) || '';
                if (val !== '') samples.push(val);
            }

            if (!samples.length) return 'string';

            // Check if date
            var dateCount = 0;
            var numCount = 0;
            var currencyCount = 0;
            var percentCount = 0;

            samples.forEach(function(s) {
                // Date patterns
                if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(s)) {
                    dateCount++;
                }
                // Currency
                if (/^[$\u20AC\u00A3]\s*[\d,]+(\.\d+)?$/.test(s) || /^[\d,]+(\.\d+)?\s*[$\u20AC\u00A3]$/.test(s)) {
                    currencyCount++;
                }
                // Percentage
                if (/^[\d.,]+\s*%$/.test(s)) {
                    percentCount++;
                }
                // Number
                var cleaned = s.replace(/[$,\u20AC\u00A3%\s]/g, '');
                if (!isNaN(parseFloat(cleaned)) && isFinite(cleaned)) {
                    numCount++;
                }
            });

            var threshold = samples.length * 0.7;

            if (dateCount >= threshold) return 'date';
            if (currencyCount >= threshold) return 'currency';
            if (percentCount >= threshold) return 'percentage';
            if (numCount >= threshold) return 'number';
            return 'string';
        },

        /**
         * Render the preview table in step 2.
         */
        renderPreview: function() {
            var thead = document.getElementById('csvPreviewHead');
            var tbody = document.getElementById('csvPreviewBody');
            if (!thead || !tbody) return;

            var colCount = this.parsedRows[0] ? this.parsedRows[0].length : 0;
            var typeOptions = ['string', 'number', 'date', 'currency', 'percentage', 'skip'];
            var typeLabels = { string: 'ABC', number: '123', date: 'Date', currency: '$', percentage: '%', skip: 'Skip' };

            // Header with type selectors
            var hHtml = '<tr>';
            for (var c = 0; c < colCount; c++) {
                var headerName = this.firstRowIsHeader ? (this.parsedRows[0][c] || 'Col ' + (c + 1)) : 'Col ' + (c + 1);
                hHtml += '<th><div class="csv-col-header">';
                hHtml += '<span>' + this.escapeHtml(headerName) + '</span>';
                hHtml += '<select class="csv-type-select" data-col="' + c + '">';
                for (var t = 0; t < typeOptions.length; t++) {
                    var sel = (this.columnTypes[c] === typeOptions[t]) ? ' selected' : '';
                    hHtml += '<option value="' + typeOptions[t] + '"' + sel + '>' + typeLabels[typeOptions[t]] + '</option>';
                }
                hHtml += '</select></div></th>';
            }
            thead.innerHTML = hHtml + '</tr>';

            // Data rows (first 10)
            var startRow = this.firstRowIsHeader ? 1 : 0;
            var maxRows = Math.min(this.parsedRows.length, startRow + 10);
            var bHtml = '';
            for (var r = startRow; r < maxRows; r++) {
                bHtml += '<tr>';
                for (var ci = 0; ci < colCount; ci++) {
                    bHtml += '<td>' + this.escapeHtml(this.parsedRows[r][ci] || '') + '</td>';
                }
                bHtml += '</tr>';
            }
            tbody.innerHTML = bHtml;

            // Bind type select changes
            var self = this;
            document.querySelectorAll('.csv-type-select').forEach(function(sel) {
                sel.onchange = function() {
                    self.columnTypes[parseInt(this.dataset.col, 10)] = this.value;
                };
            });
        },

        /**
         * Build summary for step 3.
         */
        renderSummary: function() {
            var summary = document.getElementById('csvSummary');
            if (!summary) return;

            var startRow = this.firstRowIsHeader ? 1 : 0;
            var dataRows = this.parsedRows.length - startRow;
            var activeCols = this.columnTypes.filter(function(t) { return t !== 'skip'; }).length;

            var html = '<p><strong>Columns:</strong> ' + activeCols + '</p>';
            html += '<p><strong>Data rows:</strong> ' + dataRows + '</p>';
            html += '<p><strong>Delimiter:</strong> ' + (this.detectedDelimiter === '\t' ? 'Tab' : this.detectedDelimiter === ';' ? 'Semicolon' : 'Comma') + '</p>';
            html += '<p><strong>Column types:</strong></p><ul>';

            var colCount = this.parsedRows[0] ? this.parsedRows[0].length : 0;
            for (var c = 0; c < colCount; c++) {
                if (this.columnTypes[c] === 'skip') continue;
                var name = this.firstRowIsHeader ? (this.parsedRows[0][c] || 'Col ' + (c + 1)) : 'Col ' + (c + 1);
                html += '<li>' + this.escapeHtml(name) + ' &mdash; ' + this.columnTypes[c] + '</li>';
            }
            html += '</ul>';

            summary.innerHTML = html;
        },

        /**
         * Go to next step.
         */
        nextStep: function() {
            if (this.currentStep === 1) {
                // Must have data
                if (!this.parsedRows.length) return;
                this.currentStep = 2;
                this.renderPreview();
            } else if (this.currentStep === 2) {
                this.currentStep = 3;
                this.renderSummary();
            } else if (this.currentStep === 3) {
                // Import
                this.doImport();
                this.close();
                return;
            }
            this.updateStepUI();
        },

        /**
         * Go to previous step.
         */
        prevStep: function() {
            if (this.currentStep > 1) {
                this.currentStep--;
                this.updateStepUI();
            }
        },

        /**
         * Update step UI (show/hide panels, update step indicators).
         */
        updateStepUI: function() {
            // Step indicators
            document.querySelectorAll('.litestats-modal-steps .step').forEach(function(el) {
                el.classList.remove('active', 'done');
            });
            document.querySelectorAll('.litestats-modal-steps .step').forEach(function(el) {
                var s = parseInt(el.dataset.step, 10);
                if (s === this.currentStep) el.classList.add('active');
                if (s < this.currentStep) el.classList.add('done');
            }.bind(this));

            // Step content
            for (var i = 1; i <= 3; i++) {
                var el = document.getElementById('wizardStep' + i);
                if (el) el.style.display = (i === this.currentStep) ? '' : 'none';
            }

            // Prev button
            var prevBtn = document.getElementById('csvWizardPrev');
            if (prevBtn) prevBtn.style.display = this.currentStep > 1 ? '' : 'none';

            // Next button text
            var nextBtn = document.getElementById('csvWizardNext');
            if (nextBtn) {
                nextBtn.textContent = this.currentStep === 3 ? 'Import' : 'Next';
            }
        },

        /**
         * Execute the import — build cols/rows and invoke callback.
         */
        doImport: function() {
            if (!this.callback) return;

            var colCount = this.parsedRows[0] ? this.parsedRows[0].length : 0;
            var startRow = this.firstRowIsHeader ? 1 : 0;

            // Build column map (skip excluded columns)
            var colMap = [];
            var cols = [];
            for (var c = 0; c < colCount; c++) {
                if (this.columnTypes[c] === 'skip') continue;

                var name = this.firstRowIsHeader ? (this.parsedRows[0][c] || 'Col ' + (c + 1)) : 'Col ' + (c + 1);
                var type = this.columnTypes[c];

                cols.push({
                    id: 'c' + Date.now() + c,
                    name: name,
                    type: type,
                    width: 120,
                    props: type === 'currency' ? { prefix: '$' } : (type === 'percentage' ? { suffix: '%' } : {})
                });
                colMap.push(c);
            }

            // Build rows
            var rows = [];
            for (var r = startRow; r < this.parsedRows.length; r++) {
                var row = [];
                for (var ci = 0; ci < colMap.length; ci++) {
                    var val = this.parsedRows[r][colMap[ci]] || '';
                    var colType = cols[ci].type;

                    // Coerce values
                    if (colType === 'number') {
                        var cleaned = val.replace(/[,\s]/g, '');
                        row.push(isNaN(parseFloat(cleaned)) ? 0 : parseFloat(cleaned));
                    } else if (colType === 'currency') {
                        var cleaned2 = val.replace(/[$\u20AC\u00A3,\s]/g, '');
                        row.push(isNaN(parseFloat(cleaned2)) ? 0 : parseFloat(cleaned2));
                    } else if (colType === 'percentage') {
                        var cleaned3 = val.replace(/[%,\s]/g, '');
                        row.push(isNaN(parseFloat(cleaned3)) ? 0 : parseFloat(cleaned3));
                    } else {
                        row.push(val);
                    }
                }
                rows.push(row);
            }

            this.callback({ cols: cols, rows: rows });
        },

        escapeHtml: function(str) {
            if (typeof str !== 'string') return str;
            var div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    };

    window.LiteStatsCsvWizard = CsvWizard;

})(window);
