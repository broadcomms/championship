'use client';

import React, { useEffect, useRef } from 'react';

interface VoiceVisualizerProps {
  audioLevel: number;
  isRecording: boolean;
  isProcessing: boolean;
  width?: number;
  height?: number;
  barCount?: number;
  barColor?: string;
  barGap?: number;
}

export function VoiceVisualizer({
  audioLevel,
  isRecording,
  isProcessing,
  width = 200,
  height = 60,
  barCount = 20,
  barColor = '#2563EB',
  barGap = 2,
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>(new Array(barCount).fill(0));
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const barWidth = (width - barGap * (barCount - 1)) / barCount;

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      if (isProcessing) {
        // Show processing animation (pulsing bars)
        const time = Date.now() / 1000;
        barsRef.current = barsRef.current.map((_, i) => {
          return Math.sin(time * 3 + i * 0.5) * 0.5 + 0.5;
        });
      } else if (isRecording) {
        // Update bars based on audio level
        // Shift bars left and add new bar
        barsRef.current.shift();
        barsRef.current.push(audioLevel);
      } else {
        // Idle state - slowly decrease bars to zero
        barsRef.current = barsRef.current.map((bar) => bar * 0.9);
      }

      // Draw bars
      barsRef.current.forEach((barHeight, i) => {
        const x = i * (barWidth + barGap);
        const normalizedHeight = Math.max(0, Math.min(1, barHeight)) * height;
        const y = (height - normalizedHeight) / 2;

        // Add gradient
        const gradient = ctx.createLinearGradient(x, y, x, y + normalizedHeight);
        gradient.addColorStop(0, barColor);
        gradient.addColorStop(1, `${barColor}80`);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, normalizedHeight);
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioLevel, isRecording, isProcessing, width, height, barCount, barColor, barGap]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-lg"
      aria-label="Voice audio visualization"
    />
  );
}

interface WaveformVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  size?: number;
  color?: string;
}

export function WaveformVisualizer({
  audioLevel,
  isActive,
  size = 120,
  color = '#2563EB',
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = size / 2;
    const centerY = size / 2;
    const baseRadius = size / 3;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      if (!isActive) {
        // Draw static circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}40`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `${color}20`;
        ctx.fill();

        return;
      }

      phaseRef.current += 0.05;

      // Draw multiple waveform layers
      const layers = 3;
      for (let layer = 0; layer < layers; layer++) {
        ctx.beginPath();

        const layerRadius = baseRadius + layer * 15;
        const points = 60;

        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const wave1 = Math.sin(angle * 3 + phaseRef.current) * audioLevel * 10;
          const wave2 = Math.sin(angle * 5 - phaseRef.current * 0.5) * audioLevel * 5;
          const radius = layerRadius + wave1 + wave2;

          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.closePath();
        ctx.strokeStyle = `${color}${Math.floor((1 - layer / layers) * 100)}`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw center circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioLevel, isActive, size, color]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-full"
      aria-label="Waveform visualization"
    />
  );
}

interface AudioLevelMeterProps {
  level: number;
  max?: number;
  width?: number;
  height?: number;
  showLabel?: boolean;
}

export function AudioLevelMeter({
  level,
  max = 1,
  width = 200,
  height = 20,
  showLabel = true,
}: AudioLevelMeterProps) {
  const percentage = Math.min(100, (level / max) * 100);
  const color =
    percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-600">
          <span>Audio Level</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        className="bg-gray-200 rounded-full overflow-hidden"
        style={{ width, height }}
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Audio level meter"
      >
        <div
          className={`${color} h-full transition-all duration-100`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
