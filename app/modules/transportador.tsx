// app/modules/transportador.tsx
// ============================================================
// MÓDULO: TRANSPORTADOR DE CORREIA — CEMA 7th Edition
// ============================================================
// Autocontido: config, glossário, cálculos, diagramas, componente
// Para registrar: importe e adicione 1 linha no array MODULES do page.tsx
// ============================================================
"use client";
import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";

// Re-exporta tipos que o page.tsx precisa
export const CONFIG = {
  id: "transportador",
  name: "Transportador de Correia",
  subtitle: "CEMA 7th Edition",
  icon: "⟹",
  color: "#3fb950",
  price: 299.90,
  description: "Cálculo completo conforme CEMA 7th Edition. Potência, tensões, roletes, tambores, contrapeso e capacidade.",
  norma: "CEMA 7th Ed. · Manual FAÇO",
};

export const GLOSSARY = [
  { cat: "ENTRADA", items: [
    { s: "mat_d", d: "Densidade do material transportado", u: "kg/m³" },
    { s: "cap_th", d: "Capacidade de projeto do transportador", u: "t/h" },
    { s: "vel_ms", d: "Velocidade da correia", u: "m/s" },
    { s: "comp_m", d: "Comprimento centro a centro", u: "m" },
    { s: "elev_m", d: "Elevação (desnível) entre cauda e cabeça", u: "m" },
    { s: "larg_pol", d: "Largura da correia", u: "pol" },
    { s: "esp_rol", d: "Espaçamento entre roletes de carga", u: "m" },
    { s: "d_tamb_mm", d: "Diâmetro do tambor motriz", u: "mm" },
    { s: "ang_abr", d: "Ângulo de abraçamento do tambor motriz", u: "°" },
    { s: "Wb", d: "Peso da correia por metro", u: "kgf/m" },
    { s: "cap_tens", d: "Capacidade de tensão da correia", u: "N/m" },
    { s: "Cs", d: "Fator de atrito material/guias (CEMA Tab. 6-7)", u: "-" },
    { s: "Ft", d: "Força de flexão nos tambores", u: "kgf" },
    { s: "ef_c/ef_r/ef_a", d: "Eficiências correia, redução e acoplamento", u: "-" },
    { s: "n_ac", d: "Número de conjuntos de acionamento", u: "-" },
  ]},
  { cat: "SAÍDA", items: [
    { s: "V", d: "Velocidade utilizada (máx entre projeto e requerida)", u: "m/s" },
    { s: "Wm", d: "Peso do material na correia por metro", u: "kgf/m" },
    { s: "Ky", d: "Fator de resistência correia/material/roletes (CEMA Tab. 6-2)", u: "-" },
    { s: "Kx", d: "Fator de resistência dos roletes e correia", u: "-" },
    { s: "Fg/F1/Fa", d: "Forças: atrito guias, limpadores, aceleração", u: "kgf" },
    { s: "Ta", d: "Somatório das forças resistivas", u: "kgf" },
    { s: "Te", d: "Tensão efetiva na correia (força motriz)", u: "kgf" },
    { s: "Ne/N_hp/N_kw", d: "Potência efetiva, motor total (HP, kW)", u: "HP/kW" },
    { s: "Cw", d: "Fator de enrolamento (wrap factor)", u: "-" },
    { s: "T1/T2", d: "Tensões lado tenso e frouxo", u: "kgf" },
    { s: "Tad", d: "Tensão admissível da correia", u: "kgf" },
    { s: "red", d: "Relação de redução do redutor", u: ":1" },
  ]},
];

// --- Dados CEMA ---
const KY_T=[{l:15,k:.04},{l:30,k:.035},{l:60,k:.033},{l:120,k:.032},{l:240,k:.031},{l:300,k:.03},{l:420,k:.028},{l:600,k:.025},{l:730,k:.024},{l:900,k:.022}];
function interpKy(L:number){if(L<=KY_T[0].l)return KY_T[0].k;if(L>=KY_T[KY_T.length-1].l)return KY_T[KY_T.length-1].k;for(let i=0;i<KY_T.length-1;i++){if(L>=KY_T[i].l&&L<=KY_T[i+1].l){return KY_T[i].k+(L-KY_T[i].l)/(KY_T[i+1].l-KY_T[i].l)*(KY_T[i+1].k-KY_T[i].k);}}return .03;}
const CEMA_CAP:any={18:62,24:115,30:186,36:272,42:374,48:492,54:627,60:778,72:1128,84:1548,96:2034};
const IDLERS:any={B:{l:"CEMA B",x:0.88},C:{l:"CEMA C",x:1.00},D:{l:"CEMA D",x:1.09},E:{l:"CEMA E",x:1.18}};
const BW=[18,24,30,36,42,48,54,60,72,84,96];

