const REG={0:'Unassigned (simulated)',1:'PHILIPPINES (total)',2:'NCR',3:'CAR',4:'Region I',5:'Region II',6:'Region III',7:'Region IV-A',8:'MIMAROPA',9:'Region V',10:'Region VI',11:'Negros Island',12:'Region VII',13:'Region VIII',14:'Region IX',15:'Region X',16:'Region XI',17:'Region XII',18:'Caraga',19:'BARMM',20:'Foreign Country'};
const COLS=['Region','Year','Total','Male','Female','Marital','Marital M','Marital F','Non-marital','Non-marital M','Non-marital F','Type'];
const $=id=>document.getElementById(id), fmt=n=>Math.round(n).toLocaleString();
let rows,MED,RAW=RAW_TOTAL,years=[];
const rn=k=>REG[k]||'Region '+k;

// ---------- UI setup ----------
$('region').innerHTML='<option value="all">All</option>'+Object.entries(REG).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
document.querySelectorAll('#side select').forEach(s=>s.onchange=render);
document.querySelectorAll('#side input[type=range]').forEach(s=>s.oninput=render);
$('model').onchange=()=>{const t=document.querySelector('#tabs .on').dataset.t;if(t=='overview'||t=='explore'||t=='dq')document.querySelector('#tabs [data-t=model]').click();else render();};
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x==b));
  ['overview','explore','nb','model','est','dq'].forEach(t=>$(t=='model'?'pane-model':t).hidden=t!=b.dataset.t);render();});

const charts={};
function chart(id,cfg){charts[id]&&charts[id].destroy();Chart.defaults.color='#a3a8b8';Chart.defaults.borderColor='#2b2f3b';
  cfg.options=Object.assign({responsive:true,maintainAspectRatio:true},cfg.options||{});charts[id]=new Chart($(id),cfg);}
const kpi=(l,v)=>`<div class="kpi"><small>${l}</small><div>${v}</div></div>`;
const TEAL='#1fc8c0',RED='#ff5c5c',BLUE='#1c83e1';

function filtered(){
  const a=+$('yFrom').value,b=+$('yTo').value,rg=$('region').value,rt=$('rtype').value,oc=$('outcome').value;
  return rows.filter(r=>r.y>=a&&r.y<=b&&(rg=='all'||r.reg==rg)&&(rt=='all'||r.sim==rt)&&(oc=='all'||r.lab==oc));
}
const sum=(d,k)=>d.reduce((s,r)=>s+r[k],0);

// ---------- Models (exact results from the Colab notebook) ----------
function init(data,rawTotal){
  RAW=rawTotal;$('form').innerHTML='';
  rows=data.map(a=>({reg:a[0],y:a[1],t:a[2],tm:a[3],tf:a[4],m:a[5],n:a[8],sim:a[11],a}));
  const base=rows.filter(r=>!r.sim),a=(base.length?base:rows).map(r=>r.m).sort((p,q)=>p-q),h=a.length>>1;MED=a.length%2?a[h]:(a[h-1]+a[h])/2;rows.forEach(r=>r.lab=r.m>MED?1:0);
  years=[...new Set(rows.map(r=>r.y))].sort();
  ['yFrom','yTo'].forEach(id=>{$(id).min=years[0];$(id).max=years[years.length-1];});
  $('yFrom').value=years[0];$('yTo').value=years[years.length-1];
}
function syncRange(){let a=+$('yFrom').value,b=+$('yTo').value;
  if(a>b){if(document.activeElement==$('yFrom'))a=$('yFrom').value=b;else b=$('yTo').value=a;}
  const mn=+$('yFrom').min,sp=(+$('yFrom').max-mn)||1;$('v1').textContent=a;$('v2').textContent=b;
  $('fill').style.left=(a-mn)/sp*100+'%';$('fill').style.width=(b-a)/sp*100+'%';}
