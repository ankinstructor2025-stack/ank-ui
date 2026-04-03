const API_BASE_URL = "https://ank-api-986862757498.asia-northeast1.run.app";

const statusBox = document.getElementById("statusBox");
const errorBox = document.getElementById("errorBox");
const userTableBody = document.getElementById("userTableBody");
const btnReload = document.getElementById("btnReload");
const btnLogout = document.getElementById("btnLogout");

function getIdToken() {
  return sessionStorage.getItem("idToken") || localStorage.getItem("idToken") || "";
}

function showStatus(message) {
  statusBox.textContent = message;
}

function showError(message) {
  errorBox.style.display = "block";
  errorBox.textContent = message;
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
}

async function fetchJsonOrThrow(url, options = {}) {
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

function renderUsers(users) {
  if (!users || users.length === 0) {
    userTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">ユーザーがありません。</td>
      </tr>
    `;
    return;
  }

  userTableBody.innerHTML = users.map(user => `
    <tr>
      <td class="uid-cell">${escapeHtml(user.uid)}</td>
      <td>${escapeHtml(user.prefix)}</td>
      <td>${user.file_count ?? 0}</td>
      <td>
        <button class="btn-danger btn-delete-user" data-uid="${escapeHtmlAttr(user.uid)}" type="button">
          削除
        </button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".btn-delete-user").forEach(btn => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.uid;
      deleteUser(uid, btn);
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value);
}

async function loadUsers() {
  clearError();
  showStatus("ユーザー一覧を読み込み中...");

  const idToken = getIdToken();
  if (!idToken) {
    showError("idToken がありません。ログインし直してください。");
    return;
  }

  try {
    const data = await fetchJsonOrThrow(`${API_BASE_URL}/v1/admin/users`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`
      }
    });

    renderUsers(data.users || []);
    showStatus(`ユーザー数: ${(data.users || []).length}`);
  } catch (err) {
    console.error(err);
    showError(err.message || String(err));
    userTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">読み込みに失敗しました。</td>
      </tr>
    `;
    showStatus("読み込み失敗");
  }
}

async function deleteUser(uid, button) {
  const ok = confirm(`ユーザー ${uid} を削除します。よろしいですか？`);
  if (!ok) return;

  clearError();
  button.disabled = true;
  showStatus(`ユーザー ${uid} を削除中...`);

  const idToken = getIdToken();
  if (!idToken) {
    showError("idToken がありません。ログインし直してください。");
    button.disabled = false;
    return;
  }

  try {
    const data = await fetchJsonOrThrow(`${API_BASE_URL}/v1/admin/users/${encodeURIComponent(uid)}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${idToken}`
      }
    });

    if (!data.ok && data.errors && data.errors.length > 0) {
      showError(data.errors.join("\n"));
    }

    showStatus(`削除完了: ${uid}`);
    await loadUsers();
  } catch (err) {
    console.error(err);
    showError(err.message || String(err));
    showStatus(`削除失敗: ${uid}`);
    button.disabled = false;
  }
}

btnLogout.addEventListener("click", () => {
  // トークン削除
  sessionStorage.removeItem("idToken");
  localStorage.removeItem("idToken");

  // ログイン画面へ
  window.location.href = "index.html";
});

loadUsers();
