// app/modules/pistao.tsx
"use client";
import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";

export const CONFIG = {
  id: "pistao", name: "Pistão de Abertura", subtitle: "Cilindros Hidráulicos",
  icon: "⇥", color: "#d29922", price: 199.90,
  description: "Dimensionamento de cilindros hidráulicos para comportas. Forças, fator de segurança e velocidade.",
  norma: "Eurocode 1 Part 4 · Catálogo Rexnord",
};

export const GLOSSARY = [
  { cat: "ENTRADA", items: [
    { s: "p_bar", d: "Pressão da unidade hidráulica", u: "bar" },
    { s: "Aa/Ar", d: "Áreas de atuação e retorno do pistão", u: "cm²" },
    { s: "curso_mm", d: "Curso máximo do pistão", u: "mm" },
    { s: "t_ab", d: "Tempo de abertura", u: "s" },
    { s: "peso_kg", d: "Peso da comporta", u: "kg" },
    { s: "μ_rod", d: "Coef. atrito das rodas", u: "-" },
    { s: "larg_m/comp_m", d: "Dimensões da saída", u: "m" },
    { s: "pn_Nm2", d: "Pressão do material (módulo Silo)", u: "N/m²" },
    { s: "n_pist", d: "Número de pistões", u: "-" },
  ]},
  { cat: "SAÍDA", items: [
    { s: "Fa/Fr", d: "Forças de atuação e retorno", u: "kN" },
    { s: "vel", d: "Velocidade de abertura", u: "m/s" },
    { s: "F máx", d: "Força máxima necessária (t=0)", u: "kN" },
    { s: "F disp", d: "Força total disponível", u: "kN" },
    { s: "FS", d: "Fator de segurança (mín. 1.2)", u: "-" },
  ]},
];

function calc(inp:any){
  const g=9.81,{p_bar,Aa_cm2,Ar_cm2,t_ab,peso_kg,mu_rod=0.02,larg_m,comp_m,pn_Nm2,n_pist=1}=inp;
  const Fa=p_bar*Aa_cm2/10,Fr=p_bar*Ar_cm2/10,vel=comp_m/t_ab;
  const steps:any[]=[];
  for(let i=0;i<=10;i++){const frac=i/10;const ac=comp_m*frac;const ar=larg_m*(comp_m-ac);const fm=pn_Nm2*ar;const at=mu_rod*peso_kg*g;steps.push({t:+(t_ab*frac).toFixed(2),comp_ab:+ac.toFixed(3),area_cob:+ar.toFixed(3),forca_mat:+fm.toFixed(0),forca_total:+(fm+at).toFixed(0)});}
  const f_max=steps[0].forca_total,f_disp=Fa*1000*n_pist,fs=f_disp/f_max;
  return{Fa,Fr,vel,steps,f_max,f_disp,fs,ok:fs>=1.2};
}

