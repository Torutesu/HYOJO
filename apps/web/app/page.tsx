"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DecisionCard, NarrationCard, Pill, SourceSheet, SpeakComposer } from "@hyojo/ui";
import { approveSurface, completeActionItem, completeHuddle, createHuddle, defaultNarration, getApiBaseUrl, getLocalSnapshot, getHuddleConnection, joinHuddle, listActionItems, listHuddles, sendTranscript, speak, type ActionItem } from "../src/lib/api";
import type { Huddle, HuddleMemory, Narration } from "@hyojo/domain";

function formatTimestamp(value: string) {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}

type FeedItem =
  | { id: string; kind: "decision"; title: string; rationale: string; primaryLabel: string; secondaryLabel: string }
  | { id: string; kind: "intro"; narration: Narration }
  | { id: string; kind: "huddle"; huddle: Huddle; memory: HuddleMemory | null }
  | { id: string; kind: "memory"; huddle: Huddle; memory: HuddleMemory }
  | { id: string; kind: "action"; item: ActionItem }
  | { id: string; kind: "speak" }
  | { id: string; kind: "detail"; huddle: Huddle | null };

export default function HomePage() {
  const [snapshot] = useState(() => getLocalSnapshot());
  const [narration, setNarration] = useState<Narration>(snapshot.narration ?? defaultNarration);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("準備中");
  const [huddles, setHuddles] = useState<Huddle[]>(snapshot.huddles.slice(0, 4));
  const [actions, setActions] = useState<ActionItem[]>(snapshot.actionItems.slice(0, 4));
  const [activeHuddle, setActiveHuddle] = useState<Huddle | null>(snapshot.huddles[0] ?? null);
  const [activeMemory, setActiveMemory] = useState<HuddleMemory | null>(snapshot.memories[snapshot.huddles[0]?.id ?? ""] ?? null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [focusId, setFocusId] = useState(() => {
    if (snapshot.huddles[0]) return `huddle-${snapshot.huddles[0].id}`;
    if (snapshot.narration.surface?.kind === "approval") return `decision-${snapshot.narration.surface.id}`;
    return `intro-${snapshot.narration.id}`;
  });

  useEffect(() => {
    let mounted = true;
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

  const currentIndex = Math.max(feedItems.findIndex((item) => item.id === focusId), 0);
  const currentItem = feedItems[currentIndex] ?? feedItems[0];
  const nextItems = feedItems.slice(currentIndex + 1, currentIndex + 3);

  function advanceFocus() {
    const next = nextItems[0];
    if (next) setFocusId(next.id);
  }

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
      advanceFocus();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "TODO を完了できませんでした");
    }
  }

  return (
    <main className="hyojo-shell hyojo-feed-shell">
      <div className="hyojo-feed">
        <header className="hyojo-feed-top">
          <div className="hyojo-brand">
            <div className="hyojo-brand-mark">HYOJO</div>
            <Pill>dev actor · toru</Pill>
          </div>
          <div className="hyojo-feed-hero">
            <div>
              <div className="hyojo-kicker">AI-native company OS</div>
              <h1>仕事が、下から自然に出てくる。</h1>
            </div>
            <p className="hyojo-copy">
              いま向き合うべき文脈を1枚にまとめ、終わったら次の話題が下から出てくる。
              情報の一覧ではなく、前に進むためのフィードです。
            </p>
            <div className="hyojo-rail">
              <Pill>web app</Pill>
              <Pill>{apiState}</Pill>
              <Pill>feed-first</Pill>
              <Pill>{status}</Pill>
              <Pill>{huddles.length} huddles</Pill>
            </div>
          </div>
        </header>

        <section className="hyojo-feed-stage">
          <div key={currentItem?.id ?? "empty"} className={`hyojo-feed-card hyojo-feed-card-${currentItem?.kind ?? "intro"}`}>
            <div className="hyojo-feed-card-head">
              <div>
                <div className="hyojo-kicker">Now</div>
                <h2 className="hyojo-section-title">
                  {currentItem?.kind === "huddle"
                    ? currentItem.huddle.title
                    : currentItem?.kind === "memory"
                      ? `${currentItem.huddle.title} の記録`
                      : currentItem?.kind === "action"
                        ? currentItem.item.text
                        : currentItem?.kind === "decision"
                          ? currentItem.title
                          : currentItem?.kind === "detail"
                            ? currentItem.huddle?.title ?? "次の文脈を準備中"
                            : "宛先を選ばずに話す"}
                </h2>
              </div>
              <Pill>{currentItem?.kind ?? "intro"}</Pill>
            </div>

            <div className="hyojo-feed-card-body">
              {currentItem?.kind === "decision" ? (
                <DecisionCard
                  title={currentItem.title}
                  rationale={currentItem.rationale}
                  primaryLabel={currentItem.primaryLabel}
                  secondaryLabel={currentItem.secondaryLabel}
                  onPrimary={() => void openDecisionDetail()}
                  onSecondary={() => setStatus("詳しくは次の Huddle にまとめています")}
                  onDetail={() => setStatus("詳しくは次の Huddle にまとめています")}
                />
              ) : null}

              {currentItem?.kind === "intro" ? <NarrationCard narration={currentItem.narration} /> : null}

              {currentItem?.kind === "huddle" ? (
                <section className="hyojo-card hyojo-feed-block hyojo-feed-block-huddle">
                  <div className="hyojo-card-kicker">Huddle</div>
                  <div className="hyojo-card-title">{currentItem.huddle.title}</div>
                  <p className="hyojo-copy">{currentItem.huddle.recordingDisclosure}</p>
                  <div className="hyojo-meta">
                    <Pill>{currentItem.huddle.status}</Pill>
                    <Pill>{currentItem.huddle.transcript.state}</Pill>
                    <Pill>{currentItem.huddle.recordingPolicy?.mode ?? "required"}</Pill>
                  </div>
                  {currentItem.memory ? (
                    <div className="hyojo-feed-inline-card">
                      <div className="hyojo-sheet-title">Memory</div>
                      <p className="hyojo-copy">{currentItem.memory.summary}</p>
                    </div>
                  ) : null}
                  <div className="hyojo-actions">
                    <button className="hyojo-button hyojo-button-primary" onClick={() => void handleJoinHuddle()}>参加する</button>
                    <button className="hyojo-button hyojo-button-secondary" onClick={() => void handleRequestToken()}>接続を取る</button>
                    <button className="hyojo-button hyojo-button-ghost" onClick={() => void handleCompleteHuddle()}>完了</button>
                  </div>
                </section>
              ) : null}

              {currentItem?.kind === "memory" ? (
                <section className="hyojo-card hyojo-feed-block hyojo-feed-block-memory">
                  <div className="hyojo-card-kicker">Next context</div>
                  <div className="hyojo-card-title">{currentItem.huddle.title} の要約</div>
                  <p className="hyojo-copy">{currentItem.memory.summary}</p>
                  <div className="hyojo-memory-list">
                    {currentItem.memory.decisions.map((decision) => <Pill key={decision}>{decision}</Pill>)}
                  </div>
                  <div className="hyojo-memory-list">
                    {currentItem.memory.todos.slice(0, 2).map((todo) => (
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
                    <Link className="hyojo-button hyojo-button-primary" href={`/detail/${currentItem.huddle.id}`}>Detail を開く</Link>
                    <button className="hyojo-button hyojo-button-secondary" onClick={advanceFocus}>次へ</button>
                  </div>
                </section>
              ) : null}

              {currentItem?.kind === "action" ? (
                <section className="hyojo-card hyojo-feed-block hyojo-feed-block-action">
                  <div className="hyojo-card-kicker">Task</div>
                  <div className="hyojo-card-title">{currentItem.item.text}</div>
                  <p className="hyojo-copy">{currentItem.item.owner} · {currentItem.item.huddleTitle}</p>
                  <div className="hyojo-actions">
                    <button className="hyojo-button hyojo-button-primary" onClick={() => void handleCompleteAction(currentItem.item)}>完了</button>
                    <Link className="hyojo-button hyojo-button-secondary" href={`/huddle/${currentItem.item.huddleId}`}>Huddle を見る</Link>
                  </div>
                </section>
              ) : null}

              {currentItem?.kind === "speak" ? (
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

              {currentItem?.kind === "detail" ? (
                <section className="hyojo-card hyojo-feed-block hyojo-feed-block-detail">
                  <div className="hyojo-card-kicker">Detail</div>
                  <div className="hyojo-card-title">{currentItem.huddle?.title ?? "次の文脈"}</div>
                  <SourceSheet
                    title="このカードの意味"
                    items={[
                      { label: "今", value: currentItem.huddle ? "Huddle の本体を開く前の入口" : "次の文脈を準備中", tone: "good" },
                      { label: "流れ", value: "完了したら下のカードへ自然に遷移", tone: "warn" },
                      { label: "表示", value: "一覧ではなく、1つの仕事を前に出す", tone: "muted" }
                    ]}
                  />
                  <div className="hyojo-actions">
                    {currentItem.huddle ? <Link className="hyojo-button hyojo-button-primary" href={`/huddle/${currentItem.huddle.id}`}>Huddle を開く</Link> : null}
                    <button className="hyojo-button hyojo-button-secondary" onClick={advanceFocus}>次へ</button>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </section>

        <section className="hyojo-feed-next">
          <div className="hyojo-feed-next-head">
            <div>
              <div className="hyojo-kicker">Next up</div>
              <h3 className="hyojo-section-title">下から出てくる次の文脈</h3>
            </div>
            <Pill>{nextItems.length} items</Pill>
          </div>
          <div className="hyojo-feed-next-list">
            {nextItems.map((item) => (
              <button key={item.id} className="hyojo-next-card" onClick={() => setFocusId(item.id)}>
                <div className="hyojo-next-card-title">
                  {item.kind === "action"
                    ? item.item.text
                    : item.kind === "huddle"
                      ? item.huddle.title
                      : item.kind === "memory"
                        ? `${item.huddle.title} の Memory`
                        : item.kind === "decision"
                          ? item.title
                          : item.kind === "detail"
                            ? "Detail"
                            : "Speak"}
                </div>
                <div className="hyojo-next-card-meta">
                  {item.kind === "action"
                    ? `${item.item.owner} · タスク`
                    : item.kind === "huddle"
                      ? `${item.huddle.status} · Huddle · ${formatTimestamp(item.huddle.createdAt)}`
                      : item.kind === "memory"
                        ? "要約と TODO"
                        : item.kind === "decision"
                          ? "判断の入口"
                          : item.kind === "detail"
                            ? "背景を開く"
                            : "声で流れを作る"}
                </div>
              </button>
            ))}
            {nextItems.length === 0 ? (
              <div className="hyojo-banner">ここまで来たら、今のカードに集中すれば大丈夫です。</div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
