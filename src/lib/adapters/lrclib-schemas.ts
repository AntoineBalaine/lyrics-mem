import { z } from 'zod';

// Subset of fields lrclib returns. Fields we don't read are passed-through
// without validation (Zod's default — extra keys are fine).
export const lrclibTrackSchema = z.object({
  id: z.number().optional(),
  artistName: z.string(),
  trackName: z.string(),
  albumName: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  instrumental: z.boolean().optional(),
  plainLyrics: z.string().nullable().optional(),
  syncedLyrics: z.string().nullable().optional(),
});

export const lrclibSearchResponseSchema = z.array(lrclibTrackSchema);

export type LrclibTrack = z.infer<typeof lrclibTrackSchema>;
export type LrclibSearchResponse = z.infer<typeof lrclibSearchResponseSchema>;
