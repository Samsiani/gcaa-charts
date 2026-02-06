<?php
/**
 * Plugin Activator Class.
 *
 * Handles all activation and deactivation hooks for the plugin.
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
 * Activator class.
 *
 * @since 5.0.0
 */
class Activator {

    /**
     * Plugin activation handler.
     *
     * Runs on plugin activation. Sets up default options,
     * registers CPT, and flushes rewrite rules.
     *
     * @since 5.0.0
     */
    public static function activate(): void {
        // Check minimum PHP version.
        if ( version_compare( PHP_VERSION, '7.4', '<' ) ) {
            deactivate_plugins( LITESTATS_PRO_BASENAME );
            wp_die(
                esc_html__( 'LiteStats Pro requires PHP 7.4 or higher.', 'litestats-pro' ),
                esc_html__( 'Plugin Activation Error', 'litestats-pro' ),
                [ 'back_link' => true ]
            );
        }

        // Check minimum WordPress version.
        if ( version_compare( get_bloginfo( 'version' ), '5.8', '<' ) ) {
            deactivate_plugins( LITESTATS_PRO_BASENAME );
            wp_die(
                esc_html__( 'LiteStats Pro requires WordPress 5.8 or higher.', 'litestats-pro' ),
                esc_html__( 'Plugin Activation Error', 'litestats-pro' ),
                [ 'back_link' => true ]
            );
        }

        // Register CPT to flush rewrite rules.
        self::register_post_type();

        // Set default options.
        self::set_default_options();

        // Flush rewrite rules.
        flush_rewrite_rules();

        // Store activation time.
        update_option( 'litestats_pro_activated', time() );
    }

    /**
     * Plugin deactivation handler.
     *
     * Runs on plugin deactivation. Cleans up temporary data
     * and flushes rewrite rules.
     *
     * @since 5.0.0
     */
    public static function deactivate(): void {
        // Flush rewrite rules.
        flush_rewrite_rules();
    }

    /**
     * Register the custom post type.
     *
     * Used during activation to ensure rewrite rules are properly flushed.
     *
     * @since 5.0.0
     */
    private static function register_post_type(): void {
        register_post_type(
            'litestats_chart',
            [
                'labels'       => [
                    'name'          => __( 'LiteStats Charts', 'litestats-pro' ),
                    'singular_name' => __( 'LiteStats Chart', 'litestats-pro' ),
                ],
                'public'       => false,
                'show_ui'      => false,
                'show_in_menu' => false,
                'show_in_rest' => false,
                'supports'     => [ 'title' ],
                'rewrite'      => false,
                'query_var'    => false,
            ]
        );
    }

    /**
     * Set default plugin options.
     *
     * @since 5.0.0
     */
    private static function set_default_options(): void {
        // Default settings.
        $defaults = [
            'version'           => LITESTATS_PRO_VERSION,
            'default_chart_type' => 'bar',
            'default_theme'      => 'default',
        ];

        // Only set if not already present.
        if ( ! get_option( 'litestats_pro_settings' ) ) {
            add_option( 'litestats_pro_settings', $defaults );
        }
    }
}
