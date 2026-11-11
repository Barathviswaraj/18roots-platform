import { Feather } from "@expo/vector-icons";
import {
  AudioSession,
  isTrackReference,
  LiveKitRoom,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  VideoTrack,
  type TrackReferenceOrPlaceholder,
} from "@livekit/react-native";
import { useKeepAwake } from "expo-keep-awake";
import { ConnectionState, RoomEvent, Track, type LocalVideoTrack } from "livekit-client";
import { useEffect, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CallCredentials } from "@/api/meeting";
import { Avatar } from "@/components/ui";
import { env } from "@/lib/env";
import { useT } from "@/i18n";
import { colors, fonts, radius, spacing } from "@/theme";

export type CallRoomProps = {
  credentials: CallCredentials;
  doctorName: string;
  onLeave: () => void;
  onFailed: (message: string) => void;
};

export function CallRoom({ credentials, doctorName, onLeave, onFailed }: CallRoomProps) {
  useKeepAwake();
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    let active = true;
    AudioSession.startAudioSession()
      .catch(() => undefined)
      .finally(() => active && setAudioReady(true));
    return () => {
      active = false;
      AudioSession.stopAudioSession().catch(() => undefined);
    };
  }, []);

  if (!audioReady) return <View style={styles.page} />;

  return (
    <LiveKitRoom
      serverUrl={credentials.serverUrl}
      token={credentials.token}
      connect
      audio
      video
      options={{ adaptiveStream: { pixelDensity: "screen" }, dynacast: true }}
      onError={(error) => onFailed(error.message)}
    >
      <RoomView doctorName={doctorName} meetingId={credentials.demo || env.showMeetingId ? credentials.meetingId : null} onLeave={onLeave} />
    </LiveKitRoom>
  );
}

function useConnectionState() {
  const room = useRoomContext();
  const [state, setState] = useState(room.state);
  useEffect(() => {
    const update = (next: ConnectionState) => setState(next);
    room.on(RoomEvent.ConnectionStateChanged, update);
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, update);
    };
  }, [room]);
  return state;
}

function useElapsed(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function RoomView({
  doctorName,
  meetingId,
  onLeave,
}: {
  doctorName: string;
  meetingId: string | null;
  onLeave: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const connection = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const elapsed = useElapsed(connection === ConnectionState.Connected);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [mediaError, setMediaError] = useState<string | null>(null);

  const remote = tracks.find((item) => !item.participant.isLocal);
  const local = tracks.find((item) => item.participant.isLocal);

  const statusLabel =
    connection === ConnectionState.Reconnecting || connection === ConnectionState.SignalReconnecting
      ? t("call.reconnecting")
      : connection === ConnectionState.Connected
        ? elapsed
        : t("call.connecting");

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      setMediaError(null);
    } catch {
      setMediaError(t("call.permissions"));
    }
  };

  const flip = () =>
    run(async () => {
      const next = facing === "user" ? "environment" : "user";
      const publication = localParticipant.getTrackPublication(Track.Source.Camera);
      await (publication?.videoTrack as LocalVideoTrack | undefined)?.restartTrack({ facingMode: next });
      setFacing(next);
    });

  const leave = async () => {
    await room.disconnect();
    onLeave();
  };

  return (
    <View style={styles.page}>
      <View style={StyleSheet.absoluteFill}>
        {remote && isTrackReference(remote) ? (
          <VideoTrack trackRef={remote} style={StyleSheet.absoluteFill} objectFit="cover" />
        ) : (
          <View style={styles.waiting}>
            <Avatar name={doctorName} size={96} shape="circle" />
            <Text style={styles.waitingText}>{t("call.waitingFor", { name: doctorName })}</Text>
            {meetingId ? (
              <Text style={styles.meetingId} selectable>
                {t("call.meetingId", { id: meetingId })}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <Text style={styles.doctor}>{doctorName}</Text>
          <Text style={styles.status}>{statusLabel}</Text>
        </View>
        {connection !== ConnectionState.Connected ? <Feather name="loader" size={18} color={colors.white} /> : null}
      </View>

      {local ? (
        <LocalPreview track={local} cameraOn={isCameraEnabled} label={t("call.you")} top={insets.top + 70} />
      ) : null}

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}>
        {mediaError ? <Text style={styles.error}>{mediaError}</Text> : null}
        <View style={styles.controlRow}>
          <Control
            icon={isMicrophoneEnabled ? "mic" : "mic-off"}
            label={isMicrophoneEnabled ? t("call.mute") : t("call.unmute")}
            off={!isMicrophoneEnabled}
            onPress={() => run(() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))}
          />
          <Control
            icon={isCameraEnabled ? "video" : "video-off"}
            label={isCameraEnabled ? t("call.cameraOff") : t("call.cameraOn")}
            off={!isCameraEnabled}
            onPress={() => run(() => localParticipant.setCameraEnabled(!isCameraEnabled))}
          />
          <Control icon="refresh-cw" label={t("call.flip")} onPress={flip} />
          <Control icon="phone-off" label={t("call.leave")} danger onPress={leave} />
        </View>
      </View>
    </View>
  );
}

function LocalPreview({
  track,
  cameraOn,
  label,
  top,
}: {
  track: TrackReferenceOrPlaceholder;
  cameraOn: boolean;
  label: string;
  top: number;
}) {
  return (
    <View style={[styles.pip, { top }]}>
      {cameraOn && isTrackReference(track) ? (
        <VideoTrack trackRef={track} style={StyleSheet.absoluteFill} objectFit="cover" mirror zOrder={1} />
      ) : (
        <View style={styles.pipOff}>
          <Feather name="video-off" size={20} color={colors.white} />
        </View>
      )}
      <Text style={styles.pipLabel}>{label}</Text>
    </View>
  );
}

function Control({
  icon,
  label,
  onPress,
  off,
  danger,
}: {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  off?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.control}>
      <View style={[styles.controlCircle, off && styles.controlOff, danger && styles.controlDanger]}>
        <Feather name={icon} size={22} color={off ? colors.ink : colors.white} />
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#1F2A23" },
  waiting: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  waitingText: { fontFamily: fonts.display, fontSize: 22, color: colors.white, textAlign: "center" },
  meetingId: { fontFamily: fonts.body, fontSize: 12, color: "#C9D3C7", textAlign: "center" },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(20, 28, 23, 0.45)",
  },
  doctor: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  status: { fontFamily: fonts.bodyMedium, fontSize: 13, color: "#D9E2D6", marginTop: 2 },
  pip: {
    position: "absolute",
    right: spacing.lg,
    width: 108,
    height: 150,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#33413A",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  pipOff: { flex: 1, alignItems: "center", justifyContent: "center" },
  pipLabel: {
    position: "absolute",
    bottom: 6,
    left: 8,
    color: colors.white,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.lg,
    backgroundColor: "rgba(20, 28, 23, 0.55)",
  },
  controlRow: { flexDirection: "row", justifyContent: "space-evenly" },
  control: { alignItems: "center", gap: 6, minWidth: 64 },
  controlCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlOff: { backgroundColor: colors.white },
  controlDanger: { backgroundColor: colors.danger },
  controlLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.white },
  error: {
    color: "#F6C9C2",
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
