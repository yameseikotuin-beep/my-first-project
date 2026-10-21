import Script from 'next/script';
import { lpConfig } from '@/config/lp.config';
import { validGa4Id, validMetaPixelId } from '@/lib/analytics';

// GA4 と Meta Pixel は、設定ファイル（または環境変数）に正しい形式の ID があるときだけ読み込む。
// gtag / fbq の用意は <head> 内で先に行い、最初のイベントが取りこぼされないようにする。
// ID は形式チェック済み（英数字と - のみ）なので、そのままスクリプトに埋め込んでよい。

const ga4Id = validGa4Id(lpConfig.analytics.ga4Id);
const pixelId = validMetaPixelId(lpConfig.analytics.metaPixelId);

/** ルートレイアウトの <head> に置く初期化コード */
export function AnalyticsHead() {
  return (
    <>
      {ga4Id && (
        <script
          id="ga4-init"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments);};gtag('js',new Date());gtag('config','${ga4Id}');`,
          }}
        />
      )}
      {pixelId && (
        <script
          id="meta-pixel-init"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`,
          }}
        />
      )}
    </>
  );
}

/** GA4 の本体スクリプト（表示を妨げないよう後から読み込む） */
export function AnalyticsScripts() {
  if (!ga4Id) return null;
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />;
}
