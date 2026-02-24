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
    {l:'Venta neta (c/IVA)',v:fmtM(tvn),                      f:lbl},
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
  lineChart('ch-vn',sm.map(function(m){return{l:m.month,v:m.venta_sin_iva||(Math.round(m.venta_neta/1.19))};}), '#00d4ff', fmtM);
  var ya_t=sm.reduce(function(s,m){return s+(m.delivery_ya||0);},0);
  var ub_t=sm.reduce(function(s,m){return s+(m.delivery_uber||0);},0);
  var tr_t=sm.reduce(function(s,m){return s+(m.delivery_transferencia||0);},0);
  var lc_t=Math.max(0,tvn-ya_t-ub_t-tr_t);
  var canalData=[{l:'Local',v:lc_t},{l:'PedidosYa',v:ya_t},{l:'Del. interno',v:tr_t},{l:'Uber Eats',v:ub_t}].filter(function(x){return x.v>0;});
  setTimeout(function(){pieChart('ch-ci', canalData, 'Canales de venta');},50);
  var topDishes=PRODUCT_SALES.filter(function(p){return p.weekly_qty>0&&p.venta>0&&!p.is_modifier})
    .map(function(p){return{l:p.name,v:Math.round(p.weekly_qty*monthRatio*4.33)};})
    .sort(function(a,b){return b.v-a.v;}).slice(0,10);
  setTimeout(function(){verticalBarChart('ch-pv',topDishes,['#00e5a0','#00d4ff','#ff3fa4','#ffb020','#a78bfa'],function(v){return v+'u';});},80);
  verticalBarChart('ch-rc',RECIPES.filter(function(r){return r.cost>200&&r.cost<9000;}).sort(function(a,b){return b.cost-a.cost;}).slice(0,10).map(function(r){return{l:r.name,v:r.cost};}), '#00d4ff', fmt);
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
  var platforms=dy+du;
  var local=Math.max(0,m.venta_neta-platforms-dt);
  if(vCanal==='all')       return m.venta_neta;
  if(vCanal==='local')     return local;
  if(vCanal==='intern')    return dt;
  if(vCanal==='platforms') return platforms;
  if(vCanal==='ya')        return dy;
  if(vCanal==='uber')      return du;
  return m.venta_neta;
}

function canalLabel(){
  var labels={'all':'Total','local':'Local','intern':'Del. interno (transf.)','platforms':'Plataformas ext.','ya':'PedidosYa','uber':'Uber Eats'};
  return labels[vCanal]||vCanal;
}

