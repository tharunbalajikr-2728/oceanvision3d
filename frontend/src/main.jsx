import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import "./styles.css";

const API = "http://127.0.0.1:8000";

function latLonToXYZ(lat, lon, radius=2.02) {
  const phi = (90-lat) * Math.PI/180;
  const theta = (lon+180) * Math.PI/180;
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  ];
}

function valueFor(station, parameter) {
  return parameter === "temperature" ? station.temperature :
         parameter === "salinity" ? station.salinity : station.current_speed;
}

function markerColor(v, parameter) {
  if (parameter === "temperature") {
    if (v >= 29) return "#ff4d6d";
    if (v >= 27) return "#ffb703";
    return "#4cc9f0";
  }
  if (parameter === "salinity") return v >= 35 ? "#f72585" : "#4895ef";
  return v >= 0.9 ? "#ff7b00" : "#38bdf8";
}

function Ocean({stations, parameter, selected, onSelect}) {
  return (
    <>
      <Stars radius={20} depth={30} count={1500} factor={2} saturation={0} fade speed={0.5}/>
      <mesh rotation={[0,0,0]}>
        <sphereGeometry args={[2,64,64]}/>
        <meshStandardMaterial color="#0b4f71" roughness={0.8} metalness={0.1}/>
      </mesh>
      <mesh>
        <sphereGeometry args={[2.012,64,64]}/>
        <meshBasicMaterial color="#37c8ff" transparent opacity={0.08}/>
      </mesh>
      {stations.map(s => {
        const p = latLonToXYZ(s.lat, s.lon);
        const active = selected?.id === s.id;
        const color = markerColor(valueFor(s, parameter), parameter);
        return (
          <group key={s.id} position={p}>
            <mesh onClick={(e)=>{e.stopPropagation(); onSelect(s)}} scale={active ? 1.6 : 1}>
              <sphereGeometry args={[0.055,16,16]}/>
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2}/>
            </mesh>
            {active && (
              <Html distanceFactor={8}>
                <div className="miniLabel">{s.id}<br/><b>{s.name}</b></div>
              </Html>
            )}
          </group>
        )
      })}
    </>
  )
}

function App() {
  const [parameter, setParameter] = useState("temperature");
  const [depth, setDepth] = useState(50);
  const [stations, setStations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [series, setSeries] = useState([]);
  const [anomalies, setAnomalies] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/stations?parameter=${parameter}`).then(r=>r.json()).then(data=>{
      setStations(data);
      if (selected) setSelected(data.find(x=>x.id===selected.id) || null);
    });
    fetch(`${API}/api/anomalies?parameter=${parameter}`).then(r=>r.json()).then(setAnomalies);
  }, [parameter]);

  useEffect(() => {
    if (!selected) { setSeries([]); return; }
    fetch(`${API}/api/timeseries/${selected.id}?parameter=${parameter}`)
      .then(r=>r.json()).then(setSeries);
  }, [selected, parameter]);

  const selectedData = selected ? stations.find(s=>s.id===selected.id) : null;
  const avg = useMemo(()=>{
    if (!stations.length) return 0;
    return (stations.reduce((a,s)=>a+Math.abs(s.difference),0)/stations.length).toFixed(2);
  }, [stations]);

  return (
    <div className="app">
      <header>
        <div>
          <div className="brand">🌊 OCEANVISION <span>3D</span></div>
          <div className="subtitle">Numerical Model + In-Situ Ocean Observation Platform</div>
        </div>
        <div className="status"><i/> DEMO DATA • LIVE API</div>
      </header>

      <main>
        <aside className="panel left">
          <h3>DATA CONTROLS</h3>
          <label>Parameter</label>
          <select value={parameter} onChange={e=>setParameter(e.target.value)}>
            <option value="temperature">Temperature (°C)</option>
            <option value="salinity">Salinity (PSU)</option>
            <option value="current_speed">Current speed (m/s)</option>
          </select>

          <label>Depth: <b>{depth} m</b></label>
          <input type="range" min="0" max="500" step="10" value={depth} onChange={e=>setDepth(e.target.value)}/>

          <label>Observation date</label>
          <input type="date" defaultValue="2026-09-06"/>

          <div className="checks">
            <label><input type="checkbox" defaultChecked/> Numerical model</label>
            <label><input type="checkbox" defaultChecked/> In-situ observations</label>
          </div>

          <div className="legend">
            <b>Legend</b>
            <span><i className="dot cyan"/> Lower</span>
            <span><i className="dot yellow"/> Moderate</span>
            <span><i className="dot red"/> Higher</span>
          </div>

          <div className="hint">Drag to rotate • Scroll to zoom • Click a station</div>
        </aside>

        <section className="viewer">
          <Canvas camera={{position:[0,0,6], fov:45}}>
            <color attach="background" args={["#031525"]}/>
            <ambientLight intensity={1.5}/>
            <directionalLight position={[5,5,5]} intensity={2}/>
            <Ocean stations={stations} parameter={parameter} selected={selected} onSelect={setSelected}/>
            <OrbitControls enablePan={false} minDistance={3.2} maxDistance={9}/>
          </Canvas>
          <div className="viewerTitle">Bay of Bengal • {parameter.replace("_"," ")}</div>
          <div className="depthBadge">Depth {depth} m</div>
        </section>

        <aside className="panel right">
          <h3>STATION DETAILS</h3>
          {selectedData ? (
            <>
              <div className="stationName">📍 {selectedData.id}</div>
              <div className="muted">{selectedData.name}</div>
              <div className="coords">{selectedData.lat}° N • {selectedData.lon}° E</div>
              <div className="metrics">
                <div><small>Observed</small><strong>{valueFor(selectedData,parameter)}</strong></div>
                <div><small>Model</small><strong>{selectedData.model_value}</strong></div>
                <div><small>Difference</small><strong className={Math.abs(selectedData.difference)>0.7?"warn":""}>{selectedData.difference}</strong></div>
              </div>
              <h4>24-HOUR COMPARISON</h4>
              <div className="chart">
                {series.map((p,i)=>(
                  <div className="barRow" key={i}>
                    <span>{p.time}</span>
                    <div className="barTrack"><div className="barObserved" style={{width:`${Math.max(8, Math.min(100, p.observed*2.8))}%`}}/></div>
                    <b>{p.observed}</b>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="empty">Select a glowing station on the 3D globe to inspect observations.</div>}

          <h3 className="mt">SYSTEM SUMMARY</h3>
          <div className="summary"><span>Stations</span><b>{stations.length}</b></div>
          <div className="summary"><span>Avg. absolute difference</span><b>{avg}</b></div>
          <div className="summary"><span>Anomalies</span><b className={anomalies.length?"warn":""}>{anomalies.length}</b></div>
        </aside>
      </main>

      <section className="bottom">
        <div>
          <h3>🚨 ANOMALY DETECTION</h3>
          {anomalies.length ? anomalies.map(a=>
            <div className="alert" key={a.station_id}>
              <b>{a.station_id}</b> — {a.name}
              <span>{a.parameter}: deviation {a.difference}</span>
            </div>
          ) : <div className="ok">✓ No anomalies above the demo threshold.</div>}
        </div>
        <div className="formula">
          <b>Validation</b>
          <p>Difference = Model − Observation</p>
          <p>Demo anomaly threshold is parameter-dependent.</p>
        </div>
      </section>
    </div>
  )
}

createRoot(document.getElementById("root")).render(<App/>);
