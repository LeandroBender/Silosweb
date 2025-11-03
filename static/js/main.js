// main.js - frontend logic consolidated and cleaned
const lastUpdated = document.getElementById('last-updated');
const grid = document.getElementById('grid');
const viewContainer = document.getElementById('view-container');
const historySelect = document.getElementById('history-silo-select');
let historyChart = null;

// helper selectors
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// NAV bindings
$$('.sidebar .nav-link').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    $$('.sidebar .nav-link').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    const view = a.dataset.view;
    showView(view);
  });
});

function showView(view){
  ['dashboard','silos','alerts','history'].forEach(v=>{
    const el = document.getElementById('view-'+v);
    if(el) el.style.display = v===view? 'block':'none';
  });
  const titleEl = document.getElementById('page-title');
  if(titleEl) titleEl.textContent = view.charAt(0).toUpperCase() + view.slice(1);
  if(view==='dashboard') fetchAndRender();
  if(view==='silos') { fetchAndRenderSilosList(); bindAddSiloForm(); }
  if(view==='alerts') fetchAndRenderAlerts();
  if(view==='history') loadHistoryList();
}

// status helpers
function statusColor(silo){
  if(silo.state==='Inactivo') return {color:getComputedStyle(document.documentElement).getPropertyValue('--red').trim(), label:'Inactivo'};
  if(silo.state==='Mantenimiento') return {color:getComputedStyle(document.documentElement).getPropertyValue('--yellow').trim(), label:'Mantenimiento'};
  if(silo.requires_drying) return {color:getComputedStyle(document.documentElement).getPropertyValue('--yellow').trim(), label:'Secado requerido'};
  return {color:getComputedStyle(document.documentElement).getPropertyValue('--green').trim(), label:'Operativo'};
}

function dryingIcon(show){
  if(!show) return '';
  return '<svg class="drying-icon spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 2v4" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M12 22v-4" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M4.93 4.93l2.83 2.83" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M16.24 16.24l2.83 2.83" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M2 12h4" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M18 12h4" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M4.93 19.07l2.83-2.83" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M16.24 7.76l2.83-2.83" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';
}

// render dashboard cards
function renderSilos(silos){
  if(!grid) return;
  grid.innerHTML = '';
  silos.forEach(silo=>{
    const sc = statusColor(silo);
    const col = document.createElement('div');
    col.className = 'col col-silo';
    const html =
      '<div class="card-silo">' +
        '<div class="d-flex justify-content-between align-items-start">' +
          '<div>' +
            '<div class="silo-name">' + silo.name + '</div>' +
            '<div class="silo-meta">' + (silo.last_update? new Date(silo.last_update).toLocaleString() : '') + '</div>' +
          '</div>' +
          '<div class="text-end">' +
            '<div><span class="status-dot" style="background:' + sc.color + '"></span></div>' +
            '<div class="silo-meta">' + sc.label + '</div>' +
          '</div>' +
        '</div>' +
        '<hr/>' +
        '<div class="d-flex justify-content-between align-items-center">' +
          '<div>' +
            '<div class="silo-value">' + silo.humidity + '%</div>' +
            '<div class="silo-meta">Humedad</div>' +
          '</div>' +
          '<div>' +
            '<div class="silo-value">' + silo.temperature + '°C</div>' +
            '<div class="silo-meta">Temperatura</div>' +
          '</div>' +
          '<div>' +
            '<div class="silo-value">' + silo.level + '%</div>' +
            '<div class="silo-meta">Nivel</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-footer">' +
          '<div class="d-flex align-items-center">' + dryingIcon(silo.requires_drying) + '<div class="ms-2 silo-meta">' + (silo.requires_drying? 'Secando' : 'OK') + '</div></div>' +
          '<div style="width:120px">' +
            '<div class="level-bar">' +
              '<div class="level-fill" style="width:' + silo.level + '%"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    col.innerHTML = html;
    grid.appendChild(col);
  });
}

// fetch dashboard
async function fetchAndRender(){
  try{
    const res = await axios.get('/api/silos');
    const silos = res.data;
    renderSilos(silos);
    if(lastUpdated) lastUpdated.textContent = new Date().toLocaleTimeString();
  }catch(e){console.error(e)}
}

