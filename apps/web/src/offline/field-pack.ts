import { type CoursePack, db } from './db';

export interface FieldPackManifest {
  course_code: string;
  version: string;
  /** Sim JSON specs, checklists, captions, sign-off rubric — the offline content. */
  assets: Record<string, unknown>;
  /** Videos are listed but NEVER auto-downloaded (see downloadVideoForOffline). */
  videos?: { id: string; url: string }[];
}

/**
 * Download a course "field pack" for offline use: sim specs, checklists, captions,
 * and the sign-off rubric. VIDEO IS NOT force-cached (it would blow the offline
 * storage budget) — use downloadVideoForOffline() for explicit per-video opt-in.
 */
export async function downloadFieldPack(manifest: FieldPackManifest): Promise<void> {
  const pack: CoursePack = {
    course_code: manifest.course_code,
    version: manifest.version,
    assets: manifest.assets,
    downloaded_at: Date.now(),
  };
  await db.packs.put(pack); // idempotent by course_code
}

export async function getFieldPack(courseCode: string): Promise<CoursePack | undefined> {
  return db.packs.get(courseCode);
}

/** Explicit, opt-in per-video offline download (Cache API). NEVER called by
 *  downloadFieldPack — video is opt-in only. */
export async function downloadVideoForOffline(videoUrl: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open('redex-academy-video');
  await cache.add(videoUrl);
}
