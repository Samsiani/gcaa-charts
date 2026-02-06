<?php
/**
 * Plugin Name:       LiteStats Pro
 * Plugin URI:        https://github.com/Samsiani/gcaa-charts
 * Description:       High-Performance, Enterprise-Grade Data Visualization plugin with Math Engine, Drag & Drop, History, and Chart.js rendering.
 * Version:           5.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Samsiani
 * Author URI:        https://github.com/Samsiani
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       litestats-pro
 * Domain Path:       /languages
 *
 * @package LiteStats\Pro
 */

declare(strict_types=1);

namespace LiteStats\Pro;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Plugin constants.
define( 'LITESTATS_PRO_VERSION', '5.0.0' );
define( 'LITESTATS_PRO_PLUGIN_FILE', __FILE__ );
define( 'LITESTATS_PRO_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'LITESTATS_PRO_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'LITESTATS_PRO_BASENAME', plugin_basename( __FILE__ ) );

/**
 * Main LiteStats Pro Plugin Class.
 *
 * Implements the Singleton pattern to ensure only one instance
 * of the plugin is loaded at any time.
 *
 * @since 5.0.0
 */
final class LiteStatsPro {

    /**
     * Singleton instance.
     *
     * @var LiteStatsPro|null
     */
    private static ?LiteStatsPro $instance = null;

    /**
     * Admin handler instance.
     *
     * @var Admin|null
     */
    private ?Admin $admin = null;

    /**
     * Data handler instance.
     *
     * @var DataHandler|null
     */
    private ?DataHandler $data_handler = null;

    /**
     * AJAX handler instance.
     *
     * @var Ajax|null
     */
    private ?Ajax $ajax = null;

    /**
     * Shortcode handler instance.
     *
     * @var Shortcode|null
     */
    private ?Shortcode $shortcode = null;

    /**
     * Get the singleton instance.
     *
     * @since 5.0.0
     * @return LiteStatsPro
     */
    public static function get_instance(): LiteStatsPro {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Private constructor to prevent direct instantiation.
     *
     * @since 5.0.0
     */
    private function __construct() {
        $this->load_dependencies();
        $this->init_hooks();
    }

    /**
     * Prevent cloning of the instance.
     *
     * @since 5.0.0
     */
    private function __clone() {}

    /**
     * Prevent unserializing of the instance.
     *
     * @since 5.0.0
     * @throws \Exception When attempting to unserialize.
     */
    public function __wakeup() {
        throw new \Exception( 'Cannot unserialize singleton' );
    }

    /**
     * Load required dependencies.
     *
     * @since 5.0.0
     */
    private function load_dependencies(): void {
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-activator.php';
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-data-handler.php';
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-admin.php';
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-ajax.php';
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-shortcode.php';
    }

    /**
     * Initialize WordPress hooks.
     *
     * @since 5.0.0
     */
    private function init_hooks(): void {
        // Register activation hook.
        register_activation_hook( LITESTATS_PRO_PLUGIN_FILE, [ Activator::class, 'activate' ] );

        // Register deactivation hook.
        register_deactivation_hook( LITESTATS_PRO_PLUGIN_FILE, [ Activator::class, 'deactivate' ] );

        // Initialize components on plugins_loaded.
        add_action( 'plugins_loaded', [ $this, 'init_components' ] );
    }

    /**
     * Initialize plugin components.
     *
     * @since 5.0.0
     */
    public function init_components(): void {
        // Initialize data handler (registers CPT).
        $this->data_handler = new DataHandler();

        // Initialize admin if in admin context.
        if ( is_admin() ) {
            $this->admin = new Admin();
            $this->ajax  = new Ajax( $this->data_handler );
        }

        // Initialize shortcode handler.
        $this->shortcode = new Shortcode( $this->data_handler );
    }

    /**
     * Get the admin handler instance.
     *
     * @since 5.0.0
     * @return Admin|null
     */
    public function get_admin(): ?Admin {
        return $this->admin;
    }

    /**
     * Get the data handler instance.
     *
     * @since 5.0.0
     * @return DataHandler|null
     */
    public function get_data_handler(): ?DataHandler {
        return $this->data_handler;
    }

    /**
     * Get the AJAX handler instance.
     *
     * @since 5.0.0
     * @return Ajax|null
     */
    public function get_ajax(): ?Ajax {
        return $this->ajax;
    }

    /**
     * Get the shortcode handler instance.
     *
     * @since 5.0.0
     * @return Shortcode|null
     */
    public function get_shortcode(): ?Shortcode {
        return $this->shortcode;
    }
}

// Initialize the plugin.
LiteStatsPro::get_instance();
