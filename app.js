// ─── RUNTIME SEGURO (data.js SIEMPRE MANDA) ───
var INGR = typeof INGR_RAW !== 'undefined' ? JSON.parse(JSON.stringify(INGR_RAW)) : [];
var GASTOS = typeof GASTOS_INIT !== 'undefined' ? JSON.parse(JSON.stringify(GASTOS_INIT)) : [];
var CREDENCIALES = typeof CRED_INIT !== 'undefined' ? JSON.parse(JSON.stringify(CRED_INIT)) : [];
var RECIPES = typeof RECIPES_RAW !== 'undefined' ? JSON.parse(JSON.stringify(RECIPES_RAW)) : [];

try {
    var localSales = localStorage.getItem('app_sales');
    if (localSales) { var pSales = JSON.parse(localSales); if (pSales.monthly && pSales.monthly.length > 0) SALES = pSales; }
    
    var localIngr = localStorage.getItem('app_ingr');
    if (localIngr) { var pIngr = JSON.parse(localIngr); if (pIngr.length > 0) INGR = pIngr; }
    
    var localRec = localStorage.getItem('app_rec');
    if (localRec) { var pRec = JSON.parse(localRec); if (pRec.length > 0) RECIPES = pRec; }
    
    var localGastos = localStorage.getItem('app_gastos');
    if (localGastos) { var pGastos = JSON.parse(localGastos); if (pGastos.length > 0) GASTOS = pGastos; }
} catch(e) {
    console.warn("Ignorando caché corrupto o vacío.");
}
var pendingUpload = null;

// ─── HELPERS ───
var $ = function(id){ return document.getElementById(id); };
var fmt  = function(n){ return '$'+Math.round(Math.abs(n)).toLocaleString('es-CL'); };
var fmtN = function(n,d){ d=d||1; return(+Math.abs(n).toFixed(d)).toLocaleString('es-CL'); };
var fmtM = function(n){ return '$'+(Math.abs(n)/1e6).toFixed(2)+'M'; };
var fmtB = function(n){ return '$'+(Math.abs(n)*1.19/1e6).toFixed(2)+'M'; }; 

// ─── THEME ───
var theme='dark';
function toggleTheme(){
  theme=theme==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',theme);
  var tg = $('tog');
  if(tg) tg.textContent=theme==='dark'?'Claro':'Oscuro';
}

// ─── NAV ───
function go(id){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('on')});
  document.querySelectorAll('.nt').forEach(function(t){t.classList.remove('on')});
  
  var pageId = id;
  if(id==='ped' || id==='cnt') pageId = 'stock';
  
  var pEl = $('p-'+pageId);
  if(pEl) pEl.classList.add('on');
  
  var tab=$('t-'+pageId); 
  if(tab){ tab.classList.add('on'); tab.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}); }
  
  if(id==='ped'){ setStockTab('ped'); renderPed(); }
  if(id==='cnt'){ setStockTab('cnt'); renderCnt(); }
  if(id==='stock') renderIngr();
  if(id==='ventas') renderV();
  if(id==='delivery'){initDeliveryMesSel();initDelivery();}
  if(id==='gastos') renderGastos();
  if(id==='analisis') initAnalisis();
  if(id==='obj') renderObjetivos();
}
function cm(id){ var el = $(id); if(el) el.classList.remove('on'); }

// ─── BAR CHART ───
function mkBar(lbl,val,max,color,vFmt,lw){
  var pct=max>0?(val/max*100).toFixed(1):0;
  return '<div class="br"><div class="br-lbl" style="width:'+(lw||140)+'px">'+lbl+'</div>'
    +'<div class="br-track"><div class="br-fill" style="width:'+pct+'%;background:'+color+'"></div></div>'
    +'<div class="br-val">'+(vFmt?vFmt(val):fmtN(val))+'</div></div>';
}
function barChart(id,items,color,vFmt,lw){
  var el=$(id); if(!el||!items.length) return;
  var C=['#00d4ff','#ff3fa4','#00e5a0','#ffb020','#33ddff','#ff70c0','#66efc0','#ffd060'];
  var max=Math.max.apply(null,items.map(function(i){return i.v}));
  el.innerHTML=items.map(function(it,i){
    return mkBar(it.l,it.v,max,typeof color==='string'?color:C[i%C.length],vFmt,lw);
  }).join('');
}

// ════ DASHBOARD ════
function initDashSel(){
  var M=SALES.monthly;
  var now=new Date();
  var mN=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var cur=mN[now.getMonth()]+' '+now.getFullYear();
  var html='<option value="all">Todos los meses</option>';
  M.forEach(function(m){ html+='<option value="'+m.month+'"'+(m.month===cur?' selected':'')+'>'+m.month+'</option>'; });
  var sel = $('dash-mes-sel');
  if(sel) sel.innerHTML=html;
}

function initDash(){
  var sel=$('dash-mes-sel'); var sv=sel?sel.value:'all';
  var M=SALES.monthly;
  var sm=sv==='all'?M:M.filter(function(m){return m.month===sv});
  if(!sm.length) sm=M;
  
  var tvn=sm.reduce(function(s,m){return s+m.venta_neta},0);
  var tco=INGR.reduce(function(s,i){return s+i.total_cost},0);
  var amg=sm.reduce(function(s,m){return s+m.margen_pct},0)/sm.length;
  var pk=sm.slice().sort(function(a,b){return b.venta_neta-a.venta_neta})[0];
  var lbl=sv==='all'?'Ene 25–Feb 26':sv;
  
  var kpiD = $('kpi-dash');
  if(kpiD) {
      kpiD.innerHTML=[
        {l:'Venta neta (c/IVA)',v:fmtM(tvn),                       f:lbl},
        {l:'Base imponible',   v:fmtM(Math.round(tvn/1.19)),       f:'Sin IVA real · '+lbl, m:1},
        {l:sv==='all'?'Mejor mes':'Días activos', v:sv==='all'?pk.month.split(' ')[0]:sm[0].days_active+'d', f:sv==='all'?fmtM(pk.venta_neta):''},
        {l:'Margen neto prom.',v:amg.toFixed(1)+'%',               f:'Sin IVA'},
        {l:'Costo insumos',    v:fmtM(tco),                        f:'Histórico acumulado', m:1},
      ].map(function(k){
        return '<div class="kpi'+(k.m?' m':'')+'"><div class="kpi-lbl">'+k.l+'</div>'
          +'<div class="kpi-val">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>';
      }).join('');
  }
  
  var totalVenta=M.reduce(function(s,m){return s+m.venta_neta;},0);
  var monthRatio=totalVenta>0?tvn/totalVenta:1;
  
  var chVn = $('ch-vn');
  if(chVn) {
      var cardHd=chVn.previousElementSibling; 
      if(sv==='all'){
        if(cardHd) cardHd.textContent='Venta neta mensual';
        lineChart('ch-vn',sm.map(function(m){return{l:m.month.split(' ')[0].slice(0,3),v:m.venta_sin_iva||(Math.round(m.venta_neta/1.19))};}), '#00d4ff', fmtM);
      } else {
        if(cardHd) cardHd.textContent='Venta diaria — '+sv;
        var sd=SALES.daily.filter(function(d){return d.month===sv && d.venta_neta>0;});
        if(sd.length>0){
          lineChart('ch-vn',sd.map(function(d){
             var num=d.date.replace(/[^\d]/g,''); 
             return{l:num, v:Math.round(d.venta_neta/1.19)};
          }), '#00d4ff', fmtM);
        } else {
          chVn.innerHTML='<div class="empty" style="padding:40px 0">Sin datos diarios para este mes</div>';
        }
      }
  }
  
  var ya_t=sm.reduce(function(s,m){return s+(m.delivery_ya||0);},0);
  var ub_t=sm.reduce(function(s,m){return s+(m.delivery_uber||0);},0);
  var tr_t=sm.reduce(function(s,m){return s+(m.delivery_transferencia||0);},0);
  var lc_t=Math.max(0,tvn-ya_t-ub_t-tr_t);
  var canalData=[{l:'Local',v:lc_t},{l:'PedidosYa',v:ya_t},{l:'Del. interno',v:tr_t},{l:'Uber Eats',v:ub_t}].filter(function(x){return x.v>0;});
  setTimeout(function(){pieChart('ch-ci', canalData, 'Canales de venta');},50);
  
  var topDishes=PRODUCT_SALES.filter(function(p){return p.weekly_qty>0&&p.venta>0&&!p.is_modifier})
    .map(function(p){return{l:p.name,v:Math.round(p.weekly_qty*monthRatio*4.33)};})
    .sort(function(a,b){return b.v-a.v;}).slice(0,8);
  setTimeout(function(){
    barChart('ch-pv',topDishes,['#00e5a0','#00d4ff','#ff3fa4','#ffb020','#a78bfa'],function(v){return v+'u';}, 160);
  },80);
  
  var topRec=RECIPES.filter(function(r){return r.cost>200&&r.cost<9000;}).sort(function(a,b){return b.cost-a.cost;}).slice(0,8).map(function(r){return{l:r.name,v:r.cost};});
  barChart('ch-rc',topRec, '#00d4ff', fmt, 160);
}

// ════ VENTAS ════
var aM='all';
var vCanal='all'; 

function initMonthSel(){
  var M=SALES.monthly;
  var sel=$('v-mes-sel'); if(!sel) return;
  var now=new Date();
  var mN=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var cur=mN[now.getMonth()]+' '+now.getFullYear();
  var html='<option value="all">Todos los meses</option>';
  M.forEach(function(m){ html+='<option value="'+m.month+'"'+(m.month===cur?' selected':'')+'>'+m.month+'</option>'; });
  sel.innerHTML=html;
  var exists=M.find(function(m){return m.month===cur;});
  aM=exists?cur:'all';
  if(!exists) sel.value='all';
}

function setMonth(val){ aM=val; renderV(); }

function setVCanal(val,el){
  vCanal=val;
  document.querySelectorAll('[id^="vch-"]').forEach(function(b){b.classList.remove('on')});
  el.classList.add('on');
  renderV();
}

function getVenta(m){
  var dy=(m.delivery_ya||0), du=(m.delivery_uber||0), dt=(m.delivery_transferencia||0);
  var dr=(m.delivery_rappi||0);
  var ef=(m.efectivo||0), cr=(m.credito||0), db=(m.debito||0), ju=(m.junaeb||0);
  var ot=(m.otros||0)+(m.ticket||0)+(m.cheque||0);
  var tarjetas=cr+db;
  var local=ef+tarjetas+ju+ot;
  if(vCanal==='all')       return m.venta_neta;
  if(vCanal==='local')     return local;
  if(vCanal==='efectivo')  return ef;
  if(vCanal==='tarjetas')  return tarjetas;
  if(vCanal==='junaeb')    return ju;
  if(vCanal==='intern')    return dt;
  if(vCanal==='ya')        return dy;
  if(vCanal==='uber')      return du;
  if(vCanal==='rappi')     return dr;
  if(vCanal==='otros')     return ot;
  return m.venta_neta;
}

function canalLabel(){
  var labels={'all':'Total','local':'Presencial','efectivo':'Efectivo','tarjetas':'Tarjetas','junaeb':'Junaeb','intern':'Interno','ya':'PedidosYa','uber':'Uber Eats','rappi':'Rappi','otros':'Otros'};
  return labels[vCanal]||vCanal;
}

function renderV(){
  var M=SALES.monthly, D=SALES.daily;
  var sm=aM==='all'?M:M.filter(function(m){return m.month===aM;});
  var sd=aM==='all'?D:D.filter(function(d){return d.month===aM;});
  if(!sm.length) sm=M;

  var tvn=sm.reduce(function(s,m){return s+getVenta(m);},0);
  var amg=sm.reduce(function(s,m){return s+m.margen_pct;},0)/sm.length;
  var ad=sd.filter(function(d){return d.venta_neta>0;});
  var canalRatio=sm.reduce(function(s,m){return s+m.venta_neta;},0);
  var canalTotal=sm.reduce(function(s,m){return s+getVenta(m);},0);
  var ratio=canalRatio>0?canalTotal/canalRatio:1;
  var avgd=ad.length?ad.reduce(function(s,d){return s+d.venta_neta*ratio;},0)/ad.length:0;
  var lbl=(aM==='all'?'Ene 25–Feb 26':aM)+' · '+canalLabel();

  var totalIntern=sm.reduce(function(s,m){return s+(m.delivery_ya||0)+(m.delivery_uber||0);},0);
  var delPct=sm.reduce(function(s,m){return s+m.venta_neta;},0)>0?(totalIntern/sm.reduce(function(s,m){return s+m.venta_neta;},0)*100):0;

  var kv = $('kpi-v');
  if(kv){
      kv.innerHTML=[
        {l:'Venta '+canalLabel(),      v:fmtM(tvn),  f:'Sin IVA · '+lbl},
        {l:'Venta bruta c/IVA',        v:'$'+(tvn*1.19/1e6).toFixed(2)+'M', f:'IVA incluido', m:1},
        {l:'Margen neto',              v:amg.toFixed(1)+'%', f:'Sin IVA'},
        {l:'Delivery interno',         v:fmtM(totalIntern), f:delPct.toFixed(1)+'% del total', m:1},
        {l:'Promedio diario',          v:fmt(avgd), f:ad.length+' días activos'},
      ].map(function(k){
        return '<div class="kpi'+(k.m?' m':'')+'"><div class="kpi-lbl">'+k.l+'</div>'
          +'<div class="kpi-val">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>';
      }).join('');
  }

  var vt1 = $('vt1');
  if(vt1) vt1.textContent=(aM==='all'?'Venta mensual':'Este mes vs Año anterior')+' · '+canalLabel();
  
  if(aM!=='all'&&sm.length===1){
    var cur=sm[0];
    var ns2=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var pts2=aM.split(' ');var mi2=ns2.indexOf(pts2[0]);
    var prevLbl=mi2>=0?ns2[mi2]+' '+(parseInt(pts2[1])-1):null;
    var prev=prevLbl?M.find(function(x){return x.month===prevLbl;}):null;
    var cdata=[{l:cur.days_active<26?aM+'*':aM,v:getVenta(cur)}];
    if(prev) cdata.push({l:prevLbl,v:getVenta(prev)});
    barChart('ch-vm', cdata, ['#00d4ff','rgba(0,212,255,.25)'], fmtM, 140);
  } else {
    lineChart('ch-vm', sm.map(function(m){return{l:m.month.split(' ')[0].slice(0,3),v:getVenta(m)};}), '#00d4ff', fmtM);
  }

  var vt2 = $('vt2');
  if(vt2) vt2.textContent=aM==='all'?'Último mes — días':'Días de '+aM;
  var ds=aM==='all'?D.filter(function(d){return d.month===M[M.length-1].month;}):sd;
  var vd=ds.filter(function(d){return d.venta_neta>0;});
  lineChart('ch-vd', vd.map(function(d){
    return {l:d.date.replace(/[^\d]/g,''), v:Math.round(d.venta_neta*ratio)};
  }), '#00e5a0', fmtM);

  if(vCanal==='all'&&sm.length>0){
    var efT=sm.reduce(function(s,m){return s+(m.efectivo||0);},0);
    var crT=sm.reduce(function(s,m){return s+(m.credito||0);},0);
    var dbT=sm.reduce(function(s,m){return s+(m.debito||0);},0);
    var tjT=crT+dbT;
    var juT=sm.reduce(function(s,m){return s+(m.junaeb||0);},0);
    var yaT=sm.reduce(function(s,m){return s+(m.delivery_ya||0);},0);
    var ubT=sm.reduce(function(s,m){return s+(m.delivery_uber||0);},0);
    var rpT=sm.reduce(function(s,m){return s+(m.delivery_rappi||0);},0);
    var dtT=sm.reduce(function(s,m){return s+(m.delivery_transferencia||0);},0);
    var otT=sm.reduce(function(s,m){return s+(m.otros||0)+(m.ticket||0)+(m.cheque||0);},0);
    var tot=efT+tjT+juT+yaT+ubT+rpT+dtT+otT;

    var items=[
      {l:'Efectivo',v:efT,c:'#00e5a0'},
      {l:'Tarjetas',v:tjT,c:'#00d4ff',sub:[{l:'Débito',v:dbT},{l:'Crédito',v:crT}]},
      {l:'Junaeb',v:juT,c:'#ffb020'},
      {l:'PedidosYa',v:yaT,c:'#ff3fa4'},
      {l:'Uber Eats',v:ubT,c:'#a78bfa'},
      {l:'Rappi',v:rpT,c:'#ff6b6b'},
      {l:'Interno',v:dtT,c:'#33ddff'},
      {l:'Otros',v:otT,c:'#6b6b88'}
    ].filter(function(x){return x.v>0;});

    var barsHtml=items.map(function(x){
      var bar=mkBar(x.l,x.v,tot,x.c,fmtM,120);
      if(x.sub){
        bar+='<div style="padding-left:132px;margin-top:-4px;margin-bottom:4px">';
        x.sub.filter(function(s){return s.v>0;}).forEach(function(s){
          bar+='<span style="font-size:10px;color:var(--sub);margin-right:12px">'+s.l+': <strong style="font-family:var(--mono);color:var(--t)">'+fmtM(s.v)+'</strong></span>';
        });
        bar+='</div>';
      }
      return bar;
    }).join('');

    var chvd = $('ch-vd');
    if(chvd){
        chvd.innerHTML+='<div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--b)">'
          +'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--sub);margin-bottom:12px">Desglose por método de pago</div>'
          +barsHtml+'</div>';
    }
    pieChart('ch-vd-pie',items.map(function(x){return{l:x.l,v:x.v};}));
  }
}

