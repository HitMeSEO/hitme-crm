SELECT 'clients' as tbl, count(*) FROM public.clients
UNION ALL SELECT 'locations', count(*) FROM public.locations
UNION ALL SELECT 'contacts', count(*) FROM public.contacts
UNION ALL SELECT 'looker_links', count(*) FROM public.looker_links
UNION ALL SELECT 'team_members', count(*) FROM public.team_members;
