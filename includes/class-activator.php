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
     * DB version for schema upgrades.
     */
    public const DB_VERSION = '1.0';

    /**
     * Plugin activation handler.
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

        // Create custom table.
        self::create_table();

        // Migrate from CPT if needed.
        self::migrate_from_cpt();

        // Set default options.
        self::set_default_options();

        // Store activation time.
        update_option( 'litestats_pro_activated', time() );
    }

    /**
     * Plugin deactivation handler.
     *
     * @since 5.0.0
     */
    public static function deactivate(): void {
        // Nothing to clean up.
    }

    /**
     * Create the custom charts table.
     *
     * @since 6.0.0
     */
    public static function create_table(): void {
        global $wpdb;

        $table_name      = $wpdb->prefix . 'litestats_charts';
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table_name} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL DEFAULT '',
            config LONGTEXT NOT NULL,
            settings LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );

        update_option( 'litestats_pro_db_version', self::DB_VERSION );
    }

    /**
     * One-time migration from CPT to custom table.
     *
     * @since 6.0.0
     */
    public static function migrate_from_cpt(): void {
        global $wpdb;

        // Skip if already migrated.
        if ( get_option( 'litestats_pro_id_map' ) ) {
            return;
        }

        $table_name = $wpdb->prefix . 'litestats_charts';

        // Check if CPT posts exist.
        $posts = $wpdb->get_results(
            "SELECT ID, post_title, post_date, post_modified
             FROM {$wpdb->posts}
             WHERE post_type = 'litestats_chart'
               AND post_status = 'publish'
             ORDER BY ID ASC"
        );

        if ( empty( $posts ) ) {
            // No CPT data to migrate, store empty map.
            update_option( 'litestats_pro_id_map', [] );
            return;
        }

        $id_map = [];

        foreach ( $posts as $post ) {
            $config_raw  = get_post_meta( (int) $post->ID, '_litestats_chart_config', true );
            $settings_raw = get_post_meta( (int) $post->ID, '_litestats_chart_settings', true );

            $config_json  = is_array( $config_raw ) ? wp_json_encode( $config_raw ) : '{}';
            $settings_json = is_array( $settings_raw ) ? wp_json_encode( $settings_raw ) : '{}';

            $wpdb->insert(
                $table_name,
                [
                    'title'      => $post->post_title,
                    'config'     => $config_json,
                    'settings'   => $settings_json,
                    'created_at' => $post->post_date,
                    'updated_at' => $post->post_modified,
                ],
                [ '%s', '%s', '%s', '%s', '%s' ]
            );

            $new_id = $wpdb->insert_id;
            if ( $new_id ) {
                $id_map[ (int) $post->ID ] = (int) $new_id;
            }
        }

        update_option( 'litestats_pro_id_map', $id_map );
    }

    /**
     * Set default plugin options.
     *
     * @since 5.0.0
     */
    private static function set_default_options(): void {
        $defaults = [
            'version'            => LITESTATS_PRO_VERSION,
            'default_chart_type' => 'bar',
            'default_theme'      => 'default',
        ];

        if ( ! get_option( 'litestats_pro_settings' ) ) {
            add_option( 'litestats_pro_settings', $defaults );
        }
    }
}
