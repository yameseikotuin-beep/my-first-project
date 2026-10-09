import type { DishPhoto } from './dishPhotos'

/**
 * 料理のイメージ写真の出典とライセンス。CC BY / CC BY-SA の写真は、作者名・ライセンス・出典の表示が
 * 利用の条件なので、「写真の出典」画面（#/credits）に一覧を表示する。
 * 写真は正方形に切り抜き、縮小して使っている（CC BY-SA の写真の加工版も同じ CC BY-SA）。
 */
export interface PhotoCredit {
  photo: DishPhoto | 'hero' | 'calorie' | 'ingredients'
  title: string
  creator: string
  license: string
  licenseUrl: string
  source: string
}

export const PHOTO_CREDITS: PhotoCredit[] = [
  { photo: "jp-teriyaki", title: "Chicken Teriyaki 2", creator: "mosespreciado", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/49326400@N00/6870392251" },
  { photo: "jp-teriyaki-fish", title: "Adam Liaw's teriyaki salmon for Fox's dinner tonight, usi…", creator: "transcendancing", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://www.flickr.com/photos/40567405@N07/49833355826" },
  { photo: "jp-tojitamago", title: "親子丼 Oyakodon in japan", creator: "sese_87", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://www.flickr.com/photos/59820460@N07/31258542004" },
  { photo: "jp-foil", title: "Cod Baked in Foil with Leeks and Carrots", creator: "thebittenword.com", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/22198928@N00/3524130980" },
  { photo: "jp-miso-soup", title: "tonjiru", creator: "nyaa_birdies_perch", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/94862897@N00/5445731258" },
  { photo: "jp-natto-rice", title: "Dinner @ Kasa", creator: "jetalone", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/92203585@N00/395309680" },
  { photo: "cn-steam-fish", title: "Steamed Barramundi - Wing Loong Restaurant", creator: "avlxyz", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://www.flickr.com/photos/10559879@N00/2777194627" },
  { photo: "jp-steam", title: "steamed chicken with vegetables.", creator: "stu_spivack", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://www.flickr.com/photos/35034346243@N01/332285073" },
  { photo: "cn-oyster", title: "Beef and broccoli stir fry", creator: "joyosity", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/33993074@N00/27932366904" },
  { photo: "cn-mabo", title: "Mapo Tofu", creator: "crd!", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/61324768@N00/5007261302" },
  { photo: "west-lemon", title: "Paillarde De Poulet Grillée Aux Deux Citrons, Des De Toma…", creator: "TheGirlsNY", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://www.flickr.com/photos/55768440@N00/3576998553" },
  { photo: "west-lemon-fish", title: "Kettle of Fish - Halibut", creator: "closari", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/9472272@N08/2221620159" },
  { photo: "west-soup", title: "minestrone", creator: "waldopics", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/85056813@N00/3581699066" },
  { photo: "west-pasta", title: "Tomato pasta", creator: "jh_tan84", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/21045446@N00/6297361057" },
  { photo: "west-omelet", title: "Omelette", creator: "jorgee.net.co", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/87073872@N00/462917140" },
  { photo: "west-yogurt", title: "Oatmeal with Blueberries", creator: "TheCulinaryGeek", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/72949902@N00/5076894938" },
  { photo: "kr-bibimbap", title: "Bibimbap - Cafe Mi Hee", creator: "avlxyz", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://www.flickr.com/photos/10559879@N00/1088830040" },
  { photo: "kr-sundubu", title: "Sundubu-jjigae", creator: "Kanesue", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://www.flickr.com/photos/36749444@N06/51700411194" },
  { photo: "kr-kimchi", title: "Jeyuk-bokkeum 4", creator: "대경라이프", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/w/index.php?curid=99799727" },
  { photo: "eth-gapao", title: "Pad kra pao gai - Cher Thai Eatery, North Street, Clapham", creator: "Haydn Blackey", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://www.flickr.com/photos/54549113@N00/52693327724" },
  { photo: "eth-yum", title: "Yum Woon Sen - Thai Saffron, Malvern East AUD10", creator: "avlxyz", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://www.flickr.com/photos/10559879@N00/4587870299" },
  { photo: "eth-soup", title: "Tofu soup with big shrimp, carrot, enoki and glass noodles", creator: "Phoebe Lim", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://www.flickr.com/photos/71837271@N00/8596585029" },
  { photo: "steam", title: 'Unsplash photo-1547496502-affa22d38842', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1547496502-affa22d38842' },
  { photo: "grill", title: 'Unsplash photo-1519708227418-c8fd9a32b7a2', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2' },
  { photo: "simmer", title: 'Unsplash photo-1574484284002-952d92456975', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1574484284002-952d92456975' },
  { photo: "bowl", title: 'Unsplash photo-1569718212165-3a8278d5f624', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624' },
  { photo: "salad", title: 'Unsplash photo-1546793665-c74683f339c1', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1546793665-c74683f339c1' },
  { photo: "soup", title: 'Unsplash photo-1617093727343-374698b1b08d', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d' },
  { photo: "tomato-soup", title: 'Unsplash photo-1547592166-23ac45744acd', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1547592166-23ac45744acd' },
  { photo: "stirfry", title: 'Unsplash photo-1604908176997-125f25cc6f3d', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d' },
  { photo: "rice", title: 'Unsplash photo-1512058564366-18510be2db19', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1512058564366-18510be2db19' },
  { photo: "pasta", title: 'Unsplash photo-1621996346565-e3dbc646d9a9', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9' },
  { photo: "egg", title: 'Unsplash photo-1525351484163-7529414344d8', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1525351484163-7529414344d8' },
  { photo: "fruit-bowl", title: 'Unsplash photo-1490474418585-ba9bad8fd0ea', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea' },
  { photo: "grill-meat", title: 'Unsplash photo-1532550907401-a500c9a57435', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435' },
  { photo: 'hero', title: 'Unsplash photo-1546069901-ba9599a7e63c', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c' },
  { photo: 'calorie', title: 'Unsplash photo-1532550907401-a500c9a57435', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435' },
  { photo: 'ingredients', title: 'Unsplash photo-1498837167922-ddd27525d352', creator: 'Unsplash', license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', source: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352' },
]
