'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { PlatBand, PlatLot, PlatModel, PlatSpan } from '@/lib/plat';
import { cn } from '@/lib/utils';

/*
 * Draws a PlatModel: bands stacked top to bottom, each the outlined window of
 * the band above, enlarged to full width. Geometry comes from the model's
 * fractions; this file only turns them into pixels at the measured width so
 * text stays at its real size on a phone instead of being scaled down.
 */

const BLOCK_H = 40;
const LAST_H = 60;
const LINE_H = 15;
const FAN = 28;
const MONO_CH = 6.7; // 11px JetBrains Mono advance
const CAPS_CH = 7.6; // 11px Public Sans bold caps + tracking
const MIN_MARK = 2;

interface Run {
  x: number;
  w: number;
}

/** Turns lots into pixel runs, merging neighbours closer than a pixel. */
function toRuns(lots: PlatLot[], x0: number, w: number): Run[] {
  const spans = lots
    .map((lot) => {
      const x = x0 + lot.start * w;
      return { x, end: x + Math.max(1, lot.width * w) };
    })
    .sort((a, b) => a.x - b.x);
  const runs: Run[] = [];
  for (const span of spans) {
    const last = runs[runs.length - 1];
    if (last && span.x <= last.x + last.w + 0.75) {
      last.w = Math.max(last.w, span.end - last.x);
    } else {
      runs.push({ x: span.x, w: span.end - span.x });
    }
  }
  return runs;
}

function bandName(band: PlatBand, version: PlatModel['version']): string {
  switch (band.kind) {
    case 'space':
      return version === 'ipv4' ? 'IPv4 space' : 'IPv6 space';
    case 'lot':
      return 'Lot';
    case 'range':
      return 'Queried range';
    default:
      return 'Block';
  }
}

export function describePlat(model: PlatModel): string {
  const chain = model.bands.map(
    (band) => `${bandName(band, model.version).toLowerCase()} ${band.cidr}`
  );
  const text = chain.join(', which contains ');
  if (model.mode === 'match') return `${text}, which contains ${model.query}.`;
  if (model.mode === 'none') {
    return `${text}. ${model.query} is in this block but no published AWS prefix contains it.`;
  }
  return `${text}.`;
}

interface Placed {
  band: PlatBand;
  last: boolean;
  isLot: boolean;
  name: string;
  sizeFits: boolean;
  services: string;
  regions: string;
  /** Top of the label row. */
  top: number;
  /** Top of the band itself. */
  y: number;
  h: number;
  tickFits: boolean;
  /** Bottom of the tick label row (or of the band when there is none). */
  tickBottom: number;
}

/** Horizontal position of the queried point's leader line. */
function pointX(point: PlatSpan, x0: number, w: number): number {
  const cx = x0 + (point.start + point.width / 2) * w;
  return Math.min(Math.max(cx, x0 + 5), x0 + w - 5);
}

function useMeasuredWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface ParcelStripProps {
  model: PlatModel;
  /** Shown above the drawing, e.g. "Plat of 3.5.140.2". */
  title: React.ReactNode;
  /** Short note on the right of the title. */
  note?: React.ReactNode;
  /** Text under the legend, e.g. why this is an example. */
  footnote?: React.ReactNode;
  /** Re-runs the point animation when it changes. */
  animationKey?: string;
  className?: string;
}

