/**
 * LiteStats Pro - State Module
 *
 * Handles history management for undo/redo functionality.
 * Extracted from index.html prototype.
 *
 * @package LiteStats\Pro
 * @since   5.0.0
 */

(function(window) {
    'use strict';

    /**
     * State Manager for handling undo/redo history.
     */
    const StateManager = {
        /**
         * Undo stack.
         * @type {Array}
         */
        undoStack: [],

        /**
         * Redo stack.
         * @type {Array}
         */
        redoStack: [],

        /**
         * Maximum history length.
         * @type {number}
         */
        MAX_HISTORY: 30,

        /**
         * Save current state to history.
         *
         * @param {Object} app - The application state object.
         */
        saveState: function(app) {
            if (!app) {
                return;
            }

            if (this.undoStack.length >= this.MAX_HISTORY) {
                this.undoStack.shift();
            }

            this.undoStack.push(JSON.stringify({
                cols: app.cols,
                rows: app.rows
            }));

            // Clear redo on new action
            this.redoStack = [];
        },

        /**
         * Undo last action.
         *
         * @param {Object} app - The application state object.
         * @param {Function} callback - Callback function after undo.
         * @returns {boolean} True if undo was successful.
         */
        undo: function(app, callback) {
            if (this.undoStack.length === 0) {
                return false;
            }

            // Save current state to redo
            this.redoStack.push(JSON.stringify({
                cols: app.cols,
                rows: app.rows
            }));

            // Restore previous state
            const prev = JSON.parse(this.undoStack.pop());
            app.cols = prev.cols;
            app.rows = prev.rows;

            if (typeof callback === 'function') {
                callback();
            }

            return true;
        },

        /**
         * Redo last undone action.
         *
         * @param {Object} app - The application state object.
         * @param {Function} callback - Callback function after redo.
         * @returns {boolean} True if redo was successful.
         */
        redo: function(app, callback) {
            if (this.redoStack.length === 0) {
                return false;
            }

            // Save current to undo (without clearing redo)
            this.undoStack.push(JSON.stringify({
                cols: app.cols,
                rows: app.rows
            }));

            // Restore next state
            const next = JSON.parse(this.redoStack.pop());
            app.cols = next.cols;
            app.rows = next.rows;

            if (typeof callback === 'function') {
                callback();
            }

            return true;
        },

        /**
         * Get history info.
         *
         * @returns {Object} History information.
         */
        getHistoryInfo: function() {
            return {
                undoCount: this.undoStack.length,
                redoCount: this.redoStack.length,
                maxHistory: this.MAX_HISTORY
            };
        },

        /**
         * Clear all history.
         */
        clearHistory: function() {
            this.undoStack = [];
            this.redoStack = [];
        }
    };

    // Export to window
    window.LiteStatsState = StateManager;

})(window);
