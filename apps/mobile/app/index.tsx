import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { Narration } from "@hyojo/domain";
import { approveSurface, listActionItems, listHuddles, speak, type ActionItem, type HuddleListItem } from "../src/api";
import { useOnboarding } from "../src/onboarding";

const initial: Narration = {
  id: "morning", greeting: "おはよう、Toru。", title: "今、決めると前に進むことがひとつあります。",
  body: "返金ポリシーは、いま声で決められます。Sarahも合意済みです。",
  surface: { kind: "approval", id: "refund-48h", title: "48時間案を、ここで決めますか？", rationale: "AIが論点とリスクを一枚にまとめました。", primaryLabel: "判断を聞く", secondaryLabel: "30秒だけ聞く" }
};

export default function Home() {
  const { profile } = useOnboarding();
  const [narration, setNarration] = useState(initial);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [huddles, setHuddles] = useState<HuddleListItem[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  useEffect(() => { void Promise.all([listHuddles(), listActionItems()]).then(([{ huddles: items }, { items: actions }]) => { setHuddles(items.slice(0, 3)); setActionItems(actions.slice(0, 3)); }).catch(() => {}); }, []);

  async function submit() {
    if (!draft.trim()) return;
    setStatus("整理しています…");
    try { const result = await speak(draft); setNarration(result.narration); setDraft(""); setStatus("届けました。次に必要なことをまとめています。"); }
    catch { setStatus("接続できませんでした。APIを起動して、もう一度話してください。"); }
  }
  async function approveAndOpenHuddle() {
    const surface = narration.surface;
    if (!surface || surface.kind !== "approval") return;
    try { setStatus("判断を記録しています…"); await approveSurface(surface.id); router.push("/huddle"); }
    catch { setStatus("判断を記録できませんでした。接続を確認して、もう一度試してください。"); }
  }

  return <SafeAreaView style={styles.screen}>
    <StatusBar style="dark" />
    <View style={styles.header}><Text style={styles.meta}>7月22日 水 · 朝</Text><Text style={styles.brand}>HYOJO</Text></View>
    <View style={styles.content}>
      <Text style={styles.greeting}>{narration.greeting.replace("Toru", profile?.name ?? "あなた")}</Text>
      <Text style={styles.title}>{narration.title}</Text>
      <View style={styles.card}><Text style={styles.cardLabel}>AI の語り</Text><Text style={styles.cardTitle}>{narration.body}</Text></View>
      {narration.surface?.kind === "approval" && <View style={[styles.card, styles.decision]}>
        <Text style={styles.cardLabel}>AI が今の判断用にまとめました</Text>
        <Text style={styles.cardTitle}>{narration.surface.title}</Text>
        <Text style={styles.rationale}>{narration.surface.rationale}</Text>
        <View style={styles.actions}><Pressable onPress={approveAndOpenHuddle} style={styles.primary}><Text style={styles.primaryText}>{narration.surface.primaryLabel}</Text></Pressable><Pressable style={styles.secondary}><Text>{narration.surface.secondaryLabel}</Text></Pressable></View>
      </View>}
      {huddles.length > 0 && <View style={styles.history}><Text style={styles.historyTitle}>最近のHuddle</Text>{huddles.map((huddle) => <Pressable key={huddle.id} onPress={() => router.push({ pathname: huddle.status === "completed" ? "/huddle/[id]/result" : "/huddle/[id]", params: { id: huddle.id } })} style={styles.historyRow}><View><Text style={styles.historyName}>{huddle.title}</Text><Text style={styles.historyMeta}>{huddle.transcript.state === "received" ? "記録を確認できます" : huddle.status === "completed" ? "文字起こしを処理中" : "進行中のHuddle"}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>}
      {actionItems.length > 0 && <View style={styles.history}><Text style={styles.historyTitle}>いまやること</Text>{actionItems.map((item) => <Pressable key={`${item.huddleId}-${item.text}`} onPress={() => router.push({ pathname: "/huddle/[id]/result", params: { id: item.huddleId } })} style={styles.historyRow}><View><Text style={styles.historyName}>{item.text}</Text><Text style={styles.historyMeta}>{item.owner} · {item.huddleTitle}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>}
      <Text style={styles.status}>{status}</Text>
    </View>
    <View style={styles.speak}><TextInput value={draft} onChangeText={setDraft} placeholder="話す（宛先は要らない）" placeholderTextColor="#999" style={styles.input} multiline /><Pressable onPress={submit} style={styles.mic}><Text style={styles.micText}>送る</Text></Pressable></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#fff"},header:{height:56,paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:"#E2E2DD",flexDirection:"row",alignItems:"center",justifyContent:"space-between"},meta:{fontSize:11,color:"#666"},brand:{fontSize:11,color:"#666",fontWeight:"600",letterSpacing:1},content:{padding:20,gap:16},greeting:{fontSize:16},title:{fontSize:20,lineHeight:31,fontWeight:"500"},card:{borderWidth:1,borderColor:"#C8C8C4",borderRadius:12,padding:16,gap:8},decision:{backgroundColor:"#F4FAF6",borderColor:"#D7E8DD"},cardLabel:{fontSize:10,color:"#0F6E56",fontWeight:"600"},cardTitle:{fontSize:14,lineHeight:23},rationale:{fontSize:12,lineHeight:19,color:"#555"},actions:{flexDirection:"row",gap:8,marginTop:4},primary:{backgroundColor:"#1A1A1A",borderRadius:7,paddingHorizontal:12,paddingVertical:10},primaryText:{color:"#fff",fontSize:12},secondary:{borderWidth:1,borderColor:"#B8B8B4",borderRadius:7,paddingHorizontal:12,paddingVertical:10},history:{borderTopWidth:1,borderTopColor:"#E2E2DD",paddingTop:12,gap:2},historyTitle:{fontSize:11,fontWeight:"600",color:"#666",marginBottom:5},historyRow:{paddingVertical:10,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#F0F0EC"},historyName:{fontSize:13,fontWeight:"500"},historyMeta:{fontSize:11,color:"#666",marginTop:4},chevron:{fontSize:22,color:"#888"},status:{fontSize:11,color:"#666"},speak:{margin:16,borderWidth:1,borderColor:"#D0D0CC",borderRadius:10,backgroundColor:"#FAFAF8",padding:8,flexDirection:"row",alignItems:"center"},input:{flex:1,minHeight:38,fontSize:13,paddingHorizontal:8},mic:{backgroundColor:"#1A1A1A",borderRadius:7,paddingHorizontal:12,paddingVertical:11},micText:{color:"#fff",fontSize:11}
});
