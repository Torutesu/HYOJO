import type { Narration, SpeakResponse, Huddle, HuddleMemory } from "@hyojo/domain";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const actorHeader = { "x-hyojo-actor": "toru" };
const localStorageKey = "hyojo-web-local-state-v1";
const cookieKey = "hyojo_web_state";
const windowNamePrefix = "__hyojo_state__:";

export type ActionItem = { huddleId: string; huddleTitle: string; owner: string; text: string };

type LocalState = {
  narration: Narration;
  huddles: Huddle[];
  memories: Record<string, HuddleMemory>;
  actionItems: ActionItem[];
  approvals: Array<{ id: string; approvedAt: string }>;
};

type HyojoWindow = Window & { __hyojoWebState?: LocalState };

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getWindowState() {
  if (typeof window === "undefined") return undefined;
  return (window as HyojoWindow).__hyojoWebState;
}

function setWindowState(state: LocalState) {
  if (typeof window === "undefined") return;
  (window as HyojoWindow).__hyojoWebState = state;
}

function readWindowNameState() {
  if (typeof window === "undefined") return undefined;
  if (!window.name.startsWith(windowNamePrefix)) return undefined;
  try {
    return JSON.parse(window.name.slice(windowNamePrefix.length)) as LocalState;
  } catch {
    return undefined;
  }
}

function writeWindowNameState(state: LocalState) {
  if (typeof window === "undefined") return;
  window.name = `${windowNamePrefix}${JSON.stringify(state)}`;
}

function readCookieState() {
  if (typeof document === "undefined") return undefined;
  const raw = document.cookie.split("; ").find((part) => part.startsWith(`${cookieKey}=`));
  if (!raw) return undefined;
  try {
    return JSON.parse(decodeURIComponent(raw.slice(cookieKey.length + 1))) as LocalState;
  } catch {
    return undefined;
  }
}

function writeCookieState(state: LocalState) {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(JSON.stringify(state));
  document.cookie = `${cookieKey}=${encoded}; path=/; max-age=604800`;
}

function buildLocalNarration(text: string): Narration {
  const summary = text.trim().slice(0, 72) || "受け取りました。";
  return {
    id: randomId("narration"),
    greeting: "受け取りました。",
    title: "次に進める形にしています。",
    body: `「${summary}${text.trim().length > 72 ? "…" : ""}」を整理し、必要な判断をひとつにまとめました。`,
    surface: {
      kind: "approval",
      id: "refund-48h",
      title: "48時間案を、ここで決めますか？",
      rationale: "AI が論点と過去の判断をまとめました。",
      primaryLabel: "判断を聞く",
      secondaryLabel: "30秒だけ聞く"
    }
  };
}

function buildHuddle(input: { id?: string; title: string; participants: string[]; spaceId: string; recordingPolicy: "required" | "optional" | "off" }, createdAt = nowIso()): Huddle {
  const policy = {
    mode: input.recordingPolicy,
    videoRetentionDays: 30,
    transcriptRetentionDays: 365,
    allowMemoryIndexing: input.recordingPolicy !== "off"
  } as const;

  return {
    id: input.id ?? randomId("huddle"),
    spaceId: input.spaceId,
    title: input.title,
    participants: input.participants,
    status: input.recordingPolicy === "off" ? "recording_off" : "proposed",
    recordingPolicy: policy,
    recordingDisclosure: input.recordingPolicy === "off" ? "このハドルは記録されません。" : "録画・文字起こし中。参加者全員に表示されます。",
    recording: { provider: input.recordingPolicy === "off" ? "none" : "memory", state: "not_started" },
    transcript: { state: input.recordingPolicy === "off" ? "not_requested" : "pending" },
    createdAt
  };
}

export function createDemoHuddle(id: string): Huddle {
  return buildHuddle({ id, title: "返金ポリシーを決める", participants: ["toru", "sarah"], spaceId: "product", recordingPolicy: "required" });
}

