import { MD3LightTheme, type MD3Theme } from "react-native-paper";

// Colours taken from the 18Roots design: warm ivory paper, sage greens and dusty rose.
export const colors = {
  background: "#F6F1E9",
  surface: "#FFFCF7",
  surfaceMuted: "#F1EBE1",
  border: "#E6DED1",

  sage: "#6E8C72",
  sageDark: "#4C6955",
  sageLight: "#DDE6D6",
  sageTint: "#EBF0E5",

  rose: "#BE897F",
  roseDark: "#9E6A60",
  roseLight: "#F3DFD9",
  roseTint: "#FAEFEB",

  ink: "#2D3A31",
  inkSoft: "#4B574F",
  muted: "#7C857E",
  faint: "#A9AFA8",
  white: "#FFFFFF",

  success: "#4C7A59",
  warning: "#B5823C",
  danger: "#B2554B",
  dangerTint: "#F8E6E3",
} as const;

// Tamil text uses the platform's Tamil font automatically: Android and iOS
// fall back glyph by glyph when these fonts have no Tamil letters.
export const fonts = {
  display: "CormorantGaramond_600SemiBold",
  displayMedium: "CormorantGaramond_500Medium",
  displayBold: "CormorantGaramond_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  heading: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.ink },
  cardTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20, color: colors.ink },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.muted },
} as const;

export const shadow = {
  card: {
    shadowColor: "#5B5040",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
} as const;

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.sageDark,
    onPrimary: colors.white,
    primaryContainer: colors.sageLight,
    onPrimaryContainer: colors.ink,
    secondary: colors.rose,
    onSecondary: colors.white,
    secondaryContainer: colors.roseLight,
    onSecondaryContainer: colors.ink,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceMuted,
    onSurface: colors.ink,
    onSurfaceVariant: colors.inkSoft,
    outline: colors.border,
    error: colors.danger,
  },
};
