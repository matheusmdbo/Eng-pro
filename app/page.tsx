"use client";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// --- TIPOS ---
type AnyDict = { [k: string]: any };

// --- STORAGE (com fallback localStorage) ---
const STORAGE = {
  async get(k: string) {
    try {
      if ((window as any).storage?.get) {
        const r = await (window as any).storage.get(k);
        return r ? JSON.parse(r.value) : null;
      } else {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : null;
      }
    } catch { return null; }
  },
  async set(k: string, v: any) {
    try {
      if ((window as any).storage?.set) {
        await (window as any).storage.set(k, JSON.stringify(v));
      } else {
        localStorage.setItem(k, JSON.stringify(v));
      }
      return true;
    } catch { return false; }
  },
  async delete(k: string) {
    try {
      if ((window as any).storage?.delete) {
        await (window as any).storage.delete(k);
      } else {
        localStorage.removeItem(k);
      }
      return true;
    } catch { return false; }
  },
  async listPrefix(prefix: string) {
    try {
      if ((window as any).storage?.list) {
        const r = await (window as any).storage.list(prefix);
        return r?.keys || [];
      } else {
        return Object.keys(localStorage).filter(k => k.startsWith(prefix));
      }
    } catch { return []; }
  }
};

// util: export JSON file
function exportProjectToFile(obj: any, filename = "project.json") {
  try {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch { return false; }
}

// --- estilo simples ---
const C = {
  bg: "#060a10", s1: "#0d1117", border: "#21262d", accent: "#58a6ff", text: "#c9d1d9", muted: "#8b949e", danger: "#f85149", success: "#3fb950"
};
const box = (p: any) => ({ background: C.s1, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, color: C.text, ...p });

// --- SCENE 3D (simplificada) ---
interface Scene3DProps { type: string; data: AnyDict | null; inputs: AnyDict; }
function Scene3D({ type, data, inputs }: Scene3DProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const w = ref.current.clientWidth, h = 300;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x060a10);
    const cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    const ren = new THREE.WebGLRenderer({ antialias: true });
    ren.setSize(w, h); ren.setPixelRatio(window.devicePixelRatio || 1);
    ref.current.innerHTML = ""; ref.current.appendChild(ren.domElement);
    scene.add(new THREE.AmbientLight(0x404060, 0.8));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(5, 6, 5); scene.add(dl);
    const g = new THREE.Group();
    // simple visuals per type
    if (type === "transportador") {
      const geo = new THREE.BoxGeometry(2, 0.08, 0.6);
      const m = new THREE.MeshPhongMaterial({ color: 0x2d333b });
      const belt = new THREE.Mesh(geo, m); belt.position.y = 0.3; g.add(belt);
    } else if (type === "silo") {
      const geo = new THREE.CylinderGeometry(0.6, 0.6, 1.6, 24);
      const m = new THREE.MeshPhongMaterial({ color: 0x2d333b, transparent: true, opacity: 0.6 });
      const silo = new THREE.Mesh(geo, m); silo.position.y = 0.8; g.add(silo);
    } else { // generic
      const geo = new THREE.BoxGeometry(1, 0.5, 1);
      const m = new THREE.MeshPhongMaterial({ color: 0x2d333b });
      g.add(new THREE.Mesh(geo, m));
    }
    scene.add(g); cam.position.set(2.5, 2, 3); cam.lookAt(0, 0.6, 0);
    let raf = 0;
    const animate = () => { raf = requestAnimationFrame(animate); g.rotation.y += 0.006; ren.render(scene, cam); };
    animate();
    return () => { cancelAnimationFrame(raf); ren.dispose(); };
  }, [type, data?.at, JSON.stringify(inputs || {})]);
  return <div ref={ref} style={{ width: "100%", height: 300, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }} />;
}

// --- MÓDULOS (simplificados) ---
// Cada módulo expõe: local state inp/res, save payload builder, and listens to loadPayload prop.

interface ModuleProps { onSave: (payload: AnyDict) => void; loadPayload: AnyDict | null; setLoadHandled?: (b: boolean) => void; }

function TCMod({ onSave, loadPayload, setLoadHandled }: ModuleProps) {
  const [inp, setInp] = useState({ type: "transportador", comp_m: 20, cap_th: 10 });
  useEffect(() => {
    if (!loadPayload) return;
    if (loadPayload.type !== "transportador") return;
    if (loadPayload.inp) setInp({ ...inp, ...loadPayload.inp });
    setLoadHandled?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPayload]);
  return (
    <div>
      <div style={box({ marginBottom: 12 })}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Transportador</div>
        <label style={{ color: C.muted, fontSize: 12 }}>Comprimento (m)</label>
        <input value={inp.comp_m} onChange={e => setInp({ ...inp, comp_m: Number(e.target.value) || 0 })} style={{ width: "100%", padding: 8, marginBottom: 8 }} />
        <label style={{ color: C.muted, fontSize: 12 }}>Vazão (t/h)</label>
        <input value={inp.cap_th} onChange={e => setInp({ ...inp, cap_th: Number(e.target.value) || 0 })} style={{ width: "100%", padding: 8 }} />
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button onClick={() => onSave({ type: "transportador", inp, res: { ok: true }, name: `TR-${Date.now()}` })} style={{ padding: 8, background: C.accent, color: C.text, border: "none", borderRadius: 6 }}>Salvar</button>
        </div>
      </div>
      <Scene3D type="transportador" data={null} inputs={inp} />
    </div>
  );
}