function renderV(){
  var M=SALES.monthly, D=SALES.daily;
  var sm=aM==='all'?M:M.filter(function(m){return m.month===aM;});
  var sd=aM==='all'?D:D.filter(function(d){return d.month===aM;});
  if(!sm.length) sm=M;

  var tvn=sm.reduce(function(s,m){return s+getVenta(m);},0);
  var tco=sm.reduce(function(s,m){return s+m.costo;},0);
  var amg=sm.reduce(function(s,m){return s+m.margen_pct;},0)/sm.length;
  var ad=sd.filter(function(d){return d.venta_neta>0;});
  // For daily, scale by canal ratio
  var canalRatio=sm.reduce(function(s,m){return s+m.venta_neta;},0);
  var canalTotal=sm.reduce(function(s,m){return s+getVenta(m);},0);
  var ratio=canalRatio>0?canalTotal/canalRatio:1;
  var avgd=ad.length?ad.reduce(function(s,d){return s+d.venta_neta*ratio;},0)/ad.length:0;
  var best=ad.length?ad.slice().sort(function(a,b){return b.venta_neta-a.venta_neta;})[0]:null;
  var lbl=(aM==='all'?'Ene 25–Feb 26':aM)+' · '+canalLabel();

  // Canal breakdown KPI for current period
  var totalIntern=sm.reduce(function(s,m){return s+(m.delivery_ya||0)+(m.delivery_uber||0);},0);
  var totalLocal=sm.reduce(function(s,m){return s+m.venta_neta;},0)-totalIntern;
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

  $('vt1').textContent=(aM==='all'?'Venta mensual':'Mensual — '+aM)+' · '+canalLabel();
  (function(){
    if(aM!=='all'&&sm.length===1){
      var cur=sm[0];
      var ns2=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      var pts2=aM.split(' ');var mi2=ns2.indexOf(pts2[0]);
      var prevLbl=mi2>=0?ns2[mi2]+' '+(parseInt(pts2[1])-1):null;
      var prev=prevLbl?M.find(function(x){return x.month===prevLbl;}):null;
      var cdata=[{l:cur.days_active<26?aM+'*':aM,v:getVenta(cur)}];
      if(prev) cdata.push({l:prevLbl,v:getVenta(prev)});
      verticalBarChart('ch-vm',cdata,['#00d4ff','rgba(0,212,255,.35)'],fmtM);
      $('vt1').textContent='Este mes vs '+(prevLbl||'año anterior');
    } else {
      barChart('ch-vm',sm.map(function(m){return{l:m.month,v:getVenta(m)};}),null,fmtM,140);
    }
  })();

  $('vt2').textContent=aM==='all'?'Último mes — días':'Días de '+aM;
  var ds=aM==='all'?D.filter(function(d){return d.month===M[M.length-1].month;}):sd;
  var vd=ds.filter(function(d){return d.venta_neta>0;});
  var avgD2=vd.length?vd.reduce(function(s,d){return s+d.venta_neta;},0)/vd.length:1;
  var mx=vd.length?Math.max.apply(null,vd.map(function(d){return d.venta_neta*ratio;})):1;
  $('ch-vd').innerHTML=vd.map(function(d){
    var v=d.venta_neta*ratio;
    var c=v>avgD2*ratio*1.15?'#00e5a0':v<avgD2*ratio*0.85?'#ff4455':'#00d4ff';
    return mkBar(d.date,v,mx,c,fmt,100);
  }).join('');

  // Canal desglose stacked info
  if(vCanal==='all'&&sm.length>0){
    var yaT=sm.reduce(function(s,m){return s+(m.delivery_ya||0);},0);
    var ubT=sm.reduce(function(s,m){return s+(m.delivery_uber||0);},0);
    var dtT=sm.reduce(function(s,m){return s+(m.delivery_transferencia||0);},0);
    var locT=sm.reduce(function(s,m){return s+m.venta_neta;},0)-yaT-ubT-dtT;
    var tot=yaT+ubT+dtT+locT;
    $('ch-vd').innerHTML+='<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--b)">'
      +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--sub);margin-bottom:10px">Desglose por canal</div>'
      +[{l:'Local',v:locT,c:'#00d4ff'},{l:'Del. interno (transf.)',v:dtT,c:'#a78bfa'},{l:'PedidosYa',v:yaT,c:'#ff3fa4'},{l:'Uber Eats',v:ubT,c:'#00e5a0'}]
      .filter(function(x){return x.v>0;})
      .map(function(x){return mkBar(x.l,x.v,tot,x.c,fmtM,130);}).join('')
      +'</div>';
    // Pie chart for canal breakdown
    pieChart('ch-vd-pie',[{l:'Local',v:locT},{l:'Del. interno',v:dtT},{l:'PedidosYa',v:yaT},{l:'Uber Eats',v:ubT}].filter(function(x){return x.v>0;}));
  }

  // Proyección — normalizada por días, compara mismo mes año anterior
  var activeM=M.filter(function(m){return m.days_active>0;});
  // Daily rate per month (eliminates partial-month distortion)
  function dailyRate(mo){ return getVenta(mo)/mo.days_active; }
  // Weighted avg of last 6 months by daily rate (more weight to recent)
  var l6=activeM.slice(-6);
  var weights=[1,1,2,2,3,3];
  var wSum=0,wRate=0;
  l6.forEach(function(mo,i){var w=weights[i]||1;wSum+=w;wRate+=dailyRate(mo)*w;});
  var baseRate=wSum>0?wRate/wSum:0;
  // Trend: compare first half vs second half of l6
  var h1=l6.slice(0,3), h2=l6.slice(3);
  var r1=h1.reduce(function(s,m){return s+dailyRate(m);},0)/Math.max(h1.length,1);
  var r2=h2.reduce(function(s,m){return s+dailyRate(m);},0)/Math.max(h2.length,1);
  var trendPct=r1>0?(r2-r1)/r1:0; // monthly trend as % change
  // Days per projected month
  var projMonths=[
    {l:'Marzo 2026',d:31},{l:'Abril 2026',d:30},{l:'Mayo 2026',d:31}
  ];
  // Prior year same months for sanity floor
  var py2025={
    'Marzo 2026': M.find(function(x){return x.month==='Marzo 2025';}),
    'Abril 2026': M.find(function(x){return x.month==='Abril 2025';}),
    'Mayo 2026':  M.find(function(x){return x.month==='Mayo 2025';})
  };
  var pi=l6.slice(-3).map(function(m){return{l:m.month,v:getVenta(m),proj:0};})
    .concat(projMonths.map(function(pm,xi){
      var projRate=baseRate*Math.pow(1+trendPct,xi+1);
      var projV=projRate*pm.d;
      var py=py2025[pm.l];
      if(py){var pyRate=dailyRate(py);projV=projRate*pm.d*0.6+pyRate*pm.d*0.4;}
      var base=baseRate*pm.d;
      projV=Math.max(projV,base*0.75);projV=Math.min(projV,base*1.25);
      return{l:pm.l,v:Math.round(projV),proj:1};
    }));
  var lastRM=l6[l6.length-1];
  if(lastRM&&lastRM.days_active<26){
    var mArr=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var mPts=lastRM.month.split(' ');
    var mI=mArr.indexOf(mPts[0]); var yr=parseInt(mPts[1]);
    var dim=new Date(yr,mI+1,0).getDate();
    var projected=Math.round(dailyRate(lastRM)*dim);
    pi[pi.length-4]={l:lastRM.month+'*',v:projected,proj:2};
  }
  if($('ch-vp')) verticalBarChart('ch-vp',pi,function(d){
    return d.proj===2?'rgba(255,180,32,.85)':d.proj===1?'rgba(0,212,255,.38)':'#00d4ff';
  },fmtM)
}

