// lib/firebase_auth.js
// Firebase Authentication 専用モジュール
// ・初期化
// ・ログイン / ログアウト
// ・認証状態監視
// ・IDトークン取得
// ※ アプリロジックは一切持たせない

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import { FIREBASE_CONFIG } from "./env.js";

/* ------------------------------------------------------------------
 * 初期化（1回だけ）
 * ------------------------------------------------------------------ */
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/* ------------------------------------------------------------------
 * 認証状態
 * ------------------------------------------------------------------ */

/**
 * 認証状態を監視する
 * @param {(user: object|null) => void} callback
 * @returns unsubscribe function
 */
export function watchAuth(callback) {
  return onAuthStateChanged(auth, (user) => {
    callback(user || null);
  });
}

/**
 * 現在のユーザーを取得（同期）
 */
export function getCurrentUser() {
  return auth.currentUser || null;
}

/* ------------------------------------------------------------------
 * ログイン / ログアウト
 * ------------------------------------------------------------------ */

/**
 * Google ログイン
 * @returns Firebase User
 */
export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/**
 * ログアウト
 */
export async function logout() {
  await signOut(auth);
}

/* ------------------------------------------------------------------
 * トークン
 * ------------------------------------------------------------------ */

/**
 * IDトークンを取得
 * @param {boolean} forceRefresh
 * @returns {string|null}
 */
export async function getIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(forceRefresh);
}
