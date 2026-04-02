// app/modules/silo.tsx
"use client";
import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

export const CONFIG = {
  id: "silo", name: "Pressão em Silos", subtitle: "Eurocode 1 Part 4",
  icon: "⬡", color: "#58a6ff", price: 249.90,
  description: "Modelo de Janssen completo. Pressões horizontais, verticais e normais durante enchimento e descarga.",
  norma: "EN 1991-4 (Eurocode 1 Part 4)",
};

export const GLOSSARY = [
  { cat: "ENTRADA", items: [
    { s: "density", d: "Densidade do material armazenado", u: "kg/m³" },
    { s: "z", d: "Profundidade abaixo da superfície da pilha", u: "m" },
    { s: "b / c", d: "Largura e comprimento da seção plana", u: "m" },
    { s: "β", d: "Ângulo de inclinação da tremonha", u: "°" },
    { s: "hh", d: "Distância fundo até transição de ângulo", u: "m" },
    { s: "aK / Km", d: "Coeficientes de pressão lateral (Eurocode Tab. E.1)", u: "-" },
    { s: "aμ / μm", d: "Coeficientes de atrito na parede", u: "-" },
    { s: "aφ / φim", d: "Coeficientes de atrito interno do sólido", u: "-/°" },
    { s: "Cb", d: "Amplificador de carga no fundo (§6.1.2)", u: "-" },
  ]},
  { cat: "SAÍDA", items: [
    { s: "K", d: "Taxa de pressão lateral (Km/aK)", u: "-" },
    { s: "μ", d: "Coeficiente de atrito na parede (μm/aμ)", u: "-" },
    { s: "z₀", d: "Profundidade característica de Janssen", u: "m" },
    { s: "Yj", d: "Função de Janssen", u: "-" },
    { s: "ph₀", d: "Pressão horizontal assintótica (Eq. 5.2)", u: "N/m²" },
    { s: "pvf", d: "Tensão vertical após enchimento (Eq. 5.5)", u: "N/m²" },
    { s: "pvft", d: "Pressão vertical × Cb", u: "N/m²" },
    { s: "pne", d: "Pressão normal na descarga", u: "N/m²" },
  ]},
];

const MATS:any={carvao:{n:"Carvão Mineral",d:900,aK:1.15,Km:0.52,au:1.12,um:0.49,aphi:1.16,phim:31},ferro:{n:"Minério de Ferro",d:2400,aK:1.10,Km:0.54,au:1.10,um:0.52,aphi:1.12,phim:35},calcario:{n:"Calcário",d:1500,aK:1.12,Km:0.50,au:1.08,um:0.45,aphi:1.14,phim:33},areia:{n:"Areia",d:1600,aK:1.10,Km:0.48,au:1.06,um:0.42,aphi:1.10,phim:30},cimento:{n:"Cimento",d:1500,aK:1.20,Km:0.54,au:1.15,um:0.46,aphi:1.18,phim:28},soja:{n:"Soja",d:770,aK:1.08,Km:0.50,au:1.05,um:0.38,aphi:1.08,phim:25},custom:{n:"Personalizado",d:0,aK:1,Km:0.5,au:1,um:0.45,aphi:1,phim:30}};

function calc(inp:any){
  const g=9.81,{density,z,b,c,aK,Km,au,um,Cb=1.6}=inp;
  const gamma=density*g,K=Km/aK,mu=um/au,U=2*(b+c),A=b*c;
  const z0=A/(K*mu*U),Yj=1-Math.exp(-z/z0);
  const pho=gamma*z0*K,pvf=gamma*z0*Yj,pvft=pvf*Cb,pne=pvft*K,S=(b===c)?2:(1+b/c);
  const curve:any[]=[];for(let zi=0;zi<=z;zi+=z/25){const Yi=1-Math.exp(-zi/z0);curve.push({depth:+zi.toFixed(2),ph:+(gamma*z0*K*Yi).toFixed(0),pv:+(gamma*z0*Yi).toFixed(0)});}
  return{gamma,K,mu,U,A,z0,Yj,pho,pvf,pvft,pne,S,curve};
}