function readCSV(f){const r=new FileReader();r.onload=()=>{try{
  const L=r.result.trim().split(/\r?\n/),H=L[0].split(',').map(x=>x.trim().replace(/^"|"$/g,'').toLowerCase());
  const need=['region','year','total both sexes','total male','total female','marital both sexes','marital male','marital female','non-marital both sexes','non-marital male','non-marital female'];
  const ix=need.map(n=>H.indexOf(n));if(ix.includes(-1))throw 0;const ti=H.indexOf('record type'),data=[];
  L.slice(1).forEach(l=>{const c=l.split(',').map(x=>x.replace(/"/g,''));const v=ix.slice(1).map(i=>parseFloat(c[i]));if(v.some(isNaN))return;
    const g=parseInt(c[ix[0]]);data.push([isNaN(g)?0:g,...v.map(Math.round),ti>-1&&/sim/i.test(c[ti])?1:0]);});
  if(!data.length)throw 0;init(data,L.length-1);$('src').textContent='Using '+f.name;render();
  }catch(e){$('src').textContent='Could not read the CSV. It needs the same columns as the included dataset.';}};r.readAsText(f);}
$('browse').onclick=()=>$('file').click();$('file').onchange=e=>e.target.files[0]&&readCSV(e.target.files[0]);
$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('over');};$('drop').ondragleave=()=>$('drop').classList.remove('over');
$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('over');e.dataTransfer.files[0]&&readCSV(e.dataTransfer.files[0]);};
const NM=Object.keys(NOTEBOOK.models),NF=NOTEBOOK.meta.features;
const FLAB={Year:'Year',Total_Both_Sexes:'Total births (both sexes)',Total_Male:'Total male births',Total_Female:'Total female births',Non_Marital_Both_Sexes:'Non-marital births (both sexes)'};
const sig=v=>1/(1+Math.exp(-v));
function treeP(t,x){let n=0;while(t.l[n]!==-1)n=x[t.f[n]]<=t.th[n]?t.l[n]:t.r[n];return t.v[n];}
function predictP(name,x){const p=NOTEBOOK.models[name].p;
  if(name=='Gaussian Naive Bayes'){const l=[0,1].map(c=>Math.log(p.prior[c])+x.reduce((s,v,j)=>s-0.5*Math.log(2*Math.PI*p.var[c][j])-(v-p.mu[c][j])**2/(2*p.var[c][j]),0));return sig(l[1]-l[0]);}
  if(name=='Decision Tree')return treeP(p,x);
  if(name=='Random Forest')return p.reduce((s,t)=>s+treeP(t,x),0)/p.length;
  return sig(x.reduce((s,v,j)=>s+p.w[j]*(v-p.mean[j])/p.scale[j],p.b));}
