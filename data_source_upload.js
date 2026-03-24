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

    return data;
  }

  async function ingestFile({ apiBase, idToken, fileId, writeLog }) {
    const res = await fetch(`${apiBase}/ingest_uploaded_file/${encodeURIComponent(fileId)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });

    if (res.status === 409) {
      const text = await readErrorText(res);
      throw new Error(`取り込みスキップ(409): ${text}`);
    }

    if (res.status === 401) {
      const text = await readErrorText(res);
      throw new Error(`認証エラー(401): ${text}`);
    }

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`取り込み失敗: ${text}`);
    }

    const data = await res.json();

    writeLog("row_data 取り込み成功");
    if (typeof data.row_count === "number") {
      writeLog(`row_count=${data.row_count}`);
    }
    if (data.file_id) {
      writeLog(`file_id=${data.file_id}`);
    }

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

    writeLog("row_data 取り込み開始");

    await ingestFile({
      apiBase,
      idToken,
      fileId: uploaded.file_id,
      writeLog
    });

    writeLog("完了");
  }

  window.DataSourceUpload = {
    run
  };
})();
