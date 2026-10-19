import { memo } from "react";
import { buildScene, fitText, type Element } from "../lib/scene";
import type { Deck, Slide, Template } from "../lib/model";

function Draw({ el, font }: { el: Element; font: string }) {
  if (el.kind === "text" && el.vertical)
    return (
      <text
        fill={el.color}
        fontFamily={el.font || font}
        fontSize={el.size}
        transform={`translate(${el.x + el.size}, ${el.y + el.h}) rotate(-90)`}
      >
        {el.text}
      </text>
    );
  if (el.kind === "text")
    return (
      <text
        fill={el.color}
        fontFamily={el.font || font}
        fontWeight={el.bold ? 700 : 400}
        fontSize={el.size}
        transform={
          el.rotate
            ? `rotate(${el.rotate} ${el.x + el.w / 2} ${el.y + el.h / 2})`
            : undefined
        }
        textAnchor={
          el.align === "center"
            ? "middle"
            : el.align === "right"
              ? "end"
              : "start"
        }
      >
        {el.lines?.map((line, i) => (
          <tspan
            key={i}
            x={
              el.x +
              (el.align === "center"
                ? el.w / 2
                : el.align === "right"
                  ? el.w
                  : 0)
            }
            y={el.y + el.size + i * el.size * 1.2}
          >
            {line}
          </tspan>
        ))}
      </text>
    );
  if (el.kind === "image")
    return (
      <image
        href={el.src}
        x={el.x}
        y={el.y}
        width={el.w}
        height={el.h}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  if (el.kind === "rect")
    return (
      <rect
        x={el.x}
        y={el.y}
        width={el.w}
        height={el.h}
        fill={el.fill}
        stroke={el.stroke}
        strokeWidth={el.sw}
        rx={el.radius}
        transform={
          el.rotate
            ? `rotate(${el.rotate} ${el.x + el.w / 2} ${el.y + el.h / 2})`
            : undefined
        }
      />
    );
  if (el.kind === "ellipse")
    return (
      <ellipse
        cx={el.x + el.w / 2}
        cy={el.y + el.h / 2}
        rx={el.w / 2}
        ry={el.h / 2}
        fill={el.fill}
        stroke={el.stroke}
        strokeWidth={el.sw}
        transform={
          el.rotate
            ? `rotate(${el.rotate} ${el.x + el.w / 2} ${el.y + el.h / 2})`
            : undefined
        }
      />
    );
  if (el.kind === "line")
    return (
      <line
        x1={el.x}
        y1={el.y}
        x2={el.x + el.w}
        y2={el.y + el.h}
        stroke={el.fill}
        strokeWidth={el.sw}
      />
    );
  if (el.kind === "table") {
    const rows = el.rows.length ? el.rows : [["Add data"]],
      cols = Math.max(...rows.map((r) => r.length)),
      cw = el.w / cols,
      rh = el.h / rows.length;
    return (
      <g>
        {rows.flatMap((row, i) =>
          Array.from({ length: cols }, (_, j) => {
            const f = fitText(row[j] || "", 19, cw - 30, rh - 24);
            return (
              <g key={`${i}-${j}`}>
                <rect
                  x={el.x + j * cw}
                  y={el.y + i * rh}
                  width={cw}
                  height={rh}
                  fill={i === 0 ? el.accent : el.light}
                  stroke={i === 0 ? el.accent : "white"}
                  strokeWidth={2}
                />
                <text
                  fill={i === 0 ? "#ffffff" : el.ink}
                  fontFamily={font}
                  fontSize={f.size}
                  fontWeight={i === 0 ? 700 : 400}
                >
                  {f.lines.map((line, k) => (
                    <tspan
                      key={k}
                      x={el.x + j * cw + 15}
                      y={el.y + i * rh + 18 + f.size + k * f.size * 1.2}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          }),
        )}
      </g>
    );
  }
  if (el.kind !== "chart") return null;
  const max = Math.max(...el.data.map((d) => d.value), 1),
    cw = el.w / Math.max(el.data.length, 1);
  return (
    <g>
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line
            x1={el.x}
            y1={el.y + (el.h - 40) * (1 - v)}
            x2={el.x + el.w}
            y2={el.y + (el.h - 40) * (1 - v)}
            stroke={el.light}
          />
          <text
            x={el.x - 12}
            y={el.y + (el.h - 40) * (1 - v) + 5}
            fill={el.ink}
            fontSize={12}
            textAnchor="end"
          >
            {Math.round(max * v)}
          </text>
        </g>
      ))}
      {el.data.map((d, i) => {
        const h = (d.value / max) * (el.h - 65);
        return (
          <g key={i}>
            <rect
              x={el.x + i * cw + cw * 0.2}
              y={el.y + el.h - 40 - h}
              width={cw * 0.6}
              height={h}
              fill={el.colors?.[i] || el.accent}
            />
            <text
              x={el.x + (i + 0.5) * cw}
              y={el.y + el.h - 48 - h}
              textAnchor="middle"
              fill={el.ink}
              fontSize={17}
            >
              {d.value}
              {el.unit || ""}
            </text>
            <text
              x={el.x + (i + 0.5) * cw}
              y={el.y + el.h - 12}
              textAnchor="middle"
              fill={el.ink}
              fontFamily={font}
              fontSize={16}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
export const SlideView = memo(function SlideView({
  slide,
  template,
  deck,
  index = 0,
  total = 16,
  className = "",
}: {
  slide: Slide;
  template: Template;
  deck?: Deck;
  index?: number;
  total?: number;
  className?: string;
}) {
  const scene = buildScene(slide, template, deck, index, total);
  return (
    <svg
      className={`slide-view ${className}`}
      viewBox="0 0 1200 675"
      role="img"
      aria-label={slide.title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="1200" height="675" fill={scene.background} />
      {scene.elements.map((el, i) => (
        <Draw key={i} el={el} font={scene.font} />
      ))}
    </svg>
  );
});
