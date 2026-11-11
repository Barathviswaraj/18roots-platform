import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { initials } from "@/lib/format";
import { colors, fonts, radius, shadow, spacing, type } from "@/theme";

export type IconName = ComponentProps<typeof Feather>["name"];

export function Card({
  children,
  tone = "surface",
  style,
  onPress,
  accessibilityLabel,
  hasActions,
}: {
  children: ReactNode;
  tone?: "surface" | "sage" | "rose";
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  // The card holds its own buttons: it stays tappable but is not announced as
  // a button, because a button inside a button breaks screen readers and web.
  hasActions?: boolean;
}) {
  const background = tone === "sage" ? colors.sageTint : tone === "rose" ? colors.roseTint : colors.surface;
  const content = <View style={[styles.card, { backgroundColor: background }, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={hasActions ? undefined : "button"}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] }]}
    >
      {content}
    </Pressable>
  );
}

export function SectionHeader({
  icon,
  iconNode,
  title,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  iconNode?: ReactNode;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.row}>
        {iconNode ?? (icon ? <Feather name={icon} size={18} color={colors.inkSoft} /> : null)}
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} style={styles.row} accessibilityRole="link">
          <Text style={styles.sectionAction}>{actionLabel}</Text>
          <Feather name="chevron-right" size={16} color={colors.inkSoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

type ButtonVariant = "primary" | "rose" | "outline" | "ghost";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  compact,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.sageDark, fg: colors.white, border: colors.sageDark },
    rose: { bg: colors.rose, fg: colors.white, border: colors.rose },
    outline: { bg: colors.surface, fg: colors.ink, border: colors.border },
    ghost: { bg: "transparent", fg: colors.sageDark, border: "transparent" },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Feather name={icon} size={compact ? 15 : 17} color={palette.fg} /> : null}
          <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color: palette.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  badge,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={styles.iconButton}
    >
      <Feather name={icon} size={20} color={colors.ink} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: "sage" | "rose" | "muted" | "danger" }) {
  const palette = {
    sage: { bg: colors.sageLight, fg: colors.sageDark },
    rose: { bg: colors.roseLight, fg: colors.roseDark },
    muted: { bg: colors.surfaceMuted, fg: colors.muted },
    danger: { bg: colors.dangerTint, fg: colors.danger },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.pillLabel, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export const Avatar = memo(function Avatar({
  name,
  uri,
  size = 64,
  shape = "rounded",
}: {
  name: string;
  uri?: string | null;
  size?: number;
  shape?: "rounded" | "circle";
}) {
  const borderRadius = shape === "circle" ? size / 2 : 14;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius }}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius }]} accessibilityLabel={name}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
});

export function MetaLine({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.metaLine}>
      <Feather name={icon} size={14} color={colors.muted} />
      <Text style={styles.metaText}>{children}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [styles.listRow, pressed && onPress ? { backgroundColor: colors.surfaceMuted } : null]}
    >
      <View style={[styles.listIcon, danger && { backgroundColor: colors.dangerTint }]}>
        <Feather name={icon} size={18} color={danger ? colors.danger : colors.sageDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Feather name="chevron-right" size={18} color={colors.faint} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  sectionAction: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
  button: {
    minHeight: 50,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  buttonCompact: { minHeight: 38, paddingHorizontal: spacing.lg },
  buttonLabel: { fontFamily: fonts.bodySemiBold, fontSize: 15 },
  buttonLabelCompact: { fontSize: 14 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.rose,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.white, fontFamily: fonts.bodySemiBold, fontSize: 10 },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.sageDark, borderColor: colors.sageDark },
  chipLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
  chipLabelSelected: { color: colors.white },
  pill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  avatar: { backgroundColor: colors.sageLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.display, color: colors.sageDark },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  metaText: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    minHeight: 56,
  },
  listIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
});
