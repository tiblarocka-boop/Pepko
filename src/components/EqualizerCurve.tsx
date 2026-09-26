import React, { useEffect, useRef, useState } from 'react';
import type { EqBand } from '../types/equalizer';
import { webAudioEngine } from '../audio/WebAudioEngine';

interface EqualizerCurveProps {
  bands: EqBand[];
  onBandGainChange: (index: number, gain: number) => void;
  engineActive: boolean;
}

export const EqualizerCurve: React.FC<EqualizerCurveProps> = ({
  bands,
  onBandGainChange,
  engineActive,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredBand, setHoveredBand] = useState<number | null>(null);
  const [draggingBand, setDraggingBand] = useState<number | null>(null);

  // Real-time canvas animation loop (spectrum analyzer FFT + EQ response curve)
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fftData = new Uint8Array(256);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Handle high-DPI scaling
      ctx.clearRect(0, 0, width, height);

      // 1. Draw subtle frequency & decibel grid lines
      ctx.strokeStyle = '#1e2638';
      ctx.lineWidth = 1;

      // dB horizontal lines: +15, +10, +5, 0, -5, -10, -15
      const dbSteps = [15, 10, 5, 0, -5, -10, -15];
      dbSteps.forEach((db) => {
        const y = ((15 - db) / 30) * (height - 30) + 15;
        ctx.beginPath();
        if (db === 0) {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = '#182030';
          ctx.lineWidth = 1;
        }
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Label on left
        ctx.fillStyle = db === 0 ? '#64748b' : '#334155';
        ctx.font = '9px monospace';
        ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 6, y - 3);
      });

      // 2. Real-time FFT Audio Spectrum Analyzer (subtle cyan/blue gradient in background)
      webAudioEngine.getFrequencyData(fftData);
      const isSounding = fftData.some((v) => v > 0);

      if (isSounding && engineActive) {
        ctx.beginPath();
        const barCount = 64;
        const barWidth = width / barCount;

        for (let i = 0; i < barCount; i++) {
          const fftIndex = Math.floor(Math.pow(i / barCount, 1.6) * 180);
          const rawVal = fftData[fftIndex] || 0;
          const barHeight = (rawVal / 255) * (height * 0.7);
          const x = i * barWidth;
          const y = height - barHeight;

          const grad = ctx.createLinearGradient(0, height, 0, y);
          grad.addColorStop(0, 'rgba(6, 182, 212, 0.02)');
          grad.addColorStop(1, 'rgba(6, 182, 212, 0.18)');

          ctx.fillStyle = grad;
          ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
        }
      }

      // 3. Draw smooth 32-Band Equalizer Frequency Response Curve
      const points: { x: number; y: number }[] = bands.map((band, i) => {
        const x = (i / (bands.length - 1)) * (width - 40) + 20;
        // Mapping -15dB .. +15dB into canvas height
        const gain = engineActive ? band.gain : 0;
        const y = ((15 - gain) / 30) * (height - 30) + 15;
        return { x, y };
      });

      // Draw gradient under curve
      ctx.beginPath();
      ctx.moveTo(points[0].x, height);
      ctx.lineTo(points[0].x, points[0].y);

      // Spline interpolation
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }

      ctx.lineTo(points[points.length - 1].x, height);
      ctx.closePath();

      const curveGrad = ctx.createLinearGradient(0, 0, 0, height);
      curveGrad.addColorStop(0, engineActive ? 'rgba(6, 182, 212, 0.28)' : 'rgba(100, 116, 139, 0.1)');
      curveGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
      ctx.fillStyle = curveGrad;
      ctx.fill();

      // Draw the EQ stroke line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }

      ctx.strokeStyle = engineActive ? '#22d3ee' : '#64748b';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = engineActive ? 'rgba(34, 211, 238, 0.6)' : 'transparent';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // 4. Draw Interactive Control Nodes for each band
      points.forEach((pt, idx) => {
        const isHovered = hoveredBand === idx;
        const isDragging = draggingBand === idx;
        const isZero = bands[idx].gain === 0;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isHovered || isDragging ? 5.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isHovered || isDragging ? '#ffffff' : (isZero ? '#94a3b8' : '#38bdf8');
        ctx.fill();
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [bands, hoveredBand, draggingBand, engineActive]);

  // Handle Canvas interactions (drag nodes directly on the curve)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;

    // Find nearest band
    let nearestIndex = 0;
    let minDistance = 9999;

    bands.forEach((_, i) => {
      const bx = (i / (bands.length - 1)) * (width - 40) + 20;
      const dist = Math.abs(clientX - bx);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    });

    if (minDistance < 35) {
      setDraggingBand(nearestIndex);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      // Calculate gain from Y coordinate
      const normalizedY = Math.max(0, Math.min(1, (clientY - 15) / (height - 30)));
      const newGain = Math.round((15 - normalizedY * 30) * 10) / 10;
      onBandGainChange(nearestIndex, newGain);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const width = canvas.width;
    const height = canvas.height;

    if (draggingBand !== null) {
      const normalizedY = Math.max(0, Math.min(1, (clientY - 15) / (height - 30)));
      const newGain = Math.max(-15, Math.min(15, Math.round((15 - normalizedY * 30) * 10) / 10));
      onBandGainChange(draggingBand, newGain);
    } else {
      // Hover detection
      let nearestIndex: number | null = null;
      let minDistance = 9999;
      bands.forEach((_, i) => {
        const bx = (i / (bands.length - 1)) * (width - 40) + 20;
        const dist = Math.abs(clientX - bx);
        if (dist < minDistance && dist < 18) {
          minDistance = dist;
          nearestIndex = i;
        }
      });
      setHoveredBand(nearestIndex);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingBand !== null) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setDraggingBand(null);
    }
  };

  const handleDoubleClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (hoveredBand !== null) {
      onBandGainChange(hoveredBand, 0);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-44 sm:h-52 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 overflow-hidden shadow-2xl p-2 select-none"
    >
      {/* Decibel legend overlay */}
      <div className="absolute top-2.5 right-4 flex items-center gap-3 text-[10px] font-mono text-zinc-500 z-10 pointer-events-none">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-1 rounded-full bg-cyan-400"></span>
          Pre-EQ Response
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-cyan-500/20"></span>
          Audio Spectrum
        </span>
        <span className="text-zinc-600">Range: ±15.0 dB</span>
      </div>

      {/* Dynamic Hover Tooltip */}
      {hoveredBand !== null && (
        <div
          className="absolute top-2.5 left-4 z-10 px-2.5 py-1 rounded bg-zinc-900 border border-cyan-800/50 text-cyan-300 font-mono text-xs shadow-lg flex items-center gap-2 pointer-events-none"
        >
          <span className="font-bold">Band #{hoveredBand + 1}</span>
          <span className="text-white">{bands[hoveredBand].label} ({Math.round(bands[hoveredBand].frequency)} Hz)</span>
          <span className="font-black text-cyan-400">
            {bands[hoveredBand].gain > 0 ? `+${bands[hoveredBand].gain.toFixed(1)}` : bands[hoveredBand].gain.toFixed(1)} dB
          </span>
        </div>
      )}

      {/* Canvas Display */}
      <canvas
        ref={canvasRef}
        width={1000}
        height={220}
        className="w-full h-full cursor-crosshair block"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
};
