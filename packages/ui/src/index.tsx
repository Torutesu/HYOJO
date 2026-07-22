import type { AdaptiveSurface, Huddle, HuddleMemory, Narration } from "@hyojo/domain";
import type { ReactNode } from "react";

export function Pill({ children }: { children: ReactNode }) {
  return <span className="hyojo-pill">{children}</span>;
}

export function NarrationCard({ narration, accent = "warm" }: { narration: Narration; accent?: "warm" | "cool" | "neutral" }) {
  return (
    <section className={`hyojo-card hyojo-card-${accent}`}>
      <div className="hyojo-card-kicker">AI が今の論点をまとめました</div>
      <div className="hyojo-card-title">{narration.title}</div>
      <p className="hyojo-copy">{narration.body}</p>
    </section>
  );
}

export function DecisionCard({
  title,
  rationale,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onDetail
}: {
  title: string;
  rationale: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onDetail?: () => void;
}) {
  return (
    <section className="hyojo-card hyojo-decision">
      <div className="hyojo-card-kicker">判断が必要です</div>
      <div className="hyojo-card-title">{title}</div>
      <p className="hyojo-copy">{rationale}</p>
      <div className="hyojo-actions">
        <button className="hyojo-button hyojo-button-primary" onClick={onPrimary}>{primaryLabel}</button>
        <button className="hyojo-button hyojo-button-secondary" onClick={onSecondary}>{secondaryLabel}</button>
        {onDetail ? <button className="hyojo-button hyojo-button-ghost" onClick={onDetail}>詳しく</button> : null}
      </div>
    </section>
  );
}

export function SpeakComposer({
  value,
  onChange,
  onSubmit,
  status
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  status?: string;
}) {
  return (
    <section className="hyojo-composer">
      <textarea
        className="hyojo-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="話す。宛先もタグもいらない。"
        rows={3}
      />
      <div className="hyojo-composer-row">
        <div className="hyojo-status">{status ?? "待機中"}</div>
        <button className="hyojo-button hyojo-button-primary" onClick={onSubmit}>送る</button>
      </div>
    </section>
  );
}

export function SourceSheet({ title, items }: { title: string; items: Array<{ label: string; value: string; tone?: "good" | "warn" | "muted" }> }) {
  return (
    <section className="hyojo-sheet">
      <div className="hyojo-sheet-title">{title}</div>
      <div className="hyojo-sheet-list">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`} className="hyojo-sheet-row">
            <div className="hyojo-sheet-label">{item.label}</div>
            <div className={`hyojo-sheet-value hyojo-tone-${item.tone ?? "muted"}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HuddlePanel({
  huddle,
  memory,
  onJoin,
  onComplete,
  onRequestToken,
  onCancel,
  onTranscript,
  transcriptDraft,
  setTranscriptDraft
}: {
  huddle: Huddle;
  memory: HuddleMemory | null;
  onJoin: () => void;
  onComplete: () => void;
  onRequestToken: () => void;
  onCancel?: () => void;
  onTranscript: () => void;
  transcriptDraft: string;
  setTranscriptDraft: (value: string) => void;
}) {
  const recordingMode = huddle.recordingPolicy?.mode ?? "required";
  return (
    <section className="hyojo-card hyojo-huddle">
      <div className="hyojo-card-kicker">Huddle</div>
      <div className="hyojo-card-title">{huddle.title}</div>
      <p className="hyojo-copy">{huddle.recordingDisclosure}</p>
      <div className="hyojo-meta">
        <Pill>{huddle.status}</Pill>
        <Pill>{huddle.transcript.state}</Pill>
        <Pill>{recordingMode}</Pill>
      </div>
      <div className="hyojo-actions">
        <button className="hyojo-button hyojo-button-primary" onClick={onJoin}>参加する</button>
        <button className="hyojo-button hyojo-button-secondary" onClick={onRequestToken}>接続を取る</button>
        <button className="hyojo-button hyojo-button-ghost" onClick={onComplete}>完了</button>
        {onCancel ? <button className="hyojo-button hyojo-button-ghost" onClick={onCancel}>キャンセル</button> : null}
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
        <button className="hyojo-button hyojo-button-primary" onClick={onTranscript}>記録する</button>
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
    </section>
  );
}

export function SurfaceSummary({ surface }: { surface: AdaptiveSurface }) {
  if (surface.kind === "approval") {
    return (
      <section className="hyojo-card hyojo-decision">
        <div className="hyojo-card-kicker">Approval surface</div>
        <div className="hyojo-card-title">{surface.title}</div>
        <p className="hyojo-copy">{surface.rationale}</p>
      </section>
    );
  }
  if (surface.kind === "comparison") {
    return (
      <section className="hyojo-card">
        <div className="hyojo-card-kicker">Comparison surface</div>
        <div className="hyojo-card-title">{surface.title}</div>
        <div className="hyojo-compare">
          {surface.options.map((option) => (
            <div key={option.label} className={`hyojo-compare-option${option.recommended ? " is-recommended" : ""}`}>
              <div className="hyojo-compare-label">{option.label}</div>
              <p className="hyojo-copy">{option.detail}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="hyojo-card">
      <div className="hyojo-card-kicker">Summary surface</div>
      <div className="hyojo-card-title">{surface.title}</div>
      <p className="hyojo-copy">{surface.body}</p>
    </section>
  );
}
