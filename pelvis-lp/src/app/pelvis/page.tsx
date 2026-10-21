import { LpImageView } from '@/components/LpImageView';
import { StartButton } from '@/components/StartButton';
import { TrackView } from '@/components/TrackView';
import { lpConfig } from '@/config/lp.config';
import { surveyQuestions } from '@/content/survey';

export default function PelvisTopPage() {
  return (
    <>
      <TrackView event="lp_view" />
      <section className="pt-8 pb-10 sm:pt-14">
        <p className="mb-3 inline-block rounded-full bg-navy-100 px-3 py-1 text-sm font-bold text-navy-800">骨盤・姿勢のセルフチェック</p>
        <h1 className="text-[1.65rem] leading-snug font-bold text-navy-900 sm:text-4xl sm:leading-snug">
          反り腰、猫背、姿勢の左右差。
          <br />
          気になっていること、
          <br className="sm:hidden" />
          ありませんか？
        </h1>
        <p className="mt-5 text-base sm:text-lg">
          {surveyQuestions.length}つの質問に答えるだけで、骨盤や姿勢について気になっていることを整理できます。結果に合わせて、骨盤と姿勢の基礎知識をまとめた記事をご案内します。
        </p>

        <div className="mt-6">
          <LpImageView image={lpConfig.images.hero} configKey="images.hero" eager />
        </div>

        <ul className="mt-6 grid grid-cols-3 gap-2 text-center text-sm">
          <li className="rounded-lg bg-white px-2 py-3 shadow-sm">
            <span className="block text-lg font-bold text-navy-800">{surveyQuestions.length}問</span>選択式
          </li>
          <li className="rounded-lg bg-white px-2 py-3 shadow-sm">
            <span className="block text-lg font-bold text-navy-800">約1分</span>で完了
          </li>
          <li className="rounded-lg bg-white px-2 py-3 shadow-sm">
            <span className="block text-lg font-bold text-navy-800">入力不要</span>名前・連絡先
          </li>
        </ul>

        <StartButton
          className="mt-8 flex min-h-14 w-full items-center justify-center rounded-full bg-navy-800 px-6 text-lg font-bold text-white shadow-md transition hover:bg-navy-700 active:scale-[0.98]"
        />
        <p className="mt-4 text-sm text-navy-700">
          ※このチェックは医学的な診断ではありません。選んだ内容を整理して表示するものです。回答はサーバーに送信・保存されません。
        </p>
      </section>
    </>
  );
}
