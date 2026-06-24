import React, { useMemo } from "react";
import Starfield from "./Starfield";

const APPS = [
  { label:"Netflix",   color:"#E50914", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#000"/><path d="M15 10h7.5l9 24.5V10H39v34h-7.3L22.5 19.5V44H15V10z" fill="#E50914"/></svg>` },
  { label:"Spotify",   color:"#1DB954", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="27" fill="#1DB954"/><path d="M37.5 30.5c-6.5-3.9-17.2-4.3-23.4-2.4-.9.3-1.9-.2-2.2-1.1-.3-.9.2-1.9 1.1-2.2 7.1-2.2 18.9-1.7 26.3 2.7.8.5 1.1 1.5.6 2.4-.5.8-1.6 1.1-2.4.6zm-.4 5.4c-.4.7-1.3.9-2 .5-5.4-3.3-13.6-4.3-20-.2-.7.4-1.6.1-2-.6-.4-.7-.1-1.6.6-2 7.3-4.4 16.3-3.3 22.4.2.7.4.9 1.3.5 2zm-2.2 5.2c-.3.6-1 .8-1.6.4-4.7-2.9-10.6-3.5-17.6-1.9-.6.1-1.2-.2-1.4-.9-.1-.6.2-1.2.9-1.4 7.6-1.7 14.2-1 19.4 2.2.6.4.7 1.1.3 1.6z" fill="#fff"/></svg>` },
  { label:"Amazon",    color:"#FF9900", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#131921"/><text x="27" y="24" font-size="13" font-weight="900" fill="#FF9900" text-anchor="middle" font-family="Arial">amazon</text><path d="M14 32c7 4 19 4.5 26 0" stroke="#FF9900" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M37 30l3 2-1.5 3" stroke="#FF9900" stroke-width="2" stroke-linecap="round" fill="none"/></svg>` },
  { label:"Disney+",   color:"#0063E5", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#040E26"/><text x="24" y="27" font-size="12" font-weight="900" fill="#fff" text-anchor="middle" font-family="Georgia,serif" font-style="italic">Disney</text><text x="40" y="27" font-size="15" font-weight="900" fill="#0063E5" text-anchor="middle" font-family="Arial">+</text></svg>` },
  { label:"YouTube",   color:"#FF0000", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#0F0F0F"/><rect x="9" y="17" width="36" height="22" rx="6" fill="#FF0000"/><polygon points="23,22 34,28 23,34" fill="#fff"/></svg>` },
  { label:"Apple TV",  color:"#A2AAAD", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#1C1C1E"/><path d="M27 12c-1.5 0-3.2 1-4.1 2.5-.8 1.3-.6 2.7.1 3.5.8-2.2 2.5-3.5 4-3.5s3.2 1.3 4 3.5c.7-.8.9-2.2.1-3.5C30.2 13 28.5 12 27 12zm-7.5 8.5c-3.2 0-5.5 2.6-5.5 6 0 4.5 3.2 10 5.8 13.5.9 1.2 1.7 1.8 2.7 1.8.9 0 1.5-.4 2.5-.4s1.6.4 2.5.4c1 0 1.8-.7 2.8-2C34 36.5 37 31.2 37 26.5c0-3.4-2.3-6-5.5-6-1.5 0-2.8.7-3.8 1.5-.6.5-1.2.5-1.4.5s-.8 0-1.4-.5c-1-.8-2.3-1.5-3.8-1.5z" fill="#fff" opacity=".9"/></svg>` },
  { label:"Electric",  color:"#FACC15", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#1E3A5F"/><polygon points="30,10 18,30 27,30 24,44 36,24 27,24" fill="#FACC15"/></svg>` },
  { label:"Water",     color:"#38BDF8", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#082F49"/><path d="M27 12c0 0-12 13-12 20a12 12 0 0 0 24 0C39 25 27 12 27 12z" fill="#38BDF8"/><path d="M21 32a7 7 0 0 0 5 5" stroke="rgba(255,255,255,.5)" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>` },
  { label:"Gas",       color:"#F97316", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#1C0A00"/><path d="M27 40c-6 0-10-4-10-9 0-7 10-19 10-19s10 12 10 19c0 5-4 9-10 9z" fill="#F97316"/><path d="M27 38c-3 0-6-2.5-6-5.5 0-3.5 4-9 6-12 2 3 6 8.5 6 12 0 3-3 5.5-6 5.5z" fill="#FDE68A" opacity=".6"/></svg>` },
  { label:"Rent",      color:"#FB923C", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#1C0F00"/><polygon points="27,13 10,27 14,27 14,42 22,42 22,33 32,33 32,42 40,42 40,27 44,27" fill="#FB923C"/></svg>` },
  { label:"Internet",  color:"#A78BFA", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#0D0820"/><circle cx="27" cy="27" r="14" stroke="#A78BFA" stroke-width="2" fill="none"/><ellipse cx="27" cy="27" rx="6" ry="14" stroke="#A78BFA" stroke-width="1.5" fill="none"/><line x1="13" y1="27" x2="41" y2="27" stroke="#A78BFA" stroke-width="1.5"/><line x1="15" y1="20" x2="39" y2="20" stroke="#A78BFA" stroke-width="1"/><line x1="15" y1="34" x2="39" y2="34" stroke="#A78BFA" stroke-width="1"/></svg>` },
  { label:"Insurance", color:"#10B981", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#022C22"/><path d="M27 12l-14 6v10c0 9 6 16 14 18 8-2 14-9 14-18V18L27 12z" fill="#10B981" opacity=".25" stroke="#10B981" stroke-width="1.5"/><path d="M22 27l4 4 7-7" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>` },
  { label:"Car EMI",   color:"#94A3B8", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#0F172A"/><path d="M12 30l5-10h20l5 10v6H12z" fill="#94A3B8" opacity=".25" stroke="#94A3B8" stroke-width="1.5" stroke-linejoin="round"/><circle cx="19" cy="37" r="3.5" fill="#94A3B8"/><circle cx="35" cy="37" r="3.5" fill="#94A3B8"/></svg>` },
  { label:"iCloud",    color:"#60A5FA", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#001830"/><path d="M38 34a7 7 0 0 0-3-13.3 10 10 0 0 0-19.5 3A7 7 0 0 0 16 38h22a7 7 0 0 0 0-4z" fill="#60A5FA" opacity=".85"/></svg>` },
  { label:"Tax",       color:"#FACC15", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#1A1400"/><rect x="14" y="13" width="26" height="32" rx="3" fill="none" stroke="#FACC15" stroke-width="1.5"/><line x1="19" y1="22" x2="35" y2="22" stroke="#FACC15" stroke-width="1.5"/><line x1="19" y1="28" x2="35" y2="28" stroke="#FACC15" stroke-width="1.5"/><line x1="19" y1="34" x2="27" y2="34" stroke="#FACC15" stroke-width="1.5"/><text x="34" y="38" font-size="12" font-weight="900" fill="#FACC15" text-anchor="middle" font-family="Arial">₹</text></svg>` },
  { label:"Phone",     color:"#818CF8", svg:`<svg width="54" height="54" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#0D0D2B"/><rect x="17" y="9" width="20" height="36" rx="4" fill="none" stroke="#818CF8" stroke-width="1.5"/><rect x="20" y="14" width="14" height="22" rx="2" fill="#818CF8" opacity=".15"/><circle cx="27" cy="40" r="2" fill="#818CF8"/></svg>` },
];

function rand(min, max) { return Math.random() * (max - min) + min; }

function FloatingIcon({ app, index }) {
  const col   = index % 8;
  const left  = useMemo(() => 3 + col * 12.2 + rand(-2.5, 2.5), [col]);
  const dur   = useMemo(() => rand(13, 22), []);
  const delay = useMemo(() => -rand(0, dur), [dur]);

  return (
    <div
      className="absolute flex flex-col items-center gap-2 pointer-events-none"
      style={{
        left: `${left}%`, bottom: 0, zIndex: 10,
        animation: `floatIcon ${dur}s ${delay}s linear infinite`,
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: app.svg }} style={{ display:"block", lineHeight:0 }} />
      <span style={{ fontSize:10, fontWeight:600, color: app.color+"cc", letterSpacing:"0.05em", whiteSpace:"nowrap", fontFamily:"'Inter',sans-serif" }}>
        {app.label}
      </span>
    </div>
  );
}

export default function VideoBackground() {
  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background:"#000", fontFamily:"'Inter',sans-serif" }}>

      {/* ── STARFIELD BACKGROUND ── */}
      <Starfield
        dotColor="#ffffff"
        background="#000000"
        gap={10}
        baseRadius={1.2}
        influenceRadius={100}
        pushStrength={16}
        glowBoost={0.6}
        shootingStars={true}
        breathe={true}
        twinkle={true}
      />

      {/* ── FLOATING ICONS ── */}
      {APPS.map((app, i) => <FloatingIcon key={app.label} app={app} index={i} />)}

      {/* ── CENTER CONTENT ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-20 px-6 gap-4" style={{ pointerEvents:"none" }}>
        <div className="reveal text-xs uppercase tracking-widest px-4 py-1 rounded-full"
          style={{ animationDelay:"0.1s", color:"rgba(255,255,255,0.38)", border:"1px solid rgba(255,255,255,0.1)", letterSpacing:"0.2em" }}>
          ✦ Bill Management
        </div>
        <h1 className="reveal"
          style={{ animationDelay:"0.3s", fontSize:"clamp(38px,6.5vw,72px)", fontWeight:900, lineHeight:1.08, color:"#fff", textShadow:"0 0 80px rgba(255,255,255,0.08)" }}>
          All your bills,{" "}<span style={{ color:"#4ade80" }}>one place</span>
        </h1>
        <p className="reveal max-w-sm leading-relaxed"
          style={{ animationDelay:"0.5s", fontSize:14, color:"rgba(255,255,255,0.35)", fontWeight:400 }}>
          Track Netflix, electricity, water, rent and every subscription — never miss a due date again.
        </p>
        <div className="reveal flex gap-3 mt-1 flex-wrap justify-center" style={{ animationDelay:"0.7s", pointerEvents:"all" }}>
          <button className="px-7 py-3 rounded-full text-sm font-bold text-black hover:scale-105 active:scale-95 transition-transform"
            style={{ background:"#fff", letterSpacing:"0.03em" }}>
            Get Started
          </button>
          <button className="px-7 py-3 rounded-full text-sm font-semibold hover:scale-105 active:scale-95 transition-all"
            style={{ color:"rgba(255,255,255,0.65)", border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.04)", backdropFilter:"blur(8px)", letterSpacing:"0.03em" }}>
            See Demo
          </button>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20" style={{ animation:"revealUp 1s 1.2s both" }}>
        <span style={{ fontSize:9, color:"rgba(255,255,255,0.18)", letterSpacing:"0.2em", textTransform:"uppercase" }}>scroll</span>
        <div style={{ width:1, height:34, background:"linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)" }} />
      </div>
    </div>
  );
}