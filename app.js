// ─── RUNTIME SEGURO (data.js SIEMPRE MANDA) ───
function safeParseData(localKey, fallback) {
    try {
        var l = localStorage.getItem(localKey);
        if (l && l !== 'undefined' && l !== 'null') {
            var p = JSON.parse(l);
            if (p && (Array.isArray(p) ? p.length > 0 : Object.keys(p).length > 0)) return p;
        }
    } catch(e) {}
    return fallback;
}

var INGR = safeParseData('app_ingr', typeof INGR_RAW !== 'undefined' ? JSON.parse(JSON.stringify(INGR_RAW)) : []);
var GASTOS = safeParseData('app_gastos', typeof GASTOS_INIT !== 'undefined' ? JSON.parse(JSON.stringify(GASTOS_INIT)) : []);
var CREDENCIALES = safeParseData('app_cred', typeof CRED_INIT !== 'undefined' ? JSON.parse(JSON.stringify(CRED_INIT)) : []);
var RECIPES = safeParseData('app_rec', typeof RECIPES_RAW !== 'undefined' ? JSON.parse(JSON.stringify(RECIPES_RAW)) : []);
var SALES = typeof SALES !== 'undefined' ? SALES : { monthly:[], daily:[] };

try {
    var localSales = localStorage.getItem('app_sales');
    if (localSales) { var pSales = JSON.parse(localSales); if (pSales.monthly && pSales.monthly.length > 0) SALES = pSales; }
} catch(e) {}

var pendingUpload = null;

// ─── HELPERS ───
var $ = function(id){ return document.getElementById(id); };
var fmt  = function(n){ return '$'+Math.round(Math.abs(n)).toLocaleString('es-CL'); };
var fmtN = function(n,d){ d=d||1; return(+Math.abs(n).toFixed(d)).toLocaleString('es-CL'); };
var fmtM = function(n){ return '$'+(Math.abs(n)/1e6).toFixed(2)+'M'; };

