import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../lib/axios";
import { formatRelativeTime, truncateMiddle, unwrapEnvelope } from "../lib/utils";
import type { Agent, AgentStatus, AgentType, ApiEnvelope } from "../types";
import { NodeGraphIcon, RobotIcon, SearchIcon } from "../components/Icons";
import { ErrorCard, SkeletonBlock } from "../components/Feedback";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "REVOKED", label: "Revoked" },
  { value: "COMPLETE", label: "Complete" },
  { value: "WARNING", label: "Warning" }
];

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Types" },
  { value: "PLANNER", label: "Planner" },
  { value: "EXECUTOR", label: "Executor" },
  { value: "ANALYZER", label: "Analyzer" },
  { value: "TRADER", label: "Trader" },
  { value: "CONFIRMER", label: "Confirmer" }
];

function StatusBadge({ status }: { status: AgentStatus }) {
  const cls: Record<AgentStatus, string> = {
    ACTIVE: "bg-indigo-100 text-indigo-700",
    REVOKED: "bg-red-100 text-red-600",
    COMPLETE: "bg-emerald-100 text-emerald-700",
    WARNING: "bg-amber-100 text-amber-700"
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function TypeBadge({ type }: { type: AgentType }) {
  return (
    <span className="rounded-full border border-silk-primary/20 bg-silk-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-silk-primary">
      {type.charAt(0) + type.slice(1).toLowerCase()}
    </span>
  );
}

export function Nodes() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState(
    () => new URLSearchParams(window.location.search).get("search") ?? ""
  );
  const [statusFilter, setStatusFilter] = useState(
    () => new URLSearchParams(window.location.search).get("status") ?? "ALL"
  );
  const [typeFilter, setTypeFilter] = useState(
    () => new URLSearchParams(window.location.search).get("type") ?? "ALL"
  );
  const [accumulatedAgents, setAccumulatedAgents] = useState<Agent[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const isFirstPage = useRef(true);

  const debouncedSearch = useDebounce(searchQuery, 400);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
  }, [debouncedSearch, statusFilter, typeFilter]);

  useEffect(() => {
    isFirstPage.current = true;
    setPage(1);
    setAccumulatedAgents([]);
    setTotalCount(null);
  }, [debouncedSearch, statusFilter, typeFilter]);

  const agentsQuery = useQuery({
    queryKey: ["agents", debouncedSearch, statusFilter, typeFilter, page],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Agent[]>>("/agents", {
        params: {
          search: debouncedSearch || undefined,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          type: typeFilter === "ALL" ? undefined : typeFilter,
          page,
          limit: 50
        }
      });
      return res.data;
    },
    refetchInterval: 30_000
  });

  useEffect(() => {
    if (!agentsQuery.data) return;
    const agents = agentsQuery.data.data ?? [];
    const total = typeof agentsQuery.data.meta?.total === "number" ? agentsQuery.data.meta.total : null;
    setTotalCount(total);
    if (isFirstPage.current || page === 1) {
      setAccumulatedAgents(agents);
      isFirstPage.current = false;
    } else {
      setAccumulatedAgents((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        return [...prev, ...agents.filter((a) => !existingIds.has(a.id))];
      });
    }
  }, [agentsQuery.data, page]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  };

  const hasFilters = searchQuery !== "" || statusFilter !== "ALL" || typeFilter !== "ALL";
  const isLoading = agentsQuery.isLoading && accumulatedAgents.length === 0;
  const showLoadMore =
    totalCount !== null ? accumulatedAgents.length < totalCount : (agentsQuery.data?.data?.length ?? 0) === 50;

  return (
    <div className="min-h-[calc(100vh-5rem)] p-4 pb-24 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Header */}
        <section className="tm-shell-card overflow-hidden px-6 py-6 md:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-center">
            <div>
              <div className="tm-kicker">Mesh Topology</div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-silk-text-primary md:text-5xl">
                Node registry
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-silk-text-secondary">
                Search and filter every agent across all jobs. Click any row to inspect the full job graph.
              </p>
            </div>
            {totalCount !== null && (
              <div className="tm-control-surface rounded-[22px] px-5 py-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">Total Agents</div>
                <div className="mt-2 text-3xl font-semibold text-silk-primary">{totalCount}</div>
              </div>
            )}
          </div>
        </section>

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1" style={{ minWidth: "220px" }}>
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-silk-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by .sol name or wallet address..."
              className="neo-inset w-full rounded-[20px] py-3 pl-10 pr-4 text-sm text-silk-text-primary placeholder:text-silk-text-tertiary focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="neo-button rounded-[20px] px-4 py-3 text-sm text-silk-text-primary"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="neo-button rounded-[20px] px-4 py-3 text-sm text-silk-text-primary"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="neo-button rounded-[20px] px-4 py-3 text-sm text-silk-text-secondary"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-14 rounded-[16px]" />
            ))}
          </div>
        ) : agentsQuery.isError && accumulatedAgents.length === 0 ? (
          <ErrorCard
            message={(agentsQuery.error as Error).message || "Agents could not be loaded."}
            onRetry={() => void agentsQuery.refetch()}
          />
        ) : accumulatedAgents.length === 0 ? (
          hasFilters ? (
            <div className="tm-shell-card flex flex-col items-center px-6 py-16 text-center">
              <SearchIcon className="h-12 w-12 text-silk-text-tertiary" />
              <h3 className="mt-4 text-lg font-semibold text-silk-text-primary">No agents found</h3>
              <p className="mt-2 text-sm text-silk-text-secondary">Try adjusting your search or filters.</p>
              <button type="button" onClick={clearFilters} className="neo-button mt-5 text-sm">
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="tm-shell-card flex flex-col items-center px-6 py-16 text-center">
              <RobotIcon className="h-12 w-12 text-silk-text-tertiary" />
              <h3 className="mt-4 text-lg font-semibold text-silk-text-primary">No agents deployed yet</h3>
              <p className="mt-2 text-sm text-silk-text-secondary">
                Agents will appear here after you deploy your first job.
              </p>
              <Link to="/deploy" className="neo-button mt-5 text-sm">
                Go to Deployer
              </Link>
            </div>
          )
        ) : (
          <div className="tm-shell-card overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-4 border-b border-white/10 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-silk-text-tertiary">
              <span>Agent Name</span>
              <span className="hidden sm:block">Type</span>
              <span className="hidden md:block">Job ID</span>
              <span className="hidden lg:block">Status</span>
              <span className="hidden xl:block">Actions</span>
              <span>Spawned</span>
            </div>

            {accumulatedAgents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => navigate(`/jobs/${agent.jobId}`)}
                className="grid w-full grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-x-4 border-b border-white/10 px-6 py-3.5 text-left transition-all last:border-0 hover:bg-white/30"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-[13px] font-medium text-silk-text-primary">
                    {agent.solSubName}
                  </div>
                  {agent.walletAddr && (
                    <div className="mt-0.5 font-mono text-[11px] text-silk-text-tertiary">
                      {truncateMiddle(agent.walletAddr, 6, 4)}
                    </div>
                  )}
                </div>
                <span className="hidden sm:block">
                  <TypeBadge type={agent.type} />
                </span>
                <span className="hidden font-mono text-xs text-silk-text-secondary md:block">
                  {truncateMiddle(agent.jobId, 6, 4)}
                </span>
                <span className="hidden lg:block">
                  <StatusBadge status={agent.status} />
                </span>
                <span className="hidden text-sm font-semibold text-silk-text-secondary xl:block">
                  {agent.actionCount}
                </span>
                <span className="text-xs text-silk-text-tertiary">
                  {formatRelativeTime(agent.createdAt)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {accumulatedAgents.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-silk-text-tertiary">
              Showing {accumulatedAgents.length}{totalCount !== null ? ` of ${totalCount}` : ""} agents
            </p>
            {showLoadMore && (
              <button
                type="button"
                disabled={agentsQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
                className="neo-button flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {agentsQuery.isFetching ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-silk-primary border-t-transparent" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
