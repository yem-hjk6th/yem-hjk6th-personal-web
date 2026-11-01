// A project row with a soft light that follows the pointer or keyboard focus.
import type { ReactNode } from 'react';
import SpotlightCard from './SpotlightCard';

export default function Spotlight({ children }: { children?: ReactNode }) {
  return (
    <SpotlightCard theme="light" spotlightColor="#2B3FC4" intensity={0.55} spotlightSize={320} proximity={40} className="v3-spot">
      {children}
    </SpotlightCard>
  );
}