// ════ ANÁLISIS INTELIGENTE ════
function initAnalisis(){
  var sel=$('an-mes-sel');
  if(sel&&!sel.options.length){
    sel.innerHTML='<option value="all">Todo el período</option>'
      +SALES.monthly.map(function(m){return '<option value="'+m.month+'">'+m.month+'</option>';}).join('');
    sel.onchange = initAnalisis; 
  }
  var sv=sel?sel.value:'all';
  var totalVenta=SALES.monthly.reduce(function(s,m){return s+m.venta_neta;},0);
  var selMo=sv==='all'?null:SALES.monthly.find(function(m){return m.month===sv;});
  var monthRatio=selMo&&totalVenta>0?selMo.venta_neta/totalVenta:1;
  var weeksInPeriod=sv==='all'?SALES.monthly.length*4.33:selMo?selMo.days_active/7:4.33;

  var ctx=$('an-context');
  if(ctx){
    if(selMo) ctx.textContent=selMo.days_active+' días activos · venta '+fmtM(selMo.venta_neta);
    else ctx.textContent=SALES.monthly.length+' meses analizados';
  }

  if ($('ch-vp')) {
    var M = SALES.monthly;
    var activeM = M.filter(function(m){return m.days_active>0;});
    var targetMonth = sv === 'all' ? activeM[activeM.length-1] : activeM.find(function(m){return m.month === sv;});
    
    if (targetMonth) {
        var targetIdx = activeM.indexOf(targetMonth);
        var histM = activeM.slice(0, targetIdx + 1).slice(-6); 
        var wSum=0, wRate=0;
        var weights=[1,1,2,2,3,3].slice(-histM.length); 
        histM.forEach(function(mo,i){
            var w = weights[i]||1; wSum+=w; wRate+=(mo.venta_neta/mo.days_active)*w;
        });
        var baseRate = wSum>0 ? wRate/wSum : 0;
        
        var trendPct = 0; 
        if(histM.length >= 4) {
            var mid = Math.floor(histM.length/2);
            var h1 = histM.slice(0, mid), h2 = histM.slice(mid);
            var r1 = h1.reduce(function(s,m){return s+(m.venta_neta/m.days_active);},0)/h1.length;
            var r2 = h2.reduce(function(s,m){return s+(m.venta_neta/m.days_active);},0)/h2.length;
            if(r1>0) trendPct = (r2-r1)/r1;
        }

        var mArr=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        var mPts=targetMonth.month.split(' ');
        var mI=mArr.indexOf(mPts[0]); var yr=parseInt(mPts[1]);
        var dim=new Date(yr,mI+1,0).getDate();

        var currentActual=targetMonth.venta_neta;
        var currentProj = targetMonth.days_active >= dim - 2 ? currentActual : Math.round((currentActual / targetMonth.days_active) * dim);

        var pctMonth=Math.min(100, Math.round((targetMonth.days_active/dim)*100));
        var pctVenta=currentProj>0 ? Math.min(100, Math.round((currentActual/currentProj)*100)) : 0;

        var nextMonthsHtml = '';
        var maxProj = currentProj;
        var futureData = [];
        for(var i=1; i<=3; i++){
            var nxI = (mI + i) % 12;
            var nxY = yr + Math.floor((mI + i) / 12);
            var nxDim = new Date(nxY, nxI+1, 0).getDate();
            var projRate = baseRate * Math.pow(1+trendPct, i);
            var projV = Math.round(projRate * nxDim);
            futureData.push({l: mArr[nxI].slice(0,3)+' '+nxY, v: projV});
            if(projV > maxProj) maxProj = projV;
        }

        futureData.forEach(function(d){
            var wPct = maxProj > 0 ? (d.v/maxProj*100) : 0;
            nextMonthsHtml += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:10px">'
                +'<span style="width:65px;font-size:11.5px;color:var(--sub);font-weight:600">'+d.l+'</span>'
                +'<div style="flex:1;height:6px;background:var(--s3);border-radius:4px">'
                +'<div style="width:'+wPct+'%;background:rgba(0,212,255,.35);height:100%;border-radius:4px"></div>'
                +'</div>'
                +'<span style="width:65px;text-align:right;font-size:12px;font-family:var(--mono);color:var(--t)">'+fmtM(d.v)+'</span>'
                +'</div>';
        });

        $('ch-vp').innerHTML = '<div style="display:flex;flex-direction:column;gap:20px;padding-top:6px">'
            +'<div style="background:var(--s2);border:1px solid var(--b);border-radius:12px;padding:18px;position:relative;box-shadow:0 4px 12px rgba(0,0,0,.3)">'
            +'<div style="display:flex;justify-content:space-between;margin-bottom:12px">'
            +'<span style="font-size:11px;font-weight:700;color:var(--t);text-transform:uppercase;letter-spacing:.08em">Progreso '+targetMonth.month+'</span>'
            +'<span style="font-size:11px;font-weight:800;color:var(--a)">'+pctMonth+'% del mes</span>'
            +'</div>'
            +'<div style="height:12px;background:rgba(255,176,32,.15);border-radius:6px;display:flex;overflow:hidden;margin-bottom:10px">'
            +'<div style="width:'+pctVenta+'%;background:var(--a);height:100%;border-radius:6px;transition:width .8s ease"></div>'
            +'</div>'
            +'<div style="display:flex;justify-content:space-between;font-size:11.5px;font-family:var(--mono)">'
            +'<span style="color:var(--t);font-weight:700">Llevamos: '+fmtM(currentActual)+'</span>'
            +'<span style="color:var(--sub)">Meta est: '+fmtM(currentProj)+'</span>'
            +'</div>'
            +'</div>'
            +'<div style="padding:0 8px">'
            +'<div style="font-size:10px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.12em;margin-bottom:14px;border-bottom:1px solid var(--b);padding-bottom:8px">Siguientes 3 meses ('+(trendPct>0?'+':'')+ (trendPct*100).toFixed(1) +'%)</div>'
            + nextMonthsHtml
            +'</div>'
            +'</div>';
    }
  }

  var topD=PRODUCT_SALES.filter(function(p){return p.weekly_qty>0&&p.venta>0&&!p.is_modifier})
    .map(function(p){
      var periodQty=sv==='all'?p.weekly_qty:(p.weekly_qty*weeksInPeriod);
      return{name:p.name,cat:p.cat,qty:periodQty,venta:p.venta*monthRatio,weekly_qty:p.weekly_qty,avg_ticket:p.avg_ticket,weekly_venta:p.weekly_venta};
    }).sort(function(a,b){return b.qty-a.qty}).slice(0,10);
    
  setTimeout(function(){
      barChart('ch-platos', topD.map(function(p){return {l:p.name, v:p.qty}}), '#00d4ff', function(v){return Math.round(v)+'u';}, 160);
  }, 50);

  var days=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  var dayLabels=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  var dayVals=days.map(function(d){return DAY_PATTERNS[d]||0;});
  var maxDay2=Math.max.apply(null,dayVals)||1;
  var dH=140, dPadB=32, dPadT=8, dBW=34, dGap=12;
  var dTotalW=(dBW+dGap)*7+dGap;
  var dColors=['#00d4ff','#00d4ff','#00d4ff','#00d4ff','#ff3fa4','#ff3fa4','#ff3fa4'];
  var dBars=dayVals.map(function(v,i){
    var bh=Math.max(4,Math.round((v/maxDay2)*(dH-dPadT-dPadB)));
    var x=dGap+i*(dBW+dGap);
    var y=dH-dPadB-bh;
    var c=dColors[i];
    return '<g style="cursor:pointer" onmouseenter="showDayTip(this,event)" onmouseleave="hideDayTip()" data-v="'+v+'" data-l="'+dayLabels[i]+'">'
      +'<rect x="'+x+'" y="'+(dH-dPadB)+'" width="'+dBW+'" height="1" rx="4" fill="'+c+'" opacity=".2"/>'
      +'<rect class="anim-bar" x="'+x+'" y="'+(dH-dPadB)+'" width="'+dBW+'" height="0" rx="4" fill="'+c+'" data-ty="'+y+'" data-th="'+bh+'"/>'
      +'<text x="'+(x+dBW/2)+'" y="'+(dH-dPadB+14)+'" text-anchor="middle" font-size="11" fill="var(--sub)" font-family="system-ui">'+dayLabels[i]+'</text>'
      +'<text class="day-val-txt" x="'+(x+dBW/2)+'" y="'+(y-5)+'" text-anchor="middle" font-size="9" fill="'+c+'" font-family="var(--mono)" opacity="0">'+fmtM(v)+'</text>'
      +'</g>';
  }).join('');
  
  var dc = $('day-chart');
  if(dc) {
      dc.innerHTML='<div id="day-tooltip" style="position:fixed;background:var(--s2);border:1px solid var(--b);border-radius:6px;padding:8px 12px;font-size:11px;pointer-events:none;z-index:200;display:none">'
        +'<div id="dtt-label" style="font-weight:700;color:var(--t);margin-bottom:2px"></div>'
        +'<div id="dtt-val" style="color:var(--m);font-family:var(--mono)"></div>'
        +'<div id="dtt-pct" style="font-size:10px;color:var(--sub)"></div></div>'
        +'<div style="display:flex;justify-content:center;width:100%"><svg width="100%" viewBox="0 0 '+dTotalW+' '+dH+'" style="overflow:visible;display:block;max-width:400px">'+dBars+'</svg></div>'
        +'<div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--sub);justify-content:center">'
        +'<span><span style="display:inline-block;width:8px;height:8px;background:#00d4ff;border-radius:2px;margin-right:4px"></span>Semana</span>'
        +'<span><span style="display:inline-block;width:8px;height:8px;background:#ff3fa4;border-radius:2px;margin-right:4px"></span>Fin de semana</span>'
        +'</div>';
  }
  requestAnimationFrame(function(){
    document.querySelectorAll('#day-chart .anim-bar').forEach(function(bar,i){
      setTimeout(function(){
        var ty=bar.getAttribute('data-ty'), th=bar.getAttribute('data-th');
        bar.style.transition='y .45s cubic-bezier(.34,1.56,.64,1), height .45s cubic-bezier(.34,1.56,.64,1)';
        bar.setAttribute('y',ty); bar.setAttribute('height',th);
        var txt=bar.parentElement.querySelector('.day-val-txt');
        if(txt) setTimeout(function(){txt.style.transition='opacity .3s';txt.setAttribute('opacity','1');},350);
      }, i*70);
    });
  });

  var cards=PRODUCT_SALES.filter(function(p){return p.weekly_qty>1&&p.venta>0&&!p.is_modifier})
    .map(function(p){
      return{name:p.name,cat:p.cat,qty:p.weekly_qty*weeksInPeriod,
        venta:p.venta*monthRatio,avg_ticket:p.avg_ticket,
        weekly_venta:p.weekly_venta*monthRatio*4.33/SALES.monthly.length};
    }).sort(function(a,b){return b.venta-a.venta}).slice(0,12);
    
  var topPie=cards.slice(0,6).map(function(p){return{l:p.name,v:Math.round(p.venta)};});
  setTimeout(function(){pieChart('insight-pie', topPie, 'Top platos por venta');},100);
  
  var maxV2=cards[0]?cards[0].venta:1;
  var th='padding:14px 16px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--sub);border-bottom:2px solid var(--b)';
  var td='padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.03);font-size:14px';
  var rowsHtml=cards.map(function(p,i){
    var rec=RECIPES.find(function(r){return r.name.toLowerCase()===p.name.toLowerCase();});
    var pct=maxV2>0?p.venta/maxV2*100:0;
    var barC=i<3?'#00d4ff':i<6?'#ff3fa4':'#00e5a0';
    var bg=i%2===0?'transparent':'rgba(255,255,255,.015)';
    return '<tr style="background:'+bg+'">'
      +'<td style="'+td+';color:var(--sub);font-family:var(--mono)">'+(i+1)+'</td>'
      +'<td style="'+td+';font-weight:700;color:var(--t)">'+p.name+'</td>'
      +'<td style="'+td+';color:var(--sub)">'+p.cat+'</td>'
      +'<td style="'+td+';text-align:right;font-family:var(--mono);font-weight:800;color:var(--m)">'+fmtM(p.venta)+'</td>'
      +'<td style="'+td+';text-align:right;font-family:var(--mono);color:var(--sub)">'+fmt(p.avg_ticket)+'</td>'
      +'<td style="'+td+';text-align:right;font-family:var(--mono);color:'+(rec?'#00e5a0':'var(--sub)')+'">'+(rec?fmt(rec.cost):'—')+'</td>'
      +'<td style="'+td+'"><div style="background:var(--s3);border-radius:5px;height:8px;min-width:90px"><div style="background:'+barC+';height:8px;border-radius:5px;width:'+pct.toFixed(1)+'%"></div></div></td>'
      +'</tr>';
  }).join('');
  
  var ic = $('insight-cards');
  if(ic){
      ic.innerHTML='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">'
        +'<thead><tr>'
        +'<th style="'+th+'">#</th><th style="'+th+';text-align:left">Plato</th><th style="'+th+';text-align:left">Categoría</th>'
        +'<th style="'+th+';text-align:right">Venta</th><th style="'+th+';text-align:right">Ticket</th>'
        +'<th style="'+th+';text-align:right">Costo</th><th style="'+th+'">Dist.</th>'
        +'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div>';
  }
}

// ════ INVENTARIO ════
var IS={q:'',cat:'',uso:'',sort:'total_cost',dir:-1};
var IP={page:0,per:20};

function getIRows(){
  var r=INGR.slice();
  if(IS.q){var q=IS.q.toLowerCase();r=r.filter(function(i){return i.name.toLowerCase().indexOf(q)>=0||(i.brand||'').toLowerCase().indexOf(q)>=0||(i.proveedor||'').toLowerCase().indexOf(q)>=0})}
  if(IS.cat) r=r.filter(function(i){return i.category===IS.cat});
  if(IS.uso==='hi') r=r.filter(function(i){return i.weekly_avg>20});
  else if(IS.uso==='md') r=r.filter(function(i){return i.weekly_avg>=1&&i.weekly_avg<=20});
  else if(IS.uso==='lo') r=r.filter(function(i){return i.weekly_avg<1});
  var k=IS.sort,d=IS.dir;
  r.sort(function(a,b){var av=a[k]||0,bv=b[k]||0;return typeof av==='string'?d*av.localeCompare(bv):d*(bv-av)});
  return r;
}

function renderIngr(){
  var rows=getIRows(),total=rows.length,pages=Math.max(1,Math.ceil(total/IP.per));
  IP.page=Math.min(IP.page,pages-1);
  var sl=rows.slice(IP.page*IP.per,(IP.page+1)*IP.per);
  var cnt = $('i-cnt'); if(cnt) cnt.textContent=total+' ingredientes';
  var tbody = $('i-body');
  if(tbody) {
      tbody.innerHTML=sl.map(function(i){
        var cr=(i.weekly_avg*2).toFixed(1);
        var lv=i.weekly_avg>20?'r':i.weekly_avg>5?'a':'g';
        var dc=lv==='r'?'#ff4455':lv==='a'?'#ffb020':'#00e5a0';
        var br=i.brand?'<div style="font-size:10.5px;color:var(--sub);margin-top:2px">'+i.brand+(i.proveedor?' · <em>'+i.proveedor+'</em>':'')+'</div>':'';
        return '<tr>'
          +'<td><span class="dot" style="background:'+dc+'"></span><strong>'+i.name+'</strong>'+br+'</td>'
          +'<td class="hide-sm" style="color:var(--sub);font-size:12px">'+(i.brand||'—')+'</td>'
          +'<td class="hide-sm" style="color:var(--sub);font-size:12px">'+(i.proveedor||'—')+'</td>'
          +'<td class="r mono">'+fmt(i.cost)+'</td>'
          +'<td class="hide-xs"><span class="tag t-n">'+i.unit+'</span></td>'
          +'<td class="r mono">'+(i.weekly_avg>0?fmtN(i.weekly_avg)+' '+i.unit:'<span style="color:var(--sub)">—</span>')+'</td>'
          +'<td class="r mono hide-sm">'+(i.total_cost>0?fmt(i.total_cost):'<span style="color:var(--sub)">—</span>')+'</td>'
          +'<td class="r hide-xs"><span class="tag t-'+lv+'">'+(i.weekly_avg>0?cr+' '+i.unit:'—')+'</span></td>'
          +'<td><button class="btn-tbl" onclick="openEdit(\''+i.code+'\')">Editar</button></td>'
          +'</tr>';
      }).join('');
  }
  renderPag('i-pag',total,IP.page,IP.per,function(p){IP.page=p;renderIngr()});
}

