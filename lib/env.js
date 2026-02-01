// lib/env.js
// UI側の「環境差分」だけを集約するファイル
// ※ ロジックは禁止。定数のみ。

/**
 * Firebase 設定
 * - プロジェクト切替時にここだけ差し替える
 */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBpHlwulq6lnbmBzNm0rEYNahWk7liD3BM",
  authDomain: "ank-project-77283.firebaseapp.com",
  projectId: "ank-project-77283",
  storageBucket: "ank-project-77283.firebasestorage.app",
  messagingSenderId: "707356972093",
  appId: "1:707356972093:web:03d20f1c1e5948150f8654",
};
/**
 * API のベースURL
 * - Cloud Run / ローカル切替用
 */
export const API_BASE = "https://ank-admin-api-986862757498.asia-northeast1.run.app";

/**
 * UI 動作モード
 * - デバッグ用途（挙動を変えるためのフラグ）
 */
export const UI_FLAGS = {
  AUTO_REDIRECT_AFTER_LOGIN: false, // true にするとログイン後自動遷移
  DEBUG_LOG: true,                  // console.log を有効化
};

/**
 * UIメタ情報（表示・識別用）
 * - ロジックには使わない
 */
export const UI_META = {
  APP_NAME: "ank-ui",
  ENV_NAME: "prod", // "dev" | "stg" | "prod"
};
