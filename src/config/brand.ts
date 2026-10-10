/**
 * Markanın tek kaynağı brand.json dosyasıdır. İsim, teknik kimlik ve marka
 * renkleri yalnızca orada değiştirilir; app.config.ts ve uygulama kodu oradan okur.
 *
 * - storeName: Mağazada görünecek tam ad (App Store'da benzersiz olması gereken kısım).
 * - bundleId: iOS bundle identifier ve Android package adı. Mağazaya yüklendikten sonra değiştirilemez.
 */
import brand from './brand.json';

export const Brand = brand;