function filterI(){IS.q=$('iq').value;IS.cat=$('ic').value;IS.uso=$('iu').value;IP.page=0;renderIngr()}
function sI(k){if(IS.sort===k)IS.dir*=-1;else{IS.sort=k;IS.dir=-1}IP.page=0;renderIngr()}

function openAddIngr(){
  $('mi-title').textContent='Nuevo ingrediente';$('mi-sub').textContent='Agrega al inventario';
  $('mi-code').value='CUSTOM_'+Date.now();
  ['mi-name','mi-brand','mi-prov','mi-notes','mi-cost','mi-wk','mi-min','mi-tc','mi-pqty','mi-punit','mi-conv','mi-convunit'].forEach(function(id){$(id).value='';});
  $('mi-unit').value='kg';$('mi-cat').value='IC.010';
  $('conv-hint').textContent='';
  $('mi-del').style.display='none';
  $('m-ingr').classList.add('on');
}
function openEdit(code){
  var i=INGR.find(function(x){return x.code===code}); if(!i) return;
  $('mi-title').textContent='Editar ingrediente';$('mi-sub').textContent=i.name;
  $('mi-code').value=i.code;$('mi-name').value=i.name;$('mi-brand').value=i.brand||'';
  $('mi-prov').value=i.proveedor||'';$('mi-notes').value=i.notes||'';
  $('mi-cost').value=i.cost;$('mi-unit').value=i.unit;$('mi-cat').value=i.category||'IC.010';
  $('mi-wk').value=i.weekly_avg||'';$('mi-min').value=i.stock_min||'';$('mi-tc').value=i.total_cost||'';
  $('mi-pqty').value=i.purchase_qty||'';$('mi-punit').value=i.purchase_unit||'';
  $('mi-conv').value=i.conv_qty||'';$('mi-convunit').value=i.conv_unit||'';
  updateConvHint();
  $('mi-del').style.display='inline-flex';
  $('m-ingr').classList.add('on');
}
function saveIngr(){
  var code=$('mi-code').value;
  var obj={code:code,name:$('mi-name').value.trim(),brand:$('mi-brand').value.trim(),
    proveedor:$('mi-prov').value.trim(),notes:$('mi-notes').value.trim(),
    cost:parseFloat($('mi-cost').value)||0,unit:$('mi-unit').value,
    category:$('mi-cat').value,weekly_avg:parseFloat($('mi-wk').value)||0,
    stock_min:parseFloat($('mi-min').value)||0,
    total_cost:parseFloat($('mi-tc').value)||0,total_used:0,
    purchase_qty:parseFloat($('mi-pqty').value)||0,
    purchase_unit:$('mi-punit').value.trim(),
    conv_qty:parseFloat($('mi-conv').value)||0,
    conv_unit:$('mi-convunit').value.trim()};
  if(!obj.name){alert('Ingresa un nombre.');return}
  var idx=INGR.findIndex(function(x){return x.code===code});
  if(idx>=0) INGR[idx]=obj; else INGR.push(obj);

  localStorage.setItem('app_ingr', JSON.stringify(INGR));
  cm('m-ingr');renderIngr();initDash();syncRecetasCost();
  autoSaveToCloud();
}
function delIngr(){
  if(!confirm('¿Eliminar?')) return;
  INGR=INGR.filter(function(i){return i.code!==$('mi-code').value});
  
  localStorage.setItem('app_ingr', JSON.stringify(INGR));
  cm('m-ingr');renderIngr();initDash();
  autoSaveToCloud();
}

function renderPag(id,total,page,per,cb){
  var pages=Math.max(1,Math.ceil(total/per));
  var st=page*per+1,en=Math.min((page+1)*per,total);
  var h='<span class="pag-info">'+st+'–'+en+' de '+total+'</span><div class="pag-btns">';
  h+='<button class="pag-btn" '+(page===0?'disabled':'')+' onclick="('+cb+')('+Math.max(0,page-1)+')">‹</button>';
  var lo=Math.max(0,page-2),hi=Math.min(pages-1,page+2);
  if(lo>0)h+='<button class="pag-btn" onclick="('+cb+')(0)">1</button>'+(lo>1?'<span style="color:var(--sub);padding:0 3px">…</span>':'');
  for(var p=lo;p<=hi;p++)h+='<button class="pag-btn'+(p===page?' on':'')+'" onclick="('+cb+')('+p+')">'+(p+1)+'</button>';
  if(hi<pages-1)h+=(hi<pages-2?'<span style="color:var(--sub);padding:0 3px">…</span>':'')+'<button class="pag-btn" onclick="('+cb+')('+(pages-1)+')">'+pages+'</button>';
  h+='<button class="pag-btn" '+(page>=pages-1?'disabled':'')+' onclick="('+cb+')('+Math.min(pages-1,page+1)+')">›</button>';
  h+='</div>';
  var el = $(id); if(el) el.innerHTML=h;
}

function parseCSVRow(text, delimiter) {
  var ret = [], val = '', inQ = false;
  for(var i=0; i<text.length; i++) {
    var c = text[i];
    if(c === '"') inQ = !inQ;
    else if(c === delimiter && !inQ) { ret.push(val.replace(/^"|"$/g,'').trim()); val=''; }
    else val += c;
  }
  ret.push(val.replace(/^"|"$/g,'').trim()); 
  return ret;
}

function extractNumFromCell(arr, index) {
  if (!arr || index >= arr.length) return 0;
  var val = arr[index];
  if (val == null) return 0;
  var s = String(val).trim();
  if (s === '' || s === '-') return 0;

  s = s.replace(/[$\s]/g, '').replace(/,/g, '.');
  var parts = s.split('.');
  if (parts.length > 1) {
      var finalNumStr = parts[0];
      for (var i = 1; i < parts.length; i++) {
          var p = parts[i];
          while (p.length < 3) {
              p += '0';
          }
          finalNumStr += p;
      }
      s = finalNumStr;
  }
  var num = parseInt(s, 10);
  return isNaN(num) ? 0 : num;
}

function handleDropImp(e){e.preventDefault();$('dz-imp').classList.remove('drag');var f=e.dataTransfer.files[0];if(f)handleFileImp(f);}

function handleFileImp(file){
  if(!file) return;
  $('imp-st').textContent='Procesando: '+file.name+'...';
  window.importFileName = file.name.toLowerCase(); 
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var text = e.target.result;
      var rows = [];
      if(text.toLowerCase().includes('<tr') || text.toLowerCase().includes('<table')){
        var doc=new DOMParser().parseFromString(text,'text/html');
        doc.querySelectorAll('tr').forEach(function(tr){
          var cells=[];
          tr.querySelectorAll('td,th').forEach(function(td){cells.push(td.textContent.trim());});
          if(cells.some(function(c){return c;})) rows.push(cells);
        });
      } else {
        var tabs = (text.match(/\t/g) || []).length;
        var semis = (text.match(/;/g) || []).length;
        var commas = (text.match(/,/g) || []).length;
        var delimiter = ','; 
        if (tabs > semis && tabs > commas) delimiter = '\t';
        else if (semis > commas && semis > tabs) delimiter = ';';
        var lines = text.split(/\r\n|\n|\r/); 
        lines.forEach(function(l){
          if(l.trim()){
            var cells = parseCSVRow(l, delimiter);
            if(cells.some(function(c){return c;})) rows.push(cells);
          }
        });
      }
      
      if(rows.length<2){$('imp-st').textContent='Archivo vacío.';return;}
      window.toteatRows = rows; 
      importPending = rows; 

      if(typeof importMode !== 'undefined' && importMode === 'inv') {
          $('imp-st').innerHTML='<span style="color:var(--g)">&#10003; Inventario detectado</span>';
          $('imp-act').style.display='flex';
          return;
      }
          
      var findRow = function(keyword) { 
          return rows.findIndex(function(r){ 
              return r.some(function(c){ return String(c).toLowerCase().includes(keyword); }); 
          }); 
      };

      var vIdx = findRow('venta neta');
      if(vIdx === -1) {
          $('imp-st').innerHTML='<span style="color:var(--r)">❌ No se encontró "Venta Neta"</span>';
          $('imp-act').style.display='none';
          return;
      }

      var dayRowIdx = -1;
      for(var r = 0; r < vIdx; r++) {
          var isDayRow = rows[r].some(function(c) {
              var val = String(c).toLowerCase();
              return val.includes('lunes') || val.includes('martes') || val.includes('miércoles') || val.includes('miercoles') || val.includes('jueves') || val.includes('viernes') || val.includes('sábado') || val.includes('sabado') || val.includes('domingo');
          });
          if(isDayRow) { dayRowIdx = r; break; }
      }

      var dayRow = dayRowIdx >= 0 ? rows[dayRowIdx] : [];
      var mNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      var sums = {}; 
      var currentYear = 2025;
      var currentMonthIdx = 0; 
      var prevDayNum = 0;
      
      for (var i = 0; i < dayRow.length; i++) {
          var dCell = String(dayRow[i]).toLowerCase().trim();
          if (!dCell || dCell.includes('total') || dCell.includes('sem')) continue;

          var dayMatch = dCell.match(/\d+/);
          if (!dayMatch) continue; 
          
          var dayNum = parseInt(dayMatch[0]);
          if (dayNum < 1 || dayNum > 31) continue; 

          if (dayNum < prevDayNum - 10) {
              currentMonthIdx++;
              if (currentMonthIdx > 11) { currentMonthIdx = 0; currentYear++; }
          }
          prevDayNum = dayNum;

          var label = mNames[currentMonthIdx] + ' ' + currentYear;
          
          if(!sums[label]) sums[label] = { 
            venta_neta: 0, delivery_ya: 0, delivery_uber: 0, 
            delivery_transferencia: 0, delivery_rappi: 0,
            efectivo: 0, credito: 0, debito: 0, junaeb: 0, 
            ticket: 0, cheque: 0, otros: 0
          };

          sums[label].venta_neta += extractNumFromCell(rows[vIdx], i);

          for (var rowIdx = vIdx + 1; rowIdx < rows.length; rowIdx++) {
              var metodoStr = String(rows[rowIdx][0] || '').trim();
              if (!metodoStr) continue;

              var mLower = metodoStr.toLowerCase();
              if (mLower.includes('total') || mLower.includes('caja') || mLower.includes('propina') || mLower.includes('impuesto') || mLower.includes('venta') || mLower.includes('costo') || mLower.includes('margen') || mLower.includes('descuento') || mLower.includes('bruta') || mLower.includes('%')) {
                  continue;
              }

              var monto = extractNumFromCell(rows[rowIdx], i);
              if (monto === 0) continue; 

              if (mLower.includes('pedidosya') || mLower.includes('pedidos ya') || mLower.includes('voucher') || mLower.includes('cash collection')) sums[label].delivery_ya += monto;
              else if (mLower.includes('uber')) sums[label].delivery_uber += monto;
              else if (mLower.includes('rappi')) sums[label].delivery_rappi += monto;
              else if (mLower.includes('transferencia')) sums[label].delivery_transferencia += monto;
              else if (mLower.includes('efectivo')) sums[label].efectivo += monto;
              else if (mLower.includes('débito') || mLower.includes('debito') || mLower.includes('debit')) sums[label].debito += monto;
              else if (mLower.includes('crédito') || mLower.includes('credito') || mLower.includes('credit')) sums[label].credito += monto;
              else if (mLower.includes('convenio') || mLower.includes('junaeb')) sums[label].junaeb += monto;
              else if (mLower.includes('ticket')) sums[label].otros += monto;
              else if (mLower.includes('cheque')) sums[label].otros += monto;
              else sums[label].otros += monto;
          }
      }

      window.pendingSalesSum = sums;

      $('imp-st').innerHTML='<span style="color:var(--g)">&#10003; Carga exitosa. Totales detectados:</span>';
      
      var prevHtml = '<div style="display:flex;flex-direction:column;gap:12px;margin-top:10px;max-height:350px;overflow-y:auto;padding-right:5px">';
      var hasData = false;
      var fmtPrev = function(v){ return typeof formatMoney==='function'?formatMoney(v):'$'+Math.round(v).toLocaleString('es-CL'); };
      
      for(var k in sums) {
          var d = sums[k];
          var sumaTotal = d.efectivo + d.debito + d.credito + d.junaeb + d.delivery_ya + d.delivery_uber + d.delivery_rappi + d.delivery_transferencia + d.ticket + d.cheque + d.otros;

          if(sumaTotal > 0) { 
              prevHtml += '<div style="padding:14px;background:var(--s2);border:1px solid var(--b2);border-left:4px solid var(--c);border-radius:8px;">'
                        +'<div style="font-weight:800;color:var(--t);margin-bottom:12px;font-size:14px;display:flex;justify-content:space-between;border-bottom:1px solid var(--b);padding-bottom:6px">'
                            +'<span>'+k+'</span>'
                            +'<span style="color:var(--g);font-family:var(--mono)">'+fmtPrev(d.venta_neta)+'</span>'
                        +'</div>'
                        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';

              if (d.efectivo > 0)                 prevHtml += '<div style="font-size:11.5px;color:var(--t)">Efectivo: <strong style="font-family:var(--mono)">'+fmtPrev(d.efectivo)+'</strong></div>';
              if (d.debito > 0)                   prevHtml += '<div style="font-size:11.5px;color:var(--t)">Débito: <strong style="font-family:var(--mono)">'+fmtPrev(d.debito)+'</strong></div>';
              if (d.credito > 0)                  prevHtml += '<div style="font-size:11.5px;color:var(--t)">Crédito: <strong style="font-family:var(--mono)">'+fmtPrev(d.credito)+'</strong></div>';
              if (d.junaeb > 0)                   prevHtml += '<div style="font-size:11.5px;color:var(--t)">Junaeb: <strong style="font-family:var(--mono)">'+fmtPrev(d.junaeb)+'</strong></div>';
              
              if (d.delivery_ya > 0)              prevHtml += '<div style="font-size:11.5px;color:var(--m)">PedidosYa: <strong style="font-family:var(--mono)">'+fmtPrev(d.delivery_ya)+'</strong></div>';
              if (d.delivery_uber > 0)            prevHtml += '<div style="font-size:11.5px;color:var(--c)">Uber Eats: <strong style="font-family:var(--mono)">'+fmtPrev(d.delivery_uber)+'</strong></div>';
              if (d.delivery_rappi > 0)           prevHtml += '<div style="font-size:11.5px;color:#ff6b6b">Rappi: <strong style="font-family:var(--mono)">'+fmtPrev(d.delivery_rappi)+'</strong></div>';
              if (d.delivery_transferencia > 0)   prevHtml += '<div style="font-size:11.5px;color:var(--g)">Transf: <strong style="font-family:var(--mono)">'+fmtPrev(d.delivery_transferencia)+'</strong></div>';

            if (d.otros > 0)                    prevHtml += '<div style="font-size:11.5px;color:var(--sub)">Otros: <strong style="font-family:var(--mono)">'+fmtPrev(d.otros)+'</strong></div>';
              hasData = true;
          }
      }
      prevHtml += '</div>';
      
      if(!hasData) prevHtml = '<div class="notice warn">Archivo vacío.</div>';
      
      $('imp-prev').innerHTML = prevHtml;
      $('imp-act').style.display='flex';

    }catch(err){$('imp-st').textContent='Error crítico: '+err.message;}
  };
  reader.readAsText(file,'UTF-8');
}