function SiloMod({ onSave, loadPayload, setLoadHandled }: ModuleProps) {
  const [inp, setInp] = useState({ type: "silo", z: 12, b: 4, c: 4, density: 1600 });
  useEffect(() => {
    if (!loadPayload) return;
    if (loadPayload.type !== "silo") return;
    if (loadPayload.inp) setInp({ ...inp, ...loadPayload.inp });
    setLoadHandled?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPayload]);
  return (
    <div>
      <div style={box({ marginBottom: 12 })}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Silo</div>
        <label style={{ color: C.muted, fontSize: 12 }}>Altura (m)</label>
        <input value={inp.z} onChange={e => setInp({ ...inp, z: Number(e.target.value) || 0 })} style={{ width: "100%", padding: 8, marginBottom: 8 }} />
        <label style={{ color: C.muted, fontSize: 12 }}>B (m)</label>
        <input value={inp.b} onChange={e => setInp({ ...inp, b: Number(e.target.value) || 0 })} style={{ width: "100%", padding: 8 }} />
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button onClick={() => onSave({ type: "silo", inp, res: { ok: true }, name: `SL-${Date.now()}` })} style={{ padding: 8, background: C.accent, color: C.text, border: "none", borderRadius: 6 }}>Salvar</button>
        </div>
      </div>
      <Scene3D type="silo" data={null} inputs={inp} />
    </div>
  );
}

function PistaoMod({ onSave, loadPayload, setLoadHandled }: ModuleProps) {
  const [inp, setInp] = useState({ type: "pistao", comp_m: 0.2, p_bar: 6 });
  useEffect(() => {
    if (!loadPayload) return;
    if (loadPayload.type !== "pistao") return;
    if (loadPayload.inp) setInp({ ...inp, ...loadPayload.inp });
    setLoadHandled?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPayload]);
  return (
    <div>
      <div style={box({ marginBottom: 12 })}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Pistão</div>
        <label style={{ color: C.muted, fontSize: 12 }}>Pressão (bar)</label>
        <input value={inp.p_bar} onChange={e => setInp({ ...inp, p_bar: Number(e.target.value) || 0 })} style={{ width: "100%", padding: 8, marginBottom: 8 }} />
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button onClick={() => onSave({ type: "pistao", inp, res: { ok: true }, name: `PS-${Date.now()}` })} style={{ padding: 8, background: C.accent, color: C.text, border: "none", borderRadius: 6 }}>Salvar</button>
        </div>
      </div>
      <Scene3D type="pistao" data={null} inputs={inp} />
    </div>
  );
}

