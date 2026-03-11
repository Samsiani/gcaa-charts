<?php
/**
 * Admin Charts List Template.
 *
 * Displays a list of all charts with management options.
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

// $charts variable is passed from Admin::render_admin_page()
?>
<div class="wrap litestats-wrap">
    <h1 class="wp-heading-inline">
        <i class="fas fa-chart-bar" style="margin-right: 10px;"></i>
        <?php esc_html_e( 'LiteStats Pro - All Charts', 'litestats-pro' ); ?>
    </h1>
    <a href="<?php echo esc_url( Admin::get_admin_url( 'new' ) ); ?>" class="page-title-action">
        <i class="fas fa-plus"></i>
        <?php esc_html_e( 'Add New', 'litestats-pro' ); ?>
    </a>
    <hr class="wp-header-end">

    <?php if ( empty( $charts ) ) : ?>
        <div class="litestats-empty-state">
            <div class="empty-state-icon">
                <i class="fas fa-chart-line"></i>
            </div>
            <h2><?php esc_html_e( 'No Charts Yet', 'litestats-pro' ); ?></h2>
            <p><?php esc_html_e( 'Create your first data visualization chart to get started.', 'litestats-pro' ); ?></p>
            <a href="<?php echo esc_url( Admin::get_admin_url( 'new' ) ); ?>" class="button button-primary button-hero">
                <i class="fas fa-plus"></i>
                <?php esc_html_e( 'Create Your First Chart', 'litestats-pro' ); ?>
            </a>
        </div>
    <?php else : ?>
        <table class="wp-list-table widefat fixed striped litestats-charts-table">
            <thead>
                <tr>
                    <th scope="col" class="column-title column-primary">
                        <?php esc_html_e( 'Title', 'litestats-pro' ); ?>
                    </th>
                    <th scope="col" class="column-shortcode">
                        <?php esc_html_e( 'Shortcode', 'litestats-pro' ); ?>
                    </th>
                    <th scope="col" class="column-type">
                        <?php esc_html_e( 'Type', 'litestats-pro' ); ?>
                    </th>
                    <th scope="col" class="column-rows">
                        <?php esc_html_e( 'Rows', 'litestats-pro' ); ?>
                    </th>
                    <th scope="col" class="column-date">
                        <?php esc_html_e( 'Date', 'litestats-pro' ); ?>
                    </th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ( $charts as $chart ) : ?>
                    <tr>
                        <td class="column-title column-primary">
                            <strong>
                                <a href="<?php echo esc_url( Admin::get_admin_url( 'edit', [ 'chart_id' => $chart['id'] ] ) ); ?>" class="row-title">
                                    <?php echo esc_html( $chart['title'] ); ?>
                                </a>
                            </strong>
                            <div class="row-actions">
                                <span class="edit">
                                    <a href="<?php echo esc_url( Admin::get_admin_url( 'edit', [ 'chart_id' => $chart['id'] ] ) ); ?>">
                                        <?php esc_html_e( 'Edit', 'litestats-pro' ); ?>
                                    </a> |
                                </span>
                                <span class="trash">
                                    <a href="#" class="delete-chart" data-chart-id="<?php echo esc_attr( $chart['id'] ); ?>" data-nonce="<?php echo esc_attr( wp_create_nonce( 'litestats_pro_nonce' ) ); ?>">
                                        <?php esc_html_e( 'Delete', 'litestats-pro' ); ?>
                                    </a>
                                </span>
                            </div>
                        </td>
                        <td class="column-shortcode">
                            <code class="litestats-shortcode-copy" title="<?php esc_attr_e( 'Click to copy', 'litestats-pro' ); ?>">
                                [litestats id="<?php echo esc_attr( $chart['id'] ); ?>"]
                            </code>
                        </td>
                        <td class="column-type">
                            <?php
                            $type_label = ucfirst( $chart['settings']['chartType'] ?? 'bar' );
                            echo esc_html( $type_label );
                            ?>
                        </td>
                        <td class="column-rows">
                            <?php echo esc_html( count( $chart['config']['rows'] ?? [] ) ); ?>
                        </td>
                        <td class="column-date">
                            <?php echo esc_html( date_i18n( get_option( 'date_format' ), strtotime( $chart['modified'] ) ) ); ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // Copy shortcode on click.
    document.querySelectorAll('.litestats-shortcode-copy').forEach(function(el) {
        el.addEventListener('click', function() {
            navigator.clipboard.writeText(this.textContent.trim()).then(function() {
                alert('<?php echo esc_js( __( 'Shortcode copied to clipboard!', 'litestats-pro' ) ); ?>');
            });
        });
    });

    // Delete chart.
    document.querySelectorAll('.delete-chart').forEach(function(el) {
        el.addEventListener('click', function(e) {
            e.preventDefault();
            if (!confirm('<?php echo esc_js( __( 'Are you sure you want to delete this chart?', 'litestats-pro' ) ); ?>')) {
                return;
            }

            var chartId = this.dataset.chartId;
            var nonce = this.dataset.nonce;
            var row = this.closest('tr');

            fetch('<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=litestats_delete_chart&chart_id=' + chartId + '&nonce=' + nonce
            })
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success) {
                    row.remove();
                } else {
                    alert(data.data.message || '<?php echo esc_js( __( 'Error deleting chart.', 'litestats-pro' ) ); ?>');
                }
            })
            .catch(function() {
                alert('<?php echo esc_js( __( 'Error deleting chart.', 'litestats-pro' ) ); ?>');
            });
        });
    });
});
</script>
