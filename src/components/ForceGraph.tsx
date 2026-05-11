import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import * as d3 from "d3";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import { runtimeConfig } from "../lib/runtimeConfig";
import { useAgentStore } from "../stores/agentStore";
import { useSettingsStore } from "../stores/settingsStore";
import { statusColor, unwrapEnvelope } from "../lib/utils";
import type { Agent, ApiEnvelope, Delegation, GraphSnapshot } from "../types";
import { PersonIcon, RobotIcon } from "./Icons";
import { ErrorCard, SkeletonBlock } from "./Feedback";

type ForceGraphProps = {
  jobId: string;
  onNodeClick: (agentId: string) => void;
};

type SizedNode = Agent &
  d3.SimulationNodeDatum & {
    x: number;
    y: number;
  };

type SizedEdge = Delegation &
  d3.SimulationLinkDatum<SizedNode> & {
    source: SizedNode;
    target: SizedNode;
  };

type GraphBounds = {
  width: number;
  height: number;
};

function coerceGraphSnapshot(payload: GraphSnapshot): GraphSnapshot {
  return {
    nodes: payload.nodes,
    edges: payload.edges
  };
}

function linePath(edge: SizedEdge) {
  return `M ${edge.source.x} ${edge.source.y} L ${edge.target.x} ${edge.target.y}`;
}