// ════ ANÁLISIS INTELIGENTE ════
function initAnalisis(){
  // Populate month selector
  var sel=$('an-mes-sel');
  if(sel&&!sel.options.length){
    sel.innerHTML='<option value="all">Todo el período</option>'
      +SALES.monthly.map(function(m){return '<option value="'+m.month+'">'+m.month+'</option>';}).join('');
  }
  var sv=sel?sel.value:'all';
  var totalVenta=SALES.monthly.reduce(function(s,m){return s+m.venta_neta;},0);
  var selMo=sv==='all'?null:SALES.monthly.find(function(m){return m.month===sv;});
  var monthRatio=selMo&&totalVenta>0?selMo.venta_neta/totalVenta:1;
  var weeksInPeriod=sv==='all'?SALES.monthly.length*4.33:selMo?selMo.days_active/7:4.33;

  // Context label
  var ctx=$('an-context');
  if(ctx){
    if(selMo){
      ctx.textContent=selMo.days_active+' días activos · venta $'+(selMo.venta_neta/1e6).toFixed(1)+'M';
    } else {
      ctx.textContent='14 meses · '+SALES.monthly.length+' períodos';
    }
  }

  // Top platos — scale to selected period
  var topD=PRODUCT_SALES.filter(function(p){return p.weekly_qty>0&&p.venta>0&&!p.is_modifier})
    .map(function(p){
      var periodQty=sv==='all'?p.weekly_qty:(p.weekly_qty*weeksInPeriod);
      return{name:p.name,cat:p.cat,qty:periodQty,venta:p.venta*monthRatio,weekly_qty:p.weekly_qty,avg_ticket:p.avg_ticket,weekly_venta:p.weekly_venta};
    })
    .sort(function(a,b){return b.qty-a.qty}).slice(0,18);
  var maxU=topD[0]?topD[0].qty:1;
  var qLabel=sv==='all'?function(v){return v.toFixed(1)+' u/sem';}:function(v){return Math.round(v)+' u/mes';};
  $('ch-platos').innerHTML=topD.map(function(p){
    return mkBar(p.name,p.qty,maxU,'#00d4ff',qLabel,180);
  }).join('');

  // Day of week — interactive animated vertical bar chart
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
  var dayHtml='<div id="day-tooltip" style="position:fixed;background:var(--s2);border:1px solid var(--b);border-radius:6px;padding:8px 12px;font-size:11px;pointer-events:none;z-index:200;display:none">'
    +'<div id="dtt-label" style="font-weight:700;color:var(--t);margin-bottom:2px"></div>'
    +'<div id="dtt-val" style="color:var(--m);font-family:var(--mono)"></div>'
    +'<div id="dtt-pct" style="font-size:10px;color:var(--sub)"></div></div>'
    +'<svg width="100%" viewBox="0 0 '+dTotalW+' '+dH+'" style="overflow:visible;display:block">'+dBars+'</svg>'
    +'<div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--sub)">'
    +'<span><span style="display:inline-block;width:8px;height:8px;background:#00d4ff;border-radius:2px;margin-right:4px"></span>Semana</span>'
    +'<span><span style="display:inline-block;width:8px;height:8px;background:#ff3fa4;border-radius:2px;margin-right:4px"></span>Fin de semana</span>'
    +'</div>';
  $('day-chart').innerHTML=dayHtml;
  requestAnimationFrame(function(){
    var bars2=document.querySelectorAll('#day-chart .anim-bar');
    bars2.forEach(function(bar,i){
      setTimeout(function(){
        var ty=bar.getAttribute('data-ty'), th=bar.getAttribute('data-th');
        bar.style.transition='y .45s cubic-bezier(.34,1.56,.64,1), height .45s cubic-bezier(.34,1.56,.64,1)';
        bar.setAttribute('y',ty); bar.setAttribute('height',th);
        var txt=bar.parentElement.querySelector('.day-val-txt');
        if(txt) setTimeout(function(){txt.style.transition='opacity .3s';txt.setAttribute('opacity','1');},350);
      }, i*70);
    });
  });

  // Insight cards — scale to period
  var cards=PRODUCT_SALES.filter(function(p){return p.weekly_qty>1&&p.venta>0&&!p.is_modifier})
    .map(function(p){
      return{name:p.name,cat:p.cat,qty:p.weekly_qty*weeksInPeriod,
        venta:p.venta*monthRatio,avg_ticket:p.avg_ticket,
        weekly_venta:p.weekly_venta*monthRatio*4.33/SALES.monthly.length};
    })
    .sort(function(a,b){return b.venta-a.venta}).slice(0,12);
    var topPie=cards.slice(0,8).map(function(p){return{l:p.name.split(' ').slice(0,2).join(' '),v:Math.round(p.venta)};});
  setTimeout(function(){pieChart('insight-pie', topPie, 'Top platos por venta');},100);
  var maxV2=cards[0]?cards[0].venta:1;
  var rowsHtml=cards.map(function(p,i){
    var rec=RECIPES.find(function(r){return r.name.toLowerCase()===p.name.toLowerCase();});
    var pct=maxV2>0?p.venta/maxV2*100:0;
    var barC=i<3?'#00d4ff':i<6?'#ff3fa4':'#00e5a0';
    var bg=i%2===0?'transparent':'rgba(255,255,255,.02)';
    var td='padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04)';
    return '<tr style="background:'+bg+'" class="an-row" data-i="'+i+'">'
      +'<td style="'+td+';color:var(--sub);font-family:var(--mono);font-size:11px">'+(i+1)+'</td>'
      +'<td style="'+td+';font-weight:600;color:var(--t)">'+p.name+'</td>'
      +'<td style="'+td+';color:var(--sub);font-size:11px">'+p.cat+'</td>'
      +'<td style="'+td+';text-align:right;font-family:var(--mono);font-weight:700;color:var(--m)">'+fmtM(p.venta)+'</td>'
      +'<td style="'+td+';text-align:right;font-family:var(--mono);color:var(--sub)">'+fmt(p.avg_ticket)+'</td>'
      +'<td style="'+td+';text-align:right;font-family:var(--mono);color:'+(rec?'#ff3fa4':'var(--sub)')+'">'+(rec?fmt(rec.cost):'—')+'</td>'
      +'<td style="'+td+'">'
        +'<div style="background:var(--s3);border-radius:3px;height:6px;min-width:60px">'
        +'<div style="background:'+barC+';height:6px;border-radius:3px;width:'+pct.toFixed(1)+'%"></div>'
        +'</div></td>'
      +'</tr>';
  }).join('');
  var th='padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--sub);border-bottom:1px solid var(--b)';
  $('insight-cards').innerHTML='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr>'
    +'<th style="'+th+'">#</th>'
    +'<th style="'+th+';text-align:left">Plato</th>'
    +'<th style="'+th+';text-align:left">Cat.</th>'
    +'<th style="'+th+';text-align:right">Venta</th>'
    +'<th style="'+th+';text-align:right">Ticket</th>'
    +'<th style="'+th+';text-align:right">Costo</th>'
    +'<th style="'+th+'">Dist.</th>'
    +'</tr></thead>'
    +'<tbody>'+rowsHtml+'</tbody>'
    +'</table></div>';;
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
  cm('m-ingr');renderIngr();initDash();
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

// ════ UPLOAD ════
function openUpload(){pendingUpload=null;$('up-st').textContent='';$('up-prev').innerHTML='';$('up-act').style.display='none';$('m-up').classList.add('on')}
function handleDrop(e){e.preventDefault();$('dz').classList.remove('drag');var f=e.dataTransfer.files[0];if(f)handleFile(f)}
function handleFile(file){
  if(!file) return;
  $('up-st').textContent='Procesando: '+file.name+'...';
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var lines=e.target.result.split('\n');var parsed=[];
      for(var i=1;i<lines.length;i++){
        var cols=lines[i].split('\t');if(cols.length<7)continue;
        var code=cols[0].trim().replace(/^\*+/,'');var name=cols[1].trim().replace(/^\*+/,'');
        var desc=cols[2].trim();var cost=parseFloat(cols[3].trim())||0;var unit=cols[6].trim();
        if(!code||!name)continue;
        parsed.push({code:code,name:name,brand:desc,cost:cost,unit:unit});
      }
      if(!parsed.length){$('up-st').textContent='Sin filas válidas. Verifica el formato.';return}
      pendingUpload=parsed;
      $('up-st').innerHTML='<span style="color:var(--g)">✓ '+parsed.length+' ingredientes detectados</span>';
      $('up-prev').innerHTML='<table style="width:100%;font-size:11.5px;border-collapse:collapse">'
        +'<tr style="color:var(--sub)"><td style="padding:3px 8px">Código</td><td>Nombre</td><td>Costo</td><td>Unidad</td></tr>'
        +parsed.slice(0,5).map(function(p){return'<tr><td style="padding:3px 8px;font-family:var(--mono);font-size:10.5px">'+p.code+'</td>'
          +'<td style="padding:3px 8px">'+p.name+'</td><td style="padding:3px 8px;font-family:var(--mono)">$'+p.cost.toLocaleString('es-CL')+'</td>'
          +'<td style="padding:3px 8px">'+p.unit+'</td></tr>'}).join('')+'</table>';
      $('up-act').style.display='flex';
    }catch(err){$('up-st').textContent='Error: '+err.message}
  };
  reader.readAsText(file,'UTF-8');
}
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

