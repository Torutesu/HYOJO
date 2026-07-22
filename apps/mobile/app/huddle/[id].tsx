import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AudioSession, LiveKitRoom, VideoTrack, useParticipants, useTracks } from "@livekit/react-native";
import { Track } from "livekit-client";
import { completeHuddle, getHuddleConnection } from "../../src/api";

type Connection = { serverUrl: string; token: string };

function HuddleStage() {
  const tracks = useTracks([Track.Source.Camera]);
  const participants = useParticipants();
  return <View style={styles.stage}>
    {tracks.length ? tracks.map((track) => <View key={`${track.participant.identity}-${track.source}`} style={styles.video}><VideoTrack trackRef={track} style={styles.videoTrack} mirror={track.participant.isLocal} /><Text style={styles.name}>{track.participant.identity}</Text></View>) : <View style={styles.waiting}><Text style={styles.waitingTitle}>参加者を待っています</Text><Text style={styles.waitingCopy}>接続すると、ここにカメラ映像と話している人が表示されます。</Text></View>}
    <Text style={styles.participantCount}>{participants.length}人が参加中</Text>
  </View>;
}

export default function HuddleRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [connection, setConnection] = useState<Connection>();
  const [message, setMessage] = useState("安全な接続を準備しています…");
  const [ending, setEnding] = useState(false);

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

  async function endHuddle() {
    try { setEnding(true); await completeHuddle(id); router.replace({ pathname: "/huddle/[id]/result", params: { id } }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "ハドルを終了できませんでした。"); setEnding(false); }
  }

  return <SafeAreaView style={styles.screen}>
    <LiveKitRoom serverUrl={connection?.serverUrl} token={connection?.token} connect={Boolean(connection)} audio video onError={(error) => setMessage(error.message)}>
      <View style={styles.body}><Text style={styles.eyebrow}>HYOJO HUDDLE</Text><Text style={styles.title}>返金ポリシーを決める</Text><HuddleStage /><View style={styles.record}><View style={styles.dot} /><Text style={styles.recordText}>{message}</Text></View><Text style={styles.hint}>マイクとカメラはこの端末の権限を使います。終了後、文字起こしを受信してから要約と決定事項を確定します。</Text><Pressable disabled={ending} onPress={endHuddle} style={[styles.end, ending && styles.endDisabled]}><Text style={styles.endText}>{ending ? "終了しています…" : "ハドルを終了する"}</Text></Pressable></View>
    </LiveKitRoom>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ screen:{flex:1,padding:20,backgroundColor:"#171717"},body:{flex:1,justifyContent:"center",gap:16},eyebrow:{fontSize:11,color:"#AFAFA8",fontWeight:"600"},title:{fontSize:27,lineHeight:38,color:"#fff",fontWeight:"500"},stage:{height:220,borderRadius:12,overflow:"hidden",backgroundColor:"#292929",gap:8},video:{flex:1,backgroundColor:"#292929"},videoTrack:{flex:1},name:{position:"absolute",left:10,bottom:10,color:"#fff",fontSize:12,fontWeight:"600",backgroundColor:"#0008",paddingHorizontal:7,paddingVertical:4,borderRadius:6},waiting:{flex:1,justifyContent:"center",alignItems:"center",padding:24,gap:6},waitingTitle:{color:"#fff",fontSize:16,fontWeight:"600"},waitingCopy:{color:"#B8B8B4",fontSize:12,lineHeight:19,textAlign:"center"},participantCount:{position:"absolute",right:10,top:10,color:"#ddd",fontSize:11,backgroundColor:"#0008",paddingHorizontal:7,paddingVertical:4,borderRadius:6},record:{padding:14,borderRadius:10,backgroundColor:"#3B2020",flexDirection:"row",gap:9,alignItems:"flex-start"},dot:{height:9,width:9,borderRadius:5,marginTop:5,backgroundColor:"#E35555"},recordText:{flex:1,fontSize:12,lineHeight:20,color:"#FFD6D6"},hint:{fontSize:12,lineHeight:20,color:"#B8B8B4"},end:{marginTop:8,padding:15,alignItems:"center",borderRadius:8,borderWidth:1,borderColor:"#777"},endDisabled:{opacity:.55},endText:{color:"#fff",fontSize:13,fontWeight:"600"} });