// --- APP ---
export default function Page() {
  // pretend user (for index scoping); in real app use auth email
  const [user] = useState<{ email: string } | null>({ email: "demo@local" });

  const [sec, setSec] = useState<"mod" | "doc">("mod");
  const [mod, setMod] = useState<"transportador" | "silo" | "pistao">("transportador");

  // project index & cache
  const [projectsIndex, setProjectsIndex] = useState<Array<any>>([]);
  const [userProjects, setUserProjects] = useState<Record<string, AnyDict>>({});
  const [toast, setToast] = useState<string | null>(null);

  // payload loader for modules
  const [loadPayload, setLoadPayload] = useState<AnyDict | null>(null);
  const [loadHandled, setLoadHandled] = useState(false);

  // load index on user change
  useEffect(() => {
    (async () => {
      if (!user) { setProjectsIndex([]); setUserProjects({}); return; }
      const idxKey = `pindex:${user.email}`;
      const idx = (await STORAGE.get(idxKey)) || [];
      setProjectsIndex(idx);
      const cache: Record<string, AnyDict> = {};
      for (const entry of idx) {
        const p = await STORAGE.get(entry.key);
        if (p) cache[entry.key] = p;
      }
      setUserProjects(cache);
    })();
  }, [user]);

  useEffect(() => { if (loadHandled) { // clear shortly after module acknowledged load
    const t = setTimeout(() => { setLoadPayload(null); setLoadHandled(false); }, 400); return () => clearTimeout(t); } }, [loadHandled]);

  // save handler called by modules
  const handleSave = async (payload: AnyDict) => {
    if (!user) { setToast("Sem usuário"); setTimeout(() => setToast(null), 1500); return; }
    const key = `p:${user.email}:${Date.now()}`;
	const p: AnyDict = { ...payload, name: payload.name || `${payload.type}-${Date.now()}`, at: new Date().toISOString() };
    await STORAGE.set(key, p);
    // update index
    const idxKey = `pindex:${user.email}`;
    const idx = (await STORAGE.get(idxKey)) || [];
    const newEntry = { key, name: p.name, at: p.at, type: (p.type as string) || (payload.type as string) };
    idx.push(newEntry);
    await STORAGE.set(idxKey, idx);
    setProjectsIndex(idx);
    setUserProjects(prev => ({ ...prev, [key]: p }));
    setToast("Salvo");
    setTimeout(() => setToast(null), 1200);
  };

  const openProject = async (entry: any) => {
    const payload = userProjects[entry.key] || await STORAGE.get(entry.key);
    if (!payload) { setToast("Arquivo não encontrado"); setTimeout(() => setToast(null), 1500); return; }
    setMod(payload.type || "transportador");
    setLoadPayload(payload);
    setToast("Projeto carregado");
    setTimeout(() => setToast(null), 900);
  };

  const exportProject = (entry: any) => {
    const payload = userProjects[entry.key];
    if (payload) exportProjectToFile(payload, `${entry.name.replace(/[^a-z0-9_\-\.]/gi, "_")}.json`);
    else setToast("Arquivo não em cache"); setTimeout(() => setToast(null), 1200);
  };

  const deleteProject = async (entry: any) => {
    if (!user) return;
    if (!confirm(`Apagar "${entry.name}"?`)) return;
    await STORAGE.delete(entry.key);
    const idxKey = `pindex:${user.email}`;
    const idx = (await STORAGE.get(idxKey)) || [];
    const newIdx = idx.filter((i: any) => i.key !== entry.key);
    await STORAGE.set(idxKey, newIdx);
    setProjectsIndex(newIdx);
    setUserProjects(p => { const c = { ...p }; delete c[entry.key]; return c; });
    setToast("Apagado");
    setTimeout(() => setToast(null), 900);
  };

  // UI layout
  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 18, color: C.text, fontFamily: "Inter, Roboto, sans-serif" }}>
      <div style={{ display: "flex", gap: 12 }}>
        {/* SIDEBAR */}
        <div style={{ width: 320 }}>
          <div style={box({ marginBottom: 12 })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800 }}>App Eng</div>
              <div style={{ fontSize: 12, color: C.muted }}>{user?.email}</div>
            </div>
          </div>

          <div style={box({ marginBottom: 12 })}>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>Módulos</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={() => setMod("transportador")} style={{ padding: 8, borderRadius: 6, background: mod === "transportador" ? C.accent : "transparent", border: `1px solid ${C.border}`, color: C.text }}>Transportador</button>
              <button onClick={() => setMod("silo")} style={{ padding: 8, borderRadius: 6, background: mod === "silo" ? C.accent : "transparent", border: `1px solid ${C.border}`, color: C.text }}>Silo</button>
              <button onClick={() => setMod("pistao")} style={{ padding: 8, borderRadius: 6, background: mod === "pistao" ? C.accent : "transparent", border: `1px solid ${C.border}`, color: C.text }}>Pistão</button>
            </div>

            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Arquivos salvos ({projectsIndex.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflow: "auto" }}>
              {projectsIndex.filter(p => p.type === mod).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Nenhum arquivo salvo para este módulo</div>}
              {projectsIndex.filter(p => p.type === mod).map(p => (
                <div key={p.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 8, borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent" }}>
                  <div style={{ maxWidth: 160 }}>
                    <div style={{ fontSize: 13, color: C.accent }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{new Date(p.at).toLocaleString()}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openProject(p)} style={{ padding: 6, background: C.accent, color: C.text, border: "none", borderRadius: 6 }}>Abrir</button>
                    <button onClick={() => exportProject(p)} style={{ padding: 6, background: "#444", color: C.text, border: "none", borderRadius: 6 }}>Export</button>
                    <button onClick={() => deleteProject(p)} style={{ padding: 6, background: C.danger, color: C.text, border: "none", borderRadius: 6 }}>Apagar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={box({})}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Ações</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                // export all index as JSON
                if (!user) return;
                const idxKey = `pindex:${user.email}`;
                const idx = (await STORAGE.get(idxKey)) || [];
                exportProjectToFile({ index: idx }, `index-${user.email}.json`);
              }} style={{ padding: 8, borderRadius: 6, background: C.accent, color: C.text }}>Exportar índice</button>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Módulo: {mod}</div>
            <div style={{ color: C.muted }}>{toast}</div>
          </div>

          <div>
            {mod === "transportador" && <TCMod onSave={handleSave} loadPayload={loadPayload} setLoadHandled={setLoadHandled} />}
            {mod === "silo" && <SiloMod onSave={handleSave} loadPayload={loadPayload} setLoadHandled={setLoadHandled} />}
            {mod === "pistao" && <PistaoMod onSave={handleSave} loadPayload={loadPayload} setLoadHandled={setLoadHandled} />}
          </div>
        </div>
      </div>
    </div>
  );
}