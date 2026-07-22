"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pill, SourceSheet, NarrationCard, DecisionCard } from "@hyojo/ui";
import { defaultNarration, getHuddle, getLocalSnapshot } from "../../../src/lib/api";
import type { Huddle, HuddleMemory } from "@hyojo/domain";

export default function DetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const id = pathname.split("/").filter(Boolean).pop() ?? "";
  const [snapshot] = useState(() => getLocalSnapshot());
  const [huddle, setHuddle] = useState<Huddle | null>(snapshot.huddles.find((item) => item.id === id) ?? null);
  const [memory, setMemory] = useState<HuddleMemory | null>(snapshot.memories[id] ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    getHuddle(id)
      .then((data) => {
        if (!mounted) return;
        setHuddle(data.huddle);
        setMemory(data.memory);
      })
      .catch(() => {
        if (mounted) {
          setHuddle(null);
          setMemory(null);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return <main className="hyojo-shell"><div className="hyojo-main"><div className="hyojo-section">読み込み中…</div></div></main>;
  }

  if (!huddle) {
    const surface = defaultNarration.surface && defaultNarration.surface.kind === "approval" ? defaultNarration.surface : null;
    return (
      <main className="hyojo-shell">
        <div className="hyojo-frame" style={{ gridTemplateColumns: "1fr" }}>
          <section className="hyojo-main">
            <div className="hyojo-section">
              <div className="hyojo-section-head">
                <div>
                  <div className="hyojo-kicker">Detail</div>
                  <h2 className="hyojo-section-title">判断の詳細</h2>
                </div>
                <Pill>{id}</Pill>
              </div>
              <NarrationCard narration={defaultNarration} />
              {surface ? (
                <DecisionCard
                  title={surface.title}
                  rationale={surface.rationale}
                  primaryLabel={surface.primaryLabel}
                  secondaryLabel={surface.secondaryLabel}
                  onPrimary={() => router.push("/")}
                  onSecondary={() => router.push("/")}
                />
              ) : null}
              <SourceSheet
                title="Source sheet"
                items={[
                  { label: "原文", value: "まだ Huddle 実データはありません。まず Home から判断を起こしてください。", tone: "muted" },
                  { label: "共有境界", value: "Space / ACL は API 側で検査しています。", tone: "good" },
                  { label: "web版", value: "この画面はモバイルの代わりにレビューできる導線です。", tone: "warn" }
                ]}
              />
              <div className="hyojo-actions">
                <Link className="hyojo-button hyojo-button-primary" href="/">Home に戻る</Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="hyojo-shell">
      <div className="hyojo-frame" style={{ gridTemplateColumns: "1fr" }}>
        <section className="hyojo-main">
          <div className="hyojo-section">
            <div className="hyojo-section-head">
              <div>
                <div className="hyojo-kicker">Detail</div>
                <h2 className="hyojo-section-title">{huddle.title}</h2>
              </div>
              <Pill>{huddle.status}</Pill>
            </div>
            <SourceSheet
              title="What this Huddle turned into"
              items={[
                { label: "recording", value: huddle.recordingDisclosure, tone: "good" },
                { label: "transcript", value: huddle.transcript.state, tone: "warn" },
                { label: "recording policy", value: huddle.recordingPolicy.mode, tone: "muted" }
              ]}
            />
            {memory ? (
              <SourceSheet
                title="Memory"
                items={[
                  { label: "summary", value: memory.summary, tone: "good" },
                  { label: "decisions", value: memory.decisions.join(" / ") || "なし", tone: "warn" },
                  { label: "todos", value: memory.todos.map((todo) => `${todo.owner}: ${todo.text}${todo.completedAt ? " ✓" : ""}`).join(" / ") || "なし", tone: "muted" }
                ]}
              />
            ) : null}
            <div className="hyojo-actions">
              <Link className="hyojo-button hyojo-button-primary" href={`/huddle/${huddle.id}`}>Huddle を開く</Link>
              <Link className="hyojo-button hyojo-button-secondary" href="/">Home に戻る</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
