"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pill, SourceSheet } from "@hyojo/ui";
import { cancelHuddle, completeActionItem, completeHuddle, getHuddle, getHuddleConnection, joinHuddle, listActionItems, sendTranscript, getLocalSnapshot, createDemoHuddle, type ActionItem } from "../../../src/lib/api";
import type { Huddle, HuddleMemory } from "@hyojo/domain";

export default function HuddlePage() {
  const router = useRouter();
  const pathname = usePathname();
  const id = pathname.split("/").filter(Boolean).pop() ?? "";
  const [snapshot] = useState(() => getLocalSnapshot());
  const [huddle, setHuddle] = useState<Huddle | null>(snapshot.huddles.find((item) => item.id === id) ?? createDemoHuddle(id));
  const [memory, setMemory] = useState<HuddleMemory | null>(snapshot.memories[id] ?? null);
  const [status, setStatus] = useState("読み込み中");
  const [connection, setConnection] = useState<{ serverUrl: string; token: string } | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const joinButtonRef = useRef<HTMLButtonElement | null>(null);
  const tokenButtonRef = useRef<HTMLButtonElement | null>(null);
  const completeButtonRef = useRef<HTMLButtonElement | null>(null);
  const transcriptButtonRef = useRef<HTMLButtonElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  async function reload() {
    const data = await getHuddle(id);
    setHuddle(data.huddle);
    setMemory(data.memory);
  }

  useEffect(() => {
    let mounted = true;
    reload()
      .then(() => setStatus("準備できています"))
      .catch(() => mounted && setStatus("ローカルデモを表示しています"));
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    const listeners: Array<[HTMLButtonElement | null, () => void]> = [
      [joinButtonRef.current, () => { void handleJoin(); }],
      [tokenButtonRef.current, () => { void handleToken(); }],
      [completeButtonRef.current, () => { void handleComplete(); }],
      [transcriptButtonRef.current, () => { void handleTranscript(); }],
      [cancelButtonRef.current, () => { void cancelHuddle(currentHuddle.id).then(() => router.push("/")).catch((error) => setStatus(error instanceof Error ? error.message : "キャンセルできませんでした")); }]
    ];
    for (const [element, handler] of listeners) element?.addEventListener("click", handler);
    return () => {
      for (const [element, handler] of listeners) element?.removeEventListener("click", handler);
    };
  });

  useEffect(() => {
    let mounted = true;
    listActionItems()
      .then((response) => {
        if (!mounted) return;
        setActionItems(response.items.filter((item) => item.huddleId === id));
      })
      .catch(() => {
        if (mounted) setActionItems([]);
      });
    return () => { mounted = false; };
  }, [id]);

  const currentHuddle = huddle ?? createDemoHuddle(id);
  const recordingMode = currentHuddle.recordingPolicy?.mode ?? "required";

  async function handleJoin() {
    try {
      setStatus("参加しています");
      await joinHuddle(currentHuddle.id);
      await reload();
      setStatus("参加しました");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "参加できませんでした");
    }
  }

  async function handleToken() {
    try {
      setStatus("接続を取得しています");
      const result = await getHuddleConnection(currentHuddle.id);
      setConnection(result.connection);
      setStatus("接続情報を取得しました");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "接続を取得できませんでした");
    }
  }

  async function handleComplete() {
    try {
      setStatus("完了処理中");
      await completeHuddle(currentHuddle.id);
      await reload();
      setStatus("Huddle を完了しました");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "完了できませんでした");
    }
  }

  async function handleTranscript() {
    if (!transcriptDraft.trim()) {
      setStatus("文字起こしを貼ってください");
      return;
    }
    try {
      setStatus("記録しています");
      const result = await sendTranscript(currentHuddle.id, { text: transcriptDraft, language: "ja", decisions: ["Web 版の検証を先に進める"], todos: [{ owner: "AI", text: "Web 版のモバイルファースト体験を磨く" }] });
      setMemory(result.memory);
      setTranscriptDraft("");
      await reload();
      setStatus("Memory に反映しました");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "記録に失敗しました");
    }
  }

  async function handleCompleteAction(item: ActionItem) {
    try {
      await completeActionItem(item.huddleId, item.owner, item.text);
      setStatus("TODO を完了しました");
      await reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "TODO を完了できませんでした");
    }
  }

  return (
    <main className="hyojo-shell">
      <div className="hyojo-frame" style={{ gridTemplateColumns: "1fr" }}>
        <section className="hyojo-main">
          <div className="hyojo-section">
            <div className="hyojo-section-head">
              <div>
                <div className="hyojo-kicker">Huddle</div>
                <h2 className="hyojo-section-title">{currentHuddle.title}</h2>
              </div>
              <Pill>{status}</Pill>
            </div>
            <div className="hyojo-card hyojo-huddle">
              <div className="hyojo-card-kicker">Huddle</div>
              <div className="hyojo-card-title">{currentHuddle.title}</div>
              <p className="hyojo-copy">{currentHuddle.recordingDisclosure}</p>
              <div className="hyojo-meta">
                <Pill>{currentHuddle.status}</Pill>
                <Pill>{currentHuddle.transcript.state}</Pill>
                <Pill>{recordingMode}</Pill>
              </div>
              <div className="hyojo-actions">
                <button ref={joinButtonRef} className="hyojo-button hyojo-button-primary" onClick={() => void handleJoin()}>参加する</button>
                <button ref={tokenButtonRef} className="hyojo-button hyojo-button-secondary" onClick={() => void handleToken()}>接続を取る</button>
                <button ref={completeButtonRef} className="hyojo-button hyojo-button-ghost" onClick={() => void handleComplete()}>完了</button>
                <button ref={cancelButtonRef} className="hyojo-button hyojo-button-ghost" onClick={() => void cancelHuddle(currentHuddle.id).then(() => router.push("/")).catch((error) => setStatus(error instanceof Error ? error.message : "キャンセルできませんでした"))}>キャンセル</button>
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
              {memory ? (
                <div className="hyojo-memory">
                  <div className="hyojo-sheet-title">Memory</div>
                  <p className="hyojo-copy">{memory.summary}</p>
                  <div className="hyojo-memory-list">
                    {memory.decisions.map((decision) => <Pill key={decision}>{decision}</Pill>)}
                  </div>
                  <div className="hyojo-memory-list">
                    {memory.todos.map((todo) => (
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
            {connection ? (
              <SourceSheet
                title="LiveKit connection"
                items={[
                  { label: "server", value: connection.serverUrl, tone: "good" },
                  { label: "token", value: connection.token.slice(0, 22) + "…", tone: "muted" }
                ]}
              />
            ) : null}
            {actionItems.length > 0 ? (
              <div className="hyojo-grid">
                <div className="hyojo-section-head">
                  <div>
                    <div className="hyojo-kicker">Action Items</div>
                    <h3 className="hyojo-section-title">Memory のやること</h3>
                  </div>
                </div>
                {actionItems.map((item) => (
                  <div className="hyojo-list-item" key={`${item.huddleId}-${item.text}`}>
                    <div className="hyojo-list-item-main">
                      <div className="hyojo-list-title">{item.text}</div>
                      <div className="hyojo-list-meta">{item.owner} · {item.huddleTitle}</div>
                    </div>
                    <button className="hyojo-button hyojo-button-secondary" onClick={() => void handleCompleteAction(item)}>完了</button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="hyojo-actions">
              <Link className="hyojo-button hyojo-button-secondary" href={`/detail/${currentHuddle.id}`}>Detail に戻る</Link>
              <Link className="hyojo-button hyojo-button-ghost" href="/">Home に戻る</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