function Diagram({data}:{data:any}){
  const w=480,h=260;
  return(<svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",background:"#161b22",borderRadius:"6px"}}>
    <defs><marker id="ad" markerWidth="5" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L5,2 L0,4" fill="#f85149"/></marker><marker id="ag" markerWidth="5" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L5,2 L0,4" fill="#3fb950"/></marker></defs>
    <rect x={90} y={20} width={300} height={80} fill="#3fb950" fillOpacity="0.08" stroke="#484f58" strokeWidth="1"/><text x={240} y={50} fill="#3fb950" fontSize="9" textAnchor="middle" opacity="0.5">MATERIAL</text>
    <rect x={120} y={100} width={240} height={12} fill="#484f58" stroke="#8b949e" strokeWidth="1" rx="2"/><text x={240} y={109} fill="#c9d1d9" fontSize="7" textAnchor="middle">COMPORTA</text>
    <rect x={30} y={125} width={90} height={20} fill="#d29922" fillOpacity="0.25" stroke="#d29922" strokeWidth="1.5" rx="3"/><text x={75} y={138} fill="#d29922" fontSize="7" textAnchor="middle">CILINDRO</text>
    <rect x={120} y={130} width={70} height={8} fill="#c9d1d9" fillOpacity="0.2" stroke="#c9d1d9" strokeWidth="0.8" rx="1"/>
    {[155,195,235,275,315].map((x,i)=><line key={i} x1={x} y1={78} x2={x} y2={98} stroke="#f85149" strokeWidth="1.3" markerEnd="url(#ad)"/>)}
    <line x1={35} y1={135} x2={118} y2={135} stroke="#3fb950" strokeWidth="2" markerEnd="url(#ag)"/>
    <text x={76} y={123} fill="#3fb950" fontSize="7" textAnchor="middle">Fa={data?.Fa?.toFixed(1)||"?"} kN</text>
    {data?.steps&&<g><text x={240} y={175} fill="#58a6ff" fontSize="8" textAnchor="middle" fontWeight="600">Força × Tempo</text>
    {data.steps.filter((_:any,i:number)=>i%2===0).map((s:any,i:number)=>{const mx=data.steps[0].forca_mat||1;const bh=Math.max(2,(s.forca_mat/mx)*50);return <g key={i}><rect x={80+i*60} y={230-bh} width={40} height={bh} fill="#58a6ff" fillOpacity="0.2" stroke="#58a6ff" strokeWidth="0.5" rx="2"/><text x={100+i*60} y={240} fill="#8b949e" fontSize="7" textAnchor="middle">{s.t}s</text></g>;})}</g>}
  </svg>);
}

