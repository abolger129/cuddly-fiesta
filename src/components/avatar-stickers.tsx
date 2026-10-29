import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { StickerId } from '@/lib/doodle';

/**
 * Stickers that sit on a doodle avatar, drawn on the doodle's 100 unit canvas so they
 * scale with it. Each one is drawn around (0, 0) and moved to where the player put it.
 */

const INK = '#15151B';
const LINE = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/** A sticker centered on (x, y) of the doodle canvas. Goes inside the doodle's Svg. */
export function StickerArt({ id, x, y }: { id: StickerId; x: number; y: number }) {
  return <G transform={`translate(${x} ${y})`}>{art(id)}</G>;
}

function art(id: StickerId) {
  switch (id) {
    case 'sunglasses':
      return (
        <>
          <Path d="M-22 -4L-27 -7M22 -4L27 -7M-5 -3Q0 -7 5 -3" fill="none" {...LINE} strokeWidth={2.5} />
          <Path d="M-23 -6H-4V1Q-4 10 -13.5 10Q-23 10 -23 1Z" fill={INK} {...LINE} />
          <Path d="M4 -6H23V1Q23 10 13.5 10Q4 10 4 1Z" fill={INK} {...LINE} />
          <Path d="M-19 -2L-14 -2M8 -2L13 -2" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    case 'headphones':
      return (
        <>
          <Path d="M-22 6C-22 -26 22 -26 22 6" fill="none" {...LINE} strokeWidth={4.5} />
          <Rect x={-29} y={0} width={11} height={19} rx={4} fill="#E8482A" {...LINE} />
          <Rect x={18} y={0} width={11} height={19} rx={4} fill="#E8482A" {...LINE} />
        </>
      );
    case 'party-hat':
      return (
        <>
          <Path d="M-13 9L0 -22L13 9Z" fill="#FFD43B" {...LINE} />
          <Circle cx={-4} cy={2} r={2.5} fill="#D6336C" />
          <Circle cx={5} cy={-4} r={2.5} fill="#3156F5" />
          <Circle cx={-1} cy={-11} r={2.2} fill="#0E9F7E" />
          <Circle cx={0} cy={-24} r={4.5} fill="#E8482A" {...LINE} />
        </>
      );
    case 'top-hat':
      return (
        <>
          <Rect x={-11} y={-20} width={22} height={26} rx={2} fill={INK} {...LINE} />
          <Rect x={-11} y={-2} width={22} height={4.5} fill="#E8482A" />
          <Rect x={-19} y={4} width={38} height={5} rx={2.5} fill={INK} {...LINE} />
        </>
      );
    case 'bow':
      return (
        <>
          <Path d="M0 0L-17 -10L-17 10Z" fill="#D6336C" {...LINE} />
          <Path d="M0 0L17 -10L17 10Z" fill="#D6336C" {...LINE} />
          <Circle cx={0} cy={0} r={4.5} fill="#B8245A" {...LINE} />
        </>
      );
    case 'star':
      return <Path d={STAR} fill="#FFD43B" {...LINE} />;
  }
}

const STAR = (() => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 14 : 6;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
  });
  return `M${points.join('L')}Z`;
})();

/** The league leader's crown, worn at a tilt on the edge of the avatar. */
export function Crown({ width }: { width: number }) {
  return (
    <Svg width={width} height={(width * 30) / 40} viewBox="0 0 40 30" accessible={false}>
      <Path d="M4 25L3 8L12.5 15L20 3.5L27.5 15L37 8L36 25Z" fill="#FFC81E" {...LINE} strokeWidth={2.4} />
      <Path d="M5 21H35" fill="none" stroke="#E8A400" strokeWidth={2} />
      <Circle cx={20} cy={3.5} r={2.6} fill="#E8482A" {...LINE} strokeWidth={1.6} />
      <Circle cx={3} cy={8} r={2.2} fill="#3156F5" {...LINE} strokeWidth={1.6} />
      <Circle cx={37} cy={8} r={2.2} fill="#3156F5" {...LINE} strokeWidth={1.6} />
    </Svg>
  );
}
