import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Generate UNIQUE, page-specific schema markup for content items.
// Each page gets schema that describes THAT specific page — not duplicated boilerplate.
//
// Service pages get:
//   1. Service schema — describes the specific service + area served on this page
//   2. BreadcrumbList — page hierarchy (Home → Services → This Page)
//   3. FAQPage — only if actual FAQ Q&A pairs exist in the body HTML
//   4. LocalBusiness reference (lightweight @id pointer, not full duplicate)
//
// This avoids the Google penalty pattern of identical LocalBusiness blocks on every page.

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { content_id, client_id, bulk } = await request.json();

    if (!client_id) {
      return NextResponse.json({ error: 'client_id required' }, { status: 400 });
    }

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { data: settings } = await supabase
      .from('client_settings')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    let query = supabase
      .from('content_queue')
      .select('*')
      .eq('client_id', client_id)
      .eq('content_type', 'service_location_page');

    if (content_id && !bulk) {
      query = query.eq('id', content_id);
    } else if (!bulk) {
      query = query.is('schema_json', null);
    }

    const { data: items } = await query;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: 'No items need schema' });
    }

    const locationIds = [...new Set(items.filter(i => i.location_id).map(i => i.location_id))];
    const { data: locations } = await supabase
      .from('locations')
      .select('*')
      .in('id', locationIds.length > 0 ? locationIds : ['none']);

    const locMap = {};
    (locations || []).forEach(l => { locMap[l.id] = l; });

    let updated = 0;

    for (const item of items) {
      const schemaJson = buildPageSchema(item, client, settings, locMap);

      await supabase.from('content_queue').update({
        schema_json: schemaJson,
      }).eq('id', item.id);

      updated++;
    }

    return NextResponse.json({ success: true, updated, total_items: items.length });

  } catch (err) {
    console.error('Schema generation error:', err);
    return NextResponse.json({ error: err.message || 'Schema generation failed' }, { status: 500 });
  }
}

// Exported so preview-schema can reuse it
export function buildPageSchema(item, client, settings, locMap) {
  const loc = locMap?.[item.location_id] || {};
  const city = loc.address_city || client.address_city || '';
  const state = loc.address_state || client.address_state || '';
  const street = loc.address_street || client.address_street || '';
  const zip = loc.address_zip || client.address_zip || '';
  const website = client.website?.replace(/\/+$/, '') || '';

  // Extract the specific service name AND area from the page title/h1
  // e.g. "Tree Removal in Charlotte, NC — AAA Tree Service" → service: "Tree Removal", area: "Charlotte"
  // e.g. "Ballantyne NC Gutter Contractor" → service: "Gutter Contractor", area: "Ballantyne"
  const rawTitle = item.h1 || item.title_tag || item.title || '';
  const { service: extractedService, area: extractedArea } = extractServiceAndArea(rawTitle, city, state, client.company_name);
  const pageService = extractedService;
  const pageArea = extractedArea || city; // Fall back to client city if no area extracted
  const pageUrl = item.published_url || (website && item.url_slug ? `${website}/${item.url_slug}` : '');

  // Extract a short description from the meta description or first paragraph of body
  const pageDescription = item.meta_description || extractFirstParagraph(item.body_html || '') || `${pageService} in ${pageArea}, ${state}`;

  const schemas = {};

  // ===== 1. SERVICE SCHEMA (unique per page) =====
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': pageUrl ? `${pageUrl}#service` : undefined,
    name: pageService || item.h1 || item.title || '',
    description: pageDescription,
    provider: {
      '@type': 'LocalBusiness',
      '@id': `${website}#business`,
      name: client.company_name,
      ...(client.phone ? { telephone: client.phone } : {}),
      ...(website ? { url: website } : {}),
    },
    areaServed: {
      '@type': 'City',
      name: pageArea,
      ...(state ? { containedInPlace: { '@type': 'State', name: state } } : {}),
    },
    ...(pageUrl ? { url: pageUrl } : {}),
  };

  // Add rating to the provider reference if available
  if (client.gbp_rating && client.gbp_review_count) {
    serviceSchema.provider.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: client.gbp_rating,
      reviewCount: client.gbp_review_count,
    };
  }

  // Add address to provider
  if (city) {
    serviceSchema.provider.address = {
      '@type': 'PostalAddress',
      ...(street ? { streetAddress: street } : {}),
      addressLocality: city,
      addressRegion: state,
      ...(zip ? { postalCode: zip } : {}),
    };
  }

  // Add GBP sameAs
  if (client.gbp_maps_url) {
    serviceSchema.provider.sameAs = [client.gbp_maps_url];
  }

  // ===== IMAGE — tie a unique image to this specific page =====
  // Each page MUST have its own image. Reusing the same image across pages
  // dilutes ranking signals (this is why directory sites like Yellowbook tanked).
  if (item.image_url) {
    serviceSchema.image = {
      '@type': 'ImageObject',
      url: item.image_url,
      caption: `${pageService} in ${pageArea}, ${state} — ${client.company_name}`,
      // If we have the content item's title, use it as the image name for uniqueness
      name: `${pageService} ${pageArea} ${state}`.trim(),
    };
  }

  // Add offers/serviceType for extra uniqueness signal per page
  if (pageService && pageService !== rawTitle) {
    serviceSchema.serviceType = pageService;
  }

  // Add geo coordinates if the location has them (makes each page geographically unique)
  if (loc.latitude && loc.longitude) {
    serviceSchema.areaServed.geo = {
      '@type': 'GeoCoordinates',
      latitude: loc.latitude,
      longitude: loc.longitude,
    };
  }

  schemas.service = serviceSchema;

  // ===== 2. BREADCRUMB SCHEMA (unique per page) =====
  if (website) {
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: website,
        },
      ],
    };

    // Add city level if the page is for a specific city
    if (pageArea) {
      breadcrumb.itemListElement.push({
        '@type': 'ListItem',
        position: 2,
        name: `${pageArea}, ${state}`,
      });
    }

    // Add the specific page
    if (pageUrl) {
      breadcrumb.itemListElement.push({
        '@type': 'ListItem',
        position: breadcrumb.itemListElement.length + 1,
        name: pageService || item.title || '',
        item: pageUrl,
      });
    }

    schemas.breadcrumb = breadcrumb;
  }

  // ===== 3. FAQ SCHEMA (unique — extracted from THIS page's actual content) =====
  if (item.body_html) {
    const faqRegex = /<h3[^>]*>([^<]*\?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
    const faqItems = [];
    let match;
    while ((match = faqRegex.exec(item.body_html)) !== null) {
      const question = match[1].trim();
      const answer = match[2].replace(/<[^>]+>/g, '').trim();
      if (question.endsWith('?') && answer.length >= 10) {
        faqItems.push({
          '@type': 'Question',
          name: question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: answer,
          },
        });
      }
    }

    if (faqItems.length > 0) {
      schemas.faq = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems,
      };
    }
  }

  // ===== 4. WEBPAGE SCHEMA (ties everything together with primaryImageOfPage) =====
  // This is the strongest signal to Google: "this image belongs to THIS page"
  if (pageUrl) {
    const webpageSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': pageUrl,
      url: pageUrl,
      name: rawTitle,
      description: pageDescription,
      isPartOf: website ? { '@id': `${website}#website` } : undefined,
      about: { '@id': pageUrl ? `${pageUrl}#service` : undefined },
      // datePublished helps Google see each page as a unique document with its own timeline
      ...(item.published_at ? { datePublished: new Date(item.published_at).toISOString().split('T')[0] } : {}),
    };

    // primaryImageOfPage — the critical unique image signal
    if (item.image_url) {
      webpageSchema.primaryImageOfPage = {
        '@type': 'ImageObject',
        '@id': `${pageUrl}#primaryimage`,
        url: item.image_url,
        caption: `${pageService} in ${pageArea}, ${state}`,
        // Tie the image to the page's content ID for traceability
        contentUrl: item.image_url,
      };
    }

    schemas.webpage = webpageSchema;
  }

  return schemas;
}

