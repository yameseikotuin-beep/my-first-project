import { PHOTO_CREDITS } from '../data/photoCredits'

const HOME_PHOTOS = new Set(['hero', 'calorie', 'ingredients'])

/** 写真の出典とライセンスの一覧（CC BY / CC BY-SA の表示義務を満たすため） */
export function Credits() {
  const base = import.meta.env.BASE_URL
  return (
    <div>
      <h1>写真の出典</h1>
      <p className="small muted">
        レシピの写真は料理の種類ごとのイメージで、実際のレシピの完成写真ではありません。
        写真は正方形に切り抜き、縮小して使用しています。
      </p>
      <ul className="credit-list">
        {PHOTO_CREDITS.map((c) => (
          <li key={c.photo} className="credit-row">
            <img src={`${base}${HOME_PHOTOS.has(c.photo) ? 'home' : 'dishes'}/${c.photo}.jpg`} alt="" width={56} height={56} loading="lazy" />
            <span className="credit-text">
              <a href={c.source} target="_blank" rel="noopener noreferrer">{c.title}</a>
              <span className="tiny muted">
                作者: {c.creator}／<a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">{c.license}</a>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
