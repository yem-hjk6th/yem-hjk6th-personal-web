// The hero name: Archivo's width and weight axes swell near the pointer.
import { useRef } from 'react';
import VariableProximity from './VariableProximity';

export default function ProximityName({ label }: { label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span ref={ref} style={{ display: 'inline-block' }}>
      <VariableProximity
        label={label}
        containerRef={ref}
        fromFontVariationSettings="'wght' 820, 'wdth' 125"
        toFontVariationSettings="'wght' 420, 'wdth' 62"
        radius={220}
        falloff="gaussian"
      />
    </span>
  );
}