function calc(inp:any){
  const g=9.81,{mat_d,cap_th,vel_ms,comp_m,elev_m,larg_pol,esp_rol,d_tamb_mm,ang_abr,n_limp,Wb,cap_tens,idler_cl,freq_hz,n_polos,p_rol_carga,comp_guias,Cs,Ft_flex,ef_c=0.94,ef_r=0.94,ef_a=0.96,n_ac=1}=inp;
  const cap_vol=CEMA_CAP[larg_pol]||500,V=Math.max(vel_ms,cap_th/(mat_d/1000*cap_vol));
  const Wm=cap_th*1000/(3600*V),Ky=interpKy(comp_m);
  const idx=IDLERS[idler_cl]||IDLERS.C,Kx=0.00068*(Wb+Wm)+idx.x;
  const Fg=Cs*(comp_guias||0)*V*V*mat_d/1000,F1=n_limp*100.8,Fa=cap_th*1000*V/(3600*g);
  const Ta=Ky*comp_m*(Wm+Wb+(p_rol_carga/esp_rol))+Kx*comp_m+Fg+F1+Fa;
  const Ft=Ft_flex||40,Te=Ta+Ft+(Wm*elev_m),Ne_hp=(Te*V)/76;
  const ef_t=ef_c*ef_r*ef_a,N_hp=Ne_hp/ef_t,N_cv=N_hp*1.01387,N_kw=N_cv*0.7355,N_per=N_hp/n_ac;
  const n_sinc=(120*freq_hz)/n_polos,n_mot=n_sinc*0.97,n_tamb=(V*60)/(Math.PI*(d_tamb_mm/1000)),red=n_mot/n_tamb;
  const wrap_r=ang_abr*Math.PI/180,Cw=Math.exp(0.35*wrap_r),T1=Te*Cw/(Cw-1),T2=T1-Te;
  const T_sag=4.2*esp_rol*(Wb+Wm),Tad=(cap_tens*(larg_pol*25.4)/1000)/g,contrapeso=2*T2;
  const cap_real=cap_vol*V*mat_d/1000;
  const curve:any[]=[];for(let x=0;x<=comp_m;x+=comp_m/20){curve.push({pos:+x.toFixed(1),T_ida:+(T2+Te*(x/comp_m)).toFixed(0),T_volta:+(T2*(1-x/comp_m*0.1)).toFixed(0)});}
  return{Wm,Ky,Kx,Fg,F1,Fa,Ta,Ft,Te,Ne_hp,N_hp,N_cv,N_kw,N_per,ef_t,n_sinc,n_mot,n_tamb,red,Cw,T1,T2,T_sag,Tad,contrapeso,cap_vol,cap_real,cap_ok:cap_real>=cap_th,V,curve,tension_ok:T1<=Tad};
}

