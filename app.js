const { useState, useEffect } = React;

const GROUPS = {
  Push: ["Rinta","Olkapäät","Ojentajat"],
  Pull: ["Selkä","Hauikset"],
  Legs: ["Jalat","Vatsat"],
  Other: ["Cardio"]
};
const KEY = "gym_v5";

const storage = {
  get(k) {
    try { const v = localStorage.getItem(k); return Promise.resolve(v ? {value:v} : null); }
    catch(e) { return Promise.reject(e); }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); return Promise.resolve(); }
    catch(e) { return Promise.reject(e); }
  }
};

function uid() { return Math.random().toString(36).slice(2); }
function fmtDate(d) { return new Date(d+"T12:00:00").toLocaleDateString("fi-FI",{day:"numeric",month:"short",year:"numeric"}); }
function todayStr() { return new Date().toISOString().split("T")[0]; }
function nowTime() { return new Date().toLocaleTimeString("fi-FI",{hour:"2-digit",minute:"2-digit"}); }
function newSet() { return {id:uid(),reps:"",weight:""}; }
function newEx() { return {id:uid(),name:"",sets:[newSet()]}; }
function newBlock(muscle) { return {id:uid(),muscle,exercises:[newEx()],ct:"",cn:""}; }

function App() {
  const [tab, setTab] = useState("log");
  const [workouts, setWorkouts] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [toast, setToast] = useState("");
  const [pEx, setPEx] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    storage.get(KEY).then(r => {
      if (r) setWorkouts(JSON.parse(r.value).w || []);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storage.set(KEY, JSON.stringify({w:workouts})).catch(() => {});
  }, [workouts, loaded]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 2000); }

  const selMuscles = blocks.map(b => b.muscle);

  function toggleMuscle(m) {
    const idx = blocks.findIndex(b => b.muscle === m);
    if (idx >= 0) setBlocks(p => p.filter(b => b.muscle !== m));
    else setBlocks(p => [...p, newBlock(m)]);
  }

  function rmBlock(id) { setBlocks(p => p.filter(b => b.id !== id)); }
  function updBlock(id, f, v) { setBlocks(p => p.map(b => b.id === id ? Object.assign({}, b, {[f]:v}) : b)); }

  function addEx(bid) {
    setBlocks(p => p.map(b => b.id === bid ? Object.assign({}, b, {exercises:[...b.exercises, newEx()]}) : b));
  }
  function rmEx(bid, eid) {
    setBlocks(p => p.map(b => b.id === bid ? Object.assign({}, b, {exercises: b.exercises.filter(e => e.id !== eid)}) : b));
  }
  function setExName(bid, eid, v) {
    setBlocks(p => p.map(b => b.id === bid ? Object.assign({}, b, {exercises: b.exercises.map(e => e.id === eid ? Object.assign({}, e, {name:v}) : e)}) : b));
  }
  function addSet(bid, eid) {
    setBlocks(p => p.map(b => b.id === bid ? Object.assign({}, b, {exercises: b.exercises.map(e => e.id === eid ? Object.assign({}, e, {sets:[...e.sets, newSet()]}) : e)}) : b));
  }
  function rmSet(bid, eid, sid) {
    setBlocks(p => p.map(b => b.id === bid ? Object.assign({}, b, {exercises: b.exercises.map(e => e.id === eid ? Object.assign({}, e, {sets: e.sets.filter(s => s.id !== sid)}) : e)}) : b));
  }
  function updSet(bid, eid, sid, f, v) {
    setBlocks(p => p.map(b => b.id === bid ? Object.assign({}, b, {exercises: b.exercises.map(e => e.id === eid ? Object.assign({}, e, {sets: e.sets.map(s => s.id === sid ? Object.assign({}, s, {[f]:v}) : s)}) : e)}) : b));
  }

  function prevEx(muscle) {
    const s = new Set();
    workouts.forEach(w => (w.groups||[]).forEach(g => {
      if (g.muscle === muscle) (g.exercises||[]).forEach(e => e.name && s.add(e.name));
    }));
    return [...s];
  }

  function saveWorkout() {
    if (!blocks.length) { showToast("Lisää lihasryhmä"); return; }
    const groups = blocks.map(b => {
      if (b.muscle === "Cardio") return {muscle:"Cardio", ct:b.ct, cn:b.cn, exercises:[]};
      return {muscle:b.muscle, exercises:b.exercises.filter(e => e.name.trim()).map(e => ({name:e.name.trim(), sets:e.sets}))};
    }).filter(g => g.muscle === "Cardio" || g.exercises.length);
    if (!groups.length) { showToast("Lisää liike"); return; }
    setWorkouts(w => [...w, {date:todayStr(), time:nowTime(), groups}]);
    setBlocks([]);
    showToast("Tallennettu!");
  }

  function delW(i) { setWorkouts(w => w.filter((_,idx) => idx !== i)); }

  function exportData() {
    const data = JSON.stringify({w:workouts}, null, 2);
    const blob = new Blob([data], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sali-varmuuskopio-"+todayStr()+".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Varmuuskopio ladattu");
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const arr = parsed.w || parsed.workouts || parsed;
        if (!Array.isArray(arr)) throw new Error("Virheellinen muoto");
        if (!confirm("Korvataanko nykyiset "+workouts.length+" treeniä tiedoston "+arr.length+" treenillä?")) return;
        setWorkouts(arr);
        setShowSettings(false);
        showToast("Tiedot tuotu!");
      } catch(err) {
        showToast("Virheellinen tiedosto");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const allEx = [...new Set(workouts.flatMap(w => (w.groups||[]).flatMap(g => (g.exercises||[]).map(e => e.name))))].filter(Boolean).sort();
  const curEx = pEx || allEx[0] || "";

  const prs = {};
  workouts.forEach(w => (w.groups||[]).forEach(g => (g.exercises||[]).forEach(e => {
    (e.sets||[]).forEach(s => {
      const wt = parseFloat(s.weight)||0;
      if (!prs[e.name] || wt > prs[e.name].w) prs[e.name] = {w:wt, d:w.date};
    });
  })));

  const pEntries = workouts.flatMap(w =>
    (w.groups||[]).flatMap(g =>
      (g.exercises||[]).filter(e => e.name === curEx).flatMap(e =>
        (e.sets||[]).map(s => ({date:w.date, reps:s.reps, weight:parseFloat(s.weight)||0}))
      )
    )
  ).reverse();

  const totalVol = workouts.flatMap(w =>
    (w.groups||[]).flatMap(g =>
      (g.exercises||[]).flatMap(e =>
        (e.sets||[]).map(s => (parseInt(s.reps)||0) * (parseFloat(s.weight)||0))
      )
    )
  ).reduce((a,b) => a+b, 0);

  const now = new Date();
  const yr = now.getFullYear(), mo = now.getMonth();
  const fd = new Date(yr,mo,1).getDay();
  const dim = new Date(yr,mo+1,0).getDate();
  const wDates = {};
  workouts.forEach(w => {
    const prefix = yr+"-"+String(mo+1).padStart(2,"0");
    if (w.date.startsWith(prefix)) {
      const d = parseInt(w.date.split("-")[2]);
      wDates[d] = (w.groups||[]).map(g => g.muscle).join(" + ");
    }
  });

  const c = {
    wrap: {padding:"12px", fontFamily:"system-ui,sans-serif", maxWidth:500, margin:"0 auto", color:"#e5e5e5"},
    tabs: {display:"flex", gap:6, marginBottom:16, flexWrap:"wrap", alignItems:"center"},
    tab: a => ({padding:"7px 14px", borderRadius:8, border:"1px solid "+(a?"transparent":"#333"), background:a?"#fff":"#1a1a1a", color:a?"#000":"#aaa", fontSize:13, cursor:"pointer"}),
    gear: {marginLeft:"auto", width:34, height:34, borderRadius:8, border:"1px solid #333", background:"#1a1a1a", color:"#aaa", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center"},
    card: {background:"#161616", border:"1px solid #2a2a2a", borderRadius:12, padding:"12px", marginBottom:10},
    cardBl: {background:"#161616", border:"1px solid #2a2a2a", borderLeft:"3px solid #fff", borderRadius:12, padding:"12px", marginBottom:10},
    label: {fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8},
    mBtn: a => ({padding:"6px 10px", borderRadius:8, border:"1px solid "+(a?"transparent":"#333"), background:a?"#fff":"#222", color:a?"#000":"#ccc", fontSize:12, cursor:"pointer", opacity:a?0.7:1}),
    inp: {height:34, padding:"0 8px", border:"1px solid #2a2a2a", borderRadius:7, fontSize:13, background:"#1f1f1f", color:"#e5e5e5", width:"100%"},
    inpC: {height:34, padding:"0 8px", border:"1px solid #2a2a2a", borderRadius:7, fontSize:13, background:"#1f1f1f", color:"#e5e5e5", width:"100%", textAlign:"center"},
    exBox: {background:"#1a1a1a", borderRadius:8, padding:"10px", marginBottom:8, border:"1px solid #252525"},
    row: {display:"grid", gridTemplateColumns:"22px 1fr 1fr 20px", gap:4, alignItems:"center", marginBottom:4},
    del: {background:"none", border:"none", cursor:"pointer", color:"#555", fontSize:14, padding:0},
    sbtn: {padding:"4px 10px", borderRadius:6, border:"1px solid #2a2a2a", background:"#1f1f1f", fontSize:12, cursor:"pointer", color:"#aaa", marginTop:2},
    abtn: {width:"100%", padding:7, borderRadius:8, border:"1px solid #2a2a2a", background:"#1f1f1f", fontSize:13, cursor:"pointer", color:"#aaa", marginTop:4},
    savebtn: {width:"100%", padding:12, borderRadius:8, border:"none", background:"#fff", color:"#000", fontSize:14, fontWeight:500, cursor:"pointer", marginTop:6},
    tag: {fontSize:11, padding:"2px 8px", borderRadius:20, background:"#252525", color:"#aaa"},
    empty: {textAlign:"center", color:"#666", padding:"2rem 0", fontSize:14},
    stats: {display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12},
    stat: {background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, padding:"10px", textAlign:"center"},
    calGrid: {display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2},
    prRow: {display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #252525", fontSize:13},
    histItem: {padding:"10px 0", borderBottom:"1px solid #252525"},
  };

  return (
    <div style={c.wrap}>
      <div style={c.tabs}>
        {[["log","+ Treeni"],["history","Historia"],["progress","Progressio"]].map(([id,l]) => (
          <button key={id} style={c.tab(tab===id)} onClick={() => setTab(id)}>{l}</button>
        ))}
        <button style={c.gear} onClick={() => setShowSettings(s => !s)} title="Asetukset">⚙</button>
      </div>

      {showSettings && (
        <div style={c.card}>
          <div style={c.label}>Asetukset</div>
          <div style={{fontSize:12, color:"#888", marginBottom:10}}>
            Varmuuskopioi treenit tiedostoon tai palauta aiemmin tallennetusta tiedostosta.
          </div>
          <button style={{...c.abtn, marginTop:0, marginBottom:8}} onClick={exportData}>
            ⬇ Vie tiedot ({workouts.length} treeniä)
          </button>
          <label style={{...c.abtn, display:"block", textAlign:"center", marginTop:0}}>
            ⬆ Tuo tiedot tiedostosta
            <input type="file" accept="application/json,.json" onChange={importData} style={{display:"none"}} />
          </label>
        </div>
      )}

      {tab === "log" && (
        <div>
          <div style={c.card}>
            <div style={c.label}>Valitse lihasryhmät</div>
            {Object.entries(GROUPS).map(([cat,muscles]) => (
              <div key={cat} style={{marginBottom:10}}>
                <div style={{fontSize:11, color:"#666", marginBottom:4}}>{cat}</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                  {muscles.map(m => (
                    <button key={m} style={c.mBtn(selMuscles.includes(m))} onClick={() => toggleMuscle(m)}>
                      {selMuscles.includes(m) ? "✓ " : "+ "}{m}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {blocks.map(block => (
            <div key={block.id} style={c.cardBl}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
                <span style={{fontWeight:500}}>{block.muscle}</span>
                <button style={c.del} onClick={() => rmBlock(block.id)}>✕</button>
              </div>

              {block.muscle === "Cardio" ? (
                <div style={{display:"flex", flexDirection:"column", gap:8}}>
                  <input style={c.inp} type="number" placeholder="Kesto (min)" value={block.ct}
                    onChange={e => updBlock(block.id,"ct",e.target.value)} />
                  <textarea style={{...c.inp, height:56, padding:"6px 8px", resize:"none"}}
                    placeholder="Muistiinpanot..." value={block.cn}
                    onChange={e => updBlock(block.id,"cn",e.target.value)} />
                </div>
              ) : (
                <div>
                  {block.exercises.map((ex, xi) => (
                    <div key={ex.id} style={c.exBox}>
                      <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:6}}>
                        <input style={c.inp} list={"dl-"+ex.id}
                          placeholder="Liikkeen nimi" value={ex.name}
                          onChange={e => setExName(block.id, ex.id, e.target.value)} />
                        <datalist id={"dl-"+ex.id}>
                          {prevEx(block.muscle).map(n => <option key={n} value={n} />)}
                        </datalist>
                        {xi > 0 && <button style={c.del} onClick={() => rmEx(block.id, ex.id)}>✕</button>}
                      </div>
                      {(() => {
                        const q = ex.name.trim().toLowerCase();
                        const suggestions = prevEx(block.muscle).filter(n =>
                          n.toLowerCase() !== q && (!q || n.toLowerCase().includes(q))
                        );
                        if (!suggestions.length) return null;
                        return (
                          <div style={{display:"flex", flexWrap:"wrap", gap:4, marginBottom:8}}>
                            {suggestions.map(n => (
                              <button key={n}
                                style={{fontSize:11, padding:"3px 9px", borderRadius:14, background:"#1f1f1f", color:"#aaa", border:"1px solid #2a2a2a", cursor:"pointer"}}
                                onClick={() => setExName(block.id, ex.id, n)}>
                                {n}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                      <div style={{display:"grid", gridTemplateColumns:"22px 1fr 1fr 20px", gap:4, marginBottom:4}}>
                        <span></span>
                        <span style={{fontSize:10, color:"#666", textAlign:"center"}}>Toistot</span>
                        <span style={{fontSize:10, color:"#666", textAlign:"center"}}>Paino kg</span>
                        <span></span>
                      </div>
                      {ex.sets.map((s, si) => (
                        <div key={s.id} style={c.row}>
                          <span style={{fontSize:12, color:"#666", textAlign:"center"}}>{si+1}</span>
                          <input style={c.inpC} type="number" placeholder="10" value={s.reps}
                            onChange={e => updSet(block.id, ex.id, s.id, "reps", e.target.value)} />
                          <input style={c.inpC} type="number" placeholder="0" step="0.5" value={s.weight}
                            onChange={e => updSet(block.id, ex.id, s.id, "weight", e.target.value)} />
                          <button style={c.del} onClick={() => rmSet(block.id, ex.id, s.id)}>✕</button>
                        </div>
                      ))}
                      <button style={c.sbtn} onClick={() => addSet(block.id, ex.id)}>+ sarja</button>
                    </div>
                  ))}
                  <button style={c.abtn} onClick={() => addEx(block.id)}>+ liike</button>
                </div>
              )}
            </div>
          ))}

          {blocks.length > 0 && (
            <button style={c.savebtn} onClick={saveWorkout}>Tallenna treeni</button>
          )}
        </div>
      )}

      {tab === "history" && (
        <div>
          <div style={c.card}>
            <div style={{fontWeight:500, fontSize:14, marginBottom:10, textTransform:"capitalize"}}>
              {now.toLocaleDateString("fi-FI",{month:"long",year:"numeric"})}
            </div>
            <div style={{...c.calGrid, marginBottom:4}}>
              {["Su","Ma","Ti","Ke","To","Pe","La"].map(d => (
                <div key={d} style={{fontSize:10, color:"#666", textAlign:"center"}}>{d}</div>
              ))}
            </div>
            <div style={c.calGrid}>
              {Array.from({length: fd===0?6:fd-1}).map((_,i) => <div key={"e"+i} />)}
              {Array.from({length:dim}).map((_,i) => {
                const d = i+1, info = wDates[d], isT = d===now.getDate();
                return (
                  <div key={d} title={info||""} style={{
                    aspectRatio:"1", borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, fontWeight:isT?600:400,
                    background:info?"#fff":isT?"#2a2a2a":"transparent",
                    color:info?"#000":isT?"#fff":"#888"
                  }}>{d}</div>
                );
              })}
            </div>
            {Object.keys(wDates).length > 0 && (
              <div style={{marginTop:10}}>
                {Object.entries(wDates).sort((a,b) => a[0]-b[0]).map(([d,info]) => (
                  <div key={d} style={{fontSize:12, color:"#aaa", marginBottom:2}}><b>{d}.</b> {info}</div>
                ))}
              </div>
            )}
          </div>

          <div style={c.stats}>
            {[[workouts.length,"Treenikertaa"],[Object.keys(prs).length,"Liikettä"],[Math.round(totalVol/1000)+"t","Volyymi"]].map(([v,l]) => (
              <div key={l} style={c.stat}>
                <div style={{fontSize:20, fontWeight:500}}>{v}</div>
                <div style={{fontSize:11, color:"#888"}}>{l}</div>
              </div>
            ))}
          </div>

          <div style={c.card}>
            {workouts.length === 0 && <div style={c.empty}>Ei treenejä</div>}
            {[...workouts].reverse().map((w,ri) => {
              const i = workouts.length-1-ri;
              return (
                <div key={i} style={c.histItem}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                    <span style={{fontWeight:500, fontSize:13}}>
                      {fmtDate(w.date)}
                      {w.time && <span style={{fontWeight:400, color:"#666", fontSize:12, marginLeft:6}}>{w.time}</span>}
                    </span>
                    <button style={c.del} onClick={() => delW(i)}>🗑</button>
                  </div>
                  <div style={{display:"flex", flexWrap:"wrap", gap:4, margin:"4px 0"}}>
                    {(w.groups||[]).map(g => <span key={g.muscle} style={c.tag}>{g.muscle}</span>)}
                  </div>
                  {(w.groups||[]).map(g => (
                    <div key={g.muscle} style={{fontSize:12, color:"#aaa", marginBottom:2}}>
                      <b style={{color:"#e5e5e5"}}>{g.muscle}: </b>
                      {g.muscle==="Cardio"
                        ? (g.ct?g.ct+" min":"")+(g.cn?" · "+g.cn:"")
                        : (g.exercises||[]).map(e => e.name+" ("+(e.sets||[]).map(s => s.reps+"×"+s.weight+"kg").join(", ")+")").join(" · ")
                      }
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "progress" && (
        <div>
          <div style={c.card}>
            {allEx.length === 0 ? (
              <div style={c.empty}>Tallenna ensin treenejä</div>
            ) : (
              <div>
                <select value={curEx} onChange={e => setPEx(e.target.value)}
                  style={{...c.inp, height:36, marginBottom:12}}>
                  {allEx.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <div style={{display:"grid", gridTemplateColumns:"1fr 55px 65px", gap:4, marginBottom:4}}>
                  {["Päivä","Toistot","Paino"].map((l,i) => (
                    <span key={l} style={{fontSize:10, color:"#666", textAlign:i>0?"center":"left"}}>{l}</span>
                  ))}
                </div>
                {pEntries.map((e,i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"1fr 55px 65px", gap:4, padding:"6px 0", borderBottom:"1px solid #252525", fontSize:13}}>
                    <span style={{color:"#aaa"}}>{fmtDate(e.date)}</span>
                    <span style={{textAlign:"center"}}>{e.reps}</span>
                    <span style={{textAlign:"center"}}>{e.weight} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={c.card}>
            <div style={c.label}>Ennätykset</div>
            {Object.keys(prs).length === 0 ? (
              <div style={c.empty}>Ei ennätyksiä</div>
            ) : (
              Object.entries(prs).sort((a,b) => b[1].w-a[1].w).map(([name,pr]) => (
                <div key={name} style={c.prRow}>
                  <span>{name}</span>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:500}}>{pr.w} kg</div>
                    <div style={{fontSize:11, color:"#666"}}>{fmtDate(pr.d)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", background:"#fff", color:"#000", padding:"8px 18px", borderRadius:8, fontSize:13, zIndex:999, whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
