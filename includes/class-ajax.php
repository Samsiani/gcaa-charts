<?php
/**
 * AJAX Handler Class.
 *
 * Handles all AJAX requests for saving and loading chart data.
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
 * Ajax class.
 *
 * @since 5.0.0
 */
class Ajax {

    /**
     * Data handler instance.
     *
     * @var DataHandler
     */
    private DataHandler $data_handler;

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
        add_action( 'wp_ajax_litestats_save_chart', [ $this, 'save_chart' ] );
        add_action( 'wp_ajax_litestats_load_chart', [ $this, 'load_chart' ] );
        add_action( 'wp_ajax_litestats_delete_chart', [ $this, 'delete_chart' ] );
        add_action( 'wp_ajax_litestats_get_charts', [ $this, 'get_charts' ] );
    }

    /**
     * Verify AJAX request security.
     *
     * @return bool True if valid, dies with error otherwise.
     */
    private function verify_request(): bool {
        if ( ! check_ajax_referer( 'litestats_pro_nonce', 'nonce', false ) ) {
            wp_send_json_error(
                [
                    'message' => __( 'Security check failed.', 'litestats-pro' ),
                    'code'    => 'invalid_nonce',
                ],
                403
            );
            return false;
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error(
                [
                    'message' => __( 'You do not have permission to perform this action.', 'litestats-pro' ),
                    'code'    => 'insufficient_permissions',
                ],
                403
            );
            return false;
        }

        return true;
    }

    /**
     * Save chart AJAX handler.
     */
    public function save_chart(): void {
        if ( ! $this->verify_request() ) {
            return;
        }

        $chart_id = isset( $_POST['chart_id'] ) ? absint( $_POST['chart_id'] ) : 0;
        $title    = isset( $_POST['title'] ) ? sanitize_text_field( wp_unslash( $_POST['title'] ) ) : '';

        $config   = [];
        $settings = [];

        if ( isset( $_POST['config'] ) ) {
            // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
            $config_json = wp_unslash( $_POST['config'] );
            $config      = json_decode( $config_json, true );

            if ( json_last_error() !== JSON_ERROR_NONE || ! is_array( $config ) ) {
                wp_send_json_error(
                    [
                        'message' => __( 'Invalid configuration data.', 'litestats-pro' ),
                        'code'    => 'invalid_json',
                    ],
                    400
                );
                return;
            }
        }

        if ( isset( $_POST['settings'] ) ) {
            // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
            $settings_json = wp_unslash( $_POST['settings'] );
            $settings      = json_decode( $settings_json, true );

            if ( json_last_error() !== JSON_ERROR_NONE || ! is_array( $settings ) ) {
                wp_send_json_error(
                    [
                        'message' => __( 'Invalid settings data.', 'litestats-pro' ),
                        'code'    => 'invalid_json',
                    ],
                    400
                );
                return;
            }
        }

        if ( $chart_id > 0 ) {
            $result = $this->data_handler->update_chart( $chart_id, $title, $config, $settings );

            if ( $result ) {
                wp_send_json_success(
                    [
                        'message'  => __( 'Chart updated successfully.', 'litestats-pro' ),
                        'chart_id' => $chart_id,
                    ]
                );
            } else {
                wp_send_json_error(
                    [
                        'message' => __( 'Failed to update chart.', 'litestats-pro' ),
                        'code'    => 'update_failed',
                    ],
                    500
                );
            }
        } else {
            $new_id = $this->data_handler->create_chart( $title, $config, $settings );

            if ( $new_id ) {
                wp_send_json_success(
                    [
                        'message'  => __( 'Chart created successfully.', 'litestats-pro' ),
                        'chart_id' => $new_id,
                    ]
                );
            } else {
                wp_send_json_error(
                    [
                        'message' => __( 'Failed to create chart.', 'litestats-pro' ),
                        'code'    => 'create_failed',
                    ],
                    500
                );
            }
        }
    }

    /**
     * Load chart AJAX handler.
     */
    public function load_chart(): void {
        if ( ! $this->verify_request() ) {
            return;
        }

        $chart_id = isset( $_POST['chart_id'] ) ? absint( $_POST['chart_id'] ) : 0;

        if ( $chart_id <= 0 ) {
            wp_send_json_error(
                [
                    'message' => __( 'Invalid chart ID.', 'litestats-pro' ),
                    'code'    => 'invalid_id',
                ],
                400
            );
            return;
        }

        $chart = $this->data_handler->get_chart( $chart_id );

        if ( $chart ) {
            wp_send_json_success( $chart );
        } else {
            wp_send_json_error(
                [
                    'message' => __( 'Chart not found.', 'litestats-pro' ),
                    'code'    => 'not_found',
                ],
                404
            );
        }
    }

    /**
     * Delete chart AJAX handler.
     */
    public function delete_chart(): void {
        if ( ! $this->verify_request() ) {
            return;
        }

        $chart_id = isset( $_POST['chart_id'] ) ? absint( $_POST['chart_id'] ) : 0;

        if ( $chart_id <= 0 ) {
            wp_send_json_error(
                [
                    'message' => __( 'Invalid chart ID.', 'litestats-pro' ),
                    'code'    => 'invalid_id',
                ],
                400
            );
            return;
        }

        $result = $this->data_handler->delete_chart( $chart_id );

        if ( $result ) {
            wp_send_json_success(
                [
                    'message' => __( 'Chart deleted successfully.', 'litestats-pro' ),
                ]
            );
        } else {
            wp_send_json_error(
                [
                    'message' => __( 'Failed to delete chart.', 'litestats-pro' ),
                    'code'    => 'delete_failed',
                ],
                500
            );
        }
    }

    /**
     * Get all charts AJAX handler.
     */
    public function get_charts(): void {
        if ( ! $this->verify_request() ) {
            return;
        }

        $charts = $this->data_handler->get_all_charts();

        wp_send_json_success( $charts );
    }
}
