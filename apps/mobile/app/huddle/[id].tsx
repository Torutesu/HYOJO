import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AudioSession, LiveKitRoom } from "@livekit/react-native";
import { getHuddleConnection } from "../../src/api";

type Connection = { serverUrl: string; token: string };

export default function HuddleRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [connection, setConnection] = useState<Connection>();
  const [message, setMessage] = useState("安全な接続を準備しています…");

  useEffect(() => {
    let mounted = true;
    void AudioSession.startAudioSession();
    void getHuddleConnection(id).then(({ connection: next }) => {
      if (mounted) { setConnection(next); setMessage("録画・文字起こし中。参加者全員に表示されています。"); }
    }).catch((error: unknown) => {
      if (mounted) setMessage(error instanceof Error ? error.message : "ハドルへ接続できませんでした。");
    });
    return () => { mounted = false; void AudioSession.stopAudioSession(); };
  }, [id]);

  return <SafeAreaView style={styles.screen}>
    <LiveKitRoom serverUrl={connection?.serverUrl} token={connection?.token} connect={Boolean(connection)} audio video onError={(error) => setMessage(error.message)}>
      <View style={styles.body}><Text style={styles.eyebrow}>HYOJO HUDDLE</Text><Text style={styles.title}>返金ポリシーを決める</Text><View style={styles.record}><View style={styles.dot} /><Text style={styles.recordText}>{message}</Text></View><Text style={styles.hint}>マイクとカメラはこの端末の権限を使います。終了後、要約と決定事項を確認できます。</Text><Pressable onPress={() => router.replace("/")} style={styles.end}><Text style={styles.endText}>ハドルを終了する</Text></Pressable></View>
    </LiveKitRoom>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ screen:{flex:1,padding:20,backgroundColor:"#171717"},body:{flex:1,justifyContent:"center",gap:16},eyebrow:{fontSize:11,color:"#AFAFA8",fontWeight:"600"},title:{fontSize:27,lineHeight:38,color:"#fff",fontWeight:"500"},record:{padding:14,borderRadius:10,backgroundColor:"#3B2020",flexDirection:"row",gap:9,alignItems:"flex-start"},dot:{height:9,width:9,borderRadius:5,marginTop:5,backgroundColor:"#E35555"},recordText:{flex:1,fontSize:12,lineHeight:20,color:"#FFD6D6"},hint:{fontSize:12,lineHeight:20,color:"#B8B8B4"},end:{marginTop:28,padding:15,alignItems:"center",borderRadius:8,borderWidth:1,borderColor:"#777"},endText:{color:"#fff",fontSize:13,fontWeight:"600"} });
