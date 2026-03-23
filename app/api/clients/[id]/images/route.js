// /app/api/clients/[id]/images/route.js
// GET: List images from client's Google Drive OR Dropbox image folder
// POST: Mark an image as used (website, gbp, etc.)
// DELETE: Clear usage marking on an image

import { createClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/google-auth';
import { getDropboxAccessToken } from '@/lib/dropbox-auth';

export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  // Get client's image folder URL
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, company_name, image_folder')
    .eq('id', id)
    .single();

  if (clientErr || !client) {
    return Response.json({ error: 'Client not found' }, { status: 404 });
  }

  if (!client.image_folder) {
    return Response.json({ error: 'No image folder configured for this client. Add one via Edit → Image Folder.', images: [] }, { status: 200 });
  }

  // Route to the right provider
  const isDropbox = client.image_folder.includes('dropbox.com');
  const isGoogleDrive = client.image_folder.includes('drive.google.com') || /^[a-zA-Z0-9_-]{20,}$/.test(client.image_folder);

  let rawImages = [];
  let folderId = null;
  let source = 'unknown';

  if (isDropbox) {
    // ===== DROPBOX =====
    source = 'dropbox';
    const accessToken = await getDropboxAccessToken(supabase);
    if (!accessToken) {
      return Response.json({ error: 'Dropbox not connected. Visit /api/dropbox/connect to connect Dropbox.', images: [] }, { status: 200 });
    }

    try {
      // Normalize the shared link URL
      let sharedUrl = client.image_folder.trim();
      console.log('[dropbox-images] Original URL:', sharedUrl);

      // Step 1: Resolve the shared link to get the actual folder path
      // This works whether the connected account owns the folder or just has access
      const metaRes = await fetch('https://api.dropboxapi.com/2/sharing/get_shared_link_metadata', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: sharedUrl }),
      });

      let folderPath = '';
      let useSharedLink = false;

      if (metaRes.ok) {
        const meta = await metaRes.json();
        console.log('[dropbox-images] Shared link metadata:', JSON.stringify({ tag: meta['.tag'], path: meta.path_lower, name: meta.name }));
        if (meta.path_lower) {
          folderPath = meta.path_lower;
        }
      } else {
        let metaErr = '';
        try { metaErr = await metaRes.text(); } catch {}
        console.error('[dropbox-images] Metadata error:', metaErr);
        // If metadata fails, we'll try shared_link approach as fallback
        useSharedLink = true;
      }

      // Step 2: List files using resolved path (preferred) or shared_link (fallback)
      let listBody;
      if (folderPath && !useSharedLink) {
        // Use the resolved folder path directly — most reliable
        listBody = { path: folderPath, recursive: true, limit: 2000 };
        console.log('[dropbox-images] Listing by path:', folderPath);
      } else {
        // Fallback: try shared_link approach
        // Normalize URL for the API
        if (sharedUrl.includes('?')) {
          const urlObj = new URL(sharedUrl);
          urlObj.searchParams.set('dl', '0');
          sharedUrl = urlObj.toString();
        } else {
          sharedUrl = sharedUrl + '?dl=0';
        }
        listBody = { path: '', shared_link: { url: sharedUrl }, recursive: true, limit: 2000 };
        console.log('[dropbox-images] Listing by shared_link:', sharedUrl);
      }

      let listRes = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(listBody),
      });

      if (!listRes.ok) {
        let errText = '';
        try { errText = await listRes.text(); } catch {}
        console.error('[dropbox-images] list_folder error:', errText);

        let errObj = {};
        try { errObj = JSON.parse(errText); } catch {}

        const errMsg = errObj.error_summary || errText.slice(0, 200) || 'Unknown error';
        return Response.json({ error: `Dropbox error: ${errMsg}. Check that the Dropbox app has files.metadata.read and sharing.read permissions, and the connected account has access to this folder.`, images: [] }, { status: 200 });
      }

      const listData = await listRes.json();
      let entries = listData.entries || [];

      // Handle pagination
      let hasMore = listData.has_more;
      let cursor = listData.cursor;
      while (hasMore) {
        const moreRes = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cursor }),
        });
        if (!moreRes.ok) break;
        const moreData = await moreRes.json();
        entries = entries.concat(moreData.entries || []);
        hasMore = moreData.has_more;
        cursor = moreData.cursor;
      }

      // Filter to image files only
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.heic'];
      const imageEntries = entries.filter(e => {
        if (e['.tag'] !== 'file') return false;
        const name = (e.name || '').toLowerCase();
        return imageExtensions.some(ext => name.endsWith(ext));
      });

      // Get temporary links for thumbnails (batch, max 25 at a time)
      const thumbnailMap = {};
      for (let i = 0; i < imageEntries.length; i += 25) {
        const batch = imageEntries.slice(i, i + 25);
        const linkPromises = batch.map(async (entry) => {
          try {
            const linkRes = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ path: entry.id }),
            });
            if (linkRes.ok) {
              const linkData = await linkRes.json();
              thumbnailMap[entry.id] = linkData.link;
            }
          } catch {}
        });
        await Promise.all(linkPromises);
      }

      // Map to our standard format
      rawImages = imageEntries.map(entry => ({
        id: entry.id, // Dropbox file ID like "id:abc123..."
        name: entry.name,
        mimeType: guessMimeType(entry.name),
        thumbnailUrl: thumbnailMap[entry.id] || null,
        viewUrl: null, // Dropbox doesn't have a direct view URL from API, but we have temp link
        downloadUrl: thumbnailMap[entry.id] || null,
        createdTime: entry.client_modified || entry.server_modified,
        size: entry.size || null,
        width: entry.media_info?.metadata?.dimensions?.width || null,
        height: entry.media_info?.metadata?.dimensions?.height || null,
      }));

      folderId = 'dropbox';

    } catch (err) {
      console.error('Dropbox images error:', err);
      return Response.json({ error: err.message, images: [] }, { status: 500 });
    }

  } else if (isGoogleDrive) {
    // ===== GOOGLE DRIVE =====
    source = 'google_drive';
    folderId = extractGoogleFolderId(client.image_folder);
    if (!folderId) {
      return Response.json({ error: 'Could not parse Google Drive folder ID from URL. Make sure it\'s a Google Drive folder link.', images: [] }, { status: 200 });
    }

    const accessToken = await getAccessToken(supabase);
    if (!accessToken) {
      return Response.json({ error: 'Google not connected. Go to /api/google/connect to connect Google.', images: [] }, { status: 200 });
    }

    try {
      const query = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
      const fields = 'files(id,name,mimeType,thumbnailLink,webContentLink,webViewLink,createdTime,size,imageMediaMetadata)';
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=100&orderBy=createdTime desc`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!driveRes.ok) {
        const err = await driveRes.json();
        console.error('Drive API error:', err);
        return Response.json({ error: `Drive API error: ${err.error?.message || 'Unknown'}`, images: [] }, { status: 200 });
      }

      const driveData = await driveRes.json();
      rawImages = (driveData.files || []).map(img => ({
        id: img.id,
        name: img.name,
        mimeType: img.mimeType,
        thumbnailUrl: img.thumbnailLink || null,
        viewUrl: img.webViewLink || null,
        downloadUrl: img.webContentLink || null,
        createdTime: img.createdTime,
        size: img.size ? parseInt(img.size) : null,
        width: img.imageMediaMetadata?.width || null,
        height: img.imageMediaMetadata?.height || null,
      }));

    } catch (err) {
      console.error('Drive images error:', err);
      return Response.json({ error: err.message, images: [] }, { status: 500 });
    }

  } else {
    return Response.json({ error: 'Unsupported folder URL. Use a Google Drive or Dropbox folder link.', images: [] }, { status: 200 });
  }

  // ===== MERGE WITH USAGE DATA (same for both providers) =====
  const { data: usageRows } = await supabase
    .from('image_assets')
    .select('*')
    .eq('client_id', id);

  const usageMap = {};
  for (const row of (usageRows || [])) {
    usageMap[row.drive_file_id] = row;
  }

  const images = rawImages.map(img => ({
    ...img,
    source,
    usedOn: usageMap[img.id]?.used_on || null,
    usedDate: usageMap[img.id]?.used_date || null,
    usedFor: usageMap[img.id]?.used_for || null,
    contentId: usageMap[img.id]?.content_id || null,
  }));

  return Response.json({
    folderId,
    source,
    total: images.length,
    unused: images.filter(i => !i.usedOn).length,
    images,
  });
}

// POST: Mark an image as used
export async function POST(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const { driveFileId, fileName, usedOn, usedFor, contentId } = body;

  if (!driveFileId || !usedOn) {
    return Response.json({ error: 'Missing driveFileId or usedOn' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('image_assets')
    .upsert({
      client_id: id,
      drive_file_id: driveFileId,
      file_name: fileName || '',
      used_on: usedOn,
      used_for: usedFor || '',
      content_id: contentId || null,
      used_date: new Date().toISOString(),
    }, { onConflict: 'client_id,drive_file_id' })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, asset: data });
}

// DELETE: Clear usage marking on an image
export async function DELETE(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const driveFileId = searchParams.get('driveFileId');

  if (!driveFileId) {
    return Response.json({ error: 'Missing driveFileId' }, { status: 400 });
  }

  await supabase
    .from('image_assets')
    .delete()
    .eq('client_id', id)
    .eq('drive_file_id', driveFileId);

  return Response.json({ success: true });
}

// Helper: extract folder ID from various Google Drive URL formats
function extractGoogleFolderId(url) {
  if (!url) return null;
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const uFolderMatch = url.match(/\/u\/\d+\/folders\/([a-zA-Z0-9_-]+)/);
  if (uFolderMatch) return uFolderMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;
  return null;
}

// Helper: guess MIME type from filename
function guessMimeType(filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
    tiff: 'image/tiff', svg: 'image/svg+xml', heic: 'image/heic',
  };
  return map[ext] || 'image/jpeg';
}