export default function PistMod({onSave,user,UI}:any){
  const{Inp,Res,Badge,Tabs,SavedCalcs,Scene3D,C,sty}=UI;
  const[inp,setI]=useState({p_bar:140,Aa_cm2:50.26,Ar_cm2:25.63,curso_mm:1600,t_ab:2.9,peso_kg:1097,n_rodas:8,mu_rod:0.02,larg_m:1.6,comp_m:1.1,pn_Nm2:170000,n_pist:1});
  const[res,setR]=useState<any>(null);const[tab,setTab]=useState(0);const s=(k:string,v:any)=>setI(p=>({...p,[k]:v}));
  const handleLoad=(d:any)=>{if(d.inp)setI(d.inp);if(d.res)setR(d.res);};

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      <div><h2 style={{margin:0,fontSize:"14px",fontWeight:700}}>Pistão de Abertura</h2><div style={{fontSize:"9px",color:C.muted,marginTop:"2px"}}>Cilindros hidráulicos — Validado ✓</div></div>
      <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
        <SavedCalcs user={user} moduleType="pistao" onLoad={handleLoad}/>
        <button onClick={()=>onSave({type:"pistao",inp,res})} style={sty.btn("g")}>Salvar</button>
        <button onClick={()=>setR(calc(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>
    <Tabs tab={tab} setTab={setTab}/>
    {tab===0&&<><div style={sty.card}><div style={sty.cardT}>Cilindro</div><div style={sty.grid(3)}><Inp label="Pressão UH" value={inp.p_bar} onChange={(v:any)=>s("p_bar",v)} unit="bar"/><Inp label="Área atuação" value={inp.Aa_cm2} onChange={(v:any)=>s("Aa_cm2",v)} unit="cm²"/><Inp label="Área retorno" value={inp.Ar_cm2} onChange={(v:any)=>s("Ar_cm2",v)} unit="cm²"/><Inp label="Curso" value={inp.curso_mm} onChange={(v:any)=>s("curso_mm",v)} unit="mm"/><Inp label="Tempo abert." value={inp.t_ab} onChange={(v:any)=>s("t_ab",v)} unit="s"/><Inp label="Nº pistões" value={inp.n_pist} onChange={(v:any)=>s("n_pist",v)}/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Comporta</div><div style={sty.grid(3)}><Inp label="Peso" value={inp.peso_kg} onChange={(v:any)=>s("peso_kg",v)} unit="kg"/><Inp label="Nº rodas" value={inp.n_rodas} onChange={(v:any)=>s("n_rodas",v)}/><Inp label="μ rodas" value={inp.mu_rod} onChange={(v:any)=>s("mu_rod",v)}/><Inp label="Larg. saída" value={inp.larg_m} onChange={(v:any)=>s("larg_m",v)} unit="m"/><Inp label="Comp. saída" value={inp.comp_m} onChange={(v:any)=>s("comp_m",v)} unit="m"/><Inp label="P. material" value={inp.pn_Nm2} onChange={(v:any)=>s("pn_Nm2",v)} unit="N/m²"/></div></div>
    {res&&<><div style={sty.card}><div style={sty.cardT}>Forças <Badge ok={res.ok} y="FS≥1.2" n="FS<1.2"/></div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"10px"}}><thead><tr>{["t(s)","Abert.(m)","Área(m²)","F mat(N)","F tot(N)"].map((h,i)=><th key={i} style={{padding:"5px 6px",textAlign:"left",borderBottom:`1px solid ${C.accent}33`,color:C.accent,fontSize:"8px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
      <tbody>{res.steps.filter((_:any,i:number)=>i%2===0).map((st:any,i:number)=><tr key={i}><td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`}}>{st.t}</td><td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`}}>{st.comp_ab}</td><td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`}}>{st.area_cob}</td><td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`,color:C.warn}}>{st.forca_mat.toLocaleString()}</td><td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`,color:C.warn}}>{st.forca_total.toLocaleString()}</td></tr>)}</tbody></table></div>
    <div style={sty.card}><div style={sty.cardT}>Verificação</div><div style={sty.grid(3)}><Res label="Fa" value={res.Fa} unit="kN"/><Res label="Fr" value={res.Fr} unit="kN"/><Res label="Vel." value={res.vel} unit="m/s"/><Res label="F máx" value={res.f_max/1000} unit="kN" type="w"/><Res label="F disp" value={res.f_disp/1000} unit="kN" type="s"/><Res label="FS" value={res.fs} type={res.fs>=1.5?"s":res.fs>=1.2?"w":"d"}/></div></div></>}</>}
    {tab===1&&<div style={sty.card}><div style={sty.cardT}>Diagrama 2D</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:<Diagram data={res}/>}</div>}
    {tab===2&&<div style={sty.card}><div style={sty.cardT}>Força vs Tempo</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:
      <ResponsiveContainer width="100%" height={300}><AreaChart data={res.steps} margin={{top:10,right:20,left:10,bottom:25}}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="t" label={{value:"Tempo (s)",position:"bottom",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <YAxis label={{value:"N",angle:-90,position:"insideLeft",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <Tooltip contentStyle={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"10px",color:C.text}}/><Legend wrapperStyle={{fontSize:"9px"}}/>
        <Area type="monotone" dataKey="forca_total" name="F total" stroke="#f85149" fill="#f85149" fillOpacity={0.1} strokeWidth={2}/>
        <Area type="monotone" dataKey="forca_mat" name="F material" stroke="#58a6ff" fill="#58a6ff" fillOpacity={0.08} strokeWidth={2}/>
        <ReferenceLine y={res.f_disp} stroke="#3fb950" strokeDasharray="5 3" label={{value:"F disp",fill:"#3fb950",fontSize:9}}/>
      </AreaChart></ResponsiveContainer>}</div>}
    {tab===3&&<div style={sty.card}><div style={sty.cardT}>Modelo 3D</div><Scene3D type="pistao" data={res} inputs={inp}/><p style={{fontSize:"9px",color:C.muted,textAlign:"center",marginTop:"6px"}}>Vermelho=pressão material · Verde=força pistão</p></div>}
  </div>);
}
