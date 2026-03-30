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

// Cloud Run(API) のベースURL
const API_BASE_URL = "https://ank-api-986862757498.asia-northeast1.run.app";

// Firebase起動
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

function showError(message) {
  const errorBox = document.getElementById("errorBox");
  if (errorBox) {
    errorBox.style.display = "block";
    errorBox.textContent = message;
  } else {
    alert(message);
  }
}

function clearError() {
  const errorBox = document.getElementById("errorBox");
  if (errorBox) {
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }
}

function showStatus(message) {
  const statusBox = document.getElementById("statusBox");
  if (statusBox) {
    statusBox.style.display = "block";
    statusBox.textContent = message;
  }
}

function clearStatus() {
  const statusBox = document.getElementById("statusBox");
  if (statusBox) {
    statusBox.style.display = "none";
    statusBox.textContent = "";
  }
}

function setBusy(isBusy, message = "") {
  const loginButton = document.getElementById("loginButton");

  if (loginButton) {
    loginButton.disabled = isBusy;
    loginButton.textContent = isBusy ? "ログイン処理中..." : "Googleでログイン";
  }

  if (isBusy) {
    showStatus(message || "処理中です。しばらくお待ちください。");
  } else {
    clearStatus();
  }
}

async function fetchJsonOrThrow(url, options) {
  const res = await fetch(url, options);

  let data = null;
  let text = "";

  try {
    data = await res.json();
  } catch (_) {
    try {
      text = await res.text();
    } catch (_) {
      text = "";
    }
  }

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message || data.error)) ||
      text ||
      `HTTP ${res.status} ${res.statusText}`;
    throw new Error(detail);
  }

  return data;
}

// ログインボタン押下
document.getElementById("loginButton").addEventListener("click", async (e) => {
  e.preventDefault();

  clearError();
  setBusy(true, "Googleログインを開始しています...");

  try {
    setBusy(true, "Googleアカウントで認証しています...");
    const result = await signInWithPopup(auth, provider);

    setBusy(true, "認証情報を取得しています...");
    const idToken = await result.user.getIdToken();

    setBusy(true, "セッションを開始しています...");
    await fetchJsonOrThrow(`${API_BASE_URL}/v1/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({})
    });

    setBusy(true, "ユーザー環境を初期化しています...");
    const initResult = await fetchJsonOrThrow(`${API_BASE_URL}/v1/user/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({})
    });

    if (initResult && initResult.ok === false) {
      throw new Error(initResult.detail || "ユーザー初期化に失敗しました。");
    }

    sessionStorage.setItem("idToken", idToken);

    setBusy(true, "メニューへ移動しています...");
    window.location.href = "./menu.html";

  } catch (err) {
    console.error(err);
    showError(err.message || String(err));
    setBusy(false);
  }
});