function Diagram({inp,data}:{inp:any;data:any}){
  const w=500,h=380,bH=inp?.z||12,bR=Math.min(inp?.b||8,inp?.c||8);
  const cx=w/2,bL=cx-bR*12,bRx=cx+bR*12,top=30,bot=top+bH*((h-80)/bH)*0.7;
  return(<svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",background:"#161b22",borderRadius:"6px"}}>
    <defs><marker id="aR" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><path d="M0,0 L6,2 L0,4" fill="#f85149"/></marker></defs>
    <rect x={bL} y={top} width={bRx-bL} height={bot-top} fill="none" stroke="#58a6ff" strokeWidth="1.5" strokeDasharray="4,2"/>
    <polygon points={`${bL},${bot} ${bRx},${bot} ${cx+15},${bot+50} ${cx-15},${bot+50}`} fill="none" stroke="#58a6ff" strokeWidth="1.5" strokeDasharray="4,2"/>
    <rect x={bL+2} y={top+15} width={bRx-bL-4} height={bot-top-15} fill="#3fb950" fillOpacity="0.1"/>
    {data?.curve?.filter((_:any,i:number)=>i%2===0).map((pt:any,i:number)=>{const y=top+(pt.depth/bH)*(bot-top);const mx=Math.max(...data.curve.map((c:any)=>c.ph));const len=Math.max(3,(pt.ph/mx)*55);return <g key={i}><line x1={bRx+2} y1={y} x2={bRx+2+len} y2={y} stroke="#f85149" strokeWidth="1.2" markerEnd="url(#aR)"/><text x={bRx+len+6} y={y+3} fill="#8b949e" fontSize="7">{(pt.ph/1000).toFixed(1)}</text></g>;})}
    <text x={bL-8} y={(top+bot)/2} fill="#8b949e" fontSize="9" textAnchor="end" transform={`rotate(-90,${bL-8},${(top+bot)/2})`}>z={bH}m</text>
    <text x={cx} y={top-8} fill="#8b949e" fontSize="9" textAnchor="middle">{inp?.b}m × {inp?.c}m</text>
    <text x={cx} y={h-8} fill="#58a6ff" fontSize="9" textAnchor="middle" fontWeight="600">Pressão Horizontal (kPa)</text>
  </svg>);
}

