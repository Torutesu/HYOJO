import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getHuddle } from "../../../src/api";

export default function HuddleResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("ハドルの記録");
  const [message, setMessage] = useState("文字起こしを受信しています…");
  const [decisions, setDecisions] = useState<string[]>([]);
  const [todos, setTodos] = useState<Array<{ owner: string; text: string }>>([]);

  useEffect(() => {
    let active = true;
    const refresh = () => { void getHuddle(id).then(({ huddle, memory }) => { if (!active) return; setTitle(huddle.title); setMessage(memory?.summary ?? (huddle.transcript.state === "pending" ? "録画を処理しています。文字起こしが届くと、ここに要約・決定事項・TODOを表示します。" : "このハドルは記録対象外です。")); setDecisions(memory?.decisions ?? []); setTodos(memory?.todos ?? []); }).catch(() => { if (active) setMessage("記録を読み込めませんでした。"); }); };
    refresh();
    const timer = setInterval(refresh, 5_000);
    return () => { active = false; clearInterval(timer); };
  }, [id]);

  return <SafeAreaView style={styles.screen}><View style={styles.body}><Text style={styles.eyebrow}>HUDDLE MEMORY</Text><Text style={styles.title}>{title}</Text><View style={styles.card}><Text style={styles.label}>記録の状態</Text><Text style={styles.copy}>{message}</Text></View>{decisions.length > 0 && <View style={styles.card}><Text style={styles.label}>決定事項</Text>{decisions.map((decision) => <Text key={decision} style={styles.copy}>• {decision}</Text>)}</View>}{todos.length > 0 && <View style={styles.card}><Text style={styles.label}>TODO</Text>{todos.map((todo) => <Text key={`${todo.owner}-${todo.text}`} style={styles.copy}>• {todo.owner}: {todo.text}</Text>)}</View>}<Pressable onPress={() => router.replace("/")} style={styles.primary}><Text style={styles.primaryText}>ホームに戻る</Text></Pressable></View></SafeAreaView>;
}

const styles = StyleSheet.create({ screen:{flex:1,padding:20,backgroundColor:"#fff"},body:{flex:1,justifyContent:"center",gap:16},eyebrow:{fontSize:11,color:"#6A6A66",fontWeight:"600"},title:{fontSize:27,lineHeight:38,fontWeight:"500",color:"#171717"},card:{padding:16,borderRadius:12,backgroundColor:"#F4F4F0",gap:8},label:{fontSize:11,color:"#6A6A66",fontWeight:"600"},copy:{fontSize:14,lineHeight:23,color:"#383834"},primary:{marginTop:28,padding:15,alignItems:"center",borderRadius:8,backgroundColor:"#1A1A1A"},primaryText:{color:"#fff",fontSize:13,fontWeight:"600"} });
