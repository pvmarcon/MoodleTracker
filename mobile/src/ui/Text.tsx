import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '~/theme';

type Tone = 'fg' | 'muted' | 'subtle' | 'accent' | 'success' | 'danger' | 'warning';
type Variant = 'title' | 'h2' | 'h3' | 'body' | 'small' | 'caption' | 'overline';

const VARIANTS: Record<Variant, TextStyle> = {
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, lineHeight: 28 },
  h3: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
  small: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
};

export function Text({ variant = 'body', tone = 'fg', style, ...rest }: TextProps & { variant?: Variant; tone?: Tone }) {
  const { c } = useTheme();
  return <RNText style={[VARIANTS[variant], { color: c[tone] }, style]} {...rest} />;
}
