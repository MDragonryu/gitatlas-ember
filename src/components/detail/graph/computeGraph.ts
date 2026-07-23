import type { CommitInfo } from "../../../types";

export interface GraphNode {
  commit: CommitInfo;
  lane: number;
  // Lines connecting to parent commits: [fromLane, toLane, toRow]
  edges: GraphEdge[];
  // Lanes that pass through this row (active but no commit here)
  passThroughLanes: number[];
}

export interface GraphEdge {
  fromLane: number;
  toLane: number;
  toRow: number;
  color: string;
}

const LANE_COLORS = [
  "var(--keyword)",
  "var(--type)",
  "var(--success)",
  "var(--number)",
  "var(--function)",
  "var(--attribute)",
  "var(--info)",
  "var(--operator, var(--keyword))",
];

export function colorForLane(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

/**
 * Compute graph layout for a list of commits.
 *
 * Algorithm: Maintain an array of "active lanes", each tracking an expected
 * OID (the next commit that should appear in that lane). When a commit arrives:
 *   1. Find its lane (where our short_oid is expected), or allocate a new one.
 *   2. For each parent, either reserve it in the current lane (first parent)
 *      or find/allocate a lane for it (merge parents).
 *   3. Draw edges from this commit's lane to each parent's lane.
 */
export function computeGraph(commits: CommitInfo[]): {
  nodes: GraphNode[];
  laneCount: number;
} {
  // activeLanes[i] = short_oid expected next in lane i, or null if free
  const activeLanes: (string | null)[] = [];
  // Map from short_oid → row index (for edge targets)
  const oidToRow = new Map<string, number>();
  commits.forEach((c, i) => oidToRow.set(c.short_oid, i));

  const nodes: GraphNode[] = [];

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];
    const shortOid = commit.short_oid;

    // 1. Find which lane this commit belongs in
    let lane = activeLanes.indexOf(shortOid);
    if (lane === -1) {
      // Allocate a new lane (find first free slot or append)
      lane = activeLanes.indexOf(null);
      if (lane === -1) {
        lane = activeLanes.length;
        activeLanes.push(null);
      }
    }

    // This lane is now "used" by this commit
    activeLanes[lane] = null;

    const edges: GraphEdge[] = [];

    // 2. Handle parents
    const parents = commit.parents;
    for (let pi = 0; pi < parents.length; pi++) {
      const parentShort = parents[pi];
      const parentRow = oidToRow.get(parentShort);

      if (pi === 0) {
        // First parent: continue in the same lane
        activeLanes[lane] = parentShort;

        if (parentRow !== undefined) {
          edges.push({
            fromLane: lane,
            toLane: lane,
            toRow: parentRow,
            color: colorForLane(lane),
          });
        }
      } else {
        // Merge parent: find an existing lane or allocate a new one
        let parentLane = activeLanes.indexOf(parentShort);
        if (parentLane === -1) {
          // Not already tracked — find a free lane
          parentLane = activeLanes.indexOf(null);
          if (parentLane === -1) {
            parentLane = activeLanes.length;
            activeLanes.push(null);
          }
          activeLanes[parentLane] = parentShort;
        }

        if (parentRow !== undefined) {
          edges.push({
            fromLane: lane,
            toLane: parentLane,
            toRow: parentRow,
            color: colorForLane(parentLane),
          });
        }
      }
    }

    // If no parents (root commit), lane becomes free (already null)

    // 3. Collapse: free lanes that point to commits already processed
    for (let i = 0; i < activeLanes.length; i++) {
      const expected = activeLanes[i];
      if (expected !== null) {
        const expectedRow = oidToRow.get(expected);
        if (expectedRow !== undefined && expectedRow <= row) {
          activeLanes[i] = null;
        }
      }
    }

    // 4. Compute pass-through lanes: lanes that are active at this row
    //    but don't belong to this commit (they're waiting for a future commit)
    const passThroughLanes: number[] = [];
    for (let i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] !== null && i !== lane) {
        passThroughLanes.push(i);
      }
    }

    nodes.push({ commit, lane, edges, passThroughLanes });
  }

  // Trim trailing null lanes for laneCount
  let laneCount = activeLanes.length;
  while (laneCount > 0 && activeLanes[laneCount - 1] === null) {
    laneCount--;
  }
  // But laneCount must be at least max lane used + 1
  const maxUsed = Math.max(0, ...nodes.map((n) => n.lane));
  laneCount = Math.max(laneCount, maxUsed + 1);

  return { nodes, laneCount };
}
