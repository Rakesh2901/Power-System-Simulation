import { useState, useEffect, useRef, useCallback } from "react";

// ── Utility helpers ──────────────────────────────────────────────────────────
const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ── Topology: IEEE 14-bus skeleton ──────────────────────────────────────────
const BUSES = [
  { id: 1,  x: 300, y:  80, type: "slack",      name: "Slack",    pGen: 2.32, pLoad: 0.0  },
  { id: 2,  x: 180, y: 180, type: "generator",  name: "Gen-2",    pGen: 0.40, pLoad: 0.217},
  { id: 3,  x: 440, y: 200, type: "generator",  name: "Gen-3",    pGen: 0.0,  pLoad: 0.942},
  { id: 4,  x: 320, y: 230, type: "load",       name: "Load-4",   pGen: 0.0,  pLoad: 0.478},
  { id: 5,  x: 200, y: 310, type: "load",       name: "Load-5",   pGen: 0.0,  pLoad: 0.076},
  { id: 6,  x: 480, y: 320, type: "generator",  name: "Gen-6",    pGen: 0.0,  pLoad: 0.112},
  { id: 7,  x: 360, y: 340, type: "load",       name: "Load-7",   pGen: 0.0,  pLoad: 0.0  },
  { id: 8,  x: 430, y: 400, type: "generator",  name: "Gen-8",    pGen: 0.0,  pLoad: 0.0  },
  { id: 9,  x: 280, y: 400, type: "load",       name: "Load-9",   pGen: 0.0,  pLoad: 0.295},
  { id: 10, x: 220, y: 450, type: "load",       name: "Load-10",  pGen: 0.0,  pLoad: 0.090},
  { id: 11, x: 350, y: 460, type: "load",       name: "Load-11",  pGen: 0.0,  pLoad: 0.035},
  { id: 12, x: 500, y: 440, type: "renewable",  name: "Solar-12", pGen: 0.61, pLoad: 0.061},
  { id: 13, x: 560, y: 380, type: "renewable",  name: "Wind-13",  name: "Wind-13",  pGen: 0.78, pLoad: 0.135},
  { id: 14, x: 160, y: 390, type: "load",       name: "Load-14",  pGen: 0.0,  pLoad: 0.149},
];

const EDGES = [
  [1,2],[1,5],[2,3],[2,4],[2,5],[3,4],[4,5],[4,7],[4,9],
  [5,6],[6,11],[6,12],[6,13],[7,8],[7,9],[9,10],[9,14],
  [10,11],[12,13],[13,14],
];

// ── Color palette ────────────────────────────────────────────────────────────
const C = {
  bg:        "#050A0F",
  panel:     "#080E16",
  border:    "#0D1F35",
  accent:    "#00C8FF",
  accentDim: "#004B6B",
  green:     "#00FF9C",
  yellow:    "#FFD600",
  red:       "#FF3B5C",
  purple:    "#B44BFF",
  grid:      "#0A1825",
  textDim:   "#2A4A6B",
  textMid:   "#4A8CAB",
  textBright:"#8ECFDF",
};

const busColor = (type) => ({
  slack:     C.accent,
  generator: C.green,
  load:      C.textMid,
  renewable: C.yellow,
})[type] || C.textMid;

