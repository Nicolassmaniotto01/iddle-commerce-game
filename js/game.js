/* ===============================
   IDLE COMMERCE – FULL GAME (FINAL OTIMIZADO)
   Save + Start + Loja + Produtos
   Funcionários + Missões + Eventos visuais
   Prestígio + Info + Import/Export
================================ */

const SAVE_KEY = "idle-commerce-save";

/* -------- DOM -------- */
const startScreen      = document.getElementById("startScreen");
const gameWrapper      = document.getElementById("gameWrapper");

const storeNameEl      = document.getElementById("storeName");
const storeNameInput   = document.getElementById("storeNameInput");

const continueBtn      = document.getElementById("continueBtn");
const clickButton      = document.getElementById("clickButton");

const coinsEl          = document.getElementById("coins");
const cpcEl            = document.getElementById("cpc");
const cpsEl            = document.getElementById("cps");

const shopList         = document.getElementById("shopList");
const productList      = document.getElementById("productList");
const employeeList     = document.getElementById("employeeList");
const missionsList     = document.getElementById("missionsList");

const eventBox         = document.getElementById("eventBox");
const infoBox          = document.getElementById("infoBox");

const prestigeTree     = document.getElementById("prestigeTree");
const prestigePointsEl = document.getElementById("prestigePoints");

const importInput      = document.getElementById("importInput");

/* -------- Game State -------- */
let game = null;

/* -------- Constants / Data -------- */
const PRODUCTS = [
  { id:1, name:"Hambúrguer", buy:10, sell:18 },
  { id:2, name:"Pizza", buy:30, sell:55 },
  { id:3, name:"Celular", buy:300, sell:550 }
];

const EMPLOYEES = [
  { id:1, name:"Atendente", baseCost:100, productivity:1 },
  { id:2, name:"Vendedor", baseCost:350, productivity:2 },
  { id:3, name:"Gerente", baseCost:900, productivity:4 }
];

const SHOP_UPGRADES = [
  { id:1, name:"+1 CPC", baseCost:200, apply: g => g.cpc += 1 },
  { id:2, name:"+2 CPS", baseCost:500, apply: g => g.cps += 2 },
  { id:3, name:"Automação", baseCost:1200, apply: g => g.cps += 5 }
];

const PRESTIGE_UPGRADES = [
  { id:1, name:"+10% Lucro (permanente)", cost:1, apply: g => g.prestigeBonusProfit += 0.10 },
  { id:2, name:"+10% Prod. Funcionários", cost:2, apply: g => g.prestigeBonusEmployee += 0.10 },
  { id:3, name:"+1 CPC fixo", cost:3, apply: g => g.prestigeCpcFlat += 1 }
];

const MISSIONS_BASE = [
  { id:1, title:"Primeiras 10 vendas", check: g => g.sales >= 10, reward: g => { g.coins += 200 } },
  { id:2, title:"Equipe pequena", check: g => g.employees.length >= 2, reward: g => { g.cpc += 1 } },
  { id:3, title:"Acumulador", check: g => g.totalEarned >= 2000, reward: g => { g.coins += 500, g.cps += 1 } },
  { id:4, title:"Estoque saudável", check: g => Object.values(g.products).reduce((a,b)=>a+b,0) >= 20, reward: g => { g.coins += 400 } }
];

const EVENTS = [
  { id:'boom', text:'📈 Pico de demanda (x1.5 CPS por 12s)', start: g => g._eventCpsMul = (g._eventCpsMul||1) * 1.5, end: g => g._eventCpsMul = 1 },
  { id:'supply', text:'🚚 Fornecimento: +5 de cada produto', start: g => PRODUCTS.forEach(p => g.products[p.id] = (g.products[p.id]||0) + 5), end: g => {} },
  { id:'tax', text:'📉 Taxa: perde 8% do dinheiro', start: g => { const loss = Math.floor(g.coins * 0.08); g.coins = Math.max(0, g.coins - loss) }, end: g => {} }
];