// ─── THEME ───
var theme='dark';
function toggleTheme(){
  theme=theme==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',theme);
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
  
  if(id==='dash') initDash();
  if(id==='ventas') renderV();
  if(id==='analisis') initAnalisis();
  if(id==='delivery'){initDeliveryMesSel();initDelivery();}
  if(id==='stock') renderIngr();
  if(id==='ped'){ setStockTab('ped'); renderPed(); }
  if(id==='cnt'){ setStockTab('cnt'); renderCnt(); }
  if(id==='rec') renderRec();
  if(id==='gastos') renderGastos();
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
  var M=SALES.monthly || [];
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
  var M=SALES.monthly || [];
  var sm=sv==='all'?M:M.filter(function(m){return m.month===sv});
  if(!sm.length) sm=M;
  
  var tvn=sm.reduce(function(s,m){return s+(m.venta_neta||0)},0);
  var tco=INGR.reduce(function(s,i){return s+(i.total_cost||0)},0);
  var amg=sm.length ? sm.reduce(function(s,m){return s+(m.margen_pct||0)},0)/sm.length : 0;
  var pk=sm.length ? sm.slice().sort(function(a,b){return (b.venta_neta||0)-(a.venta_neta||0)})[0] : {month:'-', days_active:0, venta_neta:0};
  var lbl=sv==='all'?'Ene 25–Feb 26':sv;
  
  var kpiD = $('kpi-dash');
  if(kpiD) {
      kpiD.innerHTML=[
        {l:'Venta neta (c/IVA)',v:fmtM(tvn),                       f:lbl},
        {l:'Base imponible',   v:fmtM(Math.round(tvn/1.19)),       f:'Sin IVA real · '+lbl, m:1},
        {l:sv==='all'?'Mejor mes':'Días activos', v:sv==='all'?(pk.month||'').split(' ')[0]:(pk.days_active||0)+'d', f:sv==='all'?fmtM(pk.venta_neta||0):''},
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
        lineChart('ch-vn',sm.map(function(m){return{l:(m.month||'').split(' ')[0].slice(0,3),v:m.venta_sin_iva||(Math.round((m.venta_neta||0)/1.19))};}), '#00d4ff', fmtM);
      } else {
        if(cardHd) cardHd.textContent='Venta diaria — '+sv;
        var sd=(SALES.daily||[]).filter(function(d){return d.month===sv && d.venta_neta>0;});
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
  
  if (typeof PRODUCT_SALES !== 'undefined') {
      var topDishes=PRODUCT_SALES.filter(function(p){return p.weekly_qty>0&&p.venta>0&&!p.is_modifier})
        .map(function(p){return{l:p.name,v:Math.round(p.weekly_qty*monthRatio*4.33)};})
        .sort(function(a,b){return b.v-a.v;}).slice(0,8);
      setTimeout(function(){
        barChart('ch-pv',topDishes,['#00e5a0','#00d4ff','#ff3fa4','#ffb020','#a78bfa'],function(v){return v+'u';}, 160);
      },80);
  }
  
  var topRec=RECIPES.filter(function(r){return (r.cost||0)>200&&(r.cost||0)<9000;}).sort(function(a,b){return b.cost-a.cost;}).slice(0,8).map(function(r){return{l:r.name,v:r.cost};});
  barChart('ch-rc',topRec, '#00d4ff', fmt, 160);
}

// ════ VENTAS ════
var aM='all';
var vCanal='all'; 

function initMonthSel(){
  var M=SALES.monthly || [];
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
function setVCanal(val,el){ vCanal=val; document.querySelectorAll('[id^="vch-"]').forEach(function(b){b.classList.remove('on')}); el.classList.add('on'); renderV(); }

function getVenta(m){
  var dy=(m.delivery_ya||0), du=(m.delivery_uber||0), dt=(m.delivery_transferencia||0);
  var dr=(m.delivery_rappi||0);
  var ef=(m.efectivo||0), cr=(m.credito||0), db=(m.debito||0), ju=(m.junaeb||0);
  var ot=(m.otros||0)+(m.ticket||0)+(m.cheque||0);
  var tarjetas=cr+db;
  var platforms=dy+du+dr;
  var local=Math.max(0, m.venta_neta - platforms - dt);
  
  if(vCanal==='all')       return m.venta_neta||0;
  if(vCanal==='local')     return local;
  if(vCanal==='efectivo')  return ef;
  if(vCanal==='tarjetas')  return tarjetas;
  if(vCanal==='junaeb')    return ju;
  if(vCanal==='intern')    return dt;
  if(vCanal==='ya')        return dy;
  if(vCanal==='uber')      return du;
  if(vCanal==='rappi')     return dr;
  if(vCanal==='otros')     return ot;
  return m.venta_neta||0;
}

function canalLabel(){
  var labels={'all':'Total','local':'Local','efectivo':'Efectivo','tarjetas':'Tarjetas','junaeb':'Junaeb','intern':'Del. interno (transf.)','ya':'PedidosYa','uber':'Uber Eats','rappi':'Rappi','otros':'Otros'};
  return labels[vCanal]||vCanal;
}

function renderV(){
  var M=SALES.monthly||[], D=SALES.daily||[];
  var sm=aM==='all'?M:M.filter(function(m){return m.month===aM;});
  var sd=aM==='all'?D:D.filter(function(d){return d.month===aM;});
  if(!sm.length) sm=M;

  var tvn=sm.reduce(function(s,m){return s+getVenta(m);},0);
  var amg=sm.length ? sm.reduce(function(s,m){return s+(m.margen_pct||0);},0)/sm.length : 0;
  var ad=sd.filter(function(d){return (d.venta_neta||0)>0;});
  var canalRatio=sm.reduce(function(s,m){return s+(m.venta_neta||0);},0);
  var canalTotal=sm.reduce(function(s,m){return s+getVenta(m);},0);
  var ratio=canalRatio>0?canalTotal/canalRatio:1;
  var avgd=ad.length?ad.reduce(function(s,d){return s+(d.venta_neta||0)*ratio;},0)/ad.length:0;
  var lbl=(aM==='all'?'Ene 25–Feb 26':aM)+' · '+canalLabel();

  var totalIntern=sm.reduce(function(s,m){return s+(m.delivery_ya||0)+(m.delivery_uber||0);},0);
  var delPct=canalRatio>0?(totalIntern/canalRatio*100):0;

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
    lineChart('ch-vm', sm.map(function(m){return{l:(m.month||'').split(' ')[0].slice(0,3),v:getVenta(m)};}), '#00d4ff', fmtM);
  }

  var vt2 = $('vt2');
  if(vt2) vt2.textContent=aM==='all'?'Último mes — días':'Días de '+aM;
  var ds=aM==='all'?D.filter(function(d){return d.month===(M[M.length-1]||{}).month;}):sd;
  var vd=ds.filter(function(d){return (d.venta_neta||0)>0;});
  lineChart('ch-vd', vd.map(function(d){
    return {l:(d.date||'').replace(/[^\d]/g,''), v:Math.round((d.venta_neta||0)*ratio)};
  }), '#00e5a0', fmtM);

  if(vCanal==='all'&&sm.length>0){
    var yaT=sm.reduce(function(s,m){return s+(m.delivery_ya||0);},0);
    var ubT=sm.reduce(function(s,m){return s+(m.delivery_uber||0);},0);
    var dtT=sm.reduce(function(s,m){return s+(m.delivery_transferencia||0);},0);
    var locT=sm.reduce(function(s,m){return s+m.venta_neta;},0)-yaT-ubT-dtT;
    var tot=yaT+ubT+dtT+locT;

    var chvd = $('ch-vd');
    if(chvd){
        chvd.innerHTML+='<div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--b)">'
          +'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--sub);margin-bottom:12px">Desglose por canal</div>'
          +[{l:'Local',v:locT,c:'#00d4ff'},{l:'Del. interno',v:dtT,c:'#00e5a0'},{l:'PedidosYa',v:yaT,c:'#ff3fa4'},{l:'Uber Eats',v:ubT,c:'#a78bfa'}]
          .filter(function(x){return x.v>0;})
          .map(function(x){return mkBar(x.l,x.v,tot,x.c,fmtM,120);}).join('')
          +'</div>';
    }
    pieChart('ch-vd-pie',[{l:'Local',v:locT},{l:'Del. interno',v:dtT},{l:'PedidosYa',v:yaT},{l:'Uber Eats',v:ubT}].filter(function(x){return x.v>0;}));
  }
}

// ════ ANÁLISIS INTELIGENTE ════
function initAnalisis(){
  var M = SALES.monthly || [];
  var sel=$('an-mes-sel');
  if(sel&&!sel.options.length){
    sel.innerHTML='<option value="all">Todo el período</option>'
      +M.map(function(m){return '<option value="'+m.month+'">'+m.month+'</option>';}).join('');
    sel.onchange = initAnalisis; 
  }
  var sv=sel?sel.value:'all';
  var totalVenta=M.reduce(function(s,m){return s+(m.venta_neta||0);},0);
  var selMo=sv==='all'?null:M.find(function(m){return m.month===sv;});
  var monthRatio=selMo&&totalVenta>0?(selMo.venta_neta||0)/totalVenta:1;
  var weeksInPeriod=sv==='all'?M.length*4.33:selMo?(selMo.days_active||30)/7:4.33;

  var ctx=$('an-context');
  if(ctx){
    if(selMo) ctx.textContent=selMo.days_active+' días activos · venta '+fmtM(selMo.venta_neta);
    else ctx.textContent=M.length+' meses analizados';
  }

  if ($('ch-vp') && M.length > 0) {
    var activeM = M.filter(function(m){return (m.days_active||0)>0;});
    var targetMonth = sv === 'all' ? activeM[activeM.length-1] : activeM.find(function(m){return m.month === sv;});
    
    if (targetMonth) {
        var targetIdx = activeM.indexOf(targetMonth);
        var histM = activeM.slice(0, targetIdx + 1).slice(-6); 
        var wSum=0, wRate=0;
        var weights=[1,1,2,2,3,3].slice(-histM.length); 
        histM.forEach(function(mo,i){
            var w = weights[i]||1; wSum+=w; wRate+=((mo.venta_neta||0)/(mo.days_active||1))*w;
        });
        var baseRate = wSum>0 ? wRate/wSum : 0;
        
        var trendPct = 0; 
        if(histM.length >= 4) {
            var mid = Math.floor(histM.length/2);
            var h1 = histM.slice(0, mid), h2 = histM.slice(mid);
            var r1 = h1.reduce(function(s,m){return s+((m.venta_neta||0)/(m.days_active||1));},0)/h1.length;
            var r2 = h2.reduce(function(s,m){return s+((m.venta_neta||0)/(m.days_active||1));},0)/h2.length;
            if(r1>0) trendPct = (r2-r1)/r1;
        }

        var mArr=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        var mPts=(targetMonth.month||'').split(' ');
        var mI=mArr.indexOf(mPts[0]); var yr=parseInt(mPts[1]);
        var dim=new Date(yr,mI+1,0).getDate();

        var currentActual=targetMonth.venta_neta||0;
        var currentProj = (targetMonth.days_active||0) >= dim - 2 ? currentActual : Math.round((currentActual / Math.max(1,targetMonth.days_active)) * dim);

        var pctMonth=Math.min(100, Math.round(((targetMonth.days_active||0)/dim)*100));
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

  if (typeof PRODUCT_SALES !== 'undefined') {
      var topD=PRODUCT_SALES.filter(function(p){return (p.weekly_qty||0)>0&&(p.venta||0)>0&&!p.is_modifier})
        .map(function(p){
          var periodQty=sv==='all'?(p.weekly_qty||0):((p.weekly_qty||0)*weeksInPeriod);
          return{name:p.name,cat:p.cat,qty:periodQty,venta:(p.venta||0)*monthRatio,avg_ticket:p.avg_ticket||0};
        }).sort(function(a,b){return b.qty-a.qty}).slice(0,10);
      setTimeout(function(){ barChart('ch-platos', topD.map(function(p){return {l:p.name, v:p.qty}}), '#00d4ff', function(v){return Math.round(v)+'u';}, 160); }, 50);
  }

  if (typeof DAY_PATTERNS !== 'undefined') {
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
  }
}

// ════ INVENTARIO ════
var IS={q:'',cat:'',uso:'',sort:'total_cost',dir:-1};
var IP={page:0,per:20};

function getIRows(){
  var r=INGR.slice();
  if(IS.q){var q=IS.q.toLowerCase();r=r.filter(function(i){return String(i.name||'').toLowerCase().indexOf(q)>=0||String(i.brand||'').toLowerCase().indexOf(q)>=0||String(i.proveedor||'').toLowerCase().indexOf(q)>=0})}
  if(IS.cat) r=r.filter(function(i){return i.category===IS.cat});
  if(IS.uso==='hi') r=r.filter(function(i){return (i.weekly_avg||0)>20});
  else if(IS.uso==='md') r=r.filter(function(i){return (i.weekly_avg||0)>=1&&(i.weekly_avg||0)<=20});
  else if(IS.uso==='lo') r=r.filter(function(i){return (i.weekly_avg||0)<1});
  var k=IS.sort,d=IS.dir;
  r.sort(function(a,b){var av=a[k]||0,bv=b[k]||0;return typeof av==='string'?d*String(av).localeCompare(String(bv)):d*(bv-av)});
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
        var wa=i.weekly_avg||0, cst=i.cost||0, tcst=i.total_cost||0;
        var cr=(wa*2).toFixed(1);
        var lv=wa>20?'r':wa>5?'a':'g';
        var dc=lv==='r'?'#ff4455':lv==='a'?'#ffb020':'#00e5a0';
        var br=i.brand?'<div style="font-size:10.5px;color:var(--sub);margin-top:2px">'+i.brand+(i.proveedor?' · <em>'+i.proveedor+'</em>':'')+'</div>':'';
        return '<tr>'
          +'<td><span class="dot" style="background:'+dc+'"></span><strong>'+(i.name||'—')+'</strong>'+br+'</td>'
          +'<td class="hide-sm" style="color:var(--sub);font-size:12px">'+(i.brand||'—')+'</td>'
          +'<td class="hide-sm" style="color:var(--sub);font-size:12px">'+(i.proveedor||'—')+'</td>'
          +'<td class="r mono">'+fmt(cst)+'</td>'
          +'<td class="hide-xs"><span class="tag t-n">'+(i.unit||'-')+'</span></td>'
          +'<td class="r mono">'+(wa>0?fmtN(wa)+' '+(i.unit||'-'):'<span style="color:var(--sub)">—</span>')+'</td>'
          +'<td class="r mono hide-sm">'+(tcst>0?fmt(tcst):'<span style="color:var(--sub)">—</span>')+'</td>'
          +'<td class="r hide-xs"><span class="tag t-'+lv+'">'+(wa>0?cr+' '+(i.unit||'-'):'—')+'</span></td>'
          +'<td><button class="btn-tbl" onclick="openEdit(\''+(i.code||'')+'\')">Editar</button></td>'
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
  $('mi-code').value=i.code||'';$('mi-name').value=i.name||'';$('mi-brand').value=i.brand||'';
  $('mi-prov').value=i.proveedor||'';$('mi-notes').value=i.notes||'';
  $('mi-cost').value=i.cost||0;$('mi-unit').value=i.unit||'';$('mi-cat').value=i.category||'IC.010';
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
}
function delIngr(){
  if(!confirm('¿Eliminar?')) return;
  INGR=INGR.filter(function(i){return i.code!==$('mi-code').value});
  
  localStorage.setItem('app_ingr', JSON.stringify(INGR));
  cm('m-ingr');renderIngr();initDash();
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

// ─── LECTOR EXCEL TOTEAT / IMPORTACIONES ───
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

  s = s.replace(/[$\s]/g, '');
  if (s.indexOf(',') > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    var dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      s = s.replace(/\./g, '');
    } else if (dotCount === 1) {
      var afterDot = s.split('.')[1];
      if (afterDot && afterDot.length === 3 && /^\d+$/.test(afterDot)) {
        s = s.replace('.', '');
      }
    }
  }
  var num = parseFloat(s);
  return isNaN(num) ? 0 : Math.round(num);
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
          $('imp-st').innerHTML='<span style="color:var(--r)">❌ No se encontró "Venta Neta" en el archivo</span>';
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
            local_efectivo: 0, local_credito: 0, local_debito: 0, 
            local_convenio: 0, local_junaeb: 0, otros: 0
          };

          sums[label].venta_neta += extractNumFromCell(rows[vIdx], i);

          for (var rowIdx = vIdx + 1; rowIdx < rows.length; rowIdx++) {
              var metodoStr = String(rows[rowIdx][0] || '').trim();
              if (!metodoStr || metodoStr === 'Total') continue;

              var monto = extractNumFromCell(rows[rowIdx], i);
              if (monto === 0) continue; 

              var mLower = metodoStr.toLowerCase();

              if (mLower.includes('pedidosya') || mLower.includes('pedidos ya')) {
                  sums[label].delivery_ya += monto;
              } 
              else if (mLower.includes('uber')) {
                  sums[label].delivery_uber += monto;
              } 
              else if (mLower.includes('rappi')) {
                  sums[label].delivery_rappi += monto;
              } 
              else if (mLower.includes('transferencia')) {
                  sums[label].delivery_transferencia += monto;
              } 
              else if (mLower.includes('efectivo')) {
                  sums[label].local_efectivo += monto;
              }
              else if (mLower.includes('crédito') || mLower.includes('credito') || mLower.includes('credit')) {
                  sums[label].local_credito += monto;
              }
              else if (mLower.includes('débito') || mLower.includes('debito') || mLower.includes('debit')) {
                  sums[label].local_debito += monto;
              }
              else if (mLower.includes('convenio')) {
                  sums[label].local_convenio += monto;
              }
              else if (mLower.includes('junaeb')) {
                  sums[label].local_junaeb += monto;
              }
              else {
                  sums[label].otros += monto;
              }
          }
      }

      window.pendingSalesSum = sums;

      $('imp-st').innerHTML='<span style="color:var(--g)">&#10003; Carga exitosa. Totales detectados:</span>';
      
      var prevHtml = '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;max-height:300px;overflow-y:auto;padding-right:5px">';
      var hasData = false;
      var fmtPrev = function(v){ return typeof formatMoney==='function'?formatMoney(v):'$'+Math.round(v).toLocaleString('es-CL'); };
      
      for(var k in sums) {
          var d = sums[k];
          var localTotal = (d.local_efectivo||0) + (d.local_credito||0) + (d.local_debito||0) + (d.local_convenio||0) + (d.local_junaeb||0);
          var sumaTotal = localTotal + (d.delivery_ya||0) + (d.delivery_uber||0) + (d.delivery_transferencia||0) + (d.delivery_rappi||0) + (d.otros||0);

          if(sumaTotal > 0) { 
              prevHtml += '<div style="padding:12px;background:var(--s2);border:1px solid var(--b2);border-left:3px solid var(--c);border-radius:6px;">'
                        +'<div style="font-weight:800;color:var(--t);margin-bottom:8px;font-size:13px;display:flex;justify-content:space-between;">'
                            +'<span>'+k+'</span>'
                            +'<span style="color:var(--g);font-family:var(--mono)">'+fmtPrev(d.venta_neta)+'</span>'
                        +'</div>'
                        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">';

              if (d.delivery_ya > 0)              prevHtml += '<div style="font-size:11px;color:var(--sub)">PedidosYa: <span style="color:var(--m);font-family:var(--mono)">'+fmtPrev(d.delivery_ya)+'</span></div>';
              if (d.delivery_uber > 0)            prevHtml += '<div style="font-size:11px;color:var(--sub)">Uber Eats: <span style="color:var(--c);font-family:var(--mono)">'+fmtPrev(d.delivery_uber)+'</span></div>';
              if (d.delivery_rappi > 0)           prevHtml += '<div style="font-size:11px;color:var(--sub)">Rappi: <span style="color:var(--c);font-family:var(--mono)">'+fmtPrev(d.delivery_rappi)+'</span></div>';
              if (d.delivery_transferencia > 0)   prevHtml += '<div style="font-size:11px;color:var(--sub)">Del. Interno: <span style="color:var(--t);font-family:var(--mono)">'+fmtPrev(d.delivery_transferencia)+'</span></div>';
              if (localTotal > 0)                 prevHtml += '<div style="font-size:11px;color:var(--sub)">Local: <span style="color:var(--t);font-family:var(--mono)">'+fmtPrev(localTotal)+'</span></div>';
              if (d.otros > 0)                    prevHtml += '<div style="font-size:11px;color:var(--sub)">Otros: <span style="color:var(--t);font-family:var(--mono)">'+fmtPrev(d.otros)+'</span></div>';

              if (localTotal > 0) {
                  prevHtml += '<details style="grid-column:1/-1;margin-top:4px"><summary style="font-size:10px;color:var(--sub);cursor:pointer">Detalle local</summary>'
                    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:4px 0">';
                  if(d.local_efectivo>0)  prevHtml += '<div style="font-size:10px;color:var(--sub)">Efectivo: '+fmtPrev(d.local_efectivo)+'</div>';
                  if(d.local_credito>0)   prevHtml += '<div style="font-size:10px;color:var(--sub)">Crédito: '+fmtPrev(d.local_credito)+'</div>';
                  if(d.local_debito>0)    prevHtml += '<div style="font-size:10px;color:var(--sub)">Débito: '+fmtPrev(d.local_debito)+'</div>';
                  if(d.local_convenio>0)  prevHtml += '<div style="font-size:10px;color:var(--sub)">Convenio: '+fmtPrev(d.local_convenio)+'</div>';
                  if(d.local_junaeb>0)    prevHtml += '<div style="font-size:10px;color:var(--sub)">Junaeb: '+fmtPrev(d.local_junaeb)+'</div>';
                  prevHtml += '</div></details>';
              }

              prevHtml += '</div></div>';
              hasData = true;
          }
      }
      prevHtml += '</div>';
      
      if(!hasData) {
          prevHtml = '<div class="notice warn">El archivo parece vacío o sin montos reconocidos. Verifica el formato de exportación de Toteat.</div>';
      }
      
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
      var idx=INGR.findIndex(function(i){return String(i.name||'').toLowerCase().trim()===String(name||'').toLowerCase().trim();});
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
              days_active: daysInMonth, avg_daily_sin_iva: 0,
              delivery_ya: 0, delivery_uber: 0, delivery_transferencia: 0
            };
            SALES.monthly.push(targetMonth);
            createdCount++;
        } else {
            updatedCount++;
        }

        if (data.venta_neta > 0)              targetMonth.venta_neta = data.venta_neta;
        if (data.delivery_ya > 0)             targetMonth.delivery_ya = data.delivery_ya;
        if (data.delivery_uber > 0)           targetMonth.delivery_uber = data.delivery_uber;
        if (data.delivery_transferencia > 0)  targetMonth.delivery_transferencia = data.delivery_transferencia;
        
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
    
    var msg = '✓ Ventas guardadas: ' + updatedCount + ' mes(es) actualizados';
    if (createdCount > 0) msg += ', ' + createdCount + ' mes(es) nuevos creados';
    alert(msg);
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
}

