import { NextResponse } from 'next/server';

const TEXT_SEARCH_FIELDS = [
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
  'places.editorialSummary',
].join(',');

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query?.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, { status: 500 });
  }

  const requestBody = {
    textQuery: query,
    maxResultCount: 5,
    includePureServiceAreaBusinesses: true,
  };

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': TEXT_SEARCH_FIELDS,
    },
    body: JSON.stringify(requestBody),
  });

  const rawText = await res.text();
  console.log(JSON.stringify({
    event: 'places_lookup',
    status: res.status,
    query,
    body: requestBody,
    raw: rawText.slice(0, 500),
  }));

  if (!res.ok) {
    return NextResponse.json({ error: rawText }, { status: res.status });
  }

  const data = JSON.parse(rawText);

  if (data.error) {
    return NextResponse.json({ error: data.error.message || JSON.stringify(data.error) }, { status: 400 });
  }

  const places = data.places || [];
  return NextResponse.json(places);
}
