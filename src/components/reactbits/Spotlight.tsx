// A project row with a soft light that follows the pointer or keyboard focus.
// Uses SpotlightCard's dark palette (light edge and glow); the card surface is
// made transparent in Home.astro so the row sits on whichever --bg is chosen.
import type { ReactNode } from 'react';
import SpotlightCard from './SpotlightCard';

export default function Spotlight({ children }: { children?: ReactNode }) {
  return (
    <SpotlightCard theme="dark" spotlightColor="#A3C8FF" intensity={0.16} spotlightSize={320} proximity={40} className="v3-spot">
      {children}
    </SpotlightCard>
  );
}
