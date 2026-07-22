"use client";

import { useEffect, useState } from "react";

type Policy = { mode: "required" | "optional" | "off"; videoRetentionDays: number; transcriptRetentionDays: number; allowMemoryIndexing: boolean };
const fallback: Policy = { mode: "required", videoRetentionDays: 30, transcriptRetentionDays: 365, allowMemoryIndexing: true };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const headers = { "content-type": "application/json", "x-hyojo-actor": process.env.NEXT_PUBLIC_HYOJO_DEV_ACTOR ?? "toru" };

export default function Admin() {
  const [policy, setPolicy] = useState<Policy>(fallback);
  const [status, setStatus] = useState("読み込み中…");

  useEffect(() => { void fetch(`${apiUrl}/v1/spaces/product/recording-policy`, { headers }).then(async (response) => { if (!response.ok) throw new Error(); setPolicy((await response.json()).policy); setStatus("Product Space のポリシー"); }).catch(() => setStatus("APIへ接続できません。開発サーバーを起動してください。")); }, []);

  async function save() {
    setStatus("保存しています…");
    try { const response = await fetch(`${apiUrl}/v1/spaces/product/recording-policy`, { method: "PATCH", headers, body: JSON.stringify(policy) }); if (!response.ok) throw new Error(); setPolicy((await response.json()).policy); setStatus("保存しました。変更は監査ログに記録されています。"); } catch { setStatus("保存できませんでした。管理者権限とAPI接続を確認してください。"); }
  }

  return <main style={styles.main}><p style={styles.eyebrow}>HYOJO / 管理者</p><h1 style={styles.title}>記録と記憶のポリシー</h1><p style={styles.lead}>日常の会話画面には出ない、会社の記録ルールです。変更はSpace単位で適用され、監査ログに残ります。</p><section style={styles.metrics}>{[["意図理解", "94%", "+6% from last week"], ["処理量", "59", "routing / translation"], ["対象Space", "1", "Product"]].map(([label, value, note]) => <article key={label} style={styles.metric}><small>{label}</small><strong>{value}</strong><small>{note}</small></article>)}</section><section style={styles.panel}><div><p style={styles.eyebrow}>PRODUCT SPACE</p><h2 style={styles.sectionTitle}>Huddle memory policy</h2></div><label style={styles.label}>記録方法<select value={policy.mode} onChange={(event) => setPolicy({ ...policy, mode: event.target.value as Policy["mode"] })} style={styles.input}><option value="required">常に記録する</option><option value="optional">参加前に選択する</option><option value="off">記録しない</option></select></label><div style={styles.grid}><label style={styles.label}>映像の保持日数<input type="number" min="0" max="3650" value={policy.videoRetentionDays} onChange={(event) => setPolicy({ ...policy, videoRetentionDays: Number(event.target.value) })} style={styles.input} /></label><label style={styles.label}>文字起こしの保持日数<input type="number" min="0" max="3650" value={policy.transcriptRetentionDays} onChange={(event) => setPolicy({ ...policy, transcriptRetentionDays: Number(event.target.value) })} style={styles.input} /></label></div><label style={styles.switch}><input type="checkbox" checked={policy.allowMemoryIndexing} onChange={(event) => setPolicy({ ...policy, allowMemoryIndexing: event.target.checked })} />Institutional Memoryへの登録を許可する</label><button onClick={save} style={styles.button}>ポリシーを保存</button><p style={styles.status}>{status}</p></section></main>;
}

const styles: Record<string, React.CSSProperties> = { main:{maxWidth:900,margin:"0 auto",padding:"48px 24px"},eyebrow:{color:"#666",fontSize:12,fontWeight:600,letterSpacing:".08em",margin:0},title:{fontSize:36,letterSpacing:"-.03em",margin:"10px 0"},lead:{color:"#555",maxWidth:620,lineHeight:1.65},metrics:{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:16,marginTop:32},metric:{background:"white",padding:20,border:"1px solid #C8C8C4",borderRadius:12,display:"grid",gap:8},panel:{marginTop:32,background:"white",padding:28,border:"1px solid #C8C8C4",borderRadius:14,display:"grid",gap:20},sectionTitle:{margin:"6px 0 0"},grid:{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:16},label:{display:"grid",gap:7,fontSize:13,fontWeight:600},input:{font:"inherit",fontWeight:400,padding:11,border:"1px solid #B8B8B4",borderRadius:8,background:"white"},switch:{fontSize:14,display:"flex",gap:9,alignItems:"center"},button:{justifySelf:"start",padding:"12px 18px",border:0,borderRadius:8,background:"#1A1A1A",color:"white",fontWeight:600,cursor:"pointer"},status:{margin:0,color:"#666",fontSize:13} };