export function ParcelStrip({
  model,
  title,
  note,
  footnote,
  animationKey,
  className,
}: ParcelStripProps) {
  const [ref, measured] = useMeasuredWidth(640);
  const hatchId = `hatch-${useId().replace(/:/g, '')}`;
  const W = Math.max(280, measured);
  const x0 = 0.5;
  const w = W - 1;

  const text = (value: string, kind: 'mono' | 'caps') =>
    value.length * (kind === 'mono' ? MONO_CH : CAPS_CH);

  // Lay the bands out top to bottom: label row, band, tick row, fan.
  const placed: Placed[] = [];
  let cursor = 0;
  model.bands.forEach((band, i) => {
    const last = i === model.bands.length - 1;
    const isLot = band.kind === 'lot';
    const name = bandName(band, model.version).toUpperCase();
    const sizeFits =
      text(`${name} ${band.cidr}`, 'caps') + text(band.size, 'mono') + 16 < w;
    const records = isLot ? (model.lot?.records ?? []) : [];
    const services = Array.from(new Set(records.map((r) => r.service))).join(
      ' · '
    );
    const regions = Array.from(new Set(records.map((r) => r.region))).join(
      ', '
    );
    const lines = 1 + (sizeFits ? 0 : 1) + (services ? 1 : 0);
    const top = cursor;
    const y = top + lines * LINE_H + 5;
    const h = last ? LAST_H : BLOCK_H;
    const tickFits = band.ticks.every(
      (t) => text(t.label, 'mono') + 12 < w / 4
    );
    const tickBottom = y + h + (tickFits && band.ticks.length ? 20 : 6);
    placed.push({
      band,
      last,
      isLot,
      name,
      sizeFits,
      services,
      regions,
      top,
      y,
      h,
      tickFits,
      tickBottom,
    });
    cursor = tickBottom + (last ? 0 : FAN);
  });
  const lastPlaced = placed[placed.length - 1];
  const height = Math.ceil(
    (lastPlaced?.tickBottom ?? 0) + (model.point ? 24 : 4)
  );

  return (
    <figure
      className={cn(
        'min-w-0 rounded-lg border border-rule bg-paper px-4 pb-3 pt-3 sm:px-5',
        className
      )}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <span className="font-semibold text-ink">{title}</span>
        {note && <span>{note}</span>}
      </figcaption>
      <div ref={ref} className="mt-3 w-full">
        <svg
          width={W}
          height={height}
          viewBox={`0 0 ${W} ${height}`}
          role="img"
          aria-label={describePlat(model)}
          className="block max-w-full overflow-visible"
        >
          <defs>
            <pattern
              id={hatchId}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="5" height="5" fill="var(--sage-tint)" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="5"
                stroke="var(--sage)"
                strokeWidth="1.25"
              />
            </pattern>
          </defs>

          {placed.map((p, i) => {
            const { band, last, isLot, y, h } = p;
            const next = placed[i + 1];
            const runs = toRuns(band.lots, x0, w);
            const focus =
              band.focus && next
                ? {
                    x1: x0 + band.focus.start * w - 1.5,
                    x2:
                      x0 +
                      band.focus.start * w +
                      Math.max(3, band.focus.width * w) +
                      1.5,
                  }
                : null;
            const point =
              last && model.point ? pointX(model.point, x0, w) : null;
            // Vertical lines that cross the tick row: the focus window's
            // leaders and the point's leader. Tick labels give way to them.
            const crossings = [
              ...(focus ? [focus.x1, focus.x2] : []),
              ...(point !== null ? [point] : []),
            ];
            const tickClear = (at: number, label: string) => {
              const cx = x0 + at * w;
              const half = text(label, 'mono') / 2 + 5;
              return crossings.every((x) => x < cx - half || x > cx + half);
            };
            const lineY = (n: number) => p.top + LINE_H * n - 3;

            return (
              <g key={`${band.cidr}-${i}`}>
                {/* Label row above the band */}
                <text
                  x={x0}
                  y={lineY(1)}
                  className="plat-label"
                  fill={isLot ? 'var(--mark-ink)' : 'var(--ink)'}
                >
                  {p.name}{' '}
                  <tspan
                    fontFamily="var(--font-mono)"
                    fontWeight={600}
                    letterSpacing={0}
                  >
                    {band.cidr}
                  </tspan>
                </text>
                <text
                  x={p.sizeFits ? x0 + w : x0}
                  y={lineY(p.sizeFits ? 1 : 2)}
                  textAnchor={p.sizeFits ? 'end' : 'start'}
                  fontFamily="var(--font-mono)"
                  fontSize={11}
                  fill="var(--ink-2)"
                >
                  {band.size}
                </text>
                {p.services && (
                  <text
                    x={x0}
                    y={lineY(p.sizeFits ? 2 : 3)}
                    fontSize={12}
                    fill="var(--ink)"
                  >
                    {p.services}
                    <tspan fill="var(--ink-2)"> · </tspan>
                    <tspan fontFamily="var(--font-mono)" fontSize={11}>
                      {p.regions}
                    </tspan>
                  </text>
                )}

                {/* Band body */}
                <rect
                  x={x0}
                  y={y}
                  width={w}
                  height={h}
                  fill={isLot ? 'var(--sage-tint)' : 'var(--paper)'}
                  stroke={isLot ? 'var(--sage)' : 'var(--ink)'}
                  strokeWidth={isLot ? 1.5 : 1}
                />
                {/* Quarter lines */}
                {band.ticks.map((tick) => (
                  <line
                    key={tick.at}
                    x1={x0 + tick.at * w}
                    x2={x0 + tick.at * w}
                    y1={y}
                    y2={y + h}
                    stroke={isLot ? 'var(--sage)' : 'var(--rule)'}
                    strokeWidth={1}
                  />
                ))}
                {/* Published AWS prefixes inside this band */}
                {runs.map((run) => (
                  <rect
                    key={run.x}
                    x={run.x}
                    y={y + 1}
                    width={run.w}
                    height={h - 2}
                    fill={run.w > 3 ? `url(#${hatchId})` : 'var(--sage)'}
                    stroke="var(--sage)"
                    strokeWidth={run.w > 3 ? 0.75 : 0}
                  />
                ))}
                {/* Where the matched lot sits */}
                {band.lot && (
                  <rect
                    x={x0 + band.lot.start * w}
                    y={y}
                    width={Math.max(MIN_MARK, band.lot.width * w)}
                    height={h}
                    fill="var(--mark)"
                  />
                )}
                {/* The window the next band enlarges, and its fan */}
                {focus && next && (
                  <>
                    <rect
                      x={focus.x1}
                      y={y - 3}
                      width={focus.x2 - focus.x1}
                      height={h + 6}
                      fill="none"
                      stroke="var(--ink)"
                      strokeWidth={1}
                    />
                    <g
                      stroke="var(--ink-2)"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      fill="none"
                    >
                      <polyline
                        points={`${focus.x1},${y + h + 3} ${focus.x1},${p.tickBottom} ${x0},${next.top - 4}`}
                      />
                      <polyline
                        points={`${focus.x2},${y + h + 3} ${focus.x2},${p.tickBottom} ${x0 + w},${next.top - 4}`}
                      />
                    </g>
                  </>
                )}

                {/* Quarter addresses under the band */}
                {p.tickFits &&
                  band.ticks.map((tick) =>
                    tickClear(tick.at, tick.label) ? (
                      <text
                        key={tick.at}
                        x={x0 + tick.at * w}
                        y={y + h + 14}
                        textAnchor="middle"
                        fontFamily="var(--font-mono)"
                        fontSize={11}
                        fill="var(--ink-2)"
                      >
                        {tick.label}
                      </text>
                    ) : null
                  )}

                {last && model.point && (
                  <QueryPoint
                    key={animationKey ?? model.query}
                    point={model.point}
                    x0={x0}
                    w={w}
                    y={y}
                    h={h}
                    width={W}
                    labelY={p.tickBottom + 16}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <Legend model={model} hatchId={hatchId} />
      {footnote && <p className="mt-2 text-[13px] text-ink-2">{footnote}</p>}
    </figure>
  );
}

function QueryPoint({
  point,
  x0,
  w,
  y,
  h,
  width,
  labelY,
}: {
  point: NonNullable<PlatModel['point']>;
  x0: number;
  w: number;
  y: number;
  h: number;
  width: number;
  labelY: number;
}) {
  const spanW = point.width * w;
  // A CIDR query is drawn as a span; a single address is always a point.
  const isRange = point.label.includes('/') && spanW >= 4;
  const px = pointX(point, x0, w);
  const labelW = point.label.length * MONO_CH;
  const anchorEnd = px + labelW + 8 > width;
  const cy = y + h / 2;

  return (
    <g className="plat-point">
      {isRange ? (
        <rect
          x={x0 + point.start * w}
          y={y}
          width={spanW}
          height={h}
          fill="color-mix(in srgb, var(--mark) 22%, transparent)"
          stroke="var(--mark)"
          strokeWidth={1.5}
        />
      ) : (
        <circle
          cx={px}
          cy={cy}
          r={4.5}
          fill="var(--mark)"
          stroke="var(--paper)"
          strokeWidth={1.5}
        />
      )}
      <line
        x1={px}
        x2={px}
        y1={isRange ? y + h : cy + 5}
        y2={labelY - 11}
        stroke="var(--mark)"
        strokeWidth={1}
      />
      <text
        x={anchorEnd ? px - 6 : px + 6}
        y={labelY}
        textAnchor={anchorEnd ? 'end' : 'start'}
        fontFamily="var(--font-mono)"
        fontSize={12}
        fontWeight={600}
        fill="var(--mark-ink)"
      >
        {point.label}
      </text>
    </g>
  );
}

function Legend({ model, hatchId }: { model: PlatModel; hatchId: string }) {
  const hasLots = model.bands.some((b) => b.lots.length > 0);
  const hasFocus = model.bands.some((b) => b.focus);
  return (
    <>
      <ul
        className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-2"
        aria-label="Legend"
      >
        {hasLots && (
          <li className="flex items-center gap-1.5">
            <svg width="14" height="10" aria-hidden="true">
              <rect
                x="0.5"
                y="0.5"
                width="13"
                height="9"
                fill={`url(#${hatchId})`}
                stroke="var(--sage)"
              />
            </svg>
            Published AWS prefixes
          </li>
        )}
        {model.mode === 'match' && (
          <li className="flex items-center gap-1.5">
            <svg width="14" height="10" aria-hidden="true">
              <rect x="5" y="0" width="4" height="10" fill="var(--mark)" />
            </svg>
            Matched lot
          </li>
        )}
        {model.point && (
          <li className="flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden="true">
              <circle cx="5" cy="5" r="4" fill="var(--mark)" />
            </svg>
            Queried address
          </li>
        )}
        {hasFocus && (
          <li className="flex items-center gap-1.5">
            <svg width="14" height="10" aria-hidden="true">
              <rect
                x="0.5"
                y="0.5"
                width="13"
                height="9"
                fill="none"
                stroke="var(--ink)"
              />
            </svg>
            Enlarged in the band below
          </li>
        )}
      </ul>
      <p className="mt-1 text-[12px] text-ink-2">
        {model.bands.length > 1
          ? 'Bands drawn to scale within each enlargement.'
          : 'Drawn to scale across the whole IPv4 space.'}
      </p>
    </>
  );
}
