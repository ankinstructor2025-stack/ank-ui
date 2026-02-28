// Firebase読み込み（CDN版）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ★ここにFirebaseコンソールで出た設定を貼る
const firebaseConfig = {
  apiKey: "AIzaSyA55sbKFkPRKF5RlxeifVUIbko_Z74cOwY",
  authDomain: "ank-firebase.firebaseapp.com",
  projectId: "ank-firebase",
  storageBucket: "ank-firebase.firebasestorage.app",
  messagingSenderId: "808815038216",
  appId: "1:808815038216:web:ac0921bcabf763ece926bd",
  measurementId: "G-TC4J08VPTJ"
};

// Firebase起動
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ログインボタン押下
document.getElementById("loginButton").addEventListener("click", async (e) => {
  e.preventDefault(); // これでsubmit/遷移を潰す

  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert(err.code || String(err)); // 理由だけ出す
  }
});
