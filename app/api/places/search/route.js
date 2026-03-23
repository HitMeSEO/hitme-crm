// /app/api/places/search/route.js
// Google Places API Text Search — simple, no filters, no type restrictions
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 });
    }

    // Text Search — no type filters, no location bias, just the query
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.nationalPhoneNumber',
          'places.websiteUri',
          'places.rating',
          'places.userRatingCount',
          'places.types',
          'places.primaryTypeDisplayName',
          'places.regularOpeningHours',
          'places.googleMapsUri',
          'places.editorialSummary'
        ].join(',')
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 5
      })
    });

    const rawText = await response.text();
    const data = JSON.parse(rawText);

    console.log(JSON.stringify({
      event: 'places_search',
      status: response.status,
      query,
      resultCount: data.places?.length ?? 0,
      hasError: !!data.error,
      errorMsg: data.error?.message ?? null,
      raw: rawText.slice(0, 500),
    }));

    if (data.error) {
      console.error('Places API error:', JSON.stringify(data.error));
      return NextResponse.json({ error: data.error.message, results: [] }, { status: 200 });
    }

    if (!data.places || data.places.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Map to clean format
    const results = data.places.map(place => ({
      placeId: place.id,
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      phone: place.nationalPhoneNumber || '',
      website: place.websiteUri || '',
      rating: place.rating || null,
      reviewCount: place.userRatingCount || 0,
      types: place.types || [],
      primaryType: place.primaryTypeDisplayName?.text || '',
      hours: place.regularOpeningHours || null,
      mapsUrl: place.googleMapsUri || '',
      editorialSummary: place.editorialSummary?.text || ''
    }));

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Places search error:', error);
    return NextResponse.json({ error: error.message, results: [] }, { status: 500 });
  }
}
