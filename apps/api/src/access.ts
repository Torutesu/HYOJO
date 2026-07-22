import type { FastifyRequest } from "fastify";
import type { Principal } from "@hyojo/domain";
import { jwtVerify } from "jose";

// Development-only identities. They are never accepted in production mode.
const principals: Record<string, Principal> = {
  toru: { id: "toru", role: "admin", spaceIds: ["product", "people", "finance"] },
  sarah: { id: "sarah", role: "member", spaceIds: ["product"] }
};

function developmentPrincipal(request: FastifyRequest): Principal | null {
  const id = request.headers["x-hyojo-actor"];
  return typeof id === "string" ? principals[id] ?? null : null;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

export async function principalFrom(request: FastifyRequest, env = process.env): Promise<Principal | null> {
  const developmentMode = env.HYOJO_AUTH_MODE === "development" || (!env.HYOJO_AUTH_MODE && env.NODE_ENV !== "production");
  if (developmentMode) return developmentPrincipal(request);

  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const secret = env.HYOJO_JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const options = {
      algorithms: ["HS256"],
      ...(env.HYOJO_JWT_ISSUER ? { issuer: env.HYOJO_JWT_ISSUER } : {}),
      ...(env.HYOJO_JWT_AUDIENCE ? { audience: env.HYOJO_JWT_AUDIENCE } : {})
    };
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), options);
    const role = payload.role;
    const spaceIds = stringArray(payload.space_ids) ?? stringArray(payload.spaces);
    if (!payload.sub || (role !== "admin" && role !== "member") || !spaceIds) return null;
    return { id: payload.sub, role, spaceIds };
  } catch {
    return null;
  }
}

export function canAccessSpace(principal: Principal, spaceId: string) { return principal.spaceIds.includes(spaceId); }