function handleDropImp(e){e.preventDefault();$('dz-imp').classList.remove('drag');var f=e.dataTransfer.files[0];if(f)handleFileImp(f);}

function handleFileImp(file){
  if(!file) return;
  $('imp-st').textContent='Procesando: '+file.name+'...';
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var lines=e.target.result.split('\n').filter(function(l){return l.trim();});
      if(lines.length<2){$('imp-st').textContent='Archivo vacío o sin datos.';return;}
      var rows=lines.slice(1).map(function(l){return l.split('\t').map(function(c){return c.trim();});});
      importPending=rows;
      $('imp-st').innerHTML='<span style="color:var(--g)">&#10003; '+rows.length+' filas detectadas</span>';
      // Preview table
      var cols=importMode==='inv'
        ?['Ingrediente','Costo unit','Unidad','Uso/sem']
        :['Producto','Venta','Cantidad'];
      $('imp-prev').innerHTML='<table style="width:100%;border-collapse:collapse;font-size:11.5px">'
        +'<tr>'+cols.map(function(c){return'<td style="padding:3px 8px;color:var(--sub);font-weight:700">'+c+'</td>';}).join('')+'</tr>'
        +rows.slice(0,5).map(function(r){
          return '<tr>'+r.slice(0,cols.length).map(function(c){return'<td style="padding:3px 8px">'+c+'</td>';}).join('')+'</tr>';
        }).join('')+'</table>';
      $('imp-act').style.display='flex';
    }catch(err){$('imp-st').textContent='Error: '+err.message;}
  };
  reader.readAsText(file,'UTF-8');
}