export function ForceGraph({ jobId, onNodeClick }: ForceGraphProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const simulationRef = useRef<d3.Simulation<SizedNode, SizedEdge> | null>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [bounds, setBounds] = useState<GraphBounds>({ width: 900, height: 640 });
  const [renderNodes, setRenderNodes] = useState<SizedNode[]>([]);
  const [renderEdges, setRenderEdges] = useState<SizedEdge[]>([]);
  const [flashAgentIds, setFlashAgentIds] = useState<string[]>([]);
  const pollingIntervalMs = useSettingsStore((state) => state.pollingIntervalMs);

  const liveAgents = useAgentStore((state) => state.agents);
  const lastMessage = useAgentStore((state) => state.lastMessage);

  const graphQuery = useQuery({
    queryKey: ["graph", jobId],
    enabled: Boolean(jobId),
    queryFn: async () =>
      coerceGraphSnapshot(
        unwrapEnvelope(
          (
            await apiClient.get<ApiEnvelope<GraphSnapshot>>(`/graph/${jobId}`)
          ).data
        )
      ),
    refetchInterval: runtimeConfig.enableRealtime ? false : pollingIntervalMs
  });

  const setSnapshot = useAgentStore((state) => state.setSnapshot);

  useEffect(() => {
    if (graphQuery.data) {
      setSnapshot(graphQuery.data.nodes);
    }
  }, [graphQuery.data, setSnapshot]);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setBounds({
        width: Math.max(360, entry.contentRect.width),
        height: Math.max(420, entry.contentRect.height)
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    simulationRef.current?.stop();
    simulationRef.current = null;
    setRenderNodes([]);
    setRenderEdges([]);
  }, [jobId]);

  useEffect(() => {
    if (!lastMessage) {
      return;
    }
    setFlashAgentIds((current) => Array.from(new Set([...current, lastMessage.senderId])));
    const timeout = window.setTimeout(() => {
      setFlashAgentIds((current) => current.filter((id) => id !== lastMessage.senderId));
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [lastMessage]);

  const nodesSource = useMemo(() => {
    const liveList = Array.from(liveAgents.values()).filter(
      (agent): agent is Agent => agent != null && agent.jobId === jobId
    );
    return (liveList.length > 0 ? liveList : graphQuery.data?.nodes ?? []).filter(
      (n): n is Agent => n != null
    );
  }, [liveAgents, jobId, graphQuery.data]);

  const edgesSource = useMemo(() => {
    const nodeMap = new Map(nodesSource.map((node) => [node.id, node]));
    if (graphQuery.data?.edges.length) {
      return graphQuery.data.edges.filter(
        (edge) => edge != null && nodeMap.has(edge.source) && nodeMap.has(edge.target)
      );
    }
    return nodesSource
      .filter((node) => node.parentAgentId)
      .map((node) => ({
        id: `${node.parentAgentId!}->${node.id}`,
        source: node.parentAgentId as string,
        target: node.id,
        type: "DELEGATION" as const
      }));
  }, [nodesSource, graphQuery.data]);

  useEffect(() => {
    if (nodesSource.length === 0) {
      setRenderNodes([]);
      setRenderEdges([]);
      return;
    }

    const sizedNodes: SizedNode[] = nodesSource.map((node, index) => {
      const saved = positionsRef.current.get(node.id);
      const angle = (Math.PI * 2 * index) / Math.max(1, nodesSource.length);
      return {
        ...node,
        x: saved?.x ?? bounds.width / 2 + Math.cos(angle) * 120,
        y: saved?.y ?? bounds.height / 2 + Math.sin(angle) * 120
      };
    });

    const nodeById = new Map(sizedNodes.map((node) => [node.id, node]));
    const sizedEdges: SizedEdge[] = edgesSource
      .map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) {
          return null;
        }
        return {
          ...edge,
          source,
          target
        };
      })
      .filter((edge): edge is SizedEdge => edge !== null);

    simulationRef.current?.stop();

    const simulation = d3
      .forceSimulation(sizedNodes)
      .force(
        "link",
        d3
          .forceLink<SizedNode, SizedEdge>(sizedEdges)
          .id((node) => node.id)
          .distance(120)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(bounds.width / 2, bounds.height / 2))
      .alpha(1)
      .alphaDecay(0.07)
      .on("tick", () => {
        sizedNodes.forEach((node) => {
          positionsRef.current.set(node.id, { x: node.x, y: node.y });
        });
        setRenderNodes(sizedNodes.map((node) => ({ ...node })));
        setRenderEdges(sizedEdges.map((edge) => ({ ...edge })));
      });

    simulationRef.current = simulation;
    setRenderNodes(sizedNodes.map((node) => ({ ...node })));
    setRenderEdges(sizedEdges.map((edge) => ({ ...edge })));

    return () => {
      simulation.stop();
    };
  }, [bounds.height, bounds.width, edgesSource, nodesSource]);

  useEffect(() => {
    if (!simulationRef.current) {
      return;
    }

    const dragBehavior = d3
      .drag<SVGGElement, SizedNode>()
      .on("start", (event, node) => {
        if (!event.active) {
          simulationRef.current?.alphaTarget(0.15).restart();
        }
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event, node) => {
        if (!event.active) {
          simulationRef.current?.alphaTarget(0);
        }
        node.fx = null;
        node.fy = null;
      });

    d3.select(wrapperRef.current)
      .selectAll<SVGGElement, SizedNode>("g[data-node-id]")
      .data(renderNodes.filter((n): n is SizedNode => n != null))
      .call(dragBehavior);
  }, [renderNodes]);

  if (graphQuery.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="grid w-full max-w-3xl grid-cols-3 gap-6">
          <SkeletonBlock className="h-40 rounded-[24px]" />
          <SkeletonBlock className="h-40 rounded-[24px]" />
          <SkeletonBlock className="h-40 rounded-[24px]" />
        </div>
      </div>
    );
  }

  if (graphQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <ErrorCard
          message={(graphQuery.error as Error).message || "The force graph could not be loaded."}
          onRetry={() => void graphQuery.refetch()}
          className="max-w-md"
        />
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <svg className="h-full w-full" viewBox={`0 0 ${bounds.width} ${bounds.height}`}>
        <defs>
          <filter id="silkNodeShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="4" dy="4" stdDeviation="5" floodColor="rgba(0,0,0,0.12)" />
          </filter>
        </defs>

        {renderEdges.filter((e): e is SizedEdge => e != null && e.source != null && e.target != null).map((edge) => {
          const sourceStatus = edge.source.status;
          const targetStatus = edge.target.status;
          const revoked = sourceStatus === "REVOKED" || targetStatus === "REVOKED";
          const path = linePath(edge);

          return (
            <g key={edge.id}>
              <path
                id={`edge-${edge.id}`}
                d={path}
                fill="none"
                stroke={revoked ? "rgb(var(--tm-color-status-revoked))" : "rgb(var(--tm-color-primary))"}
                strokeOpacity={revoked ? 0.15 : 0.35}
                strokeWidth="1.5"
              />
              {!revoked ? (
                <circle r="4" fill="rgb(var(--tm-color-primary))">
                  <animateMotion dur="3s" repeatCount="indefinite" path={path} />
                </circle>
              ) : null}
            </g>
          );
        })}

        {renderNodes.filter((n): n is SizedNode => n != null).map((node) => {
          const tone = statusColor(node.status);
          const isRoot = node.parentAgentId === null;
          const flashing = flashAgentIds.includes(node.id);

          return (
            <motion.g
              key={node.id}
              data-node-id={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              whileHover={{ scale: 1.12 }}
              onClick={() => onNodeClick(node.id)}
              className="cursor-pointer"
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            >
              <circle r="28" fill="rgb(var(--tm-color-surface))" filter="url(#silkNodeShadow)" />
              <circle
                r="28"
                fill="none"
                stroke={flashing ? "rgb(var(--tm-color-surface-strong))" : tone}
                strokeWidth="3"
                opacity={node.status === "ACTIVE" ? 1 : 0.92}
              >
                {node.status === "ACTIVE" ? (
                  <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                ) : null}
              </circle>
              <g transform="translate(-7,-7)" className={flashing ? "animate-nodeFlash" : undefined}>
                {isRoot ? (
                  <PersonIcon className="h-[14px] w-[14px] text-silk-primary" />
                ) : (
                  <RobotIcon className="h-[14px] w-[14px] text-silk-primary" />
                )}
              </g>
              <text
                y="45"
                textAnchor="middle"
                className="fill-silk-text-secondary font-mono text-[10px]"
              >
                {node.solSubName}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