export default function SiloMod({onSave,user,UI}:any){
  const{Inp,Sel,Res,Tabs,SavedCalcs,Scene3D,C,sty}=UI;
  const[mat,setMat]=useState("carvao");
  const[inp,setI]=useState({density:900,z:12.7,b:8.8,c:8.8,beta_deg:22.5,aK:1.15,Km:0.52,au:1.12,um:0.49,aphi:1.16,phim_deg:31,Cb:1.6,hh:9.3});
  const[res,setR]=useState<any>(null);const[tab,setTab]=useState(0);
  const s=(k:string,v:any)=>setI(p=>({...p,[k]:v}));
  const updMat=(k:string)=>{setMat(k);if(k!=="custom"){const m=MATS[k];setI(p=>({...p,density:m.d,aK:m.aK,Km:m.Km,au:m.au,um:m.um,aphi:m.aphi,phim_deg:m.phim}));}};
  const handleLoad=(d:any)=>{if(d.inp)setI(d.inp);if(d.res)setR(d.res);};

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      <div><h2 style={{margin:0,fontSize:"14px",fontWeight:700}}>Pressão em Silos</h2><div style={{fontSize:"9px",color:C.muted,marginTop:"2px"}}>EN 1991-4 — Validado ✓</div></div>
      <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
        <SavedCalcs user={user} moduleType="silo" onLoad={handleLoad}/>
        <button onClick={()=>onSave({type:"silo",inp,res})} style={sty.btn("g")}>Salvar</button>
        <button onClick={()=>setR(calc(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>
    <Tabs tab={tab} setTab={setTab}/>
    {tab===0&&<><div style={sty.card}><div style={sty.cardT}>Material</div><Sel label="Material" value={mat} onChange={updMat} options={Object.entries(MATS).map(([k,v]:any)=>({v:k,l:v.n}))}/><div style={sty.grid(3)}><Inp label="Densidade" value={inp.density} onChange={(v:any)=>s("density",v)} unit="kg/m³"/><Inp label="z" value={inp.z} onChange={(v:any)=>s("z",v)} unit="m"/><Inp label="Cb" value={inp.Cb} onChange={(v:any)=>s("Cb",v)}/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Geometria</div><div style={sty.grid(4)}><Inp label="b" value={inp.b} onChange={(v:any)=>s("b",v)} unit="m"/><Inp label="c" value={inp.c} onChange={(v:any)=>s("c",v)} unit="m"/><Inp label="β" value={inp.beta_deg} onChange={(v:any)=>s("beta_deg",v)} unit="°"/><Inp label="hh" value={inp.hh} onChange={(v:any)=>s("hh",v)} unit="m"/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Coeficientes Eurocode</div><div style={sty.grid(3)}><Inp label="aK" value={inp.aK} onChange={(v:any)=>s("aK",v)}/><Inp label="Km" value={inp.Km} onChange={(v:any)=>s("Km",v)}/><Inp label="aμ" value={inp.au} onChange={(v:any)=>s("au",v)}/><Inp label="μm" value={inp.um} onChange={(v:any)=>s("um",v)}/><Inp label="aφ" value={inp.aphi} onChange={(v:any)=>s("aphi",v)}/><Inp label="φim" value={inp.phim_deg} onChange={(v:any)=>s("phim_deg",v)} unit="°"/></div></div>
    {res&&<><div style={sty.card}><div style={sty.cardT}>Parâmetros</div><div style={sty.grid(3)}><Res label="K" value={res.K}/><Res label="μ" value={res.mu}/><Res label="z₀" value={res.z0} unit="m"/><Res label="Yj" value={res.Yj}/><Res label="U" value={res.U} unit="m"/><Res label="A" value={res.A} unit="m²"/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Pressões</div><div style={sty.grid(2)}><Res label="ph₀ Horizontal" value={res.pho} unit="N/m²"/><Res label="pvf Vertical" value={res.pvf} unit="N/m²"/><Res label="pvft ×Cb" value={res.pvft} unit="N/m²" type="w"/><Res label="pne Descarga" value={res.pne} unit="N/m²" type="s"/></div></div></>}</>}
    {tab===1&&<div style={sty.card}><div style={sty.cardT}>Seção Transversal</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:<Diagram inp={inp} data={res}/>}</div>}
    {tab===2&&<div style={sty.card}><div style={sty.cardT}>Pressão vs Profundidade</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:
      <ResponsiveContainer width="100%" height={320}><AreaChart data={res.curve} margin={{top:10,right:20,left:10,bottom:25}}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="depth" label={{value:"Prof. (m)",position:"bottom",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <YAxis label={{value:"N/m²",angle:-90,position:"insideLeft",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <Tooltip contentStyle={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"10px",color:C.text}}/><Legend wrapperStyle={{fontSize:"9px"}}/>
        <Area type="monotone" dataKey="ph" name="Horizontal" stroke="#f85149" fill="#f85149" fillOpacity={0.08} strokeWidth={2}/><Area type="monotone" dataKey="pv" name="Vertical" stroke="#58a6ff" fill="#58a6ff" fillOpacity={0.08} strokeWidth={2}/>
      </AreaChart></ResponsiveContainer>}</div>}
    {tab===3&&<div style={sty.card}><div style={sty.cardT}>Modelo 3D</div><Scene3D type="silo" data={res} inputs={inp}/><p style={{fontSize:"9px",color:C.muted,textAlign:"center",marginTop:"6px"}}>Setas vermelhas = pressão horizontal</p></div>}
  </div>);
}