function applyImport(){
  if(!importPending) return;
  var updated=0,skipped=0;
  if(importMode==='inv'){
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
    cm('m-import'); renderIngr(); initDash();
    alert('✓ Inventario actualizado: '+updated+' ingredientes. '+skipped+' no encontrados.');
  } else {
    // Ventas import — rebuild PRODUCT_SALES equivalent in memory
    // For now just show confirmation; full rebuild would need page reload
    cm('m-import');
    alert('✓ '+importPending.length+' filas recibidas. Recarga la página con los datos ya guardados para ver el nuevo ranking.');
  }
  importPending=null;
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
  var plat_total=ya_toteat+uber_toteat;

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

  // ── Chart 1: tendencia mensual ──
  var ch=$('ch-del-mes');
  if(ch){
    if(delSrc==='ya'){
      if(!hasDM&&sv!=='all'){
        lineChart('ch-del-mes',SM.map(function(m){return{l:m.month.split(' ')[0].slice(0,3),v:m.delivery_ya||0};}), '#ff3fa4',fmtM);
      } else {
        lineChart('ch-del-mes',(sv==='all'?DELIVERY_MONTHLY:DM).map(function(d){
          return{l:mNames[parseInt(d.mes.split('-')[1])-1].slice(0,3)+' '+d.mes.split('-')[0].slice(2),v:d.ventas};
        }),'#ff3fa4',fmtM);
      }
    } else {
      var smData=SM.map(function(m){
        var v=delSrc==='intern'?(m.delivery_transferencia||0):((m.delivery_ya||0)+(m.delivery_uber||0)+(m.delivery_transferencia||0));
        return{l:m.month.split(' ')[0].slice(0,3),v:v};
      });
      if(smData.length===1) smData=[{l:'',v:0},smData[0],{l:'',v:0}];
      lineChart('ch-del-mes',smData,delSrc==='intern'?'#a78bfa':'#00e5a0',fmtM);
    }
  }

  // ── Chart 2: comparación año anterior (ch-del-t) ──
  var ch2=$('ch-del-t');
  var ch2hd=$('del-ch2-title');
  if(ch2){
    var delColor=delSrc==='ya'?'#ff3fa4':delSrc==='intern'?'#a78bfa':'#00e5a0';
    var getDelVal=function(m){ return delSrc==='intern'?(m.delivery_transferencia||0):delSrc==='ya'?(m.delivery_ya||0):m.venta_neta; };
    if(sv==='all'){
      // Compare 2025 vs 2026 month by month
      if(ch2hd) ch2hd.textContent='Comparación 2025 vs 2026';
      var byYr={};
      SM_all.forEach(function(m){
        var pts=m.month.split(' '); var mn=pts[0].slice(0,3); var yr=pts[1];
        if(!byYr[yr]) byYr[yr]={};
        byYr[yr][mn]=(byYr[yr][mn]||0)+getDelVal(m);
      });
      var mOrder=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      var has25=byYr['2025']||{}, has26=byYr['2026']||{};
      var cmp=mOrder.filter(function(mn){return has25[mn]||has26[mn];}).map(function(mn){
        return{l:mn,v:has25[mn]||0,v2:has26[mn]||0};
      });
      // Show both years as grouped bars
      if(cmp.length>0){
        var maxC=Math.max.apply(null,cmp.map(function(d){return Math.max(d.v,d.v2);}));
        var n2=cmp.length, bW2=16, gap2=4, grpGap=10, pL2=6, pR2=6, pT2=26, pB2=36;
        var W2=pL2+(bW2*2+gap2+grpGap)*n2-grpGap+pR2, H2=100, yR2=H2-pT2-pB2;
        var uid2='cmp'+Math.random().toString(36).slice(2,6);
        var svgBars=cmp.map(function(d,i){
          var gx=pL2+i*(bW2*2+gap2+grpGap);
          var bh25=maxC>0?Math.max(2,Math.round(d.v/maxC*yR2)):2;
          var bh26=maxC>0?Math.max(2,Math.round(d.v2/maxC*yR2)):2;
          var y25=pT2+yR2-bh25, y26=pT2+yR2-bh26;
          var ttId=uid2+'_'+i;
          var val25=fmtM(d.v).replace('$',''), val26=d.v2?fmtM(d.v2).replace('$',''):'—';
          return '<g>'
            +'<rect x="'+gx+'" y="'+y25+'" width="'+bW2+'" height="'+bh25+'" rx="2" fill="'+delColor+'" opacity=".45"'
            +' onmouseover="document.getElementById(\''+ttId+'\').setAttribute(\'visibility\',\'visible\')" onmouseout="document.getElementById(\''+ttId+'\').setAttribute(\'visibility\',\'hidden\')" style="cursor:pointer"/>'
            +'<rect x="'+(gx+bW2+gap2)+'" y="'+y26+'" width="'+bW2+'" height="'+bh26+'" rx="2" fill="'+delColor+'"'
            +' onmouseover="document.getElementById(\''+ttId+'\').setAttribute(\'visibility\',\'visible\')" onmouseout="document.getElementById(\''+ttId+'\').setAttribute(\'visibility\',\'hidden\')" style="cursor:pointer"/>'
            +'<text x="'+(gx+bW2)+'" y="'+(H2-pB2+14)+'" text-anchor="middle" font-size="8" fill="var(--sub)">'+d.l+'</text>'
            +'<g id="'+ttId+'" visibility="hidden" pointer-events="none">'
            +'<rect x="'+(Math.min(gx,W2-90))+'" y="'+(pT2-20)+'" width="86" height="32" rx="4" fill="#16161e" stroke="'+delColor+'" stroke-width=".7" opacity=".97"/>'
            +'<text x="'+(Math.min(gx,W2-90)+43)+'" y="'+(pT2-9)+'" text-anchor="middle" font-size="8.5" fill="var(--sub)">'+d.l+': 2025 vs 2026</text>'
            +'<text x="'+(Math.min(gx,W2-90)+43)+'" y="'+(pT2+2)+'" text-anchor="middle" font-size="8" fill="'+delColor+'" font-family="var(--mono)">'+val25+' / '+val26+'</text>'
            +'</g>'
            +'</g>';
        }).join('');
        // Legend
        var lgd='<div style="display:flex;gap:16px;margin-top:8px;font-size:10px;color:var(--sub)">'
          +'<span><span style="display:inline-block;width:10px;height:10px;background:'+delColor+';opacity:.45;border-radius:2px;margin-right:4px"></span>2025</span>'
          +'<span><span style="display:inline-block;width:10px;height:10px;background:'+delColor+';border-radius:2px;margin-right:4px"></span>2026</span>'
          +'</div>';
        ch2.innerHTML='<div style="overflow-x:auto"><svg viewBox="0 0 '+W2+' '+H2+'" style="min-width:'+W2+'px;width:100%;height:'+H2+'px;display:block">'+svgBars+'</svg></div>'+lgd;
      }
    } else {
      // Single month selected: compare same month last year
      var p2x=sv.split('-'), mIdx2=parseInt(p2x[1])-1, yrX=parseInt(p2x[0]);
      var prevMes=(yrX-1)+'-'+(mIdx2+1<10?'0':'')+(mIdx2+1);
      var prevSM2=SM_all.filter(function(m){return m.month===mNames[mIdx2]+' '+(yrX-1);});
      var curV=delSrc==='ya'?(hasDM?total_ya_vta:ya_toteat):delSrc==='intern'?intern_transf:SM.reduce(function(s,m){return s+m.venta_neta;},0);
      var prevV2=prevSM2.length?getDelVal(prevSM2[0]):0;
      if(ch2hd) ch2hd.textContent=mNames[mIdx2]+' '+yrX+' vs '+mNames[mIdx2]+' '+(yrX-1);
      if(prevV2>0){
        verticalBarChart('ch-del-t',[
          {l:mNames[mIdx2].slice(0,3)+' '+yrX,v:curV},
          {l:mNames[mIdx2].slice(0,3)+' '+(yrX-1),v:prevV2}
        ],[delColor,delColor+'55'],fmtM);
      } else {
        ch2.innerHTML='<div class="empty" style="padding:20px 0;font-size:12px">Sin datos del año anterior</div>';
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
              :d.venta_neta;
        return{l:d.date.replace(/\w+\s/,''),v:Math.round(v)||0};
      }).filter(function(d){return d.v>0;});
      var dColor=delSrc==='ya'?'#ff3fa4':delSrc==='intern'?'#a78bfa':'#00e5a0';
      if(dayVals.length) verticalBarChart('ch-del-dias',dayVals,dColor,fmtM);
    } else {
      if(chD) chD.innerHTML='<div class="empty" style="padding:20px 0;font-size:12px;color:var(--sub)">Sin datos diarios</div>';
    }
  }

  // ── Heatmap ──
  var hm=$('del-heatmap');
  if(hm){
    var totalPedPY=HEATMAP.reduce(function(s,h){return s+h.pedidos;},0);
    if(!totalPedPY){hm.innerHTML='<div class="empty">Sin datos de heatmap</div>';}
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

  // ── Top platos ──
  var tp=$('del-top-platos');
  if(tp){
    var src2=sv==='all'?DISHES_6M:DISHES_RECENT;
    var maxQ=src2.length?src2[0].qty:1;
    tp.innerHTML='<div style="margin-bottom:8px;font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase">'+(sv==='all'?'Top platos Ago25\u2013Ene26':'Top platos recientes')+'</div>'
      +src2.slice(0,15).filter(function(d){return d.qty>0;}).map(function(d){
        return mkBar(d.name,d.qty,maxQ,'#ff3fa4',function(v){return v+' un';},160);
      }).join('');
  }
}

