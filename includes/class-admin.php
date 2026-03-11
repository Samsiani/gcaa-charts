<?php
/**
 * Admin Class.
 *
 * Handles all admin UI, menu registration, and asset enqueuing.
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
 * Admin class.
 *
 * @since 5.0.0
 */
class Admin {

    /**
     * Admin page slug.
     *
     * @var string
     */
    public const PAGE_SLUG = 'litestats-pro';

    /**
     * Admin page hook suffix.
     *
     * @var string
     */
    private string $hook_suffix = '';

    /**
     * Constructor.
     */
    public function __construct() {
        $this->init_hooks();
    }

    /**
     * Initialize hooks.
     */
    private function init_hooks(): void {
        add_action( 'admin_menu', [ $this, 'register_admin_menu' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_assets' ] );
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
     * Register admin menu.
     */
    public function register_admin_menu(): void {
        $this->hook_suffix = add_menu_page(
            __( 'LiteStats Pro', 'litestats-pro' ),
            __( 'LiteStats Pro', 'litestats-pro' ),
            'manage_options',
            self::PAGE_SLUG,
            [ $this, 'render_admin_page' ],
            'dashicons-chart-bar',
            30
        );

        add_submenu_page(
            self::PAGE_SLUG,
            __( 'All Charts', 'litestats-pro' ),
            __( 'All Charts', 'litestats-pro' ),
            'manage_options',
            self::PAGE_SLUG,
            [ $this, 'render_admin_page' ]
        );

        add_submenu_page(
            self::PAGE_SLUG,
            __( 'Add New Chart', 'litestats-pro' ),
            __( 'Add New', 'litestats-pro' ),
            'manage_options',
            self::PAGE_SLUG . '-new',
            [ $this, 'render_editor_page' ]
        );

        add_submenu_page(
            null,
            __( 'Edit Chart', 'litestats-pro' ),
            __( 'Edit Chart', 'litestats-pro' ),
            'manage_options',
            self::PAGE_SLUG . '-edit',
            [ $this, 'render_editor_page' ]
        );
    }

    /**
     * Enqueue admin assets.
     *
     * @param string $hook_suffix Current admin page hook suffix.
     */
    public function enqueue_admin_assets( string $hook_suffix ): void {
        $plugin_pages = [
            'toplevel_page_' . self::PAGE_SLUG,
            'litestats-pro_page_' . self::PAGE_SLUG . '-new',
            'admin_page_' . self::PAGE_SLUG . '-edit',
        ];

        if ( ! in_array( $hook_suffix, $plugin_pages, true ) ) {
            return;
        }

        // Chart.js CDN.
        wp_enqueue_script(
            'chartjs',
            'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
            [],
            '4.4.1',
            true
        );

        // Font Awesome.
        wp_enqueue_style(
            'fontawesome',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
            [],
            '6.4.0'
        );

        // Admin styles.
        wp_enqueue_style(
            'litestats-pro-admin',
            LITESTATS_PRO_PLUGIN_URL . 'assets/css/admin-style.css',
            [],
            LITESTATS_PRO_VERSION
        );

        // Editor pages only.
        $editor_pages = [
            'litestats-pro_page_' . self::PAGE_SLUG . '-new',
            'admin_page_' . self::PAGE_SLUG . '-edit',
        ];

        if ( in_array( $hook_suffix, $editor_pages, true ) ) {
            // Math Engine module.
            wp_enqueue_script(
                'litestats-pro-math-engine',
                LITESTATS_PRO_PLUGIN_URL . 'assets/js/modules/math-engine.js',
                [],
                LITESTATS_PRO_VERSION,
                true
            );

            // State/History module.
            wp_enqueue_script(
                'litestats-pro-state',
                LITESTATS_PRO_PLUGIN_URL . 'assets/js/modules/state.js',
                [],
                LITESTATS_PRO_VERSION,
                true
            );

            // Grid UI module.
            wp_enqueue_script(
                'litestats-pro-grid-ui',
                LITESTATS_PRO_PLUGIN_URL . 'assets/js/modules/grid-ui.js',
                [],
                LITESTATS_PRO_VERSION,
                true
            );

            // CSV Wizard module.
            wp_enqueue_script(
                'litestats-pro-csv-wizard',
                LITESTATS_PRO_PLUGIN_URL . 'assets/js/modules/csv-wizard.js',
                [],
                LITESTATS_PRO_VERSION,
                true
            );

            // Conditional Formatting module.
            wp_enqueue_script(
                'litestats-pro-conditional-format',
                LITESTATS_PRO_PLUGIN_URL . 'assets/js/modules/conditional-format.js',
                [],
                LITESTATS_PRO_VERSION,
                true
            );

            // Main admin app.
            wp_enqueue_script(
                'litestats-pro-admin-app',
                LITESTATS_PRO_PLUGIN_URL . 'assets/js/admin-app.js',
                [ 'jquery', 'chartjs', 'litestats-pro-math-engine', 'litestats-pro-state', 'litestats-pro-grid-ui', 'litestats-pro-csv-wizard', 'litestats-pro-conditional-format' ],
                LITESTATS_PRO_VERSION,
                true
            );

            // Get chart data if editing.
            $chart_id   = isset( $_GET['chart_id'] ) ? absint( $_GET['chart_id'] ) : 0;
            $chart_data = null;

            if ( $chart_id > 0 ) {
                $data_handler = LiteStatsPro::get_instance()->get_data_handler();
                if ( $data_handler ) {
                    $chart_data = $data_handler->get_chart( $chart_id );
                }
            }

            wp_localize_script(
                'litestats-pro-admin-app',
                'liteStatsProAdmin',
                [
                    'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
                    'nonce'     => wp_create_nonce( 'litestats_pro_nonce' ),
                    'chartId'   => $chart_id,
                    'chartData' => $chart_data,
                    'strings'   => [
                        'saveSuccess'    => __( 'Chart saved successfully!', 'litestats-pro' ),
                        'saveError'      => __( 'Error saving chart.', 'litestats-pro' ),
                        'deleteConfirm'  => __( 'Are you sure you want to delete this chart?', 'litestats-pro' ),
                        'undoSuccess'    => __( 'Undo successful', 'litestats-pro' ),
                        'redoSuccess'    => __( 'Redo successful', 'litestats-pro' ),
                        'transposed'     => __( 'Table Transposed', 'litestats-pro' ),
                        'csvImported'    => __( 'CSV Imported', 'litestats-pro' ),
                        'selectColumn'   => __( 'Select a column first', 'litestats-pro' ),
                        'cannotDelete'   => __( 'Cannot delete last column', 'litestats-pro' ),
                        'stackingOn'     => __( 'Stacking: ON', 'litestats-pro' ),
                        'stackingOff'    => __( 'Stacking: OFF', 'litestats-pro' ),
                    ],
                ]
            );
        }
    }

    /**
     * Render admin page (charts list).
     */
    public function render_admin_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'litestats-pro' ) );
        }

        $data_handler = LiteStatsPro::get_instance()->get_data_handler();
        $charts       = $data_handler ? $data_handler->get_all_charts( [ 'lean' => true ] ) : [];

        include LITESTATS_PRO_PLUGIN_DIR . 'templates/admin-charts-list.php';
    }

    /**
     * Render editor page (create/edit chart).
     */
    public function render_editor_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'litestats-pro' ) );
        }

        include LITESTATS_PRO_PLUGIN_DIR . 'templates/admin-dashboard.php';
    }

    /**
     * Get the admin page URL.
     *
     * @param string $page Page slug suffix.
     * @param array  $args Additional query args.
     * @return string Admin page URL.
     */
    public static function get_admin_url( string $page = '', array $args = [] ): string {
        $slug = self::PAGE_SLUG;
        if ( ! empty( $page ) ) {
            $slug .= '-' . $page;
        }

        $url = admin_url( 'admin.php?page=' . $slug );

        if ( ! empty( $args ) ) {
            $url = add_query_arg( $args, $url );
        }

        return $url;
    }
}
