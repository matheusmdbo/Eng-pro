// app/page.tsx
// ============================================================
// ENGCALC PRO v4 — Arquivo Principal
// ============================================================
// PARA ADICIONAR NOVO MÓDULO:
//   1. Crie app/modules/novo-modulo.tsx (copie um existente como base)
//   2. Adicione 1 import + 1 linha no array MODULES abaixo
//   Pronto. Nada mais precisa mudar.
// ============================================================
"use client";
import { useState, useEffect, useRef, ComponentType } from "react";
import * as THREE from "three";

// ============================================================
// IMPORTS DOS MÓDULOS (1 linha por módulo)
// ============================================================
import TransportadorMod, { CONFIG as tcCfg, GLOSSARY as tcGloss } from "./modules/transportador";
import SiloMod, { CONFIG as siloCfg, GLOSSARY as siloGloss } from "./modules/silo";
import MotoMod, { CONFIG as motoCfg, GLOSSARY as motoGloss } from "./modules/motovibrador";
import PistMod, { CONFIG as pistCfg, GLOSSARY as pistGloss } from "./modules/pistao";
// import PeneiraMod, { CONFIG as penCfg, GLOSSARY as penGloss } from "./modules/peneira";  // ← exemplo futuro

// ============================================================
// REGISTRO DE MÓDULOS (1 linha por módulo)
// ============================================================
const MODULES = [
  { ...tcCfg,   Component: TransportadorMod, glossary: tcGloss },
  { ...siloCfg, Component: SiloMod,          glossary: siloGloss },
  { ...motoCfg, Component: MotoMod,          glossary: motoGloss },
  { ...pistCfg, Component: PistMod,          glossary: pistGloss },
  // { ...penCfg, Component: PeneiraMod, glossary: penGloss },  // ← exemplo futuro
];

const BUNDLE_PRICE = 749.90;
const OWNER_EMAIL = "admin@engcalcpro.com"; // ← ALTERE PARA SEU E-MAIL

// ============================================================
// STORAGE
// ============================================================
const ST = {
  async get(k:string){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch{return null}},
  async set(k:string,v:any){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}},
  async list(p:string){try{return Object.keys(localStorage).filter(k=>k.startsWith(p))}catch{return []}},
  async del(k:string){try{localStorage.removeItem(k);return true}catch{return false}},
};

// ============================================================
// CORES E ESTILOS
// ============================================================
const C:any = {
  bg:"#060a10",s1:"#0d1117",s2:"#161b22",s3:"#1c2333",
  accent:"#58a6ff",accent2:"#79c0ff",accentDim:"rgba(88,166,255,0.08)",
  warn:"#d29922",danger:"#f85149",success:"#3fb950",
  text:"#c9d1d9",dim:"#8b949e",muted:"#484f58",border:"#21262d",
};
const sty:any = {
  input:{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:"4px",color:C.text,fontSize:"12px",fontFamily:"inherit",outline:"none",boxSizing:"border-box" as const},
  label:{display:"block",fontSize:"9px",color:C.muted,marginBottom:"3px",letterSpacing:"0.8px",textTransform:"uppercase" as const,fontWeight:500},
  card:{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"18px",marginBottom:"14px"},
  cardT:{fontSize:"11px",fontWeight:600,color:C.accent,marginBottom:"14px",letterSpacing:"1.5px",textTransform:"uppercase" as const,paddingBottom:"8px",borderBottom:`1px solid ${C.border}`},
  btn:(v="p")=>({padding:"8px 18px",background:v==="p"?C.accent:v==="d"?C.danger:"transparent",border:v==="g"?`1px solid ${C.border}`:"none",borderRadius:"5px",color:v==="p"?C.bg:C.text,fontSize:"11px",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}),
  sel:{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:"4px",color:C.text,fontSize:"12px",fontFamily:"inherit",outline:"none",boxSizing:"border-box" as const},
  tab:(a:boolean)=>({padding:"6px 14px",background:a?C.accentDim:"transparent",border:a?`1px solid ${C.accent}33`:`1px solid transparent`,borderRadius:"5px",color:a?C.accent:C.dim,cursor:"pointer",fontSize:"10px",fontWeight:a?600:400,fontFamily:"inherit"}),
  resBox:(t:string)=>({padding:"10px 14px",background:t==="s"?"rgba(63,185,80,0.06)":t==="d"?"rgba(248,81,73,0.06)":t==="w"?"rgba(210,153,34,0.06)":C.accentDim,border:`1px solid ${t==="s"?"#3fb95030":t==="d"?"#f8514930":t==="w"?"#d2992230":C.accent+"30"}`,borderRadius:"5px"}),
  grid:(n:number)=>({display:"grid",gridTemplateColumns:`repeat(${n},1fr)`,gap:"10px"}),
};