// ════ GASTOS FIJOS ════
var GCAT_LABELS={'arriendo':'&#127968; Arriendo','servicios':'&#9889; Servicios','gas':'&#128293; Gas','personal':'&#128104;&#8205;&#127859; Personal','marketing':'&#128227; Marketing','mantencion':'&#128296; Mantención','software':'&#128187; Software','insumos':'&#127859; Insumos','otros':'&#128230; Otros'};
var gTab='resumen';
var gCatFilter='all';
var credUnlocked=false;

function setGTab(tab,el){
  gTab=tab;
  document.querySelectorAll('[id^="gtab-"]').forEach(function(b){b.classList.remove('on');});
  if(el) el.classList.add('on');
  ['resumen','historial','alertas','cred'].forEach(function(t){
    var v=$('gview-'+t); if(v) v.style.display=(t===tab)?'':'none';
  });
  if(tab==='resumen')   renderGastos();
  if(tab==='historial') renderGHistSel();
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

  // category bars (si quieres que respete el filtro, cambia GASTOS → filtG)
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
function saveObj(){
  try{localStorage.setItem(OBJ_KEY,JSON.stringify(OBJETIVOS));}catch(e){}
}

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

function updateObj(weekKey,key,val){
  if(!OBJETIVOS[weekKey]) OBJETIVOS[weekKey]={};
  OBJETIVOS[weekKey][key]=val;
  saveObj();
}

function addCustomObj(){
  var lbl=prompt('Nombre del objetivo:'); if(!lbl||!lbl.trim()) return;
  var val=parseFloat(prompt('Valor objetivo ($):')||'0');
  var now=new Date(); var ws=new Date(now); ws.setDate(now.getDate()-now.getDay()+1);
  var wk=ws.toISOString().slice(0,10);
  var k='custom_'+Date.now();
  if(!OBJETIVOS[wk]) OBJETIVOS[wk]={};
  OBJETIVOS[wk][k]={label:lbl.trim(),target:val||0,custom:true};
  saveObj(); renderObjetivos();
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

function deleteObj(wk,k){
  if(!OBJETIVOS[wk]) return;
  delete OBJETIVOS[wk][k];
  saveObj();
  renderObjetivos();
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
  var rows=sm.map(function(m){
    return '<tr><td>'+m.month+'</td><td class="r">'+fmtM(m.venta_neta)+'</td>'
      +'<td class="r">'+fmtM(m.venta_neta/1.19)+'</td>'
      +'<td class="r">'+m.margen_pct.toFixed(1)+'%</td>'
      +'<td class="r">'+m.days_active+'</td>'
      +'<td class="r">'+fmtM(m.delivery_ya||0)+'</td>'
      +'<td class="r">'+fmtM(m.delivery_transferencia||0)+'</td>'
      +'</tr>';
  }).join('');
  var secLabels={ventas:'Ventas',gastos:'Gastos',delivery:'Delivery',analisis:'Análisis'};
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8">'
    +'<title>Street Flags — '+( secLabels[sec]||sec)+' '+(mo==='all'?'2025-2026':mo)+'</title>'
    +'<style>body{font-family:system-ui,sans-serif;color:#111;padding:30px;max-width:900px;margin:0 auto}'
    +'h1{font-size:20px;margin-bottom:4px}h2{font-size:14px;color:#666;font-weight:400;margin-top:0}'
    +'table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}'
    +'th{background:#111;color:#fff;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase}'
    +'td{padding:8px 12px;border-bottom:1px solid #eee}.r{text-align:right}'
    +'tr:nth-child(even){background:#f9f9f9}'
    +'tfoot td{font-weight:700;border-top:2px solid #111;background:#f5f5f5}'
    +'@media print{body{padding:0}}</style></head><body>'
    +'<h1>&#9873; Street Flags — '+(secLabels[sec]||sec)+'</h1>'
    +'<h2>'+(mo==='all'?'Enero 2025 – Febrero 2026':mo)+' &nbsp;|&nbsp; Generado '+new Date().toLocaleDateString('es-CL')+'</h2>';

  if(sec==='ventas'||sec==='all'){
    var tvn=sm.reduce(function(s,m){return s+m.venta_neta;},0);
    html+='<table><thead><tr><th>Mes</th><th>Venta neta</th><th>Sin IVA</th><th>Margen</th><th>Días</th><th>PedidosYa</th><th>Del. interno</th></tr></thead>'
      +'<tbody>'+rows+'</tbody>'
      +'<tfoot><tr><td>TOTAL</td><td class="r">'+fmtM(tvn)+'</td><td class="r">'+fmtM(tvn/1.19)+'</td><td class="r">—</td><td class="r">—</td>'
      +'<td class="r">'+fmtM(sm.reduce(function(s,m){return s+(m.delivery_ya||0);},0))+'</td>'
      +'<td class="r">'+fmtM(sm.reduce(function(s,m){return s+(m.delivery_transferencia||0);},0))+'</td>'
      +'</tr></tfoot></table>';
  }
  if(sec==='gastos'||sec==='all'){
    html+='<h2 style="margin-top:30px">Gastos fijos</h2>'
      +'<table><thead><tr><th>Gasto</th><th>Categoría</th><th>Proveedor</th><th>Frecuencia</th><th>Monto/mes</th><th>Monto/año</th></tr></thead><tbody>'
      +GASTOS.map(function(g){
        return '<tr><td>'+g.name+'</td><td>'+(GCAT_LABELS[g.cat]||g.cat).replace(/&#\d+;/g,'')+'</td>'
          +'<td>'+(g.prov||'')+'</td><td>'+g.freq+'</td>'
          +'<td class="r">'+fmt(Math.round(toMes(g)))+'</td>'
          +'<td class="r">'+fmt(Math.round(toAno(g)))+'</td></tr>';
      }).join('')
      +'<tr style="font-weight:700"><td colspan="4">TOTAL</td>'
      +'<td class="r">'+fmt(Math.round(GASTOS.reduce(function(s,g){return s+toMes(g);},0)))+'</td>'
      +'<td class="r">'+fmt(Math.round(GASTOS.reduce(function(s,g){return s+toAno(g);},0)))+'</td></tr>'
      +'</tbody></table>';
  }
  html+='</body></html>';
  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();setTimeout(function(){w.print();},500);}
  cm('m-export');
}

function exportExcel(sec,mo){
  var M=SALES.monthly;
  var sm=mo==='all'?M:M.filter(function(m){return m.month===mo;});
  // Build CSV
  var rows=[['Mes','Venta neta','Sin IVA','Margen %','Días activos','PedidosYa','Del. interno (transf)','Uber Eats','Local']];
  sm.forEach(function(m){
    var dy=m.delivery_ya||0;
    var du=m.delivery_uber||0;
    var dt=m.delivery_transferencia||0;
    var local=Math.max(0,m.venta_neta-dy-du-dt);
    rows.push([
      m.month,
      m.venta_neta,
      Math.round(m.venta_neta/1.19),
      m.margen_pct,
      m.days_active,
      dy,
      dt,
      du,
      local
    ]);
  });
  if(sec==='gastos'||sec==='all'){
    rows.push([]);
    rows.push(['GASTOS FIJOS','Categoría','Proveedor','Frecuencia','Monto/mes','Monto/año']);
    GASTOS.forEach(function(g){
      rows.push([g.name,g.cat,g.prov||'',g.freq,Math.round(toMes(g)),Math.round(toAno(g))]);
    });
  }
  var csv=rows.map(function(r){return r.map(function(c){return '"'+String(c||'').replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download='StreetFlags_'+(mo==='all'?'2025-2026':mo.replace(' ','_'))+'.csv';
  a.click(); URL.revokeObjectURL(url);
  cm('m-export');
}

// ════ MODERN CHARTS ════
function lineChart(elId, dataArr, color, vFmt){
  var el = $(elId);
  if (!el || !dataArr || !dataArr.length) {
    if (el) el.innerHTML = '';
    return;
  }

  var vals = dataArr.map(function(d){ return d.v; });
  var maxV = Math.max.apply(null, vals);
  var minV = Math.min.apply(null, vals);
  if (!isFinite(maxV)) return;

  var n = dataArr.length;
  var c = color || '#00d4ff';

  // Normalizamos a un viewBox 0–100 x 0–80 para que siempre use todo el ancho
  var vbW = 100, vbH = 80;
  var top = 10, bottom = 18;
  var innerH = vbH - top - bottom;
  var range = (maxV - minV) || (maxV || 1);

  var pts = dataArr.map(function(d, i){
    var t = (n === 1) ? 0.5 : i / (n - 1);     // si hay un solo punto, va al medio
    var x = 5 + t * 90;                        // margen lateral 5–95
    var y = top + (1 - (d.v - minV) / range) * innerH;
    return { x: x, y: y, v: d.v, l: d.l };
  });

  var path = pts.map(function(p, i){
    return (i ? 'L' : 'M') + p.x.toFixed(2) + ',' + p.y.toFixed(2);
  }).join(' ');

  // línea base suave
  var gridY = top + innerH;
  var grid = '<line x1="5" y1="'+gridY+'" x2="95" y2="'+gridY+'" stroke="rgba(255,255,255,.12)" stroke-width="0.6" />';

  // etiquetas X (máx 10 para que no se amontonen)
  var step = n > 10 ? Math.ceil(n / 10) : 1;
  var xLabels = pts.map(function(p, i){
    if (i % step !== 0) return '';
    return '<text x="'+p.x+'" y="'+(vbH-4)+'" text-anchor="middle" font-size="7" fill="var(--sub)">'+(p.l || '')+'</text>';
  }).join('');

  // puntos
  var dots = pts.map(function(p){
    var valLabel = vFmt ? vFmt(p.v) : p.v;
    return ''
      + '<circle cx="'+p.x+'" cy="'+p.y+'" r="1.8" fill="'+c+'" stroke="#0d0d0f" stroke-width="1" />'
      + '<text x="'+p.x+'" y="'+(p.y-2.5)+'" text-anchor="middle" font-size="7" fill="'+c+'" font-family="var(--mono)">'+String(valLabel).replace('$','')+'</text>';
  }).join('');

  el.innerHTML =
    '<svg viewBox="0 0 '+vbW+' '+vbH+'" preserveAspectRatio="none" '+
    'style="width:100%;height:170px;display:block">'
      + grid +
      '<path d="'+path+'" fill="none" stroke="'+c+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      dots +
      xLabels +
    '</svg>';
}

function pieChart(elId,dataArr,title){
  var el=$(elId); if(!el||!dataArr.length) return;
  var tot=dataArr.reduce(function(s,d){return s+d.v;},0); if(!tot) return;
  var cls=['#00d4ff','#ff3fa4','#00e5a0','#ffb020','#a78bfa','#ff6b6b','#4ecdc4','#f7b731'];
  var isCanal=(elId==='ch-vd-pie'||elId==='ch-ci');
  var R=isCanal?100:62, iR=isCanal?52:32;
  var W=R*2+20, H=R*2+20, cx=W/2, cy=H/2;
  var uid='pie'+Math.random().toString(36).slice(2,6);
  var ang=-Math.PI/2, slices=[];
  dataArr.slice(0,8).forEach(function(d,i){
    var sl=d.v/tot*Math.PI*2; if(sl<0.005) return;
    slices.push({d:d,i:i,ang:ang,sl:sl}); ang+=sl;
  });
  var paths=slices.map(function(s){
    var d=s.d,i=s.i,a=s.ang,sl=s.sl,c=cls[i%cls.length];
    var mid=a+sl/2;
    var x1=cx+R*Math.cos(a),y1=cy+R*Math.sin(a);
    var x2=cx+R*Math.cos(a+sl),y2=cy+R*Math.sin(a+sl);
    var ix1=cx+iR*Math.cos(a+sl),iy1=cy+iR*Math.sin(a+sl);
    var ix2=cx+iR*Math.cos(a),iy2=cy+iR*Math.sin(a);
    var lg=sl>Math.PI?1:0;
    var ttId=uid+'_tt'+i;
    var tx=(cx+(R+iR)/2*Math.cos(mid)*0.08).toFixed(1);
    var ty=(cy+(R+iR)/2*Math.sin(mid)*0.08).toFixed(1);
    return '<g style="cursor:pointer;transform-origin:'+cx+'px '+cy+'px;transition:transform .15s"'
      +' onmouseover="this.style.transform=\'scale(1.07)\';document.getElementById(\''+ttId+'\').setAttribute(\'visibility\',\'visible\')"'
      +' onmouseout="this.style.transform=\'scale(1)\';document.getElementById(\''+ttId+'\').setAttribute(\'visibility\',\'hidden\')">'
      +'<path d="M'+x1.toFixed(1)+','+y1.toFixed(1)+' A'+R+','+R+' 0 '+lg+',1 '+x2.toFixed(1)+','+y2.toFixed(1)+' L'+ix1.toFixed(1)+','+iy1.toFixed(1)+' A'+iR+','+iR+' 0 '+lg+',0 '+ix2.toFixed(1)+','+iy2.toFixed(1)+' Z"'
      +' fill="'+c+'" stroke="var(--bg)" stroke-width="2.5"/>'
      +'<g id="'+ttId+'" visibility="hidden" pointer-events="none">'
      +'<rect x="'+(cx-52)+'" y="'+(cy+iR+4)+'" width="104" height="26" rx="5" fill="#16161e" stroke="'+c+'" stroke-width=".7" opacity=".97"/>'
      +'<text x="'+cx+'" y="'+(cy+iR+17)+'" text-anchor="middle" font-size="9" fill="var(--sub)">'+d.l+'</text>'
      +'<text x="'+cx+'" y="'+(cy+iR+27)+'" text-anchor="middle" font-size="8.5" fill="'+c+'" font-family="var(--mono)" font-weight="700">'+(d.v/tot*100).toFixed(1)+'% · '+fmtM(d.v)+'</text>'
      +'</g>'
      +'</g>';
  }).join('');
  // Center label
  var top=dataArr[0], c0=cls[0];
  var ctr='<text x="'+cx+'" y="'+(cy-7)+'" text-anchor="middle" font-size="9.5" fill="var(--sub)">'+top.l+'</text>'
    +'<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" font-size="'+(isCanal?'18':'13')+'" font-weight="800" fill="'+c0+'" font-family="var(--mono)">'+(top.v/tot*100).toFixed(0)+'%</text>'
    +'<text x="'+cx+'" y="'+(cy+27)+'" text-anchor="middle" font-size="9.5" fill="var(--sub)">'+fmtM(top.v)+'</text>';
  // Legend
  var leg=dataArr.slice(0,8).map(function(d,i){
    var pct=(d.v/tot*100).toFixed(1), c=cls[i%cls.length];
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
      +'<span style="width:8px;height:8px;border-radius:2px;background:'+c+';flex-shrink:0;box-shadow:0 0 5px '+c+'70"></span>'
      +'<span style="font-size:11px;color:var(--sub);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+d.l+'</span>'
      +'<span style="font-size:11px;font-family:var(--mono);color:var(--t);font-weight:700">'+pct+'%</span>'
      +'</div>';
  }).join('');
  el.innerHTML='<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:4px 0">'
    +'<svg viewBox="0 0 '+W+' '+H+'" style="width:'+W+'px;height:'+H+'px;flex-shrink:0;overflow:visible;display:block">'+paths+ctr+'</svg>'
    +'<div style="flex:1;min-width:100px">'+leg+'</div></div>';
}

function verticalBarChart(elId, dataArr, color, vFmt){
  var el = $(elId);
  if (!el || !dataArr || !dataArr.length) {
    if (el) el.innerHTML = '';
    return;
  }

  var maxV = Math.max.apply(null, dataArr.map(function(d){ return d.v; }));
  if (!maxV) return;

  var n = dataArr.length;
  var vbW = 100, vbH = 80;
  var top = 10, bottom = 22;
  var innerH = vbH - top - bottom;
  var left = 6, right = 6;
  var innerW = vbW - left - right;

  // ancho barra relativo al número de ítems
  var barSpace = innerW / n;
  var bW = barSpace * 0.6;
  var gap = barSpace * 0.4;

  function getColor(d, i){
    if (typeof color === 'function') return color(d);
    if (Array.isArray(color) && color.length) return color[i % color.length];
    return color || '#00d4ff';
  }

  var bars = dataArr.map(function(d, i){
    var h = Math.max(2, (d.v / maxV) * innerH);
    var x = left + i * barSpace + (barSpace - bW) / 2;
    var y = top + innerH - h;
    var c = getColor(d, i);
    var label = (d.l || '');
    if (label.length > 7) label = label.slice(0, 6) + '…';
    var val = vFmt ? vFmt(d.v) : d.v;

    return ''
      + '<g>'
      +   '<rect x="'+x.toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+bW.toFixed(2)+'" height="'+h.toFixed(2)+'" '
      +         'rx="2.2" fill="'+c+'" opacity="0.9" />'
      +   '<text x="'+(x + bW/2).toFixed(2)+'" y="'+(y-2).toFixed(2)+'" text-anchor="middle" '
      +         'font-size="7" fill="'+c+'" font-family="var(--mono)">'+String(val).replace('$','')+'</text>'
      +   '<text x="'+(x + bW/2).toFixed(2)+'" y="'+(vbH-4)+'" text-anchor="middle" '
      +         'font-size="7" fill="var(--sub)">'+label+'</text>'
      + '</g>';
  }).join('');

  // línea de base
  var baseY = top + innerH;
  var grid = '<line x1="'+left+'" y1="'+baseY+'" x2="'+(vbW-right)+'" y2="'+baseY+'" stroke="rgba(255,255,255,.12)" stroke-width="0.6"/>';

  el.innerHTML =
    '<svg viewBox="0 0 '+vbW+' '+vbH+'" preserveAspectRatio="none" '+
    'style="width:100%;height:170px;display:block">'
      + grid +
      bars +
    '</svg>';
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
