import type { AdaptiveSurface } from "@hyojo/domain";

export const allowedSurfaceKinds = ["approval", "comparison", "summary"] as const;

export function isAllowedSurface(surface: AdaptiveSurface): boolean {
  return allowedSurfaceKinds.includes(surface.kind);
}
