BEGIN;

-- Clear any task/content refs to shell clients first
UPDATE public.tasks SET client_id = NULL WHERE client_id IN (
  SELECT id FROM public.clients WHERE company_name NOT IN (
    'Action Dumpsters', 'All Stage & Sound, Inc.', 'Braun Film & Video, Inc',
    'Bruckheim & Patel', 'Charlottes Best Roofing and Gutters', 'District Green Plants',
    'Diversified Lab (TRANE)', 'Dominics Paving', 'Hillmuth Automotive', 'Hit Me SEO',
    'Keefer Law Firm (2 locations)', 'Next Level Rentals (2 locations)',
    'Peak Golf Institute (added)', 'ProHealth Chiropractic Wellness', 'RSM Equipment',
    'Radon Defense', 'TC HVAC Services LLC', 'Trusted Touch', 'You Reach I Teach Basketball Ac'
  )
);

UPDATE public.content_queue SET client_id = NULL WHERE client_id IN (
  SELECT id FROM public.clients WHERE company_name NOT IN (
    'Action Dumpsters', 'All Stage & Sound, Inc.', 'Braun Film & Video, Inc',
    'Bruckheim & Patel', 'Charlottes Best Roofing and Gutters', 'District Green Plants',
    'Diversified Lab (TRANE)', 'Dominics Paving', 'Hillmuth Automotive', 'Hit Me SEO',
    'Keefer Law Firm (2 locations)', 'Next Level Rentals (2 locations)',
    'Peak Golf Institute (added)', 'ProHealth Chiropractic Wellness', 'RSM Equipment',
    'Radon Defense', 'TC HVAC Services LLC', 'Trusted Touch', 'You Reach I Teach Basketball Ac'
  )
);

UPDATE public.activities SET client_id = NULL WHERE client_id IN (
  SELECT id FROM public.clients WHERE company_name NOT IN (
    'Action Dumpsters', 'All Stage & Sound, Inc.', 'Braun Film & Video, Inc',
    'Bruckheim & Patel', 'Charlottes Best Roofing and Gutters', 'District Green Plants',
    'Diversified Lab (TRANE)', 'Dominics Paving', 'Hillmuth Automotive', 'Hit Me SEO',
    'Keefer Law Firm (2 locations)', 'Next Level Rentals (2 locations)',
    'Peak Golf Institute (added)', 'ProHealth Chiropractic Wellness', 'RSM Equipment',
    'Radon Defense', 'TC HVAC Services LLC', 'Trusted Touch', 'You Reach I Teach Basketball Ac'
  )
);

-- Now delete everything for non-kept clients
DELETE FROM public.locations WHERE client_id IN (
  SELECT id FROM public.clients WHERE company_name NOT IN (
    'Action Dumpsters', 'All Stage & Sound, Inc.', 'Braun Film & Video, Inc',
    'Bruckheim & Patel', 'Charlottes Best Roofing and Gutters', 'District Green Plants',
    'Diversified Lab (TRANE)', 'Dominics Paving', 'Hillmuth Automotive', 'Hit Me SEO',
    'Keefer Law Firm (2 locations)', 'Next Level Rentals (2 locations)',
    'Peak Golf Institute (added)', 'ProHealth Chiropractic Wellness', 'RSM Equipment',
    'Radon Defense', 'TC HVAC Services LLC', 'Trusted Touch', 'You Reach I Teach Basketball Ac'
  )
);

DELETE FROM public.contacts WHERE client_id IN (
  SELECT id FROM public.clients WHERE company_name NOT IN (
    'Action Dumpsters', 'All Stage & Sound, Inc.', 'Braun Film & Video, Inc',
    'Bruckheim & Patel', 'Charlottes Best Roofing and Gutters', 'District Green Plants',
    'Diversified Lab (TRANE)', 'Dominics Paving', 'Hillmuth Automotive', 'Hit Me SEO',
    'Keefer Law Firm (2 locations)', 'Next Level Rentals (2 locations)',
    'Peak Golf Institute (added)', 'ProHealth Chiropractic Wellness', 'RSM Equipment',
    'Radon Defense', 'TC HVAC Services LLC', 'Trusted Touch', 'You Reach I Teach Basketball Ac'
  )
);

DELETE FROM public.looker_links WHERE client_id IN (
  SELECT id FROM public.clients WHERE company_name NOT IN (
    'Action Dumpsters', 'All Stage & Sound, Inc.', 'Braun Film & Video, Inc',
    'Bruckheim & Patel', 'Charlottes Best Roofing and Gutters', 'District Green Plants',
    'Diversified Lab (TRANE)', 'Dominics Paving', 'Hillmuth Automotive', 'Hit Me SEO',
    'Keefer Law Firm (2 locations)', 'Next Level Rentals (2 locations)',
    'Peak Golf Institute (added)', 'ProHealth Chiropractic Wellness', 'RSM Equipment',
    'Radon Defense', 'TC HVAC Services LLC', 'Trusted Touch', 'You Reach I Teach Basketball Ac'
  )
);

-- Delete the shell client records
DELETE FROM public.clients WHERE company_name NOT IN (
  'Action Dumpsters', 'All Stage & Sound, Inc.', 'Braun Film & Video, Inc',
  'Bruckheim & Patel', 'Charlottes Best Roofing and Gutters', 'District Green Plants',
  'Diversified Lab (TRANE)', 'Dominics Paving', 'Hillmuth Automotive', 'Hit Me SEO',
  'Keefer Law Firm (2 locations)', 'Next Level Rentals (2 locations)',
  'Peak Golf Institute (added)', 'ProHealth Chiropractic Wellness', 'RSM Equipment',
  'Radon Defense', 'TC HVAC Services LLC', 'Trusted Touch', 'You Reach I Teach Basketball Ac'
);

COMMIT;