function applyImport(){
  if(importMode === 'inv'){
    if(!importPending) return;
    var updated=0, skipped=0;
    importPending.forEach(function(r){
      if(r.length<2) return;
      var name=r[0]; var cost=parseFloat((r[1]||'').replace(/[^0-9.]/g,''))||0;
      var unit=r[2]||''; var wk=parseFloat(r[3])||0;
      var idx=INGR.findIndex(function(i){return i.name.toLowerCase().trim()===name.toLowerCase().trim();});
      if(idx>=0){
        if(cost>0) INGR[idx].cost=cost;
        if(unit) INGR[idx].unit=unit;
        if(wk>0) INGR[idx].weekly_avg=wk;
        updated++;
      } else { skipped++; }
    });
    
    localStorage.setItem('app_ingr', JSON.stringify(INGR));
    if(typeof syncRecetasCost === 'function') syncRecetasCost();

    cm('m-import'); renderIngr(); initDash();
    alert('✓ Inventario actualizado: '+updated+' ingredientes. Costo de recetas sincronizado.');
    importPending = null;
    autoSaveToCloud();
    
  } else {
    if(!window.pendingSalesSum) return;
    
    var sums = window.pendingSalesSum;
    var mNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var updatedCount = 0, createdCount = 0;

    for (var monthLabel in sums) {
        var data = sums[monthLabel];
        var targetMonth = SALES.monthly.find(function(m){ return m.month === monthLabel; });
        
        if (!targetMonth) {
            var pts = monthLabel.split(' ');
            var mIdx = mNames.indexOf(pts[0]);
            var yr = parseInt(pts[1]);
            var daysInMonth = (mIdx>=0 && yr) ? new Date(yr, mIdx+1, 0).getDate() : 30;

            targetMonth = { 
              month: monthLabel, 
              venta_bruta: 0, venta_neta: 0, venta_sin_iva: 0,
              costo: 0, margen_pct: 0,
              days_active: daysInMonth, avg_daily_sin_iva: 0
            };
            SALES.monthly.push(targetMonth);
            createdCount++;
        } else {
            updatedCount++;
        }

        if (data.venta_neta > 0)              targetMonth.venta_neta = data.venta_neta;
        if (data.delivery_ya > 0)             targetMonth.delivery_ya = data.delivery_ya;
        if (data.delivery_uber > 0)           targetMonth.delivery_uber = data.delivery_uber;
        if (data.delivery_rappi > 0)          targetMonth.delivery_rappi = data.delivery_rappi;
        if (data.delivery_transferencia > 0)  targetMonth.delivery_transferencia = data.delivery_transferencia;
        
        if (data.efectivo > 0)                targetMonth.efectivo = data.efectivo;
        if (data.debito > 0)                  targetMonth.debito = data.debito;
        if (data.credito > 0)                 targetMonth.credito = data.credito;
        if (data.junaeb > 0)                  targetMonth.junaeb = data.junaeb;
        
        if (data.otros > 0)                   targetMonth.otros = (targetMonth.otros||0) + data.otros;
        
        targetMonth.venta_sin_iva = Math.round(targetMonth.venta_neta / 1.19);
        if (targetMonth.days_active > 0) {
            targetMonth.avg_daily_sin_iva = Math.round(targetMonth.venta_sin_iva / targetMonth.days_active);
        }
        if (!targetMonth.venta_bruta || targetMonth.venta_bruta === 0) {
            targetMonth.venta_bruta = Math.round(targetMonth.venta_neta * 1.03); 
        }
    }

    SALES.monthly.sort(function(a,b){
      var pa = a.month.split(' '), pb = b.month.split(' ');
      var ya = parseInt(pa[1]), yb = parseInt(pb[1]);
      if (ya !== yb) return ya - yb;
      return mNames.indexOf(pa[0]) - mNames.indexOf(pb[0]);
    });

    localStorage.setItem('app_sales', JSON.stringify(SALES));
    
    if(typeof initDash === 'function') initDash();
    if(typeof initDashSel === 'function') initDashSel();
    if(typeof initMonthSel === 'function') initMonthSel();
    if(typeof renderV === 'function') renderV();
    if(typeof renderFlujoCaja === 'function') renderFlujoCaja(true);

    cm('m-import'); 
    window.pendingSalesSum = null;
    
    alert('✓ Ventas y métodos de pago guardados exitosamente.');
    autoSaveToCloud();
  }
}

// ════ UPLOAD ════
function openUpload(){pendingUpload=null;$('up-st').textContent='';$('up-prev').innerHTML='';$('up-act').style.display='none';$('m-up').classList.add('on')}
function handleDrop(e){e.preventDefault();$('dz').classList.remove('drag');var f=e.dataTransfer.files[0];if(f)handleFile(f)}

function applyUpload(){
  if(!pendingUpload)return;
  var u=0,a=0;
  pendingUpload.forEach(function(p){
    var idx=INGR.findIndex(function(i){return i.code===p.code});
    if(idx>=0){INGR[idx].name=p.name;INGR[idx].brand=p.brand;INGR[idx].cost=p.cost;INGR[idx].unit=p.unit;u++}
    else{INGR.push({code:p.code,name:p.name,brand:p.brand,cost:p.cost,unit:p.unit,category:'IC.010',weekly_avg:0,total_cost:0,total_used:0});a++}
  });
  localStorage.setItem('app_ingr', JSON.stringify(INGR));
  if(typeof syncRecetasCost === 'function') syncRecetasCost();
  pendingUpload=null;cm('m-up');renderIngr();initDash();
  alert('✓ Actualizado: '+u+' existentes, '+a+' nuevos.');
  autoSaveToCloud();
}

// ════ RECETAS ════
var CAT_LABELS={'hamburguesas':'Hamburguesas','pollo':'Pollo','acompañamientos':'Acompañam.','bebidas':'Bebidas','salsas':'Salsas','otros':'Otros'};
var RS={q:'',cost:'',cat:'',sort:'weekly_units',dir:-1};var RP={page:0,per:20};
function getRRows(){
  var r=RECIPES.filter(function(x){return x.cost>0});
  if(RS.q){var q=RS.q.toLowerCase();r=r.filter(function(x){return x.name.toLowerCase().indexOf(q)>=0})}
  if(RS.cost==='lo')r=r.filter(function(x){return x.cost<1500});
  else if(RS.cost==='md')r=r.filter(function(x){return x.cost>=1500&&x.cost<=3000});
  else if(RS.cost==='hi')r=r.filter(function(x){return x.cost>3000});
  if(RS.cat)r=r.filter(function(x){return x.cat===RS.cat});
  var k=RS.sort,d=RS.dir;
  r.sort(function(a,b){var av=a[k]||0,bv=b[k]||0;return typeof av==='string'?d*av.localeCompare(bv):d*(bv-av)});
  return r;
}
function renderRec(){
  var rows=getRRows(),total=rows.length;
  var pages=Math.max(1,Math.ceil(total/RP.per));RP.page=Math.min(RP.page,pages-1);
  var sl=rows.slice(RP.page*RP.per,(RP.page+1)*RP.per);
  var rc = $('r-cnt'); if(rc) rc.textContent=total+' recetas';
  var rb = $('r-body');
  if(rb) {
      rb.innerHTML=sl.map(function(r){
        var wu=r.weekly_units>0?'<span class="tag t-c">'+r.weekly_units+' u/sem</span>':'<span class="tag t-n">\u2014</span>';
        var catLbl=CAT_LABELS[r.cat]||r.cat||'\u2014';
        return '<tr><td><strong>'+r.name+'</strong></td>'
          +'<td class="hide-sm"><span class="tag t-n" style="font-size:10px">'+catLbl+'</span></td>'
          +'<td class="r mono">'+fmt(r.cost)+'</td>'
          +'<td class="r hide-sm">'+wu+'</td>'
          +'<td class="r hide-sm" style="color:var(--sub)">'+r.ingredients.length+'</td>'
          +'<td><button class="btn-tbl" onclick="openRec(\''+r.id+'\')">Editar</button></td></tr>';
      }).join('');
  }
  renderPag('r-pag',total,RP.page,RP.per,function(p){RP.page=p;renderRec()});
}
function filterR(){RS.q=$('rq').value;RS.cost=$('rc').value;RS.cat=$('rcat').value;RP.page=0;renderRec()}
function sR(k){if(RS.sort===k)RS.dir*=-1;else{RS.sort=k;RS.dir=-1}RP.page=0;renderRec()}

// ════ RECETAS — EDITOR ════
var editingRecId=null;

function openRec(id){
  var r=RECIPES.find(function(x){return x.id===id}); if(!r) return;
  editingRecId=id;
  $('mr-t').textContent='Editar receta';
  $('mr-s').textContent=r.weekly_units?'~'+r.weekly_units+' u/sem estimadas · vía '+r.via_ingredient:'';
  $('mr-name').value=r.name;
  renderRecEditor(r.ingredients);
  $('m-rec').classList.add('on');
}

function renderRecEditor(ings){
  var ingNames=INGR.map(function(i){return i.name}).sort();
  var opts=ingNames.map(function(n){return'<option value="'+n+'">'+n+'</option>'}).join('');
  $('mr-ings').innerHTML=ings.map(function(ing,i){
    return '<div class="ing-editor-row" id="ier_'+i+'" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--b)">'
      +'<div style="flex:1;min-width:0">'
      +'<select class="f-inp" style="margin-bottom:0;width:100%;height:36px;font-size:12.5px" '
      +'onchange="recalcRecIng('+i+')" id="ier_n_'+i+'">'
      +'<option value="'+ing.name+'">'+ing.name+'</option>'+opts+'</select>'
      +'</div>'
      +'<input type="number" class="f-inp" style="width:72px;margin-bottom:0;height:36px;text-align:center;font-size:13px" '
      +'id="ier_q_'+i+'" value="'+ing.qty+'" min="0" step="0.1" oninput="recalcRecIng('+i+')" placeholder="Qty">'
      +'<select class="f-inp" style="width:64px;margin-bottom:0;height:36px;font-size:12px" id="ier_u_'+i+'" oninput="recalcRecIng('+i+')">'
      +['g','kg','mL','L','UN','CAN','tbsp','tsp'].map(function(u){return'<option'+(u===ing.unit?' selected':'')+'>'+u+'</option>'}).join('')
      +'</select>'
      +'<span style="font-family:var(--mono);font-size:12px;color:var(--sub);min-width:64px;text-align:right" id="ier_c_'+i+'">'+fmt(ing.cost)+'</span>'
      +'<button onclick="removeRecIng('+i+')" style="width:28px;height:28px;background:none;border:1px solid var(--b2);color:var(--r);border-radius:5px;cursor:pointer;font-size:14px;flex-shrink:0">×</button>'
      +'</div>';
  }).join('');
  updateRecTotal();
}

function recalcRecIng(i){
  var name=document.getElementById('ier_n_'+i);
  var qinp=document.getElementById('ier_q_'+i);
  var uinp=document.getElementById('ier_u_'+i);
  var costel=document.getElementById('ier_c_'+i);
  if(!name||!qinp||!costel) return;
  var ingData=INGR.find(function(x){return x.name===name.value});
  if(!ingData){costel.textContent='—';updateRecTotal();return;}
  var qty=parseFloat(qinp.value)||0;
  var unit=uinp?uinp.value:ingData.unit;
  var costPerUnit=ingData.cost; 
  var qtyInBaseUnit=qty;
  if(ingData.unit==='kg'&&unit==='g') qtyInBaseUnit=qty/1000;
  else if(ingData.unit==='g'&&unit==='kg') qtyInBaseUnit=qty*1000;
  else if(ingData.unit==='L'&&unit==='mL') qtyInBaseUnit=qty/1000;
  else if(ingData.unit==='mL'&&unit==='L') qtyInBaseUnit=qty*1000;
  var lineCost=Math.round(qtyInBaseUnit*costPerUnit);
  costel.textContent=fmt(lineCost);
  updateRecTotal();
}

function updateRecTotal(){
  var total=0;
  document.querySelectorAll('[id^="ier_c_"]').forEach(function(el){
    var v=parseInt(el.textContent.replace(/[^0-9]/g,''))||0;
    total+=v;
  });
  $('mr-total').textContent=fmt(total);
}

function addRecIng(){
  var r=RECIPES.find(function(x){return x.id===editingRecId}); if(!r) return;
  r.ingredients.push({name:'Pan',qty:1,unit:'UN',cost:0});
  renderRecEditor(r.ingredients);
}

function removeRecIng(i){
  var r=RECIPES.find(function(x){return x.id===editingRecId}); if(!r) return;
  r.ingredients.splice(i,1);
  renderRecEditor(r.ingredients);
}

function saveRec(){
  var r=RECIPES.find(function(x){return x.id===editingRecId}); if(!r) return;
  r.name=$('mr-name').value.trim()||r.name;
  var newIngs=[];
  var rows=document.querySelectorAll('[id^="ier_n_"]');
  rows.forEach(function(el,i){
    var name=el.value;
    var qty=parseFloat(document.getElementById('ier_q_'+i).value)||0;
    var unit=document.getElementById('ier_u_'+i).value;
    var costTxt=(document.getElementById('ier_c_'+i).textContent||'0').replace(/[^0-9]/g,'');
    var cost=parseInt(costTxt)||0;
    if(name&&qty>0) newIngs.push({name:name,qty:qty,unit:unit,cost:cost});
  });
  if(!newIngs.length){alert('Agrega al menos un ingrediente.');return;}
  r.ingredients=newIngs;
  r.cost=newIngs.reduce(function(s,ing){return s+ing.cost},0);

  localStorage.setItem('app_rec', JSON.stringify(RECIPES));
  cm('m-rec');
  renderRec();
  initDash();
  alert('✓ Receta guardada.');
  autoSaveToCloud();
}

// ════ PEDIDO ════
var CL={'IC.020':'Carnes','IC.030':'Frutas/Verduras','IC.010':'Abarrotes','IC.060':'Congelados','IC.040':'Bebidas','IC.070':'Descartables'};

function renderPed(){
  var sem=parseInt($('psem').value)||2;
  var cat=$('pcat-sel').value;
  $('p-seml').textContent=sem+' sem.';
  var groups={};Object.keys(CL).forEach(function(k){groups[k]=[]});
  var tc=0,ti=0;
  INGR.filter(function(i){return i.weekly_avg>0}).forEach(function(i){
    if(cat!=='all'&&i.category!==cat)return;
    var q=i.weekly_avg*sem,c=q*i.cost;tc+=c;ti++;
    var safeCode=(i.code||i.name).replace(/[^a-zA-Z0-9]/g,'_');
    if(groups[i.category])groups[i.category].push({name:i.name,brand:i.brand||'',prov:i.proveedor||'',unit:i.unit,wk:i.weekly_avg,qty:q,cost:c,unit_cost:i.cost,smin:i.stock_min||0,pid:'ped_'+safeCode});
  });
  $('p-cost').textContent=fmt(tc);$('p-items').textContent=ti;
  var html='';
  Object.keys(CL).forEach(function(k){
    var its=groups[k];if(!its.length)return;
    its.sort(function(a,b){return b.cost-a.cost});
    var sub=its.reduce(function(s,i){return s+i.cost},0);
    html+='<div class="ped-sec"><div class="ped-hd"><span class="ped-hl">'+CL[k]+'</span>'
      +'<span class="ped-hr"><span style="font-family:var(--mono);font-size:12px;color:var(--sub)">'+fmt(sub)+'</span>'
      +'<span class="tag t-c">'+its.length+'</span></span></div><div class="ped-body">';
    its.forEach(function(i){
      var warn=i.smin>0&&i.qty<i.smin?'<span class="tag t-r" style="margin-left:6px">\u26A0 bajo m\u00EDn.</span>':'';
      var pid=i.pid;
      html+='<div class="ped-row" id="row_'+pid+'">'
        +'<div style="flex:1"><div class="ped-nm">'+i.name+warn+'</div>'
        +'<div class="ped-meta">'+(i.brand||i.unit)+(i.prov?' · '+i.prov:'')+' · proy. '+fmtN(i.qty)+' '+i.unit+'</div></div>'
        +'<div style="display:flex;align-items:center;gap:8px">'
        +'<input type="number" class="ped-inp" id="'+pid+'" step="0.1" min="0" '
        +'value="'+parseFloat(i.qty.toFixed(1))+'" '
        +'data-unit_cost="'+i.unit_cost+'" data-unit="'+i.unit+'" '
        +'oninput="recalcPedRow(\''+pid+'\')" '
        +'style="width:80px;height:40px;text-align:center;font-family:var(--mono);font-size:14px;font-weight:600;color:var(--c);background:var(--s2);border:1px solid var(--b2);border-radius:var(--rad-s);outline:none;padding:0 8px">'
        +'<span style="font-size:12px;color:var(--sub);min-width:24px">'+i.unit+'</span>'
        +'<span class="ped-c" id="cost_'+pid+'" style="min-width:70px;text-align:right">'+fmt(i.unit_cost*i.qty)+'</span>'
        +'</div></div>';
    });
    html+='</div></div>';
  });
  $('p-secs').innerHTML=html||'<div class="empty">Sin datos para esta categoría</div>';
}

function recalcPedRow(pid){
  var inp=document.getElementById(pid);
  if(!inp) return;
  var qty=parseFloat(inp.value)||0;
  var unit_cost=parseFloat(inp.dataset.unit_cost)||0;
  var cel=document.getElementById('cost_'+pid);
  if(cel) cel.textContent=fmt(qty*unit_cost);
  recalcPedTotals();
}

function recalcPedTotals(){
  var total=0,items=0;
  document.querySelectorAll('.ped-inp').forEach(function(inp){
    var qty=parseFloat(inp.value)||0;
    var uc=parseFloat(inp.dataset.unit_cost)||0;
    if(qty>0){total+=qty*uc;items++;}
  });
  $('p-cost').textContent=fmt(total);
  $('p-items').textContent=items;
}