// ════ RECETAS ════
var CAT_LABELS={'hamburguesas':'Hamburguesas','pollo':'Pollo','acompañamientos':'Acompañam.','bebidas':'Bebidas','salsas':'Salsas','otros':'Otros'};
var RS={q:'',cost:'',cat:'',sort:'weekly_units',dir:-1};var RP={page:0,per:20};
function getRRows(){
  var r=RECIPES.filter(function(x){return (x.cost||0)>0});
  if(RS.q){var q=RS.q.toLowerCase();r=r.filter(function(x){return String(x.name||'').toLowerCase().indexOf(q)>=0})}
  if(RS.cost==='lo')r=r.filter(function(x){return (x.cost||0)<1500});
  else if(RS.cost==='md')r=r.filter(function(x){return (x.cost||0)>=1500&&(x.cost||0)<=3000});
  else if(RS.cost==='hi')r=r.filter(function(x){return (x.cost||0)>3000});
  if(RS.cat)r=r.filter(function(x){return x.cat===RS.cat});
  var k=RS.sort,d=RS.dir;
  r.sort(function(a,b){var av=a[k]||0,bv=b[k]||0;return typeof av==='string'?d*String(av).localeCompare(String(bv)):d*(bv-av)});
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
        var wu=(r.weekly_units||0)>0?'<span class="tag t-c">'+r.weekly_units+' u/sem</span>':'<span class="tag t-n">\u2014</span>';
        var catLbl=CAT_LABELS[r.cat]||r.cat||'\u2014';
        return '<tr><td><strong>'+(r.name||'—')+'</strong></td>'
          +'<td class="hide-sm"><span class="tag t-n" style="font-size:10px">'+catLbl+'</span></td>'
          +'<td class="r mono">'+fmt(r.cost||0)+'</td>'
          +'<td class="r hide-sm">'+wu+'</td>'
          +'<td class="r hide-sm" style="color:var(--sub)">'+((r.ingredients||[]).length)+'</td>'
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
  $('mr-name').value=r.name||'';
  renderRecEditor(r.ingredients||[]);
  $('m-rec').classList.add('on');
}