function seedLocalState(): LocalState {
  const huddle = buildHuddle({ title: "返金ポリシーを決める", participants: ["toru", "sarah"], spaceId: "product", recordingPolicy: "required" });
  const memory: HuddleMemory = {
    huddleId: huddle.id,
    summary: "返金ポリシーの判断を、48時間案を軸に進める。",
    decisions: ["決済完了から48時間以内は全額返金"],
    todos: [{ owner: "AI", text: "CSマニュアルを更新する" }],
    source: "manual",
    createdAt: nowIso()
  };
  return {
    narration: {
      id: "morning-briefing",
      greeting: "おはよう、Toru。",
      title: "今、決めると前に進むことがひとつあります。",
      body: "返金ポリシーは、いま声で決められます。Sarah も合意済みです。",
      surface: {
        kind: "approval",
        id: "refund-48h",
        title: "48時間案を、ここで決めますか？",
        rationale: "AI が論点と過去の判断をまとめました。",
        primaryLabel: "判断を聞く",
        secondaryLabel: "30秒だけ聞く"
      }
    },
    huddles: [huddle],
    memories: { [huddle.id]: memory },
    actionItems: [{ huddleId: huddle.id, huddleTitle: huddle.title, owner: "AI", text: "CSマニュアルを更新する" }],
    approvals: []
  };
}

function loadLocalState(): LocalState {
  const windowState = getWindowState();
  if (windowState) return windowState;
  const cookieState = readCookieState();
  if (cookieState) {
    setWindowState(cookieState);
    writeWindowNameState(cookieState);
    return cookieState;
  }
  const nameState = readWindowNameState();
  if (nameState) {
    setWindowState(nameState);
    return nameState;
  }
  if (!canUseLocalStorage()) {
    const seed = seedLocalState();
    setWindowState(seed);
    writeCookieState(seed);
    writeWindowNameState(seed);
    return seed;
  }
  const raw = window.localStorage.getItem(localStorageKey);
  if (!raw) {
    const seed = seedLocalState();
    setWindowState(seed);
    writeCookieState(seed);
    writeWindowNameState(seed);
    window.localStorage.setItem(localStorageKey, JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    const state = {
      narration: parsed.narration ?? seedLocalState().narration,
      huddles: Array.isArray(parsed.huddles) ? parsed.huddles : seedLocalState().huddles,
      memories: parsed.memories ?? seedLocalState().memories,
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : seedLocalState().actionItems,
      approvals: Array.isArray(parsed.approvals) ? parsed.approvals : []
    };
    setWindowState(state);
    writeCookieState(state);
    writeWindowNameState(state);
    return state;
  } catch {
    const seed = seedLocalState();
    setWindowState(seed);
    writeCookieState(seed);
    writeWindowNameState(seed);
    window.localStorage.setItem(localStorageKey, JSON.stringify(seed));
    return seed;
  }
}

function saveLocalState(state: LocalState) {
  setWindowState(state);
  writeCookieState(state);
  writeWindowNameState(state);
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(localStorageKey, JSON.stringify(state));
}

export function getLocalSnapshot() {
  return loadLocalState();
}

async function remoteJson<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Request failed");
  return json as T;
}