// Extract both the service name AND area from a page title.
// Handles multiple formats:
//   "Tree Removal in Charlotte, NC — AAA Tree Service" → { service: "Tree Removal", area: "Charlotte" }
//   "Ballantyne NC Gutter Contractor" → { service: "Gutter Contractor", area: "Ballantyne" }
//   "Mooresville NC Siding Contractor" → { service: "Siding Contractor", area: "Mooresville" }
//   "Roof Replacement Charlotte NC | Company" → { service: "Roof Replacement", area: "Charlotte" }
function extractServiceAndArea(title, clientCity, state, companyName) {
  let work = title;
  let area = '';

  // Remove company name (after — or | delimiter)
  if (companyName) {
    work = work.replace(new RegExp(`\\s*[—–|\\|]\\s*${escapeRegex(companyName)}.*$`, 'i'), '');
  }

  // Pattern 1: "Service in City, State"
  const inPattern = work.match(/^(.+?)\s+in\s+([A-Z][a-zA-Z\s]+?)(?:[,\s]+([A-Z]{2}))?\s*$/i);
  if (inPattern) {
    return { service: inPattern[1].trim(), area: inPattern[2].trim() };
  }

  // Pattern 2: "City State Service" — e.g. "Ballantyne NC Gutter Contractor"
  const stateAbbr = state || '[A-Z]{2}';
  const cityStatePrefix = work.match(new RegExp(`^([A-Z][a-zA-Z\\s]+?)\\s+${escapeRegex(stateAbbr)}\\s+(.+)$`, 'i'));
  if (cityStatePrefix) {
    return { service: cityStatePrefix[2].trim(), area: cityStatePrefix[1].trim() };
  }

  // Pattern 3: "Service City State" — e.g. "Roof Replacement Charlotte NC"
  const serviceCityState = work.match(new RegExp(`^(.+?)\\s+([A-Z][a-zA-Z\\s]+?)\\s+${escapeRegex(stateAbbr)}\\s*$`, 'i'));
  if (serviceCityState) {
    return { service: serviceCityState[1].trim(), area: serviceCityState[2].trim() };
  }

  // Pattern 4: "Service, City State" or "Service - City, State"
  const serviceCommaCity = work.match(/^(.+?)[,\s-]+([A-Z][a-zA-Z\s]+?)[,\s]+([A-Z]{2})\s*$/i);
  if (serviceCommaCity) {
    return { service: serviceCommaCity[1].trim(), area: serviceCommaCity[2].trim() };
  }

  // Pattern 5: Remove known client city if it appears anywhere
  if (clientCity && work.toLowerCase().includes(clientCity.toLowerCase())) {
    area = clientCity;
    work = work.replace(new RegExp(`[,\\s]*${escapeRegex(clientCity)}[,\\s]*(?:${escapeRegex(state || '')})?`, 'gi'), ' ').trim();
    if (work && work !== title) {
      return { service: work, area };
    }
  }

  // Fallback: return full title as service, clientCity as area
  return { service: title, area: clientCity };
}

function extractFirstParagraph(html) {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (match) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 20 && text.length < 300) return text;
  }
  return '';
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
