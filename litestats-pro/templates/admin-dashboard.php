<?php
/**
 * Admin Dashboard Template.
 *
 * The main editor interface for creating/editing charts.
 *
 * @package LiteStats\Pro
 * @since   5.0.0
 */

declare(strict_types=1);

namespace LiteStats\Pro;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Get chart ID if editing.
$chart_id    = isset( $_GET['chart_id'] ) ? absint( $_GET['chart_id'] ) : 0;
$is_new      = empty( $chart_id );
$page_title  = $is_new ? __( 'Add New Chart', 'litestats-pro' ) : __( 'Edit Chart', 'litestats-pro' );
?>
<div class="wrap litestats-wrap">
    <div class="litestats-top-bar">
        <div class="litestats-brand">
            <i class="fas fa-cube"></i>
            LiteStats <span>PRO v5</span>
        </div>
        <div class="litestats-sc-badge" id="scCode">
            <?php if ( ! $is_new ) : ?>
                [litestats id="<?php echo esc_attr( $chart_id ); ?>"]
            <?php else : ?>
                <?php esc_html_e( 'Save to get shortcode', 'litestats-pro' ); ?>
            <?php endif; ?>
        </div>
        <div class="litestats-actions">
            <a href="<?php echo esc_url( Admin::get_admin_url() ); ?>" class="btn">
                <i class="fas fa-arrow-left"></i>
                <?php esc_html_e( 'Back to List', 'litestats-pro' ); ?>
            </a>
            <button class="btn btn-primary" id="saveChartBtn">
                <i class="fas fa-save"></i>
                <?php esc_html_e( 'Save', 'litestats-pro' ); ?>
            </button>
        </div>
    </div>

    <div class="litestats-main-container">
        <!-- Left Editor Panel -->
        <div class="litestats-editor-panel">
            <!-- Toolbar -->
            <div class="litestats-toolbar">
                <button class="btn btn-sm" id="undoBtn" title="<?php esc_attr_e( 'Undo', 'litestats-pro' ); ?>">
                    <i class="fas fa-undo"></i>
                </button>
                <button class="btn btn-sm" id="redoBtn" title="<?php esc_attr_e( 'Redo', 'litestats-pro' ); ?>">
                    <i class="fas fa-redo"></i>
                </button>
                <div class="divider"></div>

                <button class="btn btn-sm" id="transposeBtn">
                    <i class="fas fa-retweet"></i>
                    <?php esc_html_e( 'Transpose', 'litestats-pro' ); ?>
                </button>
                <button class="btn btn-sm" id="importCsvBtn">
                    <i class="fas fa-file-import"></i>
                    <?php esc_html_e( 'CSV', 'litestats-pro' ); ?>
                </button>
                <button class="btn btn-sm" id="savePresetBtn">
                    <i class="fas fa-bookmark"></i>
                    <?php esc_html_e( 'Preset', 'litestats-pro' ); ?>
                </button>
                <div class="divider"></div>

                <button class="btn btn-sm" id="addRowBtn">
                    <i class="fas fa-plus"></i>
                    <?php esc_html_e( 'Row', 'litestats-pro' ); ?>
                </button>
                <button class="btn btn-sm" id="addColBtn">
                    <i class="fas fa-plus"></i>
                    <?php esc_html_e( 'Col', 'litestats-pro' ); ?>
                </button>
                <button class="btn btn-sm btn-formula" id="addFormulaColBtn">
                    <i class="fas fa-function"></i>
                    <?php esc_html_e( 'Formula', 'litestats-pro' ); ?>
                </button>

                <div class="divider"></div>
                <div class="toggle-group">
                    <button class="t-btn active" id="modeValue" data-mode="value">123</button>
                    <button class="t-btn" id="modePercent" data-mode="percent">%</button>
                </div>
            </div>

            <!-- Formula Bar -->
            <div class="litestats-formula-bar-wrapper">
                <span class="fx-icon">fx</span>
                <input type="text" class="formula-input" id="formulaInput" 
                       placeholder="<?php esc_attr_e( 'Select a column header to edit formula...', 'litestats-pro' ); ?>" 
                       disabled>
                <div class="formula-help">
                    <?php esc_html_e( 'Supported: SUM, AVG, MIN, MAX, IF, CONCAT', 'litestats-pro' ); ?>
                </div>
            </div>

            <!-- Grid Container -->
            <div class="litestats-grid-container">
                <table class="litestats-grid" id="mainGrid">
                    <thead id="gridHead"></thead>
                    <tbody id="gridBody"></tbody>
                </table>
            </div>

            <!-- Status Bar -->
            <div class="litestats-status-bar" id="statusBar">
                <?php esc_html_e( 'Ready', 'litestats-pro' ); ?>
            </div>

            <!-- Hidden CSV Input -->
            <input type="file" id="csvInput" hidden accept=".csv">
        </div>

        <!-- Right Preview Panel -->
        <div class="litestats-preview-panel">
            <!-- Visualization Card -->
            <div class="litestats-card">
                <div class="card-header">
                    <strong><?php esc_html_e( 'Visualization', 'litestats-pro' ); ?></strong>
                    <div class="toggle-group">
                        <button class="t-btn active" id="viewChart" data-view="chart">
                            <?php esc_html_e( 'Chart', 'litestats-pro' ); ?>
                        </button>
                        <button class="t-btn" id="viewTable" data-view="table">
                            <?php esc_html_e( 'Table', 'litestats-pro' ); ?>
                        </button>
                    </div>
                </div>

                <div class="chart-wrapper">
                    <canvas id="liveChart"></canvas>

                    <div id="tablePreviewBox" style="display:none;">
                        <input type="text" class="search-box" id="feSearch" 
                               placeholder="<?php esc_attr_e( 'Search data...', 'litestats-pro' ); ?>">
                        <table class="wp-table" id="feTable">
                            <thead id="feThead"></thead>
                            <tbody id="feTbody"></tbody>
                        </table>
                    </div>
                </div>

                <div class="chart-controls">
                    <select class="btn" id="chartType">
                        <option value="bar"><?php esc_html_e( 'Bar Chart', 'litestats-pro' ); ?></option>
                        <option value="line"><?php esc_html_e( 'Line Chart', 'litestats-pro' ); ?></option>
                        <option value="pie"><?php esc_html_e( 'Pie Chart', 'litestats-pro' ); ?></option>
                        <option value="radar"><?php esc_html_e( 'Radar Chart', 'litestats-pro' ); ?></option>
                        <option value="combo"><?php esc_html_e( 'Combo (Dual)', 'litestats-pro' ); ?></option>
                    </select>
                    <select class="btn" id="themeSelect">
                        <option value="default"><?php esc_html_e( 'WP Default', 'litestats-pro' ); ?></option>
                        <option value="modern"><?php esc_html_e( 'Modern', 'litestats-pro' ); ?></option>
                        <option value="pastel"><?php esc_html_e( 'Pastel', 'litestats-pro' ); ?></option>
                        <option value="dark"><?php esc_html_e( 'Dark Mode', 'litestats-pro' ); ?></option>
                    </select>
                    <button class="btn" id="toggleStackBtn">
                        <i class="fas fa-layer-group"></i>
                        <?php esc_html_e( 'Stack', 'litestats-pro' ); ?>
                    </button>
                </div>

                <div class="chart-export">
                    <button class="btn btn-sm" id="exportPngBtn">
                        <i class="fas fa-download"></i>
                        <?php esc_html_e( 'PNG', 'litestats-pro' ); ?>
                    </button>
                </div>
            </div>

            <!-- Column Formatting Card -->
            <div class="litestats-card">
                <strong><?php esc_html_e( 'Column Formatting', 'litestats-pro' ); ?></strong>
                <div class="col-format-grid">
                    <input class="btn" placeholder="<?php esc_attr_e( 'Prefix ($)', 'litestats-pro' ); ?>" id="colPrefix">
                    <input class="btn" placeholder="<?php esc_attr_e( 'Suffix (kg)', 'litestats-pro' ); ?>" id="colSuffix">
                    <select class="btn" id="colPrecision">
                        <option value="0">1</option>
                        <option value="1">1.0</option>
                        <option value="2">1.00</option>
                    </select>
                </div>
                <small class="format-hint">
                    <?php esc_html_e( 'Select a column header to apply formats.', 'litestats-pro' ); ?>
                </small>
            </div>

            <!-- Chart Title Card -->
            <div class="litestats-card">
                <strong><?php esc_html_e( 'Chart Title', 'litestats-pro' ); ?></strong>
                <input type="text" class="btn chart-title-input" id="chartTitle" 
                       placeholder="<?php esc_attr_e( 'Enter chart title...', 'litestats-pro' ); ?>"
                       value="<?php echo $is_new ? '' : esc_attr( get_the_title( $chart_id ) ); ?>">
            </div>
        </div>
    </div>

    <!-- Toast Notification -->
    <div class="litestats-toast" id="toast"></div>
</div>
