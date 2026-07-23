import { useMemo } from "react";
import type { CommitInfo } from "../../../types";
import { computeGraph, colorForLane } from "./computeGraph";

const ROW_HEIGHT = 52;
const LANE_WIDTH = 16;
const NODE_RADIUS = 4;
const LEFT_PAD = 10;

interface GraphSvgProps {
  commits: CommitInfo[];
  width: number;
}

export default function GraphSvg({ commits, width }: GraphSvgProps) {
  const { nodes, laneCount } = useMemo(() => computeGraph(commits), [commits]);

  const svgWidth = Math.max(width, LEFT_PAD + laneCount * LANE_WIDTH + 8);
  const svgHeight = commits.length * ROW_HEIGHT;

  const cx = (lane: number) => LEFT_PAD + lane * LANE_WIDTH + LANE_WIDTH / 2;
  const cy = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      className="absolute left-0 top-0 pointer-events-none"
    >
      {/* Draw edges first (behind nodes) */}
      {nodes.map((node, row) =>
        node.edges.map((edge, ei) => {
          const x1 = cx(edge.fromLane);
          const y1 = cy(row);
          const x2 = cx(edge.toLane);
          const y2 = cy(edge.toRow);

          if (edge.fromLane === edge.toLane) {
            // Straight vertical line
            return (
              <line
                key={`${row}-${ei}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={edge.color}
                strokeWidth={2}
                strokeOpacity={0.6}
              />
            );
          }

          // Cross-lane edge: curve into the target lane within one row,
          // then a vertical line in the target lane down to the parent.
          // Pass-through lines handle intermediate rows, but we need the
          // vertical segment from the curve endpoint to the parent.
          const curveEndY = cy(row + 1);
          const midY = y1 + ROW_HEIGHT * 0.6;
          const elements = [
            <path
              key={`${row}-${ei}-curve`}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${curveEndY}`}
              fill="none"
              stroke={edge.color}
              strokeWidth={2}
              strokeOpacity={0.6}
            />,
          ];
          // If the parent is more than one row away, draw a vertical line
          // from the curve endpoint to the parent node
          if (edge.toRow > row + 1) {
            elements.push(
              <line
                key={`${row}-${ei}-vert`}
                x1={x2}
                y1={curveEndY}
                x2={x2}
                y2={y2}
                stroke={edge.color}
                strokeWidth={2}
                strokeOpacity={0.6}
              />,
            );
          }
          return elements;
        }),
      )}

      {/* Draw pass-through lines for active lanes that have no commit at this row */}
      {nodes.map((node, row) =>
        node.passThroughLanes.map((ptLane) => {
          const x = cx(ptLane);
          const y1 = cy(row) - ROW_HEIGHT / 2;
          const y2 = cy(row) + ROW_HEIGHT / 2;
          return (
            <line
              key={`pt-${row}-${ptLane}`}
              x1={x}
              y1={y1}
              x2={x}
              y2={y2}
              stroke={colorForLane(ptLane)}
              strokeWidth={2}
              strokeOpacity={0.6}
            />
          );
        }),
      )}

      {/* Draw commit nodes */}
      {nodes.map((node, row) => {
        const x = cx(node.lane);
        const y = cy(row);
        const color = colorForLane(node.lane);
        const isMerge = node.commit.parents.length > 1;

        return (
          <g key={node.commit.oid}>
            <circle
              cx={x}
              cy={y}
              r={isMerge ? NODE_RADIUS + 1 : NODE_RADIUS}
              fill={color}
              stroke={isMerge ? "var(--canvas)" : "none"}
              strokeWidth={isMerge ? 2 : 0}
            />
          </g>
        );
      })}
    </svg>
  );
}

export { ROW_HEIGHT, LANE_WIDTH, LEFT_PAD };
