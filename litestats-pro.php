<?php
/**
 * Plugin Name:       LiteStats Pro
 * Plugin URI:        https://github.com/Samsiani/gcaa-charts
 * Description:       High-Performance, Enterprise-Grade Data Visualization plugin with Math Engine, Drag & Drop, History, and Chart.js rendering.
 * Version:           6.3.0
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
define( 'LITESTATS_PRO_VERSION', '6.3.0' );
define( 'LITESTATS_PRO_PLUGIN_FILE', __FILE__ );
define( 'LITESTATS_PRO_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'LITESTATS_PRO_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'LITESTATS_PRO_BASENAME', plugin_basename( __FILE__ ) );

/**
 * Main LiteStats Pro Plugin Class.
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
     * @return LiteStatsPro
     */
    public static function get_instance(): LiteStatsPro {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Private constructor.
     */
    private function __construct() {
        $this->load_dependencies();
        $this->init_hooks();
    }

    private function __clone() {}

    public function __wakeup() {
        throw new \Exception( 'Cannot unserialize singleton' );
    }

    /**
     * Load required dependencies.
     */
    private function load_dependencies(): void {
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-activator.php';
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-data-handler.php';
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-admin.php';
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-ajax.php';
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-shortcode.php';
        require_once LITESTATS_PRO_PLUGIN_DIR . 'includes/class-updater.php';
    }

    /**
     * Initialize WordPress hooks.
     */
    private function init_hooks(): void {
        register_activation_hook( LITESTATS_PRO_PLUGIN_FILE, [ Activator::class, 'activate' ] );
        register_deactivation_hook( LITESTATS_PRO_PLUGIN_FILE, [ Activator::class, 'deactivate' ] );

        add_action( 'plugins_loaded', [ $this, 'init_components' ] );
    }

    /**
     * Initialize plugin components.
     */
    public function init_components(): void {
        // DB upgrade check.
        $stored_version = get_option( 'litestats_pro_db_version', '0' );
        if ( version_compare( $stored_version, Activator::DB_VERSION, '<' ) ) {
            Activator::create_table();
            Activator::migrate_from_cpt();
        }

        // Initialize data handler.
        $this->data_handler = new DataHandler();

        // Initialize admin if in admin context.
        if ( is_admin() ) {
            $this->admin = new Admin();
            $this->ajax  = new Ajax( $this->data_handler );
        }

        // Initialize shortcode handler.
        $this->shortcode = new Shortcode( $this->data_handler );
    }

    public function get_admin(): ?Admin {
        return $this->admin;
    }

    public function get_data_handler(): ?DataHandler {
        return $this->data_handler;
    }

    public function get_ajax(): ?Ajax {
        return $this->ajax;
    }

    public function get_shortcode(): ?Shortcode {
        return $this->shortcode;
    }
}

// Initialize the plugin.
LiteStatsPro::get_instance();

// Initialize GitHub auto-updater.
new Updater( __FILE__, 'Samsiani', 'gcaa-charts', LITESTATS_PRO_VERSION );