// ── Spark-line component ─────────────────────────────────────────────────────
function Sparkline({ data, color, width = 120, height = 32 }) {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  ).join(" ");
  return (
    <svg width={width} height={height} style={{ display:"block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" opacity="0.85" />
      <circle cx={(data.length-1)/(data.length-1)*width}
        cy={height - ((data[data.length-1]-min)/range)*(height-4)-2}
        r="2.5" fill={color} />
    </svg>
  );
}

// ── Radial gauge ─────────────────────────────────────────────────────────────
function RadialGauge({ value, max, label, color, size = 70 }) {
  const pct = clamp(value / max, 0, 1);
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ * 0.75;
  const gap  = circ - dash;
  const rotate = -225;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={C.border} strokeWidth="6"
        strokeDasharray={`${circ*0.75} ${circ*0.25}`}
        strokeLinecap="round"
        transform={`rotate(${rotate} ${size/2} ${size/2})`} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${gap + circ*0.25}`}
        strokeLinecap="round"
        transform={`rotate(${rotate} ${size/2} ${size/2})`}
        style={{ transition:"stroke-dasharray 0.4s ease", filter:`drop-shadow(0 0 4px ${color})` }} />
      <text x={size/2} y={size/2 + 5} textAnchor="middle"
        fill={color} fontSize="12" fontFamily="'IBM Plex Mono', monospace" fontWeight="700">
        {(value).toFixed(2)}
      </text>
      <text x={size/2} y={size/2 + 17} textAnchor="middle"
        fill={C.textMid} fontSize="8" fontFamily="'IBM Plex Mono', monospace">
        {label}
      </text>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PIGNNDashboard() {
  const [tick, setTick]     = useState(0);
  const [running, setRunning] = useState(true);
  const [fault, setFault]   = useState(null);   // bus id or null
  const [mode, setMode]     = useState("NORMAL"); // NORMAL | FAULT | RECOVERY
  const [selectedBus, setSelectedBus] = useState(null);
  const [tab, setTab]       = useState("topology"); // topology | gnn | opf | stability

  // Timeseries history buffers
  const hist = useRef({
    freq:      Array(60).fill(60.0),
    voltage:   Array(60).fill(1.0),
    renewable: Array(60).fill(0.42),
    loss:      Array(60).fill(0.012),
    stability: Array(60).fill(0.94),
    opfCost:   Array(60).fill(182.4),
  });

  // Live state
  const [liveState, setLiveState] = useState({
    busVoltages:  Object.fromEntries(BUSES.map(b => [b.id, 1.0])),
    busAngles:    Object.fromEntries(BUSES.map(b => [b.id, 0.0])),
    lineFlows:    Object.fromEntries(EDGES.map(e => [e.join("-"), rand(0.1,0.6)])),
    freq:         60.0,
    renewable:    0.42,
    gnnLoss:      0.0123,
    stabilityIdx: 0.94,
    opfCost:      182.4,
    gnnIter:      0,
    opfConverged: true,
  });

  // Animation tick
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(t => t + 1), 600);
    return () => clearInterval(id);
  }, [running]);

  // Physics-informed simulation step
  useEffect(() => {
    if (!running) return;

    setLiveState(prev => {
      const isFault  = fault !== null;
      const isRecov  = mode === "RECOVERY";

      // Renewable stochasticity (wind/solar)
      const renewDelta = rand(-0.03, 0.04);
      const renewable  = clamp(prev.renewable + renewDelta, 0.1, 0.95);

      // Frequency deviation (swing equation surrogate)
      const loadImbalance = (renewable - prev.renewable) * 2.0 + (isFault ? rand(-0.15,0.05) : 0);
      const freqDelta = -loadImbalance * 0.4 + (isRecov ? 0.05 : 0) + rand(-0.01, 0.01);
      const freq = clamp(prev.freq + freqDelta, isFault ? 58.5 : 59.2, 60.8);

      // Bus voltages (power-flow residual surrogate)
      const newV = { ...prev.busVoltages };
      const newA = { ...prev.busAngles };
      BUSES.forEach(b => {
        let vNoise = rand(-0.005, 0.005);
        if (isFault && b.id === fault) vNoise = rand(-0.12, -0.04);
        if (isRecov)  vNoise += 0.01;
        newV[b.id] = clamp(prev.busVoltages[b.id] + vNoise, 0.82, 1.08);
        newA[b.id] = prev.busAngles[b.id] + rand(-0.4, 0.4) + (isFault && b.id === fault ? rand(-4,4) : 0);
      });

      // Line flows (proportional to voltage diff)
      const newFlows = {};
      EDGES.forEach(([a,b]) => {
        const vDiff = newV[a] - newV[b];
        const base  = prev.lineFlows[`${a}-${b}`];
        newFlows[`${a}-${b}`] = clamp(base + vDiff * 0.3 + rand(-0.02,0.02), 0, 1.05);
      });

      // GNN physics loss (KCL + KVL residuals)
      const kcl = BUSES.reduce((s,b) => s + Math.abs(newV[b.id]-1.0)*0.01, 0);
      const gnnLoss = clamp(kcl + rand(0,0.002) + (isFault ? 0.05 : 0), 0.001, 0.15);

      // Transient stability index (CCT-based surrogate)
      const angleSpread = Math.max(...Object.values(newA)) - Math.min(...Object.values(newA));
      const stabilityIdx = clamp(1.0 - angleSpread/120 - (isFault ? 0.25 : 0) + (isRecov ? 0.05 : 0), 0.05, 1.0);

      // OPF cost (Lagrangian + penalty for constraint violation)
      const congestion = Object.values(newFlows).filter(f => f > 0.9).length;
      const opfCost = clamp(prev.opfCost + rand(-3,3) + congestion*8 + (isFault?15:0) - (isRecov?6:0), 120, 380);

      // Update history buffers
      const H = hist.current;
      const push = (arr, v) => { arr.push(v); if (arr.length > 60) arr.shift(); };
      push(H.freq,      freq);
      push(H.voltage,   Object.values(newV).reduce((a,b)=>a+b,0)/BUSES.length);
      push(H.renewable, renewable);
      push(H.loss,      gnnLoss);
      push(H.stability, stabilityIdx);
      push(H.opfCost,   opfCost);

      return {
        busVoltages: newV, busAngles: newA, lineFlows: newFlows,
        freq, renewable, gnnLoss, stabilityIdx, opfCost,
        gnnIter: (prev.gnnIter + 1) % 9999,
        opfConverged: gnnLoss < 0.04,
      };
    });
  }, [tick]);

  const triggerFault = () => {
    const busId = BUSES[Math.floor(Math.random()*BUSES.length)].id;
    setFault(busId);
    setMode("FAULT");
    setTimeout(() => { setMode("RECOVERY"); }, 4000);
    setTimeout(() => { setFault(null); setMode("NORMAL"); }, 9000);
  };

  const voltColor = (v) => v < 0.90 ? C.red : v < 0.95 ? C.yellow : v > 1.05 ? C.yellow : C.green;
  const flowColor = (f) => f > 0.9 ? C.red : f > 0.7 ? C.yellow : C.green;

  const modeColor = { NORMAL: C.green, FAULT: C.red, RECOVERY: C.yellow }[mode];
  const modeGlow  = { NORMAL: "0 0 12px #00FF9C44", FAULT: "0 0 16px #FF3B5C66", RECOVERY: "0 0 14px #FFD60055" }[mode];

  // ── Topology SVG canvas ───────────────────────────────────────────────────
  const TopologyCanvas = () => (
    <svg viewBox="0 50 660 480" style={{ width:"100%", height:"100%", overflow:"visible" }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={C.accentDim}/>
        </marker>
      </defs>

      {/* Grid lines */}
      {Array.from({length:12},(_,i)=>(
        <line key={`h${i}`} x1="0" y1={50+i*45} x2="660" y2={50+i*45} stroke={C.grid} strokeWidth="0.5"/>
      ))}
      {Array.from({length:15},(_,i)=>(
        <line key={`v${i}`} x1={i*46} y1="50" x2={i*46} y2="540" stroke={C.grid} strokeWidth="0.5"/>
      ))}

      {/* Transmission lines */}
      {EDGES.map(([a,b]) => {
        const ba = BUSES.find(x=>x.id===a), bb = BUSES.find(x=>x.id===b);
        const flow = liveState.lineFlows[`${a}-${b}`] || 0;
        const fc = flowColor(flow);
        const overload = flow > 0.9;
        return (
          <g key={`e${a}-${b}`}>
            <line x1={ba.x} y1={ba.y} x2={bb.x} y2={bb.y}
              stroke={C.border} strokeWidth="8" strokeLinecap="round" />
            <line x1={ba.x} y1={ba.y} x2={bb.x} y2={bb.y}
              stroke={fc} strokeWidth={overload ? 3 : 1.5} strokeLinecap="round"
              opacity={overload ? 1 : 0.6}
              style={{ filter: overload ? `drop-shadow(0 0 4px ${fc})` : "none",
                       strokeDasharray: overload ? "6 3" : "none" }} />
            {/* flow label */}
            <text x={(ba.x+bb.x)/2} y={(ba.y+bb.y)/2 - 5}
              fill={fc} fontSize="8" fontFamily="'IBM Plex Mono',monospace"
              textAnchor="middle" opacity="0.75">
              {(flow*100).toFixed(0)}%
            </text>
          </g>
        );
      })}

      {/* Bus nodes */}
      {BUSES.map(b => {
        const v = liveState.busVoltages[b.id];
        const vc = voltColor(v);
        const isFaultBus = fault === b.id;
        const isSelected = selectedBus === b.id;
        const r = b.type === "slack" ? 16 : b.type === "generator" ? 13 : b.type === "renewable" ? 12 : 10;
        return (
          <g key={`b${b.id}`} style={{ cursor:"pointer" }}
            onClick={() => setSelectedBus(isSelected ? null : b.id)}>
            {/* Pulse ring for fault */}
            {isFaultBus && (
              <circle cx={b.x} cy={b.y} r={r+12} fill="none"
                stroke={C.red} strokeWidth="1.5" opacity="0.6"
                style={{ animation:"ping 0.8s ease-out infinite" }} />
            )}
            {/* Selection ring */}
            {isSelected && (
              <circle cx={b.x} cy={b.y} r={r+8} fill="none"
                stroke={C.accent} strokeWidth="1" opacity="0.9"
                strokeDasharray="4 2" />
            )}
            {/* Main bus circle */}
            <circle cx={b.x} cy={b.y} r={r} fill={C.panel}
              stroke={isFaultBus ? C.red : vc} strokeWidth={isFaultBus ? 2.5 : 1.5}
              filter="url(#glow)"
              style={{ filter: `drop-shadow(0 0 ${isFaultBus?10:5}px ${isFaultBus?C.red:vc})` }} />
            {/* Bus type icon */}
            {b.type === "generator" && (
              <text x={b.x} y={b.y+4} textAnchor="middle"
                fill={C.green} fontSize="10" fontFamily="monospace">G</text>
            )}
            {b.type === "slack" && (
              <text x={b.x} y={b.y+4} textAnchor="middle"
                fill={C.accent} fontSize="10" fontFamily="monospace">S</text>
            )}
            {b.type === "renewable" && (
              <text x={b.x} y={b.y+4} textAnchor="middle"
                fill={C.yellow} fontSize="10" fontFamily="monospace">R</text>
            )}
            {b.type === "load" && (
              <text x={b.x} y={b.y+4} textAnchor="middle"
                fill={C.textMid} fontSize="8" fontFamily="monospace">L</text>
            )}
            {/* Label */}
            <text x={b.x} y={b.y - r - 4} textAnchor="middle"
              fill={isFaultBus ? C.red : C.textBright} fontSize="9"
              fontFamily="'IBM Plex Mono', monospace" fontWeight="600">
              {b.name}
            </text>
            <text x={b.x} y={b.y + r + 11} textAnchor="middle"
              fill={vc} fontSize="9" fontFamily="'IBM Plex Mono', monospace">
              {v.toFixed(3)}pu
            </text>
          </g>
        );
      })}
    </svg>
  );

  // ── GNN Architecture panel ────────────────────────────────────────────────
  const GNNPanel = () => {
    const layers = [
      { name:"Input Features",  nodes:6, color:C.textMid, desc:"V, θ, P, Q, Yd, type" },
      { name:"Physics Encoder", nodes:5, color:C.accent,  desc:"KCL/KVL embedding" },
      { name:"MPNN Layer 1",    nodes:5, color:C.accent,  desc:"Message passing" },
      { name:"MPNN Layer 2",    nodes:4, color:C.purple,  desc:"Aggregation" },
      { name:"Physics Decoder", nodes:4, color:C.purple,  desc:"Constraint residuals" },
      { name:"Multi-task Head", nodes:3, color:C.green,   desc:"SE / Stability / OPF" },
    ];
    return (
      <div style={{ padding:"16px", fontFamily:"'IBM Plex Mono',monospace", height:"100%", overflowY:"auto" }}>
        <div style={{ fontSize:"10px", color:C.textMid, marginBottom:"16px", letterSpacing:"2px" }}>
          PHYSICS-INFORMED MESSAGE PASSING ARCHITECTURE
        </div>
        <svg viewBox="0 0 580 260" style={{ width:"100%", marginBottom:"16px" }}>
          {layers.map((layer, li) => {
            const x = 20 + li * 92;
            const nodeH = 240 / layer.nodes;
            return (
              <g key={li}>
                {/* Layer connections */}
                {li < layers.length - 1 && layer.nodes > 0 &&
                  Array.from({length:layer.nodes}, (_, ni) =>
                    Array.from({length:layers[li+1].nodes}, (_, nj) => {
                      const y1 = 20 + ni * nodeH + nodeH/2;
                      const y2 = 20 + nj * (240/layers[li+1].nodes) + (240/layers[li+1].nodes)/2;
                      return <line key={`${ni}-${nj}`}
                        x1={x+12} y1={y1} x2={x+80} y2={y2}
                        stroke={layer.color} strokeWidth="0.4" opacity="0.2" />;
                    })
                  )
                }
                {/* Nodes */}
                {Array.from({length:layer.nodes}, (_, ni) => {
                  const y = 20 + ni * nodeH + nodeH/2;
                  const active = Math.random() > 0.3;
                  return (
                    <circle key={ni} cx={x+6} cy={y} r="5"
                      fill={active ? layer.color : C.border}
                      stroke={layer.color} strokeWidth="0.8"
                      style={{ filter: active ? `drop-shadow(0 0 3px ${layer.color})` : "none" }} />
                  );
                })}
                {/* Label */}
                <text x={x+6} y={254} textAnchor="middle" fill={layer.color}
                  fontSize="7" fontFamily="'IBM Plex Mono',monospace" fontWeight="600">
                  {layer.name.split(" ").map((w,i) =>
                    <tspan key={i} x={x+6} dy={i===0?0:9}>{w}</tspan>
                  )}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Loss metrics */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginBottom:"16px" }}>
          {[
            { label:"KCL Residual",   val: (liveState.gnnLoss*0.4).toFixed(5),  color:C.accent },
            { label:"KVL Residual",   val: (liveState.gnnLoss*0.35).toFixed(5), color:C.purple },
            { label:"Swing Eq Loss",  val: (liveState.gnnLoss*0.25).toFixed(5), color:C.yellow },
          ].map(m => (
            <div key={m.label} style={{ background:C.grid, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"10px" }}>
              <div style={{ fontSize:"8px", color:C.textMid, marginBottom:"4px", letterSpacing:"1px" }}>{m.label}</div>
              <div style={{ fontSize:"14px", color:m.color, fontWeight:"700" }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* Multi-task output heads */}
        <div style={{ fontSize:"9px", color:C.textMid, marginBottom:"8px", letterSpacing:"2px" }}>OUTPUT TASK HEADS</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px" }}>
          {[
            { label:"State Estimation",  sub:"Dynamic SE", color:C.accent,  metric:`${(liveState.gnnLoss*100).toFixed(2)}% err` },
            { label:"Transient Stability",sub:"CCT predict", color:C.green,  metric:`${(liveState.stabilityIdx*100).toFixed(1)}% idx` },
            { label:"AC-OPF Solver",     sub:"Primal-dual", color:C.purple, metric:`$${liveState.opfCost.toFixed(1)}/hr` },
          ].map(h => (
            <div key={h.label} style={{ background:C.grid, border:`1px solid ${h.color}33`,
              borderRadius:"4px", padding:"10px", borderLeft:`3px solid ${h.color}` }}>
              <div style={{ fontSize:"9px", color:h.color, fontWeight:"700", marginBottom:"2px" }}>{h.label}</div>
              <div style={{ fontSize:"8px", color:C.textMid, marginBottom:"6px" }}>{h.sub}</div>
              <div style={{ fontSize:"13px", color:h.color }}>{h.metric}</div>
            </div>
          ))}
        </div>

        {/* Physics constraints satisfaction */}
        <div style={{ marginTop:"16px", fontSize:"9px", color:C.textMid, marginBottom:"8px", letterSpacing:"2px" }}>PHYSICS CONSTRAINT SATISFACTION</div>
        {[
          { name:"Power Balance (KCL)",     pct: clamp(1-liveState.gnnLoss*8,0,1), color:C.green },
          { name:"Voltage Limits [0.9,1.1]",pct: BUSES.filter(b=>liveState.busVoltages[b.id]>=0.9&&liveState.busVoltages[b.id]<=1.1).length/BUSES.length, color:C.accent },
          { name:"Thermal Line Limits",      pct: EDGES.filter(e=>liveState.lineFlows[e.join("-")]<=1.0).length/EDGES.length, color:C.yellow },
          { name:"Generator Ramp Rates",     pct: clamp(0.85+rand(-0.05,0.08),0,1), color:C.purple },
        ].map(c => (
          <div key={c.name} style={{ marginBottom:"8px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
              <span style={{ fontSize:"9px", color:C.textBright }}>{c.name}</span>
              <span style={{ fontSize:"9px", color:c.color }}>{(c.pct*100).toFixed(1)}%</span>
            </div>
            <div style={{ height:"4px", background:C.border, borderRadius:"2px" }}>
              <div style={{ width:`${c.pct*100}%`, height:"100%", background:c.color,
                borderRadius:"2px", transition:"width 0.5s ease",
                boxShadow:`0 0 6px ${c.color}` }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── OPF Panel ─────────────────────────────────────────────────────────────
  const OPFPanel = () => (
    <div style={{ padding:"16px", fontFamily:"'IBM Plex Mono',monospace", height:"100%", overflowY:"auto" }}>
      <div style={{ fontSize:"10px", color:C.textMid, marginBottom:"16px", letterSpacing:"2px" }}>
        CONSTRAINED AC-OPF — LAGRANGIAN NEURAL SOLVER
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"16px" }}>
        <div style={{ background:C.grid, border:`1px solid ${liveState.opfConverged?C.green:C.yellow}`,
          borderRadius:"4px", padding:"12px", gridColumn:"1/-1" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:"9px", color:C.textMid, marginBottom:"4px" }}>CONVERGENCE STATUS</div>
              <div style={{ fontSize:"16px", color:liveState.opfConverged?C.green:C.yellow, fontWeight:"700" }}>
                {liveState.opfConverged ? "✓ CONVERGED" : "⟳ ITERATING"}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:"9px", color:C.textMid, marginBottom:"4px" }}>OPTIMAL COST</div>
              <div style={{ fontSize:"22px", color:C.purple, fontWeight:"700" }}>
                ${liveState.opfCost.toFixed(2)}<span style={{ fontSize:"11px", color:C.textMid }}>/hr</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generator dispatch */}
      <div style={{ fontSize:"9px", color:C.textMid, marginBottom:"8px", letterSpacing:"2px" }}>OPTIMAL GENERATOR DISPATCH</div>
      {BUSES.filter(b=>b.type==="generator"||b.type==="slack").map(b => {
        const v = liveState.busVoltages[b.id];
        const pct = clamp((b.pGen + rand(-0.05,0.05)) / 2.5, 0.05, 1);
        return (
          <div key={b.id} style={{ marginBottom:"10px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
              <span style={{ fontSize:"9px", color:C.textBright }}>{b.name} (Bus {b.id})</span>
              <span style={{ fontSize:"9px", color:C.green }}>{(pct*250).toFixed(1)} MW</span>
            </div>
            <div style={{ height:"6px", background:C.border, borderRadius:"3px" }}>
              <div style={{ width:`${pct*100}%`, height:"100%",
                background:`linear-gradient(90deg, ${C.accentDim}, ${C.green})`,
                borderRadius:"3px", transition:"width 0.5s ease" }} />
            </div>
          </div>
        );
      })}

      {/* Renewable curtailment */}
      <div style={{ fontSize:"9px", color:C.textMid, margin:"16px 0 8px", letterSpacing:"2px" }}>RENEWABLE INTEGRATION</div>
      {BUSES.filter(b=>b.type==="renewable").map(b => {
        const avail = liveState.renewable;
        const dispatch = clamp(avail - rand(0,0.12), 0.05, avail);
        const curtail = avail - dispatch;
        return (
          <div key={b.id} style={{ background:C.grid, border:`1px solid ${C.border}`, borderRadius:"4px",
            padding:"10px", marginBottom:"8px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
              <span style={{ fontSize:"9px", color:C.yellow, fontWeight:"700" }}>{b.name}</span>
              <span style={{ fontSize:"8px", color:C.textMid }}>Bus {b.id}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px" }}>
              <div><div style={{ fontSize:"8px", color:C.textMid }}>Available</div>
                <div style={{ fontSize:"12px", color:C.yellow }}>{(avail*100).toFixed(0)}%</div></div>
              <div><div style={{ fontSize:"8px", color:C.textMid }}>Dispatched</div>
                <div style={{ fontSize:"12px", color:C.green }}>{(dispatch*100).toFixed(0)}%</div></div>
              <div><div style={{ fontSize:"8px", color:C.textMid }}>Curtailed</div>
                <div style={{ fontSize:"12px", color:curtail>0.08?C.red:C.textMid }}>{(curtail*100).toFixed(0)}%</div></div>
            </div>
          </div>
        );
      })}

      {/* Lagrangian multipliers */}
      <div style={{ fontSize:"9px", color:C.textMid, margin:"16px 0 8px", letterSpacing:"2px" }}>LAGRANGE MULTIPLIERS (SHADOW PRICES)</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
        {["V_max","V_min","P_bal","Q_bal"].map(c => (
          <div key={c} style={{ background:C.grid, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"8px" }}>
            <div style={{ fontSize:"8px", color:C.textMid, marginBottom:"3px" }}>λ_{c}</div>
            <div style={{ fontSize:"13px", color:C.purple }}>{rand(0.001,0.05).toFixed(4)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Stability Panel ───────────────────────────────────────────────────────
  const StabilityPanel = () => {
    const angles = Object.entries(liveState.busAngles).slice(0,8);
    const maxAngle = Math.max(...Object.values(liveState.busAngles).map(Math.abs));
    return (
      <div style={{ padding:"16px", fontFamily:"'IBM Plex Mono',monospace", height:"100%", overflowY:"auto" }}>
        <div style={{ fontSize:"10px", color:C.textMid, marginBottom:"16px", letterSpacing:"2px" }}>
          TRANSIENT STABILITY — NEURAL CCT PREDICTOR
        </div>

        {/* Stability index */}
        <div style={{ display:"flex", alignItems:"center", gap:"20px", background:C.grid,
          border:`2px solid ${liveState.stabilityIdx > 0.6 ? C.green : liveState.stabilityIdx > 0.35 ? C.yellow : C.red}`,
          borderRadius:"6px", padding:"16px", marginBottom:"16px" }}>
          <RadialGauge value={liveState.stabilityIdx} max={1.0}
            label="Stab Idx" color={liveState.stabilityIdx>0.6?C.green:liveState.stabilityIdx>0.35?C.yellow:C.red}
            size={80} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"9px", color:C.textMid, marginBottom:"4px" }}>TRANSIENT STABILITY ASSESSMENT</div>
            <div style={{ fontSize:"18px", fontWeight:"700",
              color: liveState.stabilityIdx > 0.6 ? C.green : liveState.stabilityIdx > 0.35 ? C.yellow : C.red }}>
              {liveState.stabilityIdx > 0.6 ? "STABLE" : liveState.stabilityIdx > 0.35 ? "MARGINAL" : "⚠ UNSTABLE"}
            </div>
            <div style={{ fontSize:"9px", color:C.textMid, marginTop:"4px" }}>
              CCT Prediction: {(liveState.stabilityIdx * 0.8 + 0.1).toFixed(3)}s
            </div>
          </div>
        </div>

        {/* Rotor angle plot (simplified) */}
        <div style={{ fontSize:"9px", color:C.textMid, marginBottom:"8px", letterSpacing:"2px" }}>ROTOR ANGLES (deg)</div>
        <div style={{ background:C.grid, border:`1px solid ${C.border}`, borderRadius:"4px",
          padding:"12px", marginBottom:"16px" }}>
          <svg viewBox="0 0 400 120" style={{ width:"100%" }}>
            <line x1="0" y1="60" x2="400" y2="60" stroke={C.border} strokeWidth="1"/>
            {angles.map(([id, angle], i) => {
              const x = 25 + i * 46;
              const normAngle = angle;
              const y = 60 - (normAngle / 90) * 50;
              const col = Math.abs(normAngle) > 60 ? C.red : Math.abs(normAngle) > 30 ? C.yellow : C.green;
              return (
                <g key={id}>
                  <line x1={x} y1="60" x2={x} y2={y}
                    stroke={col} strokeWidth="4" strokeLinecap="round"
                    style={{ filter:`drop-shadow(0 0 3px ${col})` }} />
                  <circle cx={x} cy={y} r="4" fill={col} />
                  <text x={x} y="115" textAnchor="middle" fill={C.textMid}
                    fontSize="8" fontFamily="'IBM Plex Mono',monospace">B{id}</text>
                  <text x={x} y={y-8} textAnchor="middle" fill={col}
                    fontSize="7" fontFamily="'IBM Plex Mono',monospace">
                    {normAngle.toFixed(1)}°
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* P-V curve indicator */}
        <div style={{ fontSize:"9px", color:C.textMid, marginBottom:"8px", letterSpacing:"2px" }}>P-V NOSE CURVE — VOLTAGE STABILITY MARGIN</div>
        <div style={{ background:C.grid, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"12px" }}>
          <svg viewBox="0 0 360 100" style={{ width:"100%" }}>
            <path d={`M 20,10 Q 180,8 360,90`} fill="none" stroke={C.accentDim} strokeWidth="1.5"/>
            <path d={`M 20,10 Q 120,9 ${180+liveState.stabilityIdx*60},${50-liveState.stabilityIdx*35}`}
              fill="none" stroke={C.accent} strokeWidth="2.5"
              style={{ filter:`drop-shadow(0 0 4px ${C.accent})` }} />
            <circle cx={180+liveState.stabilityIdx*60} cy={50-liveState.stabilityIdx*35}
              r="5" fill={C.accent} />
            <text x="20" y="96" fill={C.textMid} fontSize="8" fontFamily="'IBM Plex Mono',monospace">0</text>
            <text x="340" y="96" fill={C.textMid} fontSize="8" fontFamily="'IBM Plex Mono',monospace">P →</text>
            <text x="8" y="14"  fill={C.textMid} fontSize="8" fontFamily="'IBM Plex Mono',monospace">V↑</text>
            <text x={182+liveState.stabilityIdx*60} y={45-liveState.stabilityIdx*35}
              fill={C.accent} fontSize="8" fontFamily="'IBM Plex Mono',monospace">◉ OP</text>
          </svg>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: C.bg, minHeight:"100vh", color:"#fff",
      fontFamily:"'IBM Plex Mono', 'Courier New', monospace",
      display:"flex", flexDirection:"column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600;700&family=Orbitron:wght@700;900&display=swap');
        @keyframes ping { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(1.8);opacity:0} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background: ${C.panel}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; borderRadius:2px; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{
        background: C.panel, borderBottom:`1px solid ${C.border}`,
        padding:"0 20px", height:"52px", display:"flex", alignItems:"center",
        gap:"16px", flexShrink:0,
      }}>
        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:"13px",
          fontWeight:"900", color:C.accent, letterSpacing:"3px",
          textShadow:`0 0 20px ${C.accent}` }}>
          PI-GNN
        </div>
        <div style={{ fontSize:"9px", color:C.textMid, letterSpacing:"2px", lineHeight:"1.4" }}>
          PHYSICS-INFORMED<br/>GRAPH NEURAL NETWORK
        </div>
        <div style={{ width:"1px", height:"30px", background:C.border }} />
        <div style={{ fontSize:"9px", color:C.textMid, letterSpacing:"1px", lineHeight:"1.4" }}>
          AUTONOMOUS GRID CONTROL<br/>IEEE 14-BUS SYSTEM
        </div>

        <div style={{ flex:1 }} />

        {/* Mode indicator */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px",
          background:C.grid, border:`1px solid ${modeColor}33`,
          borderRadius:"4px", padding:"6px 14px",
          boxShadow: modeGlow }}>
          <div style={{ width:"7px", height:"7px", borderRadius:"50%",
            background:modeColor, boxShadow:`0 0 8px ${modeColor}`,
            animation: mode!=="NORMAL" ? "blink 0.6s infinite" : "none" }} />
          <span style={{ fontSize:"11px", color:modeColor, fontWeight:"700", letterSpacing:"2px" }}>
            {mode}
          </span>
        </div>

        {/* Frequency */}
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:"8px", color:C.textMid }}>FREQUENCY</div>
          <div style={{ fontSize:"16px", fontWeight:"700",
            color: Math.abs(liveState.freq-60)>0.5 ? C.red : Math.abs(liveState.freq-60)>0.2 ? C.yellow : C.green }}>
            {liveState.freq.toFixed(3)} Hz
          </div>
        </div>

        {/* Controls */}
        <button onClick={() => setRunning(r=>!r)} style={{
          background: running ? C.accentDim : C.grid,
          border:`1px solid ${C.accent}`, color:C.accent, padding:"6px 14px",
          fontSize:"9px", fontFamily:"'IBM Plex Mono',monospace",
          letterSpacing:"2px", cursor:"pointer", borderRadius:"3px" }}>
          {running ? "⏸ PAUSE" : "▶ RUN"}
        </button>
        <button onClick={triggerFault} style={{
          background:`${C.red}22`, border:`1px solid ${C.red}`,
          color:C.red, padding:"6px 14px",
          fontSize:"9px", fontFamily:"'IBM Plex Mono',monospace",
          letterSpacing:"2px", cursor:"pointer", borderRadius:"3px",
          animation: mode==="FAULT" ? "blink 0.5s infinite" : "none" }}>
          ⚡ FAULT
        </button>
      </div>

      {/* ── KPI STRIP ── */}
      <div style={{
        background: C.panel, borderBottom:`1px solid ${C.border}`,
        display:"flex", gap:"0", flexShrink:0,
      }}>
        {[
          { label:"GNN ITER",      val:liveState.gnnIter.toString().padStart(5,"0"), color:C.accent, sub:"" },
          { label:"PHYSICS LOSS",  val:liveState.gnnLoss.toExponential(3),          color:liveState.gnnLoss>0.05?C.red:C.green, sub:"" },
          { label:"STABILITY IDX", val:(liveState.stabilityIdx*100).toFixed(1)+"%", color:liveState.stabilityIdx>0.6?C.green:C.red, sub:"" },
          { label:"AVG VOLTAGE",   val:(Object.values(liveState.busVoltages).reduce((a,b)=>a+b,0)/BUSES.length).toFixed(4)+" pu", color:C.accent, sub:"" },
          { label:"RENEWABLE MIX", val:(liveState.renewable*100).toFixed(1)+"%",    color:C.yellow, sub:"" },
          { label:"OPF COST",      val:"$"+liveState.opfCost.toFixed(1)+"/hr",      color:C.purple, sub:"" },
          { label:"OVERLOADED LINES", val:Object.values(liveState.lineFlows).filter(f=>f>0.9).length+"/"+EDGES.length, color:C.red, sub:"" },
        ].map((k,i) => (
          <div key={i} style={{ flex:1, padding:"8px 14px",
            borderRight:`1px solid ${C.border}`,
            borderLeft: i===0 ? "none" : undefined }}>
            <div style={{ fontSize:"8px", color:C.textDim, letterSpacing:"1px", marginBottom:"3px" }}>{k.label}</div>
            <div style={{ fontSize:"13px", color:k.color, fontWeight:"700" }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 340px", minHeight:0 }}>

        {/* LEFT: topology + tabs */}
        <div style={{ display:"flex", flexDirection:"column", borderRight:`1px solid ${C.border}` }}>

          {/* Tab bar */}
          <div style={{ display:"flex", background:C.panel, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
            {[
              ["topology","TOPOLOGY"],["gnn","GNN ARCH"],["opf","AC-OPF"],["stability","STABILITY"]
            ].map(([key,label]) => (
              <button key={key} onClick={()=>setTab(key)} style={{
                padding:"10px 20px", fontSize:"9px", letterSpacing:"2px",
                fontFamily:"'IBM Plex Mono',monospace", cursor:"pointer",
                background: tab===key ? C.grid : "transparent",
                color: tab===key ? C.accent : C.textMid,
                border:"none", borderBottom: tab===key ? `2px solid ${C.accent}` : "2px solid transparent",
              }}>{label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex:1, overflow:"hidden" }}>
            {tab === "topology" && (
              <div style={{ height:"100%", overflow:"hidden" }}>
                <TopologyCanvas />
                {selectedBus && (() => {
                  const b = BUSES.find(x=>x.id===selectedBus);
                  const v = liveState.busVoltages[b.id];
                  const a = liveState.busAngles[b.id];
                  return (
                    <div style={{
                      position:"absolute", background:C.panel, border:`1px solid ${C.accent}`,
                      borderRadius:"6px", padding:"12px", fontSize:"9px",
                      bottom:"20px", left:"20px", minWidth:"180px",
                      fontFamily:"'IBM Plex Mono',monospace",
                      boxShadow:`0 0 20px ${C.accentDim}`,
                    }}>
                      <div style={{ color:C.accent, fontWeight:"700", marginBottom:"8px" }}>{b.name} — Bus {b.id}</div>
                      <div style={{ color:C.textMid }}>Type: <span style={{color:C.textBright}}>{b.type}</span></div>
                      <div style={{ color:C.textMid }}>Voltage: <span style={{color:voltColor(v)}}>{v.toFixed(4)} pu</span></div>
                      <div style={{ color:C.textMid }}>Angle: <span style={{color:C.textBright}}>{a.toFixed(2)}°</span></div>
                      <div style={{ color:C.textMid }}>P Load: <span style={{color:C.textBright}}>{b.pLoad} pu</span></div>
                    </div>
                  );
                })()}
              </div>
            )}
            {tab === "gnn"       && <GNNPanel />}
            {tab === "opf"       && <OPFPanel />}
            {tab === "stability" && <StabilityPanel />}
          </div>
        </div>

        {/* RIGHT: timeseries + alerts */}
        <div style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Sparklines panel */}
          <div style={{ padding:"14px", flex:1, overflowY:"auto" }}>
            <div style={{ fontSize:"9px", color:C.textMid, marginBottom:"12px", letterSpacing:"2px" }}>
              REAL-TIME TIMESERIES
            </div>

            {[
              { key:"freq",      label:"System Freq (Hz)",   color:C.green,  fmt:v=>`${v.toFixed(3)}Hz` },
              { key:"voltage",   label:"Avg Voltage (pu)",   color:C.accent, fmt:v=>`${v.toFixed(4)}pu` },
              { key:"renewable", label:"Renewable Mix",      color:C.yellow, fmt:v=>`${(v*100).toFixed(1)}%` },
              { key:"loss",      label:"GNN Physics Loss",   color:C.purple, fmt:v=>v.toExponential(2) },
              { key:"stability", label:"Stability Index",    color:liveState.stabilityIdx>0.6?C.green:C.red, fmt:v=>`${(v*100).toFixed(1)}%` },
              { key:"opfCost",   label:"OPF Cost ($/hr)",    color:C.purple, fmt:v=>`$${v.toFixed(1)}` },
            ].map(s => {
              const data = hist.current[s.key];
              const last = data[data.length-1];
              return (
                <div key={s.key} style={{ marginBottom:"14px", background:C.grid,
                  border:`1px solid ${C.border}`, borderRadius:"4px", padding:"10px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
                    <span style={{ fontSize:"8px", color:C.textMid, letterSpacing:"1px" }}>{s.label}</span>
                    <span style={{ fontSize:"12px", color:s.color, fontWeight:"700" }}>{s.fmt(last)}</span>
                  </div>
                  <Sparkline data={data} color={s.color} width={290} height={36}/>
                </div>
              );
            })}

            {/* Bus voltage gauges */}
            <div style={{ fontSize:"9px", color:C.textMid, marginBottom:"10px", marginTop:"4px", letterSpacing:"2px" }}>
              BUS VOLTAGE GAUGES
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"4px" }}>
              {BUSES.slice(0,8).map(b => {
                const v = liveState.busVoltages[b.id];
                return (
                  <div key={b.id} style={{ background:C.grid, border:`1px solid ${C.border}`,
                    borderRadius:"4px", padding:"6px", textAlign:"center" }}>
                    <RadialGauge value={v} max={1.1} label={`B${b.id}`} color={voltColor(v)} size={58}/>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alert feed */}
          <div style={{ background:C.panel, borderTop:`1px solid ${C.border}`,
            padding:"10px 14px", flexShrink:0, maxHeight:"160px", overflowY:"auto" }}>
            <div style={{ fontSize:"9px", color:C.textMid, marginBottom:"8px", letterSpacing:"2px" }}>
              ALERT FEED
            </div>
            {[
              ...(fault ? [{time:"NOW", msg:`FAULT detected at ${BUSES.find(b=>b.id===fault)?.name} — GNN rerouting`, color:C.red}] : []),
              ...(mode==="RECOVERY" ? [{time:"NOW", msg:"Auto-recovery initiated — OPF re-dispatching", color:C.yellow}] : []),
              ...Object.entries(liveState.busVoltages).filter(([,v])=>v<0.92||v>1.06)
                .slice(0,2).map(([id,v])=>({
                  time:"LIVE", msg:`Bus ${id} voltage ${v.toFixed(3)}pu — constraint active`, color:C.yellow })),
              ...Object.entries(liveState.lineFlows).filter(([,f])=>f>0.88)
                .slice(0,2).map(([key,f])=>({
                  time:"LIVE", msg:`Line ${key} at ${(f*100).toFixed(0)}% — approaching limit`, color:C.yellow })),
              { time:"INFO", msg:"GNN inference completed — physics residuals nominal", color:C.green },
              { time:"INFO", msg:"OPF solution updated — renewable setpoints adjusted", color:C.accent },
            ].slice(0,6).map((a,i) => (
              <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"5px", alignItems:"flex-start" }}>
                <span style={{ fontSize:"8px", color:a.color, minWidth:"30px", flexShrink:0 }}>{a.time}</span>
                <span style={{ fontSize:"8px", color:C.textBright, lineHeight:"1.5" }}>{a.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
