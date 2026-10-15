import { Redirect } from 'expo-router';

/**
 * Google ile girişten dönüş adresi (yola://auth-callback). Oturum giriş ekranında
 * oluşturulur; bu ekran sadece Android'de bağlantı uygulamayı açarsa boş sayfa görünmesin diye var.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
