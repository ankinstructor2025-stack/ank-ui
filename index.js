// Firebase読み込み（CDN版）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA55sbKFkPRKF5RlxeifVUIbko_Z74cOwY",
  authDomain: "ank-firebase.firebaseapp.com",
  projectId: "ank-firebase",
  storageBucket: "ank-firebase.firebasestorage.app",
  messagingSenderId: "808815038216",
  appId: "1:808815038216:web:ac0921bcabf763ece926bd",
  measurementId: "G-TC4J08VPTJ"
};

// ★Cloud Run(API) のベースURL（あなたのURLに置き換える）
const API_BASE_URL = "https://ank-api-986862757498.asia-northeast1.run.app";

// Firebase起動
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ログインボタン押下
document.getElementById("loginButton").addEventListener("click", async (e) => {
  e.preventDefault();

  try {
    // ログイン
    const result = await signInWithPopup(auth, provider);

    // user_id取得
    const user_id = result.user.uid;

    // APIに通知
    await fetch(`${API_BASE_URL}/v1/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ user_id })
    });

    // ★ここで遷移
    window.location.href = "./data_source.html";

    } catch (err) {
    alert(err.code || String(err));
  }
});
