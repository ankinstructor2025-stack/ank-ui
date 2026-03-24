console.log("data_source_upload.js loaded");

(function () {
  function getFileInput() {
    return document.getElementById("uploadFileInput");
  }

  function getFileNameView() {
    return document.getElementById("uploadFileName");
  }

  function syncSelectedFileName() {
    const input = getFileInput();
    const view = getFileNameView();
    if (!input || !view) return;

    if (input.files && input.files.length > 0) {
      view.textContent = input.files[0].name;
      view.classList.remove("is-empty");
    } else {
      view.textContent = "ファイルが選択されていません";
      view.classList.add("is-empty");
    }
  }

  function bindFileInputUi() {
    const input = getFileInput();
    if (!input) return;

    input.addEventListener("change", syncSelectedFileName);
    syncSelectedFileName();
  }

  async function readErrorText(res) {
    try {
      const text = await res.text();
      return text || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  function getSelectedFile() {
    const input = getFileInput();
    if (!input || !input.files || input.files.length === 0) {
      return null;
    }
    return input.files[0];
  }

  async function uploadFile({ apiBase, idToken, file, writeLog }) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${apiBase}/upload/upload_and_register`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`
      },
      body: formData
    });

    if (res.status === 409) {
      throw new Error("同名ファイルはアップロードできません");
    }

    if (res.status === 401) {
      const text = await readErrorText(res);
      throw new Error(`認証エラー(401): ${text}`);
    }

    if (res.status === 403) {
      const text = await readErrorText(res);
      throw new Error(`権限エラー(403): ${text}`);
    }

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`アップロード失敗: ${text}`);
    }

    const data = await res.json();

    writeLog("アップロード成功");
    if (data.file_id) writeLog(`file_id=${data.file_id}`);
    if (data.file_name) writeLog(`file_name=${data.file_name}`);
    if (data.ext) writeLog(`ext=${data.ext}`);
    if (data.created_at) writeLog(`created_at=${data.created_at}`);
    if (data.gcs_path) writeLog(`gcs_path=${data.gcs_path}`);

    return data;
  }

  async function run({ apiBase, idToken, writeLog }) {
    const file = getSelectedFile();

    if (!file) {
      writeLog("アップロードするファイルを選択してください");
      return;
    }

    writeLog(`アップロード開始: ${file.name}`);

    const uploaded = await uploadFile({
      apiBase,
      idToken,
      file,
      writeLog
    });

    if (!uploaded.file_id) {
      throw new Error("file_id を取得できませんでした");
    }

    writeLog("登録完了");
  }

  document.addEventListener("DOMContentLoaded", bindFileInputUi);

  window.DataSourceUpload = {
    run,
    syncSelectedFileName
  };
})();