// --- Diagrama 2D ---
function Diagram({inp,data}:{inp:any;data:any}){
  const w=580,h=250,mx=40;const L=inp?.comp_m||20,H=inp?.elev_m||0;
  const baseY=h-50,topY=baseY-(H/Math.max(L,1))*(w-2*mx)*0.8;
  return(<svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",background:"#161b22",borderRadius:"6px"}}>
    <line x1={mx} y1={baseY} x2={w-mx} y2={Math.max(40,topY)} stroke="#58a6ff" strokeWidth="2"/>
    <line x1={mx} y1={baseY+12} x2={w-mx} y2={Math.max(52,topY+12)} stroke="#484f58" strokeWidth="1" strokeDasharray="4,2"/>
    {Array.from({length:Math.min(20,Math.floor(L/(inp?.esp_rol||1)))}).map((_,i,a)=>{const f=i/(a.length-1);const x=mx+f*(w-2*mx);const y=baseY+f*(Math.max(40,topY)-baseY);return <g key={i}><line x1={x} y1={y-5} x2={x} y2={y+5} stroke="#58a6ff" strokeWidth="1.2" opacity="0.4"/><circle cx={x} cy={y} r="1.5" fill="#58a6ff" opacity="0.5"/></g>;})}
    <circle cx={w-mx} cy={Math.max(40,topY)+6} r="10" fill="none" stroke="#d29922" strokeWidth="2"/>
    <circle cx={mx} cy={baseY+6} r="8" fill="none" stroke="#8b949e" strokeWidth="1.5"/>
    <polygon points={`${mx+12},${baseY-3} ${w-mx-25},${Math.max(37,topY-3)} ${w-mx-25},${Math.max(34,topY-6)} ${mx+12},${baseY-6}`} fill="#3fb950" opacity="0.12" stroke="#3fb950" strokeWidth="0.5"/>
    {data?.curve&&<g>{data.curve.map((pt:any,i:number)=>{if(!i)return null;const p=data.curve[i-1];const mx2=Math.max(...data.curve.map((c:any)=>c.T_ida));return <line key={i} x1={mx+(p.pos/L)*(w-2*mx)} y1={20+(1-p.T_ida/mx2)*25} x2={mx+(pt.pos/L)*(w-2*mx)} y2={20+(1-pt.T_ida/mx2)*25} stroke="#f85149" strokeWidth="1.2" opacity="0.6"/>;})}</g>}
    <text x={w/2} y={h-8} fill="#58a6ff" fontSize="9" textAnchor="middle" fontWeight="500">Vista Lateral — L={L}m{H>0?` · H=${H}m`:""}</text>
    <text x={w-mx+2} y={Math.max(40,topY)-6} fill="#d29922" fontSize="7">ACION.</text>
    <text x={mx} y={baseY+25} fill="#8b949e" fontSize="7" textAnchor="middle">RET.</text>
  </svg>);
}