function renderRecEditor(ings){
  var ingNames=INGR.map(function(i){return i.name}).filter(Boolean).sort();
  var opts=ingNames.map(function(n){return'<option value="'+n+'">'+n+'</option>'}).join('');
  $('mr-ings').innerHTML=ings.map(function(ing,i){
    return '<div class="ing-editor-row" id="ier_'+i+'" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--b)">'
      +'<div style="flex:1;min-width:0">'
      +'<select class="f-inp" style="margin-bottom:0;width:100%;height:36px;font-size:12.5px" '
      +'onchange="recalcRecIng('+i+')" id="ier_n_'+i+'">'
      +'<option value="'+(ing.name||'')+'">'+(ing.name||'')+'</option>'+opts+'</select>'
      +'</div>'
      +'<input type="number" class="f-inp" style="width:72px;margin-bottom:0;height:36px;text-align:center;font-size:13px" '
      +'id="ier_q_'+i+'" value="'+(ing.qty||0)+'" min="0" step="0.1" oninput="recalcRecIng('+i+')" placeholder="Qty">'
      +'<select class="f-inp" style="width:64px;margin-bottom:0;height:36px;font-size:12px" id="ier_u_'+i+'" oninput="recalcRecIng('+i+')">'
      +['g','kg','mL','L','UN','CAN','tbsp','tsp'].map(function(u){return'<option'+(u===ing.unit?' selected':'')+'>'+u+'</option>'}).join('')
      +'</select>'
      +'<span style="font-family:var(--mono);font-size:12px;color:var(--sub);min-width:64px;text-align:right" id="ier_c_'+i+'">'+fmt(ing.cost||0)+'</span>'
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
  var costPerUnit=ingData.cost||0; 
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
  var mrl = $('mr-total');
  if(mrl) mrl.textContent=fmt(total);
}

function addRecIng(){
  var r=RECIPES.find(function(x){return x.id===editingRecId}); if(!r) return;
  if(!r.ingredients) r.ingredients=[];
  r.ingredients.push({name:'Pan',qty:1,unit:'UN',cost:0});
  renderRecEditor(r.ingredients);
}

function removeRecIng(i){
  var r=RECIPES.find(function(x){return x.id===editingRecId}); if(!r) return;
  if(r.ingredients) r.ingredients.splice(i,1);
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
  r.cost=newIngs.reduce(function(s,ing){return s+(ing.cost||0)},0);

  localStorage.setItem('app_rec', JSON.stringify(RECIPES));
  cm('m-rec');
  renderRec();
  initDash();
  alert('✓ Receta guardada.');
}

function syncRecetasCost() {
  if (typeof RECIPES === 'undefined' || !RECIPES || typeof INGR === 'undefined') return;
  
  RECIPES.forEach(function(receta) {
    var nuevoCosto = 0;
    if (receta.ingredients && receta.ingredients.length > 0) {
      receta.ingredients.forEach(function(item) {
        var ingDB = INGR.find(function(i) { return i.code === item.code || i.name === item.name; });
        if (ingDB) {
          var costoUnidad = ingDB.cost || 0;
          if (ingDB.conv_qty && ingDB.conv_qty > 0) {
            costoUnidad = (ingDB.cost||0) / ingDB.conv_qty;
          }
          nuevoCosto += (costoUnidad * (item.qty || 0));
        }
      });
    }
    receta.cost = Math.round(nuevoCosto); 
  });
  
  localStorage.setItem('app_rec', JSON.stringify(RECIPES));
  if (typeof renderRec === 'function') renderRec();
}

// ════ PEDIDO Y CONTEO ════
var CL={'IC.020':'Carnes','IC.030':'Frutas/Verduras','IC.010':'Abarrotes','IC.060':'Congelados','IC.040':'Bebidas','IC.070':'Descartables'};

function renderPed(){
  var sem=parseInt($('psem').value)||2;
  var cat=$('pcat-sel').value;
  var psl = $('p-seml'); if(psl) psl.textContent=sem+' sem.';
  var groups={};Object.keys(CL).forEach(function(k){groups[k]=[]});
  var tc=0,ti=0;
  INGR.filter(function(i){return (i.weekly_avg||0)>0}).forEach(function(i){
    if(cat!=='all'&&i.category!==cat)return;
    var q=(i.weekly_avg||0)*sem,c=q*(i.cost||0);tc+=c;ti++;
    var safeCode=(i.code||i.name||'').replace(/[^a-zA-Z0-9]/g,'_');
    if(groups[i.category])groups[i.category].push({name:i.name,brand:i.brand||'',prov:i.proveedor||'',unit:i.unit,wk:i.weekly_avg,qty:q,cost:c,unit_cost:i.cost||0,smin:i.stock_min||0,pid:'ped_'+safeCode});
  });
  var pc = $('p-cost'); if(pc) pc.textContent=fmt(tc);
  var pi = $('p-items'); if(pi) pi.textContent=ti;
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
  var psec = $('p-secs'); if(psec) psec.innerHTML=html||'<div class="empty">Sin datos para esta categoría</div>';
}

function recalcPedRow(pid){
  var inp=document.getElementById(pid); if(!inp) return;
  var qty=parseFloat(inp.value)||0; var unit_cost=parseFloat(inp.dataset.unit_cost)||0;
  var cel=document.getElementById('cost_'+pid);
  if(cel) cel.textContent=fmt(qty*unit_cost);
  recalcPedTotals();
}

function recalcPedTotals(){
  var total=0,items=0;
  document.querySelectorAll('.ped-inp').forEach(function(inp){
    var qty=parseFloat(inp.value)||0; var uc=parseFloat(inp.dataset.unit_cost)||0;
    if(qty>0){total+=qty*uc;items++;}
  });
  var pc = $('p-cost'); if(pc) pc.textContent=fmt(total);
  var pi = $('p-items'); if(pi) pi.textContent=items;
}

function renderCnt(){
  var cat=$('c-cat').value;
  var its=INGR.filter(function(i){return (i.weekly_avg||0)>0&&(!cat||i.category===cat)}).sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''))});
  var cg = $('c-grid');
  if(cg) {
      cg.innerHTML=its.map(function(i){
        return '<div class="cnt-card"><div style="flex:1;min-width:0"><div class="cnt-nm">'+(i.name||'')+'</div>'
          +'<div class="cnt-su">'+(i.brand?i.brand+' · ':'')+fmtN(i.weekly_avg||0)+' '+(i.unit||'')+'/sem</div></div>'
          +'<input class="q-inp" type="number" step="0.1" min="0" placeholder="0" data-n="'+(i.name||'')+'" data-u="'+(i.unit||'')+'"></div>';
      }).join('');
  }
}
function clearCnt(){document.querySelectorAll('.q-inp').forEach(function(i){i.value=''})}

