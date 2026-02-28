// Firebase読み込み（CDN版）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ★ここにFirebaseコンソールで出た設定を貼る
const firebaseConfig = {
  apiKey: "ここ",
  authDomain: "ここ",
  projectId: "ここ",
  appId: "ここ"
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
