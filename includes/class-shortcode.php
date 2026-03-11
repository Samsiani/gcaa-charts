<?php
/**
 * Shortcode Handler Class.
 *
 * Handles frontend rendering of charts via shortcodes.
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
 * Shortcode class.
 *
 * @since 5.0.0
 */
class Shortcode {

    /**
     * Data handler instance.
     *
     * @var DataHandler
     */
    private DataHandler $data_handler;

    /**
     * Flag to track if assets have been enqueued.
     *
     * @var bool
     */
    private bool $assets_enqueued = false;

    /**
     * Constructor.
     *
     * @param DataHandler $data_handler Data handler instance.
     */
    public function __construct( DataHandler $data_handler ) {
        $this->data_handler = $data_handler;
        $this->init_hooks();
    }

    /**
     * Initialize hooks.
     */
    private function init_hooks(): void {
        add_shortcode( 'litestats', [ $this, 'render_shortcode' ] );
        add_filter( 'script_loader_tag', [ $this, 'add_script_integrity' ], 10, 3 );
    }

    /**
     * Add SRI integrity attribute to CDN scripts.
     */
    public function add_script_integrity( string $tag, string $handle, string $src ): string {
        if ( 'chartjs' === $handle && strpos( $src, 'cdn.jsdelivr.net' ) !== false ) {
            $integrity = 'sha384-9nhczxUqK87bcKHh20fSQcTGD4qq5GhayNYSYWqwBkINBhOfQLg/P5HG5lF1urn4';
            $tag = str_replace(
                ' src=',
                ' integrity="' . $integrity . '" crossorigin="anonymous" src=',
                $tag
            );
        }
        return $tag;
    }

    /**
     * Resolve chart ID, checking ID map for old CPT IDs.
     *
     * @param int $chart_id Requested chart ID.
     * @return int Resolved chart ID.
     */
    private function resolve_chart_id( int $chart_id ): int {
        // Try direct lookup first.
        $chart = $this->data_handler->get_chart( $chart_id );
        if ( $chart ) {
            return $chart_id;
        }

        // Check ID map for old CPT ID → new table ID.
        $id_map = get_option( 'litestats_pro_id_map', [] );
        if ( is_array( $id_map ) && isset( $id_map[ $chart_id ] ) ) {
            return (int) $id_map[ $chart_id ];
        }

        return $chart_id;
    }

