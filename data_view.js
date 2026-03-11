console.log("data_view.js loaded");

(function () {

const API_BASE = window.API_BASE || "";
const SOURCE_MASTER_PATH = "./source_master.json";
const NEXT_KNOWLEDGE_PAGE = "./knowledge_build.html";

let sourceList = [];
let sourceMap = {};

const state = {
  sourceKey: "",
  parentRows: [],
  childRows: [],
  selectedParentKey: null,
  selectedChildKey: null,
  checkedParents: new Set()
};

const el = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {

  bindElements();
  bindEvents();

  renderInitialParentPlaceholder();
  clearChildArea();
  renderDetailText("データ種別を選択してください。");

  updateSummaries();
  updateKnowledgeButton();

  await loadSourceMaster();
}

function bindElements(){

  el.sourceSelect = document.getElementById("sourceSelect");
  el.sourceName = document.getElementById("sourceName");

  el.btnReload = document.getElementById("btnReload");
  el.btnKnowledge = document.getElementById("btnKnowledge");
  el.btnBack = document.getElementById("btnBack");
  el.btnLogout = document.getElementById("btnLogout");

  el.summaryText = document.getElementById("summaryText");
  el.selectionSummary = document.getElementById("selectionSummary");
  el.contextSummary = document.getElementById("contextSummary");

  el.parentTableHead = document.getElementById("parentTableHead");
  el.parentTableBody = document.getElementById("parentTableBody");

  el.childTableHead = document.getElementById("childTableHead");
  el.childTableBody = document.getElementById("childTableBody");

  el.detailPre = document.getElementById("detailPre");
}

function bindEvents(){

  el.sourceSelect.addEventListener("change", async () => {

    state.sourceKey = el.sourceSelect.value;

    state.parentRows = [];
    state.childRows = [];
    state.selectedParentKey = null;
    state.selectedChildKey = null;
    state.checkedParents = new Set();

    updateSourceName();

    if(!state.sourceKey){

      renderInitialParentPlaceholder();
      clearChildArea();
      renderDetailText("データ種別を選択してください。");

      updateSummaries();
      updateKnowledgeButton();

      return;
    }

    await refreshParentList();

  });

  el.btnReload.addEventListener("click", async () => {

    if(!state.sourceKey){
      renderInitialParentPlaceholder();
      clearChildArea();
      renderDetailText("データ種別を選択してください。");
      return;
    }

    await refreshParentList();
  });

  el.btnKnowledge.addEventListener("click", handleKnowledge);

  el.btnBack.addEventListener("click", () => {
    location.href = "./menu.html";
  });

  el.btnLogout.addEventListener("click", async () => {

    try{
      if(window.firebaseAuth && typeof window.firebaseAuth.signOut === "function"){
        await window.firebaseAuth.signOut();
      }
    }catch(_){}

    try{
      sessionStorage.removeItem("idToken");
    }catch(_){}

    location.href="./index.html";
  });

}

async function loadSourceMaster(){

  try{

    const res = await fetch(SOURCE_MASTER_PATH,{cache:"no-store"});

    if(!res.ok){
      throw new Error(`source_master.json 読込失敗 (HTTP ${res.status})`);
    }

    const all = await res.json();

    sourceList = normalizeSourceMaster(all);
    sourceMap = Object.fromEntries(sourceList.map(item=>[item.key,item]));

    renderSourceOptions(sourceList);

    updateSourceName();

  }catch(e){

    console.error(e);

    el.sourceSelect.innerHTML=`<option value="">データ種別読込失敗</option>`;
    el.sourceName.textContent="データ種別読込失敗";

    renderDetailText(`データ種別読込失敗: ${e.message}`);
  }
}

function normalizeSourceMaster(all){

  if(!Array.isArray(all)) return [];

  const targetKeys=[
    "api_kokkai",
    "api_datago",
    "url_egov",
    "file_upload"
  ];

  return all
  .filter(item=>targetKeys.includes(item.key))
  .map(item=>({

    key:item.key,
    label:item.label || item.name || item.key,

    group:item.group || inferGroup(item.key,item.type),

    type:item.type || "",

    sourceType:mapKeyToSourceType(item.key,item.type)

  }));
}

function inferGroup(key,type){

  if(key==="api_kokkai"||key==="api_datago") return "公開API";

  if(type==="public_url"||key.startsWith("url_")) return "公開URL";

  return "その他";
}

function mapKeyToSourceType(key,type){

  if(key==="api_kokkai") return "kokkai";
  if(key==="api_datago") return "opendata";

  if(type==="public_url"||key.startsWith("url_")) return "public_url";

  if(key==="file_upload") return "upload";

  return "";
}






/* ★ここが修正箇所（data_source.js と同じ方式） */

function renderSourceOptions(list){

  const groups={};

  list.forEach(item=>{

    const groupName=item.group || "その他";

    if(!groups[groupName]){
      groups[groupName]=[];
    }

    groups[groupName].push(item);

  });

  const html=[`<option value="" selected disabled>選択してください</option>`];

  Object.keys(groups).forEach(groupName=>{

    html.push(`<optgroup label="${escapeHtml(groupName)}">`);

    groups[groupName].forEach(item=>{

      html.push(
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`
      );

    });

    html.push(`</optgroup>`);

  });

  el.sourceSelect.innerHTML=html.join("");

}

/* ★ここまで修正 */







function updateSourceName(){

  const item = sourceMap[state.sourceKey];

  el.sourceName.textContent=item?item.label:"";
}



async function requireIdToken(){

  const sessionToken=sessionStorage.getItem("idToken");

  if(sessionToken) return sessionToken;

  if(window.firebaseAuth && window.firebaseAuth.currentUser){

    return await window.firebaseAuth.currentUser.getIdToken(true);

  }

  throw new Error("ログイン情報が見つかりません");
}



async function apiGet(path,query={}){

  const idToken=await requireIdToken();

  const url=new URL(`${API_BASE}${path}`);

  Object.entries(query).forEach(([k,v])=>{

    if(v!==undefined && v!==null && v!==""){
      url.searchParams.set(k,String(v));
    }

  });

  const res=await fetch(url.toString(),{

    method:"GET",

    headers:{
      Authorization:`Bearer ${idToken}`
    }

  });

  if(!res.ok){

    let detail=`APIエラー (HTTP ${res.status})`;

    try{

      const data=await res.json();

      if(data && data.detail){
        detail=data.detail;
      }

    }catch(_){}

    throw new Error(detail);
  }

  return await res.json();
}







/* 以下は元の処理そのまま */

async function refreshParentList(){

  try{

    clearChildArea();

    renderDetailText("親一覧を読み込み中です...");

    const rows=await fetchParentRows(state.sourceKey);

    state.parentRows=rows;

    state.childRows=[];

    state.selectedParentKey=null;
    state.selectedChildKey=null;

    state.checkedParents=new Set();

    renderParentTable();

    renderChildTable();

    renderDetailText("親一覧から1件選択すると、子一覧と詳細が表示されます。");

    updateSummaries();
    updateKnowledgeButton();

  }catch(e){

    console.error(e);

    state.parentRows=[];
    state.childRows=[];

    renderParentError(e.message);

    renderChildTable();

    renderDetailText(e.message);

    updateSummaries();
    updateKnowledgeButton();
  }

}



function renderInitialParentPlaceholder(){

  el.parentTableHead.innerHTML="";

  el.parentTableBody.innerHTML=`
  <tr class="placeholder-row">
  <td>データ種別を選択してください。</td>
  </tr>
  `;
}



function clearChildArea(){

  el.childTableHead.innerHTML="";

  el.childTableBody.innerHTML=`
  <tr class="placeholder-row">
  <td>親一覧から1件選択してください。</td>
  </tr>
  `;
}



function renderDetailText(text){

  el.detailPre.textContent=text || "";

}



function updateSummaries(){

  el.summaryText.textContent=`${state.parentRows.length} 件`;

  el.selectionSummary.textContent=`選択 ${state.checkedParents.size} 件`;

}



function updateKnowledgeButton(){

  el.btnKnowledge.disabled=state.checkedParents.size===0;

}



function handleKnowledge(){

  const item=sourceMap[state.sourceKey];

  if(!item){
    alert("データ種別を選択してください。");
    return;
  }

  const selected=state.parentRows.filter(row=>{

    const key=getParentRowKey(state.sourceKey,row);

    return state.checkedParents.has(key);

  });

  if(!selected.length){
    alert("親一覧から対象を選択してください。");
    return;
  }

  const payload={

    source_key:item.key,
    source_type:item.sourceType,
    source_info:item,
    selected_parents:selected,
    created_at:new Date().toISOString()

  };

  sessionStorage.setItem("knowledge_targets",JSON.stringify(payload));

  alert("選択対象を保存しました。");

  location.href=NEXT_KNOWLEDGE_PAGE;
}



function getParentRowKey(sourceKey,row){

  const item=sourceMap[sourceKey];

  if(item && item.key==="api_kokkai"){
    return `${row.name_of_house}__${row.name_of_meeting}`;
  }

  if(item && item.key==="api_datago"){
    return String(row.source_id);
  }

  if(item && item.sourceType==="public_url"){
    return String(row.root_id);
  }

  return String(row.file_id);

}



function escapeHtml(str){

  return String(str ?? "")
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#39;");
}

})();
