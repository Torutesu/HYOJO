import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { createHuddle } from "../src/api";

export default function Huddle() {
  const [notice, setNotice] = useState("AIがSarahとの10分ハドルを準備できます。");
  async function start() { try { const { huddle } = await createHuddle(); setNotice(huddle.recordingDisclosure); } catch { setNotice("接続できませんでした。APIを起動して、もう一度試してください。"); } }
  return <SafeAreaView style={styles.screen}><Pressable onPress={() => router.back()}><Text style={styles.back}>← 戻る</Text></Pressable><View style={styles.body}><Text style={styles.eyebrow}>AI からの提案</Text><Text style={styles.title}>Sarahと10分ハドルしませんか？</Text><Text style={styles.copy}>返金ポリシーの合意を、声で確定できそうです。</Text><View style={styles.record}><View style={styles.dot} /><Text style={styles.recordText}>{notice}</Text></View><Pressable onPress={start} style={styles.primary}><Text style={styles.primaryText}>参加する</Text></Pressable><Pressable style={styles.secondary}><Text>30秒サマリーだけもらう</Text></Pressable><Pressable style={styles.link}><Text>今はやめる</Text></Pressable></View></SafeAreaView>;
}
const styles = StyleSheet.create({ screen:{flex:1,padding:20,backgroundColor:"#fff"},back:{fontSize:13,color:"#666"},body:{marginTop:130,gap:16},eyebrow:{fontSize:11,color:"#666",fontWeight:"600"},title:{fontSize:24,lineHeight:35,fontWeight:"500"},copy:{fontSize:14,lineHeight:23,color:"#555"},record:{marginTop:8,padding:14,borderRadius:10,backgroundColor:"#FFF0F0",flexDirection:"row",gap:9,alignItems:"flex-start"},dot:{height:9,width:9,borderRadius:5,marginTop:5,backgroundColor:"#B82B2B"},recordText:{flex:1,fontSize:11,lineHeight:19,color:"#8B3333"},primary:{marginTop:30,padding:15,alignItems:"center",borderRadius:8,backgroundColor:"#1A1A1A"},primaryText:{color:"#fff",fontSize:13,fontWeight:"600"},secondary:{padding:15,alignItems:"center",borderRadius:8,borderWidth:1,borderColor:"#B8B8B4"},link:{padding:12,alignItems:"center"} });