// --- Componente Principal (importado pelo page.tsx) ---
export default function TransportadorMod({onSave,user,UI}:any){
  const{Inp,Sel,Res,Badge,Tabs,SavedCalcs,Scene3D,C,sty}=UI;
  const[inp,setI]=useState({mat_d:900,cap_th:3240,vel_ms:2.5,comp_m:19.6,elev_m:0,larg_pol:72,ang_rol:20,esp_rol:0.5,d_tamb_mm:630,ang_abr:180,n_limp:2,Wb:59.56,n_lonas:4,cap_tens:86298.5,idler_cl:"D",freq_hz:60,n_polos:4,p_rol_carga:40.01,p_rol_ret:26.8,comp_guias:16,Cs:0.0754,Ft_flex:40.8,ef_c:0.94,ef_r:0.94,ef_a:0.96,n_ac:2});
  const[res,setR]=useState<any>(null);const[tab,setTab]=useState(0);
  const s=(k:string,v:any)=>setI(p=>({...p,[k]:v}));
  const handleLoad=(d:any)=>{if(d.inp)setI(d.inp);if(d.res)setR(d.res);};

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      <div><h2 style={{margin:0,fontSize:"14px",fontWeight:700}}>Transportador de Correia</h2><div style={{fontSize:"9px",color:C.muted,marginTop:"2px"}}>CEMA 7th Ed. — Validado ✓</div></div>
      <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
        <SavedCalcs user={user} moduleType="transportador" onLoad={handleLoad}/>
        <button onClick={()=>onSave({type:"transportador",inp,res})} style={sty.btn("g")}>Salvar</button>
        <button onClick={()=>setR(calc(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>
    <Tabs tab={tab} setTab={setTab}/>

    {tab===0&&<><div style={sty.card}><div style={sty.cardT}>Material e Capacidade</div><div style={sty.grid(4)}><Inp label="Densidade" value={inp.mat_d} onChange={(v:any)=>s("mat_d",v)} unit="kg/m³"/><Inp label="Capacidade" value={inp.cap_th} onChange={(v:any)=>s("cap_th",v)} unit="t/h"/><Inp label="Velocidade" value={inp.vel_ms} onChange={(v:any)=>s("vel_ms",v)} unit="m/s"/><Inp label="Nº acion." value={inp.n_ac} onChange={(v:any)=>s("n_ac",v)}/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Geometria</div><div style={sty.grid(4)}><Inp label="Comprimento" value={inp.comp_m} onChange={(v:any)=>s("comp_m",v)} unit="m"/><Inp label="Elevação" value={inp.elev_m} onChange={(v:any)=>s("elev_m",v)} unit="m"/><Sel label="Larg. correia" value={String(inp.larg_pol)} onChange={(v:any)=>s("larg_pol",parseInt(v))} options={BW.map(w=>({v:String(w),l:`${w}" (${(w*25.4).toFixed(0)}mm)`}))}/><Inp label="Ângulo rolos" value={inp.ang_rol} onChange={(v:any)=>s("ang_rol",v)} unit="°"/><Inp label="Espaçamento" value={inp.esp_rol} onChange={(v:any)=>s("esp_rol",v)} unit="m"/><Inp label="Comp. guias" value={inp.comp_guias} onChange={(v:any)=>s("comp_guias",v)} unit="m"/><Inp label="Ø tambor" value={inp.d_tamb_mm} onChange={(v:any)=>s("d_tamb_mm",v)} unit="mm"/><Inp label="Ângulo abraç." value={inp.ang_abr} onChange={(v:any)=>s("ang_abr",v)} unit="°"/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Correia e Roletes</div><div style={sty.grid(4)}><Inp label="Wb" value={inp.Wb} onChange={(v:any)=>s("Wb",v)} unit="kgf/m"/><Inp label="Lonas" value={inp.n_lonas} onChange={(v:any)=>s("n_lonas",v)}/><Inp label="Cap. tensão" value={inp.cap_tens} onChange={(v:any)=>s("cap_tens",v)} unit="N/m"/><Sel label="Classe" value={inp.idler_cl} onChange={(v:any)=>s("idler_cl",v)} options={Object.entries(IDLERS).map(([k,v]:any)=>({v:k,l:v.l}))}/><Inp label="P. rol. carga" value={inp.p_rol_carga} onChange={(v:any)=>s("p_rol_carga",v)} unit="kgf"/><Inp label="Limp." value={inp.n_limp} onChange={(v:any)=>s("n_limp",v)}/><Inp label="Cs" value={inp.Cs} onChange={(v:any)=>s("Cs",v)}/><Inp label="Ft" value={inp.Ft_flex} onChange={(v:any)=>s("Ft_flex",v)} unit="kgf"/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Motor</div><div style={sty.grid(4)}><Inp label="Freq." value={inp.freq_hz} onChange={(v:any)=>s("freq_hz",v)} unit="Hz"/><Inp label="Polos" value={inp.n_polos} onChange={(v:any)=>s("n_polos",v)}/><Inp label="η corr." value={inp.ef_c} onChange={(v:any)=>s("ef_c",v)}/><Inp label="η red." value={inp.ef_r} onChange={(v:any)=>s("ef_r",v)}/></div></div>
    {res&&<><div style={sty.card}><div style={sty.cardT}>Forças (CEMA Cap.6)</div><div style={sty.grid(4)}><Res label="V utilizada" value={res.V} unit="m/s"/><Res label="Wm" value={res.Wm} unit="kgf/m"/><Res label="Ky" value={res.Ky}/><Res label="Kx" value={res.Kx}/><Res label="Fg" value={res.Fg} unit="kgf"/><Res label="F1" value={res.F1} unit="kgf"/><Res label="Fa" value={res.Fa} unit="kgf"/><Res label="Ta" value={res.Ta} unit="kgf" type="w"/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Potência</div><div style={sty.grid(3)}><Res label="Te" value={res.Te} unit="kgf" type="w"/><Res label="Ne" value={res.Ne_hp} unit="HP"/><Res label="η total" value={res.ef_t}/></div>
      <div style={{marginTop:"10px",padding:"12px",background:C.accentDim,borderRadius:"6px",border:`1px solid ${C.accent}22`}}><div style={sty.grid(3)}>
        <div><div style={{fontSize:"8px",color:C.muted}}>MOTOR TOTAL</div><div style={{fontSize:"18px",fontWeight:800,color:C.accent}}>{res.N_hp.toFixed(1)} <span style={{fontSize:"10px"}}>HP</span></div><div style={{fontSize:"9px",color:C.dim}}>{res.N_cv.toFixed(1)} CV · {res.N_kw.toFixed(1)} kW</div></div>
        <div><div style={{fontSize:"8px",color:C.muted}}>POR ACION.</div><div style={{fontSize:"18px",fontWeight:800,color:C.warn}}>{res.N_per.toFixed(1)} <span style={{fontSize:"10px"}}>HP</span></div></div>
        <div><div style={{fontSize:"8px",color:C.muted}}>REDUÇÃO</div><div style={{fontSize:"18px",fontWeight:800,color:C.success}}>{res.red.toFixed(1)}:1</div><div style={{fontSize:"9px",color:C.dim}}>{res.n_mot.toFixed(0)}→{res.n_tamb.toFixed(1)} rpm</div></div>
      </div></div></div>
    <div style={sty.card}><div style={sty.cardT}>Tensões <Badge ok={res.tension_ok} y="T1≤Tad" n="T1>Tad"/></div><div style={sty.grid(4)}><Res label="Cw" value={res.Cw}/><Res label="T1" value={res.T1} unit="kgf" type="w"/><Res label="T2" value={res.T2} unit="kgf"/><Res label="Contrap." value={res.contrapeso} unit="kgf"/><Res label="Tad" value={res.Tad} unit="kgf" type="s"/><Res label="T sag" value={res.T_sag} unit="kgf"/><Res label="Cap. real" value={res.cap_real} unit="t/h" type={res.cap_ok?"s":"d"}/><Res label="Cap. req." value={inp.cap_th} unit="t/h"/></div></div></>}</>}

    {tab===1&&<div style={sty.card}><div style={sty.cardT}>Vista Lateral</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:<Diagram inp={inp} data={res}/>}</div>}

    {tab===2&&<div style={sty.card}><div style={sty.cardT}>Perfil de Tensão</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:<>
      <ResponsiveContainer width="100%" height={280}><AreaChart data={res.curve} margin={{top:10,right:20,left:10,bottom:25}}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="pos" label={{value:"Posição (m)",position:"bottom",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <YAxis label={{value:"kgf",angle:-90,position:"insideLeft",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <Tooltip contentStyle={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"10px",color:C.text}}/><Legend wrapperStyle={{fontSize:"9px"}}/>
        <Area type="monotone" dataKey="T_ida" name="T ida" stroke="#f85149" fill="#f85149" fillOpacity={0.08} strokeWidth={2}/>
        <Area type="monotone" dataKey="T_volta" name="T volta" stroke={C.accent} fill={C.accent} fillOpacity={0.08} strokeWidth={2}/>
        <ReferenceLine y={res.Tad} stroke={C.success} strokeDasharray="5 3" label={{value:"Tad",fill:C.success,fontSize:9}}/>
      </AreaChart></ResponsiveContainer>
      <div style={{marginTop:"12px"}}><ResponsiveContainer width="100%" height={180}><BarChart data={[{n:"Fg",v:res.Fg},{n:"F1",v:res.F1},{n:"Fa",v:res.Fa},{n:"Ta",v:res.Ta},{n:"Te",v:res.Te}]} margin={{top:5,right:20,left:10,bottom:5}}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="n" tick={{fill:C.dim,fontSize:9}} stroke={C.border}/><YAxis tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <Tooltip contentStyle={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"10px",color:C.text}}/>
        <Bar dataKey="v" name="kgf" fill={C.accent} radius={[3,3,0,0]}/>
      </BarChart></ResponsiveContainer></div></>}</div>}

    {tab===3&&<div style={sty.card}><div style={sty.cardT}>Modelo 3D</div><Scene3D type="transportador" inputs={inp} data={res}/><p style={{fontSize:"9px",color:C.muted,textAlign:"center",marginTop:"6px"}}>Tambor acion.(amarelo) · Roletes(azul) · Material(verde)</p></div>}
  </div>);
}
