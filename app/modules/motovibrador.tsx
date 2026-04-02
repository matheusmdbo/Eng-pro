// app/modules/motovibrador.tsx
"use client";
import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";

export const CONFIG = {
  id: "motovibrador", name: "Motovibrador", subtitle: "Calhas Vibratórias",
  icon: "◎", color: "#a371f7", price: 199.90,
  description: "Dimensionamento de motovibradores. Frequência, amplitude, aceleração, torque e verificação.",
  norma: "Catálogo Vimot 2017",
};

export const GLOSSARY = [
  { cat: "ENTRADA", items: [
    { s: "cap_m3h", d: "Capacidade de alimentação", u: "m³/h" },
    { s: "larg_m/comp_m/alt_m", d: "Dimensões da calha", u: "m" },
    { s: "ang_deg", d: "Ângulo de inclinação", u: "°" },
    { s: "fv", d: "Fator de velocidade (1.3→10°, 2.7→30°)", u: "-" },
    { s: "peso_conj", d: "Peso do conjunto calha+motores", u: "kgf" },
    { s: "rpm", d: "Rotação do motor", u: "rpm" },
    { s: "torque_disp", d: "Torque disponível por motor", u: "kgf.cm" },
    { s: "n_mot", d: "Nº de motovibradores", u: "-" },
  ]},
  { cat: "SAÍDA", items: [
    { s: "vel_cm", d: "Velocidade de projeto", u: "cm/s" },
    { s: "freq", d: "Frequência do motor", u: "Hz" },
    { s: "amp", d: "Amplitude requerida", u: "cm" },
    { s: "acel", d: "Aceleração requerida", u: "cm/s²" },
    { s: "mult_g", d: "Multiplicador gravitacional", u: "g" },
    { s: "torque_total", d: "Torque total requerido", u: "kgf.cm" },
    { s: "torque_mot", d: "Torque por motor", u: "kgf.cm" },
    { s: "margem", d: "Margem disponível/requerido", u: "%" },
  ]},
];

function calc(inp:any){
  const{cap_m3h,larg_m,alt_m,peso_conj,rpm,torque_disp,n_mot,fv}=inp;
  const vel=cap_m3h/3600/(larg_m*alt_m),vel_cm=vel*100,freq=rpm/60,omega=2*Math.PI*freq;
  const amp=(vel_cm/(2*Math.PI*freq))*fv,acel=amp*omega*omega,mult_g=acel/981;
  const torque_total=(peso_conj*amp)/(2*Math.PI),torque_mot=torque_total/n_mot;
  const ok=torque_mot<=torque_disp,margem=(torque_disp-torque_mot)/torque_disp*100;
  const curve:any[]=[];for(let f=5;f<=40;f++){const w2=2*Math.PI*f;const a=(vel_cm/(2*Math.PI*f))*fv;curve.push({freq:f,amplitude:+a.toFixed(3),aceleracao:+(a*w2*w2/981).toFixed(2)});}
  return{vel_cm,freq,amp,acel,mult_g,torque_total,torque_mot,ok,margem,curve};
}

function Diagram({data}:{data:any}){
  const w=480,h=230;
  return(<svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",background:"#161b22",borderRadius:"6px"}}>
    <g transform="rotate(-8,240,90)"><rect x={120} y={75} width={240} height={15} fill="#484f58" fillOpacity="0.25" stroke="#484f58" strokeWidth="1.5" rx="2"/><rect x={120} y={60} width={3} height={30} fill="#484f58"/><rect x={357} y={60} width={3} height={30} fill="#484f58"/><rect x={123} y={72} width={234} height={3} fill="#3fb950" fillOpacity="0.2" rx="1"/>
    <circle cx={180} cy={96} r="12" fill="#d29922" fillOpacity="0.2" stroke="#d29922" strokeWidth="1.5"/><text x={180} y={99} fill="#d29922" fontSize="6" textAnchor="middle">M1</text>
    <circle cx={300} cy={96} r="12" fill="#d29922" fillOpacity="0.2" stroke="#d29922" strokeWidth="1.5"/><text x={300} y={99} fill="#d29922" fontSize="6" textAnchor="middle">M2</text></g>
    {[160,240,320].map((x,i)=><path key={i} d={`M${x},112 L${x-4},120 L${x+4},125 L${x-4},130 L${x+4},135 L${x-4},140 L${x},145`} fill="none" stroke="#58a6ff" strokeWidth="1"/>)}
    <line x1={130} y1={152} x2={350} y2={152} stroke="#8b949e" strokeWidth="2"/>
    {[0,1,2].map(i=><circle key={i} cx={240} cy={65} r={12+i*10} fill="none" stroke="#58a6ff" strokeWidth="0.4" opacity={0.35-i*0.08} strokeDasharray="2,2"/>)}
    <text x={240} y={45} fill="#58a6ff" fontSize="9" textAnchor="middle">f = {data?.freq?.toFixed(1)||"?"} Hz · A = {data?.amp?.toFixed(2)||"?"} cm</text>
    <text x={240} y={180} fill="#8b949e" fontSize="8" textAnchor="middle">{data?.mult_g?.toFixed(1)||"?"} g · Torque/motor = {data?.torque_mot?.toFixed(1)||"?"} kgf.cm</text>
    <text x={240} y={200} fill="#58a6ff" fontSize="9" textAnchor="middle" fontWeight="500">Calha Vibratória</text>
  </svg>);
}