    /**
     * Render the shortcode.
     *
     * @param array|string $atts Shortcode attributes.
     * @return string Rendered HTML.
     */
    public function render_shortcode( $atts ): string {
        $atts = shortcode_atts(
            [
                'id'             => 0,
                'type'           => '',
                'theme'          => '',
                'view'           => '',
                'width'          => '100%',
                'height'         => '400px',
                'rows_per_page'  => 0,
                'show_export'    => '',
                'show_filters'   => '',
            ],
            $atts,
            'litestats'
        );

        $chart_id = absint( $atts['id'] );

        if ( $chart_id <= 0 ) {
            return $this->render_error( __( 'Invalid chart ID.', 'litestats-pro' ) );
        }

        // Resolve ID (handles old CPT IDs via map).
        $chart_id = $this->resolve_chart_id( $chart_id );

        // Get chart data.
        $chart = $this->data_handler->get_chart( $chart_id );

        if ( ! $chart ) {
            return $this->render_error( __( 'Chart not found.', 'litestats-pro' ) );
        }

        // Enqueue frontend assets.
        $this->enqueue_frontend_assets();

        // Override settings if provided.
        $settings = $chart['settings'];
        if ( ! empty( $atts['type'] ) ) {
            $settings['chartType'] = sanitize_key( $atts['type'] );
        }
        if ( ! empty( $atts['theme'] ) ) {
            $settings['theme'] = sanitize_key( $atts['theme'] );
        }
        if ( ! empty( $atts['view'] ) && in_array( $atts['view'], [ 'chart', 'table' ], true ) ) {
            $settings['view'] = $atts['view'];
        }
        if ( absint( $atts['rows_per_page'] ) > 0 ) {
            $settings['tableRowsPerPage'] = absint( $atts['rows_per_page'] );
        }
        if ( '' !== $atts['show_export'] ) {
            $settings['tableShowExport'] = filter_var( $atts['show_export'], FILTER_VALIDATE_BOOLEAN );
        }
        if ( '' !== $atts['show_filters'] ) {
            $settings['tableColumnFilters'] = filter_var( $atts['show_filters'], FILTER_VALIDATE_BOOLEAN );
        }

        // Generate unique ID for this chart instance.
        $instance_id = 'litestats-chart-' . $chart_id . '-' . wp_rand( 1000, 9999 );

        // Prepare data for JavaScript.
        $chart_data = [
            'id'       => $chart_id,
            'config'   => $chart['config'],
            'settings' => $settings,
        ];

        // Output inline script with chart data.
        $inline_script = sprintf(
            'if(typeof liteStatsFrontendCharts === "undefined") { var liteStatsFrontendCharts = {}; } liteStatsFrontendCharts["%s"] = %s;',
            esc_js( $instance_id ),
            wp_json_encode( $chart_data )
        );
        wp_add_inline_script( 'litestats-pro-frontend', $inline_script, 'before' );

        // Render container.
        $width  = esc_attr( $atts['width'] );
        $height = esc_attr( $atts['height'] );

        ob_start();
        ?>
        <div class="litestats-container" id="<?php echo esc_attr( $instance_id ); ?>" style="width: <?php echo $width; ?>; <?php echo 'table' !== $settings['view'] ? 'height: ' . $height . ';' : ''; ?>">
            <?php if ( 'table' === $settings['view'] ) : ?>
                <div class="litestats-table-wrapper">
                    <div class="litestats-table-toolbar">
                        <?php if ( $settings['tableShowSearch'] ) : ?>
                            <input type="text" class="litestats-search" placeholder="<?php esc_attr_e( 'Search...', 'litestats-pro' ); ?>" data-target="<?php echo esc_attr( $instance_id ); ?>">
                        <?php endif; ?>
                        <?php if ( $settings['tableShowExport'] ) : ?>
                            <div class="litestats-export-bar">
                                <button class="litestats-btn litestats-export-csv" data-target="<?php echo esc_attr( $instance_id ); ?>"><?php esc_html_e( 'Export CSV', 'litestats-pro' ); ?></button>
                                <button class="litestats-btn litestats-print" data-target="<?php echo esc_attr( $instance_id ); ?>"><?php esc_html_e( 'Print', 'litestats-pro' ); ?></button>
                            </div>
                        <?php endif; ?>
                    </div>
                    <?php if ( $settings['tableColumnFilters'] ) : ?>
                        <div class="litestats-column-filters"></div>
                    <?php endif; ?>
                    <table class="litestats-table<?php echo $settings['tableStriped'] ? ' litestats-striped' : ''; ?>">
                        <thead></thead>
                        <tbody></tbody>
                    </table>
                    <div class="litestats-pagination"></div>
                </div>
            <?php else : ?>
                <canvas class="litestats-canvas"></canvas>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Enqueue frontend assets.
     */
    private function enqueue_frontend_assets(): void {
        if ( $this->assets_enqueued ) {
            return;
        }

        wp_enqueue_script(
            'chartjs',
            'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
            [],
            '4.4.1',
            true
        );

        wp_enqueue_style(
            'litestats-pro-frontend',
            LITESTATS_PRO_PLUGIN_URL . 'assets/css/frontend-style.css',
            [],
            LITESTATS_PRO_VERSION
        );

        wp_enqueue_script(
            'litestats-pro-frontend',
            LITESTATS_PRO_PLUGIN_URL . 'assets/js/frontend-app.js',
            [ 'chartjs' ],
            LITESTATS_PRO_VERSION,
            true
        );

        wp_localize_script(
            'litestats-pro-frontend',
            'liteStatsProFrontend',
            [
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'strings' => [
                    'noData'    => __( 'No data available', 'litestats-pro' ),
                    'page'      => __( 'Page', 'litestats-pro' ),
                    'of'        => __( 'of', 'litestats-pro' ),
                    'prev'      => __( 'Previous', 'litestats-pro' ),
                    'next'      => __( 'Next', 'litestats-pro' ),
                    'exportCsv' => __( 'Export CSV', 'litestats-pro' ),
                    'print'     => __( 'Print', 'litestats-pro' ),
                    'all'       => __( 'All', 'litestats-pro' ),
                    'min'       => __( 'Min', 'litestats-pro' ),
                    'max'       => __( 'Max', 'litestats-pro' ),
                ],
            ]
        );

        $this->assets_enqueued = true;
    }

    /**
     * Render error message.
     *
     * @param string $message Error message.
     * @return string Rendered error HTML.
     */
    private function render_error( string $message ): string {
        if ( current_user_can( 'manage_options' ) ) {
            return sprintf(
                '<div class="litestats-error" style="padding: 20px; background: #fef1f1; border: 1px solid #d63638; border-radius: 4px; color: #d63638;">%s</div>',
                esc_html( $message )
            );
        }

        return '';
    }
}