// ════ GASTOS FIJOS ════
var GCAT_LABELS={'arriendo':'🏠 Arriendo','servicios':'⚡ Servicios','gas':'🔥 Gas','personal':'👨‍🍳 Personal','marketing':'📣 Marketing','mantencion':'🔨 Mantención','software':'💻 Software','insumos':'🍳 Insumos','otros':'📦 Otros'};
var gTab='resumen';
var gCatFilter='all';

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

function renderGastos(){
  var filtG=gCatFilter==='all'?GASTOS:GASTOS.filter(function(g){return g.cat===gCatFilter;});
  var tSem=0,tMes=0,tAno=0;
  filtG.forEach(function(g){tSem+=toSem(g)||0;tMes+=toMes(g)||0;tAno+=toAno(g)||0;});
  var avgV=SALES.monthly.length?SALES.monthly.reduce(function(s,m){return s+(m.venta_neta||0);},0)/SALES.monthly.length:1;
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

  var now=new Date();
  var gb=$('g-body'); 
  if(gb) {
      var filteredGastos=gCatFilter==='all'?GASTOS:GASTOS.filter(function(g){return g.cat===gCatFilter;});
      gb.innerHTML=filteredGastos.map(function(g,gi2){
        var badge='';
        if(g.vencimiento){
          var vencStr = String(g.vencimiento||'');
          var dn=parseInt((vencStr.match(/\d+/)||['0'])[0]);
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
        
        return '<tr>'
          +'<td><strong>'+(g.name||'—')+'</strong>'+badge+(g.notes?'<div style="font-size:10px;color:var(--sub)">'+g.notes+'</div>':'')+'</td>'
          +'<td class="hide-sm"><span class="tag t-n" style="font-size:10px">'+(GCAT_LABELS[g.cat]||g.cat)+'</span></td>'
          +'<td class="hide-sm" style="font-size:11.5px">'+prov+'</td>'
          +'<td class="r mono">'+fmt(Math.round(toSem(g)||0))+'</td>'
          +'<td class="r mono hide-xs">'+fmt(Math.round(toMes(g)||0))+'</td>'
          +'<td class="r mono hide-xs">'+fmt(Math.round(toAno(g)||0))+'</td>'
          +'<td class="hide-xs">'+venc+'</td>'
          +'<td><button class="btn-tbl" onclick="openEditGastoIdx('+GASTOS.indexOf(g)+')">Editar</button></td>'
          +'</tr>';
      }).join('')||'<tr><td colspan="8" class="empty">Sin gastos</td></tr>';
  }
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
  $('mg-del').style.display='inline-flex';
  $('m-gasto').classList.add('on');
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
}
function delGasto(){
  var id=$('mg-id').value;
  if(!confirm('¿Eliminar este gasto?')) return;
  GASTOS=GASTOS.filter(function(g){return g.id!==id;}); 
  localStorage.setItem('app_gastos', JSON.stringify(GASTOS));
  cm('m-gasto'); renderGastos();
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
  var hist=(g.historico||[]).slice().sort(function(a,b){return a.mes<b.mes?-1:1;});
  var ghb=$('ghist-body');
  if(ghb) ghb.innerHTML=hist.slice().reverse().map(function(h,hi){
    var realIdx=hist.length-1-hi;
    return '<tr><td>'+(h.label||h.mes)+(h.notas?'<div style="font-size:10px;color:var(--sub)">'+h.notas+'</div>':'')+'</td>'
      +'<td class="r mono">'+fmt(h.monto)+'</td><td class="hide-sm">Pagado</td>'
      +'<td><button class="btn-tbl" onclick="delHist('+idx+','+realIdx+')">✕</button></td></tr>';
  }).join('')||'<tr><td colspan="4" class="empty">Sin pagos</td></tr>';
}
function delHist(gIdx,hIdx){
  var g=GASTOS[gIdx]; if(!g||!g.historico) return;
  if(!confirm('¿Eliminar este registro?')) return;
  g.historico.splice(hIdx,1); 
  localStorage.setItem('app_gastos', JSON.stringify(GASTOS));
  renderGHistorial();
}

// ════ FLUJO DE CAJA ════
var REGLAS_PROVEEDORES = {
  "HECTOR SALAS": "Gas", "AGUAS DEL ALTIPLANO": "Agua", "CGE": "Electricidad",
  "TRANSBANK": "Ingreso Web", "PEDIDOSYA": "Ingreso Delivery"
};

function renderFlujoCaja(isFilterChange){
  var bankData = JSON.parse(localStorage.getItem('bank_tx') || '[]');
  var kpiDiv = document.getElementById('kpi-flujo');
  var sel = document.getElementById('flujo-mes-sel');
  if(!kpiDiv) return;

  if (sel && sel.options.length <= 3) { 
      var mNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      var d = new Date(); var currentYear = d.getFullYear(); var currentMonth = d.getMonth();
      var optionsHtml = '<option value="all">Todos los meses</option>';
      for (var y = currentYear; y >= 2025; y--) {
          var mStart = (y === currentYear) ? currentMonth : 11;
          for (var m = mStart; m >= 0; m--) {
              var val = y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1);
              var label = mNames[m] + ' ' + y;
              optionsHtml += '<option value="' + val + '">' + label + '</option>';
          }
      }
      sel.innerHTML = optionsHtml;
      if (!isFilterChange) {
          var currentVal = currentYear + '-' + (currentMonth + 1 < 10 ? '0' : '') + (currentMonth + 1);
          if (sel.querySelector('option[value="'+currentVal+'"]')) sel.value = currentVal;
      }
  }

  var currentMonth = sel ? sel.value : 'all';
  var filteredBank = currentMonth === 'all' ? bankData : bankData.filter(function(t){ return (t.date||'').startsWith(currentMonth); });

  var tIn = 0, tOut = 0;
  filteredBank.forEach(function(t){ tIn += (t.in||0); tOut += (t.out||0); });

  var totalManual = 0;
  if(typeof GASTOS !== 'undefined') {
      totalManual = GASTOS.reduce(function(s, g) { return s + (toMes(g)||0); }, 0);
  }
  
  var efectivoToteat = 0;
  if (typeof SALES !== 'undefined' && SALES.monthly) {
    if (currentMonth === 'all') {
      efectivoToteat = SALES.monthly.reduce(function(sum, m){ return sum + (m.efectivo || 0);}, 0);
    } else {
      var mArr = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      var pts = currentMonth.split('-');
      if(pts.length === 2) {
          var targetLabel = mArr[parseInt(pts[1]) - 1] + ' ' + pts[0];
          var match = SALES.monthly.find(function(m){ return m.month === targetLabel;});
          if(match) efectivoToteat = match.efectivo || 0;
      }
    }
  }

  var saldoBanco = tIn - tOut;
  var cajaRealFisica = efectivoToteat - totalManual;

  kpiDiv.style.gridTemplateColumns = 'repeat(3, 1fr)'; 
  kpiDiv.innerHTML = [
    {l:'Abonos Banco', v:fmtM(tIn), f:'Total Digital', c:'var(--g)'},
    {l:'Cargos Banco', v:fmtM(tOut), f:'Egresos Digitales', c:'var(--r)'},
    {l:'Saldo Banco', v:fmtM(saldoBanco), f:'Neto Banco', c:saldoBanco>=0?'var(--g)':'var(--r)'},
    {l:'Efectivo Entrante', v:fmtM(efectivoToteat), f:'Ventas Toteat', c:'var(--g)'},
    {l:'Gastos Efectivo', v:fmtM(totalManual), f:'Caja Chica', c:'var(--y)'},
    {l:'Caja Fuerte', v:fmtM(cajaRealFisica), f:'Billetes Reales', c:cajaRealFisica>=0?'var(--m)':'var(--r)'}
  ].map(function(k){ return '<div class="kpi" style="margin-bottom:10px"><div class="kpi-lbl">'+k.l+'</div><div class="kpi-val" style="color:'+k.c+'">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>'; }).join('');

  var tbody = document.getElementById('flujo-body');
  if (!filteredBank.length) {
      if(tbody) tbody.innerHTML = '<tr><td colspan="4" class="empty">No hay datos del banco registrados para esta fecha.</td></tr>';
  } else {
      if(tbody) {
          tbody.innerHTML = filteredBank.map(function(t){
            var statusIcon = '<span style="color:var(--sub2); margin-right:8px; font-size:12px;">○</span>';
            return '<tr>'
              +'<td><span style="font-size:11px;color:var(--sub)">'+t.date+'</span></td>'
              +'<td style="text-align:left;font-weight:600;color:var(--t);">' + statusIcon + (t.desc||'') + '</td>'
              +'<td class="r mono" style="color:#00e5a0;font-weight:700">'+((t.in||0)>0 ? fmt(t.in) : '—')+'</td>'
              +'<td class="r mono" style="color:#ff4455;font-weight:700">'+((t.out||0)>0 ? fmt(t.out) : '—')+'</td>'
              +'</tr>';
          }).join('');
      }
  }
}