// ============================================================
// COMPONENTES COMPARTILHADOS (passados aos módulos via prop UI)
// ============================================================
function Inp({label,value,onChange,unit,type="number"}:any){
  return(<div style={{marginBottom:"8px"}}><label style={sty.label}>{label}{unit&&<span style={{color:C.accent}}> ({unit})</span>}</label>
  <input type={type} step="any" style={sty.input} value={value} onChange={(e:any)=>onChange(type==="number"?parseFloat(e.target.value)||0:e.target.value)}/></div>);
}
function Sel({label,value,onChange,options}:any){
  return(<div style={{marginBottom:"8px"}}><label style={sty.label}>{label}</label>
  <select style={sty.sel} value={value} onChange={(e:any)=>onChange(e.target.value)}>{options.map((o:any)=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);
}
function Res({label,value,unit,type="i"}:any){
  const col=type==="s"?C.success:type==="d"?C.danger:type==="w"?C.warn:C.accent;
  return(<div style={sty.resBox(type)}><div style={{fontSize:"9px",color:C.muted,textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</div>
  <div style={{fontSize:"16px",fontWeight:700,color:col,marginTop:"2px"}}>{typeof value==="number"?value.toFixed(2):value}<span style={{fontSize:"10px",fontWeight:400,color:C.dim,marginLeft:"4px"}}>{unit}</span></div></div>);
}
function Badge({ok,y="OK",n="FALHA"}:any){return <span style={{padding:"2px 8px",borderRadius:"10px",fontSize:"9px",fontWeight:600,background:ok?C.success+"18":C.danger+"18",color:ok?C.success:C.danger,border:`1px solid ${ok?C.success:C.danger}33`}}>{ok?y:n}</span>}
function Tabs({tab,setTab}:any){return(<div style={{display:"flex",gap:"5px",marginBottom:"14px",flexWrap:"wrap" as const}}>{["Cálculo","Diagrama 2D","Gráficos","Modelo 3D"].map((t:string,i:number)=><button key={i} onClick={()=>setTab(i)} style={sty.tab(tab===i)}>{t}</button>)}</div>);}

// SavedCalcs Dropdown (genérico, funciona para qualquer módulo)
function SavedCalcs({user,moduleType,onLoad}:any){
  const[open,setOpen]=useState(false);const[calcs,setCalcs]=useState<any[]>([]);const ref=useRef<HTMLDivElement>(null);
  const load=async()=>{const keys=await ST.list(`p:${user.email}:`);const items:any[]=[];for(const k of keys){const d=await ST.get(k);if(d&&d.type===moduleType)items.push({...d,_k:k});}items.sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime());setCalcs(items);};
  useEffect(()=>{const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  return(<div ref={ref} style={{position:"relative"}}><button onClick={async()=>{if(!open)await load();setOpen(!open)}} style={{...sty.btn("g"),fontSize:"9px",padding:"6px 12px"}}>📂 Salvos ▼</button>
    {open&&<div style={{position:"absolute",top:"100%",right:0,marginTop:"6px",zIndex:150,width:"300px",maxHeight:"350px",overflowY:"auto",background:C.s1,border:`1px solid ${C.border}`,borderRadius:"6px",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
      <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,fontSize:"9px",color:C.accent,fontWeight:600}}>CÁLCULOS SALVOS</div>
      {calcs.length===0?<div style={{padding:"16px",textAlign:"center",color:C.muted,fontSize:"10px"}}>Nenhum salvo</div>:calcs.map((c,i)=>(
        <div key={i} onClick={()=>{onLoad(c);setOpen(false)}} style={{padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}} onMouseEnter={e=>(e.currentTarget.style.background=C.accentDim)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
          <div><div style={{fontSize:"10px",color:C.text}}>{c.name}</div><div style={{fontSize:"8px",color:C.muted}}>{new Date(c.at).toLocaleDateString("pt-BR")}</div></div>
          <button onClick={async(e)=>{e.stopPropagation();await ST.del(c._k);setCalcs(p=>p.filter(x=>x._k!==c._k))}} style={{background:"none",border:"none",color:C.danger,cursor:"pointer",fontSize:"11px",fontFamily:"inherit"}}>✕</button>
        </div>))}
    </div>}
  </div>);
}

// Scene3D (genérico, cada módulo passa type)
function Scene3D({type,data,inputs}:any){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current)return;
    const w=ref.current.clientWidth,h=340;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x060a10);
    const cam=new THREE.PerspectiveCamera(45,w/h,0.1,1000);
    const ren=new THREE.WebGLRenderer({antialias:true});ren.setSize(w,h);ren.setPixelRatio(2);
    ref.current.innerHTML='';ref.current.appendChild(ren.domElement);
    scene.add(new THREE.AmbientLight(0x404060,0.6));const dl=new THREE.DirectionalLight(0xffffff,0.8);dl.position.set(5,8,5);scene.add(dl);scene.add(new THREE.PointLight(0x58a6ff,0.4,20));scene.add(new THREE.GridHelper(10,10,0x21262d,0x161b22));
    const grp=new THREE.Group();
    if(type==="silo"){const bH=(inputs?.z||12)*0.3,bR=Math.sqrt((inputs?.b||8)*(inputs?.c||8))/2*0.3,hH=(inputs?.hh||4)*0.3;grp.add(new THREE.Mesh(new THREE.CylinderGeometry(bR,bR,bH,32,1,true),new THREE.MeshPhongMaterial({color:0x2d333b,transparent:true,opacity:0.35,side:THREE.DoubleSide})));grp.children[0].position.y=bH/2;grp.add(new THREE.Mesh(new THREE.CylinderGeometry(bR,bR*0.15,hH,32,1,true),new THREE.MeshPhongMaterial({color:0x2d333b,transparent:true,opacity:0.35,side:THREE.DoubleSide})));grp.children[1].position.y=-hH/2;const fH=bH*0.7;grp.add(new THREE.Mesh(new THREE.CylinderGeometry(bR*0.97,bR*0.97,fH,32),new THREE.MeshPhongMaterial({color:0x3fb950,transparent:true,opacity:0.25})));grp.children[2].position.y=fH/2;if(data?.curve){const mx=Math.max(...data.curve.map((c:any)=>c.ph));data.curve.filter((_:any,i:number)=>i%3===0).forEach((pt:any)=>{const y=bH-pt.depth/(inputs?.z||12)*bH;const len=(pt.ph/mx)*bR*0.7;const ar=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.05,len,6),new THREE.MeshPhongMaterial({color:0xf85149,emissive:0xf85149,emissiveIntensity:0.3}));ar.rotation.z=Math.PI/2;ar.position.set(bR+len/2,y,0);grp.add(ar);const a2=ar.clone();a2.position.set(-bR-len/2,y,0);a2.rotation.z=-Math.PI/2;grp.add(a2);});}cam.position.set(5,4,5);
    }else if(type==="transportador"){const L=(inputs?.comp_m||20)*0.18,H=(inputs?.elev_m||0)*0.18;const sh=new THREE.Shape();sh.moveTo(-L/2,0.5);sh.lineTo(L/2,0.5+H);sh.lineTo(L/2,0.46+H);sh.lineTo(-L/2,0.46);grp.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:0.7,bevelEnabled:false}),new THREE.MeshPhongMaterial({color:0x2d333b})));grp.children[0].position.z=-0.35;const nR=Math.min(18,Math.floor(L/0.35));for(let i=0;i<=nR;i++){const x=-L/2+i*(L/nR),y=0.5+H*(i/nR);const r=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.78,8),new THREE.MeshPhongMaterial({color:0x58a6ff,emissive:0x58a6ff,emissiveIntensity:0.1}));r.rotation.x=Math.PI/2;r.position.set(x,y,0);grp.add(r);}const dM=new THREE.MeshPhongMaterial({color:0xd29922});const dr=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.78,16),dM);dr.rotation.x=Math.PI/2;dr.position.set(L/2,0.5+H,0);grp.add(dr);const tl=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.78,16),dM.clone());tl.rotation.x=Math.PI/2;tl.position.set(-L/2,0.5,0);grp.add(tl);for(let i=0;i<40;i++){const x=-L/2+Math.random()*L*0.85,y=0.5+H*(x+L/2)/L+0.07+Math.random()*0.12;grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.035,4,4),new THREE.MeshPhongMaterial({color:0x3fb950})));(grp.children[grp.children.length-1] as any).position.set(x,y,-0.25+Math.random()*0.5);}cam.position.set(3.5,2.5,3.5);
    }else if(type==="motovibrador"){const tW=(inputs?.larg_m||2)*0.4,tL=(inputs?.comp_m||1)*0.7;const tr=new THREE.Mesh(new THREE.BoxGeometry(tL,0.12,tW),new THREE.MeshPhongMaterial({color:0x2d333b}));tr.position.y=1;grp.add(tr);[tW/2,-tW/2].forEach(z=>{const w2=new THREE.Mesh(new THREE.BoxGeometry(tL,0.25,0.03),new THREE.MeshPhongMaterial({color:0x484f58,transparent:true,opacity:0.5}));w2.position.set(0,1.12,z);grp.add(w2);});const mM=new THREE.MeshPhongMaterial({color:0xd29922,emissive:0xd29922,emissiveIntensity:0.15});[-tL*0.3,tL*0.3].forEach(x=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.25,12),mM);m.rotation.x=Math.PI/2;m.position.set(x,0.85,tW/2+0.12);grp.add(m);});[-tL*0.35,0,tL*0.35].forEach(x=>{const sp=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.45,6),new THREE.MeshPhongMaterial({color:0x58a6ff,wireframe:true}));sp.position.set(x,0.55,0);grp.add(sp);});grp.add(new THREE.Mesh(new THREE.BoxGeometry(tL*1.1,0.04,tW*1.1),new THREE.MeshPhongMaterial({color:0x161b22})));cam.position.set(2.5,2,2.5);
    }else if(type==="pistao"){grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.4,0.08,0.7),new THREE.MeshPhongMaterial({color:0x484f58})));(grp.children[0] as any).position.y=0.5;const cy=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,1,12),new THREE.MeshPhongMaterial({color:0xd29922}));cy.rotation.z=Math.PI/2;cy.position.set(-0.25,0.65,0);grp.add(cy);const rd=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.7,8),new THREE.MeshPhongMaterial({color:0xc9d1d9}));rd.rotation.z=Math.PI/2;rd.position.set(0.45,0.65,0);grp.add(rd);const wM=new THREE.MeshPhongMaterial({color:0x2d333b,transparent:true,opacity:0.5});[-0.75,0.75].forEach(x=>{grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.04,1.2,0.8),wM));(grp.children[grp.children.length-1] as any).position.set(x,0.7,0);});grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.4,0.7,0.7),new THREE.MeshPhongMaterial({color:0x3fb950,transparent:true,opacity:0.2})));(grp.children[grp.children.length-1] as any).position.y=1.05;for(let i=-0.5;i<=0.5;i+=0.2){const ar=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.035,0.25,6),new THREE.MeshPhongMaterial({color:0xf85149,emissive:0xf85149,emissiveIntensity:0.4}));ar.position.set(i,0.35,0);grp.add(ar);}cam.position.set(2.5,1.8,2.5);}
    scene.add(grp);cam.lookAt(0,0.7,0);let ang=0;const anim=()=>{const id=requestAnimationFrame(anim);ang+=0.004;grp.rotation.y=ang;if(type==="motovibrador"&&grp.children[0]){(grp.children[0] as any).position.y=1+Math.sin(ang*20)*0.025;(grp.children[0] as any).position.x=Math.sin(ang*20)*0.015;}ren.render(scene,cam);return id;};const id=anim();
    return()=>{cancelAnimationFrame(id);ren.dispose();};
  },[type,data?.curve?.length,JSON.stringify(inputs)]);
  return <div ref={ref} style={{width:"100%",height:"340px",borderRadius:"6px",overflow:"hidden",border:`1px solid ${C.border}`}}/>;
}

