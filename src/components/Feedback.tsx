import { motion } from "framer-motion";
import { cx } from "../lib/utils";

type SkeletonProps = {
  className?: string;
};

export function SkeletonBlock({ className }: SkeletonProps) {
  return (
    <div
      className={cx("neo-inset animate-softPulse bg-silk-bg/80", className)}
      aria-hidden="true"
    />
  );
}

type ErrorCardProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorCard({
  title = "Unable to load",
  message,
  onRetry,
  className
}: ErrorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx("neo-raised p-5 text-sm text-silk-text-primary", className)}
    >
      <div className="font-semibold">{title}</div>
      <p className="mt-2 text-silk-text-secondary">{message}</p>
      {onRetry ? (
        <button className="neo-button mt-4 px-4 py-2 text-silk-primary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </motion.div>
  );
}
