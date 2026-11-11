import * as React from "react";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  registerGlobals,
  useRoomContext,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/react-native";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import { StatusBar } from "expo-status-bar";
import {
  createMeeting,
  demoParticipantReference,
  endMeeting,
  getJoinCredentials,
  prepareMeeting,
  type JoinCredentials,
  type Meeting,
  type ParticipantRole,
} from "./src/api";

registerGlobals();

const livekitUrlOverride = process.env.EXPO_PUBLIC_LIVEKIT_URL;

export default function App() {
  const [role, setRole] = useState<ParticipantRole>("doctor");
  const [appointmentReference, setAppointmentReference] = useState("local-appointment-001");
  const [meetingId, setMeetingId] = useState("");
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [credentials, setCredentials] = useState<JoinCredentials | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Select a test role, then create a meeting or join by ID.");
  const [error, setError] = useState("");

  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request failed. Check the API address and try again.");
    } finally {
      setBusy(false);
    }
  };

  const create = () => run(async () => {
    const created = await createMeeting(role, appointmentReference.trim());
    setMeeting(created);
    setMeetingId(created.id);
    setMessage("Meeting created. Preparing its room now.");
    const ready = await prepareMeeting(role, created.id);
    setMeeting(ready);
    setMessage("Room is ready. Use the same meeting ID on the other test client.");
  });

  const join = () => run(async () => {
    const id = meetingId.trim();
    if (!id) throw new Error("Enter a meeting ID first.");
    const result = await getJoinCredentials(role, id);
    setCredentials(result);
    setMessage("Connecting to the consultation...");
  });

  const leave = () => {
    setCredentials(null);
    setMessage("You left the consultation. The room remains open for the other participant.");
  };

  const finishMeeting = () => run(async () => {
    const id = meeting?.id || meetingId.trim();
    if (!id) throw new Error("Create or join a meeting before ending it.");
    await endMeeting(role, id);
    setCredentials(null);
    setMessage("Meeting ended. The room will be cleaned up in the background.");
  });

  if (credentials) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <LiveKitRoom
          serverUrl={livekitUrlOverride || credentials.server_url}
          token={credentials.token}
          connect
          audio
          video
          options={{ adaptiveStream: { pixelDensity: "screen" } }}
        >
          <CallScreen role={role} onLeave={leave} onEnd={finishMeeting} busy={busy} />
        </LiveKitRoom>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>18ROOTS · MEETING TEST</Text>
          <Text style={styles.title}>Consultation room</Text>
          <Text style={styles.subtitle}>A local doctor–patient video call flow.</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Test as</Text>
          <View style={styles.roleRow}>
            {(["doctor", "patient"] as const).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: role === item }}
                onPress={() => setRole(item)}
                style={[styles.roleButton, role === item && styles.roleButtonSelected]}
              >
                <Text style={[styles.roleText, role === item && styles.roleTextSelected]}>
                  {item === "doctor" ? "Doctor" : "Patient"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helper}>Local demo identity: {demoParticipantReference(role)}</Text>

          <Text style={[styles.label, styles.spacedLabel]}>External appointment reference</Text>
          <TextInput
            value={appointmentReference}
            onChangeText={setAppointmentReference}
            autoCapitalize="none"
            style={styles.input}
            placeholder="e.g. appointment-2026-001"
          />
          <ActionButton label="Create and prepare room" onPress={create} disabled={busy || !appointmentReference.trim()} />

          <View style={styles.divider} />
          <Text style={styles.label}>Join an existing meeting</Text>
          <TextInput
            value={meetingId}
            onChangeText={setMeetingId}
            autoCapitalize="none"
            style={styles.input}
            placeholder="Paste meeting ID from the other device"
          />
          <ActionButton label="Join as selected role" onPress={join} disabled={busy || !meetingId.trim()} secondary />
          <ActionButton label="End this meeting" onPress={finishMeeting} disabled={busy || !(meeting?.id || meetingId.trim())} danger />
        </View>

        {busy && <ActivityIndicator color="#17685d" style={styles.spinner} />}
        <Text style={styles.status}>{message}</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.localNotice}>Local test only · role switching is not authentication.</Text>
      </View>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  secondary,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, secondary && styles.secondaryButton, danger && styles.dangerButton, disabled && styles.disabledButton]}
    >
      <Text style={[styles.actionText, secondary && styles.secondaryText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

function CallScreen({
  role,
  onLeave,
  onEnd,
  busy,
}: {
  role: ParticipantRole;
  onLeave: () => void;
  onEnd: () => void;
  busy: boolean;
}) {
  const room = useRoomContext();
  const [connection, setConnection] = useState(room.state);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const tracks = useTracks([Track.Source.Camera]);

  useEffect(() => {
    const onConnectionChange = (state: ConnectionState) => setConnection(state);
    room.on(RoomEvent.ConnectionStateChanged, onConnectionChange);
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, onConnectionChange);
    };
  }, [room]);

  const toggleMicrophone = async () => {
    try {
      const next = !microphoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicrophoneEnabled(next);
      setMediaError("");
    } catch {
      setMediaError("Microphone permission was denied or the device is unavailable.");
    }
  };

  const toggleCamera = async () => {
    try {
      const next = !cameraEnabled;
      await room.localParticipant.setCameraEnabled(next);
      setCameraEnabled(next);
      setMediaError("");
    } catch {
      setMediaError("Camera permission was denied or the device is unavailable.");
    }
  };

  const leaveCall = async () => {
    await room.disconnect();
    onLeave();
  };

  const stateLabel = connection === ConnectionState.Reconnecting
    ? "Reconnecting…"
    : connection === ConnectionState.Connected
      ? "Connected"
      : connection === ConnectionState.Connecting
        ? "Connecting…"
        : "Disconnected";

  return (
    <View style={styles.callPage}>
      <View style={styles.callHeader}>
        <View>
          <Text style={styles.callEyebrow}>18ROOTS CONSULTATION</Text>
          <Text style={styles.callTitle}>{role === "doctor" ? "Doctor room" : "Patient room"}</Text>
        </View>
        <Text style={styles.connection}>{stateLabel}</Text>
      </View>

      <FlatList
        contentContainerStyle={styles.videoList}
        data={tracks}
        keyExtractor={(item: TrackReferenceOrPlaceholder, index) =>
          isTrackReference(item) ? `${item.participant.identity}-${item.source}` : `waiting-${index}`
        }
        renderItem={({ item }) => (
          isTrackReference(item)
            ? <VideoTrack trackRef={item} style={styles.video} />
            : <View style={[styles.video, styles.videoPlaceholder]}><Text style={styles.placeholderText}>Waiting for video</Text></View>
        )}
        ListEmptyComponent={<View style={[styles.video, styles.videoPlaceholder]}><Text style={styles.placeholderText}>Waiting for the other participant</Text></View>}
      />

      {!!mediaError && <Text style={styles.callError}>{mediaError}</Text>}
      <View style={styles.controlRow}>
        <Pressable onPress={() => void toggleMicrophone()} style={[styles.control, !microphoneEnabled && styles.controlOff]}>
          <Text style={styles.controlText}>{microphoneEnabled ? "Mute" : "Unmute"}</Text>
        </Pressable>
        <Pressable onPress={() => void toggleCamera()} style={[styles.control, !cameraEnabled && styles.controlOff]}>
          <Text style={styles.controlText}>{cameraEnabled ? "Camera off" : "Camera on"}</Text>
        </Pressable>
        <Pressable onPress={() => void leaveCall()} style={[styles.control, styles.leaveControl]}>
          <Text style={styles.leaveText}>Leave</Text>
        </Pressable>
      </View>
      <ActionButton label={busy ? "Ending…" : "End meeting"} onPress={onEnd} disabled={busy} danger />
      <Text style={styles.callFootnote}>Leaving disconnects this device. Ending closes the meeting for both participants.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f1e9" },
  page: { flex: 1, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 18 },
  header: { marginBottom: 24 },
  eyebrow: { color: "#17685d", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#162d2a", fontSize: 30, lineHeight: 36, fontWeight: "700", marginTop: 9 },
  subtitle: { color: "#63716d", fontSize: 15, marginTop: 6 },
  panel: { backgroundColor: "#fffdf8", borderRadius: 22, padding: 18, borderWidth: 1, borderColor: "#e5e0d5" },
  label: { color: "#243b36", fontSize: 14, fontWeight: "700", marginBottom: 9 },
  roleRow: { flexDirection: "row", backgroundColor: "#f0eee7", borderRadius: 12, padding: 4 },
  roleButton: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 9 },
  roleButtonSelected: { backgroundColor: "#17685d" },
  roleText: { color: "#66716e", fontWeight: "700" },
  roleTextSelected: { color: "#ffffff" },
  helper: { color: "#77817e", fontSize: 12, marginTop: 8 },
  spacedLabel: { marginTop: 20 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#d8ddd6", backgroundColor: "#ffffff", borderRadius: 11, paddingHorizontal: 13, color: "#20312e", marginBottom: 11 },
  actionButton: { backgroundColor: "#17685d", borderRadius: 11, minHeight: 48, justifyContent: "center", alignItems: "center", marginTop: 9, paddingHorizontal: 14 },
  actionText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  secondaryButton: { backgroundColor: "#e8f1ec", borderWidth: 1, borderColor: "#c5d9d0" },
  secondaryText: { color: "#17685d" },
  dangerButton: { backgroundColor: "#f7e9e5", borderWidth: 1, borderColor: "#edc9bf" },
  dangerText: { color: "#9b3f30" },
  disabledButton: { opacity: 0.45 },
  divider: { height: 1, backgroundColor: "#e8e4dc", marginVertical: 18 },
  spinner: { marginTop: 18 },
  status: { color: "#54645f", textAlign: "center", marginTop: 18, lineHeight: 20 },
  error: { color: "#a33c30", textAlign: "center", marginTop: 9 },
  localNotice: { color: "#909994", fontSize: 11, textAlign: "center", marginTop: "auto", paddingTop: 22 },
  callPage: { flex: 1, backgroundColor: "#142321", paddingHorizontal: 18, paddingTop: 24, paddingBottom: 16 },
  callHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  callEyebrow: { color: "#90b8a9", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  callTitle: { color: "#f5f1e9", fontSize: 22, fontWeight: "700", marginTop: 5 },
  connection: { color: "#d4ded8", fontSize: 12, fontWeight: "600" },
  videoList: { gap: 12, paddingBottom: 12 },
  video: { height: 260, width: "100%", borderRadius: 18, overflow: "hidden", backgroundColor: "#263734" },
  videoPlaceholder: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#43534e" },
  placeholderText: { color: "#d3ddd7", fontSize: 14 },
  controlRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, paddingVertical: 12 },
  control: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: "#30413d", alignItems: "center", justifyContent: "center" },
  controlOff: { backgroundColor: "#4b3b37" },
  controlText: { color: "#f5f1e9", fontSize: 12, fontWeight: "700" },
  leaveControl: { backgroundColor: "#bd4e3d" },
  leaveText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  callError: { color: "#ffb4a8", textAlign: "center", marginBottom: 8 },
  callFootnote: { color: "#9eaaa5", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 9 },
});

