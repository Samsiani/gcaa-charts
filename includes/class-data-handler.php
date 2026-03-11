<?php
/**
 * Data Handler Class.
 *
 * Handles all Custom Post Type registration and CRUD operations
 * for chart data storage.
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
     * Custom Post Type name.
     *
     * @var string
     */
    public const POST_TYPE = 'litestats_chart';

    /**
     * Meta key for chart configuration.
     *
     * @var string
     */
    public const META_KEY_CONFIG = '_litestats_chart_config';

    /**
     * Meta key for chart settings.
     *
     * @var string
     */
    public const META_KEY_SETTINGS = '_litestats_chart_settings';

    /**
     * Constructor.
     *
     * @since 5.0.0
     */
    public function __construct() {
        $this->init_hooks();
    }

    /**
     * Initialize hooks.
     *
     * @since 5.0.0
     */
    private function init_hooks(): void {
        add_action( 'init', [ $this, 'register_post_type' ] );
    }

    /**
     * Register the custom post type.
     *
     * @since 5.0.0
     */
    public function register_post_type(): void {
        $labels = [
            'name'               => _x( 'LiteStats Charts', 'post type general name', 'litestats-pro' ),
            'singular_name'      => _x( 'LiteStats Chart', 'post type singular name', 'litestats-pro' ),
            'menu_name'          => _x( 'LiteStats Charts', 'admin menu', 'litestats-pro' ),
            'add_new'            => _x( 'Add New', 'chart', 'litestats-pro' ),
            'add_new_item'       => __( 'Add New Chart', 'litestats-pro' ),
            'edit_item'          => __( 'Edit Chart', 'litestats-pro' ),
            'new_item'           => __( 'New Chart', 'litestats-pro' ),
            'view_item'          => __( 'View Chart', 'litestats-pro' ),
            'search_items'       => __( 'Search Charts', 'litestats-pro' ),
            'not_found'          => __( 'No charts found', 'litestats-pro' ),
            'not_found_in_trash' => __( 'No charts found in Trash', 'litestats-pro' ),
        ];

        $args = [
            'labels'              => $labels,
            'public'              => false,
            'publicly_queryable'  => false,
            'show_ui'             => false,
            'show_in_menu'        => false,
            'show_in_nav_menus'   => false,
            'show_in_admin_bar'   => false,
            'show_in_rest'        => false,
            'exclude_from_search' => true,
            'query_var'           => false,
            'rewrite'             => false,
            'capability_type'     => 'post',
            'has_archive'         => false,
            'hierarchical'        => false,
            'supports'            => [ 'title' ],
            'menu_icon'           => 'dashicons-chart-bar',
        ];

        register_post_type( self::POST_TYPE, $args );
    }

    /**
     * Create a new chart.
     *
     * @since 5.0.0
     *
     * @param string $title  Chart title.
     * @param array  $config Chart configuration data (cols, rows).
     * @param array  $settings Chart settings (chartType, theme, etc.).
     * @return int|false Post ID on success, false on failure.
     */
    public function create_chart( string $title, array $config = [], array $settings = [] ) {
        // Validate user permission.
        if ( ! current_user_can( 'manage_options' ) ) {
            return false;
        }

        // Sanitize title.
        $title = sanitize_text_field( $title );
        if ( empty( $title ) ) {
            $title = __( 'Untitled Chart', 'litestats-pro' );
        }

        // Create post.
        $post_id = wp_insert_post(
            [
                'post_type'   => self::POST_TYPE,
                'post_title'  => $title,
                'post_status' => 'publish',
            ],
            true
        );

        if ( is_wp_error( $post_id ) ) {
            return false;
        }

        // Save configuration.
        $this->update_chart_config( $post_id, $config );
        $this->update_chart_settings( $post_id, $settings );

        return $post_id;
    }

    /**
     * Get a chart by ID.
     *
     * @since 5.0.0
     *
     * @param int $chart_id Chart post ID.
     * @return array|null Chart data or null if not found.
     */
    public function get_chart( int $chart_id ): ?array {
        $post = get_post( $chart_id );

        if ( ! $post || self::POST_TYPE !== $post->post_type ) {
            return null;
        }

        return [
            'id'       => $post->ID,
            'title'    => $post->post_title,
            'config'   => $this->get_chart_config( $chart_id ),
            'settings' => $this->get_chart_settings( $chart_id ),
            'created'  => $post->post_date,
            'modified' => $post->post_modified,
        ];
    }

    /**
     * Update a chart.
     *
     * @since 5.0.0
     *
     * @param int    $chart_id Chart post ID.
     * @param string $title    Chart title.
     * @param array  $config   Chart configuration data.
     * @param array  $settings Chart settings.
     * @return bool True on success, false on failure.
     */
    public function update_chart( int $chart_id, string $title = '', array $config = [], array $settings = [] ): bool {
        // Validate user permission.
        if ( ! current_user_can( 'manage_options' ) ) {
            return false;
        }

        // Verify chart exists.
        $post = get_post( $chart_id );
        if ( ! $post || self::POST_TYPE !== $post->post_type ) {
            return false;
        }

        // Update title if provided.
        if ( ! empty( $title ) ) {
            wp_update_post(
                [
                    'ID'         => $chart_id,
                    'post_title' => sanitize_text_field( $title ),
                ]
            );
        }

        // Update configuration.
        if ( ! empty( $config ) ) {
            $this->update_chart_config( $chart_id, $config );
        }

        // Update settings.
        if ( ! empty( $settings ) ) {
            $this->update_chart_settings( $chart_id, $settings );
        }

        return true;
    }

    /**
     * Delete a chart.
     *
     * @since 5.0.0
     *
     * @param int $chart_id Chart post ID.
     * @return bool True on success, false on failure.
     */
    public function delete_chart( int $chart_id ): bool {
        // Validate user permission.
        if ( ! current_user_can( 'manage_options' ) ) {
            return false;
        }

        // Verify chart exists.
        $post = get_post( $chart_id );
        if ( ! $post || self::POST_TYPE !== $post->post_type ) {
            return false;
        }

        // Delete permanently.
        $result = wp_delete_post( $chart_id, true );

        return false !== $result;
    }

    /**
     * Get all charts.
     *
     * @since 5.0.0
     *
     * @param array $args Query arguments.
     * @return array Array of chart data.
     */
    public function get_all_charts( array $args = [] ): array {
        $defaults = [
            'post_type'      => self::POST_TYPE,
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ];

        $query_args = wp_parse_args( $args, $defaults );
        $posts      = get_posts( $query_args );
        $charts     = [];

        foreach ( $posts as $post ) {
            $charts[] = [
                'id'       => $post->ID,
                'title'    => $post->post_title,
                'config'   => $this->get_chart_config( $post->ID ),
                'settings' => $this->get_chart_settings( $post->ID ),
                'created'  => $post->post_date,
                'modified' => $post->post_modified,
            ];
        }

        return $charts;
    }

    /**
     * Get chart configuration.
     *
     * @since 5.0.0
     *
     * @param int $chart_id Chart post ID.
     * @return array Chart configuration.
     */
    public function get_chart_config( int $chart_id ): array {
        $config = get_post_meta( $chart_id, self::META_KEY_CONFIG, true );

        if ( empty( $config ) || ! is_array( $config ) ) {
            return $this->get_default_config();
        }

        return $config;
    }

    /**
     * Update chart configuration.
     *
     * @since 5.0.0
     *
     * @param int   $chart_id Chart post ID.
     * @param array $config   Chart configuration.
     * @return bool True on success, false on failure.
     */
    public function update_chart_config( int $chart_id, array $config ): bool {
        // Sanitize configuration.
        $sanitized = $this->sanitize_config( $config );

        return (bool) update_post_meta( $chart_id, self::META_KEY_CONFIG, $sanitized );
    }

    /**
     * Get chart settings.
     *
     * @since 5.0.0
     *
     * @param int $chart_id Chart post ID.
     * @return array Chart settings.
     */
    public function get_chart_settings( int $chart_id ): array {
        $settings = get_post_meta( $chart_id, self::META_KEY_SETTINGS, true );

        if ( empty( $settings ) || ! is_array( $settings ) ) {
            return $this->get_default_settings();
        }

        return $settings;
    }

    /**
     * Update chart settings.
     *
     * @since 5.0.0
     *
     * @param int   $chart_id Chart post ID.
     * @param array $settings Chart settings.
     * @return bool True on success, false on failure.
     */
    public function update_chart_settings( int $chart_id, array $settings ): bool {
        // Sanitize settings.
        $sanitized = $this->sanitize_settings( $settings );

        return (bool) update_post_meta( $chart_id, self::META_KEY_SETTINGS, $sanitized );
    }

    /**
     * Get default configuration.
     *
     * @since 5.0.0
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
     * @since 5.0.0
     *
     * @return array Default settings.
     */
    public function get_default_settings(): array {
        return [
            'chartType' => 'bar',
            'theme'     => 'default',
            'stacked'   => false,
            'view'      => 'chart',
            'mode'      => 'value',
        ];
    }

    /**
     * Sanitize configuration data.
     *
     * @since 5.0.0
     *
     * @param array $config Configuration to sanitize.
     * @return array Sanitized configuration.
     */
    private function sanitize_config( array $config ): array {
        $sanitized = [];

        // Sanitize columns.
        if ( isset( $config['cols'] ) && is_array( $config['cols'] ) ) {
            $sanitized['cols'] = [];
            foreach ( $config['cols'] as $col ) {
                if ( ! is_array( $col ) ) {
                    continue;
                }
                $sanitized['cols'][] = [
                    'id'      => isset( $col['id'] ) ? sanitize_key( $col['id'] ) : '',
                    'name'    => isset( $col['name'] ) ? sanitize_text_field( $col['name'] ) : '',
                    'type'    => isset( $col['type'] ) && in_array( $col['type'], [ 'string', 'number', 'formula' ], true )
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

        // Sanitize rows.
        if ( isset( $config['rows'] ) && is_array( $config['rows'] ) ) {
            $sanitized['rows'] = [];
            foreach ( $config['rows'] as $row ) {
                if ( ! is_array( $row ) ) {
                    continue;
                }
                $sanitized['rows'][] = array_map(
                    function ( $cell ) {
                        if ( is_numeric( $cell ) ) {
                            return $cell + 0; // Keep as number.
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
     * @since 5.0.0
     *
     * @param array $settings Settings to sanitize.
     * @return array Sanitized settings.
     */
    private function sanitize_settings( array $settings ): array {
        $sanitized = [];

        // Chart type.
        $valid_chart_types = [ 'bar', 'line', 'pie', 'radar', 'combo' ];
        $sanitized['chartType'] = isset( $settings['chartType'] ) && in_array( $settings['chartType'], $valid_chart_types, true )
            ? $settings['chartType']
            : 'bar';

        // Theme.
        $valid_themes = [ 'default', 'modern', 'pastel', 'dark' ];
        $sanitized['theme'] = isset( $settings['theme'] ) && in_array( $settings['theme'], $valid_themes, true )
            ? $settings['theme']
            : 'default';

        // Stacked.
        $sanitized['stacked'] = isset( $settings['stacked'] ) ? (bool) $settings['stacked'] : false;

        // View.
        $valid_views = [ 'chart', 'table' ];
        $sanitized['view'] = isset( $settings['view'] ) && in_array( $settings['view'], $valid_views, true )
            ? $settings['view']
            : 'chart';

        // Mode.
        $valid_modes = [ 'value', 'percent' ];
        $sanitized['mode'] = isset( $settings['mode'] ) && in_array( $settings['mode'], $valid_modes, true )
            ? $settings['mode']
            : 'value';

        return $sanitized;
    }
}