function copyPed(){
  var sem=parseInt($('psem').value)||2;
  var cat=$('pcat-sel').value;
  var lines=['PEDIDO STREET FLAGS — '+sem+' SEMANA(S)','Fecha: '+new Date().toLocaleDateString('es-CL'),''];
  var bycat={};
  document.querySelectorAll('.ped-inp').forEach(function(inp){
    var qty=parseFloat(inp.value)||0; if(qty<=0) return;
    var pid=inp.id;
    var ingArr=INGR.filter(function(i){
      return 'ped_'+(i.code||i.name).replace(/[^a-zA-Z0-9]/g,'_')===pid;
    });
    var ing=ingArr[0]; if(!ing) return;
    var k=ing.category;
    if(!bycat[k]) bycat[k]=[];
    bycat[k].push({name:ing.name,brand:ing.brand||'',prov:ing.proveedor||'',unit:inp.dataset.unit,qty:qty});
  });
  Object.keys(CL).forEach(function(k){
    if(cat!=='all'&&k!==cat) return;
    var its=bycat[k]; if(!its||!its.length) return;
    lines.push(CL[k]);
    its.forEach(function(i){
      lines.push('• '+i.name+(i.brand?' ('+i.brand+')':'')+(i.prov?' ['+i.prov+']':'')+': '+i.qty.toFixed(1)+' '+i.unit);
    });
    lines.push('');
  });
  var txt=lines.join('\n');
  navigator.clipboard.writeText(txt).then(function(){alert('Pedido copiado para WhatsApp.')})
    .catch(function(){var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert('Copiado.')});
}

// ════ CONTEO ════
function renderCnt(){
  var cat=$('c-cat').value;
  var its=INGR.filter(function(i){return i.weekly_avg>0&&(!cat||i.category===cat)}).sort(function(a,b){return a.name.localeCompare(b.name)});
  $('c-grid').innerHTML=its.map(function(i){
    return '<div class="cnt-card"><div style="flex:1;min-width:0"><div class="cnt-nm">'+i.name+'</div>'
      +'<div class="cnt-su">'+(i.brand?i.brand+' · ':'')+fmtN(i.weekly_avg)+' '+i.unit+'/sem</div></div>'
      +'<input class="q-inp" type="number" step="0.1" min="0" placeholder="0" data-n="'+i.name+'" data-u="'+i.unit+'"></div>';
  }).join('');
}
function clearCnt(){document.querySelectorAll('.q-inp').forEach(function(i){i.value=''})}
function exportCnt(){
  var f=$('c-fecha').value||'—',r=$('c-resp').value||'N/A',t=$('c-turno').value||'';
  var its=[];
  document.querySelectorAll('.q-inp').forEach(function(inp){if(inp.value!=='')its.push('• '+inp.dataset.n+': '+inp.value+' '+inp.dataset.u)});
  if(!its.length){alert('Ingresa al menos una cantidad.');return}
  var txt=['CONTEO STREET FLAGS',f+' — '+t,'Resp: '+r,'—————————————'].concat(its).concat(['—————————————','Total: '+its.length+' items']).join('\n');
  navigator.clipboard.writeText(txt).then(function(){alert('Copiado para WhatsApp.')})
    .catch(function(){var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert('Copiado.')});
}

function updateConvHint(){
  var pqty=parseFloat($('mi-pqty').value)||0;
  var punit=$('mi-punit').value.trim();
  var conv=parseFloat($('mi-conv').value)||0;
  var convunit=$('mi-convunit').value.trim();
  var h='';
  if(pqty>0&&punit&&conv>0&&convunit){
    h='1 '+punit+' de '+pqty+' → rinde '+conv+' '+convunit;
  } else if(conv>0&&convunit){
    h='1 unidad rinde '+conv+' '+convunit;
  }
  $('conv-hint').textContent=h;
}

// ════ IMPORT ════
var importMode='inv';
var importPending=null;

function openImport(mode){
  importMode=mode; importPending=null;
  $('imp-st').textContent=''; $('imp-prev').innerHTML=''; $('imp-act').style.display='none';
  if(mode==='inv'){
    $('imp-title').textContent='Importar Inventario';
    $('imp-sub').textContent='Actualiza costo unit., unidad y uso/semana';
    $('imp-format').innerHTML='<strong>Columnas esperadas (con encabezado):</strong><br>'
      +'<code style="font-family:var(--mono);font-size:11px;color:var(--c)">Ingrediente &middot; Costo unit &middot; Unidad &middot; Uso/sem &middot; Cr&iacute;tico</code><br>'
      +'<span style="display:block;margin-top:4px">Separado por tabulaciones. La columna Ingrediente debe coincidir con el nombre exacto.</span>';
  } else {
    $('imp-title').textContent='Importar Ventas por Producto';
    $('imp-sub').textContent='Reemplaza el ranking de productos vendidos';
    $('imp-format').innerHTML='<strong>Columnas esperadas:</strong><br>'
      +'<code style="font-family:var(--mono);font-size:11px;color:var(--c)">Producto &middot; Venta &middot; Cantidad</code><br>'
      +'<span style="display:block;margin-top:4px">Formato de exportaci&oacute;n directa de Toteat. Separado por tabs.</span>';
  }
  $('m-import').classList.add('on');
}

// ════ DELIVERY ════
var delSrc='all'; 

function initDeliveryMesSel(){
  var sel=$('del-mes-sel'); if(!sel) return;
  var html='<option value="all">Todos los meses</option>';
  var months={};
  if(typeof DELIVERY_MONTHLY !== 'undefined') DELIVERY_MONTHLY.forEach(function(m){ months[m.mes]=1; });
  var mNms=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  SALES.monthly.forEach(function(mo){
    var pts=mo.month.split(' '); var mi=mNms.indexOf(pts[0]);
    if(mi>=0) months[pts[1]+'-'+(mi+1<10?'0':'')+(mi+1)]=1;
  });
  Object.keys(months).sort().forEach(function(k){
    var sh=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    var p=k.split('-');
    html+='<option value="'+k+'">'+sh[parseInt(p[1])-1]+' '+p[0]+'</option>';
  });
  sel.innerHTML=html;
}

function setDelSrc(src,el){
  delSrc=src;
  document.querySelectorAll('[id^="del-src-"]').forEach(function(b){b.classList.remove('on')});
  el.classList.add('on');
  initDelivery();
}

function initDelivery(){
  var sel=$('del-mes-sel'); var sv=sel?sel.value:'all';
  var DM=typeof DELIVERY_MONTHLY !== 'undefined' ? (sv==='all'?DELIVERY_MONTHLY:DELIVERY_MONTHLY.filter(function(m){return m.mes===sv;})) : [];
  var hasDM=DM.length>0;
  var total_ya_ped=DM.reduce(function(s,m){return s+m.pedidos;},0);
  var total_ya_vta=DM.reduce(function(s,m){return s+m.ventas;},0);
  var avg_tkt_ya=total_ya_ped>0?Math.round(total_ya_vta/total_ya_ped):0;
  var avg_rej=DM.length?DM.reduce(function(s,m){return s+(m.rechazados/Math.max(m.pedidos,1));},0)/DM.length*100:0;

  var mNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var SM_all=SALES.monthly;
  var SM=(function(){
    if(sv==='all') return SM_all;
    var p2=sv.split('-'); var mName=mNames[parseInt(p2[1])-1]+' '+p2[0];
    return SM_all.filter(function(m){return m.month===mName;});
  })();
  var intern_transf=SM.reduce(function(s,m){return s+(m.delivery_transferencia||0);},0);
  var ya_toteat=SM.reduce(function(s,m){return s+(m.delivery_ya||0);},0);
  var uber_toteat=SM.reduce(function(s,m){return s+(m.delivery_uber||0);},0);
  var local=SM.reduce(function(s,m){return s+Math.max(0,m.venta_neta-(m.delivery_ya||0)-(m.delivery_uber||0)-(m.delivery_transferencia||0));},0);

  var kpis;
  if(delSrc==='ya'){
    if(!hasDM){
      kpis=[
        {l:'Pedidos PedidosYa',v:'—',f:'Sin datos CSV para este mes'},
        {l:'Venta PedidosYa',v:fmtM(ya_toteat),f:'Registrado en Toteat (POS)',m:1},
        {l:'Ticket promedio',v:'—',f:'Sin datos plataforma'},
        {l:'Tasa rechazo',v:'—',f:'Sin datos plataforma',m:1}
      ];
    } else {
      kpis=[
        {l:'Pedidos PedidosYa',v:total_ya_ped.toLocaleString('es-CL'),f:sv==='all'?'Ago 2025–Ene 2026':''},
        {l:'Venta PedidosYa',v:fmtM(total_ya_vta),f:'Datos plataforma',m:1},
        {l:'Ticket promedio',v:'$'+avg_tkt_ya.toLocaleString('es-CL'),f:'Por pedido'},
        {l:'Tasa rechazo',v:avg_rej.toFixed(1)+'%',f:'Prom. mensual',m:1}
      ];
    }
  } else if(delSrc==='intern'){
    kpis=[
      {l:'Delivery interno',v:fmtM(intern_transf),f:'Transferencias Toteat',m:1},
      {l:'Pedidos est.',v:intern_transf>0?Math.round(intern_transf/9500).toLocaleString('es-CL'):'—',f:'~$9.500 ticket prom.'},
      {l:'Local presencial',v:fmtM(local),f:'Efectivo + tarjetas'},
      {l:'Total venta neta',v:fmtM(SM.reduce(function(s,m){return s+m.venta_neta;},0)),f:sv==='all'?'Todo el período':'',m:1}
    ];
  } else if(delSrc==='uber'){
    var vtaTotal=SM.reduce(function(s,m){return s+m.venta_neta;},0);
    var pctUber=vtaTotal>0?(uber_toteat/vtaTotal*100):0;
    kpis=[
      {l:'Venta Uber Eats',v:fmtM(uber_toteat),f:'Registrado en Toteat (POS)',m:1},
      {l:'Participación',v:pctUber.toFixed(1)+'%',f:'Del total de ventas'},
      {l:'Local presencial',v:fmtM(local),f:'Efectivo + tarjetas'},
      {l:'Total venta neta',v:fmtM(vtaTotal),f:sv==='all'?'Todo el período':'',m:1}
    ];
  } else {
    kpis=[
      {l:'PedidosYa',v:fmtM(ya_toteat),f:'Registrado en Toteat'},
      {l:'Uber Eats',v:fmtM(uber_toteat),f:'Registrado en Toteat',m:1},
      {l:'Del. interno (transf)',v:fmtM(intern_transf),f:'Transferencias'},
      {l:'Local presencial',v:fmtM(local),f:'Efectivo + tarjeta',m:1}
    ];
  }

  var kpidel = $('kpi-del');
  if(kpidel){
      kpidel.innerHTML=kpis.map(function(k){
        return '<div class="kpi'+(k.m?' m':'')+'"><div class="kpi-lbl">'+k.l+'</div>'
          +'<div class="kpi-val">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>';
      }).join('');
  }

  var delColor=delSrc==='ya'?'#ff3fa4':delSrc==='intern'?'#a78bfa':delSrc==='uber'?'#00d4ff':'#00e5a0';

  var ch=$('ch-del-mes');
  if(ch){
    if(delSrc==='ya'){
      if(!hasDM&&sv!=='all'){
        lineChart('ch-del-mes',SM.map(function(m){return{l:m.month.split(' ')[0].slice(0,3),v:m.delivery_ya||0};}), delColor,fmtM);
      } else {
        lineChart('ch-del-mes',(sv==='all'?DELIVERY_MONTHLY:DM).map(function(d){
          return{l:mNames[parseInt(d.mes.split('-')[1])-1].slice(0,3)+' '+d.mes.split('-')[0].slice(2),v:d.ventas};
        }),delColor,fmtM);
      }
    } else {
      var smData=SM.map(function(m){
        var v=delSrc==='intern'?(m.delivery_transferencia||0):delSrc==='uber'?(m.delivery_uber||0):((m.delivery_ya||0)+(m.delivery_uber||0)+(m.delivery_transferencia||0));
        return{l:m.month.split(' ')[0].slice(0,3),v:v};
      });
      if(smData.length===1) smData=[{l:'',v:0},smData[0],{l:'',v:0}];
      lineChart('ch-del-mes',smData,delColor,fmtM);
    }
  }

  var ch2=$('ch-del-t');
  var ch2hd=$('del-ch2-title');
  if(ch2){
    var getDelVal=function(m){ return delSrc==='intern'?(m.delivery_transferencia||0):delSrc==='ya'?(m.delivery_ya||0):delSrc==='uber'?(m.delivery_uber||0):m.venta_neta; };
    if(sv==='all'){
      if(ch2hd) ch2hd.textContent='Venta mensual';
      lineChart('ch-del-t', SM.map(function(m){return{l:m.month.split(' ')[0].slice(0,3),v:getDelVal(m)};}), delColor, fmtM);
    } else {
      var p2x=sv.split('-'), mIdx2=parseInt(p2x[1])-1, yrX=parseInt(p2x[0]);
      var prevSM2=SM_all.filter(function(m){return m.month===mNames[mIdx2]+' '+(yrX-1);});
      var curV=delSrc==='ya'?(hasDM?total_ya_vta:ya_toteat):delSrc==='intern'?intern_transf:delSrc==='uber'?uber_toteat:SM.reduce(function(s,m){return s+m.venta_neta;},0);
      var prevV2=prevSM2.length?getDelVal(prevSM2[0]):0;
      if(ch2hd) ch2hd.textContent=mNames[mIdx2]+' '+yrX+' vs '+mNames[mIdx2]+' '+(yrX-1);
      if(prevV2>0 || curV>0){
        barChart('ch-del-t',[
          {l:mNames[mIdx2].slice(0,3)+' '+yrX,v:curV},
          {l:mNames[mIdx2].slice(0,3)+' '+(yrX-1),v:prevV2}
        ],[delColor,'rgba(255,255,255,.1)'],fmtM, 140);
      } else {
        ch2.innerHTML='<div class="empty" style="padding:20px 0;font-size:12px">Sin datos</div>';
      }
    }
  }

  var chDW=$('del-dias-wrap');
  var chD=$('ch-del-dias');
  if(chDW) chDW.style.display=(sv!=='all')?'block':'none';
  if(chD&&sv!=='all'){
    var mNomX=mNames[parseInt(sv.split('-')[1])-1]+' '+sv.split('-')[0];
    var dayRecs=SALES.daily.filter(function(d){return d.month===mNomX;});
    if(dayRecs.length>0){
      var dayVals=dayRecs.map(function(d){
        var v=delSrc==='intern'?(d.delivery_transferencia||d.venta_neta*0.09)
              :delSrc==='ya'?(d.delivery_ya||d.venta_neta*0.20)
              :delSrc==='uber'?(d.delivery_uber||d.venta_neta*0.06)
              :d.venta_neta;
        return{l:d.date.replace(/[^\d]/g,''),v:Math.round(v)||0};
      }).filter(function(d){return d.v>0;});
      
      if(dayVals.length) lineChart('ch-del-dias',dayVals,delColor,fmtM);
    } else {
      if(chD) chD.innerHTML='<div class="empty" style="padding:20px 0;font-size:12px;color:var(--sub)">Sin datos diarios</div>';
    }
  }

  var hm=$('del-heatmap');
  if(hm){
    var totalPedPY=typeof HEATMAP!=='undefined'?HEATMAP.reduce(function(s,h){return s+h.pedidos;},0):0;
    if(!totalPedPY || delSrc==='uber' || delSrc==='intern'){
      hm.innerHTML='<div class="empty">Mapa de calor exclusivo de PedidosYa</div>';
    }
    else{
      var maxPed=Math.max.apply(null,HEATMAP.map(function(h){return h.pedidos;}));
      hm.innerHTML='<div style="margin-bottom:8px;font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.06em">Pedidos PedidosYa por hora (Ago–Ene)</div>'
        +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:4px">'
        +HEATMAP.filter(function(h){return h.pedidos>0;}).map(function(h){
          var pct=maxPed>0?h.pedidos/maxPed:0;
          return '<div style="background:rgba(255,63,164,'+(0.1+pct*0.9).toFixed(2)+');border-radius:6px;padding:6px 4px;text-align:center;cursor:default;transition:transform .12s,box-shadow .12s" onmouseover="this.style.transform=\'scale(1.1)\';this.style.boxShadow=\'0 0 8px rgba(255,63,164,.4)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'" title="'+h.hora+'h: '+h.pedidos+' pedidos">'
            +'<div style="font-size:11px;font-weight:700;color:'+(pct>0.5?'#fff':'var(--t)')+'">'+h.hora+'h</div>'
            +'<div style="font-size:10px;color:'+(pct>0.5?'rgba(255,255,255,.8)':'var(--sub)')+'">'+h.pedidos+'</div>'
            +'</div>';
        }).join('')+'</div>'
        +'<div style="margin-top:10px;font-size:10px;color:var(--sub)">Total: '+totalPedPY.toLocaleString('es-CL')+' pedidos</div>';
    }
  }

  var tp=$('del-top-platos');
  if(tp){
    if (delSrc === 'uber' || delSrc === 'intern') {
        tp.innerHTML='<div class="empty">Datos de platos exclusivos de PedidosYa</div>';
    } else {
        var src2=sv==='all'?(typeof DISHES_6M!=='undefined'?DISHES_6M:[]):(typeof DISHES_RECENT!=='undefined'?DISHES_RECENT:[]);
        var maxQ=src2.length?src2[0].qty:1;
        tp.innerHTML='<div style="margin-bottom:8px;font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase">'+(sv==='all'?'Top platos Ago25–Ene26':'Top platos recientes')+'</div>'
          +src2.slice(0,10).filter(function(d){return d.qty>0;}).map(function(d){
            return mkBar(d.name,d.qty,maxQ,'#ff3fa4',function(v){return v+' un';},160);
          }).join('');
    }
  }
}

