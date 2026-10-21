import Image from 'next/image';
import Link from 'next/link';
import { lpConfig } from '@/config/lp.config';

export function Header() {
  const { logo, store, service } = lpConfig;
  return (
    <header className="border-b border-beige-200 bg-white/95">
      <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
        <Link href="/pelvis/" className="flex items-center gap-2 font-bold text-navy-800">
          {logo ? (
            <Image src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} className="h-9 w-auto" loading="eager" />
          ) : (
            <span className="text-lg tracking-wide">{store.name || service.name}</span>
          )}
        </Link>
      </div>
    </header>
  );
}
