import type { Metadata } from 'next';
import { ArticleIntro } from '@/components/ArticleIntro';
import { LpImageView } from '@/components/LpImageView';
import { ReserveButton } from '@/components/ReserveButton';
import { ServiceSection } from '@/components/ServiceSection';
import { StickyReserveBar } from '@/components/StickyReserveBar';
import { TrackView } from '@/components/TrackView';
import { lpConfig } from '@/config/lp.config';
import { articleSections } from '@/content/article';
import { formatYen } from '@/lib/format';

export const metadata: Metadata = {
  title: '骨盤と姿勢の基礎知識',
  description: '骨盤と姿勢の基礎知識、姿勢を確認するときのポイント、骨盤起こし整体の内容と初回料金をご案内します。',
};

export default function ArticlePage() {
  const { service } = lpConfig;
  return (
    <article className="py-8 leading-[1.9]">
      <TrackView event="article_view" />
      <ArticleIntro />

      <nav aria-label="目次" className="mt-8 rounded-xl border border-beige-200 bg-white p-5">
        <p className="font-bold text-navy-800">目次</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.95rem]">
          {articleSections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-navy-700 underline underline-offset-4">
                {s.title}
              </a>
            </li>
          ))}
          <li>
            <a href="#offer" className="text-navy-700 underline underline-offset-4">
              {service.name}の施術内容・初回料金
            </a>
          </li>
        </ol>
      </nav>

      {articleSections.map((section, i) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="mt-12 scroll-mt-4 space-y-4">
          <h2 id={`${section.id}-title`} className="border-l-4 border-navy-800 pl-3 text-xl leading-snug font-bold sm:text-2xl">
            {section.title}
          </h2>
          {section.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {section.points && (
            <ul className="space-y-3">
              {section.points.map((pt) => (
                <li key={pt.title} className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-bold text-navy-800">{pt.title}</p>
                  <p className="mt-1 text-[0.95rem]">{pt.body}</p>
                </li>
              ))}
            </ul>
          )}
          {section.note && <p className="rounded-lg bg-beige-100 px-4 py-3 text-sm">※{section.note}</p>}
          {i === 0 && <LpImageView image={lpConfig.images.article} configKey="images.article" />}
        </section>
      ))}

      <aside aria-label="初回のご案内" className="mt-12 rounded-2xl bg-beige-100 p-5">
        <p className="font-bold text-navy-800">姿勢のことを、一度専門家と確認してみませんか？</p>
        <p className="mt-2 text-[0.95rem]">
          {service.name}は、初回{formatYen(service.firstPriceYen)}（税込）でご予約いただけます。
        </p>
        <ReserveButton placement="article_middle" className="mt-4" />
      </aside>

      <ServiceSection />

      <section aria-labelledby="final-cta-title" className="mt-14 rounded-2xl bg-navy-800 p-6 text-white">
        <h2 id="final-cta-title" className="text-xl font-bold">
          ご予約はこちらから
        </h2>
        <p className="mt-2 text-[0.95rem] text-navy-100">
          {service.name}の初回料金は{formatYen(service.firstPriceYen)}（税込）です。予約ページでご希望の日時をお選びください。
        </p>
        <ReserveButton placement="article_end" className="mt-5" />
      </section>

      <StickyReserveBar />
    </article>
  );
}
