import Image from 'next/image';
import type { LpImage } from '@/config/lp.config';
import { DevNotice } from './DevNotice';

type Props = {
  image: LpImage | null;
  /** 設定ファイルでの項目名（未設定のときの案内用） */
  configKey: string;
  /** ファーストビューなど最初に見える画像だけ true（それ以外は遅延読み込み） */
  eager?: boolean;
  className?: string;
};

export function LpImageView({ image, configKey, eager = false, className = '' }: Props) {
  if (!image) return <DevNotice>画像（{configKey}）が未設定です。public/images/ に画像を置き、src/config/lp.config.ts に設定してください。</DevNotice>;
  return (
    <Image
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes="(min-width: 768px) 720px, 100vw"
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      className={`h-auto w-full rounded-xl object-cover ${className}`}
    />
  );
}