async function tryRemote<T>(request: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (typeof fetch !== "function") return fallback();
  try {
    return await request();
  } catch {
    return fallback();
  }
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export async function speak(text: string): Promise<SpeakResponse> {
  return tryRemote(
    async () => remoteJson(await fetch(`${apiBaseUrl}/v1/speak`, {
      method: "POST",
      headers: { "content-type": "application/json", ...actorHeader },
      body: JSON.stringify({ text })
    })),
    async () => {
      const state = loadLocalState();
      const narration = buildLocalNarration(text);
      state.narration = narration;
      saveLocalState(state);
      return { narration, auditEvents: [] };
    }
  );
}

export async function approveSurface(id: string) {
  return tryRemote(
    async () => remoteJson<{ approval: { id: string; approvedBy: string; approvedAt: string } }>(await fetch(`${apiBaseUrl}/v1/approvals/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      headers: actorHeader
    })),
    async () => {
      const state = loadLocalState();
      state.approvals.push({ id, approvedAt: nowIso() });
      saveLocalState(state);
      return { approval: { id, approvedBy: "toru", approvedAt: nowIso() } };
    }
  );
}

export async function createHuddle(input: { title: string; participants: string[]; spaceId?: string; recordingPolicy?: "required" | "optional" | "off" }) {
  return tryRemote(
    async () => remoteJson<{ huddle: Huddle }>(await fetch(`${apiBaseUrl}/v1/huddles`, {
      method: "POST",
      headers: { "content-type": "application/json", ...actorHeader },
      body: JSON.stringify({ title: input.title, participants: input.participants, spaceId: input.spaceId ?? "product", recordingPolicy: input.recordingPolicy ?? "required" })
    })),
    async () => {
      const state = loadLocalState();
      const huddle = buildHuddle({ title: input.title, participants: input.participants, spaceId: input.spaceId ?? "product", recordingPolicy: input.recordingPolicy ?? "required" });
      state.huddles.unshift(huddle);
      saveLocalState(state);
      return { huddle };
    }
  );
}

export async function joinHuddle(id: string) {
  return tryRemote(
    async () => remoteJson<{ huddle: Huddle }>(await fetch(`${apiBaseUrl}/v1/huddles/${id}/join`, { method: "POST", headers: actorHeader })),
    async () => {
      const state = loadLocalState();
      let huddle = state.huddles.find((item) => item.id === id);
      if (!huddle) {
        huddle = createDemoHuddle(id);
        state.huddles.unshift(huddle);
      }
      huddle.status = huddle.recordingPolicy.mode === "off" ? "recording_off" : "active";
      huddle.recording.state = huddle.recordingPolicy.mode === "off" ? "not_started" : "recording";
      saveLocalState(state);
      return { huddle };
    }
  );
}

export async function cancelHuddle(id: string) {
  return tryRemote(
    async () => {
      await remoteJson<void>(await fetch(`${apiBaseUrl}/v1/huddles/${id}/cancel`, { method: "POST", headers: actorHeader }));
    },
    async () => {
      const state = loadLocalState();
      state.huddles = state.huddles.filter((item) => item.id !== id);
      delete state.memories[id];
      state.actionItems = state.actionItems.filter((item) => item.huddleId !== id);
      saveLocalState(state);
    }
  );
}

export async function getHuddleConnection(id: string) {
  return tryRemote(
    async () => remoteJson<{ connection: { serverUrl: string; token: string } }>(await fetch(`${apiBaseUrl}/v1/huddles/${id}/token`, { method: "POST", headers: actorHeader })),
    async () => ({
      connection: {
        serverUrl: "wss://livekit.local/demo",
        token: `local.${globalThis.btoa?.(id) ?? id}`
      }
    })
  );
}

export async function completeHuddle(id: string) {
  return tryRemote(
    async () => remoteJson<{ huddle: Huddle; memory: HuddleMemory | null }>(await fetch(`${apiBaseUrl}/v1/huddles/${id}/complete`, { method: "POST", headers: actorHeader })),
    async () => {
      const state = loadLocalState();
      let huddle = state.huddles.find((item) => item.id === id);
      if (!huddle) {
        huddle = createDemoHuddle(id);
        state.huddles.unshift(huddle);
      }
      huddle.status = "completed";
      huddle.recording.state = huddle.recordingPolicy.mode === "off" ? "not_started" : "stopped";
      const memory = state.memories[id] ?? {
        huddleId: id,
        summary: `${huddle.title} を完了しました。`,
        decisions: [],
        todos: [],
        source: "manual",
        createdAt: nowIso()
      };
      state.memories[id] = memory;
      saveLocalState(state);
      return { huddle, memory };
    }
  );
}

export async function getHuddle(id: string) {
  return tryRemote(
    async () => remoteJson<{ huddle: Huddle; memory: HuddleMemory | null }>(await fetch(`${apiBaseUrl}/v1/huddles/${id}`, { headers: actorHeader })),
    async () => {
      const state = loadLocalState();
      const huddle = state.huddles.find((item) => item.id === id);
      if (!huddle) throw new Error("Huddle not found");
      return { huddle, memory: state.memories[id] ?? null };
    }
  );
}

export async function listHuddles() {
  return tryRemote(
    async () => remoteJson<{ huddles: Huddle[] }>(await fetch(`${apiBaseUrl}/v1/huddles`, { headers: actorHeader })),
    async () => ({ huddles: loadLocalState().huddles.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })
  );
}

export async function listActionItems() {
  return tryRemote(
    async () => remoteJson<{ items: ActionItem[] }>(await fetch(`${apiBaseUrl}/v1/action-items`, { headers: actorHeader })),
    async () => ({ items: loadLocalState().actionItems })
  );
}

export async function completeActionItem(huddleId: string, owner: string, text: string) {
  return tryRemote(
    async () => {
      await remoteJson(await fetch(`${apiBaseUrl}/v1/huddles/${huddleId}/todos/complete`, {
        method: "POST",
        headers: { "content-type": "application/json", ...actorHeader },
        body: JSON.stringify({ owner, text })
      }));
    },
    async () => {
      const state = loadLocalState();
      state.actionItems = state.actionItems.filter((item) => !(item.huddleId === huddleId && item.owner === owner && item.text === text));
      const memory = state.memories[huddleId];
      if (memory) {
        const todo = memory.todos.find((item) => item.owner === owner && item.text === text);
        if (todo) todo.completedAt = nowIso();
      }
      saveLocalState(state);
    }
  );
}

export async function sendTranscript(id: string, payload: { text: string; language?: string; decisions?: string[]; todos?: Array<{ owner: string; text: string }> }) {
  return tryRemote(
    async () => remoteJson<{ huddle: Huddle; memory: HuddleMemory }>(await fetch(`${apiBaseUrl}/v1/huddles/${id}/transcript`, {
      method: "POST",
      headers: { "content-type": "application/json", ...actorHeader },
      body: JSON.stringify({ decisions: [], todos: [], ...payload })
    })),
    async () => {
      const state = loadLocalState();
      let huddle = state.huddles.find((item) => item.id === id);
      if (!huddle) {
        huddle = createDemoHuddle(id);
        state.huddles.unshift(huddle);
      }
      const memory: HuddleMemory = {
        huddleId: id,
        summary: payload.text.slice(0, 220) || `${huddle.title} の記録`,
        decisions: payload.decisions ?? [],
        todos: (payload.todos ?? []).map((todo) => ({ ...todo })),
        source: "transcript",
        createdAt: nowIso()
      };
      state.memories[id] = memory;
      huddle.transcript = { state: "received", receivedAt: nowIso() };
      state.actionItems = [
        ...state.actionItems.filter((item) => item.huddleId !== id),
        ...(payload.todos ?? []).map((todo) => ({ huddleId: id, huddleTitle: huddle.title, owner: todo.owner, text: todo.text }))
      ];
      saveLocalState(state);
      return { huddle, memory };
    }
  );
}

export const defaultNarration: Narration = {
  id: "morning-briefing",
  greeting: "おはよう、Toru。",
  title: "今、決めると前に進むことがひとつあります。",
  body: "返金ポリシーは、いま声で決められます。Sarah も合意済みです。",
  surface: {
    kind: "approval",
    id: "refund-48h",
    title: "48時間案を、ここで決めますか？",
    rationale: "AI が論点と過去の判断をまとめました。",
    primaryLabel: "判断を聞く",
    secondaryLabel: "30秒だけ聞く"
  }
};
