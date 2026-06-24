import { useRef, useEffect, useCallback } from "react";

function colorToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3
    ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2]
    : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
}

export default function Starfield({
  dotColor       = "#ffffff",
  background     = "#000000",
  gap            = 10,
  baseRadius     = 1.2,
  padding        = 8,
  influenceRadius= 90,
  pushStrength   = 14,
  glowBoost      = 0.55,
  shootingStars  = true,
  breathe        = true,
  twinkle        = true,
  style          = {},
}) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const animRef      = useRef(0);
  const stateRef     = useRef(null);

  const rgb = colorToRgb(dotColor);

  const buildGrid = useCallback((canvas, W, H) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const budget = 8000;
    let g = Math.max(gap, 10);
    const nc = Math.floor((W - padding*2) / g) + 1;
    const nr = Math.floor((H - padding*2) / g) + 1;
    if (nc * nr > budget) g = Math.ceil(Math.sqrt(W * H / budget));

    const cols = Math.floor((W - padding*2) / g) + 1;
    const rows = Math.floor((H - padding*2) / g) + 1;
    const count = cols * rows;
    const offX  = (W - (cols-1)*g) / 2;
    const offY  = (H - (rows-1)*g) / 2;

    const baseX       = new Float32Array(count);
    const baseY       = new Float32Array(count);
    const posX        = new Float32Array(count);
    const posY        = new Float32Array(count);
    const velX        = new Float32Array(count);
    const velY        = new Float32Array(count);
    const dotRad      = new Float32Array(count);
    const baseAlpha   = new Float32Array(count);
    const dotType     = new Uint8Array(count);
    const twinkPhase  = new Float32Array(count);
    const twinkSpeed  = new Float32Array(count);
    const starRot     = new Float32Array(count);
    const typeIdx     = [[], [], [], []];

    const brightT = 0.98 + Math.random() * 0.012;
    const medT    = 0.945 + Math.random() * 0.025;
    const smallT  = 0.86  + Math.random() * 0.05;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        let x = offX + c * g;
        let y = offY + r * g;
        const roll = Math.random();
        if      (roll > brightT) { dotType[i]=3; dotRad[i]=3+Math.random()*1.5;  baseAlpha[i]=0.7+Math.random()*0.3;  twinkSpeed[i]=0.4+Math.random()*1; }
        else if (roll > medT)    { dotType[i]=2; dotRad[i]=2+Math.random()*0.8;  baseAlpha[i]=0.4+Math.random()*0.25; twinkSpeed[i]=0.6+Math.random()*1.8; }
        else if (roll > smallT)  { dotType[i]=1; dotRad[i]=1.4+Math.random()*0.4;baseAlpha[i]=0.22+Math.random()*0.15;twinkSpeed[i]=0.8+Math.random()*2.5; }
        else                     { dotType[i]=0; dotRad[i]=baseRadius;            baseAlpha[i]=0.16+Math.random()*0.1; twinkSpeed[i]=0; }
        if (dotType[i] > 0) { x += (Math.random()-0.5)*g*0.8; y += (Math.random()-0.5)*g*0.8; }
        baseX[i]=x; baseY[i]=y; posX[i]=x; posY[i]=y;
        twinkPhase[i] = Math.random() * Math.PI * 2;
        starRot[i]    = Math.random() * Math.PI * 0.5;
        typeIdx[dotType[i]].push(i);
      }
    }

    const cellSize = influenceRadius;
    const gCols = Math.ceil(W / cellSize) + 1;
    const gRows = Math.ceil(H / cellSize) + 1;
    const spatial = new Array(gCols * gRows).fill(null).map(() => []);
    for (let i = 0; i < count; i++) {
      const gc = Math.floor(baseX[i] / cellSize);
      const gr = Math.floor(baseY[i] / cellSize);
      if (gc >= 0 && gc < gCols && gr >= 0 && gr < gRows)
        spatial[gr * gCols + gc].push(i);
    }

    return {
      W, H, dpr, cols, rows, count, g,
      baseX, baseY, posX, posY, velX, velY,
      dotRad, baseAlpha, dotType, twinkPhase, twinkSpeed, starRot,
      typeIdx, spatial, gCols, gRows, cellSize,
      shootingStars: [], nextShoot: 2 + Math.random() * 4,
      mouseX: -9999, mouseY: -9999, mouseInside: false,
      smoothX: -9999, smoothY: -9999,
      frameAlpha:   new Float32Array(count),
      frameRadius:  new Float32Array(count),
      mouseAff:     new Uint8Array(count),
    };
  }, [gap, baseRadius, padding, influenceRadius]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = container.getBoundingClientRect();
    stateRef.current = buildGrid(canvas, rect.width, rect.height);

    // Pre-computed trig table for 8-point star
    const sCos = new Float64Array(8);
    const sSin = new Float64Array(8);
    for (let j = 0; j < 8; j++) {
      const a = j * Math.PI / 4;
      sCos[j] = Math.cos(a); sSin[j] = Math.sin(a);
    }

    const STEPS = 64;
    const quant = a => Math.round(a * STEPS) / STEPS;

    function breatheAlpha(x, y, t) {
      return (Math.sin(x*.012+y*.008+t*.6)*.5+.5)*.3
           + (Math.sin(x*.007-y*.011+t*.4)*.5+.5)*.2;
    }

    function drawStar(px, py, outerR, rot, fill) {
      const innerR = outerR * 0.3;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const r  = k % 2 === 0 ? outerR : innerR;
        const lx = px + (sCos[k]*cosR - sSin[k]*sinR) * r;
        const ly = py + (sCos[k]*sinR + sSin[k]*cosR) * r;
        k === 0 ? ctx.moveTo(lx, ly) : ctx.lineTo(lx, ly);
      }
      ctx.closePath();
      ctx.fill();
    }

    function animate() {
      animRef.current = requestAnimationFrame(animate);
      const s = stateRef.current;
      if (!s) return;
      const t = performance.now() * 0.001;

      if (s.mouseInside) {
        s.smoothX += (s.mouseX - s.smoothX) * 0.12;
        s.smoothY += (s.mouseY - s.smoothY) * 0.12;
      } else {
        s.smoothX += (-9999 - s.smoothX) * 0.05;
        s.smoothY += (-9999 - s.smoothY) * 0.05;
      }

      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, s.W, s.H);

      // ── Shooting stars ──
      if (shootingStars) {
        s.nextShoot -= 0.016;
        if (s.nextShoot <= 0) {
          const edge = Math.random();
          let sx, sy, angle;
          if (edge < 0.5) { sx=Math.random()*s.W*.6; sy=-5; angle=Math.PI*.15+Math.random()*Math.PI*.2; }
          else            { sx=s.W+5; sy=Math.random()*s.H*.5; angle=Math.PI*.6+Math.random()*Math.PI*.3; }
          s.shootingStars.push({
            x:sx, y:sy,
            vx: Math.cos(angle)*(3+Math.random()*3),
            vy: Math.sin(angle)*(3+Math.random()*3),
            life:1, decay:0.008+Math.random()*0.012, len:35+Math.random()*40,
          });
          s.nextShoot = 3 + Math.random() * 5;
        }
        for (let i = s.shootingStars.length-1; i >= 0; i--) {
          const ss = s.shootingStars[i];
          ss.x+=ss.vx; ss.y+=ss.vy; ss.life-=ss.decay;
          if (ss.life<=0||ss.x<-50||ss.x>s.W+50||ss.y>s.H+50) { s.shootingStars.splice(i,1); continue; }
          const spd  = Math.sqrt(ss.vx*ss.vx+ss.vy*ss.vy);
          const tailX = ss.x - ss.vx/spd*ss.len;
          const tailY = ss.y - ss.vy/spd*ss.len;
          const grad  = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
          grad.addColorStop(0,  `rgba(${rgb},0)`);
          grad.addColorStop(0.7,`rgba(${rgb},${ss.life*0.3})`);
          grad.addColorStop(1,  `rgba(${rgb},${ss.life*0.8})`);
          ctx.beginPath(); ctx.moveTo(tailX,tailY); ctx.lineTo(ss.x,ss.y);
          ctx.strokeStyle=grad; ctx.lineWidth=1.2; ctx.lineCap="round"; ctx.stroke();
          ctx.beginPath(); ctx.arc(ss.x,ss.y,1.5,0,Math.PI*2);
          ctx.fillStyle=`rgba(${rgb},${ss.life*0.9})`; ctx.fill();
        }
      }

      // ── Mouse spatial hash ──
      const { smoothX:smx, smoothY:smy } = s;
      const infR = influenceRadius, infR2 = infR*infR;
      s.mouseAff.fill(0);
      if (smx > -5000) {
        const minGC=Math.max(0,Math.floor((smx-infR)/s.cellSize));
        const maxGC=Math.min(s.gCols-1,Math.floor((smx+infR)/s.cellSize));
        const minGR=Math.max(0,Math.floor((smy-infR)/s.cellSize));
        const maxGR=Math.min(s.gRows-1,Math.floor((smy+infR)/s.cellSize));
        for (let gr=minGR; gr<=maxGR; gr++)
          for (let gc=minGC; gc<=maxGC; gc++) {
            const cell = s.spatial[gr*s.gCols+gc];
            for (let ci=0; ci<cell.length; ci++) {
              const i=cell[ci];
              const dx=s.baseX[i]-smx, dy=s.baseY[i]-smy;
              if (dx*dx+dy*dy < infR2) s.mouseAff[i]=1;
            }
          }
      }

      // ── Compute per-dot alpha/radius + physics ──
      for (let i=0; i<s.count; i++) {
        const type = s.dotType[i];
        let alpha  = s.baseAlpha[i];
        let radius = s.dotRad[i];

        if (type===0 && breathe) alpha += breatheAlpha(s.baseX[i],s.baseY[i],t)*0.12;

        if (type>0 && twinkle) {
          const tw  = Math.sin(t*s.twinkSpeed[i]+s.twinkPhase[i]);
          const tw2 = Math.sin(t*s.twinkSpeed[i]*.37+s.twinkPhase[i]*2.1);
          const flicker = tw*.35+tw2*.15+.5;
          if      (type===3) { alpha=s.baseAlpha[i]*(.55+flicker*.45); s.starRot[i]+=.003; }
          else if (type===2) { alpha=s.baseAlpha[i]*(.35+flicker*.65); s.starRot[i]+=.005; }
          else               { alpha=s.baseAlpha[i]*(.15+flicker*.85); s.starRot[i]+=.008; }
          const fw = Math.sin(t*.3+s.twinkPhase[i]*5);
          if (fw > .97) { const fi=(fw-.97)/.03; alpha=Math.min(1,alpha+fi*.5); radius=s.dotRad[i]*(1+fi*.4); }
        }

        let targetX=s.baseX[i], targetY=s.baseY[i];
        if (s.mouseAff[i]) {
          const dx=s.baseX[i]-smx, dy=s.baseY[i]-smy;
          const dist=Math.sqrt(dx*dx+dy*dy);
          const f=1-dist/infR, ease=f*f*f;
          if (dist>.5) { targetX=s.baseX[i]+dx/dist*pushStrength*ease; targetY=s.baseY[i]+dy/dist*pushStrength*ease; }
          alpha=Math.min(1,alpha+glowBoost*ease);
          if (type>0) radius=radius*(1+ease*.6);
        }

        s.velX[i]+=(targetX-s.posX[i])*.15; s.velY[i]+=(targetY-s.posY[i])*.15;
        s.velX[i]*=.75; s.velY[i]*=.75;
        s.posX[i]+=s.velX[i]; s.posY[i]+=s.velY[i];
        s.frameAlpha[i]  = quant(alpha);
        s.frameRadius[i] = radius;
      }

      // ── Render type 0: batched arcs ──
      const alphaGroups = new Map();
      for (const i of s.typeIdx[0]) {
        const a = s.frameAlpha[i];
        if (a < 0.01) continue;
        if (!alphaGroups.has(a)) alphaGroups.set(a, []);
        alphaGroups.get(a).push(i);
      }
      alphaGroups.forEach((ids, a) => {
        ctx.fillStyle = `rgba(${rgb},${a})`;
        ctx.beginPath();
        for (const i of ids) { ctx.moveTo(s.posX[i]+baseRadius,s.posY[i]); ctx.arc(s.posX[i],s.posY[i],baseRadius,0,Math.PI*2); }
        ctx.fill();
      });

      // ── Render type 1,2,3: stars ──
      for (const type of [1, 2, 3]) {
        for (const i of s.typeIdx[type]) {
          const a = s.frameAlpha[i];
          if (a < 0.01) continue;
          const px=s.posX[i], py=s.posY[i], r=s.frameRadius[i], rot=s.starRot[i];
          drawStar(px, py, r, rot, `rgba(${rgb},${a})`);

          if (type >= 2) {
            const glowR = r * (type===3 ? 4.5 : 3);
            const grad  = ctx.createRadialGradient(px,py,r*.2,px,py,glowR);
            grad.addColorStop(0, `rgba(${rgb},${a*(type===3?.18:.1)})`);
            grad.addColorStop(1, `rgba(${rgb},0)`);
            ctx.beginPath(); ctx.arc(px,py,glowR,0,Math.PI*2);
            ctx.fillStyle=grad; ctx.fill();
          }
          if (type===3 && a > 0.4) {
            const rLen=r*3.5, cosR=Math.cos(rot), sinR=Math.sin(rot);
            ctx.strokeStyle=`rgba(${rgb},${a*0.2})`; ctx.lineWidth=0.5;
            ctx.beginPath();
            ctx.moveTo(px-cosR*rLen,py-sinR*rLen); ctx.lineTo(px+cosR*rLen,py+sinR*rLen);
            ctx.moveTo(px-sinR*rLen,py+cosR*rLen); ctx.lineTo(px+sinR*rLen,py-cosR*rLen);
            ctx.stroke();
          }
        }
      }
    }

    // ── Events ──
    const onMove = e => {
      const r = container.getBoundingClientRect();
      stateRef.current.mouseX = e.clientX - r.left;
      stateRef.current.mouseY = e.clientY - r.top;
      stateRef.current.mouseInside = true;
    };
    const onLeave = () => { stateRef.current.mouseInside = false; };
    const onTouch = e => {
      if (!e.touches.length) return;
      const r = container.getBoundingClientRect();
      stateRef.current.mouseX = e.touches[0].clientX - r.left;
      stateRef.current.mouseY = e.touches[0].clientY - r.top;
      stateRef.current.mouseInside = true;
    };

    let resizeTimer;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const prev = stateRef.current;
        const rect = container.getBoundingClientRect();
        const next = buildGrid(canvas, rect.width, rect.height);
        if (prev) { next.mouseX=prev.mouseX; next.mouseY=prev.mouseY; next.mouseInside=prev.mouseInside; next.smoothX=prev.smoothX; next.smoothY=prev.smoothY; }
        stateRef.current = next;
      }, 100);
    });

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    container.addEventListener("touchmove", onTouch, { passive: true });
    container.addEventListener("touchend", onLeave);
    ro.observe(container);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      clearTimeout(resizeTimer);
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      container.removeEventListener("touchmove", onTouch);
      container.removeEventListener("touchend", onLeave);
      ro.disconnect();
    };
  }, [rgb, background, buildGrid, baseRadius, influenceRadius, pushStrength, glowBoost, shootingStars, breathe, twinkle]);

  return (
    <div ref={containerRef} style={{ width:"100%", height:"100%", position:"absolute", inset:0, overflow:"hidden", ...style }}>
      <canvas ref={canvasRef} style={{ display:"block", width:"100%", height:"100%" }} />
    </div>
  );
}