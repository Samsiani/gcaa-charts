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
     * @since 5.0.0
     *
     * @param DataHandler $data_handler Data handler instance.
     */
    public function __construct( DataHandler $data_handler ) {
        $this->data_handler = $data_handler;
        $this->init_hooks();
    }

    /**
     * Initialize hooks.
     *
     * @since 5.0.0
     */
    private function init_hooks(): void {
        add_shortcode( 'litestats', [ $this, 'render_shortcode' ] );
    }

    /**
     * Render the shortcode.
     *
     * @since 5.0.0
     *
     * @param array|string $atts Shortcode attributes.
     * @return string Rendered HTML.
     */
    public function render_shortcode( $atts ): string {
        $atts = shortcode_atts(
            [
                'id'     => 0,
                'type'   => '', // Override chart type.
                'theme'  => '', // Override theme.
                'width'  => '100%',
                'height' => '400px',
            ],
            $atts,
            'litestats'
        );

        $chart_id = absint( $atts['id'] );

        if ( $chart_id <= 0 ) {
            return $this->render_error( __( 'Invalid chart ID.', 'litestats-pro' ) );
        }

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
        <div class="litestats-container" id="<?php echo esc_attr( $instance_id ); ?>" style="width: <?php echo $width; ?>; height: <?php echo $height; ?>;">
            <?php if ( 'table' === $settings['view'] ) : ?>
                <div class="litestats-table-wrapper">
                    <input type="text" class="litestats-search" placeholder="<?php esc_attr_e( 'Search...', 'litestats-pro' ); ?>" data-target="<?php echo esc_attr( $instance_id ); ?>">
                    <table class="litestats-table">
                        <thead></thead>
                        <tbody></tbody>
                    </table>
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
     *
     * Only loads when shortcode is present on the page.
     *
     * @since 5.0.0
     */
    private function enqueue_frontend_assets(): void {
        if ( $this->assets_enqueued ) {
            return;
        }

        // Enqueue Chart.js.
        wp_enqueue_script(
            'chartjs',
            'https://cdn.jsdelivr.net/npm/chart.js',
            [],
            '4.4.1',
            true
        );

        // Enqueue frontend styles.
        wp_enqueue_style(
            'litestats-pro-frontend',
            LITESTATS_PRO_PLUGIN_URL . 'assets/css/frontend-style.css',
            [],
            LITESTATS_PRO_VERSION
        );

        // Enqueue frontend app.
        wp_enqueue_script(
            'litestats-pro-frontend',
            LITESTATS_PRO_PLUGIN_URL . 'assets/js/frontend-app.js',
            [ 'chartjs' ],
            LITESTATS_PRO_VERSION,
            true
        );

        // Localize script.
        wp_localize_script(
            'litestats-pro-frontend',
            'liteStatsProFrontend',
            [
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'strings' => [
                    'noData' => __( 'No data available', 'litestats-pro' ),
                ],
            ]
        );

        $this->assets_enqueued = true;
    }

    /**
     * Render error message.
     *
     * @since 5.0.0
     *
     * @param string $message Error message.
     * @return string Rendered error HTML.
     */
    private function render_error( string $message ): string {
        // Only show detailed errors to admins.
        if ( current_user_can( 'manage_options' ) ) {
            return sprintf(
                '<div class="litestats-error" style="padding: 20px; background: #fef1f1; border: 1px solid #d63638; border-radius: 4px; color: #d63638;">%s</div>',
                esc_html( $message )
            );
        }

        return '';
    }
}