// ════ GASTOS FIJOS ════
var GCAT_LABELS={'arriendo':'🏠 Arriendo','servicios':'⚡ Servicios','gas':'🔥 Gas','personal':'👨‍🍳 Personal','marketing':'📣 Marketing','mantencion':'🔨 Mantención','software':'💻 Software','insumos':'🍳 Insumos','otros':'📦 Otros'};
var gTab='resumen';
var gCatFilter='all';
var credUnlocked=false;

function setGTab(tab,el){
  gTab=tab;
  document.querySelectorAll('[id^="gtab-"]').forEach(function(b){b.classList.remove('on');});
  if(el) el.classList.add('on');
  document.querySelectorAll('.gview').forEach(function(v){ v.style.display = 'none'; });
  var activeView = $('gview-'+tab);
  if(activeView) activeView.style.display = 'block';
  
  if(tab==='resumen')   renderGastos();
  if(tab==='historial') renderGHistSel();
  if(tab==='flujo')     renderFlujoCaja();
  if(tab==='alertas')   renderAlertas();
  if(tab==='cred')      {credUnlocked=false;renderCreds();}
}
function setGCatFilter(cat,el){
  gCatFilter=cat;
  document.querySelectorAll('[id^="gcf-"]').forEach(function(b){b.classList.remove('on');});
  if(el) el.classList.add('on');
  renderGastos();
}

function toSem(g){ return g.freq==='semanal'?g.monto:g.freq==='mensual'?g.monto/4.33:g.monto/52; }
function toMes(g){ return g.freq==='mensual'?g.monto:g.freq==='semanal'?g.monto*4.33:g.monto/12; }
function toAno(g){ return g.freq==='anual'?g.monto:g.freq==='semanal'?g.monto*52:g.monto*12; }
function gAvg(g){
  var r=(g.historico||[]).filter(function(h){return !h.proyectado&&!h.proximo;});
  return r.length?r.reduce(function(s,h){return s+h.monto;},0)/r.length:toMes(g);
}

function renderGastos(){
  var filtG=gCatFilter==='all'?GASTOS:GASTOS.filter(function(g){return g.cat===gCatFilter;});
  var tSem=0,tMes=0,tAno=0;
  filtG.forEach(function(g){tSem+=toSem(g);tMes+=toMes(g);tAno+=toAno(g);});
  var avgV=SALES.monthly.length?SALES.monthly.reduce(function(s,m){return s+m.venta_neta;},0)/SALES.monthly.length:1;
  var pct=tMes/avgV*100;
  var kv=$('kpi-gastos'); 
  if(kv) {
      kv.innerHTML=[
        {l:'Total semanal', v:fmt(Math.round(tSem)), f:'Gastos recurrentes'},
        {l:'Total mensual', v:fmt(Math.round(tMes)), f:'Proyectado', m:1},
        {l:'Total anual',   v:fmt(Math.round(tAno)), f:'Proyectado'},
        {l:'% sobre venta', v:pct.toFixed(1)+'%',   f:'vs venta prom. mensual', m:1}
      ].map(function(k){
        return '<div class="kpi'+(k.m?' m':'')+'"><div class="kpi-lbl">'+k.l+'</div>'
          +'<div class="kpi-val">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>';
      }).join('');
  }

  var byCat={};
  GASTOS.forEach(function(g){byCat[g.cat]=(byCat[g.cat]||0)+toMes(g);});
  var cats=Object.keys(byCat).map(function(k){return{l:GCAT_LABELS[k]||k,v:byCat[k]};}).sort(function(a,b){return b.v-a.v;});
  var mx=cats[0]?cats[0].v:1;
  var cgcat=$('ch-gcat'); if(cgcat) cgcat.innerHTML=cats.map(function(c){return mkBar(c.l,c.v,mx,'#ff3fa4',fmt,180);}).join('');

  var gi=$('gasto-impact'); 
  if(gi){
    var ppct=Math.min(pct,100).toFixed(1);
    gi.innerHTML='<div style="margin-bottom:10px;font-size:13px;color:var(--sub)">De cada <strong style="color:var(--t)">$1.000</strong> de venta, <strong style="color:var(--m)">$'+Math.round(pct*10)+'</strong> son gastos fijos</div>'
      +'<div style="background:var(--s3);border-radius:6px;overflow:hidden;height:18px;margin-bottom:6px"><div style="height:100%;background:var(--m);border-radius:6px;width:'+ppct+'%;transition:width .6s"></div></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--sub)"><span>'+pct.toFixed(1)+'%</span><span>Venta prom: '+fmtM(avgV)+'</span></div>';
  }

  var now=new Date();
  var gb=$('g-body'); 
  if(gb) {
      var filteredGastos=gCatFilter==='all'?GASTOS:GASTOS.filter(function(g){return g.cat===gCatFilter;});
      gb.innerHTML=filteredGastos.map(function(g,gi2){
        var badge='';
        if(g.vencimiento){
          var dn=parseInt((g.vencimiento.match(/\d+/)||['0'])[0]);
          if(dn){
            var nxt=new Date(now.getFullYear(),now.getMonth(),dn);
            if(nxt<=now) nxt=new Date(now.getFullYear(),now.getMonth()+1,dn);
            var df=Math.ceil((nxt-now)/86400000);
            if(df<=7) badge='<span style="background:'+(df<=2?'var(--r)':'#ffb020')+';color:#000;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:5px">Vence '+df+'d</span>';
          }
        }
        var prov=(g.prov||'')
          +(g.encargado?'<div style="font-size:10px;color:var(--sub)">'+g.encargado+(g.telefono?' · '+g.telefono:'')+'</div>':'')
          +(g.cliente_num?'<div style="font-size:10px;color:var(--sub)">N°cl: '+g.cliente_num+'</div>':'');
        var venc=g.vencimiento?'<span style="font-size:11px;color:var(--sub)">'+g.vencimiento+'</span>':'';
        if(g.previred_usuario) venc='<span style="font-size:10px;color:var(--sub)">día 13<br>'+g.previred_usuario+'</span>';
        
        return '<tr>'
          +'<td><strong>'+g.name+'</strong>'+badge+(g.notes?'<div style="font-size:10px;color:var(--sub)">'+g.notes+'</div>':'')+'</td>'
          +'<td class="hide-sm"><span class="tag t-n" style="font-size:10px">'+(GCAT_LABELS[g.cat]||g.cat)+'</span></td>'
          +'<td class="hide-sm" style="font-size:11.5px">'+prov+'</td>'
          +'<td class="r mono">'+fmt(Math.round(toSem(g)))+'</td>'
          +'<td class="r mono hide-xs">'+fmt(Math.round(toMes(g)))+'</td>'
          +'<td class="r mono hide-xs">'+fmt(Math.round(toAno(g)))+'</td>'
          +'<td class="hide-xs">'+venc+'</td>'
          +'<td><button class="btn-tbl" onclick="openEditGastoIdx('+GASTOS.indexOf(g)+')">Editar</button></td>'
          +'</tr>';
      }).join('')||'<tr><td colspan="8" class="empty">Sin gastos</td></tr>';
  }

  var gt=$('g-totrow'); 
  if(gt) gt.innerHTML='Totales &nbsp;→&nbsp; <strong style="color:var(--t)">'+fmt(Math.round(tSem))+'/sem</strong> &nbsp;·&nbsp; <strong style="color:var(--m)">'+fmt(Math.round(tMes))+'/mes</strong> &nbsp;·&nbsp; '+fmt(Math.round(tAno))+'/año';
}

function renderGHistSel(){
  var sel=$('ghist-sel'); if(!sel) return;
  sel.innerHTML=GASTOS.filter(function(g){return g.historico&&g.historico.length;}).map(function(g,i){
    return '<option value="'+GASTOS.indexOf(g)+'">'+g.name+'</option>';
  }).join('');
  if(!sel.options.length) sel.innerHTML=GASTOS.map(function(g,i){return '<option value="'+i+'">'+g.name+'</option>';}).join('');
  renderGHistorial();
}

function renderGHistorial(){
  var sel=$('ghist-sel'); if(!sel) return;
  var idx=parseInt(sel.value)||0;
  var g=GASTOS[idx]; if(!g) return;
  var ght=$('ghist-title'); if(ght) ght.textContent='Historial — '+g.name;
  var hist=(g.historico||[]).slice().sort(function(a,b){return a.mes<b.mes?-1:1;});
  var real=hist.filter(function(h){return !h.proyectado&&!h.proximo;});
  var avg=real.length?real.reduce(function(s,h){return s+h.monto;},0)/real.length:0;
  var minv=real.length?Math.min.apply(null,real.map(function(h){return h.monto;})):0;
  var maxv=real.length?Math.max.apply(null,real.map(function(h){return h.monto;})):0;
  var gkpis=$('ghist-kpis');
  if(gkpis) gkpis.innerHTML=[
    {l:'Promedio',v:fmt(Math.round(avg)),f:real.length+' meses reales'},
    {l:'Mínimo',v:fmt(minv),f:''},
    {l:'Máximo',v:fmt(maxv),f:''}
  ].map(function(k){return '<div class="kpi"><div class="kpi-lbl">'+k.l+'</div><div class="kpi-val">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>';}).join('');
  var cgh=$('ch-ghist');
  if(cgh){
    if(hist.length){
      var maxH=Math.max.apply(null,hist.map(function(h){return h.monto;}));
      cgh.innerHTML=hist.map(function(h){
        var c=h.proximo?'#ffb020':h.proyectado?'rgba(0,212,255,.35)':h.monto>avg*1.4?'#ff4455':'#00d4ff';
        return mkBar(h.label||h.mes,h.monto,maxH,c,fmt,140);
      }).join('');
    } else { cgh.innerHTML='<div class="empty">Sin historial</div>'; }
  }
  var ghb=$('ghist-body');
  if(ghb) ghb.innerHTML=hist.slice().reverse().map(function(h,hi){
    var b=h.proximo?'<span class="tag" style="background:rgba(255,176,32,.15);color:#ffb020;font-size:9px">Próximo</span>'
      :h.proyectado?'<span class="tag t-n" style="font-size:9px">Proyectado</span>'
      :'<span class="tag" style="background:rgba(0,229,160,.1);color:#00e5a0;font-size:9px">Pagado</span>';
    var realIdx=hist.length-1-hi;
    return '<tr><td>'+(h.label||h.mes)+(h.notas?'<div style="font-size:10px;color:var(--sub)">'+h.notas+'</div>':'')+'</td>'
      +'<td class="r mono">'+fmt(h.monto)+'</td><td class="hide-sm">'+b+'</td>'
      +'<td><button class="btn-tbl" onclick="delHist('+idx+','+realIdx+')">✕</button></td></tr>';
  }).join('')||'<tr><td colspan="4" class="empty">Sin pagos</td></tr>';
}

function openAddHist(){
  var sel=$('ghist-sel'); if(!sel) return;
  $('mhp-idx').value=sel.value||0;
  $('mhp-mes').value='';$('mhp-monto').value='';$('mhp-notas').value='';$('mhp-estado').value='pagado';
  $('m-histpago').classList.add('on');
}
function saveHist(){
  var idx=parseInt($('mhp-idx').value);
  var g=GASTOS[idx]; if(!g) return;
  var mes=$('mhp-mes').value, monto=parseFloat($('mhp-monto').value)||0;
  if(!mes||!monto){alert('Completa mes y monto.');return;}
  var mN=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var parts=mes.split('-'); 
  var label=mN[parseInt(parts[1])-1]+' '+parts[0];
  var estado=$('mhp-estado').value;
  if(!g.historico) g.historico=[];
  g.historico=g.historico.filter(function(h){return h.mes!==mes;});
  g.historico.push({mes:mes,label:label,monto:monto,proyectado:estado==='proyectado',proximo:estado==='pendiente',notas:$('mhp-notas').value.trim()});
  g.historico.sort(function(a,b){return a.mes<b.mes?-1:1;});
  
  localStorage.setItem('app_gastos', JSON.stringify(GASTOS));
  cm('m-histpago'); renderGHistorial();
  autoSaveToCloud();
}
function delHist(gIdx,hIdx){
  var g=GASTOS[gIdx]; if(!g||!g.historico) return;
  if(!confirm('¿Eliminar este registro?')) return;
  g.historico.splice(hIdx,1); 
  
  localStorage.setItem('app_gastos', JSON.stringify(GASTOS));
  renderGHistorial();
  autoSaveToCloud();
}

function renderAlertas(){
  var now=new Date(), alerts=[];
  GASTOS.forEach(function(g){
    if(g.vencimiento){
      var dn=parseInt((g.vencimiento.match(/\d+/)||['0'])[0]);
      if(dn){
        var nxt=new Date(now.getFullYear(),now.getMonth(),dn);
        if(nxt<=now) nxt=new Date(now.getFullYear(),now.getMonth()+1,dn);
        var df=Math.ceil((nxt-now)/86400000);
        alerts.push({u:df<=2?'r':df<=7?'m':'c',ico:'📅',
          titulo:g.name+' — vence en '+df+' día'+(df!==1?'s':''),
          desc:(g.prov?g.prov+' — ':'')+g.vencimiento,monto:fmt(Math.round(toMes(g)))});
      }
    }
    if(g.id==='g_gas'&&g.ultima_carga){
      var ult=new Date(g.ultima_carga), prox=new Date(ult);
      prox.setDate(ult.getDate()+7);
      var df2=Math.ceil((prox-now)/86400000);
      alerts.push({u:df2<=0?'r':df2<=2?'m':'c',ico:'🛢️',
        titulo:'Gas — '+(df2<=0?'🚨 Compra pendiente!':'Próxima compra en '+df2+' día'+(df2!==1?'s':'')),
        desc:'Llamar a Héctor: '+g.telefono+' (Abastible) — 2 cilindros',monto:fmt(g.monto)});
    }
    if(g.id==='g_imposiciones'){
      var d13=new Date(now.getFullYear(),now.getMonth(),13);
      if(d13<=now) d13=new Date(now.getFullYear(),now.getMonth()+1,13);
      var df3=Math.ceil((d13-now)/86400000);
      alerts.push({u:df3<=2?'r':df3<=7?'m':'c',ico:'💳',
        titulo:'Previred — en '+df3+' día'+(df3!==1?'s':''),
        desc:'Día 13 en previred.com — usuario: '+g.previred_usuario,monto:'Variable'});
    }
  });
  alerts.sort(function(a,b){return ({r:0,m:1,c:2}[a.u])-({r:0,m:1,c:2}[b.u]);});
  var col={r:'#ff4455',m:'#ffb020',c:'#00d4ff'};
  var ab=$('alertas-body'); if(!ab) return;
  ab.innerHTML=alerts.map(function(a){
    var c=col[a.u];
    return '<div style="background:var(--s2);border:1px solid var(--b);border-left:3px solid '+c+';border-radius:8px;padding:14px 16px;display:flex;gap:14px;align-items:flex-start">'
      +'<div style="font-size:22px;flex-shrink:0">'+a.ico+'</div>'
      +'<div style="flex:1"><div style="font-weight:700;color:'+c+';font-size:13px;margin-bottom:4px">'+a.titulo+'</div>'
      +'<div style="font-size:12px;color:var(--sub);margin-bottom:6px">'+a.desc+'</div>'
      +'<span style="font-family:var(--mono);font-size:12px;color:var(--t)">Monto: '+a.monto+'</span></div></div>';
  }).join('')||'<div style="color:var(--sub);padding:20px;font-size:13px">✅ Sin alertas urgentes</div>';
}