// Silos list + create
async function fetchAndRenderSilosList(){
  try{
    const res = await axios.get('/api/silos');
    const silos = res.data;
    const list = document.getElementById('silos-list');
    if(!list) return;
    list.innerHTML = '';
    silos.forEach(s=>{
      const item = document.createElement('div');
      item.className = 'silo-row';
      const html =
        '<div class="silo-info">' +
          '<div>' +
            '<div class="silo-name">' + s.name + '</div>' +
            '<div class="silo-meta-compact">' + s.humidity + '% • ' + s.temperature + '°C • Nivel ' + s.level + '%</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<select data-name="' + s.name + '" class="form-select form-select-sm state-select" style="width:150px">' +
            '<option value="Activo" ' + (s.state==='Activo'?'selected':'') + '>Activo</option>' +
            '<option value="Inactivo" ' + (s.state==='Inactivo'?'selected':'') + '>Inactivo</option>' +
            '<option value="Mantenimiento" ' + (s.state==='Mantenimiento'?'selected':'') + '>Mantenimiento</option>' +
          '</select>' +
        '</div>';
      item.innerHTML = html;
      list.appendChild(item);
    });

    // handlers
    $$('.state-select').forEach(sel=>{
      sel.addEventListener('change', async ()=>{
        const name = sel.dataset.name; const state = sel.value;
        try{ await axios.post('/api/silos/state',{name,state}); fetchAndRenderSilosList(); fetchAndRender(); }catch(e){console.error(e)}
      });
    });
  }catch(e){console.error(e)}
}

function bindAddSiloForm(){
  const form = document.getElementById('add-silo-form');
  if(!form) return;
  form.onsubmit = async (e)=>{
    e.preventDefault();
    const name = document.getElementById('input-silo-name').value.trim();
    const level = document.getElementById('input-silo-level').value || undefined;
    if(!name) return alert('Nombre requerido');
    try{
      await axios.post('/api/silos',{name, level});
      form.reset(); fetchAndRenderSilosList(); fetchAndRender();
    }catch(err){
      if(err.response && err.response.status===409) alert('Ya existe un silo con ese nombre');
      else console.error(err);
    }
  };
}

// Alerts
async function fetchAndRenderAlerts(){
  try{
    const res = await axios.get('/api/alerts');
    const alerts = res.data;
    const list = document.getElementById('alerts-list');
    if(!list) return;
    list.innerHTML = '';
    alerts.forEach(a=>{
      const item = document.createElement('div');
      const cls = a.level==='critical'? 'alert-critical' : (a.level==='warning'? 'alert-warning' : 'alert-normal');
      item.className = 'alert-item ' + cls;
      item.innerHTML = '<div>' + a.silo + ': ' + a.msg + '</div><div class="text-muted small">' + a.level + '</div>';
      list.appendChild(item);
    });
  }catch(e){console.error(e)}
}

// HISTORY
async function loadHistoryList(){
  try{
    const res = await axios.get('/api/silos');
    const silos = res.data;
    if(!historySelect) return;
    historySelect.innerHTML = '';
    silos.forEach(s=>{
      const opt = document.createElement('option'); opt.value = s.name; opt.textContent = s.name; historySelect.appendChild(opt);
    });
    if(silos.length>0){ historySelect.value = silos[0].name; loadHistoryFor(silos[0].name); }
    historySelect.onchange = ()=> loadHistoryFor(historySelect.value);
  }catch(e){console.error(e)}
}

async function loadHistoryFor(name){
  try{
    const res = await axios.get('/api/silos/history/' + encodeURIComponent(name));
    const data = res.data || [];
    const labels = data.map(r=> new Date(r.timestamp).toLocaleString());
    const humid = data.map(r=> r.humidity);
    const level = data.map(r=> r.level);
    const temp = data.map(r=> r.temperature);

    if(historyChart) historyChart.destroy();
    const canvas = document.getElementById('history-chart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    historyChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets:[
        {label:'Humedad (%)', data: humid, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--green').trim(), tension:0.2, fill:false},
        {label:'Nivel (%)', data: level, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), tension:0.2, fill:false},
        {label:'Temperatura (°C)', data: temp, borderColor: '#ff6b6b', tension:0.2, fill:false}
      ]},
      options: { responsive:true, plugins:{legend:{position:'bottom'}} }
    });

    const stats = document.getElementById('history-stats'); if(stats){
      const avgHum = (humid.reduce((a,b)=>a+(b||0),0)/Math.max(1,humid.length)).toFixed(2);
      const avgTemp = (temp.reduce((a,b)=>a+(b||0),0)/Math.max(1,temp.length)).toFixed(2);
      const lastLevel = level.length? level[level.length-1]: 'N/A';
      stats.innerHTML = '<div class="col-md-4"><div class="history-card">Promedio Humedad: <strong>' + avgHum + '%</strong></div></div>' +
                        '<div class="col-md-4"><div class="history-card">Promedio Temperatura: <strong>' + avgTemp + '°C</strong></div></div>' +
                        '<div class="col-md-4"><div class="history-card">Último Nivel: <strong>' + lastLevel + '%</strong></div></div>';
    }

  }catch(e){console.error(e)}
}

// inicial
showView('dashboard'); fetchAndRender();
setInterval(()=>{
  const active = document.querySelector('.sidebar .nav-link.active');
  const activeView = active? active.dataset.view : 'dashboard';
  if(activeView==='dashboard') fetchAndRender();
  if(activeView==='silos') fetchAndRenderSilosList();
  if(activeView==='alerts') fetchAndRenderAlerts();
  if(activeView==='history') loadHistoryList();
},10000);
            
