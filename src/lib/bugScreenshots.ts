import { supabase } from './supabase';

const BUCKET = 'bug-screenshots';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decode a base64 string to a Uint8Array without relying on a global `atob`
 * (unreliable across React Native JS engines) or an extra npm dependency.
 * react-native-view-shot gives us raw base64; Supabase Storage uploads accept
 * an ArrayBufferView, so a Uint8Array is the cleanest binary payload.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Strip whitespace + padding; `clean` holds only data chars. Each 4 data
  // chars decode to 3 bytes; a 2- or 3-char remainder yields 1 or 2 bytes.
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const lookup = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;

  const byteLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = lookup[clean.charCodeAt(i)];
    const e2 = lookup[clean.charCodeAt(i + 1)];
    const e3 = lookup[clean.charCodeAt(i + 2)];
    const e4 = lookup[clean.charCodeAt(i + 3)];
    if (p < byteLength) bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < byteLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < byteLength) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes;
}

/**
 * Upload a base64 PNG screenshot to the public `bug-screenshots` bucket and
 * return its public URL. Best-effort: a failure here must NOT block the bug
 * report itself — the caller still submits the text with `screenshot_url: null`.
 */
export async function uploadBugScreenshot(
  base64: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const bytes = base64ToUint8Array(base64);
    if (!bytes.length) return { url: null, error: 'empty screenshot' };

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id ?? 'anon';
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'image/png',
      upsert: false,
    });

    if (error) {
      console.error('[bugScreenshots] upload failed', error.message);
      return { url: null, error: error.message };
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl ?? null, error: null };
  } catch (e: any) {
    console.error('[bugScreenshots] threw', e?.message ?? e);
    return { url: null, error: e?.message ?? 'unknown' };
  }
}
