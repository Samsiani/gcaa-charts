<?php
/**
 * Data Handler Class.
 *
 * Handles all CRUD operations for chart data using a custom database table.
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

/**
 * DataHandler class.
 *
 * @since 5.0.0
 */
class DataHandler {

    /**
     * Get the table name.
     *
     * @return string
     */
    private function table_name(): string {
        global $wpdb;
        return $wpdb->prefix . 'litestats_charts';
    }

    /**
     * Create a new chart.
     *
     * @param string $title    Chart title.
     * @param array  $config   Chart configuration data (cols, rows).
     * @param array  $settings Chart settings (chartType, theme, etc.).
     * @return int|false New chart ID on success, false on failure.
     */
    public function create_chart( string $title, array $config = [], array $settings = [] ) {
        global $wpdb;

        if ( ! current_user_can( 'manage_options' ) ) {
            return false;
        }

        $title = sanitize_text_field( $title );
        if ( empty( $title ) ) {
            $title = __( 'Untitled Chart', 'litestats-pro' );
        }

        $sanitized_config   = $this->sanitize_config( $config );
        $sanitized_settings = $this->sanitize_settings( $settings );

        $result = $wpdb->insert(
            $this->table_name(),
            [
                'title'    => $title,
                'config'   => wp_json_encode( $sanitized_config ),
                'settings' => wp_json_encode( $sanitized_settings ),
            ],
            [ '%s', '%s', '%s' ]
        );

        if ( false === $result ) {
            return false;
        }

        return (int) $wpdb->insert_id;
    }

