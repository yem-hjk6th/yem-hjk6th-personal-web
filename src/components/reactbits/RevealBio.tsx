// The bio fills in word by word as it scrolls through the viewport.
import ScrollReveal from './ScrollReveal';

export default function RevealBio({ text }: { text: string }) {
  return (
    <ScrollReveal baseOpacity={0.18} enableBlur={false} baseRotation={0} containerClassName="bio-reveal" textClassName="bio-reveal-text"
      wordAnimationEnd="center center">
      {text}
    </ScrollReveal>
  );
}
