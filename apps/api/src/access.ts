import type { FastifyRequest } from "fastify";
import type { Principal } from "@hyojo/domain";

// Development-only identity adapter. Replace this map with OIDC subject lookup before production.
const principals: Record<string, Principal> = {
  toru: { id: "toru", role: "admin", spaceIds: ["product", "people", "finance"] },
  sarah: { id: "sarah", role: "member", spaceIds: ["product"] }
};

export function principalFrom(request: FastifyRequest): Principal | null {
  const id = request.headers["x-hyojo-actor"];
  return typeof id === "string" ? principals[id] ?? null : null;
}

export function canAccessSpace(principal: Principal, spaceId: string) { return principal.spaceIds.includes(spaceId); }
