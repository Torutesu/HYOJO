import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useOnboarding, type OnboardingProfile } from "../src/onboarding";

const spaces: Array<{ id: OnboardingProfile["spaceId"]; title: string; detail: string }> = [
  { id: "product", title: "プロダクト", detail: "意思決定とHuddleを中心に使う" },
  { id: "people", title: "ピープル", detail: "1on1と組織の対話を扱う" },
  { id: "finance", title: "ファイナンス", detail: "承認と確認事項を扱う" }
];

export default function Onboarding() {
  const { complete } = useOnboarding();
  const [name, setName] = useState("Toru");
  const [spaceId, setSpaceId] = useState<OnboardingProfile["spaceId"]>("product");
  const [recordingAcknowledged, setRecordingAcknowledged] = useState(false);
  const [notificationChoice, setNotificationChoice] = useState<OnboardingProfile["notifications"]>("skipped");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function enableNotifications() {
    setError("");
    try {
      const current = await Notifications.getPermissionsAsync();
      const result = current.granted ? current : await Notifications.requestPermissionsAsync();
      setNotificationChoice(result.granted ? "enabled" : "skipped");
      if (!result.granted) setError("通知は後から端末の設定で有効にできます。");
    } catch {
      setError("通知の設定を開けませんでした。後から端末の設定で有効にできます。");
    }
  }

  async function finish() {
    if (!name.trim()) { setError("呼びかける名前を入力してください。"); return; }
    if (!recordingAcknowledged) { setError("Huddleの記録の扱いを確認してください。"); return; }
    setSaving(true);
    try {
      await complete({ name: name.trim(), spaceId, recordingAcknowledged, notifications: notificationChoice });
      router.replace("/");
    } catch {
      setError("初期設定を保存できませんでした。もう一度お試しください。");
    } finally { setSaving(false); }
  }

  return <SafeAreaView style={styles.screen}><View style={styles.content}>
    <Text style={styles.brand}>HYOJO</Text>
    <Text style={styles.eyebrow}>はじめに、30秒だけ</Text>
    <Text style={styles.title}>あなたに必要な判断だけを、{`\n`}先に届けます。</Text>
    <Text style={styles.copy}>宛先やスレッドを探す必要はありません。話したこと、決めたことを、必要なときに短く返します。</Text>

    <View style={styles.section}><Text style={styles.label}>呼びかける名前</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="名前" autoCapitalize="words" /></View>
    <View style={styles.section}><Text style={styles.label}>最初に見る領域</Text>{spaces.map((space) => <Pressable key={space.id} onPress={() => setSpaceId(space.id)} style={[styles.option, spaceId === space.id && styles.optionSelected]}><View><Text style={styles.optionTitle}>{space.title}</Text><Text style={styles.optionDetail}>{space.detail}</Text></View><Text style={styles.radio}>{spaceId === space.id ? "●" : "○"}</Text></Pressable>)}</View>
    <Pressable onPress={() => setRecordingAcknowledged((value) => !value)} style={styles.consent}><Text style={[styles.checkbox, recordingAcknowledged && styles.checkboxChecked]}>{recordingAcknowledged ? "✓" : ""}</Text><Text style={styles.consentText}>Huddleでは、参加前に録画・文字起こしの方針が表示されます。記録される場合は同意してから参加することを確認しました。</Text></Pressable>
    <View style={styles.notification}><View><Text style={styles.notificationTitle}>判断が必要なときだけ知らせる</Text><Text style={styles.notificationCopy}>通常の雑談通知は送りません。</Text></View><Pressable onPress={enableNotifications} style={styles.notifyButton}><Text style={styles.notifyText}>{notificationChoice === "enabled" ? "通知オン" : "通知を許可"}</Text></Pressable></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable disabled={saving} onPress={finish} style={[styles.primary, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>HYOJOをはじめる</Text>}</Pressable>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#fff"},content:{flex:1,paddingHorizontal:24,paddingTop:24,gap:16},brand:{fontSize:12,letterSpacing:2,color:"#555",fontWeight:"700"},eyebrow:{marginTop:18,fontSize:11,fontWeight:"600",color:"#0F6E56"},title:{fontSize:25,lineHeight:36,fontWeight:"500"},copy:{fontSize:13,lineHeight:21,color:"#555"},section:{gap:7},label:{fontSize:11,fontWeight:"600",color:"#666"},input:{borderWidth:1,borderColor:"#C8C8C4",borderRadius:8,paddingHorizontal:12,paddingVertical:11,fontSize:14},option:{borderWidth:1,borderColor:"#D4D4CF",borderRadius:9,padding:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:6},optionSelected:{borderColor:"#0F6E56",backgroundColor:"#F4FAF6"},optionTitle:{fontSize:13,fontWeight:"600"},optionDetail:{fontSize:11,color:"#666",marginTop:3},radio:{fontSize:17,color:"#0F6E56"},consent:{flexDirection:"row",gap:10,alignItems:"flex-start",paddingVertical:4},checkbox:{width:20,height:20,borderWidth:1,borderColor:"#888",borderRadius:4,textAlign:"center",lineHeight:18,color:"#0F6E56",overflow:"hidden"},checkboxChecked:{backgroundColor:"#0F6E56",color:"#fff",borderColor:"#0F6E56"},consentText:{flex:1,fontSize:11,lineHeight:18,color:"#555"},notification:{borderTopWidth:1,borderTopColor:"#E2E2DD",paddingTop:13,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},notificationTitle:{fontSize:12,fontWeight:"600"},notificationCopy:{fontSize:10,color:"#666",marginTop:3},notifyButton:{borderWidth:1,borderColor:"#999",borderRadius:7,paddingVertical:8,paddingHorizontal:10},notifyText:{fontSize:11},error:{fontSize:11,color:"#A02929"},primary:{marginTop:"auto",marginBottom:16,backgroundColor:"#1A1A1A",borderRadius:9,padding:15,alignItems:"center"},primaryText:{color:"#fff",fontWeight:"600",fontSize:14},disabled:{opacity:0.6}
});