function renderCreds(){
  var cb=$('cred-body'); if(!cb) return;
  if(!credUnlocked){
    cb.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px 20px;text-align:center">'
      +'<div style="font-size:40px">🔒</div>'
      +'<div style="font-weight:700;font-size:15px">Acceso protegido</div>'
      +'<div style="font-size:12px;color:var(--sub)">Ingresa la clave para continuar</div>'
      +'<div style="display:flex;gap:8px">'
      +'<input type="password" id="cred-pw" class="f-inp" placeholder="Clave..." style="width:150px;margin:0">'
      +'<button class="btn btn-c btn-sm" onclick="checkCredPw()">Entrar</button>'
      +'</div>'
      +'<div id="cred-pw-err" style="font-size:11px;color:var(--r);min-height:14px"></div>'
      +'</div>';
    setTimeout(function(){var p=$('cred-pw');if(p)p.focus();},100);
    return;
  }
  cb.innerHTML=CREDENCIALES.map(function(c,ci){
    return '<div style="background:var(--s2);border:1px solid var(--b);border-radius:8px;padding:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      +'<strong style="font-size:13px">'+c.sistema+'</strong>'
      +'<button class="btn-tbl" onclick="openEditCred('+ci+')">Editar</button></div>'
      +(c.url?'<a href="'+c.url+'" target="_blank" style="display:block;font-size:10px;color:var(--c);margin-bottom:8px">'+c.url+'</a>':'')
      +'<div style="display:flex;flex-direction:column;gap:6px">'
      +'<div style="display:flex;gap:8px;align-items:center"><span style="font-size:10px;color:var(--sub);min-width:55px">Usuario</span>'
      +'<code style="font-family:var(--mono);font-size:11px;background:var(--s3);padding:2px 7px;border-radius:4px;flex:1;word-break:break-all">'+c.usuario+'</code>'
      +'<button class="btn-tbl" onclick="cpTxt(\''+c.usuario+'\')" title="Copiar">⧉</button></div>'
      +'<div style="display:flex;gap:8px;align-items:center"><span style="font-size:10px;color:var(--sub);min-width:55px">Clave</span>'
      +'<code style="font-family:var(--mono);font-size:11px;background:var(--s3);padding:2px 7px;border-radius:4px;flex:1;word-break:break-all">'+c.password+'</code>'
      +'<button class="btn-tbl" onclick="cpTxt(\''+c.password+'\')" title="Copiar">⧉</button></div>'
      +(c.notes?'<div style="font-size:10.5px;color:var(--sub);margin-top:4px">'+c.notes+'</div>':'')
      +'</div></div>';
  }).join('')||'<div class="empty">Sin credenciales</div>';
}

function showDayTip(el,ev){
  var tip=$('day-tooltip'); if(!tip) return;
  var v=parseFloat(el.getAttribute('data-v')), l=el.getAttribute('data-l');
  var allV=Object.values(DAY_PATTERNS); var total=allV.reduce(function(s,x){return s+x;},0);
  $('dtt-label').textContent=l;
  $('dtt-val').textContent=fmtM(v)+' prom.';
  $('dtt-pct').textContent=total>0?(v/total*100).toFixed(1)+'% del total semanal':'';
  tip.style.display='block';
  tip.style.left=(ev.clientX+12)+'px';
  tip.style.top=(ev.clientY-40)+'px';
}
function hideDayTip(){
  var tip=$('day-tooltip'); if(tip) tip.style.display='none';
}
function checkCredPw(){
  var pw=$('cred-pw'); if(!pw) return;
  if(pw.value==='2026'){credUnlocked=true;renderCreds();}
  else{var e=$('cred-pw-err');if(e)e.textContent='Clave incorrecta';pw.value='';pw.focus();}
}
function cpTxt(t){
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){toast('✓ Copiado');});
}
function toast(msg){
  var el=document.createElement('div');
  el.innerHTML=msg;
  el.style.cssText='position:fixed;bottom:24px;right:24px;background:#00e5a0;color:#000;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:700;z-index:9999;transition:opacity .5s';
  document.body.appendChild(el);
  setTimeout(function(){el.style.opacity='0';setTimeout(function(){el.remove();},500);},1800);
}
function openAddCred(){
  $('mcred-title').textContent='Nueva credencial';$('mcred-idx').value='-1';
  ['mcred-sistema','mcred-url','mcred-user','mcred-pass','mcred-notes'].forEach(function(id){$(id).value='';});
  $('mcred-del').style.display='none';$('m-cred').classList.add('on');
}
function openEditCred(ci){
  var c=CREDENCIALES[ci]; if(!c) return;
  $('mcred-title').textContent='Editar credencial';$('mcred-idx').value=ci;
  $('mcred-sistema').value=c.sistema||'';$('mcred-url').value=c.url||'';
  $('mcred-user').value=c.usuario||'';$('mcred-pass').value=c.password||'';
  $('mcred-notes').value=c.notes||'';
  $('mcred-del').style.display='inline-flex';$('m-cred').classList.add('on');
}
function saveCred(){
  var ci=parseInt($('mcred-idx').value);
  var obj={sistema:$('mcred-sistema').value.trim(),url:$('mcred-url').value.trim(),
    usuario:$('mcred-user').value.trim(),password:$('mcred-pass').value.trim(),notes:$('mcred-notes').value.trim()};
  if(ci>=0) CREDENCIALES[ci]=obj; else CREDENCIALES.push(obj);
  cm('m-cred'); renderCreds();
}
function delCred(){
  var ci=parseInt($('mcred-idx').value);
  if(!confirm('¿Eliminar?')) return;
  CREDENCIALES.splice(ci,1); cm('m-cred'); renderCreds();
}

function recalcGastoHint(){
  var m=parseFloat($('mg-monto').value)||0, f=$('mg-freq').value;
  if(!m){$('gasto-hint').textContent='';return;}
  var s=f==='semanal'?m:f==='mensual'?m/4.33:m/52;
  var mo=f==='mensual'?m:f==='semanal'?m*4.33:m/12;
  var a=f==='anual'?m:f==='semanal'?m*52:m*12;
  $('gasto-hint').textContent='= '+fmt(Math.round(s))+'/sem · '+fmt(Math.round(mo))+'/mes · '+fmt(Math.round(a))+'/año';
}
function openAddGasto(){
  $('mg-title').textContent='Nuevo gasto';$('mg-sub').textContent='';
  $('mg-id').value='g_'+Date.now();
  ['mg-name','mg-monto','mg-prov','mg-notes'].forEach(function(id){$(id).value='';});
  $('mg-cat').value='servicios';$('mg-freq').value='mensual';
  $('mg-del').style.display='none';$('gasto-hint').textContent='';$('m-gasto').classList.add('on');
}
function openEditGastoIdx(i){openEditGasto(GASTOS[i]&&GASTOS[i].id);}
function openEditGasto(id){
  var g=GASTOS.find(function(x){return x.id===id;}); if(!g) return;
  $('mg-title').textContent='Editar';$('mg-sub').textContent=g.name;
  $('mg-id').value=g.id;$('mg-name').value=g.name;$('mg-cat').value=g.cat;
  $('mg-freq').value=g.freq;$('mg-monto').value=g.monto;
  $('mg-prov').value=g.prov||'';$('mg-notes').value=g.notes||'';
  $('mg-del').style.display='inline-flex';recalcGastoHint();$('m-gasto').classList.add('on');
}

function saveGasto(){
  var id=$('mg-id').value, name=$('mg-name').value.trim();
  if(!name){alert('Ingresa un nombre.');return;}
  var obj={id:id,name:name,cat:$('mg-cat').value,freq:$('mg-freq').value,
    monto:parseFloat($('mg-monto').value)||0,prov:$('mg-prov').value.trim(),notes:$('mg-notes').value.trim(),historico:[]};
  var i=GASTOS.findIndex(function(x){return x.id===id;});
  if(i>=0){obj.historico=GASTOS[i].historico||[];GASTOS[i]=obj;}else GASTOS.push(obj);
  
  localStorage.setItem('app_gastos', JSON.stringify(GASTOS));
  cm('m-gasto'); renderGastos();
  autoSaveToCloud();
}
function delGasto(){
  var id=$('mg-id').value;
  if(!confirm('¿Eliminar este gasto?')) return;
  GASTOS=GASTOS.filter(function(g){return g.id!==id;}); 
  
  localStorage.setItem('app_gastos', JSON.stringify(GASTOS));
  cm('m-gasto'); renderGastos();
  autoSaveToCloud();
}

// ════ OBJETIVOS SEMANALES ════
var OBJ_KEY = 'sf_objetivos';
var OBJETIVOS = (function(){
  try {
    var s = localStorage.getItem(OBJ_KEY);
    return s ? JSON.parse(s) : {};
  } catch(e) { return {}; }
})();

function saveObjetivos(){ 
    try{ localStorage.setItem(OBJ_KEY,JSON.stringify(OBJETIVOS)); } catch(e){} 
    autoSaveToCloud();
}

function iconSVG(name){
  var ic={
    'export':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    'plus':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    'x':'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };
  return '<span style="display:inline-flex;align-items:center;margin-right:4px;vertical-align:middle;opacity:.9">'+(ic[name]||'')+'</span>';
}

function updateObj(wk,k,v){ if(!OBJETIVOS[wk]) OBJETIVOS[wk]={}; OBJETIVOS[wk][k]=v; saveObjetivos(); }
function deleteObj(wk,k){ if(OBJETIVOS[wk]) delete OBJETIVOS[wk][k]; saveObjetivos(); renderObjetivos(); }
function addCustomObj(){
  var lbl=prompt('Nombre del objetivo:'); if(!lbl||!lbl.trim()) return;
  var val=parseFloat(prompt('Valor objetivo ($):')||'0');
  var now=new Date(); var ws=new Date(now); ws.setDate(now.getDate()-now.getDay()+1);
  var wk=ws.toISOString().slice(0,10);
  var k='custom_'+Date.now();
  if(!OBJETIVOS[wk]) OBJETIVOS[wk]={};
  OBJETIVOS[wk][k]={label:lbl.trim(),target:val||0,custom:true};
  saveObjetivos(); renderObjetivos();
}

function renderObjetivos(){
  var now=new Date();
  var ws=new Date(now); ws.setDate(now.getDate()-now.getDay()+1);
  var wk=ws.toISOString().slice(0,10);
  var saved=OBJETIVOS[wk]||{};
  var D=SALES.daily, thisMo=SALES.monthly.slice(-1)[0];
  var dailyAvg=thisMo?thisMo.avg_daily:1000000;
  var last7=D.slice(-7);
  var weekActual=last7.reduce(function(s,d){return s+d.venta_neta;},0);
  var gastosSem=GASTOS.reduce(function(s,g){return s+toSem(g);},0);
  var ob=$('obj-body'); if(!ob) return;

  var defaults={
    venta:{label:'Venta neta semana',target:Math.round(dailyAvg*7/100000)*100000,actual:weekActual,inverse:false},
    pedidosya:{label:'PedidosYa semana',target:0,actual:0,inverse:false},
    local:{label:'Venta local semana',target:0,actual:0,inverse:false},
    gastos:{label:'Gastos semanales',target:Math.round(gastosSem),actual:gastosSem,inverse:true},
  };

  function pct(a,t,inv){ var p=t>0?a/t*100:0; return inv?Math.max(0,200-p):Math.min(p,100); }
  function clr(p){ return p>=100?'#00e5a0':p>=70?'#ffb020':'#ff4455'; }

  var items=[];
  Object.keys(defaults).forEach(function(k){
    var def=defaults[k];
    var target=saved[k]!==undefined?(typeof saved[k]==='object'?saved[k].target:saved[k]):def.target;
    items.push({k:k,label:def.label,target:target,actual:def.actual,inverse:def.inverse,custom:false});
  });
  Object.keys(saved).forEach(function(k){
    if(k.indexOf('custom_')===0&&saved[k]&&saved[k].custom){
      items.push({k:k,label:saved[k].label,target:saved[k].target||0,actual:0,inverse:false,custom:true});
    }
  });

  var weekLabel=ws.toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'});

  ob.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">'
    +'<div style="font-size:12px;color:var(--sub)">Semana del '+weekLabel+'</div>'
    +'<button onclick="addCustomObj()" style="display:flex;align-items:center;gap:6px;background:var(--m);color:#000;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer">'
    +iconSVG('plus')+'Agregar objetivo</button>'
    +'</div>'
    +'<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr))">'
    +items.map(function(it){
      var p=pct(it.actual,it.target,it.inverse);
      var c=clr(p);
      var pLabel=it.target>0?p.toFixed(0)+'%':'—';
      var showBar=it.target>0;
      var barW=Math.min(p,100);
      return '<div style="background:var(--s2);border:1px solid var(--b);border-radius:12px;padding:16px;position:relative">'
        +(it.custom?'<button onclick="deleteObj(\''+wk+'\',\''+it.k+'\')" style="position:absolute;top:10px;right:10px;background:none;border:none;color:var(--sub);cursor:pointer;padding:2px;line-height:1">'+iconSVG('x')+'</button>':'')
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'
          +'<span style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.05em;padding-right:24px">'+it.label+'</span>'
          +'<span style="font-size:13px;font-weight:800;color:'+c+';flex-shrink:0">'+pLabel+'</span>'
        +'</div>'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px">'
          +'<div>'
            +'<div style="font-size:22px;font-weight:700;color:var(--t);font-family:var(--mono)">'+(it.actual>0?fmt(it.actual):'—')+'</div>'
            +'<div style="font-size:10px;color:var(--sub);margin-top:1px">real</div>'
          +'</div>'
          +'<div style="text-align:right">'
            +'<div style="font-size:14px;font-weight:600;color:var(--sub);font-family:var(--mono)">'+(it.target>0?fmt(it.target):'sin meta')+'</div>'
            +'<div style="font-size:10px;color:var(--sub)">objetivo</div>'
          +'</div>'
        +'</div>'
        +(showBar?'<div style="background:var(--s3);border-radius:4px;height:5px;margin-bottom:10px"><div style="height:5px;border-radius:4px;background:'+c+';width:'+barW.toFixed(1)+'%;transition:width .6s ease"></div></div>':'<div style="height:15px"></div>')
        +'<div style="display:flex;align-items:center;gap:8px">'
          +'<label style="font-size:10px;color:var(--sub);white-space:nowrap">Meta:</label>'
          +'<input type="number" value="'+(it.target||'')+'" placeholder="0" style="flex:1;min-width:0;background:var(--s3);border:1px solid var(--b);border-radius:6px;padding:5px 8px;color:var(--t);font-size:12px;font-family:var(--mono)" oninput="updateObj(\''+wk+'\',\''+it.k+'\',+this.value);this.parentElement.parentElement.querySelector(\'span:last-of-type\').textContent=+this.value>0?(Math.min('+it.actual+'/+this.value*100,100)|0)+\'%\':\'—\'">'
        +'</div>'
      +'</div>';
    }).join('')
    +'</div>';
}

// ════ EXPORT MODAL ════
function openExport(){
  var sel=$('exp-mes');
  if(sel&&sel.options.length<=1){
    SALES.monthly.forEach(function(mo){
      var opt=document.createElement('option');
      opt.value=mo.month; opt.textContent=mo.month;
      sel.appendChild(opt);
    });
  }
  var m=$('m-export'); if(m) m.classList.add('on');
}
function exportSection(){
  var sec=$('exp-section').value;
  var fmt2=$('exp-fmt').value;
  var mo=$('exp-mes').value;
  if(fmt2==='print') exportPrint(sec,mo);
  else if(fmt2==='excel') exportExcel(sec,mo);
}

function exportPrint(sec,mo){
  var M=SALES.monthly;
  var sm=mo==='all'?M:M.filter(function(m){return m.month===mo;});
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Street Flags — Export</title>'
    +'<style>body{font-family:system-ui,sans-serif;color:#111;padding:30px;max-width:900px;margin:0 auto} table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px} th{background:#111;color:#fff;padding:8px;text-align:left} td{padding:8px;border-bottom:1px solid #ddd} .r{text-align:right} @media print{body{padding:0}}</style></head><body>'
    +'<h1>Street Flags Reporte</h1><h2>Fecha: '+new Date().toLocaleDateString('es-CL')+'</h2>';

  if(sec==='ventas'||sec==='all'){
    var tvn=sm.reduce(function(s,m){return s+m.venta_neta;},0);
    html+='<h3>Ventas</h3><table><thead><tr><th>Mes</th><th>Venta neta</th><th>Sin IVA</th><th>PedidosYa</th><th>Del. interno</th></tr></thead><tbody>'
      +sm.map(function(m){return '<tr><td>'+m.month+'</td><td class="r">'+fmtM(m.venta_neta)+'</td><td class="r">'+fmtM(m.venta_neta/1.19)+'</td><td class="r">'+fmtM(m.delivery_ya||0)+'</td><td class="r">'+fmtM(m.delivery_transferencia||0)+'</td></tr>';}).join('')
      +'<tr style="font-weight:700;background:#f5f5f5"><td>TOTAL</td><td class="r">'+fmtM(tvn)+'</td><td class="r">'+fmtM(tvn/1.19)+'</td><td class="r">—</td><td class="r">—</td></tr></tbody></table>';
  }
  if(sec==='gastos'||sec==='all'){
    html+='<h3>Gastos Fijos</h3><table><thead><tr><th>Gasto</th><th>Categoría</th><th>Frecuencia</th><th>Monto/mes</th></tr></thead><tbody>'
      +GASTOS.map(function(g){return '<tr><td>'+g.name+'</td><td>'+g.cat+'</td><td>'+g.freq+'</td><td class="r">'+fmt(Math.round(toMes(g)))+'</td></tr>';}).join('')+'</tbody></table>';
  }
  if(sec==='inventario'||sec==='all'){
    html+='<h3>Inventario</h3><table><thead><tr><th>Ingrediente</th><th>Categoría</th><th>Costo Unit.</th><th>Uso/Sem</th></tr></thead><tbody>'
      +INGR.map(function(i){return '<tr><td>'+i.name+'</td><td>'+i.category+'</td><td class="r">'+fmt(i.cost)+'</td><td class="r">'+i.weekly_avg+' '+i.unit+'</td></tr>';}).join('')+'</tbody></table>';
  }
  if(sec==='recetas'||sec==='all'){
    html+='<h3>Recetas</h3><table><thead><tr><th>Receta</th><th>Categoría</th><th>Costo Total</th></tr></thead><tbody>'
      +RECIPES.map(function(r){return '<tr><td>'+r.name+'</td><td>'+r.cat+'</td><td class="r">'+fmt(r.cost)+'</td></tr>';}).join('')+'</tbody></table>';
  }
  html+='</body></html>';
  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();setTimeout(function(){w.print();},500);}
  cm('m-export');
}