    /**
     * Get a chart by ID.
     *
     * @param int $chart_id Chart ID.
     * @return array|null Chart data or null if not found.
     */
    public function get_chart( int $chart_id ): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$this->table_name()} WHERE id = %d",
                $chart_id
            )
        );

        if ( ! $row ) {
            return null;
        }

        return $this->hydrate( $row );
    }

    /**
     * Update a chart.
     *
     * @param int    $chart_id Chart ID.
     * @param string $title    Chart title.
     * @param array  $config   Chart configuration data.
     * @param array  $settings Chart settings.
     * @return bool True on success, false on failure.
     */
    public function update_chart( int $chart_id, string $title = '', array $config = [], array $settings = [] ): bool {
        global $wpdb;

        if ( ! current_user_can( 'manage_options' ) ) {
            return false;
        }

        // Verify chart exists.
        $existing = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT id FROM {$this->table_name()} WHERE id = %d",
                $chart_id
            )
        );

        if ( ! $existing ) {
            return false;
        }

        $data    = [];
        $formats = [];

        if ( ! empty( $title ) ) {
            $data['title'] = sanitize_text_field( $title );
            $formats[]     = '%s';
        }

        if ( ! empty( $config ) ) {
            $data['config'] = wp_json_encode( $this->sanitize_config( $config ) );
            $formats[]      = '%s';
        }

        if ( ! empty( $settings ) ) {
            $data['settings'] = wp_json_encode( $this->sanitize_settings( $settings ) );
            $formats[]        = '%s';
        }

        if ( empty( $data ) ) {
            return true;
        }

        $result = $wpdb->update(
            $this->table_name(),
            $data,
            [ 'id' => $chart_id ],
            $formats,
            [ '%d' ]
        );

        return false !== $result;
    }

    /**
     * Delete a chart.
     *
     * @param int $chart_id Chart ID.
     * @return bool True on success, false on failure.
     */
    public function delete_chart( int $chart_id ): bool {
        global $wpdb;

        if ( ! current_user_can( 'manage_options' ) ) {
            return false;
        }

        $result = $wpdb->delete(
            $this->table_name(),
            [ 'id' => $chart_id ],
            [ '%d' ]
        );

        return false !== $result && $result > 0;
    }

    /**
     * Get all charts.
     *
     * @param array $args Query arguments (unused, kept for compat).
     * @return array Array of chart data.
     */
    public function get_all_charts( array $args = [] ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            "SELECT * FROM {$this->table_name()} ORDER BY updated_at DESC"
        );

        if ( ! $rows ) {
            return [];
        }

        $charts = [];
        foreach ( $rows as $row ) {
            $charts[] = $this->hydrate( $row );
        }

        return $charts;
    }

    /**
     * Hydrate a DB row into a chart array.
     *
     * @param object $row Database row.
     * @return array Chart data.
     */
    private function hydrate( object $row ): array {
        $config  = json_decode( $row->config, true );
        $settings = json_decode( $row->settings, true );

        if ( ! is_array( $config ) || empty( $config ) ) {
            $config = $this->get_default_config();
        }

        $default_settings = $this->get_default_settings();
        if ( ! is_array( $settings ) || empty( $settings ) ) {
            $settings = $default_settings;
        } else {
            $settings = array_merge( $default_settings, $settings );
        }

        return [
            'id'       => (int) $row->id,
            'title'    => $row->title,
            'config'   => $config,
            'settings' => $settings,
            'created'  => $row->created_at,
            'modified' => $row->updated_at,
        ];
    }

    /**
     * Get default configuration.
     *
     * @return array Default configuration.
     */
    public function get_default_config(): array {
        return [
            'cols' => [
                [
                    'id'    => 'c1',
                    'name'  => __( 'Product', 'litestats-pro' ),
                    'type'  => 'string',
                    'width' => 150,
                    'props' => [],
                ],
                [
                    'id'    => 'c2',
                    'name'  => __( '2023 Sales', 'litestats-pro' ),
                    'type'  => 'number',
                    'width' => 100,
                    'props' => [ 'prefix' => '$' ],
                ],
                [
                    'id'    => 'c3',
                    'name'  => __( '2024 Sales', 'litestats-pro' ),
                    'type'  => 'number',
                    'width' => 100,
                    'props' => [ 'prefix' => '$' ],
                ],
                [
                    'id'      => 'c4',
                    'name'    => __( 'Growth', 'litestats-pro' ),
                    'type'    => 'formula',
                    'formula' => '=IF({c3}>{c2}, "UP", "DOWN")',
                    'width'   => 100,
                    'props'   => [],
                ],
            ],
            'rows' => [
                [ 'Laptop', 1200, 1500, '' ],
                [ 'Phone', 800, 750, '' ],
                [ 'Tablet', 450, 600, '' ],
            ],
        ];
    }

    /**
     * Get default settings.
     *
     * @return array Default settings.
     */
    public function get_default_settings(): array {
        return [
            'chartType'        => 'bar',
            'theme'            => 'default',
            'stacked'          => false,
            'view'             => 'chart',
            'mode'             => 'value',
            'chartLabelCol'    => 0,
            'chartDataCols'    => [],
            'xAxisLabel'       => '',
            'yAxisLabel'       => '',
            'legendPosition'   => 'top',
            'showDataLabels'   => false,
            'seriesColors'     => (object) [],
            'tableRowsPerPage' => 25,
            'tableShowSearch'  => true,
            'tableShowExport'  => true,
            'tableColumnFilters' => false,
            'tableStriped'     => true,
            'conditionalRules' => [],
            'fillArea'         => false,
            'lineTension'      => 0.4,
            'beginAtZero'      => true,
        ];
    }

    /**
     * Sanitize configuration data.
     *
     * @param array $config Configuration to sanitize.
     * @return array Sanitized configuration.
     */
    public function sanitize_config( array $config ): array {
        $sanitized = [];

        $valid_types = [ 'string', 'number', 'formula', 'date', 'currency', 'percentage' ];

        if ( isset( $config['cols'] ) && is_array( $config['cols'] ) ) {
            $sanitized['cols'] = [];
            foreach ( $config['cols'] as $col ) {
                if ( ! is_array( $col ) ) {
                    continue;
                }
                $sanitized['cols'][] = [
                    'id'      => isset( $col['id'] ) ? sanitize_key( $col['id'] ) : '',
                    'name'    => isset( $col['name'] ) ? sanitize_text_field( $col['name'] ) : '',
                    'type'    => isset( $col['type'] ) && in_array( $col['type'], $valid_types, true )
                        ? $col['type']
                        : 'string',
                    'formula' => isset( $col['formula'] ) ? sanitize_text_field( $col['formula'] ) : '',
                    'width'   => isset( $col['width'] ) ? absint( $col['width'] ) : 100,
                    'props'   => isset( $col['props'] ) && is_array( $col['props'] )
                        ? array_map( 'sanitize_text_field', $col['props'] )
                        : [],
                ];
            }
        }

        if ( isset( $config['rows'] ) && is_array( $config['rows'] ) ) {
            $sanitized['rows'] = [];
            foreach ( $config['rows'] as $row ) {
                if ( ! is_array( $row ) ) {
                    continue;
                }
                $sanitized['rows'][] = array_map(
                    function ( $cell ) {
                        if ( is_numeric( $cell ) ) {
                            return $cell + 0;
                        }
                        return sanitize_text_field( (string) $cell );
                    },
                    $row
                );
            }
        }

        return $sanitized;
    }

    /**
     * Sanitize settings data.
     *
     * @param array $settings Settings to sanitize.
     * @return array Sanitized settings.
     */
    public function sanitize_settings( array $settings ): array {
        $defaults  = $this->get_default_settings();
        $sanitized = [];

        // Chart type.
        $valid_chart_types        = [ 'bar', 'line', 'pie', 'radar', 'combo', 'doughnut' ];
        $sanitized['chartType']   = isset( $settings['chartType'] ) && in_array( $settings['chartType'], $valid_chart_types, true )
            ? $settings['chartType']
            : $defaults['chartType'];

        // Theme.
        $valid_themes           = [ 'default', 'modern', 'pastel', 'dark' ];
        $sanitized['theme']     = isset( $settings['theme'] ) && in_array( $settings['theme'], $valid_themes, true )
            ? $settings['theme']
            : $defaults['theme'];

        // Booleans.
        $sanitized['stacked']          = isset( $settings['stacked'] ) ? (bool) $settings['stacked'] : $defaults['stacked'];
        $sanitized['showDataLabels']   = isset( $settings['showDataLabels'] ) ? (bool) $settings['showDataLabels'] : $defaults['showDataLabels'];
        $sanitized['tableShowSearch']  = isset( $settings['tableShowSearch'] ) ? (bool) $settings['tableShowSearch'] : $defaults['tableShowSearch'];
        $sanitized['tableShowExport']  = isset( $settings['tableShowExport'] ) ? (bool) $settings['tableShowExport'] : $defaults['tableShowExport'];
        $sanitized['tableColumnFilters'] = isset( $settings['tableColumnFilters'] ) ? (bool) $settings['tableColumnFilters'] : $defaults['tableColumnFilters'];
        $sanitized['tableStriped']     = isset( $settings['tableStriped'] ) ? (bool) $settings['tableStriped'] : $defaults['tableStriped'];
        $sanitized['fillArea']         = isset( $settings['fillArea'] ) ? (bool) $settings['fillArea'] : $defaults['fillArea'];
        $sanitized['beginAtZero']      = isset( $settings['beginAtZero'] ) ? (bool) $settings['beginAtZero'] : $defaults['beginAtZero'];

        // View.
        $valid_views          = [ 'chart', 'table' ];
        $sanitized['view']    = isset( $settings['view'] ) && in_array( $settings['view'], $valid_views, true )
            ? $settings['view']
            : $defaults['view'];

        // Mode.
        $valid_modes          = [ 'value', 'percent' ];
        $sanitized['mode']    = isset( $settings['mode'] ) && in_array( $settings['mode'], $valid_modes, true )
            ? $settings['mode']
            : $defaults['mode'];

        // Chart column selector.
        $sanitized['chartLabelCol']  = isset( $settings['chartLabelCol'] ) ? absint( $settings['chartLabelCol'] ) : $defaults['chartLabelCol'];
        $sanitized['chartDataCols']  = isset( $settings['chartDataCols'] ) && is_array( $settings['chartDataCols'] )
            ? array_map( 'absint', $settings['chartDataCols'] )
            : $defaults['chartDataCols'];

        // Strings.
        $sanitized['xAxisLabel']     = isset( $settings['xAxisLabel'] ) ? sanitize_text_field( $settings['xAxisLabel'] ) : $defaults['xAxisLabel'];
        $sanitized['yAxisLabel']     = isset( $settings['yAxisLabel'] ) ? sanitize_text_field( $settings['yAxisLabel'] ) : $defaults['yAxisLabel'];

        // Legend position.
        $valid_positions                = [ 'top', 'bottom', 'left', 'right' ];
        $sanitized['legendPosition']    = isset( $settings['legendPosition'] ) && in_array( $settings['legendPosition'], $valid_positions, true )
            ? $settings['legendPosition']
            : $defaults['legendPosition'];

        // Series colors (object).
        $sanitized['seriesColors'] = isset( $settings['seriesColors'] ) && ( is_array( $settings['seriesColors'] ) || is_object( $settings['seriesColors'] ) )
            ? $settings['seriesColors']
            : $defaults['seriesColors'];

        // Table rows per page.
        $sanitized['tableRowsPerPage'] = isset( $settings['tableRowsPerPage'] ) ? absint( $settings['tableRowsPerPage'] ) : $defaults['tableRowsPerPage'];
        if ( $sanitized['tableRowsPerPage'] < 1 ) {
            $sanitized['tableRowsPerPage'] = 25;
        }

        // Line tension.
        $sanitized['lineTension'] = isset( $settings['lineTension'] ) ? (float) $settings['lineTension'] : $defaults['lineTension'];
        $sanitized['lineTension'] = max( 0, min( 1, $sanitized['lineTension'] ) );

        // Conditional rules.
        $sanitized['conditionalRules'] = isset( $settings['conditionalRules'] ) && is_array( $settings['conditionalRules'] )
            ? $settings['conditionalRules']
            : $defaults['conditionalRules'];

        return $sanitized;
    }
}