// ── INIT ESTRICTAMENTE LOCAL Y MANUAL ──
var cf2 = $('c-fecha');
if(cf2) cf2.value=new Date().toISOString().split('T')[0];

renderAppSeguro();

function renderAppSeguro() {
   if ((!INGR || INGR.length === 0) && typeof INGR_RAW !== 'undefined' && INGR_RAW.length > 0) INGR = JSON.parse(JSON.stringify(INGR_RAW));
   if ((!RECIPES || RECIPES.length === 0) && typeof RECIPES_RAW !== 'undefined' && RECIPES_RAW.length > 0) RECIPES = JSON.parse(JSON.stringify(RECIPES_RAW));
   if ((!GASTOS || GASTOS.length === 0) && typeof GASTOS_INIT !== 'undefined' && GASTOS_INIT.length > 0) GASTOS = JSON.parse(JSON.stringify(GASTOS_INIT));

   try { initDashSel(); initDash(); } catch(e) { console.error("Error Dash", e); }
   try { initMonthSel(); renderV(); } catch(e) { console.error("Error Ventas", e); }
   try { initAnalisis(); } catch(e) { console.error("Error Analisis", e); }
   try { initDeliveryMesSel(); initDelivery(); } catch(e) { console.error("Error Delivery", e); }
   try { renderIngr(); } catch(e) { console.error("Error Insumos", e); }
   try { renderRec(); } catch(e) { console.error("Error Recetas", e); }
   try { renderCnt(); } catch(e) { console.error("Error Conteo", e); }
   try { renderGastos(); } catch(e) { console.error("Error Gastos", e); }
}