// ---------- Renderers ----------
function render(){
  syncRange();
  const d=filtered(),tab=document.querySelector('#tabs .on').dataset.t,hi=d.filter(r=>r.lab).length;
  if(tab=='overview'){
    $('kpis').innerHTML=kpi('Filtered records',fmt(d.length))+kpi('Positive outcomes',fmt(hi))+
      kpi('Positive rate',d.length?(100*hi/d.length).toFixed(1)+'%':'–')+kpi('Average births',d.length?fmt(sum(d,'t')/d.length):'–');
    const n0=d.length-hi,lp={id:'vl',afterDatasetsDraw(c){const x=c.ctx;x.save();x.fillStyle='#0e1117';x.font='12px sans-serif';x.textAlign='center';
      c.data.datasets.forEach((ds,k)=>c.getDatasetMeta(k).data.forEach((b,i)=>{if(ds.data[i])x.fillText(fmt(ds.data[i]),b.x,b.y+16);}));x.restore();}};
    chart('c_out',{type:'bar',plugins:[lp],data:{labels:['Negative','Positive'],datasets:[{label:'Negative',data:[n0,null],backgroundColor:TEAL},{label:'Positive',data:[null,hi],backgroundColor:RED}]},
      options:{plugins:{legend:{position:'right',title:{display:true,text:'Outcome'}}},scales:{x:{stacked:true},y:{stacked:true,title:{display:true,text:'Count'}}}}});
    const top=[...d].map(r=>r.t).sort((a,b)=>a-b)[Math.floor(d.length*.97)]||1,bins=12,w=top/bins,h=[Array(bins).fill(0),Array(bins).fill(0)];
    d.forEach(r=>h[r.lab][Math.min(bins-1,Math.floor(r.t/w))]++);
    chart('c_hist',{type:'bar',data:{labels:h[0].map((_,i)=>fmt(i*w)),datasets:[{label:'0',data:h[0],backgroundColor:BLUE},{label:'1',data:h[1],backgroundColor:TEAL}]},
      options:{plugins:{legend:{position:'right',title:{display:true,text:'Outcome'}}},scales:{x:{stacked:true,title:{display:true,text:'Total births per record'}},y:{stacked:true,title:{display:true,text:'count'}}}}});
  }
  if(tab=='explore'){
    const ys=years.filter(y=>d.some(r=>r.y==y)),by=y=>d.filter(r=>r.y==y);
    chart('c_year',{type:'bar',data:{labels:ys,datasets:[{label:'Marital',data:ys.map(y=>sum(by(y),'m')),backgroundColor:TEAL},{label:'Non-marital',data:ys.map(y=>sum(by(y),'n')),backgroundColor:RED}]},options:{scales:{x:{stacked:true},y:{stacked:true}}}});
    const rg=Object.keys(REG).filter(k=>k>1).map(k=>{const x=d.filter(r=>r.reg==k);return[rn(k),x.length?sum(x,'t')/x.length:0];}).filter(a=>a[1]).sort((a,b)=>b[1]-a[1]);
    chart('c_reg',{type:'bar',data:{labels:rg.map(a=>a[0]),datasets:[{data:rg.map(a=>a[1]),backgroundColor:BLUE}]},options:{indexAxis:'y',plugins:{legend:{display:false}}}});
    chart('c_sex',{type:'line',data:{labels:ys,datasets:[{label:'Male',data:ys.map(y=>sum(by(y),'tm')),borderColor:BLUE},{label:'Female',data:ys.map(y=>sum(by(y),'tf')),borderColor:RED}]}});
    chart('c_mar',{type:'doughnut',data:{labels:['Marital','Non-marital'],datasets:[{data:[sum(d,'m'),sum(d,'n')],backgroundColor:[TEAL,RED],borderWidth:0}]}});
    $('tbl').innerHTML='<tr>'+COLS.map(c=>`<th>${c}</th>`).join('')+'</tr>'+d.slice(0,15).map(r=>'<tr><td>'+rn(r.reg)+'</td>'+r.a.slice(1,11).map((v,i)=>`<td>${i?fmt(v):v}</td>`).join('')+`<td>${r.sim?'Simulated':'Original'}</td></tr>`).join('');
  }
  if(tab=='nb'){
    const med=a=>{a=[...a].sort((p,q)=>p-q);const n=a.length,k=n>>1;return n%2?a[k]:(a[k-1]+a[k])/2;},f2=v=>v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const ks=[['Total_Both_Sexes','t'],['Total_Male','tm'],['Total_Female','tf'],['Marital_Both_Sexes','m'],['Non_Marital_Both_Sexes','n']];
    $('stats').innerHTML='<tr><th></th><th>Mean</th><th>Median</th><th>Std Dev</th><th>Minimum</th><th>Maximum</th></tr>'+ks.map(([l,k])=>{const v=d.map(r=>r[k]),n=v.length,mu=v.reduce((a,b)=>a+b,0)/(n||1),sd=Math.sqrt(v.reduce((a,b)=>a+(b-mu)**2,0)/((n-1)||1));
      return `<tr><td>${l}</td><td>${f2(mu)}</td><td>${f2(med(v))}</td><td>${f2(sd)}</td><td>${f2(Math.min(...v))}</td><td>${f2(Math.max(...v))}</td></tr>`;}).join('');
    ['eda','bins','scatter','dist'].forEach(k=>$('g_'+k).src=FIG[k]);
  }
  if(tab=='model'){
    $('g_cm').src=FIG.cm;$('g_roc').src=FIG.roc;
    const name=$('model').value,m=NOTEBOOK.models[name],M=NOTEBOOK.meta,f4=v=>v.toFixed(4);
    $('modelInfo').textContent=`${name} · same setup as the notebook: ${M.n} cleaned records of the original dataset, stratified 80/20 split (${M.ntrain} train / ${M.ntest} test, random_state=42). Target: marital births > median (${fmt(M.median)}). Features: ${M.features.join(', ')}.`;
    $('mkpis').innerHTML=kpi('Accuracy',f4(m.acc))+kpi('Precision',f4(m.prec))+kpi('Recall',f4(m.rec))+kpi('F1-Score',f4(m.f1));
    $('cm').innerHTML=`<tr><th></th><th>Pred 0</th><th>Pred 1</th></tr><tr><th>Actual 0</th><td>${m.cm[0][0]}</td><td>${m.cm[0][1]}</td></tr><tr><th>Actual 1</th><td>${m.cm[1][0]}</td><td>${m.cm[1][1]}</td></tr>`;
    const R=m.report,row=(l,o)=>`<tr><td>${l}</td><td>${o.precision.toFixed(2)}</td><td>${o.recall.toFixed(2)}</td><td>${o['f1-score'].toFixed(2)}</td><td>${o.support}</td></tr>`;
    $('rep').innerHTML='<tr><th></th><th>precision</th><th>recall</th><th>f1-score</th><th>support</th></tr>'+row('0',R['0'])+row('1',R['1'])+`<tr><td>accuracy</td><td></td><td></td><td>${R.accuracy.toFixed(2)}</td><td>${R['macro avg'].support}</td></tr>`+row('macro avg',R['macro avg'])+row('weighted avg',R['weighted avg']);
    $('cmpt').innerHTML='<tr><th>Model</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1-Score</th><th>AUC</th></tr>'+NM.map(n=>{const q=NOTEBOOK.models[n];return `<tr${n==name?' style="color:#ff4b4b"':''}><td>${n}</td><td>${f4(q.acc)}</td><td>${f4(q.prec)}</td><td>${f4(q.rec)}</td><td>${f4(q.f1)}</td><td>${f4(q.auc)}</td></tr>`;}).join('');
    chart('c_cmp',{type:'bar',data:{labels:NM,datasets:[['Accuracy','acc',TEAL],['Precision','prec',BLUE],['Recall','rec','#f5b942'],['F1-Score','f1',RED]].map(([l,k,c])=>({label:l,data:NM.map(n=>NOTEBOOK.models[n][k]),backgroundColor:c}))},options:{scales:{y:{min:0,max:1}}}});
  }
  if(tab=='est'&&!$('form').children.length){
    $('form').innerHTML=NF.map((f,j)=>`<label>${FLAB[f]}<input type="number" id="f${j}" value="${NOTEBOOK.meta.medians[j]}"></label>`).join('');
  }
  if(tab=='dq'){
    const miss=RAW-rows.length,simN=rows.filter(r=>r.sim).length;
    $('dqk').innerHTML=kpi('Raw records',fmt(RAW_TOTAL))+kpi('Dropped (missing)',fmt(miss))+kpi('Simulated rows',fmt(simN))+kpi('Original rows',fmt(rows.length-simN));
    const ks=[['Total','t'],['Male','tm'],['Female','tf'],['Marital','m'],['Non-marital','n']];
    $('dqt').innerHTML='<tr><th>Column</th><th>Min</th><th>Mean</th><th>Max</th><th>Sex mismatch rows</th></tr>'+ks.map(([l,k])=>{const v=d.map(r=>r[k]);
      return `<tr><td>${l}</td><td>${fmt(Math.min(...v))}</td><td>${fmt(v.reduce((a,b)=>a+b,0)/(v.length||1))}</td><td>${fmt(Math.max(...v))}</td><td>${k=='t'?d.filter(r=>r.tm+r.tf!=r.t).length:'–'}</td></tr>`;}).join('');
  }
}
$('go').onclick=()=>{
  const x=NF.map((_,j)=>+$('f'+j).value),name=$('model').value,p=predictP(name,x),hi=p>0.5;
  $('result').innerHTML=`${name}: <span class="pill" style="background:${hi?'#7a1f1f':'#0f5f5b'}">${hi?'High (1)':'Low (0)'} marital births</span> &nbsp; probability of High: ${(p*100).toFixed(1)}%`;
};
init(DATA,RAW_TOTAL);render();
