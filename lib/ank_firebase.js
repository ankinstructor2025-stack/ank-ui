// ank_firebase.js
import { UI_FLAGS } from "./env.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import { FIREBASE_CONFIG } from "./env.js";

function debug(...args) {
  if (UI_FLAGS?.DEBUG_LOG) console.log(...args);
}

let _app = null;
let _auth = null;

function ensureAuth() {
  if (_auth) return _auth;
  _app = initializeApp(FIREBASE_CONFIG);
  _auth = getAuth(_app);
  return _auth;
}

export function watchAuth(cb) {
  const auth = ensureAuth();
  return onAuthStateChanged(auth, (user) => cb(user || null));
}

// ★追加：他ファイルが期待しているAPIを壊さないために残す
export function getCurrentUser() {
  const auth = ensureAuth();
  return auth.currentUser || null;
}

export async function loginWithGoogle() {
  const auth = ensureAuth();
  const provider = new GoogleAuthProvider();

  // ★アカウント選択を出しやすくする
  provider.setCustomParameters({ prompt: "select_account" });

  debug("[auth] signInWithPopup");
  return await signInWithPopup(auth, provider);
}

export async function getIdTokenOrNull(forceRefresh = false) {
  const auth = ensureAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(!!forceRefresh);
}