/* -------- Helpers -------- */
function fmt(n){ return Math.floor(n); }
function saveGame(){ localStorage.setItem(SAVE_KEY, JSON.stringify(game)); }
function loadGame(){ const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function getScaledCost(base, timesPurchased){ return Math.ceil(base * Math.pow(1.25, timesPurchased)); }
function getBuyPrice(p){ return p.buy; }

/* -------- New / Continue / Start -------- */
function newGame(){
  const name = storeNameInput.value.trim();
  if(!name) return alert("Digite o nome da loja");

  game = {
    storeName: name,
    coins: 0,
    cpc: 1,
    cps: 0,
    sales: 0,
    totalEarned: 0,
    products: {},
    employees: [],
    shopUpgrades: [],
    prestigePoints: 0,
    prestigeUpgrades: [],
    missions: MISSIONS_BASE.map(m=>({ id:m.id, title:m.title, done:false })),
    _eventCpsMul: 1,
    prestigeBonusProfit: 0,
    prestigeBonusEmployee: 0,
    prestigeCpcFlat: 0
  };
  PRODUCTS.forEach(p => game.products[p.id] = 0);
  saveGame();
  startGame();
}

function continueGame(){
  const s = loadGame();
  if(!s || !s.storeName) return alert("Nenhum save válido encontrado.");
  game = s;
  if(!game.missions || !Array.isArray(game.missions)){
    game.missions = MISSIONS_BASE.map(m=>({ id:m.id, title:m.title, done:false }));
  }
  PRODUCTS.forEach(p => game.products[p.id] = game.products[p.id] || 0);
  startGame();
}

function startGame(){
  startScreen.classList.remove("active");
  gameWrapper.style.display = "block";
  storeNameEl.textContent = game.storeName;
  renderAllTabs();
  updateHUD();
  openTab("home", document.querySelector(".nav-btn"));
}

/* -------- HUD + UI -------- */
function updateHUD(){
  coinsEl.textContent = fmt(game.coins);
  cpcEl.textContent = (game.cpc + (game.prestigeCpcFlat || 0)).toFixed(2);
  const effectiveCps = (game.cps * (game._eventCpsMul||1)) * (1 + (game.prestigeBonusEmployee||0));
  cpsEl.textContent = effectiveCps.toFixed(2);
}

function updateUI(){
  updateHUD();
  renderShop();
  renderProducts();
  renderEmployees();
  renderMissions();
  renderPrestige();
  renderInfo();
  saveGame();
}

/* -------- Shop -------- */
function renderShop(){
  shopList.innerHTML = "";
  SHOP_UPGRADES.forEach(up => {
    const times = game.shopUpgrades.filter(x=>x===up.id).length;
    const cost = getScaledCost(up.baseCost, times);
    const bought = game.shopUpgrades.includes(up.id);
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<strong>${up.name}</strong><div class="meta">${bought ? "Adquirido" : "💰 " + cost}</div>`;
    const btn = document.createElement("button");
    btn.textContent = bought ? "Comprado" : "Comprar";
    btn.disabled = (game.coins < cost) || bought;
    btn.onclick = ()=>{
      if(game.coins < cost) return;
      game.coins -= cost;
      up.apply(game);
      game.shopUpgrades.push(up.id);
      updateUI();
    };
    card.appendChild(btn);
    shopList.appendChild(card);
  });
}

/* -------- Products -------- */
function renderProducts(){
  productList.innerHTML = "";
  PRODUCTS.forEach(p=>{
    const stock = game.products[p.id] || 0;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<strong>${p.name}</strong>
      <div class="meta">Estoque: ${stock}</div>
      <div class="meta">Compra: ${p.buy} | Venda: ${p.sell}</div>`;
    const buyBtn = document.createElement("button");
    buyBtn.textContent = `Comprar (${p.buy})`;
    buyBtn.onclick = ()=>{
      if(game.coins < getBuyPrice(p)) return;
      game.coins -= getBuyPrice(p);
      game.products[p.id] = (game.products[p.id]||0)+1;
      updateUI();
    };
    const sellBtn = document.createElement("button");
    sellBtn.style.marginTop="8px";
    sellBtn.textContent = `Vender 1 (+${Math.round(p.sell*(1+(game.prestigeBonusProfit||0)))})`;
    sellBtn.onclick = ()=>{
      if((game.products[p.id]||0)<=0) return;
      game.products[p.id]--;
      const gain = p.sell * (1 + (game.prestigeBonusProfit||0));
      game.coins += gain;
      game.sales++;
      game.totalEarned += gain;
      updateMissions();
      updateUI();
    };
    card.appendChild(buyBtn);
    card.appendChild(sellBtn);
    productList.appendChild(card);
  });
}

/* -------- Employees -------- */
function renderEmployees(){
  employeeList.innerHTML = "";
  EMPLOYEES.forEach(e=>{
    const level = game.employees.filter(x=>x.id===e.id).length;
    const cost = getScaledCost(e.baseCost, level);
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<strong>${e.name}</strong>
      <div class="meta">Nível(s): ${level}</div>
      <div class="meta">Prod: ${e.productivity}/s por contratação</div>`;
    const btn = document.createElement("button");
    btn.textContent = `Contratar ($${cost})`;
    btn.onclick = ()=>{
      if(game.coins < cost) return;
      game.coins -= cost;
      game.employees.push({ id:e.id, hiredAt:Date.now() });
      game.cps += e.productivity;
      updateUI();
    };
    card.appendChild(btn);
    employeeList.appendChild(card);
  });
}

/* Auto-sell de funcionários */
function employeesAutoSellTick(){
  if(!game || game.employees.length===0) return;
  const available = PRODUCTS.map(p=>({ ...p, stock: game.products[p.id]||0 })).filter(p=>p.stock>0).sort((a,b)=>(b.sell-b.buy)-(a.sell-a.buy));
  if(available.length===0) return;
  const profitMul = 1 + (game.prestigeBonusProfit||0);
  const empProdBonus = 1 + (game.prestigeBonusEmployee||0);
  game.employees.forEach(emp=>{
    const def = EMPLOYEES.find(e=>e.id===emp.id);
    if(!def) return;
    let sells = Math.floor(def.productivity * empProdBonus);
    while(sells-->0){
      const p = available[0];
      if(!p || game.products[p.id]<=0) break;
      game.products[p.id]--;
      game.coins += p.sell * profitMul;
      game.sales++;
      game.totalEarned += p.sell * profitMul;
    }
  });
}

/* -------- Missions -------- */
function renderMissions(){
  missionsList.innerHTML = "";
  MISSIONS_BASE.forEach(base=>{
    const saved = game.missions.find(m=>m.title===base.title);
    const done = saved ? saved.done : false;
    const card = document.createElement("div");
    card.className="card";
    card.innerHTML=`<strong>${base.title}</strong><div class="meta">${done?"✅ Concluída":"Em progresso"}</div>`;
    if(!done && base.check(game)){
      const btn = document.createElement("button");
      btn.textContent="Reivindicar";
      btn.onclick=()=>{
        base.reward(game);
        const idx = game.missions.findIndex(m=>m.title===base.title);
        if(idx>=0) game.missions[idx].done=true;
        else game.missions.push({ title:base.title, done:true });
        updateUI();
      };
      card.appendChild(btn);
    }
    missionsList.appendChild(card);
  });
}

function updateMissions(){ renderMissions(); }

/* -------- Prestige -------- */
function renderPrestige(){
  prestigeTree.innerHTML="";
  prestigePointsEl.textContent=game.prestigePoints||0;
  PRESTIGE_UPGRADES.forEach(p=>{
    const bought=(game.prestigeUpgrades||[]).includes(p.id);
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`<strong>${p.name}</strong><div class="meta">${bought?"Comprado":p.cost+" PP"}</div>`;
    if(!bought && (game.prestigePoints||0)>=p.cost){
      const btn=document.createElement("button");
      btn.textContent="Comprar";
      btn.onclick=()=>{
        game.prestigePoints-=p.cost;
        game.prestigeUpgrades=game.prestigeUpgrades||[];
        game.prestigeUpgrades.push(p.id);
        p.apply(game);
        updateUI();
      };
      card.appendChild(btn);
    }
    prestigeTree.appendChild(card);
  });
}

function doPrestige(){
  const gain=Math.floor((game.totalEarned||0)/10000);
  if(gain<=0) return alert("Você precisa ter ganho mais para obter pontos de prestígio.");
  if(!confirm(`Girar Prestígio: ganhar ${gain} ponto(s)?`)) return;
  const keepPrestige=game.prestigeUpgrades||[];
  game.prestigePoints=(game.prestigePoints||0)+gain;
  game={
    storeName:game.storeName, coins:0, cpc:1, cps:0, sales:0, totalEarned:0,
    products:{}, employees:[], shopUpgrades:[], prestigePoints:game.prestigePoints,
    prestigeUpgrades:keepPrestige, missions:MISSIONS_BASE.map(m=>({title:m.title, done:false})),
    _eventCpsMul:1, prestigeBonusProfit:0, prestigeBonusEmployee:0, prestigeCpcFlat:0
  };
  keepPrestige.forEach(pid=>{
    const perk=PRESTIGE_UPGRADES.find(p=>p.id===pid);
    if(perk) perk.apply(game);
  });
  PRODUCTS.forEach(p=>game.products[p.id]=0);
  saveGame();
  updateUI();
}

/* -------- Info -------- */
function renderInfo(){
  const totalStock=Object.values(game.products||{}).reduce((a,b)=>a+(b||0),0);
  infoBox.innerHTML=`
    <div class="card"><strong>🏪 Loja:</strong> ${game.storeName}</div>
    <div class="card"><strong>💰 Dinheiro:</strong> ${fmt(game.coins)}</div>
    <div class="card"><strong>📈 Vendas totais:</strong> ${game.sales}</div>
    <div class="card"><strong>💎 Total ganho:</strong> ${fmt(game.totalEarned)}</div>
    <div class="card"><strong>👨‍💼 Funcionários:</strong> ${game.employees.length}</div>
    <div class="card"><strong>📦 Estoque total:</strong> ${totalStock}</div>
    <div class="card"><strong>🔥 Pontos de Prestígio:</strong> ${game.prestigePoints||0}</div>
  `;
}

/* -------- Export / Import -------- */
function exportSave(){
  if(!game) return alert("Nenhum jogo em andamento.");
  const safeName=(game.storeName||"idle-commerce").toLowerCase().replace(/[^a-z0-9]/g,"_");
  const blob=new Blob([JSON.stringify(game,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`idle-commerce-${safeName}.json`;
  a.click();
}

function importSave(){
  importInput.click();
  importInput.onchange=e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const obj=JSON.parse(reader.result);
        game=obj;
        PRODUCTS.forEach(p=>game.products[p.id]=game.products[p.id]||0);
        saveGame();
        startGame();
      }catch(err){ alert("Arquivo inválido."); }
    };
    reader.readAsText(file);
  };
}

/* -------- Reset -------- */
function resetGame(){
  if(!confirm("Resetar jogo (limpar save local)?")) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

/* -------- Tabs -------- */
function openTab(tabId, btn){
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  const target=document.getElementById(tabId);
  if(target) target.classList.add("active");
  if(btn) btn.classList.add("active");
  if(tabId==="shop") renderShop();
  if(tabId==="products") renderProducts();
  if(tabId==="employees") renderEmployees();
  if(tabId==="missions") renderMissions();
  if(tabId==="prestige") renderPrestige();
  if(tabId==="info") renderInfo();
}

/* -------- Manual Click -------- */
function registrarVendaManual(){
  let produto=null, melhorMargem=-Infinity;
  PRODUCTS.forEach(p=>{
    const stock=game.products[p.id]||0;
    if(stock>0){
      const margem=p.sell-p.buy;
      if(margem>melhorMargem){ melhorMargem=margem; produto=p; }
    }
  });

  if(!produto){
    const ganho=game.cpc + (game.prestigeCpcFlat||0);
    game.coins+=ganho;
    game.totalEarned+=ganho;
    game.sales++;
  }else{
    game.products[produto.id]--;
    const ganho=produto.sell*(1+(game.prestigeBonusProfit||0));
    game.coins+=ganho;
    game.totalEarned+=ganho;
    game.sales++;
  }
  updateMissions();
  updateUI();
}

clickButton.onclick=registrarVendaManual;

/* -------- Events (visual + histórico) -------- */
const EVENT_HISTORY = []; // últimos 5 eventos

function showEvent(e){
  if(!e || !game) return;

  const box = eventBox;
  box.style.transition = "opacity 0.5s";

  let bg="#222";
  if(e.id==='boom') bg="#4caf50";
  if(e.id==='supply') bg="#2196f3";
  if(e.id==='tax') bg="#f44336";

  box.style.backgroundColor = bg;
  box.style.opacity=1;
  box.textContent=e.text;

  EVENT_HISTORY.unshift(e.text);
  if(EVENT_HISTORY.length>5) EVENT_HISTORY.pop();

  e.start?.(game);
  updateHUD();

  let duration=5000;
  if(e.id==='boom') duration=12000;

  setTimeout(()=>{
    e.end?.(game);
    box.style.opacity=0.8;
    box.style.backgroundColor="#222";
    box.textContent="Nenhum evento ativo.";
    updateHUD();
  },duration);
}

function triggerRandomEvent(){
  if(!game) return;
  if(Math.random()>=0.02) return; // 2% chance
  const e = EVENTS[Math.floor(Math.random()*EVENTS.length)];
  showEvent(e);
}

setInterval(()=>{
  triggerRandomEvent();
  employeesAutoSellTick();
  updateHUD();
},1000);

/* -------- Init -------- */
window.onload=()=>{
  const s=loadGame();
  if(s) continueBtn.style.display="block";
};

/* -------- Sound toggle -------- */
let soundOn = true; // estado do som

const soundBtn = document.getElementById("soundBtn");
if(soundBtn){
  soundBtn.addEventListener("click", ()=>{
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "🔊" : "🔇";
  });
}

// Exemplo de uso do som: tocar efeito quando venda manual
function playClickSound(){
  if(!soundOn) return;
  const audio = new Audio("sounds/Blip20.wav"); // coloque um arquivo click.mp3 na pasta sounds
  audio.play();
}

// Atualize a função de venda manual para tocar som
function registrarVendaManual(){
  let produto = null;
  let melhorMargem = -Infinity;

  PRODUCTS.forEach(p=>{
    const stock = game.products[p.id] || 0;
    if(stock > 0){
      const margem = p.sell - p.buy;
      if(margem > melhorMargem){
        melhorMargem = margem;
        produto = p;
      }
    }
  });

  if(!produto){
    const ganho = game.cpc + (game.prestigeCpcFlat || 0);
    game.coins += ganho;
    game.sales++;
    game.totalEarned += ganho;
    updateMissions();
    updateUI();
    playClickSound(); // <--- toca som
    return;
  }

  game.products[produto.id]--;
  const lucro = produto.sell * (1 + (game.prestigeBonusProfit || 0));
  game.coins += lucro;
  game.sales++;
  game.totalEarned += lucro;

  updateMissions();
  updateUI();
  playClickSound(); // <--- toca som
}

