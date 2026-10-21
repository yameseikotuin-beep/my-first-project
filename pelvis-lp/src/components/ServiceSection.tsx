import { lpConfig } from '@/config/lp.config';
import { faqItems, serviceContent } from '@/content/service';
import { DevNotice } from './DevNotice';
import { LpImageView } from './LpImageView';
import { OfferPrice } from './OfferPrice';
import { OfferViewTracker } from './OfferViewTracker';
import { ReserveButton } from './ReserveButton';
import { StoreInfo } from './StoreInfo';

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="border-l-4 border-navy-800 pl-3 text-xl leading-snug font-bold sm:text-2xl">
      {children}
    </h2>
  );
}

/** サービス紹介・施術の流れ・初回料金・店舗情報・よくある質問 */
export function ServiceSection() {
  const { service } = lpConfig;
  return (
    <div id="offer" className="mt-14 scroll-mt-4 space-y-12">
      <section aria-labelledby="service-title" className="space-y-4">
        <SectionTitle id="service-title">{service.name}の施術内容</SectionTitle>
        {serviceContent.description.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <LpImageView image={lpConfig.images.service} configKey="images.service" />
        {serviceContent.treatmentItems.length > 0 ? (
          <ul className="space-y-3">
            {serviceContent.treatmentItems.map((item) => (
              <li key={item.title} className="rounded-xl bg-white p-4 shadow-sm">
                <p className="font-bold text-navy-800">{item.title}</p>
                <p className="mt-1 text-[0.95rem]">{item.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <DevNotice>実際の施術内容（src/content/service.ts の treatmentItems）が未設定です。店舗に確認した内容を入れてください。</DevNotice>
        )}
      </section>

      <section aria-labelledby="flow-title" className="space-y-4">
        <SectionTitle id="flow-title">来店から施術までの流れ</SectionTitle>
        <ol className="space-y-3">
          {serviceContent.flow.map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-xl bg-white p-4 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800 font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-bold text-navy-800">{step.title}</p>
                <p className="mt-1 text-[0.95rem]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        {serviceContent.flowIncomplete && (
          <DevNotice>来店後の流れ（カウンセリング・施術・お会計など）が未設定です。src/content/service.ts の flow に追加してください。</DevNotice>
        )}
      </section>

      <section aria-labelledby="price-title" className="space-y-4">
        <SectionTitle id="price-title">初回料金のご案内</SectionTitle>
        <OfferViewTracker>
          <OfferPrice />
        </OfferViewTracker>
        <ReserveButton placement="service" />
      </section>

      <section aria-labelledby="store-title" className="space-y-4">
        <SectionTitle id="store-title">店舗情報</SectionTitle>
        <StoreInfo />
      </section>

      <section aria-labelledby="faq-title" className="space-y-4">
        <SectionTitle id="faq-title">よくある質問</SectionTitle>
        <div className="space-y-3">
          {faqItems.map((item) => (
            <details key={item.question} className="group rounded-xl bg-white p-4 shadow-sm">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-bold text-navy-800">
                <span>Q. {item.question}</span>
                <span aria-hidden="true" className="text-xl transition group-open:rotate-45">
                  ＋
                </span>
              </summary>
              <p className="mt-3 text-[0.95rem]">A. {item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
