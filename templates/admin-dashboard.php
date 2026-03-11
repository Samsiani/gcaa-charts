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
$chart_id   = isset( $_GET['chart_id'] ) ? absint( $_GET['chart_id'] ) : 0;
$is_new     = empty( $chart_id );
$chart_title = '';

if ( ! $is_new ) {
    $data_handler = LiteStatsPro::get_instance()->get_data_handler();
    $chart_data   = $data_handler ? $data_handler->get_chart( $chart_id ) : null;
    $chart_title  = $chart_data ? $chart_data['title'] : '';
}
?>
<div class="wrap litestats-wrap">
    <div class="litestats-top-bar">
        <div class="litestats-brand">
            <i class="fas fa-cube"></i>
            LiteStats <span>PRO v6</span>
        </div>
        <div class="litestats-sc-badges" id="scCode">
            <?php if ( ! $is_new ) : ?>
                <span class="litestats-sc-badge" data-sc='[litestats id="<?php echo esc_attr( $chart_id ); ?>" view="chart"]' title="<?php esc_attr_e( 'Click to copy', 'litestats-pro' ); ?>">
                    <i class="fas fa-chart-bar"></i> [litestats id="<?php echo esc_attr( $chart_id ); ?>" view="chart"]
                </span>
                <span class="litestats-sc-badge" data-sc='[litestats id="<?php echo esc_attr( $chart_id ); ?>" view="table"]' title="<?php esc_attr_e( 'Click to copy', 'litestats-pro' ); ?>">
                    <i class="fas fa-table"></i> [litestats id="<?php echo esc_attr( $chart_id ); ?>" view="table"]
                </span>
            <?php else : ?>
                <span class="litestats-sc-badge litestats-sc-badge--placeholder">
                    <?php esc_html_e( 'Save to get shortcodes', 'litestats-pro' ); ?>
                </span>
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
                <button class="btn btn-sm" id="undoBtn" title="<?php esc_attr_e( 'Undo (Ctrl+Z)', 'litestats-pro' ); ?>">
                    <i class="fas fa-undo"></i>
                </button>
                <button class="btn btn-sm" id="redoBtn" title="<?php esc_attr_e( 'Redo (Ctrl+Y)', 'litestats-pro' ); ?>">
                    <i class="fas fa-redo"></i>
                </button>
                <div class="divider"></div>

                <button class="btn btn-sm" id="transposeBtn">
                    <i class="fas fa-retweet"></i>
                    <?php esc_html_e( 'Transpose', 'litestats-pro' ); ?>
                </button>
                <button class="btn btn-sm" id="importCsvBtn">
                    <i class="fas fa-file-import"></i>
                    <?php esc_html_e( 'CSV Import', 'litestats-pro' ); ?>
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

                <!-- Add Column dropdown -->
                <div class="litestats-dropdown" id="addColDropdown">
                    <button class="btn btn-sm" id="addColBtn">
                        <i class="fas fa-plus"></i>
                        <?php esc_html_e( 'Column', 'litestats-pro' ); ?>
                        <i class="fas fa-caret-down" style="font-size:10px;margin-left:2px"></i>
                    </button>
                    <div class="litestats-dropdown-menu" id="addColMenu">
                        <a href="#" data-type="string"><i class="fas fa-font"></i> <?php esc_html_e( 'Text (ABC)', 'litestats-pro' ); ?></a>
                        <a href="#" data-type="number"><i class="fas fa-hashtag"></i> <?php esc_html_e( 'Number (123)', 'litestats-pro' ); ?></a>
                        <a href="#" data-type="date"><i class="fas fa-calendar"></i> <?php esc_html_e( 'Date', 'litestats-pro' ); ?></a>
                        <a href="#" data-type="currency"><i class="fas fa-dollar-sign"></i> <?php esc_html_e( 'Currency ($)', 'litestats-pro' ); ?></a>
                        <a href="#" data-type="percentage"><i class="fas fa-percent"></i> <?php esc_html_e( 'Percentage (%)', 'litestats-pro' ); ?></a>
                        <a href="#" data-type="formula"><i class="fas fa-function"></i> <?php esc_html_e( 'Formula', 'litestats-pro' ); ?></a>
                    </div>
                </div>
            </div>

            <!-- Formula Bar -->
            <div class="litestats-formula-bar-wrapper">
                <span class="fx-icon">fx</span>
                <input type="text" class="formula-input" id="formulaInput"
                       placeholder="<?php esc_attr_e( 'e.g. =B+C, =SUM(B), =B1*5%, =IF(C>B, "UP", "DOWN")', 'litestats-pro' ); ?>"
                       disabled>
                <div class="formula-help">
                    <?php esc_html_e( 'Use column letters (A, B, C) or cell refs (A1, B3). Functions: SUM, AVG, MIN, MAX, IF, ABS, ROUND, COUNT', 'litestats-pro' ); ?>
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

            <!-- Hidden CSV Input (legacy fallback) -->
            <input type="file" id="csvInput" hidden accept=".csv,.tsv,.txt">
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
                        <option value="doughnut"><?php esc_html_e( 'Doughnut Chart', 'litestats-pro' ); ?></option>
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

            <!-- Chart Configuration Card -->
            <div class="litestats-card" id="chartConfigCard">
                <strong><?php esc_html_e( 'Chart Configuration', 'litestats-pro' ); ?></strong>

                <div class="config-row" style="margin-top:10px;">
                    <label for="chartLabelCol"><?php esc_html_e( 'Label Column', 'litestats-pro' ); ?></label>
                    <select class="btn" id="chartLabelCol" style="width:100%"></select>
                </div>

                <div class="config-row" style="margin-top:10px;">
                    <label><?php esc_html_e( 'Data Columns', 'litestats-pro' ); ?></label>
                    <div id="chartDataColsContainer" class="checkbox-list"></div>
                    <small class="format-hint"><?php esc_html_e( 'Empty = all numeric columns', 'litestats-pro' ); ?></small>
                </div>

                <div class="config-grid" style="margin-top:10px;">
                    <div>
                        <label for="xAxisLabel"><?php esc_html_e( 'X-Axis Label', 'litestats-pro' ); ?></label>
                        <input type="text" class="btn" id="xAxisLabel" style="width:100%" placeholder="<?php esc_attr_e( 'e.g. Month', 'litestats-pro' ); ?>">
                    </div>
                    <div>
                        <label for="yAxisLabel"><?php esc_html_e( 'Y-Axis Label', 'litestats-pro' ); ?></label>
                        <input type="text" class="btn" id="yAxisLabel" style="width:100%" placeholder="<?php esc_attr_e( 'e.g. Revenue', 'litestats-pro' ); ?>">
                    </div>
                </div>

                <div class="config-grid" style="margin-top:10px;">
                    <div>
                        <label for="legendPosition"><?php esc_html_e( 'Legend Position', 'litestats-pro' ); ?></label>
                        <select class="btn" id="legendPosition" style="width:100%">
                            <option value="top"><?php esc_html_e( 'Top', 'litestats-pro' ); ?></option>
                            <option value="bottom"><?php esc_html_e( 'Bottom', 'litestats-pro' ); ?></option>
                            <option value="left"><?php esc_html_e( 'Left', 'litestats-pro' ); ?></option>
                            <option value="right"><?php esc_html_e( 'Right', 'litestats-pro' ); ?></option>
                        </select>
                    </div>
                    <div>
                        <label class="checkbox-label" style="margin-top:4px;">
                            <input type="checkbox" id="showLegend" checked>
                            <?php esc_html_e( 'Show Legend', 'litestats-pro' ); ?>
                        </label>
                        <label class="checkbox-label" style="margin-top:6px;">
                            <input type="checkbox" id="showDataLabels">
                            <?php esc_html_e( 'Show Data Labels', 'litestats-pro' ); ?>
                        </label>
                    </div>
                </div>

                <!-- Line chart options -->
                <div class="config-row" id="lineChartOptions" style="margin-top:10px;display:none;">
                    <label class="checkbox-label">
                        <input type="checkbox" id="fillArea">
                        <?php esc_html_e( 'Fill Area', 'litestats-pro' ); ?>
                    </label>
                    <div style="margin-top:6px;">
                        <label for="lineTension"><?php esc_html_e( 'Curve Tension', 'litestats-pro' ); ?></label>
                        <input type="range" id="lineTension" min="0" max="1" step="0.1" value="0.4" style="width:100%">
                    </div>
                </div>

                <!-- Pie/Doughnut max width -->
                <div class="config-row" id="pieMaxWidthRow" style="margin-top:10px;display:none;">
                    <label for="pieMaxWidth"><?php esc_html_e( 'Pie Max Width (px)', 'litestats-pro' ); ?></label>
                    <input type="number" class="btn" id="pieMaxWidth" value="0" min="0" max="2000" step="10" style="width:100%" placeholder="<?php esc_attr_e( '0 = no limit', 'litestats-pro' ); ?>">
                    <small class="format-hint"><?php esc_html_e( '0 = no limit. e.g. 400', 'litestats-pro' ); ?></small>
                </div>

                <!-- Y-axis options -->
                <div class="config-row" style="margin-top:10px;">
                    <label class="checkbox-label">
                        <input type="checkbox" id="beginAtZero" checked>
                        <?php esc_html_e( 'Y-Axis Begin at Zero', 'litestats-pro' ); ?>
                    </label>
                </div>

                <!-- Group By Column -->
                <div class="config-row" style="margin-top:10px;">
                    <label for="groupByCol"><?php esc_html_e( 'Group By Column', 'litestats-pro' ); ?></label>
                    <select class="btn" id="groupByCol" style="width:100%">
                        <option value="-1"><?php esc_html_e( 'None', 'litestats-pro' ); ?></option>
                    </select>
                    <small class="format-hint"><?php esc_html_e( 'Creates a sidebar menu from unique values in the selected column.', 'litestats-pro' ); ?></small>
                </div>

                <!-- Per-series colors -->
                <div class="config-row" style="margin-top:10px;">
                    <label><?php esc_html_e( 'Series Colors', 'litestats-pro' ); ?></label>
                    <div id="seriesColorsContainer"></div>
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
                <div class="formula-percent-option" id="formulaPercentOption" style="display:none; margin-top:10px;">
                    <label>
                        <input type="checkbox" id="colIsPercent">
                        <?php esc_html_e( 'Show as Percentage (%)', 'litestats-pro' ); ?>
                    </label>
                </div>
                <small class="format-hint">
                    <?php esc_html_e( 'Select a column header to apply formats.', 'litestats-pro' ); ?>
                </small>
            </div>

            <!-- Table Settings Card -->
            <div class="litestats-card" id="tableSettingsCard">
                <strong><?php esc_html_e( 'Table Settings', 'litestats-pro' ); ?></strong>
                <div class="config-grid" style="margin-top:10px;">
                    <div>
                        <label for="tableRowsPerPage"><?php esc_html_e( 'Rows Per Page', 'litestats-pro' ); ?></label>
                        <input type="number" class="btn" id="tableRowsPerPage" value="25" min="1" max="500" style="width:100%">
                    </div>
                    <div>
                        <label>&nbsp;</label>
                        <label class="checkbox-label">
                            <input type="checkbox" id="tableStriped" checked>
                            <?php esc_html_e( 'Striped Rows', 'litestats-pro' ); ?>
                        </label>
                    </div>
                </div>
                <div class="config-grid" style="margin-top:10px;">
                    <div>
                        <label class="checkbox-label">
                            <input type="checkbox" id="tableShowSearch" checked>
                            <?php esc_html_e( 'Show Search', 'litestats-pro' ); ?>
                        </label>
                    </div>
                    <div>
                        <label class="checkbox-label">
                            <input type="checkbox" id="tableShowExport" checked>
                            <?php esc_html_e( 'Show Export', 'litestats-pro' ); ?>
                        </label>
                    </div>
                </div>
                <div class="config-row" style="margin-top:10px;">
                    <label class="checkbox-label">
                        <input type="checkbox" id="tableColumnFilters">
                        <?php esc_html_e( 'Column Filters', 'litestats-pro' ); ?>
                    </label>
                </div>
            </div>

            <!-- Conditional Formatting Card -->
            <div class="litestats-card" id="conditionalFormatCard">
                <div class="card-header">
                    <strong><?php esc_html_e( 'Conditional Formatting', 'litestats-pro' ); ?></strong>
                    <button class="btn btn-sm" id="addCondRuleBtn">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div id="condRulesContainer"></div>
                <small class="format-hint"><?php esc_html_e( 'Highlight cells based on value conditions.', 'litestats-pro' ); ?></small>
            </div>

            <!-- Chart Title Card -->
            <div class="litestats-card">
                <strong><?php esc_html_e( 'Chart Title', 'litestats-pro' ); ?></strong>
                <input type="text" class="btn chart-title-input" id="chartTitle"
                       placeholder="<?php esc_attr_e( 'Enter chart title...', 'litestats-pro' ); ?>"
                       value="<?php echo esc_attr( $chart_title ); ?>">
            </div>
        </div>
    </div>

    <!-- Toast Notification -->
    <div class="litestats-toast" id="toast"></div>

    <!-- CSV Import Wizard Modal -->
    <div class="litestats-modal-overlay" id="csvWizardModal" style="display:none;">
        <div class="litestats-modal">
            <div class="litestats-modal-header">
                <h3><?php esc_html_e( 'CSV Import Wizard', 'litestats-pro' ); ?></h3>
                <button class="litestats-modal-close" id="csvWizardClose">&times;</button>
            </div>
            <div class="litestats-modal-steps">
                <span class="step active" data-step="1">1. <?php esc_html_e( 'Upload', 'litestats-pro' ); ?></span>
                <span class="step" data-step="2">2. <?php esc_html_e( 'Preview & Map', 'litestats-pro' ); ?></span>
                <span class="step" data-step="3">3. <?php esc_html_e( 'Confirm', 'litestats-pro' ); ?></span>
            </div>
            <div class="litestats-modal-body">
                <!-- Step 1: Upload -->
                <div class="wizard-step" id="wizardStep1">
                    <div class="csv-dropzone" id="csvDropzone">
                        <i class="fas fa-cloud-upload-alt" style="font-size:48px;color:#ccc;margin-bottom:15px"></i>
                        <p><?php esc_html_e( 'Drag & drop a CSV file here, or click to browse', 'litestats-pro' ); ?></p>
                        <input type="file" id="csvWizardFile" accept=".csv,.tsv,.txt" style="display:none">
                        <button class="btn btn-primary" id="csvWizardBrowse"><?php esc_html_e( 'Browse Files', 'litestats-pro' ); ?></button>
                    </div>
                </div>
                <!-- Step 2: Preview & Map -->
                <div class="wizard-step" id="wizardStep2" style="display:none;">
                    <label class="checkbox-label" style="margin-bottom:10px">
                        <input type="checkbox" id="csvFirstRowHeader" checked>
                        <?php esc_html_e( 'First row is header', 'litestats-pro' ); ?>
                    </label>
                    <div class="csv-preview-scroll">
                        <table class="csv-preview-table" id="csvPreviewTable">
                            <thead id="csvPreviewHead"></thead>
                            <tbody id="csvPreviewBody"></tbody>
                        </table>
                    </div>
                </div>
                <!-- Step 3: Confirm -->
                <div class="wizard-step" id="wizardStep3" style="display:none;">
                    <div id="csvSummary"></div>
                </div>
            </div>
            <div class="litestats-modal-footer">
                <button class="btn" id="csvWizardPrev" style="display:none"><?php esc_html_e( 'Back', 'litestats-pro' ); ?></button>
                <button class="btn btn-primary" id="csvWizardNext"><?php esc_html_e( 'Next', 'litestats-pro' ); ?></button>
            </div>
        </div>
    </div>
</div>
