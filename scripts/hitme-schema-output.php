<?php
/**
 * Plugin Name: HitMe CRM Schema Output
 * Description: Renders JSON-LD schema markup from the _hitme_schema meta field into the page <head>.
 *              Works with the HitMe SEO CRM push-schema endpoint.
 * Version: 1.0.0
 * Author: HitMe SEO
 *
 * INSTALLATION:
 *   1. Upload this file to: wp-content/mu-plugins/hitme-schema-output.php
 *   2. That's it — mu-plugins are auto-loaded by WordPress.
 *
 * HOW IT WORKS:
 *   - The CRM stores an array of JSON-LD schema objects in the `_hitme_schema` post meta field
 *     via the WordPress REST API.
 *   - This plugin reads that meta field on singular pages/posts and outputs each schema object
 *     as a <script type="application/ld+json"> tag in the <head>.
 *   - The meta field is registered with the REST API so it can be read/written via the API.
 */

// Prevent direct access
if (!defined('ABSPATH')) exit;

/**
 * Register the _hitme_schema meta field for the REST API.
 * This allows the CRM to read/write it via WP REST API endpoints.
 */
add_action('init', function () {
    // Register for pages
    register_post_meta('page', '_hitme_schema', [
        'show_in_rest'  => true,
        'single'        => true,
        'type'          => 'string',
        'description'   => 'JSON-LD schema markup from HitMe SEO CRM',
        'auth_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);

    // Register for posts too (in case schema is added to blog posts)
    register_post_meta('post', '_hitme_schema', [
        'show_in_rest'  => true,
        'single'        => true,
        'type'          => 'string',
        'description'   => 'JSON-LD schema markup from HitMe SEO CRM',
        'auth_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);
});

/**
 * Output JSON-LD schema in the <head> on singular pages/posts.
 */
add_action('wp_head', function () {
    // Only run on singular pages/posts (not archives, home, etc.)
    if (!is_singular()) return;

    $post_id = get_the_ID();
    if (!$post_id) return;

    $schema_json = get_post_meta($post_id, '_hitme_schema', true);
    if (empty($schema_json)) return;

    // Decode the JSON string — it should be an array of schema objects
    $schemas = json_decode($schema_json, true);
    if (!is_array($schemas) || empty($schemas)) return;

    // Output each schema as a separate <script> tag
    echo "\n<!-- HitMe SEO CRM Schema Markup -->\n";
    foreach ($schemas as $schema) {
        if (is_array($schema) && !empty($schema)) {
            $json = wp_json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            echo '<script type="application/ld+json">' . $json . "</script>\n";
        }
    }
    echo "<!-- /HitMe SEO CRM Schema Markup -->\n";
}, 1); // Priority 1 = runs early in wp_head
