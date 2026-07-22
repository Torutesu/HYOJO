"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DecisionCard, NarrationCard, Pill, SourceSheet, SpeakComposer } from "@hyojo/ui";
import { createHuddle, defaultNarration, getApiBaseUrl, getLocalSnapshot, listActionItems, listHuddles, approveSurface, speak, joinHuddle, getHuddleConnection, completeHuddle, sendTranscript, completeActionItem, type ActionItem } from "../src/lib/api";
import type { Narration, Huddle, HuddleMemory } from "@hyojo/domain";

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
  const joinButtonRef = useRef<HTMLButtonElement | null>(null);
  const tokenButtonRef = useRef<HTMLButtonElement | null>(null);
  const completeButtonRef = useRef<HTMLButtonElement | null>(null);
  const transcriptButtonRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    const listeners: Array<[HTMLButtonElement | null, () => void]> = [
      [joinButtonRef.current, () => { void handleJoinHuddle(); }],
      [tokenButtonRef.current, () => { void handleRequestToken(); }],
      [completeButtonRef.current, () => { void handleCompleteHuddle(); }],
      [transcriptButtonRef.current, () => { void handleTranscript(); }]
    ];
    for (const [element, handler] of listeners) {
      element?.addEventListener("click", handler);
    }
    return () => {
      for (const [element, handler] of listeners) {
        element?.removeEventListener("click", handler);
      }
    };
  });

  const apiState = getApiBaseUrl().replace(/^https?:\/\//, "");

  async function submitSpeak() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setStatus("整理しています");
    try {
      const result = await speak(draft);
      setNarration(result.narration);
      setDraft("");
      setStatus("届けました。必要なら次の判断へ進めます。");
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
      const created = await createHuddle({ title: narration.surface?.kind === "approval" ? narration.surface.title : "返金ポリシーの判断", participants: ["toru", "sarah"], spaceId: "product", recordingPolicy: "required" });
      setActiveHuddle(created.huddle);
      setActiveMemory(null);
      setStatus("Huddle を開きました");
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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "記録できませんでした");
    }
  }

  async function handleCompleteAction(item: ActionItem) {
    try {
      await completeActionItem(item.huddleId, item.owner, item.text);
      setActions((current) => current.filter((action) => !(action.huddleId === item.huddleId && action.owner === item.owner && action.text === item.text)));
      setStatus("TODO を完了しました");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "TODO を完了できませんでした");
    }
  }

  return (
    <main className="hyojo-shell">
      <div className="hyojo-frame">
        <aside className="hyojo-sidebar">
          <div className="hyojo-brand">
            <div className="hyojo-brand-mark">HYOJO</div>
            <Pill>dev actor · toru</Pill>
          </div>
          <div className="hyojo-hero">
            <div className="hyojo-kicker">AI-native company OS</div>
            <h1>話すだけで、判断と記録が前に進む。</h1>
            <p className="hyojo-copy">
              この Web 版は、Home / Detail / Speak / Huddle の流れをそのまま触れるようにした最初の体験です。
              会話を送ると語りが更新され、判断を開くと Huddle に入れます。
            </p>
            <div className="hyojo-rail">
              <Pill>web app</Pill>
              <Pill>{apiState}</Pill>
              <Pill>mobile-first</Pill>
            </div>
          </div>

          <div className="hyojo-side-grid">
            <div className="hyojo-stat-grid">
              <div className="hyojo-stat">
                <span className="hyojo-stat-label">Recent Huddles</span>
                <span className="hyojo-stat-value">{huddles.length}</span>
              </div>
              <div className="hyojo-stat">
                <span className="hyojo-stat-label">Action Items</span>
                <span className="hyojo-stat-value">{actions.length}</span>
              </div>
            </div>
            <SourceSheet
              title="この版の守り"
              items={[
                { label: "日常 UI", value: "Home / Detail / Speak / Huddle", tone: "good" },
                { label: "隠すもの", value: "検索 / DM / メンバー一覧 / 管理設定", tone: "muted" },
                { label: "認証", value: "開発用 actor で実API接続", tone: "warn" }
              ]}
            />
          </div>
        </aside>

        <section className="hyojo-main">
          <div className="hyojo-section">
            <div className="hyojo-section-head">
              <div>
                <div className="hyojo-kicker">Home</div>
                <h2 className="hyojo-section-title">AI の朝の語り</h2>
              </div>
              <Pill>{status}</Pill>
            </div>
            <div className="hyojo-grid">
              <NarrationCard narration={narration} />
              {narration.surface?.kind === "approval" ? (
                <DecisionCard
                  title={narration.surface.title}
                  rationale={narration.surface.rationale}
                  primaryLabel={narration.surface.primaryLabel}
                  secondaryLabel={narration.surface.secondaryLabel}
                  onPrimary={() => void openDecisionDetail()}
                  onSecondary={() => setStatus("詳しくは Detail セクションまたは Huddle を見てください")}
                  onDetail={() => setStatus("詳しくは Detail セクションまたは Huddle を見てください")}
                />
              ) : null}
            </div>
          </div>

          <div className="hyojo-section">
            <div className="hyojo-section-head">
              <div>
                <div className="hyojo-kicker">Speak</div>
                <h2 className="hyojo-section-title">宛先を選ばずに話す</h2>
              </div>
              <Pill>push only</Pill>
            </div>
            <SpeakComposer
              value={draft}
              onChange={setDraft}
              onSubmit={() => void submitSpeak()}
              status={busy ? "送信中" : "そのまま話してください"}
            />
            <div className="hyojo-banner">
              高確信の判断は静かに進み、必要なものだけがカードで返ってきます。失敗しても入力は残ります。
            </div>
          </div>

          <div className="hyojo-section">
            <div className="hyojo-section-head">
              <div>
                <div className="hyojo-kicker">Recent</div>
                <h2 className="hyojo-section-title">最近の Huddle とやること</h2>
              </div>
            </div>
            <div className="hyojo-grid">
              {huddles.map((huddle) => (
                <Link className="hyojo-list-item" key={huddle.id} href={`/huddle/${huddle.id}`}>
                  <div className="hyojo-list-item-main">
                    <div className="hyojo-list-title">{huddle.title}</div>
                    <div className="hyojo-list-meta">{huddle.status} · {new Date(huddle.createdAt).toLocaleString("ja-JP")}</div>
                  </div>
                  <Pill>{huddle.recordingPolicy.mode}</Pill>
                </Link>
              ))}
              {actions.map((item) => (
                <div className="hyojo-list-item" key={`${item.huddleId}-${item.text}`}>
                  <div className="hyojo-list-item-main">
                    <div className="hyojo-list-title">{item.text}</div>
                    <div className="hyojo-list-meta">{item.owner} · {item.huddleTitle}</div>
                  </div>
                  <button className="hyojo-button hyojo-button-secondary" onClick={() => void handleCompleteAction(item)}>完了</button>
                </div>
              ))}
              {huddles.length === 0 && actions.length === 0 ? (
                <div className="hyojo-banner">まだデータが少ないので、まず Speak か判断ボタンを触ってみてください。</div>
              ) : null}
            </div>
          </div>

          {activeHuddle ? (
            <div className="hyojo-section">
              <div className="hyojo-section-head">
                <div>
                  <div className="hyojo-kicker">Huddle</div>
                  <h2 className="hyojo-section-title">{activeHuddle.title}</h2>
                </div>
                <Pill>{status}</Pill>
              </div>
              <div className="hyojo-card hyojo-huddle">
                <div className="hyojo-card-kicker">Huddle</div>
                <div className="hyojo-card-title">{activeHuddle.title}</div>
                <p className="hyojo-copy">{activeHuddle.recordingDisclosure}</p>
                <div className="hyojo-meta">
                  <Pill>{activeHuddle.status}</Pill>
                  <Pill>{activeHuddle.transcript.state}</Pill>
                  <Pill>{activeHuddle.recordingPolicy.mode}</Pill>
                </div>
                <div className="hyojo-actions">
                  <button ref={joinButtonRef} className="hyojo-button hyojo-button-primary" onClick={() => void handleJoinHuddle()}>参加する</button>
                  <button ref={tokenButtonRef} className="hyojo-button hyojo-button-secondary" onClick={() => void handleRequestToken()}>接続を取る</button>
                  <button ref={completeButtonRef} className="hyojo-button hyojo-button-ghost" onClick={() => void handleCompleteHuddle()}>完了</button>
                </div>
                <textarea
                  className="hyojo-textarea hyojo-textarea-small"
                  value={transcriptDraft}
                  onChange={(event) => setTranscriptDraft(event.target.value)}
                  placeholder="ここに会話の要約や文字起こしを貼ると、Memory に反映されます。"
                  rows={5}
                />
                <div className="hyojo-composer-row">
                  <div className="hyojo-status">Transcript → Memory</div>
                  <button ref={transcriptButtonRef} className="hyojo-button hyojo-button-primary" onClick={() => void handleTranscript()}>記録する</button>
                </div>
                {activeMemory ? (
                  <div className="hyojo-memory">
                    <div className="hyojo-sheet-title">Memory</div>
                    <p className="hyojo-copy">{activeMemory.summary}</p>
                    <div className="hyojo-memory-list">
                      {activeMemory.decisions.map((decision) => <Pill key={decision}>{decision}</Pill>)}
                    </div>
                    <div className="hyojo-memory-list">
                      {activeMemory.todos.map((todo) => (
                        <div className="hyojo-todo" key={`${todo.owner}-${todo.text}`}>
                          <div>
                            <div className="hyojo-todo-owner">{todo.owner}</div>
                            <div className="hyojo-todo-text">{todo.text}</div>
                          </div>
                          <div className="hyojo-status">{todo.completedAt ? "完了" : "未完了"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
