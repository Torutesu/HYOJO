"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DecisionCard, NarrationCard, Pill, SourceSheet, SpeakComposer } from "@hyojo/ui";
import { approveSurface, completeActionItem, completeHuddle, createHuddle, defaultNarration, getApiBaseUrl, getLocalSnapshot, getHuddleConnection, joinHuddle, listActionItems, listHuddles, sendTranscript, speak, type ActionItem } from "../src/lib/api";
import type { Huddle, HuddleMemory, Narration } from "@hyojo/domain";

type FeedItem =
  | { id: string; kind: "decision"; title: string; rationale: string; primaryLabel: string; secondaryLabel: string }
  | { id: string; kind: "intro"; narration: Narration }
  | { id: string; kind: "huddle"; huddle: Huddle; memory: HuddleMemory | null }
  | { id: string; kind: "memory"; huddle: Huddle; memory: HuddleMemory }
  | { id: string; kind: "action"; item: ActionItem }
  | { id: string; kind: "speak" }
  | { id: string; kind: "detail"; huddle: Huddle | null };

type SeedSnapshot = {
  narration: Narration;
  huddles: Huddle[];
  memories: Record<string, HuddleMemory>;
  actionItems: ActionItem[];
  approvals: Array<{ id: string; approvedAt: string }>;
};

function makeSeedSnapshot(): SeedSnapshot {
  const huddle = createHuddleSeed();
  const memory: HuddleMemory = {
    huddleId: huddle.id,
    summary: "返金ポリシーの判断を、48時間案を軸に進める。",
    decisions: ["決済完了から48時間以内は全額返金"],
    todos: [{ owner: "AI", text: "CSマニュアルを更新する" }],
    source: "manual",
    createdAt: "2026-07-22T00:00:00.000Z"
  };
  return {
    narration: defaultNarration,
    huddles: [huddle],
    memories: { [huddle.id]: memory },
    actionItems: [{ huddleId: huddle.id, huddleTitle: huddle.title, owner: "AI", text: "CSマニュアルを更新する" }],
    approvals: []
  };
}

function createHuddleSeed(): Huddle {
  return {
    id: "demo-huddle-refund-48h",
    spaceId: "product",
    title: "返金ポリシーを決める",
    participants: ["toru", "sarah"],
    status: "proposed",
    recordingPolicy: {
      mode: "required",
      videoRetentionDays: 30,
      transcriptRetentionDays: 365,
      allowMemoryIndexing: true
    },
    recordingDisclosure: "録画・文字起こし中。参加者全員に表示されます。",
    recording: { provider: "memory", state: "not_started" },
    transcript: { state: "pending" },
    createdAt: "2026-07-22T00:00:00.000Z"
  };
}

