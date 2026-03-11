console.log("data_view.js loaded");

const sourceSelect = document.getElementById("sourceSelect");
const sourceName = document.getElementById("sourceName");

const btnReload = document.getElementById("btnReload");
const btnKnowledge = document.getElementById("btnKnowledge");
const btnMenu = document.getElementById("btnMenu");
const btnBack = document.getElementById("btnBack");
const btnLogout = document.getElementById("btnLogout");

const summaryText = document.getElementById("summaryText");
const selectionSummary = document.getElementById("selectionSummary");
const contextSummary = document.getElementById("contextSummary");

const parentTableHead = document.getElementById("parentTableHead");
const parentTableBody = document.getElementById("parentTableBody");
const childTableHead = document.getElementById("childTableHead");
const childTableBody = document.getElementById("childTableBody");

const detailPre = document.getElementById("detailPre");

let sourceList = [];
let sourceMap = {};
let currentSourceKey = "";


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}


function renderInitialScreen(){

  parentTableHead.innerHTML = "";
  parentTableBody.innerHTML = `
    <tr><td>データ種別を選択してください。</td></tr>
  `;

  childTableHead.innerHTML = "";
  childTableBody.innerHTML = `
    <tr><td>親一覧から1件選択してください。</td></tr>
  `;

  detailPre.textContent = "データ種別を選択してください。";

  if(summaryText) summaryText.textContent="0 件";
  if(selectionSummary) selectionSummary.textContent="選択 0 件";
  if(contextSummary) contextSummary.textContent="親一覧";

  if(btnKnowledge) btnKnowledge.disabled=true;
}



function renderSourceOptions(list){

  const groups={};

  list.forEach(item=>{
    const g=item.group||"その他";

    if(!groups[g]) groups[g]=[];

    groups[g].push(item);
  });

  const html=[`<option value="" selected disabled>選択してください</option>`];

  Object.keys(groups).forEach(g=>{

    html.push(`<optgroup label="${escapeHtml(g)}">`);

    groups[g].forEach(item=>{
      html.push(
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`
      );
    });

    html.push(`</optgroup>`);
  });

  sourceSelect.innerHTML=html.join("");
}



function mapKeyToSourceType(key,type){

  if(key==="api_kokkai") return "kokkai";

  if(key==="api_datago") return "opendata";

  if(type==="public_url"||key.startsWith("url_")) return "public_url";

  if(key==="file_upload") return "upload";

  return "";
}



function normalizeSourceMaster(list){

  if(!Array.isArray(list)) return [];

  return list.map(item=>({

    key:item.key,

    label:item.label||item.key,

    group:item.group||"その他",

    type:item.type||"",

    sourceType:mapKeyToSourceType(item.key,item.type)

  }));
}



function updateSourceName(){

  const item=sourceMap[currentSourceKey];

  const text=item?item.label:"";

  if(!sourceName) return;

  if("value" in sourceName){

    sourceName.value=text;

  }else{

    sourceName.textContent=text;

  }

}



function handleSourceChange(){

  currentSourceKey=sourceSelect.value;

  updateSourceName();

  if(detailPre){

    detailPre.textContent=`選択中: ${sourceMap[currentSourceKey]?.label||""}`;

  }

  if(contextSummary){

    contextSummary.textContent=`親一覧: ${sourceMap[currentSourceKey]?.label||""}`;

  }

}



async function loadSourceMaster(){

  try{

    const res=await fetch("./source_master.json",{cache:"no-store"});

    if(!res.ok) throw new Error(`HTTP ${res.status}`);

    const json=await res.json();

    sourceList=normalizeSourceMaster(json);

    sourceMap={};

    sourceList.forEach(x=>{

      sourceMap[x.key]=x;

    });

    renderSourceOptions(sourceList);

  }catch(e){

    console.error(e);

    sourceSelect.innerHTML=`<option>データ種別読込失敗</option>`;

  }

}



function bindEvents(){

  if(sourceSelect){

    sourceSelect.addEventListener("change",handleSourceChange);

  }

  if(btnReload){

    btnReload.addEventListener("click",async()=>{

      renderInitialScreen();

      await loadSourceMaster();

    });

  }

  if(btnMenu){

    btnMenu.addEventListener("click",()=>{

      location.href="menu.html";

    });

  }

  if(btnBack){

    btnBack.addEventListener("click",()=>{

      location.href="menu.html";

    });

  }

  if(btnLogout){

    btnLogout.addEventListener("click",()=>{

      sessionStorage.removeItem("idToken");

      location.href="index.html";

    });

  }

  if(btnKnowledge){

    btnKnowledge.addEventListener("click",()=>{

      alert("プルダウン確認用");

    });

  }

}



document.addEventListener("DOMContentLoaded",async()=>{

  renderInitialScreen();

  bindEvents();

  await loadSourceMaster();

});
