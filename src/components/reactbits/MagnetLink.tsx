// A contact link that leans toward the pointer.
import Magnet from './Magnet';

export default function MagnetLink({ href, text }: { href: string; text: string }) {
  return (
    <Magnet padding={60} magnetStrength={6} maxOffset={14} wrapperClassName="magnet-wrap">
      <a href={href} rel="noopener">{text}</a>
    </Magnet>
  );
}
