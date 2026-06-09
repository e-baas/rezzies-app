import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  fullDark, fullLight,
  wordmarkTaglineDark, wordmarkTaglineLight,
  wordmarkDark, wordmarkLight,
  markDark, markLight,
} from './logoData';

// Real Rezzies logo (TYC-151). Replaces the emoji / placeholder rectangles.
//
// variant:
//   'full'           — rings + "Rezzies" wordmark + tagline (hero lockup) → auth/splash
//   'wordmarkTagline' — "Rezzies" + tagline (no rings)                     → onboarding/invite
//   'wordmark'        — "Rezzies" only                                     → Join/Create headers
//   'mark'            — rings + "Rezzies" (no tagline)                      → tab bar / small chrome
//
// theme: 'dark' → white ink (for dark surfaces, the app default)
//        'light' → near-black ink (for light surfaces)

export type LogoVariant = 'full' | 'wordmarkTagline' | 'wordmark' | 'mark';
export type LogoTheme = 'dark' | 'light';

// Intrinsic aspect ratios (width / height) from each SVG viewBox.
const ASPECT: Record<LogoVariant, number> = {
  full: 1072.43 / 286.15,           // 3.748
  wordmarkTagline: 866.72 / 286.15, // 3.029
  wordmark: 866.72 / 213.0,         // 4.069
  mark: 1072.43 / 213.0,            // 5.035
};

const XML: Record<LogoTheme, Record<LogoVariant, string>> = {
  dark: {
    full: fullDark,
    wordmarkTagline: wordmarkTaglineDark,
    wordmark: wordmarkDark,
    mark: markDark,
  },
  light: {
    full: fullLight,
    wordmarkTagline: wordmarkTaglineLight,
    wordmark: wordmarkLight,
    mark: markLight,
  },
};

type Props = {
  variant?: LogoVariant;
  theme?: LogoTheme;
  /** Target width in px. Height is derived from the logo's aspect ratio. */
  width?: number;
  /** Optional explicit height; overrides the aspect-derived height. */
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Logo({
  variant = 'full',
  theme = 'dark',
  width = 200,
  height,
  style,
}: Props) {
  const h = height ?? Math.round(width / ASPECT[variant]);
  return (
    <SvgXml
      xml={XML[theme][variant]}
      width={width}
      height={h}
      style={style}
    />
  );
}
