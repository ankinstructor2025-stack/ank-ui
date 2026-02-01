// ank_firebase.js
import { UI_FLAGS } from "./env.js";

// あなたの既存実装に合わせて import されている前提。
// もし firebase の import が別ファイルなら、ここは “今ある形” に合わせて置き換えてください。
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// 既存の firebaseConfig を使っている前提（env.js や別ファイルで定義しているならそこに合わせて）
import { firebaseConfig } from "./firebase-app.js";

function debug(...args) {
  if (UI_FLAGS?.DEBUG_LOG) console.log(...args);
}

let _app = null;
let _auth = null;

function ensureAuth() {
  if (_auth) return _auth;
  _app = initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  return _auth;
}

export function watchAuth(cb) {
  const auth = ensureAuth();
  return onAuthStateChanged(auth, (user) => cb(user || null));
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
