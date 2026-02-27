// Carga automática de ventas desde la memoria
if (localStorage.getItem('app_sales')) {
  SALES = JSON.parse(localStorage.getItem('app_sales'));
}
// ─── RUNTIME ───
var INGR = JSON.parse(JSON.stringify(INGR_RAW));
var GASTOS = JSON.parse(JSON.stringify(GASTOS_INIT));
var CREDENCIALES = JSON.parse(JSON.stringify(CRED_INIT));
var RECIPES = JSON.parse(JSON.stringify(RECIPES_RAW));
var pendingUpload = null;

// ─── HELPERS ───
var $ = function(id){ return document.getElementById(id); };
var fmt  = function(n){ return '$'+Math.round(Math.abs(n)).toLocaleString('es-CL'); };
var fmtN = function(n,d){ d=d||1; return(+Math.abs(n).toFixed(d)).toLocaleString('es-CL'); };
var fmtM = function(n){ return '$'+(Math.abs(n)/1e6).toFixed(2)+'M'; };
var fmtB = function(n){ return '$'+(Math.abs(n)*1.19/1e6).toFixed(2)+'M'; }; // bruto c/IVA

// ─── THEME ───
var theme='dark';
function toggleTheme(){
  theme=theme==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',theme);
  $('tog').textContent=theme==='dark'?'Claro':'Oscuro';
}

// ─── NAV ───
function go(id){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('on')});
  document.querySelectorAll('.nt').forEach(function(t){t.classList.remove('on')});
  $('p-'+id).classList.add('on');
  $('t-'+id).classList.add('on');
  var tab=$('t-'+id); if(tab) tab.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  if(id==='ped') renderPed();
  if(id==='ventas') renderV();
  if(id==='delivery'){initDeliveryMesSel();initDelivery();}
  if(id==='gastos'){renderGastos();}
  if(id==='analisis'){initAnalisis();}
  if(id==='obj'){renderObjetivos();}
}
function cm(id){ $(id).classList.remove('on'); }

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
  $('dash-mes-sel').innerHTML=html;
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
  
  $('kpi-dash').innerHTML=[
    {l:'Venta neta (c/IVA)',v:fmtM(tvn),                       f:lbl},
    {l:'Base imponible',   v:fmtM(Math.round(tvn/1.19)),       f:'Sin IVA real · '+lbl, m:1},
    {l:sv==='all'?'Mejor mes':'Días activos', v:sv==='all'?pk.month.split(' ')[0]:sm[0].days_active+'d', f:sv==='all'?fmtM(pk.venta_neta):''},
    {l:'Margen neto prom.',v:amg.toFixed(1)+'%',               f:'Sin IVA'},
    {l:'Costo insumos',    v:fmtM(tco),                        f:'Histórico acumulado', m:1},
  ].map(function(k){
    return '<div class="kpi'+(k.m?' m':'')+'"><div class="kpi-lbl">'+k.l+'</div>'
      +'<div class="kpi-val">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>';
  }).join('');
  
  var totalVenta=M.reduce(function(s,m){return s+m.venta_neta;},0);
  var monthRatio=totalVenta>0?tvn/totalVenta:1;
  
  // 1. Gráfico Principal (Línea)
  var cardHd=$('ch-vn').previousElementSibling; 
  if(sv==='all'){
    if(cardHd) cardHd.textContent='Venta neta mensual';
    // Abreviamos el mes (Ene, Feb) para que no se amontone el texto
    lineChart('ch-vn',sm.map(function(m){return{l:m.month.split(' ')[0].slice(0,3),v:m.venta_sin_iva||(Math.round(m.venta_neta/1.19))};}), '#00d4ff', fmtM);
  } else {
    if(cardHd) cardHd.textContent='Venta diaria — '+sv;
    // Buscamos los datos diarios del mes específico
    var sd=SALES.daily.filter(function(d){return d.month===sv && d.venta_neta>0;});
    if(sd.length>0){
      lineChart('ch-vn',sd.map(function(d){
         var num=d.date.replace(/[^\d]/g,''); // Sacamos solo el número del día
         return{l:num, v:Math.round(d.venta_neta/1.19)};
      }), '#00d4ff', fmtM);
    } else {
      $('ch-vn').innerHTML='<div class="empty" style="padding:40px 0">Sin datos diarios para este mes</div>';
    }
  }
  
  var ya_t=sm.reduce(function(s,m){return s+(m.delivery_ya||0);},0);
  var ub_t=sm.reduce(function(s,m){return s+(m.delivery_uber||0);},0);
  var tr_t=sm.reduce(function(s,m){return s+(m.delivery_transferencia||0);},0);
  var lc_t=Math.max(0,tvn-ya_t-ub_t-tr_t);
  var canalData=[{l:'Local',v:lc_t},{l:'PedidosYa',v:ya_t},{l:'Del. interno',v:tr_t},{l:'Uber Eats',v:ub_t}].filter(function(x){return x.v>0;});
  setTimeout(function(){pieChart('ch-ci', canalData, 'Canales de venta');},50);
  
  // 2. Gráficos de Ranking pasados a horizontales (texto 100% legible)
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
var vCanal='all'; // all | local | intern | ya | uber

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

// Returns the venta value for a monthly row depending on canal
// Build PedidosYa lookup from DELIVERY_MONTHLY for fallback
var DM_BY_LABEL=(function(){
  var mN=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var map={};
  DELIVERY_MONTHLY.forEach(function(dm){
    var p=dm.mes.split('-');
    var label=mN[parseInt(p[1])-1]+' '+p[0];
    map[label]=dm.ventas;
  });
  return map;
})();

function getVenta(m){
  var dy=(m.delivery_ya||0), du=(m.delivery_uber||0), dt=(m.delivery_transferencia||0);
  var dr=(m.delivery_rappi||0);
  var ef=(m.efectivo||0), cr=(m.credito||0), db=(m.debito||0), ju=(m.junaeb||0);
  var ot=(m.otros||0)+(m.ticket||0)+(m.cheque||0);
  var tarjetas=cr+db;
  var platforms=dy+du+dr;
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

  $('kpi-v').innerHTML=[
    {l:'Venta '+canalLabel(),      v:fmtM(tvn),  f:'Sin IVA · '+lbl},
    {l:'Venta bruta c/IVA',        v:'$'+(tvn*1.19/1e6).toFixed(2)+'M', f:'IVA incluido', m:1},
    {l:'Margen neto',              v:amg.toFixed(1)+'%', f:'Sin IVA'},
    {l:'Delivery interno',         v:fmtM(totalIntern), f:delPct.toFixed(1)+'% del total', m:1},
    {l:'Promedio diario',          v:fmt(avgd), f:ad.length+' días activos'},
  ].map(function(k){
    return '<div class="kpi'+(k.m?' m':'')+'"><div class="kpi-lbl">'+k.l+'</div>'
      +'<div class="kpi-val">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>';
  }).join('');

  // --- GRÁFICO 1: MES VS MES (Horizontal) o LÍNEA (Todos) ---
  $('vt1').textContent=(aM==='all'?'Venta mensual':'Este mes vs Año anterior')+' · '+canalLabel();
  if(aM!=='all'&&sm.length===1){
    var cur=sm[0];
    var ns2=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var pts2=aM.split(' ');var mi2=ns2.indexOf(pts2[0]);
    var prevLbl=mi2>=0?ns2[mi2]+' '+(parseInt(pts2[1])-1):null;
    var prev=prevLbl?M.find(function(x){return x.month===prevLbl;}):null;
    var cdata=[{l:cur.days_active<26?aM+'*':aM,v:getVenta(cur)}];
    if(prev) cdata.push({l:prevLbl,v:getVenta(prev)});
    
    // Gráfico de barras horizontales sutil para comparar 2 elementos (no más contenedores gigantes)
    barChart('ch-vm', cdata, ['#00d4ff','rgba(0,212,255,.25)'], fmtM, 140);
  } else {
    // Si son todos los meses, dibujamos la línea
    lineChart('ch-vm', sm.map(function(m){return{l:m.month.split(' ')[0].slice(0,3),v:getVenta(m)};}), '#00d4ff', fmtM);
  }

  // --- GRÁFICO 2: DÍAS (Convertido a Línea Dinámica) ---
  $('vt2').textContent=aM==='all'?'Último mes — días':'Días de '+aM;
  var ds=aM==='all'?D.filter(function(d){return d.month===M[M.length-1].month;}):sd;
  var vd=ds.filter(function(d){return d.venta_neta>0;});
  
  lineChart('ch-vd', vd.map(function(d){
    return {l:d.date.replace(/[^\d]/g,''), v:Math.round(d.venta_neta*ratio)};
  }), '#00e5a0', fmtM);

  // --- DESGLOSE DE CANALES ---
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

    $('ch-vd').innerHTML+='<div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--b)">'
      +'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--sub);margin-bottom:12px">Desglose por método de pago</div>'
      +barsHtml+'</div>';

    pieChart('ch-vd-pie',items.map(function(x){return{l:x.l,v:x.v};}));
  }
}
    



