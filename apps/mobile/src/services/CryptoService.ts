import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

/**
 * Шифрування чутливих полів перед записом у SQLite (лаб. 4).
 *
 * AES-256-CBC. Ключ генерується один раз криптостійким ГПВЧ (expo-crypto)
 * і зберігається в SecureStore (Keychain / Android Keystore), а не в БД.
 * Для кожного значення — випадковий IV; формат шифротексту: `ivHex:cipherBase64`.
 */
export interface ICryptoService {
  init(): Promise<void>;
  encrypt(plain: string): string;
  decrypt(cipher: string): string;
}

const KEY_NAME = 'student_hub_aes_key';

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export class AesCryptoService implements ICryptoService {
  private key?: CryptoJS.lib.WordArray;

  async init(): Promise<void> {
    let hex = await SecureStore.getItemAsync(KEY_NAME);
    if (!hex) {
      hex = bytesToHex(Crypto.getRandomBytes(32));
      await SecureStore.setItemAsync(KEY_NAME, hex);
    }
    this.key = CryptoJS.enc.Hex.parse(hex);
  }

  encrypt(plain: string): string {
    if (!plain) return '';
    // IV беремо з expo-crypto: crypto-js у Hermes не має власного безпечного ГПВЧ.
    const iv = CryptoJS.enc.Hex.parse(bytesToHex(Crypto.getRandomBytes(16)));
    const enc = CryptoJS.AES.encrypt(plain, this.requireKey(), { iv });
    return `${iv.toString(CryptoJS.enc.Hex)}:${enc.ciphertext.toString(CryptoJS.enc.Base64)}`;
  }

  decrypt(cipher: string): string {
    if (!cipher) return '';
    const [ivHex, data] = cipher.split(':');
    const params = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(data) });
    const dec = CryptoJS.AES.decrypt(params, this.requireKey(), { iv: CryptoJS.enc.Hex.parse(ivHex) });
    return dec.toString(CryptoJS.enc.Utf8);
  }

  private requireKey() {
    if (!this.key) throw new Error('CryptoService is not initialized');
    return this.key;
  }
}
