/**
 * Orion POS Mobile Expo - Image URL Resolution & Fallback Helper
 */

import { CONFIG } from '../config/env';

/**
 * Resolves product image URLs safely:
 * - If null or empty -> returns null (triggers UI fallback icon)
 * - If absolute URL (e.g. Cloudinary https://res.cloudinary.com/... or https://...) -> returns as-is
 * - If relative URL (e.g. /uploads/... or /storage/...) -> prepends CONFIG.apiBaseUrl
 */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return null;
  }

  const cleanUrl = url.trim();

  // If already absolute URL (Cloudinary, S3, External) -> use directly
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }

  // If relative path -> prepend backend host
  const base = CONFIG.apiBaseUrl.replace(/\/+$/, '');
  const path = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;

  return `${base}${path}`;
}

export default resolveImageUrl;