export default function HomePage() {
  const [, setSnapshot] = useState<SeedSnapshot>(() => makeSeedSnapshot());
  const [narration, setNarration] = useState<Narration>(defaultNarration);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("準備中");
  const seedSnapshot = makeSeedSnapshot();
  const [huddles, setHuddles] = useState<Huddle[]>(seedSnapshot.huddles.slice(0, 4));
  const [actions, setActions] = useState<ActionItem[]>(seedSnapshot.actionItems.slice(0, 4));
  const [activeHuddle, setActiveHuddle] = useState<Huddle | null>(seedSnapshot.huddles[0] ?? null);
  const [activeMemory, setActiveMemory] = useState<HuddleMemory | null>(seedSnapshot.memories[seedSnapshot.huddles[0]?.id ?? ""] ?? null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [focusId, setFocusId] = useState(() => {
    if (seedSnapshot.huddles[0]) return `huddle-${seedSnapshot.huddles[0].id}`;
    if (seedSnapshot.narration.surface?.kind === "approval") return `decision-${seedSnapshot.narration.surface.id}`;
    return `intro-${seedSnapshot.narration.id}`;
  });

  useEffect(() => {
    let mounted = true;
    const liveSnapshot = getLocalSnapshot();
    if (mounted) {
      setSnapshot(liveSnapshot);
      setNarration(liveSnapshot.narration ?? defaultNarration);
      setHuddles(liveSnapshot.huddles.slice(0, 4));
      setActions(liveSnapshot.actionItems.slice(0, 4));
      setActiveHuddle(liveSnapshot.huddles[0] ?? null);
      setActiveMemory(liveSnapshot.memories[liveSnapshot.huddles[0]?.id ?? ""] ?? null);
      if (liveSnapshot.huddles[0]) {
        setFocusId(`huddle-${liveSnapshot.huddles[0].id}`);
      } else if (liveSnapshot.narration.surface?.kind === "approval") {
        setFocusId(`decision-${liveSnapshot.narration.surface.id}`);
      } else {
        setFocusId(`intro-${liveSnapshot.narration.id}`);
      }
    }
    Promise.all([listHuddles(), listActionItems()])
      .then(([huddleData, actionData]) => {
        if (!mounted) return;
        setHuddles(huddleData.huddles.slice(0, 4));
        setActions(actionData.items.slice(0, 4));
      })
      .catch(() => {
        if (mounted) setStatus("API を待っています");
      });
    return () => { mounted = false; };
  }, []);

  const apiState = getApiBaseUrl().replace(/^https?:\/\//, "");
  const approvalSurface = narration.surface?.kind === "approval" ? narration.surface : null;
  const activeHuddleId = activeHuddle ? activeHuddle.id : "none";

  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];

    if (activeHuddle) {
      items.push({ id: `huddle-${activeHuddle.id}`, kind: "huddle", huddle: activeHuddle, memory: activeMemory });
      if (activeMemory) {
        items.push({ id: `memory-${activeMemory.huddleId}`, kind: "memory", huddle: activeHuddle, memory: activeMemory });
      }
      for (const item of actions.slice(0, 3)) {
        items.push({ id: `action-${item.huddleId}-${item.owner}-${item.text}`, kind: "action", item });
      }
      items.push({ id: "speak", kind: "speak" });
      items.push({ id: `detail-${activeHuddle.id}`, kind: "detail", huddle: activeHuddle });
      if (approvalSurface) {
        items.push({
          id: `decision-${approvalSurface.id}`,
          kind: "decision",
          title: approvalSurface.title,
          rationale: approvalSurface.rationale,
          primaryLabel: approvalSurface.primaryLabel,
          secondaryLabel: approvalSurface.secondaryLabel
        });
      }
      return items;
    }

    if (approvalSurface) {
      items.push({
        id: `decision-${approvalSurface.id}`,
        kind: "decision",
        title: approvalSurface.title,
        rationale: approvalSurface.rationale,
        primaryLabel: approvalSurface.primaryLabel,
        secondaryLabel: approvalSurface.secondaryLabel
      });
    } else {
      items.push({ id: `intro-${narration.id}`, kind: "intro", narration });
    }
    items.push({ id: "speak", kind: "speak" });
      items.push({ id: `detail-${activeHuddleId}`, kind: "detail", huddle: activeHuddle });
    return items;
  }, [activeHuddle, activeMemory, actions, approvalSurface, narration]);

  useEffect(() => {
    if (feedItems.length === 0) return;
    if (!feedItems.some((item) => item.id === focusId)) {
      setFocusId(feedItems[0].id);
    }
  }, [feedItems, focusId]);

  async function submitSpeak() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setStatus("整理しています");
    try {
      const result = await speak(draft);
      setNarration(result.narration);
      setDraft("");
      setStatus("届けました。必要なら次の判断へ進めます。");
      if (result.narration.surface?.kind === "approval") {
        setFocusId(`decision-${result.narration.surface.id}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speak に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function openDecisionDetail() {
    try {
      setStatus("判断を記録しています");
      await approveSurface("refund-48h");
      const created = await createHuddle({ title: approvalSurface?.title ?? "返金ポリシーの判断", participants: ["toru", "sarah"], spaceId: "product", recordingPolicy: "required" });
      setActiveHuddle(created.huddle);
      setActiveMemory(null);
      setStatus("Huddle を開きました");
      setFocusId(`huddle-${created.huddle.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "判断を記録できませんでした");
    }
  }

  async function handleJoinHuddle() {
    if (!activeHuddle) return;
    try {
      setStatus("Huddle に参加しています");
      const result = await joinHuddle(activeHuddle.id);
      setActiveHuddle(result.huddle);
      setStatus("Huddle に参加しました");
      setFocusId(`huddle-${result.huddle.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "参加できませんでした");
    }
  }

  async function handleRequestToken() {
    if (!activeHuddle) return;
    try {
      setStatus("接続を取得しています");
      const result = await getHuddleConnection(activeHuddle.id);
      setStatus(`接続を取得しました · ${result.connection.serverUrl}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "接続を取得できませんでした");
    }
  }

  async function handleCompleteHuddle() {
    if (!activeHuddle) return;
    try {
      setStatus("Huddle を完了しています");
      const result = await completeHuddle(activeHuddle.id);
      setActiveHuddle(result.huddle);
      setActiveMemory(result.memory);
      setStatus("Huddle を完了しました");
      if (result.memory) setFocusId(`memory-${result.memory.huddleId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "完了できませんでした");
    }
  }

  async function handleTranscript() {
    if (!activeHuddle || !transcriptDraft.trim()) return;
    try {
      setStatus("記録しています");
      const result = await sendTranscript(activeHuddle.id, { text: transcriptDraft, language: "ja", decisions: ["48時間案を採用"], todos: [{ owner: "AI", text: "CSマニュアルを更新する" }] });
      setActiveHuddle(result.huddle);
      setActiveMemory(result.memory);
      setTranscriptDraft("");
      setStatus("Memory に反映しました");
      setFocusId(`memory-${result.memory.huddleId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "記録できませんでした");
    }
  }

  async function handleCompleteAction(item: ActionItem) {
    try {
      await completeActionItem(item.huddleId, item.owner, item.text);
      setActions((current) => current.filter((action) => !(action.huddleId === item.huddleId && action.owner === item.owner && action.text === item.text)));
      setStatus("TODO を完了しました");
      setFocusId(`action-${item.huddleId}-${item.owner}-${item.text}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "TODO を完了できませんでした");
    }
  }

  return (
    <main className="hyojo-shell hyojo-feed-shell">
      <div className="hyojo-tiktok-feed">
        <header className="hyojo-feed-top hyojo-feed-top-overlay">
          <div className="hyojo-brand">
            <div className="hyojo-brand-mark">HYOJO</div>
            <Pill>feed-first</Pill>
          </div>
        </header>
        {feedItems.map((item, index) => {
          const sourceHref = item.kind === "huddle"
            ? `/detail/${item.huddle.id}`
            : item.kind === "memory"
              ? `/huddle/${item.huddle.id}`
              : item.kind === "action"
                ? `/huddle/${item.item.huddleId}`
                : item.kind === "detail"
                  ? item.huddle ? `/detail/${item.huddle.id}` : "/"
                  : activeHuddle ? `/detail/${activeHuddle.id}` : "/";
          const sourceLabel = item.kind === "huddle"
            ? "元ソース: Detail"
            : item.kind === "memory"
              ? "元ソース: Huddle"
              : item.kind === "action"
                ? "元ソース: Huddle"
                : item.kind === "decision"
                  ? "元ソース: Detail"
                  : item.kind === "detail"
                    ? "元ソース: Detail"
                    : "元ソース: Detail";

          return (
            <section key={item.id} className={`hyojo-tiktok-card hyojo-tiktok-card-${item.kind} ${focusId === item.id ? "is-active" : ""}`} onClick={() => setFocusId(item.id)}>
              <div className="hyojo-tiktok-card-inner">
                <div className="hyojo-tiktok-topbar">
                  <Pill>{index + 1}/{feedItems.length}</Pill>
                  <Pill>{item.kind}</Pill>
                  <Link className="hyojo-source-link" href={sourceHref}>{sourceLabel}</Link>
                </div>

                <div className="hyojo-feed-card-head">
                  <div>
                    <div className="hyojo-kicker">Now</div>
                    <h2 className="hyojo-section-title">
                      {item.kind === "huddle"
                        ? item.huddle.title
                        : item.kind === "memory"
                          ? `${item.huddle.title} の記録`
                          : item.kind === "action"
                            ? item.item.text
                            : item.kind === "decision"
                              ? item.title
                              : item.kind === "detail"
                                ? item.huddle?.title ?? "次の文脈"
                                : "宛先を選ばずに話す"}
                    </h2>
                  </div>
                </div>

                <div className="hyojo-feed-card-body">
                  {item.kind === "decision" ? (
                    <DecisionCard
                      title={item.title}
                      rationale={item.rationale}
                      primaryLabel={item.primaryLabel}
                      secondaryLabel={item.secondaryLabel}
                      onPrimary={() => void openDecisionDetail()}
                      onSecondary={() => setStatus("詳しくは元ソースに戻れます")}
                      onDetail={() => setStatus("詳しくは元ソースに戻れます")}
                    />
                  ) : null}

                  {item.kind === "intro" ? <NarrationCard narration={item.narration} /> : null}

                  {item.kind === "huddle" ? (
                    <section className="hyojo-card hyojo-feed-block hyojo-feed-block-huddle">
                      <div className="hyojo-card-kicker">Huddle</div>
                      <div className="hyojo-card-title">{item.huddle.title}</div>
                      <p className="hyojo-copy">{item.huddle.recordingDisclosure}</p>
                      <div className="hyojo-meta">
                        <Pill>{item.huddle.status}</Pill>
                        <Pill>{item.huddle.transcript.state}</Pill>
                        <Pill>{item.huddle.recordingPolicy?.mode ?? "required"}</Pill>
                      </div>
                      {item.memory ? (
                        <div className="hyojo-feed-inline-card">
                          <div className="hyojo-sheet-title">Memory</div>
                          <p className="hyojo-copy">{item.memory.summary}</p>
                        </div>
                      ) : null}
                      <div className="hyojo-actions">
                        <button className="hyojo-button hyojo-button-primary" onClick={() => void handleJoinHuddle()}>参加する</button>
                        <button className="hyojo-button hyojo-button-secondary" onClick={() => void handleRequestToken()}>接続を取る</button>
                        <button className="hyojo-button hyojo-button-ghost" onClick={() => void handleCompleteHuddle()}>完了</button>
                      </div>
                    </section>
                  ) : null}

                  {item.kind === "memory" ? (
                    <section className="hyojo-card hyojo-feed-block hyojo-feed-block-memory">
                      <div className="hyojo-card-kicker">Next context</div>
                      <div className="hyojo-card-title">{item.huddle.title} の要約</div>
                      <p className="hyojo-copy">{item.memory.summary}</p>
                      <div className="hyojo-memory-list">
                        {item.memory.decisions.map((decision) => <Pill key={decision}>{decision}</Pill>)}
                      </div>
                      <div className="hyojo-memory-list">
                        {item.memory.todos.slice(0, 2).map((todo) => (
                          <div className="hyojo-todo" key={`${todo.owner}-${todo.text}`}>
                            <div>
                              <div className="hyojo-todo-owner">{todo.owner}</div>
                              <div className="hyojo-todo-text">{todo.text}</div>
                            </div>
                            <div className="hyojo-status">{todo.completedAt ? "完了" : "未完了"}</div>
                          </div>
                        ))}
                      </div>
                      <div className="hyojo-actions">
                        <Link className="hyojo-button hyojo-button-primary" href={`/detail/${item.huddle.id}`}>Detail を開く</Link>
                      </div>
                    </section>
                  ) : null}

                  {item.kind === "action" ? (
                    <section className="hyojo-card hyojo-feed-block hyojo-feed-block-action">
                      <div className="hyojo-card-kicker">Task</div>
                      <div className="hyojo-card-title">{item.item.text}</div>
                      <p className="hyojo-copy">{item.item.owner} · {item.item.huddleTitle}</p>
                      <div className="hyojo-actions">
                        <button className="hyojo-button hyojo-button-primary" onClick={() => void handleCompleteAction(item.item)}>完了</button>
                        <Link className="hyojo-button hyojo-button-secondary" href={`/huddle/${item.item.huddleId}`}>Huddle を見る</Link>
                      </div>
                    </section>
                  ) : null}

                  {item.kind === "speak" ? (
                    <section className="hyojo-card hyojo-feed-block hyojo-feed-block-speak">
                      <div className="hyojo-card-kicker">Speak</div>
                      <div className="hyojo-card-title">宛先を選ばずに話す</div>
                      <p className="hyojo-copy">ひとこと入れると、次に進むための判断や Huddle が下から出てきます。</p>
                      <SpeakComposer
                        value={draft}
                        onChange={setDraft}
                        onSubmit={() => void submitSpeak()}
                        status={busy ? "送信中" : "そのまま話してください"}
                      />
                    </section>
                  ) : null}

                  {item.kind === "detail" ? (
                    <section className="hyojo-card hyojo-feed-block hyojo-feed-block-detail">
                      <div className="hyojo-card-kicker">Detail</div>
                      <div className="hyojo-card-title">{item.huddle?.title ?? "次の文脈"}</div>
                      <SourceSheet
                        title="元の情報"
                        items={[
                          { label: "今", value: item.huddle ? "Huddle の本体を開く前の入口" : "次の文脈を準備中", tone: "good" },
                          { label: "流れ", value: "一覧ではなく、1つの仕事を前に出す", tone: "warn" },
                          { label: "場所", value: "WebView 前提のモバイル UI", tone: "muted" }
                        ]}
                      />
                      <div className="hyojo-actions">
                        {item.huddle ? <Link className="hyojo-button hyojo-button-primary" href={`/huddle/${item.huddle.id}`}>Huddle を開く</Link> : null}
                        {item.huddle ? <Link className="hyojo-button hyojo-button-secondary" href={`/detail/${item.huddle.id}`}>元ソース</Link> : null}
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
