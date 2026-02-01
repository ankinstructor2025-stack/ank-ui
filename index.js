// index.js
import { UI_FLAGS, UI_META } from "./lib/env.js";
import { watchAuth } from "./lib/ank_firebase.js";

const $ = (id) => document.getElementById(id);

function debug(...args) {
  if (UI_FLAGS?.DEBUG_LOG) console.log(...args);
}

function setStatus(msg) {
  $("status").textContent = msg || "";
}

function getCurrentPathWithQuery() {
  // 例: "/ank-ui/?a=1" のような形で返る（GitHub PagesでもOK）
  return location.pathname + location.search;
}

function toLogin(returnTo) {
  const url = new URL("./login.html", location.href);
  url.searchParams.set("return_to", returnTo);
  location.replace(url.toString());
}

function toAfterLogin() {
  // ここは後で「契約ありならQA、なければ契約」などに変える場所
  location.replace("./qa_generate.html");
}

setStatus("checking auth...");
$("who").textContent = UI_META?.APP_NAME || "ank-ui";
$("sub").textContent = "";

watchAuth((user) => {
  if (!user) {
    debug("[index] not logged in -> login");
    setStatus("not logged in");
    const rt = getCurrentPathWithQuery();
    toLogin(rt);
    return;
  }

  debug("[index] logged in:", user.email);
  setStatus("logged in");
  $("sub").textContent = user.email || "";
  toAfterLogin();
});