// ════ ANÁLISIS INTELIGENTE ════
function initAnalisis(){
  var sel=$('an-mes-sel');
  if(sel&&!sel.options.length){
    sel.innerHTML='<option value="all">Todo el período</option>'
      +SALES.monthly.map(function(m){return '<option value="'+m.month+'">'+m.month+'</option>';}).join('');
    // Reparamos el selector para que reaccione al cambio
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

  // --- NUEVO DASHBOARD DE PROGRESO Y PROYECCIÓN ---
  if ($('ch-vp')) {
    var M = SALES.monthly;
    var activeM = M.filter(function(m){return m.days_active>0;});
    // Apuntamos al mes seleccionado, o al último si es "Todos"
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

  // --- PLATOS EN HORIZONTAL ---
  var topD=PRODUCT_SALES.filter(function(p){return p.weekly_qty>0&&p.venta>0&&!p.is_modifier})
    .map(function(p){
      var periodQty=sv==='all'?p.weekly_qty:(p.weekly_qty*weeksInPeriod);
      return{name:p.name,cat:p.cat,qty:periodQty,venta:p.venta*monthRatio,weekly_qty:p.weekly_qty,avg_ticket:p.avg_ticket,weekly_venta:p.weekly_venta};
    }).sort(function(a,b){return b.qty-a.qty}).slice(0,10);
    
  setTimeout(function(){
      barChart('ch-platos', topD.map(function(p){return {l:p.name, v:p.qty}}), '#00d4ff', function(v){return Math.round(v)+'u';}, 160);
  }, 50);

  // --- GRÁFICO PATRÓN DÍAS ---
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
  $('day-chart').innerHTML='<div id="day-tooltip" style="position:fixed;background:var(--s2);border:1px solid var(--b);border-radius:6px;padding:8px 12px;font-size:11px;pointer-events:none;z-index:200;display:none">'
    +'<div id="dtt-label" style="font-weight:700;color:var(--t);margin-bottom:2px"></div>'
    +'<div id="dtt-val" style="color:var(--m);font-family:var(--mono)"></div>'
    +'<div id="dtt-pct" style="font-size:10px;color:var(--sub)"></div></div>'
    +'<div style="display:flex;justify-content:center;width:100%"><svg width="100%" viewBox="0 0 '+dTotalW+' '+dH+'" style="overflow:visible;display:block;max-width:400px">'+dBars+'</svg></div>'
    +'<div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--sub);justify-content:center">'
    +'<span><span style="display:inline-block;width:8px;height:8px;background:#00d4ff;border-radius:2px;margin-right:4px"></span>Semana</span>'
    +'<span><span style="display:inline-block;width:8px;height:8px;background:#ff3fa4;border-radius:2px;margin-right:4px"></span>Fin de semana</span>'
    +'</div>';
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

  // --- DETALLE POR PLATO ---
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
  
  $('insight-cards').innerHTML='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">'
    +'<thead><tr>'
    +'<th style="'+th+'">#</th><th style="'+th+';text-align:left">Plato</th><th style="'+th+';text-align:left">Categoría</th>'
    +'<th style="'+th+';text-align:right">Venta</th><th style="'+th+';text-align:right">Ticket</th>'
    +'<th style="'+th+';text-align:right">Costo</th><th style="'+th+'">Dist.</th>'
    +'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div>';
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
  $('i-cnt').textContent=total+' ingredientes';
  $('i-body').innerHTML=sl.map(function(i){
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
  cm('m-ingr');renderIngr();initDash();syncRecetasCost();
}
function delIngr(){
  if(!confirm('¿Eliminar?')) return;
  INGR=INGR.filter(function(i){return i.code!==$('mi-code').value});
  cm('m-ingr');renderIngr();initDash();
}

// ─── PAGINATION ───
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
  $(id).innerHTML=h;
}



// ─── MOTOR DE LECTURA CSV (DEFINICIÓN ÚNICA — borrar la otra) ───
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

// ─── EXTRACCIÓN NUMÉRICA ROBUSTA (Formato Chileno Anti-Excel) ───
function extractNumFromCell(arr, index) {
  if (!arr || index >= arr.length) return 0;
  var val = arr[index];
  if (val == null) return 0;
  var s = String(val).trim();
  if (s === '' || s === '-') return 0;

  // 1. Quitar símbolos de dinero, espacios y forzar comas gringas a puntos
  s = s.replace(/[$\s]/g, '').replace(/,/g, '.');
  
  var parts = s.split('.');
  if (parts.length > 1) {
      var finalNumStr = parts[0];
      for (var i = 1; i < parts.length; i++) {
          var p = parts[i];
          
          // 🚨 FIX CRÍTICO: Excel/Toteat a veces trata el separador de miles como decimal 
          // y borra los ceros a la derecha. (Ej: 354.000 se vuelve 354.00 o 354.0).
          // En Chile, todo bloque después de un punto DEBE tener 3 números.
          // Si tiene menos, rellenamos con ceros para recuperar el valor real.
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


// ════════════════════════════════════════════════════════════════
// IMPORTACIÓN Y EXTRACCIÓN (MOTOR ANTI-BASURA)
// ════════════════════════════════════════════════════════════════
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

              // 🛡️ ESCUDO ANTI-BASURA TOTEAT
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
  pendingUpload=null;cm('m-up');renderIngr();initDash();
  alert('✓ Actualizado: '+u+' existentes, '+a+' nuevos.');
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
  $('r-cnt').textContent=total+' recetas';
  $('r-body').innerHTML=sl.map(function(r){
    var wu=r.weekly_units>0?'<span class="tag t-c">'+r.weekly_units+' u/sem</span>':'<span class="tag t-n">\u2014</span>';
    var catLbl=CAT_LABELS[r.cat]||r.cat||'\u2014';
    return '<tr><td><strong>'+r.name+'</strong></td>'
      +'<td class="hide-sm"><span class="tag t-n" style="font-size:10px">'+catLbl+'</span></td>'
      +'<td class="r mono">'+fmt(r.cost)+'</td>'
      +'<td class="r hide-sm">'+wu+'</td>'
      +'<td class="r hide-sm" style="color:var(--sub)">'+r.ingredients.length+'</td>'
      +'<td><button class="btn-tbl" onclick="openRec(\''+r.id+'\')">Editar</button></td></tr>';
  }).join('');
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
  // Convert qty to ingredient's unit for cost calc
  var costPerUnit=ingData.cost; // cost per ingData.unit
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
  // Read all ingredient rows
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
  cm('m-rec');
  renderRec();
  initDash();
  alert('✓ Receta guardada.');
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
  // Group inputs by category using INGR lookup
  var bycat={};
  document.querySelectorAll('.ped-inp').forEach(function(inp){
    var qty=parseFloat(inp.value)||0; if(qty<=0) return;
    var pid=inp.id;
    // Find matching INGR by pid pattern (ped_ + safe code)
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


// ════ CONVERSION HINT ════
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
var delSrc='all'; // all | intern | ya

function initDeliveryMesSel(){
  var sel=$('del-mes-sel'); if(!sel) return;
  var html='<option value="all">Todos los meses</option>';
  var months={};
  DELIVERY_MONTHLY.forEach(function(m){ months[m.mes]=1; });
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

  // PedidosYa data (CSV — Ago2025-Ene2026)
  var DM=sv==='all'?DELIVERY_MONTHLY:DELIVERY_MONTHLY.filter(function(m){return m.mes===sv;});
  var hasDM=DM.length>0;
  var total_ya_ped=DM.reduce(function(s,m){return s+m.pedidos;},0);
  var total_ya_vta=DM.reduce(function(s,m){return s+m.ventas;},0);
  var avg_tkt_ya=total_ya_ped>0?Math.round(total_ya_vta/total_ya_ped):0;
  var avg_rej=DM.length?DM.reduce(function(s,m){return s+(m.rechazados/Math.max(m.pedidos,1));},0)/DM.length*100:0;

  // Toteat data (XLS mensual)
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

  // KPIs
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
        {l:'Pedidos PedidosYa',v:total_ya_ped.toLocaleString('es-CL'),f:sv==='all'?'Ago 2025\u2013Ene 2026':''},
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
      {l:'Total venta neta',v:fmtM(SM.reduce(function(s,m){return s+m.venta_neta;},0)),f:sv==='all'?'Todo el per\u00EDodo':'',m:1}
    ];
  } else if(delSrc==='uber'){
    var vtaTotal=SM.reduce(function(s,m){return s+m.venta_neta;},0);
    var pctUber=vtaTotal>0?(uber_toteat/vtaTotal*100):0;
    kpis=[
      {l:'Venta Uber Eats',v:fmtM(uber_toteat),f:'Registrado en Toteat (POS)',m:1},
      {l:'Participación',v:pctUber.toFixed(1)+'%',f:'Del total de ventas'},
      {l:'Local presencial',v:fmtM(local),f:'Efectivo + tarjetas'},
      {l:'Total venta neta',v:fmtM(vtaTotal),f:sv==='all'?'Todo el per\u00EDodo':'',m:1}
    ];
  } else {
    kpis=[
      {l:'PedidosYa',v:fmtM(ya_toteat),f:'Registrado en Toteat'},
      {l:'Uber Eats',v:fmtM(uber_toteat),f:'Registrado en Toteat',m:1},
      {l:'Del. interno (transf)',v:fmtM(intern_transf),f:'Transferencias'},
      {l:'Local presencial',v:fmtM(local),f:'Efectivo + tarjeta',m:1}
    ];
  }

  $('kpi-del').innerHTML=kpis.map(function(k){
    return '<div class="kpi'+(k.m?' m':'')+'"><div class="kpi-lbl">'+k.l+'</div>'
      +'<div class="kpi-val">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>';
  }).join('');

  // Setup de colores: Ya = rosado, Interno = morado, Uber = celeste
  var delColor=delSrc==='ya'?'#ff3fa4':delSrc==='intern'?'#a78bfa':delSrc==='uber'?'#00d4ff':'#00e5a0';

  // ── Chart 1: tendencia mensual ──
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

  // ── Chart 2: comparación año anterior (ch-del-t) ──
  var ch2=$('ch-del-t');
  var ch2hd=$('del-ch2-title');
  if(ch2){
    var getDelVal=function(m){ return delSrc==='intern'?(m.delivery_transferencia||0):delSrc==='ya'?(m.delivery_ya||0):delSrc==='uber'?(m.delivery_uber||0):m.venta_neta; };
    if(sv==='all'){
      if(ch2hd) ch2hd.textContent='Venta mensual';
      lineChart('ch-del-t', SM.map(function(m){return{l:m.month.split(' ')[0].slice(0,3),v:getDelVal(m)};}), delColor, fmtM);
    } else {
      var p2x=sv.split('-'), mIdx2=parseInt(p2x[1])-1, yrX=parseInt(p2x[0]);
      var prevMes=(yrX-1)+'-'+(mIdx2+1<10?'0':'')+(mIdx2+1);
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

  // ── Chart 3: desglose por días (cuando hay mes seleccionado) ──
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

  // ── Heatmap (Solo muestra en Todos o Pedidos Ya) ──
  var hm=$('del-heatmap');
  if(hm){
    var totalPedPY=HEATMAP.reduce(function(s,h){return s+h.pedidos;},0);
    if(!totalPedPY || delSrc==='uber' || delSrc==='intern'){
      hm.innerHTML='<div class="empty">Mapa de calor exclusivo de PedidosYa</div>';
    }
    else{
      var maxPed=Math.max.apply(null,HEATMAP.map(function(h){return h.pedidos;}));
      hm.innerHTML='<div style="margin-bottom:8px;font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.06em">Pedidos PedidosYa por hora (Ago\u2013Ene)</div>'
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

  // ── Top platos (Ocultos si estás mirando específicamente otra plataforma, enfocados en PedidosYa) ──
  var tp=$('del-top-platos');
  if(tp){
    if (delSrc === 'uber' || delSrc === 'intern') {
        tp.innerHTML='<div class="empty">Datos de platos exclusivos de PedidosYa</div>';
    } else {
        var src2=sv==='all'?DISHES_6M:DISHES_RECENT;
        var maxQ=src2.length?src2[0].qty:1;
        tp.innerHTML='<div style="margin-bottom:8px;font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase">'+(sv==='all'?'Top platos Ago25\u2013Ene26':'Top platos recientes')+'</div>'
          +src2.slice(0,10).filter(function(d){return d.qty>0;}).map(function(d){
            return mkBar(d.name,d.qty,maxQ,'#ff3fa4',function(v){return v+' un';},160);
          }).join('');
    }
  }
}
// ════ GASTOS FIJOS ════
var GCAT_LABELS={'arriendo':'&#127968; Arriendo','servicios':'&#9889; Servicios','gas':'&#128293; Gas','personal':'&#128104;&#8205;&#127859; Personal','marketing':'&#128227; Marketing','mantencion':'&#128296; Mantención','software':'&#128187; Software','insumos':'&#127859; Insumos','otros':'&#128230; Otros'};
var gTab='resumen';
var gCatFilter='all';
var credUnlocked=false;

function setGTab(tab,el){
  gTab=tab;
  // 1. Quitar la clase 'on' de todos los botones de Gasto
  document.querySelectorAll('[id^="gtab-"]').forEach(function(b){b.classList.remove('on');});
  if(el) el.classList.add('on');
  
  // 2. Ocultar todas las vistas usando la clase compartida 'gview'
  document.querySelectorAll('.gview').forEach(function(v){
    v.style.display = 'none';
  });
  
  // 3. Mostrar la vista seleccionada
  var activeView = $('gview-'+tab);
  if(activeView) activeView.style.display = 'block';
  
  // 4. Renderizar contenido dinámico
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
  var kv=$('kpi-gastos'); if(!kv) return;
  kv.innerHTML=[
    {l:'Total semanal', v:fmt(Math.round(tSem)), f:'Gastos recurrentes'},
    {l:'Total mensual', v:fmt(Math.round(tMes)), f:'Proyectado', m:1},
    {l:'Total anual',   v:fmt(Math.round(tAno)), f:'Proyectado'},
    {l:'% sobre venta', v:pct.toFixed(1)+'%',   f:'vs venta prom. mensual', m:1}
  ].map(function(k){
    return '<div class="kpi'+(k.m?' m':'')+'"><div class="kpi-lbl">'+k.l+'</div>'
      +'<div class="kpi-val">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>';
  }).join('');

  // category bars
  var byCat={};
  GASTOS.forEach(function(g){byCat[g.cat]=(byCat[g.cat]||0)+toMes(g);});
  var cats=Object.keys(byCat).map(function(k){return{l:GCAT_LABELS[k]||k,v:byCat[k]};}).sort(function(a,b){return b.v-a.v;});
  var mx=cats[0]?cats[0].v:1;
  var cgcat=$('ch-gcat'); if(cgcat) cgcat.innerHTML=cats.map(function(c){return mkBar(c.l,c.v,mx,'#ff3fa4',fmt,180);}).join('');

  // impact gauge
  var gi=$('gasto-impact'); if(gi){
    var ppct=Math.min(pct,100).toFixed(1);
    gi.innerHTML='<div style="margin-bottom:10px;font-size:13px;color:var(--sub)">De cada <strong style="color:var(--t)">$1.000</strong> de venta, <strong style="color:var(--m)">$'+Math.round(pct*10)+'</strong> son gastos fijos</div>'
      +'<div style="background:var(--s3);border-radius:6px;overflow:hidden;height:18px;margin-bottom:6px"><div style="height:100%;background:var(--m);border-radius:6px;width:'+ppct+'%;transition:width .6s"></div></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--sub)"><span>'+pct.toFixed(1)+'%</span><span>Venta prom: '+fmtM(avgV)+'</span></div>';
  }

  // table rows
  var now=new Date();
  var gb=$('g-body'); if(!gb) return;
  var filteredGastos=gCatFilter==='all'?GASTOS:GASTOS.filter(function(g){return g.cat===gCatFilter;});
  gb.innerHTML=filteredGastos.map(function(g,gi2){
    // vencimiento alert
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
      +(g.encargado?'<div style="font-size:10px;color:var(--sub)">'+g.encargado+(g.telefono?' &middot; '+g.telefono:'')+'</div>':'')
      +(g.cliente_num?'<div style="font-size:10px;color:var(--sub)">N&deg;cl: '+g.cliente_num+'</div>':'');
    var venc=g.vencimiento?'<span style="font-size:11px;color:var(--sub)">'+g.vencimiento+'</span>':'';
    if(g.previred_usuario) venc='<span style="font-size:10px;color:var(--sub)">d&iacute;a 13<br>'+g.previred_usuario+'</span>';
    var avg2=gAvg(g);
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

  var gt=$('g-totrow'); if(gt) gt.innerHTML='Totales &nbsp;&#8594;&nbsp; <strong style="color:var(--t)">'+fmt(Math.round(tSem))+'/sem</strong> &nbsp;&middot;&nbsp; <strong style="color:var(--m)">'+fmt(Math.round(tMes))+'/mes</strong> &nbsp;&middot;&nbsp; '+fmt(Math.round(tAno))+'/a&ntilde;o';
}

// ── HISTORIAL ──
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
  var ght=$('ghist-title'); if(ght) ght.textContent='Historial \u2014 '+g.name;
  var hist=(g.historico||[]).slice().sort(function(a,b){return a.mes<b.mes?-1:1;});
  var real=hist.filter(function(h){return !h.proyectado&&!h.proximo;});
  var avg=real.length?real.reduce(function(s,h){return s+h.monto;},0)/real.length:0;
  var minv=real.length?Math.min.apply(null,real.map(function(h){return h.monto;})):0;
  var maxv=real.length?Math.max.apply(null,real.map(function(h){return h.monto;})):0;
  var gkpis=$('ghist-kpis');
  if(gkpis) gkpis.innerHTML=[
    {l:'Promedio',v:fmt(Math.round(avg)),f:real.length+' meses reales'},
    {l:'M\u00ednimo',v:fmt(minv),f:''},
    {l:'M\u00e1ximo',v:fmt(maxv),f:''}
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
  var mN=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var ghb=$('ghist-body');
  if(ghb) ghb.innerHTML=hist.slice().reverse().map(function(h,hi){
    var b=h.proximo?'<span class="tag" style="background:rgba(255,176,32,.15);color:#ffb020;font-size:9px">Pr\u00f3ximo</span>'
      :h.proyectado?'<span class="tag t-n" style="font-size:9px">Proyectado</span>'
      :'<span class="tag" style="background:rgba(0,229,160,.1);color:#00e5a0;font-size:9px">Pagado</span>';
    var realIdx=hist.length-1-hi;
    return '<tr><td>'+(h.label||h.mes)+(h.notas?'<div style="font-size:10px;color:var(--sub)">'+h.notas+'</div>':'')+'</td>'
      +'<td class="r mono">'+fmt(h.monto)+'</td><td class="hide-sm">'+b+'</td>'
      +'<td><button class="btn-tbl" onclick="delHist('+idx+','+realIdx+')">\u2715</button></td></tr>';
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
  var parts=mes.split('-'), label=mN[parseInt(parts[1])-1]+' '+parts[0];
  var estado=$('mhp-estado').value;
  if(!g.historico) g.historico=[];
  // remove existing same month
  g.historico=g.historico.filter(function(h){return h.mes!==mes;});
  g.historico.push({mes:mes,label:label,monto:monto,proyectado:estado==='proyectado',proximo:estado==='pendiente',notas:$('mhp-notas').value.trim()});
  g.historico.sort(function(a,b){return a.mes<b.mes?-1:1;});
  cm('m-histpago'); renderGHistorial();
}
function delHist(gIdx,hIdx){
  var g=GASTOS[gIdx]; if(!g||!g.historico) return;
  if(!confirm('\u00bfEliminar este registro?')) return;
  g.historico.splice(hIdx,1); renderGHistorial();
}

// ── ALERTAS ──
function renderAlertas(){
  var now=new Date(), alerts=[];
  GASTOS.forEach(function(g){
    // vencimiento alerts
    if(g.vencimiento){
      var dn=parseInt((g.vencimiento.match(/\d+/)||['0'])[0]);
      if(dn){
        var nxt=new Date(now.getFullYear(),now.getMonth(),dn);
        if(nxt<=now) nxt=new Date(now.getFullYear(),now.getMonth()+1,dn);
        var df=Math.ceil((nxt-now)/86400000);
        alerts.push({u:df<=2?'r':df<=7?'m':'c',ico:'&#128467;',
          titulo:g.name+' &mdash; vence en '+df+' d&iacute;a'+(df!==1?'s':''),
          desc:(g.prov?g.prov+' &mdash; ':'')+g.vencimiento,monto:fmt(Math.round(toMes(g)))});
      }
    }
    // gas: next purchase
    if(g.id==='g_gas'&&g.ultima_carga){
      var ult=new Date(g.ultima_carga), prox=new Date(ult);
      prox.setDate(ult.getDate()+7);
      var df2=Math.ceil((prox-now)/86400000);
      alerts.push({u:df2<=0?'r':df2<=2?'m':'c',ico:'&#128706;',
        titulo:'Gas &mdash; '+(df2<=0?'&#128680; Compra pendiente!':'Pr&oacute;xima compra en '+df2+' d&iacute;a'+(df2!==1?'s':'')),
        desc:'Llamar a H&eacute;ctor: '+g.telefono+' (Abastible) &mdash; 2 cilindros',monto:fmt(g.monto)});
    }
    // previred
    if(g.id==='g_imposiciones'){
      var d13=new Date(now.getFullYear(),now.getMonth(),13);
      if(d13<=now) d13=new Date(now.getFullYear(),now.getMonth()+1,13);
      var df3=Math.ceil((d13-now)/86400000);
      alerts.push({u:df3<=2?'r':df3<=7?'m':'c',ico:'&#128179;',
        titulo:'Previred &mdash; en '+df3+' d&iacute;a'+(df3!==1?'s':''),
        desc:'D&iacute;a 13 en previred.com &mdash; usuario: '+g.previred_usuario,monto:'Variable'});
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
  }).join('')||'<div style="color:var(--sub);padding:20px;font-size:13px">&#9989; Sin alertas urgentes</div>';
}

// ── CREDENCIALES ──
function renderCreds(){
  var cb=$('cred-body'); if(!cb) return;
  if(!credUnlocked){
    cb.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px 20px;text-align:center">'
      +'<div style="font-size:40px">&#128272;</div>'
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
      +'<button class="btn-tbl" onclick="cpTxt(\''+c.usuario+'\')" title="Copiar">&#x29c9;</button></div>'
      +'<div style="display:flex;gap:8px;align-items:center"><span style="font-size:10px;color:var(--sub);min-width:55px">Clave</span>'
      +'<code style="font-family:var(--mono);font-size:11px;background:var(--s3);padding:2px 7px;border-radius:4px;flex:1;word-break:break-all">'+c.password+'</code>'
      +'<button class="btn-tbl" onclick="cpTxt(\''+c.password+'\')" title="Copiar">&#x29c9;</button></div>'
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
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){toast('\u2713 Copiado');});
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
  if(!confirm('\u00bfEliminar?')) return;
  CREDENCIALES.splice(ci,1); cm('m-cred'); renderCreds();
}

// ── GASTO MODAL ──
function recalcGastoHint(){
  var m=parseFloat($('mg-monto').value)||0, f=$('mg-freq').value;
  if(!m){$('gasto-hint').textContent='';return;}
  var s=f==='semanal'?m:f==='mensual'?m/4.33:m/52;
  var mo=f==='mensual'?m:f==='semanal'?m*4.33:m/12;
  var a=f==='anual'?m:f==='semanal'?m*52:m*12;
  $('gasto-hint').textContent='= '+fmt(Math.round(s))+'/sem \u00b7 '+fmt(Math.round(mo))+'/mes \u00b7 '+fmt(Math.round(a))+'/a\u00f1o';
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
  cm('m-gasto'); renderGastos();
}
function delGasto(){
  var id=$('mg-id').value;
  if(!confirm('\u00bfEliminar este gasto?')) return;
  GASTOS=GASTOS.filter(function(g){return g.id!==id;}); cm('m-gasto'); renderGastos();
}




// ════ OBJETIVOS SEMANALES ════
var OBJ_KEY = 'sf_objetivos';
var OBJETIVOS = (function(){
  try {
    var s = localStorage.getItem(OBJ_KEY);
    return s ? JSON.parse(s) : {};
  } catch(e) { return {}; }
})();
function saveObj(){ try{localStorage.setItem(OBJ_KEY,JSON.stringify(OBJETIVOS));}catch(e){} }

function iconSVG(name){
  var ic={
    'export':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    'plus':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    'x':'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    'refresh':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 5.64 5.64"/></svg>',
    'download':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    'pdf':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    'alert':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    'target':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    'chart':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  };
  return '<span style="display:inline-flex;align-items:center;margin-right:4px;vertical-align:middle;opacity:.9">'+(ic[name]||'')+'</span>';
}

// ── OBJETIVOS STORAGE ──
var OBJETIVOS = (function(){
  try{ return JSON.parse(localStorage.getItem('sf_objetivos')||'{}'); }
  catch(e){ return {}; }
})();
function saveObjetivos(){ try{localStorage.setItem('sf_objetivos',JSON.stringify(OBJETIVOS));}catch(e){} }

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
  function actualVal(k){ return defaults[k]?defaults[k].actual:( saved[k]&&saved[k].actual||0); }

  // Build items: fixed + custom
  var items=[];
  Object.keys(defaults).forEach(function(k){
    var def=defaults[k];
    var target=saved[k]!==undefined?(typeof saved[k]==='object'?saved[k].target:saved[k]):def.target;
    items.push({k:k,label:def.label,target:target,actual:def.actual,inverse:def.inverse,custom:false});
  });
  // Custom items
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


function updateObj(weekKey,key,val){
  if(!OBJETIVOS[weekKey]) OBJETIVOS[weekKey]={};
  OBJETIVOS[weekKey][key]=val;
  saveObj();
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

function lineChart(elId,dataArr,color,vFmt){
  var el=$(elId); if(!el||!dataArr.length) return;
  var vals=dataArr.map(function(d){return d.v;});
  var maxV=Math.max.apply(null,vals)||1,minV=Math.min.apply(null,vals);
  var range=maxV-minV||maxV||1;
  var W=520,H=148,pL=52,pR=16,pT=20,pB=28,n=dataArr.length;
  if(n<2){verticalBarChart(elId,dataArr,color,vFmt);return;}
  var c=color||'#00d4ff';
  var xS=(W-pL-pR)/(n-1),yR=H-pT-pB;
  var uid='lc'+Math.random().toString(36).slice(2,6);
  var gId=uid+'_gr';
  var pts=dataArr.map(function(d,i){
    return{x:+(pL+i*xS).toFixed(1),y:+(pT+yR-(d.v-minV)/range*yR).toFixed(1),v:d.v,l:d.l};
  });
  var path=pts.map(function(p,i){return(i?'L':'M')+p.x+','+p.y;}).join(' ');
  var area='M'+pts[0].x+','+(pT+yR)+' '+pts.map(function(p){return'L'+p.x+','+p.y;}).join(' ')+' L'+pts[pts.length-1].x+','+(pT+yR)+' Z';
  
  var grid=[0,.5,1].map(function(t){
    var v=minV+range*t, y=+(pT+yR-t*yR).toFixed(1);
    return '<line x1="'+pL+'" y1="'+y+'" x2="'+(W-pR)+'" y2="'+y+'" stroke="rgba(255,255,255,.05)" stroke-width="1"/>'
      +'<text x="'+(pL-4)+'" y="'+(y+4)+'" text-anchor="end" font-size="8.5" fill="var(--sub)" font-family="var(--mono)">'+(vFmt?vFmt(v).replace('$',''):Math.round(v))+'</text>';
  }).join('');
  
  // SOLUCIÓN: Rotar el texto -35 grados para que nunca se pise
  var xlbls=pts.map(function(p){
    return '<text x="'+p.x+'" y="'+(H-4)+'" text-anchor="end" transform="rotate(-35 '+p.x+','+(H-4)+')" font-size="9" fill="var(--sub)">'+p.l+'</text>';
  }).join('');
  
  var dots=pts.map(function(p,i){
    var ttId=uid+'_tt'+i, lnId=uid+'_ln'+i;
    var tx=Math.max(0,Math.min(p.x-34,W-74));
    var ty=Math.max(4,p.y-36);
    var lbl=vFmt?vFmt(p.v):p.v;
    return '<g>'
      +'<circle cx="'+p.x+'" cy="'+p.y+'" r="10" fill="transparent"'
      +' onmouseover="document.getElementById(\''+ttId+'\').setAttribute(\'visibility\',\'visible\');document.getElementById(\''+lnId+'\').setAttribute(\'opacity\',\'.35\')"'
      +' onmouseout="document.getElementById(\''+ttId+'\').setAttribute(\'visibility\',\'hidden\');document.getElementById(\''+lnId+'\').setAttribute(\'opacity\',\'0\')"'
      +' style="cursor:crosshair"/>'
      +'<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5" fill="'+c+'" stroke="#0d0d0f" stroke-width="2" pointer-events="none"/>'
      +'<line id="'+lnId+'" x1="'+p.x+'" y1="'+pT+'" x2="'+p.x+'" y2="'+(pT+yR)+'" stroke="'+c+'" stroke-width="1" stroke-dasharray="3,3" opacity="0" pointer-events="none"/>'
      +'<g id="'+ttId+'" visibility="hidden" pointer-events="none">'
      +'<rect x="'+tx+'" y="'+ty+'" width="72" height="28" rx="4" fill="#16161e" stroke="'+c+'" stroke-width=".7" opacity=".97"/>'
      +'<text x="'+(tx+36)+'" y="'+(ty+11)+'" text-anchor="middle" font-size="8.5" fill="var(--sub)">'+p.l+'</text>'
      +'<text x="'+(tx+36)+'" y="'+(ty+23)+'" text-anchor="middle" font-size="9.5" fill="'+c+'" font-family="var(--mono)" font-weight="700">'+lbl+'</text>'
      +'</g></g>';
  }).join('');
  el.innerHTML='<div style="overflow-x:auto"><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:'+H+'px;display:block;min-width:280px">'
    +'<defs><linearGradient id="'+gId+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+c+'" stop-opacity=".16"/><stop offset="100%" stop-color="'+c+'" stop-opacity="0"/></linearGradient></defs>'
    +grid
    +'<path d="'+area+'" fill="url(#'+gId+')" pointer-events="none"/>'
    +'<path d="'+path+'" fill="none" stroke="'+c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>'
    +dots+xlbls
    +'</svg></div>';
}
function pieChart(elId,dataArr,title){
  var el=$(elId); if(!el||!dataArr.length) return;
  var tot=dataArr.reduce(function(s,d){return s+d.v;},0); if(!tot) return;
  var isCanal=(elId==='ch-vd-pie'||elId==='ch-ci');
  var R=isCanal?100:70, iR=isCanal?60:40; 
  var W=R*2+40, H=R*2+40, cx=W/2, cy=H/2;
  var uid='pie'+Math.random().toString(36).slice(2,6);

  // Colores degradados sutiles y elegantes
  var pales = [
    {id:'g1', c1:'#00d4ff', c2:'#0088cc'}, {id:'g2', c1:'#ff3fa4', c2:'#cc1a7a'},
    {id:'g3', c1:'#00e5a0', c2:'#00a878'}, {id:'g4', c1:'#ffb020', c2:'#cc8800'},
    {id:'g5', c1:'#a78bfa', c2:'#7c3aed'}, {id:'g6', c1:'#ff6b6b', c2:'#ee5253'}
  ];

  var defs='<defs>'+pales.map(function(p){
    return '<linearGradient id="'+uid+'_'+p.id+'" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="'+p.c1+'" stop-opacity="0.95"/><stop offset="100%" stop-color="'+p.c2+'" stop-opacity="0.75"/></linearGradient>';
  }).join('')+'</defs>';

  var ang=-Math.PI/2, slices=[];
  dataArr.slice(0,6).forEach(function(d,i){
    var sl=d.v/tot*Math.PI*2; if(sl<0.005) return;
    slices.push({d:d, i:i, ang:ang, sl:sl, p:pales[i%pales.length]}); ang+=sl;
  });

  var paths=slices.map(function(s){
    var x1=cx+R*Math.cos(s.ang), y1=cy+R*Math.sin(s.ang);
    var x2=cx+R*Math.cos(s.ang+s.sl), y2=cy+R*Math.sin(s.ang+s.sl);
    var ix1=cx+iR*Math.cos(s.ang+s.sl), iy1=cy+iR*Math.sin(s.ang+s.sl);
    var ix2=cx+iR*Math.cos(s.ang), iy2=cy+iR*Math.sin(s.ang);
    var lg=s.sl>Math.PI?1:0;
    var ttId=uid+'_tt'+s.i;
    return '<g style="cursor:pointer;transition:transform .2s;transform-origin:'+cx+'px '+cy+'px"'
      +' onmouseover="this.style.transform=\'scale(1.05)\';document.getElementById(\''+ttId+'\').style.opacity=\'1\'"'
      +' onmouseout="this.style.transform=\'scale(1)\';document.getElementById(\''+ttId+'\').style.opacity=\'0\'">'
      +'<path d="M'+x1.toFixed(1)+','+y1.toFixed(1)+' A'+R+','+R+' 0 '+lg+',1 '+x2.toFixed(1)+','+y2.toFixed(1)+' L'+ix1.toFixed(1)+','+iy1.toFixed(1)+' A'+iR+','+iR+' 0 '+lg+',0 '+ix2.toFixed(1)+','+iy2.toFixed(1)+' Z"'
      +' fill="url(#'+uid+'_'+s.p.id+')" stroke="var(--bg)" stroke-width="2.5"/>'
      +'<g id="'+ttId+'" style="opacity:0;transition:opacity .2s;pointer-events:none">'
      +'<rect x="'+(cx-60)+'" y="'+(cy+R+10)+'" width="120" height="30" rx="6" fill="var(--s1)" stroke="'+s.p.c1+'" stroke-width="1" style="box-shadow:0 4px 12px rgba(0,0,0,.5)"/>'
      +'<text x="'+cx+'" y="'+(cy+R+30)+'" text-anchor="middle" font-size="12" fill="'+s.p.c1+'" font-weight="700">'+s.d.l+' · '+(s.d.v/tot*100).toFixed(1)+'%</text>'
      +'</g></g>';
  }).join('');

  var top=dataArr[0], topC=pales[0].c1;
  var ctr='<text x="'+cx+'" y="'+(cy-12)+'" text-anchor="middle" font-size="12" fill="var(--sub)">'+top.l.split(' ')[0]+'</text>'
    +'<text x="'+cx+'" y="'+(cy+14)+'" text-anchor="middle" font-size="'+(isCanal?'26':'20')+'" font-weight="800" fill="'+topC+'" font-family="var(--mono)">'+(top.v/tot*100).toFixed(0)+'%</text>';

  var leg=slices.map(function(s){
    var pct=(s.d.v/tot*100).toFixed(1);
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03)">'
      +'<div style="width:12px;height:12px;border-radius:3px;background:linear-gradient(135deg, '+s.p.c1+', '+s.p.c2+');flex-shrink:0"></div>'
      +'<span style="font-size:13px;color:var(--t);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.d.l+'</span>'
      +'<span style="font-size:13px;font-family:var(--mono);color:var(--sub);font-weight:700">'+pct+'%</span>'
      +'</div>';
  }).join('');

  el.innerHTML='<div style="display:flex;align-items:center;justify-content:center;gap:35px;flex-wrap:wrap;padding:10px 0">'
    +'<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="overflow:visible;display:block">'+defs+paths+ctr+'</svg>'
    +'<div style="flex:1;min-width:180px;max-width:280px">'+leg+'</div></div>';
}

function verticalBarChart(elId,dataArr,color,vFmt){
  var el=$(elId);if(!el||!dataArr.length)return;
  var maxV=Math.max.apply(null,dataArr.map(function(d){return d.v;}));if(!maxV)maxV=1;
  var n=dataArr.length;
  // Calculamos anchos fijos para evitar que se deformen
  var bW=Math.min(44, Math.max(16, 300/n)); 
  var gap=Math.min(24, Math.max(8, 150/n));
  var pL=15, pR=15, pT=35, pB=45;
  var W=pL+(bW+gap)*n-gap+pR;
  var H=180, yR=H-pT-pB;
  var uid='v'+Math.random().toString(36).slice(2,6);
  
  var bars=dataArr.map(function(d,i){
    var bh=Math.max(4,Math.round(d.v/maxV*yR)), x=pL+i*(bW+gap), y=pT+yR-bh;
    var c=typeof color==='function'?color(d):(Array.isArray(color)?color[i%color.length]:(color||'#00d4ff'));
    var lbl=(d.l||'').length>9?(d.l||'').slice(0,8)+'\u2026':(d.l||'');
    var val=vFmt?vFmt(d.v).replace('$',''):d.v;
    var ttId=uid+'t'+i;
    
    return '<g style="cursor:pointer" onmouseover="document.getElementById(\''+ttId+'\').setAttribute(\'opacity\',\'1\')" onmouseout="document.getElementById(\''+ttId+'\').setAttribute(\'opacity\',\'0\')">'
      +'<rect x="'+x+'" y="'+y+'" width="'+bW+'" height="'+bh+'" rx="5" fill="'+c+'" opacity=".85" style="transition:all .2s"/>'
      +'<text x="'+(x+bW/2)+'" y="'+(y-8)+'" text-anchor="middle" font-size="10.5" fill="'+c+'" font-family="var(--mono)" font-weight="600">'+val+'</text>'
      +'<text x="'+(x+bW/2)+'" y="'+(H-pB+20)+'" text-anchor="middle" font-size="11" fill="var(--sub)">'+lbl+'</text>'
      +'<g id="'+ttId+'" opacity="0" style="transition:opacity .2s;pointer-events:none">'
      +'<rect x="'+(Math.max(0,Math.min(x+bW/2-45,W-90)))+'" y="'+(y-40)+'" width="90" height="26" rx="6" fill="var(--s2)" stroke="'+c+'" stroke-width="1" style="box-shadow:0 4px 12px rgba(0,0,0,.5)"/>'
      +'<text x="'+(x+bW/2)+'" y="'+(y-22)+'" text-anchor="middle" font-size="12" fill="#fff" font-weight="700">'+val+'</text>'
      +'</g></g>';
  }).join('');
  
  // Envolvemos en un flex para centrarlo limpiamente sin estirar
  el.innerHTML='<div style="display:flex;justify-content:center;overflow-x:auto;width:100%;padding:10px 0"><svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="display:block;min-width:'+W+'px">'+bars+'</svg></div>';
}

// ════ INIT ════
$('c-fecha').value=new Date().toISOString().split('T')[0];
initDashSel();
initDash();
initMonthSel();
renderV();
initAnalisis();
initDeliveryMesSel();
renderIngr();
renderRec();
renderCnt();
renderGastos();

function exportGastosPDF(){
  var now=new Date();
  var dateStr=now.toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'});
  var G=GASTOS;
  // Group by category
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
    // Header
    +'<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #1e1e2a">'
    +'<div><div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-.3px">Street Flags</div>'
    +'<div style="font-size:13px;color:#555;margin-top:3px">Reporte de Gastos Fijos</div></div>'
    +'<div style="text-align:right"><div style="font-size:12px;color:#555">'+dateStr+'</div>'
    +'<div style="font-size:11px;color:#333;margin-top:2px">'+G.length+' gastos registrados</div></div>'
    +'</div>'
    // KPIs
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
    // Category breakdown
    +'<div style="background:#16161a;border:1px solid #222;border-radius:10px;padding:20px;margin-bottom:20px">'
    +'<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#555;margin-bottom:16px">Desglose por categoría</div>'
    +catBlocks+'</div>'
    // Full table
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
// ── FLUJO DE CAJA PRO (CON TICKETS Y MEMORIA) ──

const REGLAS_PROVEEDORES = {
  "HECTOR SALAS": "Gas",
  "AGUAS DEL ALTIPLANO": "Agua",
  "CGE": "Electricidad",
  "TRANSBANK": "Ingreso Web",
  "PEDIDOSYA": "Ingreso Delivery"
};

function formatMoney(n) { return '$' + Math.round(n).toLocaleString('es-CL'); }

// ─── MOTOR DE LECTURA CSV AVANZADO (Inmune a comas en precios) ───
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

// ─── LECTOR BANCO ITAÚ ───
function handleBankFile(input) {
  var file = input.files[0]; if(!file) return;
  var reader = new FileReader();
  
  reader.onload = function(e) {
    var text = e.target.result;
    var lines = text.split(/\r?\n/).filter(function(x){return x.trim();});
    
    // Extracción de año inteligente
    var year = new Date().getFullYear();
    var pMatch = text.match(/Período.*?(\d{4})/i) || text.match(/20\d{2}/); 
    if(pMatch) year = pMatch[1] || pMatch[0];
    
    // Detección automática del separador del CSV
    var delimiter = text.indexOf(';') >= 0 ? ';' : ',';
    
    var txs = [];
    lines.forEach(function(l) {
      // Uso del motor avanzado en vez del split antiguo
      var p = parseCSVRow(l, delimiter); 
      if(p.length < 6) return;
      
      var dateStr = p[0].trim();
      if(/^\d{2}\/\d{2}$/.test(dateStr)) {
        var pts = dateStr.split('/'); var isoDate = year + '-' + pts[1] + '-' + pts[0];
        
        // Limpiamos la basura de los números antes de pasarlos a entero
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
      
      // Filtramos duplicados para que no se sumen dos veces si subes el mismo archivo
      var unique = []; var seen = new Set();
      all.forEach(function(t) {
        var str = t.date + t.desc + t.in + t.out;
        if(!seen.has(str)) { seen.add(str); unique.push(t); }
      });
      
      unique.sort(function(a,b){return b.date.localeCompare(a.date)});
      localStorage.setItem('bank_tx', JSON.stringify(unique));
      renderFlujoCaja(false);
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
    
    // Ticket visual: Verde ● si está registrado, gris ○ si no lo está
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




// ─── SINCRONIZADOR AUTOMÁTICO DE RECETAS ───
function syncRecetasCost() {
  if (typeof REC === 'undefined' || !REC || typeof INGR === 'undefined') return;
  
  REC.forEach(function(receta) {
    var nuevoCosto = 0;
    if (receta.ings && receta.ings.length > 0) {
      receta.ings.forEach(function(item) {
        // Busca el ingrediente en el inventario
        var ingDB = INGR.find(function(i) { return i.code === item.code || i.name === item.name; });
        if (ingDB) {
          // Calcula el costo considerando si tiene factor de conversión (rinde) o es directo
          var costoUnidad = ingDB.cost || 0;
          if (ingDB.conv && ingDB.conv > 0) {
            costoUnidad = ingDB.cost / ingDB.conv;
          }
          nuevoCosto += (costoUnidad * (item.qty || 0));
        }
      });
    }
    receta.cost = Math.round(nuevoCosto); // Guarda el nuevo precio exacto
  });
  
  // Guardamos las recetas actualizadas
  localStorage.setItem('app_rec', JSON.stringify(REC));
  
  // Si estás en la pestaña de recetas, se refresca la pantalla sola
  if (typeof renderRec === 'function') renderRec();
}









function renderFlujoCaja(isFilterChange){
  var bankData = JSON.parse(localStorage.getItem('bank_tx') || '[]');
  var kpiDiv = document.getElementById('kpi-flujo');
  var sel = document.getElementById('flujo-mes-sel');
  var panels = document.getElementById('flujo-panels');
  
  if(!kpiDiv) return;

  // 1. AUTO-GENERAR MESES (Desde Enero 2025 hasta la actualidad)
  if (sel && sel.options.length <= 3) { 
      var mNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      var d = new Date();
      var currentYear = d.getFullYear();
      var currentMonth = d.getMonth();
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
      
      // Si el filtro no se activó a mano, intentar preseleccionar el mes actual
      if (!isFilterChange) {
          var currentVal = currentYear + '-' + (currentMonth + 1 < 10 ? '0' : '') + (currentMonth + 1);
          if (sel.querySelector('option[value="'+currentVal+'"]')) sel.value = currentVal;
      }
  }

  var currentMonth = sel ? sel.value : 'all';
  var filteredBank = currentMonth === 'all' ? bankData : bankData.filter(function(t){ return t.date.startsWith(currentMonth); });

  // 2. CÁLCULOS DEL BANCO
  var tIn = 0, tOut = 0;
  var topOutMap = {}, topInMap = {};

  filteredBank.forEach(function(t){
    tIn += t.in; tOut += t.out;
    if(t.out > 0) {
      var cleanName = t.desc.replace(/Transferencia A /i, '').replace(/Transferencia De /i, '').substring(0,25).trim().toUpperCase();
      topOutMap[cleanName] = (topOutMap[cleanName] || 0) + t.out;
    }
    if(t.in > 0) topInMap[t.date] = (topInMap[t.date] || 0) + t.in;
  });

  // 3. CÁLCULO DE EFECTIVO Y GASTOS MANUALES
  var totalManual = JSON.parse(localStorage.getItem('app_gastos') || '[]').reduce(function(s, g) {
      var match = (currentMonth === 'all') || g.date.startsWith(currentMonth);
      return s + (match ? parseInt(g.monto) : 0);
  }, 0);
  
  var efectivoToteat = 0;
  if (typeof SALES !== 'undefined' && SALES.monthly) {
    if (currentMonth === 'all') {
      efectivoToteat = SALES.monthly.reduce((sum, m) => sum + (m.efectivo || 0), 0);
    } else {
      var mArr = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      var pts = currentMonth.split('-');
      if(pts.length === 2) {
          var targetLabel = mArr[parseInt(pts[1]) - 1] + ' ' + pts[0];
          var match = SALES.monthly.find(m => m.month === targetLabel);
          if(match) efectivoToteat = match.efectivo || 0;
      }
    }
  }

  var saldoBanco = tIn - tOut;
  var cajaRealFisica = efectivoToteat - totalManual;

  // 4. RENDERIZAR KPIs
  kpiDiv.style.gridTemplateColumns = 'repeat(3, 1fr)'; 
  kpiDiv.innerHTML = [
    {l:'Abonos Banco', v:formatMoney(tIn), f:'Total Digital', c:'var(--g)'},
    {l:'Cargos Banco', v:formatMoney(tOut), f:'Egresos Digitales', c:'var(--r)'},
    {l:'Saldo Banco', v:formatMoney(saldoBanco), f:'Neto Banco', c:saldoBanco>=0?'var(--g)':'var(--r)'},
    {l:'Efectivo Entrante', v:formatMoney(efectivoToteat), f:'Ventas Toteat', c:'var(--g)'},
    {l:'Gastos Efectivo', v:formatMoney(totalManual), f:'Caja Chica', c:'var(--y)'},
    {l:'Caja Fuerte', v:formatMoney(cajaRealFisica), f:'Billetes Reales', c:cajaRealFisica>=0?'var(--m)':'var(--r)'}
  ].map(k => '<div class="kpi" style="margin-bottom:10px"><div class="kpi-lbl">'+k.l+'</div><div class="kpi-val" style="color:'+k.c+'">'+k.v+'</div><div class="kpi-foot">'+k.f+'</div></div>').join('');

  // 5. RENDERIZAR TABLA Y GRÁFICOS
  if (!filteredBank.length) {
      $('flujo-body').innerHTML = '<tr><td colspan="4" class="empty">No hay datos del banco registrados para esta fecha. Los cálculos de Caja Fuerte siguen activos.</td></tr>';
      if(panels) panels.style.display = 'none';
  } else {
      renderTablaFlujo(filteredBank, false);
      
      if(panels) {
        panels.style.display = 'grid';
        
        var sortedOut = Object.keys(topOutMap).map(k => ({n:k, v:topOutMap[k]})).sort((a,b) => b.v-a.v);
        var topDisplay = sortedOut.slice(0, 10);
        
        document.getElementById('flujo-top-out').innerHTML = topDisplay.length ? topDisplay.map(function(o){
          var pct = Math.round((o.v / tOut) * 100) || 0;
          return '<div onclick="filtrarPorProveedor(\''+o.n+'\')" style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer" title="Clic para ver detalle">'
            +'<span style="font-size:12px;color:var(--m)">'+o.n+'</span>'
            +'<span style="font-size:12px;color:var(--r);font-family:var(--mono)">'+formatMoney(o.v)+' <span style="color:var(--sub);font-size:10px">('+pct+'%)</span></span></div>';
        }).join('') : '<div class="empty">Sin registros</div>';

        var sortedIn = Object.keys(topInMap).map(k => ({d:k, v:topInMap[k]})).sort((a,b) => b.v-a.v).slice(0, 5);
        
        document.getElementById('flujo-top-in').innerHTML = sortedIn.length ? sortedIn.map(o => {
          return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
            +'<span style="font-size:12px;color:var(--sub)">' + o.d + '</span>'
            +'<span style="font-size:12px;color:var(--g);font-family:var(--mono)">' + formatMoney(o.v) + '</span></div>';
        }).join('') : '<div class="empty">Sin ingresos</div>';
      }
  }
}


// ════ SINCRONIZACIÓN FIREBASE (100% BLINDADA) ════

async function saveToCloud(btn) {
  if(!confirm('¿Guardar todos tus registros actuales en la base de datos de la nube?')) return;
  
  var ogText = btn.innerHTML;
  btn.innerHTML = '⏳ Subiendo...';
  
  // Extraemos toda tu memoria actual de la pantalla
  var dataToSave = {};
  for(var i=0; i<localStorage.length; i++){
    var key = localStorage.key(i);
    
    // 🔥 EL FILTRO BLINDADO (Vital para que Firebase no rechace la subida)
    if(key.startsWith('firebase') || /[.#$\[\]\/]/.test(key)) {
        continue; 
    }
    
    dataToSave[key] = localStorage.getItem(key);
  }
  
  try {
    // Mandamos los datos directo a Firebase en tiempo real
    await db.ref('respaldo_principal').set(dataToSave);
    
    btn.innerHTML = '✅ Guardado';
    setTimeout(function(){ btn.innerHTML = ogText; }, 2500);
  } catch(e) {
    console.error("Error Firebase:", e);
    alert('❌ Error al subir a la base de datos.');
    btn.innerHTML = ogText;
  }
}

async function loadFromCloud(btn) {
  if(!confirm('ALERTA: ¿Sobrescribir tu memoria actual con los datos de Firebase?')) return;
  
  var ogText = btn.innerHTML;
  btn.innerHTML = '⏳ Descargando...';
  
  try {
    // Leemos los datos desde Firebase
    const snapshot = await db.ref('respaldo_principal').once('value');
    const data = snapshot.val();
    
    // ESCUDO ANTI-BORRADO DEFINITIVO
    if (!data) {
      alert('❌ La base de datos en Firebase está vacía en este momento. Sube tus datos primero para no borrar tu memoria local.');
      btn.innerHTML = ogText;
      return;
    }
    
    // Si hay datos, los grabamos en tu memoria local
    for(var key in data) {
      localStorage.setItem(key, data[key]);
    }
    
    btn.innerHTML = '✅ Listo';
    setTimeout(function(){ location.reload(); }, 800);
    
  } catch(e) {
    console.error("Error Firebase:", e);
    alert('❌ Error de conexión al descargar. Tus datos en pantalla NO se borraron.');
    btn.innerHTML = ogText;
  }
}



function asociarProveedor(nombreOriginal) {
    var nombreLimpio = nombreOriginal.replace(/Transferencia A /i, '').replace(/Transferencia De /i, '').trim();
    var categoria = prompt("¿A qué categoría pertenece '" + nombreLimpio + "'? (Ej: Gas, Agua, Personal, Arriendo)");
    
    if (categoria && categoria.trim() !== "") {
        var reglasActuales = JSON.parse(localStorage.getItem('reglas_prov') || '{}');
        reglasActuales[nombreOriginal.toUpperCase()] = categoria.trim();
        localStorage.setItem('reglas_prov', JSON.stringify(reglasActuales));
        
        var bankData = JSON.parse(localStorage.getItem('bank_tx') || '[]');
        var dataActualizada = bankData.map(function(t) {
            if (t.desc === nombreOriginal) t.cat = categoria.trim();
            return t;
        });
        localStorage.setItem('bank_tx', JSON.stringify(dataActualizada));

        renderFlujoCaja(true);
    }
}
