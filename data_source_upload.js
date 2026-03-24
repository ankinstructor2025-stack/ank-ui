console.log("data_source_upload.js loaded");

(function () {
  async function readErrorText(res) {
    try {
      const text = await res.text();
      return text || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  function getSelectedFile() {
    const input = document.getElementById("uploadFileInput");
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
    if (data.logical_name) writeLog(`logical_name=${data.logical_name}`);
    if (data.original_filename) writeLog(`original_filename=${data.original_filename}`);
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

  window.DataSourceUpload = {
    run
  };
})();