export default function MotoMod({onSave,user,UI}:any){
  const{Inp,Res,Badge,Tabs,SavedCalcs,Scene3D,C,sty}=UI;
  const[inp,setI]=useState({cap_m3h:395,larg_m:1.99,comp_m:1.14,alt_m:0.16,ang_deg:30,peso_calha:315.8,peso_conj:660.3,rpm:1150,torque_disp:260,n_mot:2,fv:2.7});
  const[res,setR]=useState<any>(null);const[tab,setTab]=useState(0);const s=(k:string,v:any)=>setI(p=>({...p,[k]:v}));
  const handleLoad=(d:any)=>{if(d.inp)setI(d.inp);if(d.res)setR(d.res);};

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      <div><h2 style={{margin:0,fontSize:"14px",fontWeight:700}}>Motovibrador</h2><div style={{fontSize:"9px",color:C.muted,marginTop:"2px"}}>Calhas vibratórias — Validado ✓</div></div>
      <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
        <SavedCalcs user={user} moduleType="motovibrador" onLoad={handleLoad}/>
        <button onClick={()=>onSave({type:"motovibrador",inp,res})} style={sty.btn("g")}>Salvar</button>
        <button onClick={()=>setR(calc(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>
    <Tabs tab={tab} setTab={setTab}/>
    {tab===0&&<><div style={sty.card}><div style={sty.cardT}>Calha</div><div style={sty.grid(3)}><Inp label="Capacidade" value={inp.cap_m3h} onChange={(v:any)=>s("cap_m3h",v)} unit="m³/h"/><Inp label="Largura" value={inp.larg_m} onChange={(v:any)=>s("larg_m",v)} unit="m"/><Inp label="Comprimento" value={inp.comp_m} onChange={(v:any)=>s("comp_m",v)} unit="m"/><Inp label="Altura" value={inp.alt_m} onChange={(v:any)=>s("alt_m",v)} unit="m"/><Inp label="Ângulo" value={inp.ang_deg} onChange={(v:any)=>s("ang_deg",v)} unit="°"/><Inp label="Fator vel." value={inp.fv} onChange={(v:any)=>s("fv",v)}/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Acionamento</div><div style={sty.grid(3)}><Inp label="Peso calha" value={inp.peso_calha} onChange={(v:any)=>s("peso_calha",v)} unit="kgf"/><Inp label="Peso conjunto" value={inp.peso_conj} onChange={(v:any)=>s("peso_conj",v)} unit="kgf"/><Inp label="Nº motores" value={inp.n_mot} onChange={(v:any)=>s("n_mot",v)}/><Inp label="RPM" value={inp.rpm} onChange={(v:any)=>s("rpm",v)} unit="rpm"/><Inp label="Torque disp." value={inp.torque_disp} onChange={(v:any)=>s("torque_disp",v)} unit="kgf.cm"/></div></div>
    {res&&<div style={sty.card}><div style={sty.cardT}>Resultados <Badge ok={res.ok} y="APROVADO" n="REPROVADO"/></div><div style={sty.grid(3)}><Res label="Vel. projeto" value={res.vel_cm} unit="cm/s"/><Res label="Frequência" value={res.freq} unit="Hz"/><Res label="Amplitude" value={res.amp} unit="cm"/><Res label="Aceleração" value={res.acel} unit="cm/s²"/><Res label="Mult. g" value={res.mult_g} unit="g"/><Res label="Torque total" value={res.torque_total} unit="kgf.cm" type="w"/><Res label="Torque/motor" value={res.torque_mot} unit="kgf.cm" type={res.ok?"s":"d"}/><Res label="Torque disp." value={inp.torque_disp} unit="kgf.cm" type="s"/><Res label="Margem" value={res.margem} unit="%" type={res.margem>20?"s":"w"}/></div></div>}</>}
    {tab===1&&<div style={sty.card}><div style={sty.cardT}>Diagrama 2D</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:<Diagram data={res}/>}</div>}
    {tab===2&&<div style={sty.card}><div style={sty.cardT}>Amplitude e Aceleração vs Frequência</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:
      <ResponsiveContainer width="100%" height={300}><LineChart data={res.curve} margin={{top:10,right:20,left:10,bottom:25}}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="freq" label={{value:"Frequência (Hz)",position:"bottom",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <YAxis yAxisId="l" label={{value:"cm",angle:-90,position:"insideLeft",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <YAxis yAxisId="r" orientation="right" label={{value:"g",angle:90,position:"insideRight",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <Tooltip contentStyle={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"10px",color:C.text}}/><Legend wrapperStyle={{fontSize:"9px"}}/>
        <Line yAxisId="l" type="monotone" dataKey="amplitude" name="Amplitude (cm)" stroke="#58a6ff" strokeWidth={2} dot={false}/>
        <Line yAxisId="r" type="monotone" dataKey="aceleracao" name="Aceleração (g)" stroke="#d29922" strokeWidth={2} dot={false}/>
        <ReferenceLine yAxisId="l" x={Math.round(res.freq)} stroke="#f85149" strokeDasharray="3 3"/>
      </LineChart></ResponsiveContainer>}</div>}
    {tab===3&&<div style={sty.card}><div style={sty.cardT}>Modelo 3D</div><Scene3D type="motovibrador" data={res} inputs={inp}/><p style={{fontSize:"9px",color:C.muted,textAlign:"center",marginTop:"6px"}}>Vibração animada · Motovibradores (amarelo)</p></div>}
  </div>);
}
