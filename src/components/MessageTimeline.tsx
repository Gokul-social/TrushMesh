import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { apiClient } from "../lib/axios";
import { runtimeConfig } from "../lib/runtimeConfig";
import { formatRelativeTime, truncateMiddle, unwrapEnvelope } from "../lib/utils";
import { useAgentStore } from "../stores/agentStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { AgentMessage, ApiEnvelope, MessagePage } from "../types";
import { CheckIcon, WarningIcon } from "./Icons";
import { ErrorCard, SkeletonBlock } from "./Feedback";

type MessageTimelineProps = {
  jobId: string;
};

function dedupeMessages(messages: AgentMessage[]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
}

export function MessageTimeline({ jobId }: MessageTimelineProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const storedMessages = useAgentStore((state) => state.messages);
  const realtimeMessages = useMemo(
    () => storedMessages.filter((message) => message.jobId === jobId),
    [storedMessages, jobId]
  );
  const pollingIntervalMs = useSettingsStore((state) => state.pollingIntervalMs);

  const messagesQuery = useInfiniteQuery({
    queryKey: ["messages", jobId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrapEnvelope(
        (
          await apiClient.get<ApiEnvelope<MessagePage>>("/messages", {
            params: {
              jobId,
              cursor: pageParam ?? undefined,
              limit: 25
            }
          })
        ).data
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: runtimeConfig.enableRealtime ? false : pollingIntervalMs
  });

  const pagedMessages = messagesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const mergedMessages = dedupeMessages([...realtimeMessages, ...pagedMessages]).sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  const count = mergedMessages.length + (messagesQuery.hasNextPage ? 1 : 0);

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (index === mergedMessages.length ? 70 : 88),
    overscan: 10
  });

  useEffect(() => {
    if (realtimeMessages.length > 0) {
      rowVirtualizer.scrollToIndex(0);
    }
  }, [realtimeMessages.length, rowVirtualizer]);

  if (messagesQuery.isLoading) {
    return (
      <div className="grid gap-4">
        <SkeletonBlock className="h-16 rounded-[20px]" />
        <SkeletonBlock className="h-16 rounded-[20px]" />
        <SkeletonBlock className="h-16 rounded-[20px]" />
      </div>
    );
  }

  if (messagesQuery.isError) {
    return (
      <ErrorCard
        message={(messagesQuery.error as Error).message || "Message history could not be loaded."}
        onRetry={() => void messagesQuery.refetch()}
      />
    );
  }

  return (
    <div ref={parentRef} className="silk-scrollbar h-full overflow-auto pr-2">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: "relative"
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const isLoadMoreRow = virtualItem.index >= mergedMessages.length;
          const message = mergedMessages[virtualItem.index];

          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`
              }}
            >
              {isLoadMoreRow ? (
                <button
                  className="neo-button mx-auto mt-2 block px-4 py-3 text-sm font-semibold text-silk-primary"
                  onClick={() => void messagesQuery.fetchNextPage()}
                  disabled={messagesQuery.isFetchingNextPage}
                >
                  {messagesQuery.isFetchingNextPage ? "Loading..." : "Load earlier messages"}
                </button>
              ) : message ? (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="neo-inset mb-3 grid min-h-[56px] grid-cols-[88px_minmax(0,1fr)_120px] items-start gap-4 px-4 py-3"
                >
                  <div className="font-mono text-[10px] text-silk-text-tertiary">
                    {formatRelativeTime(message.createdAt)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-silk-text-primary">
                      {message.senderName} → {message.receiverName ?? "broadcast"}
                    </div>
                    <div className="mt-1 text-[13px] leading-6 text-silk-text-secondary">
                      {message.action}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-right">
                    <span className={message.verified ? "text-emerald-500" : "text-amber-500"}>
                      {message.verified ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <WarningIcon className="h-4 w-4" />
                      )}
                    </span>
                    <button
                      className="font-mono text-[11px] text-silk-primary"
                      onClick={() =>
                        window.open(
                          `https://explorer.solana.com/tx/${message.txHash}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      {truncateMiddle(message.txHash, 8, 0)}
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