function exportExcel(sec,mo){
  var M=SALES.monthly;
  var sm=mo==='all'?M:M.filter(function(m){return m.month===mo;});
  var rows=[];
  
  if(sec==='ventas'||sec==='all'){
    rows.push(['VENTAS','','','','','','','','']);
    rows.push(['Mes','Venta neta','Sin IVA','Margen %','Días activos','PedidosYa','Uber Eats','Del. interno','Local']);
    sm.forEach(function(m){
      var dy=m.delivery_ya||0, du=m.delivery_uber||0, dt=m.delivery_transferencia||0;
      rows.push([m.month, m.venta_neta, Math.round(m.venta_neta/1.19), m.margen_pct, m.days_active, dy, du, dt, Math.max(0,m.venta_neta-dy-du-dt)]);
    });
    rows.push([]);
  }
  if(sec==='gastos'||sec==='all'){
    rows.push(['GASTOS FIJOS','','','','','']);
    rows.push(['Nombre','Categoría','Proveedor','Frecuencia','Monto/mes','Monto/año']);
    GASTOS.forEach(function(g){ rows.push([g.name, g.cat, g.prov||'', g.freq, Math.round(toMes(g)), Math.round(toAno(g))]); });
    rows.push([]);
  }
  if(sec==='inventario'||sec==='all'){
    rows.push(['INVENTARIO','','','','']);
    rows.push(['Código','Nombre','Categoría','Costo','Uso Semanal']);
    INGR.forEach(function(i){ rows.push([i.code, i.name, i.category, i.cost, i.weekly_avg]); });
    rows.push([]);
  }
  if(sec==='recetas'||sec==='all'){
    rows.push(['RECETAS','','','']);
    rows.push(['ID','Nombre','Categoría','Costo Insumos']);
    RECIPES.forEach(function(r){ rows.push([r.id, r.name, r.cat, r.cost]); });
  }

  var csv=rows.map(function(r){return r.map(function(c){return '"'+String(c||'').replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download='StreetFlags_Export.csv';
  a.click(); URL.revokeObjectURL(url);
  cm('m-export');
}

function exportGastosPDF(){
  var now=new Date();
  var dateStr=now.toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'});
  var G=GASTOS;
  var byCat={};
  G.forEach(function(g){ (byCat[g.cat]=byCat[g.cat]||[]).push(g); });
  var tMes=G.reduce(function(s,g){return s+toMes(g);},0);
  var tAno=G.reduce(function(s,g){return s+toAno(g);},0);
  var avgV=SALES.monthly.length?SALES.monthly.reduce(function(s,m){return s+m.venta_neta;},0)/SALES.monthly.length:1;

  var rows=G.map(function(g){
    return '<tr>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #1e1e2a;font-size:11px;color:#e0e0e8;font-weight:600">'+g.name+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #1e1e2a;font-size:10px;color:#888">'+(GCAT_LABELS[g.cat]||g.cat)+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #1e1e2a;font-size:11px;color:#888">'+g.freq+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #1e1e2a;font-size:11px;color:#aaa;text-align:right;font-family:monospace">'+fmt(Math.round(toMes(g)))+'/mes</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #1e1e2a;font-size:11px;color:#555;text-align:right;font-family:monospace">'+fmt(Math.round(toAno(g)))+'/año</td>'
      +'</tr>';
  }).join('');

  var catBlocks=Object.keys(byCat).map(function(cat){
    var items=byCat[cat];
    var catTotal=items.reduce(function(s,g){return s+toMes(g);},0);
    return '<div style="margin-bottom:18px">'
      +'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#00d4ff;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #1e1e2a">'+(GCAT_LABELS[cat]||cat)+' — '+fmt(Math.round(catTotal))+'/mes</div>'
      +items.map(function(g){
        return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #141420;font-size:11px">'
          +'<span style="color:#ccc">'+g.name+'</span>'
          +'<span style="color:#e0e0e8;font-family:monospace;font-weight:700">'+fmt(Math.round(toMes(g)))+'/mes</span>'
          +'</div>';
      }).join('')
      +'</div>';
  }).join('');

  var pct=(tMes/avgV*100).toFixed(1);
  var html2='<!DOCTYPE html><html><head><meta charset="UTF-8">'
    +'<title>Reporte de Gastos — Street Flags</title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0d0d0f;color:#e8e8ec;padding:40px}@media print{body{background:#fff;color:#000}.card{background:#fff!important;border:1px solid #ddd!important}.kpi-v{color:#000!important}.kpi-l{color:#555!important}}</style>'
    +'</head><body style="max-width:800px;margin:0 auto">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #1e1e2a">'
    +'<div><div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-.3px">Street Flags</div>'
    +'<div style="font-size:13px;color:#555;margin-top:3px">Reporte de Gastos Fijos</div></div>'
    +'<div style="text-align:right"><div style="font-size:12px;color:#555">'+dateStr+'</div>'
    +'<div style="font-size:11px;color:#333;margin-top:2px">'+G.length+' gastos registrados</div></div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">'
    +[
      {l:'Total mensual',v:fmt(Math.round(tMes)),c:'#00d4ff'},
      {l:'Total anual',v:fmt(Math.round(tAno)),c:'#00e5a0'},
      {l:'% sobre venta prom.',v:pct+'%',c:'#ffb420'},
      {l:'N° de gastos',v:G.length,c:'#a78bfa'}
    ].map(function(k){
      return '<div style="background:#16161a;border:1px solid #222;border-radius:10px;padding:16px">'
        +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-bottom:8px">'+k.l+'</div>'
        +'<div style="font-size:20px;font-weight:800;color:'+k.c+';font-family:monospace">'+k.v+'</div>'
        +'</div>';
    }).join('')
    +'</div>'
    +'<div style="background:#16161a;border:1px solid #222;border-radius:10px;padding:20px;margin-bottom:20px">'
    +'<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#555;margin-bottom:16px">Desglose por categoría</div>'
    +catBlocks+'</div>'
    +'<div style="background:#16161a;border:1px solid #222;border-radius:10px;padding:20px">'
    +'<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#555;margin-bottom:14px">Detalle completo</div>'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr>'
    +'<th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#444;border-bottom:1px solid #222">Gasto</th>'
    +'<th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#444;border-bottom:1px solid #222">Categoría</th>'
    +'<th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#444;border-bottom:1px solid #222">Freq.</th>'
    +'<th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#444;border-bottom:1px solid #222">Mensual</th>'
    +'<th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#444;border-bottom:1px solid #222">Anual</th>'
    +'</tr></thead><tbody>'+rows+'</tbody>'
    +'<tfoot><tr>'
    +'<td colspan="3" style="padding:10px 10px;font-weight:800;color:#fff;border-top:1px solid #333;font-size:12px">TOTAL</td>'
    +'<td style="padding:10px;text-align:right;font-family:monospace;font-weight:800;color:#00d4ff;border-top:1px solid #333;font-size:13px">'+fmt(Math.round(tMes))+'/mes</td>'
    +'<td style="padding:10px;text-align:right;font-family:monospace;color:#555;border-top:1px solid #333;font-size:12px">'+fmt(Math.round(tAno))+'/año</td>'
    +'</tr></tfoot>'
    +'</table></div>'
    +'<div style="margin-top:24px;text-align:center;font-size:10px;color:#2a2a36">Street Flags BI · '+dateStr+'</div>'
    +'</body></html>';

  var w=window.open('','_blank','width=900,height=700');
  w.document.write(html2);
  w.document.close();
  setTimeout(function(){w.print();},400);
}

const REGLAS_PROVEEDORES = {
  "HECTOR SALAS": "Gas",
  "AGUAS DEL ALTIPLANO": "Agua",
  "CGE": "Electricidad",
  "TRANSBANK": "Ingreso Web",
  "PEDIDOSYA": "Ingreso Delivery"
};

function formatMoney(n) { return '$' + Math.round(n).toLocaleString('es-CL'); }

function handleBankFile(input) {
  var file = input.files[0]; if(!file) return;
  var reader = new FileReader();
  
  reader.onload = function(e) {
    var text = e.target.result;
    var lines = text.split(/\r?\n/).filter(function(x){return x.trim();});
    var year = new Date().getFullYear();
    var pMatch = text.match(/Período.*?(\d{4})/i) || text.match(/20\d{2}/); 
    if(pMatch) year = pMatch[1] || pMatch[0];
    
    var delimiter = text.indexOf(';') >= 0 ? ';' : ',';
    var txs = [];
    lines.forEach(function(l) {
      var p = parseCSVRow(l, delimiter); 
      if(p.length < 6) return;
      var dateStr = p[0].trim();
      if(/^\d{2}\/\d{2}$/.test(dateStr)) {
        var pts = dateStr.split('/'); var isoDate = year + '-' + pts[1] + '-' + pts[0];
        var abono = parseInt(String(p[4]).replace(/[^0-9]/g, '')) || 0;
        var cargo = parseInt(String(p[5]).replace(/[^0-9]/g, '')) || 0;
        var descOriginal = p[3].trim().toUpperCase();
        var etiqueta = "Otros";
        
        for (var clave in REGLAS_PROVEEDORES) {
          if (descOriginal.includes(clave)) {
            etiqueta = REGLAS_PROVEEDORES[clave];
            break;
          }
        }
        if(abono > 0 || cargo > 0) txs.push({ 
          date: isoDate, desc: p[3].trim(), cat: etiqueta, in: abono, out: cargo 
        });
      }
    });
    
    if(txs.length > 0) {
      var existing = JSON.parse(localStorage.getItem('bank_tx') || '[]');
      var all = existing.concat(txs);
      var unique = []; var seen = new Set();
      all.forEach(function(t) {
        var str = t.date + t.desc + t.in + t.out;
        if(!seen.has(str)) { seen.add(str); unique.push(t); }
      });
      unique.sort(function(a,b){return b.date.localeCompare(a.date)});
      localStorage.setItem('bank_tx', JSON.stringify(unique));
      renderFlujoCaja(false);
      autoSaveToCloud();
      alert('✓ ' + txs.length + ' movimientos bancarios procesados con éxito.');
    } else {
      alert('❌ No se detectaron movimientos. Verifica que sea la cartola de Itaú.');
    }
  };
  reader.readAsText(file, 'utf-8');
  input.value = ''; 
}

function filtrarPorProveedor(nombre) {
  var bankData = JSON.parse(localStorage.getItem('bank_tx') || '[]');
  var sel = document.getElementById('flujo-mes-sel');
  var currentMonth = sel ? sel.value : 'all';
  var filtrados = bankData.filter(function(t) {
    var coincideMes = currentMonth === 'all' || t.date.startsWith(currentMonth);
    return coincideMes && t.desc.toUpperCase().includes(nombre.toUpperCase());
  });
  renderTablaFlujo(filtrados, true, nombre);
}

function renderTablaFlujo(data, esFiltroManual, nombreProv) {
  var tbody = document.getElementById('flujo-body');
  if(!tbody) return;

  var rows = data.map(function(t){
    var reglasMemoria = JSON.parse(localStorage.getItem('reglas_prov') || '{}');
    var catAprendida = reglasMemoria[t.desc.toUpperCase()];
    if(!catAprendida) {
       for(var clave in REGLAS_PROVEEDORES) {
          if(t.desc.toUpperCase().includes(clave)) catAprendida = REGLAS_PROVEEDORES[clave];
       }
    }
    var categoriaFinal = (t.cat && t.cat !== "Otros") ? t.cat : (catAprendida || null);
    var statusIcon = categoriaFinal
      ? '<span style="color:var(--g); margin-right:8px; font-size:12px;">●</span>' 
      : '<span style="color:var(--sub2); margin-right:8px; font-size:12px;">○</span>';

    var catBadge = categoriaFinal ? '<br><span style="font-size:9.5px;color:var(--m);text-transform:uppercase;font-weight:700;">['+categoriaFinal+']</span>' : '';

    return '<tr>'
      +'<td><span style="font-size:11px;color:var(--sub)">'+t.date+'</span></td>'
      +'<td style="text-align:left;font-weight:600;color:var(--t);cursor:pointer;transition:color 0.2s" onmouseover="this.style.color=\'var(--c)\'" onmouseout="this.style.color=\'var(--t)\'" onclick="asociarProveedor(\''+t.desc+'\')" title="Clic para categorizar">'
      + statusIcon + t.desc + catBadge +'</td>'
      +'<td class="r mono" style="color:#00e5a0;font-weight:700">'+(t.in>0 ? formatMoney(t.in) : '—')+'</td>'
      +'<td class="r mono" style="color:#ff4455;font-weight:700">'+(t.out>0 ? formatMoney(t.out) : '—')+'</td>'
      +'</tr>';
  }).join('');

  if(esFiltroManual) {
    tbody.innerHTML = '<tr><td colspan="4" style="background:rgba(0,212,255,0.05);padding:10px;text-align:center;font-size:12px">'
      +'Mostrando movimientos de: <strong>'+nombreProv+'</strong> '
      +'<button onclick="renderFlujoCaja(true)" style="background:none;border:none;color:var(--m);cursor:pointer;text-decoration:underline;margin-left:10px">Ver todos</button></td></tr>' + rows;
  } else {
    tbody.innerHTML = rows;
  }
}

// ── AUTO-GUARDADO SILENCIOSO ──
function autoSaveToCloud() {
  var dataToSave = {};
  for(var i=0; i<localStorage.length; i++){
    var key = localStorage.key(i);
    if(key.startsWith('firebase') || /[.#$\[\]\/]/.test(key)) continue;
    dataToSave[key] = localStorage.getItem(key);
  }
  if(typeof db !== 'undefined' && db.ref) {
      db.ref('respaldo_principal').set(dataToSave).catch(function(e) {
        console.error("Error en autoSaveToCloud:", e);
      });
  }
}

// ════ INIT CLOUD FIRST INTELIGENTE ════
var cf = $('c-fecha');
if(cf) cf.value=new Date().toISOString().split('T')[0];

if(typeof db !== 'undefined' && db.ref) {
    console.log("Conectando con la nube...");
    db.ref('respaldo_principal').once('value').then(function(snapshot) {
      var data = snapshot.val();
      if (data) {
        try { 
            if (data['app_sales'] && data['app_sales'].length > 10) { 
                var pSales = JSON.parse(data['app_sales']);
                if(pSales.monthly && pSales.monthly.length > 0) { SALES = pSales; localStorage.setItem('app_sales', data['app_sales']); }
            } 
        } catch(e) {}
        try { 
            if (data['app_ingr'] && data['app_ingr'].length > 10) { 
                var pIngr = JSON.parse(data['app_ingr']);
                if(pIngr.length > 0) { INGR = pIngr; localStorage.setItem('app_ingr', data['app_ingr']); }
            } 
        } catch(e) {}
        try { 
            if (data['app_rec'] && data['app_rec'].length > 10) { 
                var pRec = JSON.parse(data['app_rec']);
                if(pRec.length > 0) { RECIPES = pRec; localStorage.setItem('app_rec', data['app_rec']); }
            } 
        } catch(e) {}
        try { 
            if (data['app_gastos'] && data['app_gastos'].length > 10) { 
                var pGastos = JSON.parse(data['app_gastos']);
                if(pGastos.length > 0) { GASTOS = pGastos; localStorage.setItem('app_gastos', data['app_gastos']); }
            } 
        } catch(e) {}
      }
      renderAppSeguro();
    }).catch(function(e) {
      console.error("Error Firebase:", e);
      renderAppSeguro();
    });
} else {
    renderAppSeguro();
}

function renderAppSeguro() {
   try { initDashSel(); initDash(); } catch(e) { console.error("Error Dash", e); }
   try { initMonthSel(); renderV(); } catch(e) { console.error("Error Ventas", e); }
   try { initAnalisis(); } catch(e) { console.error("Error Analisis", e); }
   try { initDeliveryMesSel(); } catch(e) { console.error("Error Delivery", e); }
   try { renderIngr(); } catch(e) { console.error("Error Insumos", e); }
   try { renderRec(); } catch(e) { console.error("Error Recetas", e); }
   try { renderCnt(); } catch(e) { console.error("Error Conteo", e); }
   try { renderGastos(); } catch(e) { console.error("Error Gastos", e); }
}
