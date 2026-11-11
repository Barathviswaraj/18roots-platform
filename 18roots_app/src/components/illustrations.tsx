import { memo } from "react";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { colors } from "@/theme";

// Hand-drawn vector art for the 18Roots look: a lotus scene, leaves, a mortar
// and a product box. Vectors stay sharp on every screen and add no download.

const PETAL = "M0 0 C 9 -14 11 -34 0 -52 C -11 -34 -9 -14 0 0 Z";

function Lotus({ x, y, scale = 1, id }: { x: number; y: number; scale?: number; id: string }) {
  const outer = [-62, -36, 36, 62];
  const inner = [-16, 16];
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Defs>
        <LinearGradient id={`petal-${id}`} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#F7E2DC" />
          <Stop offset="0.55" stopColor="#ECB8AE" />
          <Stop offset="1" stopColor="#D88F86" />
        </LinearGradient>
      </Defs>
      {outer.map((angle) => (
        <Path key={angle} d={PETAL} fill={`url(#petal-${id})`} opacity={0.85} transform={`rotate(${angle})`} />
      ))}
      {inner.map((angle) => (
        <Path key={angle} d={PETAL} fill={`url(#petal-${id})`} transform={`rotate(${angle}) scale(1.05)`} />
      ))}
      <Path d={PETAL} fill={`url(#petal-${id})`} transform="scale(1.12)" />
      <Ellipse cx={0} cy={-6} rx={9} ry={4} fill="#E3B65C" opacity={0.75} />
    </G>
  );
}

function Leaf({ d, fill, vein }: { d: string; fill: string; vein: string }) {
  return (
    <G>
      <Path d={d} fill={fill} />
      <Path d={vein} stroke="#F4F1E8" strokeOpacity={0.5} strokeWidth={1.2} fill="none" />
    </G>
  );
}

export const LotusScene = memo(function LotusScene({ width = 220, height = 210 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 220 210">
      <Circle cx={118} cy={38} r={22} fill="#F1CFC6" opacity={0.75} />
      <Path
        d="M0 96 C 30 70 52 74 74 88 C 94 70 118 58 146 80 C 170 66 196 72 220 92 L 220 150 L 0 150 Z"
        fill="#E4E9DD"
        opacity={0.75}
      />
      <Path
        d="M0 116 C 34 98 60 104 88 116 C 120 98 160 100 220 118 L 220 160 L 0 160 Z"
        fill="#D9E1D0"
        opacity={0.7}
      />
      <Leaf
        d="M70 210 C 64 170 84 132 128 118 C 132 156 112 192 70 210 Z"
        fill="#6F8D69"
        vein="M70 208 C 88 178 104 150 126 122"
      />
      <Leaf
        d="M118 210 C 128 164 160 136 214 134 C 204 176 170 202 118 210 Z"
        fill="#5E7D5C"
        vein="M120 208 C 150 182 180 158 212 136"
      />
      <Leaf
        d="M150 210 C 150 184 168 166 198 160 C 198 188 182 204 150 210 Z"
        fill="#86A57F"
        vein="M152 208 C 168 192 182 178 196 162"
      />
      <Path d="M150 120 C 152 140 150 168 146 196" stroke="#6F8D69" strokeWidth={3} fill="none" />
      <Path d="M186 86 C 186 110 182 150 176 196" stroke="#6F8D69" strokeWidth={3} fill="none" />
      <Lotus x={150} y={122} scale={0.82} id="a" />
      <Lotus x={186} y={88} scale={0.62} id="b" />
      <G transform="translate(112 150) rotate(-18)">
        <Path d="M0 0 C 6 -10 7 -22 0 -32 C -7 -22 -6 -10 0 0 Z" fill="#EDBFB6" />
      </G>
    </Svg>
  );
});

export const LeafSprig = memo(function LeafSprig({ size = 54, opacity = 0.9 }: { size?: number; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" opacity={opacity}>
      <Path d="M8 58 C 18 40 30 26 50 14" stroke="#7E9B78" strokeWidth={1.6} fill="none" />
      <Path d="M24 40 C 18 30 22 20 34 16 C 36 28 32 36 24 40 Z" fill="#8FAE87" />
      <Path d="M36 30 C 38 20 46 14 58 16 C 54 26 46 32 36 30 Z" fill="#6F8D69" />
      <Path d="M16 50 C 8 46 6 36 12 28 C 20 34 20 44 16 50 Z" fill="#A8C09F" />
    </Svg>
  );
});

export const LeafIcon = memo(function LeafIcon({
  size = 22,
  color = colors.inkSoft,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 19 C 5 10 11 5 20 4 C 20 13 15 19 6 19" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M5 19 C 9 15 12 12 15 9" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
});

export const LogoLeaf = memo(function LogoLeaf({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 20 C 6 11 12 6 21 4 C 19 13 13 18 4 20 Z" fill={colors.sage} />
      <Path d="M4 20 C 9 15 13 11 18 7" stroke="#F6F1E9" strokeWidth={1.2} fill="none" />
    </Svg>
  );
});

export const MortarIllustration = memo(function MortarIllustration({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={0} y={0} width={64} height={64} rx={14} fill="#EFE7DB" />
      <Path d="M40 12 L 48 8 L 50 12 L 34 34" stroke="#8E7B66" strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M12 30 L 52 30 C 52 42 44 50 32 50 C 20 50 12 42 12 30 Z" fill="#A8B59E" />
      <Path d="M12 30 L 52 30" stroke="#7E9174" strokeWidth={2} />
      <Rect x={24} y={50} width={16} height={5} rx={2} fill="#8E9D84" />
      <Path d="M16 26 C 14 22 16 18 20 18 C 20 22 19 24 16 26 Z" fill="#6F8D69" />
      <Path d="M48 26 C 50 21 48 17 44 17 C 44 21 45 24 48 26 Z" fill="#86A57F" />
    </Svg>
  );
});

export const ProductBox = memo(function ProductBox({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={0} y={0} width={64} height={64} rx={14} fill="#EEF0E7" />
      <Path d="M14 22 L 32 14 L 50 22 L 50 46 L 32 54 L 14 46 Z" fill="#8FA785" />
      <Path d="M14 22 L 32 30 L 50 22" stroke="#7A9370" strokeWidth={1.5} fill="none" />
      <Path d="M32 30 L 32 54" stroke="#7A9370" strokeWidth={1.5} />
      <Path d="M14 22 L 32 30 L 32 54 L 14 46 Z" fill="#A3B899" />
      <Path d="M20 36 C 20 32 24 30 27 31 C 27 35 24 37 20 36 Z" fill="#F4F1E8" opacity={0.85} />
      <Path d="M38 34 L 46 31" stroke="#F4F1E8" strokeOpacity={0.8} strokeWidth={1.5} />
      <Path d="M38 38 L 46 35" stroke="#F4F1E8" strokeOpacity={0.6} strokeWidth={1.5} />
    </Svg>
  );
});
