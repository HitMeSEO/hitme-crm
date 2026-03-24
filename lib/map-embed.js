// lib/map-embed.js
// Generates Google Maps embed HTML for location pages.
//
// Uses the Google Maps Embed API (free, unlimited) to show the client's
// GBP listing pin on the page. For service area pages where the business
// isn't physically located, it searches for the business name in the
// target city so the map shows the right area.
//
// Two modes:
// 1. place_id mode (preferred) — embeds the exact GBP listing with reviews, hours, directions
// 2. search mode (fallback) — searches for "Business Name City State" and shows top result

/**
 * Build a Google Maps embed iframe HTML block.
 *
 * @param {Object} options
 * @param {string} options.apiKey        - Google Maps API key (same as Places API key)
 * @param {string} [options.placeId]     - GBP place_id for exact listing embed
 * @param {string} [options.businessName] - Business name for search fallback
 * @param {string} [options.city]        - Target city for the page
 * @param {string} [options.state]       - Target state for the page
 * @param {string} [options.fullAddress] - Full business address for single-location embed
 * @returns {string} HTML string with the map embed wrapped in a styled container
 */
export function buildMapEmbed({ apiKey, placeId, businessName, city, state, fullAddress }) {
  if (!apiKey) return '';

  let embedUrl;

  if (placeId) {
    // Mode 1: Exact GBP listing embed — shows pin, reviews, hours, directions
    embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=place_id:${placeId}`;
  } else if (businessName && city) {
    // Mode 2: Search-based embed — finds the business in the target city
    const query = encodeURIComponent(`${businessName} ${city}${state ? ', ' + state : ''}`);
    embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}`;
  } else if (fullAddress) {
    // Mode 3: Address-based embed
    const query = encodeURIComponent(fullAddress);
    embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}`;
  } else {
    return '';
  }

  // Return clean, responsive iframe HTML
  // The container uses inline styles for maximum WordPress theme compatibility
  return `
<div style="margin-top:40px;margin-bottom:20px;">
<h2 style="margin-bottom:15px;">Our Service Area</h2>
<div style="position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
<iframe src="${embedUrl}" width="100%" height="100%" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
</div>
</div>`.trim();
}

/**
 * Build a map embed for a content item using client + location data.
 * This is the main function used by the generate and publish routes.
 *
 * @param {Object} client    - Client record from Supabase
 * @param {Object} location  - Location record from Supabase (for service area pages)
 * @param {string} pageType  - 'service_location_page', 'blog_post', 'gbp_post', etc.
 * @returns {string} HTML map embed or empty string if not applicable
 */
export function buildMapEmbedForContent(client, location, pageType) {
  // Only add maps to service location pages (not blog posts or GBP posts)
  if (pageType === 'gbp_post' || pageType === 'blog_post') return '';

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return '';

  const city = location?.address_city || client?.address_city || '';
  const state = location?.address_state || client?.address_state || '';
  const businessName = client?.company_name || '';
  const placeId = client?.gbp_place_id || '';

  if (!city && !placeId) return '';

  return buildMapEmbed({
    apiKey,
    placeId,
    businessName,
    city,
    state,
  });
}
