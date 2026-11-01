// The bio fills in word by word once, when it enters the viewport.
// 'enter' mode (not 'scrub') so the text never fades back out when scrolling up.
import ScrollReveal from './ScrollReveal';

export default function RevealBio({ text }: { text: string }) {
  return (
    <ScrollReveal baseOpacity={0.18} enableBlur={false} baseRotation={0} containerClassName="bio-reveal" textClassName="bio-reveal-text"
      mode="enter" duration={1.1} stagger={0.02}>
      {text}
    </ScrollReveal>
  );
}