// Objeto UI passado para cada módulo (evita imports circulares)
const UI = { Inp, Sel, Res, Badge, Tabs, SavedCalcs, Scene3D, C, sty };

// ============================================================
// GLOSSÁRIO (lê dados do módulo ativo)
// ============================================================
function GlossaryPanel({moduleId,visible,onClose}:any){
  const mod=MODULES.find(m=>m.id===moduleId);if(!visible||!mod)return null;
  return(<div style={{width:"270px",flexShrink:0,background:C.s1,borderLeft:`1px solid ${C.border}`,padding:"12px",overflowY:"auto",maxHeight:"calc(100vh - 40px)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
      <div style={{fontSize:"10px",fontWeight:600,color:C.accent,letterSpacing:"1px"}}>GLOSSÁRIO</div>
      <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:"14px",fontFamily:"inherit"}}>✕</button>
    </div>
    {mod.glossary.map((cat:any,ci:number)=>(
      <div key={ci} style={{marginBottom:"12px"}}>
        <div style={{fontSize:"8px",fontWeight:600,letterSpacing:"1px",marginBottom:"6px",padding:"3px 6px",borderRadius:"3px",color:cat.cat==="SAÍDA"?C.success:C.warn,background:cat.cat==="SAÍDA"?"rgba(63,185,80,0.06)":"rgba(210,153,34,0.06)",border:`1px solid ${cat.cat==="SAÍDA"?C.success+"22":C.warn+"22"}`}}>{cat.cat}</div>
        {cat.items.map((it:any,ii:number)=>(
          <div key={ii} style={{padding:"4px 6px",marginBottom:"2px",borderRadius:"3px",background:ii%2===0?"transparent":C.s2+"44",borderLeft:`2px solid ${cat.cat==="SAÍDA"?C.success+"44":C.warn+"44"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <span style={{fontWeight:600,color:C.accent,fontSize:"9px"}}>{it.s}</span>
              {it.u&&<span style={{fontSize:"7px",color:C.muted,background:C.s3,padding:"1px 3px",borderRadius:"2px"}}>{it.u}</span>}
            </div>
            <div style={{fontSize:"8px",color:C.dim,marginTop:"1px",lineHeight:"1.3"}}>{it.d}</div>
          </div>))}
      </div>))}
  </div>);
}

// ============================================================
// NOTIFICAÇÃO AO OWNER
// ============================================================
async function notifyOwner(u:any){
  try{await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"new_registration",ownerEmail:OWNER_EMAIL,user:{name:u.name,email:u.email,createdAt:u.createdAt}})})}catch{}
  const logs=JSON.parse(localStorage.getItem("owner:log")||"[]");logs.unshift({name:u.name,email:u.email,createdAt:u.createdAt});localStorage.setItem("owner:log",JSON.stringify(logs.slice(0,500)));
}

// ============================================================
// APP PRINCIPAL
// ============================================================
export default function App(){
  const[user,setUser]=useState<any>(null);const[mod,setMod]=useState(MODULES[0].id);const[sec,setSec]=useState("mod");
  const[saveM,setSaveM]=useState<any>(null);const[pName,setPName]=useState("");const[toast,setToast]=useState<string|null>(null);
  const[showGloss,setShowGloss]=useState(false);
  // Login state
  const[lm,setLm]=useState<"login"|"register">("login");const[em,setEm]=useState("");const[pw,setPw]=useState("");const[nm,setNm]=useState("");const[er,setEr]=useState("");

  useEffect(()=>{(async()=>{const s=await ST.get("sess:v4");if(s)setUser(s)})()},[]);

  // --- AUTH ---
  const login=async()=>{
    if(!em||!pw){setEr("Preencha todos os campos");return}
    if(lm==="register"){
      if(!nm){setEr("Informe nome");return}
      if(await ST.get(`u:${em}`)){setEr("E-mail já cadastrado");return}
      const u={email:em,name:nm,pass:pw,createdAt:new Date().toISOString(),modules:[] as string[],payments:[] as any[]};
      await ST.set(`u:${em}`,u);await ST.set("sess:v4",u);await notifyOwner(u);setUser(u);
    }else{
      const u=await ST.get(`u:${em}`);if(!u||u.pass!==pw){setEr("Credenciais inválidas");return}
      await ST.set("sess:v4",u);setUser(u);
    }
  };
  const logout=async()=>{await ST.del("sess:v4");setUser(null)};

  // --- ATIVAÇÃO DE MÓDULO ---
  const activate=async(id:string)=>{
    if(!user)return;
    const mod=MODULES.find(m=>m.id===id);
    const updated={...user,modules:[...new Set([...user.modules,id])],payments:[...user.payments,{moduleId:id,date:new Date().toISOString(),amount:mod?.price||0,status:"completed"}]};
    await ST.set(`u:${user.email}`,updated);await ST.set("sess:v4",updated);setUser(updated);
    setToast(`"${mod?.name}" ativado!`);setTimeout(()=>setToast(null),3000);
  };

  // --- SALVAR CÁLCULO ---
  const save=(d:any)=>{setSaveM(d);setPName(`${d.type}_${new Date().toISOString().slice(0,10)}`)};
  const confirmSave=async()=>{if(!pName||!user)return;await ST.set(`p:${user.email}:${Date.now()}`,{...saveM,name:pName,at:new Date().toISOString()});setSaveM(null);setToast("Salvo!");setTimeout(()=>setToast(null),2000)};

  // --- TELA DE LOGIN ---
  if(!user)return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 30% 20%,#0d1117,#060a10 70%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Mono',monospace",color:C.text}}>
      <div style={{width:"360px",textAlign:"center"}}>
        <div style={{fontSize:"24px",fontWeight:800,letterSpacing:"3px",background:"linear-gradient(135deg,#58a6ff,#79c0ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:"4px"}}>ENGCALC PRO</div>
        <div style={{fontSize:"9px",color:C.muted,letterSpacing:"4px",marginBottom:"28px"}}>ENGINEERING CALCULATIONS PLATFORM</div>
        <div style={{...sty.card,textAlign:"left"}}><div style={{display:"flex",marginBottom:"14px",borderRadius:"4px",overflow:"hidden",border:`1px solid ${C.border}`}}>
          {(["login","register"] as const).map(m=><button key={m} onClick={()=>{setLm(m);setEr("")}} style={{flex:1,padding:"8px",background:lm===m?C.accentDim:"transparent",border:"none",color:lm===m?C.accent:C.dim,cursor:"pointer",fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",fontFamily:"inherit"}}>{m==="login"?"Entrar":"Cadastrar"}</button>)}</div>
          {lm==="register"&&<Inp label="Nome completo" value={nm} onChange={setNm} type="text"/>}
          <Inp label="E-mail" value={em} onChange={setEm} type="text"/><Inp label="Senha" value={pw} onChange={setPw} type="password"/>
          {er&&<div style={{color:C.danger,fontSize:"10px",marginBottom:"6px",padding:"6px",background:C.danger+"10",borderRadius:"3px"}}>{er}</div>}
          <button onClick={login} style={{...sty.btn("p"),width:"100%",padding:"10px",marginTop:"6px"}}>{lm==="login"?"ACESSAR":"CRIAR CONTA"}</button>
        </div>
        <div style={{fontSize:"8px",color:C.muted,marginTop:"16px",lineHeight:"1.8"}}>{MODULES.length} módulos · EN 1991-4 · CEMA 7th · Cálculos validados</div>
      </div>
    </div>
  );

  // --- DADOS DO MÓDULO ATIVO ---
  const activeMod=MODULES.find(m=>m.id===mod);
  const canAccess=user.modules.includes(mod);
  const activeModules=MODULES.filter(m=>user.modules.includes(m.id));
  const inactiveModules=MODULES.filter(m=>!user.modules.includes(m.id));

  return(<div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'IBM Plex Mono',monospace",fontSize:"12px"}}>
    {/* HEADER */}
    <div style={{background:C.s1,borderBottom:`1px solid ${C.border}`,padding:"8px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}><div style={{fontSize:"14px",fontWeight:800,letterSpacing:"2px",background:"linear-gradient(135deg,#58a6ff,#79c0ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>ENGCALC PRO</div><span style={{fontSize:"8px",color:C.muted}}>v4</span></div>
      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
        {sec==="mod"&&canAccess&&<button onClick={()=>setShowGloss(!showGloss)} style={{...sty.btn("g"),fontSize:"9px",padding:"4px 10px",background:showGloss?C.accentDim:"transparent"}}>{showGloss?"✕ Glossário":"📖 Glossário"}</button>}
        <span style={{fontSize:"10px",color:C.dim}}>{user.name}</span>
        <button onClick={logout} style={{...sty.btn("g"),fontSize:"9px",padding:"4px 10px"}}>Sair</button>
      </div>
    </div>

    <div style={{display:"flex",minHeight:"calc(100vh - 40px)"}}>
      {/* SIDEBAR */}
      <div style={{width:"190px",background:C.s1,borderRight:`1px solid ${C.border}`,padding:"12px",flexShrink:0,overflowY:"auto"}}>
        <div style={{fontSize:"8px",color:C.muted,letterSpacing:"2px",marginBottom:"8px"}}>NAVEGAÇÃO</div>
        {[{id:"mod",l:"Módulos"},{id:"store",l:"🛒 Loja"},{id:"admin",l:"Conta"}].map(s2=>(
          <div key={s2.id} onClick={()=>setSec(s2.id)} style={{padding:"7px 10px",marginBottom:"3px",borderRadius:"4px",cursor:"pointer",background:sec===s2.id?C.accentDim:"transparent",border:sec===s2.id?`1px solid ${C.accent}33`:"1px solid transparent"}}>
            <div style={{fontSize:"10px",fontWeight:sec===s2.id?600:400,color:sec===s2.id?C.accent:C.dim}}>{s2.l}</div></div>))}

        {activeModules.length>0&&<><div style={{fontSize:"8px",color:C.success,letterSpacing:"2px",margin:"14px 0 8px"}}>ATIVOS</div>
          {activeModules.map(m=>(<div key={m.id} onClick={()=>{setMod(m.id);setSec("mod")}} style={{padding:"7px 10px",marginBottom:"3px",borderRadius:"4px",cursor:"pointer",background:mod===m.id&&sec==="mod"?C.accentDim:"transparent",border:mod===m.id&&sec==="mod"?`1px solid ${C.accent}33`:"1px solid transparent"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}><span style={{color:m.color,fontSize:"12px"}}>{m.icon}</span><div><div style={{fontSize:"10px",fontWeight:mod===m.id?600:400,color:mod===m.id&&sec==="mod"?C.text:C.dim}}>{m.name}</div><div style={{fontSize:"7px",color:C.muted}}>{m.subtitle}</div></div></div></div>))}</>}

        {inactiveModules.length>0&&<><div style={{fontSize:"8px",color:C.muted,letterSpacing:"2px",margin:"14px 0 8px"}}>BLOQUEADOS</div>
          {inactiveModules.map(m=>(<div key={m.id} onClick={()=>setSec("store")} style={{padding:"7px 10px",marginBottom:"3px",borderRadius:"4px",cursor:"pointer",opacity:0.4}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}><span style={{fontSize:"12px"}}>🔒</span><div><div style={{fontSize:"10px",color:C.muted}}>{m.name}</div><div style={{fontSize:"7px",color:C.muted}}>R$ {m.price.toFixed(0)}</div></div></div></div>))}</>}

        <div style={{marginTop:"16px",paddingTop:"10px",borderTop:`1px solid ${C.border}`,fontSize:"7px",color:C.muted,lineHeight:"1.8"}}>{activeModules.length}/{MODULES.length} ativos<br/><span style={{color:C.accent}}>Validado ✓</span></div>
      </div>

      {/* ÁREA CENTRAL */}
      <div style={{flex:1,padding:"18px",maxWidth:"920px",overflowY:"auto"}}>
        {/* Módulo ativo */}
        {sec==="mod"&&canAccess&&activeMod&&<activeMod.Component onSave={save} user={user} UI={UI}/>}

        {/* Módulo bloqueado */}
        {sec==="mod"&&!canAccess&&<div style={{...sty.card,textAlign:"center",padding:"60px 40px"}}><div style={{fontSize:"40px",marginBottom:"16px"}}>🔒</div><div style={{fontSize:"16px",fontWeight:700,marginBottom:"8px"}}>Módulo Bloqueado</div><div style={{fontSize:"11px",color:C.dim,marginBottom:"20px"}}>Acesse a loja para ativar este módulo.</div><button onClick={()=>setSec("store")} style={{...sty.btn("p"),padding:"10px 24px"}}>Ir para a Loja</button></div>}

        {/* Sem módulos */}
        {sec==="mod"&&activeModules.length===0&&<div style={{...sty.card,textAlign:"center",padding:"60px 40px"}}><div style={{fontSize:"40px",marginBottom:"16px"}}>🛒</div><div style={{fontSize:"16px",fontWeight:700,marginBottom:"8px"}}>Nenhum Módulo Ativo</div><div style={{fontSize:"11px",color:C.dim,marginBottom:"20px"}}>Acesse a loja e ative seus módulos.</div><button onClick={()=>setSec("store")} style={{...sty.btn("p"),padding:"10px 24px"}}>Abrir Loja</button></div>}

        {/* LOJA */}
        {sec==="store"&&<div>
          <h2 style={{margin:"0 0 4px",fontSize:"16px",fontWeight:700}}>Módulos Disponíveis</h2>
          <p style={{fontSize:"10px",color:C.dim,marginBottom:"16px"}}>Selecione e ative os módulos que deseja utilizar</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
            {MODULES.map(m=>{const isActive=user.modules.includes(m.id);return(
              <div key={m.id} style={{...sty.card,padding:"20px",border:isActive?`1px solid ${C.success}44`:`1px solid ${C.border}`,background:isActive?"rgba(63,185,80,0.03)":C.s1,position:"relative"}}>
                {isActive&&<div style={{position:"absolute",top:"10px",right:"10px",background:C.success+"20",color:C.success,padding:"2px 8px",borderRadius:"10px",fontSize:"8px",fontWeight:600}}>ATIVO</div>}
                <div style={{fontSize:"20px",marginBottom:"8px"}}>{m.icon}</div>
                <div style={{fontSize:"13px",fontWeight:700,marginBottom:"4px"}}>{m.name}</div>
                <div style={{fontSize:"9px",color:C.accent,marginBottom:"10px"}}>{m.norma}</div>
                <div style={{fontSize:"10px",color:C.dim,lineHeight:"1.5",marginBottom:"14px",minHeight:"36px"}}>{m.description}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  {isActive?<span style={{fontSize:"11px",color:C.success,fontWeight:600}}>Ativo</span>:<span style={{fontSize:"18px",fontWeight:800,color:C.accent}}>R$ {m.price.toFixed(2).replace(".",",")}</span>}
                  {!isActive&&<button onClick={()=>activate(m.id)} style={{...sty.btn("p"),fontSize:"10px",padding:"8px 16px"}}>Ativar</button>}
                </div>
              </div>);})}
          </div>
          <div style={{...sty.card,marginTop:"14px",background:"rgba(88,166,255,0.03)",border:`1px solid ${C.accent}33`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:"13px",fontWeight:700,color:C.accent}}>Pacote Completo</div><div style={{fontSize:"9px",color:C.dim}}>Todos os módulos com 20% de desconto</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:"18px",fontWeight:800,color:C.accent}}>R$ {BUNDLE_PRICE.toFixed(2).replace(".",",")}</div><div style={{fontSize:"9px",color:C.muted,textDecoration:"line-through"}}>R$ {MODULES.reduce((s,m)=>s+m.price,0).toFixed(2).replace(".",",")}</div></div>
            </div></div>
        </div>}

        {/* CONTA */}
        {sec==="admin"&&<div>
          <div style={sty.card}><div style={sty.cardT}>Minha Conta</div><div style={sty.grid(2)}>
            <div><div style={{fontSize:"8px",color:C.muted}}>NOME</div><div style={{marginTop:"3px"}}>{user.name}</div></div>
            <div><div style={{fontSize:"8px",color:C.muted}}>E-MAIL</div><div style={{marginTop:"3px"}}>{user.email}</div></div>
            <div><div style={{fontSize:"8px",color:C.muted}}>CRIADO</div><div style={{marginTop:"3px"}}>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</div></div>
            <div><div style={{fontSize:"8px",color:C.muted}}>MÓDULOS</div><div style={{marginTop:"3px"}}>{user.modules.length}/{MODULES.length}</div></div>
          </div></div>
          {user.modules.length>0&&<div style={sty.card}><div style={sty.cardT}>Módulos Adquiridos</div>
            {user.modules.map((id:string)=>{const m=MODULES.find(x=>x.id===id);return m?<div key={id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:m.color,fontSize:"14px"}}>{m.icon}</span><span style={{fontSize:"11px"}}>{m.name}</span><span style={{marginLeft:"auto",fontSize:"9px",color:C.success,background:C.success+"15",padding:"2px 6px",borderRadius:"8px"}}>ATIVO</span></div>:null})}
          </div>}
          {user.email===OWNER_EMAIL&&<div style={{...sty.card,border:`1px solid ${C.warn}33`}}><div style={{...sty.cardT,color:C.warn}}>Admin — Últimos Cadastros</div>
            {(JSON.parse(localStorage.getItem("owner:log")||"[]") as any[]).slice(0,30).map((l:any,i:number)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${C.border}`,fontSize:"10px"}}><span>{l.name}</span><span style={{color:C.accent}}>{l.email}</span><span style={{color:C.dim}}>{new Date(l.createdAt).toLocaleDateString("pt-BR")}</span></div>)}
          </div>}
        </div>}
      </div>

      {/* GLOSSÁRIO */}
      {sec==="mod"&&canAccess&&<GlossaryPanel moduleId={mod} visible={showGloss} onClose={()=>setShowGloss(false)}/>}
    </div>

    {/* Modal salvar */}
    {saveM&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{...sty.card,width:"350px"}}><div style={sty.cardT}>Salvar Cálculo</div><Inp label="Nome" value={pName} onChange={setPName} type="text"/>
      <div style={{display:"flex",gap:"6px",justifyContent:"flex-end",marginTop:"10px"}}><button onClick={()=>setSaveM(null)} style={sty.btn("g")}>Cancelar</button><button onClick={confirmSave} style={sty.btn("p")}>Salvar</button></div></div></div>}

    {toast&&<div style={{position:"fixed",bottom:"16px",right:"16px",padding:"8px 16px",background:C.success,color:"#fff",borderRadius:"4px",fontSize:"11px",fontWeight:600,zIndex:300}}>{toast}</div>}
  </div>);
}
