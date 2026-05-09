import {
  useDeferredValue,
  useId,
  useMemo,
  useState,
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
  type SVGProps
} from "react";
import { motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { useTheme } from "../components/ThemeProvider";
import {
  BookIcon,
  CheckIcon,
  ChevronRightIcon,
  DotIcon,
  InfoIcon,
  PersonIcon,
  SearchIcon,
  ShieldIcon,
  SupportIcon,
  WarningIcon
} from "../components/Icons";
import { runtimeConfig } from "../lib/runtimeConfig";
import {
  getDefaultSupportRequestValues,
  getFilteredSupportActions,
  getFilteredSupportDocs,
  getFilteredSupportFaqs,
  supportFaqItems,
  supportIssueTypeOptions,
  supportPriorityOptions,
  supportQuickActions,
  supportRequestSchema,
  toggleAccordionItem,
  type SupportQuickAction,
  type SupportRequestFormValues
} from "../lib/support";
import { getEffectiveRpcEndpoint, themeOptions } from "../lib/settings";
import { cx } from "../lib/utils";
import { useSettingsStore } from "../stores/settingsStore";

type SubmissionState = {
  summary: string;
  issueTypeLabel: string;
  priorityLabel: string;
};

type QuickActionIconKey = SupportQuickAction["icon"];

const actionIcons: Record<
  QuickActionIconKey,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  docs: BookIcon,
  support: SupportIcon,
  incident: WarningIcon,
  community: PersonIcon,
  security: ShieldIcon
};

function scrollToSection(sectionId: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function SupportSection({
  id,
  eyebrow,
  title,
  description,
  children
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="tm-shell-card scroll-mt-28 p-5 md:p-6" aria-labelledby={`${id}-title`}>
      <div className="border-b border-white/60 pb-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">
          {eyebrow}
        </div>
        <h2 id={`${id}-title`} className="mt-3 text-2xl font-semibold tracking-tight text-silk-text-primary">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-silk-text-secondary">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function QuickActionCard({
  action,
  onActivate
}: {
  action: SupportQuickAction;
  onActivate: (action: SupportQuickAction) => void;
}) {
  const Icon = actionIcons[action.icon];

  return (
    <button
      type="button"
      onClick={() => onActivate(action)}
      className="tm-focus-ring tm-control-surface group flex h-full flex-col rounded-[26px] p-5 text-left transition duration-200 hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="neo-pill flex h-11 w-11 items-center justify-center text-silk-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-silk-primary">
          {action.ctaLabel}
          <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <h3 className="mt-5 text-lg font-semibold text-silk-text-primary">{action.title}</h3>
      <p className="mt-2 text-sm leading-7 text-silk-text-secondary">{action.description}</p>
    </button>
  );
}

function DocumentationCard({
  title,
  summary,
  readingTime,
  highlights
}: {
  title: string;
  summary: string;
  readingTime: string;
  highlights: string[];
}) {
  return (
    <article className="tm-control-surface rounded-[26px] p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-silk-text-primary">{title}</h3>
        <span className="neo-pill shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-silk-primary">
          {readingTime}
        </span>
      </div>
      <p className="mt-3 text-sm leading-7 text-silk-text-secondary">{summary}</p>
      <ul className="mt-4 space-y-3">
        {highlights.map((highlight) => (
          <li key={highlight} className="flex gap-3 text-sm leading-7 text-silk-text-secondary">
            <span className="mt-1 text-silk-primary">
              <CheckIcon className="h-4 w-4" />
            </span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function FaqItem({
  item,
  open,
  onToggle
}: {
  item: (typeof supportFaqItems)[number];
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `${item.id}-panel`;
  const buttonId = `${item.id}-button`;

  return (
    <article className="tm-control-surface rounded-[24px] p-2">
      <h3>
        <button
          id={buttonId}
          type="button"
          className="tm-focus-ring flex w-full items-center justify-between gap-4 rounded-[18px] px-4 py-4 text-left"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="text-base font-semibold text-silk-text-primary">{item.question}</span>
          <span
            className={cx(
              "neo-pill flex h-9 w-9 shrink-0 items-center justify-center text-silk-primary transition-transform",
              open ? "rotate-90" : ""
            )}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={cx("overflow-hidden px-4 pb-4", open ? "block" : "hidden")}
      >
        <p className="rounded-[20px] bg-white/60 px-4 py-4 text-sm leading-7 text-silk-text-secondary">
          {item.answer}
        </p>
      </div>
    </article>
  );
}

function ResourceCard({
  id,
  icon,
  title,
  children
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="tm-control-surface rounded-[26px] p-5" aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="flex items-center gap-3">
        <span className="neo-pill flex h-11 w-11 items-center justify-center text-silk-primary">
          {icon}
        </span>
        <h3 id={id ? `${id}-title` : undefined} className="text-lg font-semibold text-silk-text-primary">
          {title}
        </h3>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Support() {
  const rpcPreset = useSettingsStore((state) => state.rpcPreset);
  const customRpcUrl = useSettingsStore((state) => state.customRpcUrl);
  const pollingIntervalMs = useSettingsStore((state) => state.pollingIntervalMs);
  const privacy = useSettingsStore((state) => state.privacy);
  const { resolvedTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(supportFaqItems[0]?.id ?? null);
  const [attachmentLabel, setAttachmentLabel] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const searchInputId = useId();
  const attachmentInputId = useId();
  const effectiveRpcEndpoint = getEffectiveRpcEndpoint(
    { rpcPreset, customRpcUrl },
    runtimeConfig.solanaRpcUrl
  );
  const themeLabel = themeOptions.find((option) => option.id === resolvedTheme)?.label ?? resolvedTheme;
  const filteredActions = useMemo(
    () => getFilteredSupportActions(deferredSearchQuery),
    [deferredSearchQuery]
  );
  const filteredDocs = useMemo(
    () => getFilteredSupportDocs(deferredSearchQuery),
    [deferredSearchQuery]
  );
  const filteredFaqs = useMemo(
    () => getFilteredSupportFaqs(deferredSearchQuery),
    [deferredSearchQuery]
  );

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<SupportRequestFormValues>({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: getDefaultSupportRequestValues()
  });
  const selectedIssueType = watch("issueType");
  const selectedPriority = watch("priority");
  const selectedIssueTypeHelp =
    supportIssueTypeOptions.find((option) => option.value === selectedIssueType)?.help ??
    supportIssueTypeOptions[0].help;
  const selectedPriorityHelp =
    supportPriorityOptions.find((option) => option.value === selectedPriority)?.help ??
    supportPriorityOptions[0].help;
  const securityAction = supportQuickActions.find((action) => action.id === "contact-security");

  const totalSearchMatches = filteredActions.length + filteredDocs.length + filteredFaqs.length;
  const hasSearchQuery = deferredSearchQuery.trim().length > 0;

  const onAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileName = event.target.files?.[0]?.name ?? "";
    setAttachmentLabel(fileName);
    setValue("attachmentName", fileName, { shouldValidate: true, shouldDirty: true });
  };

  const handleQuickAction = (action: SupportQuickAction) => {
    if (action.prefill) {
      for (const [key, value] of Object.entries(action.prefill)) {
        setValue(key as keyof SupportRequestFormValues, value, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true
        });
      }
    }

    scrollToSection(action.href);
  };

  const submitRequest = async (values: SupportRequestFormValues) => {
    const issueTypeLabel =
      supportIssueTypeOptions.find((option) => option.value === values.issueType)?.label ?? values.issueType;
    const priorityLabel =
      supportPriorityOptions.find((option) => option.value === values.priority)?.label ?? values.priority;

    setSubmissionState({
      summary:
        "Support request prepared locally. No backend support API is configured in this environment, so nothing was sent to a server.",
      issueTypeLabel,
      priorityLabel
    });

    setAttachmentLabel("");
    reset(getDefaultSupportRequestValues());
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] p-4 pb-24 md:p-6 lg:p-8">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-6">
        <section className="tm-shell-card tm-grid-bg overflow-hidden p-5 md:p-7 xl:p-8">
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)] 2xl:items-end">
            <div>
              <div className="tm-kicker">Support Hub</div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-silk-text-primary">
                  <DotIcon className="h-2.5 w-2.5 animate-ringPulse text-silk-status-complete" />
                  <span>Network operational</span>
                </div>
                <div className="neo-pill text-xs font-semibold uppercase tracking-[0.18em] text-silk-text-secondary">
                  Theme: {themeLabel}
                </div>
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-silk-text-primary md:text-5xl">
                Support &amp; Documentation
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-silk-text-secondary">
                Runbooks, incident workflows, and operator support for TrustMesh deployments, wallet
                authorization, AI coordination nodes, job telemetry, and RPC health.
              </p>
            </div>

            <div className="tm-control-surface rounded-[28px] p-5">
              <label htmlFor={searchInputId} className="text-sm font-semibold text-silk-text-secondary">
                Search the TrustMesh knowledge base
              </label>
              <div className="neo-inset mt-3 flex items-center gap-3 rounded-[22px] px-4 py-4">
                <SearchIcon className="h-5 w-5 shrink-0 text-silk-primary" />
                <input
                  id={searchInputId}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search wallets, nodes, deployments, RPC, security..."
                  className="tm-focus-ring w-full bg-transparent text-sm text-silk-text-primary outline-none placeholder:text-silk-text-tertiary"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="tm-focus-ring rounded-full px-3 py-1 text-xs font-semibold text-silk-primary"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] bg-white/60 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-silk-text-tertiary">
                    Docs sections
                  </div>
                  <div className="mt-2 text-lg font-semibold text-silk-text-primary">
                    {filteredDocs.length}
                  </div>
                </div>
                <div className="rounded-[20px] bg-white/60 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-silk-text-tertiary">
                    FAQ answers
                  </div>
                  <div className="mt-2 text-lg font-semibold text-silk-text-primary">
                    {filteredFaqs.length}
                  </div>
                </div>
                <div className="rounded-[20px] bg-white/60 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-silk-text-tertiary">
                    Workflows
                  </div>
                  <div className="mt-2 text-lg font-semibold text-silk-text-primary">
                    {filteredActions.length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {hasSearchQuery ? (
          totalSearchMatches > 0 ? (
            <div className="tm-control-surface rounded-[24px] px-5 py-4 text-sm leading-7 text-silk-text-secondary">
              Showing {totalSearchMatches} matches for{" "}
              <span className="font-semibold text-silk-text-primary">“{deferredSearchQuery.trim()}”</span>{" "}
              across docs, workflows, and FAQs.
            </div>
          ) : (
            <div className="tm-control-surface-muted rounded-[24px] px-5 py-5">
              <div className="text-sm font-semibold text-silk-text-primary">No exact help matches found.</div>
              <p className="mt-2 text-sm leading-7 text-silk-text-secondary">
                Try searching by wallet adapter, node id, deployment activation, RPC latency, or planner revocation.
                If the issue is still unclear, submit a support request with the affected job or wallet context.
              </p>
              <button
                type="button"
                className="tm-button-primary mt-4"
                onClick={() => scrollToSection("support-request-form")}
              >
                Open support form
              </button>
            </div>
          )
        ) : null}

        <section aria-labelledby="support-actions-title">
          <div className="mb-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">
              Quick actions
            </div>
            <h2 id="support-actions-title" className="mt-2 text-2xl font-semibold tracking-tight text-silk-text-primary">
              Resolve common TrustMesh tasks fast
            </h2>
          </div>
          {filteredActions.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {filteredActions.map((action) => (
                <QuickActionCard key={action.id} action={action} onActivate={handleQuickAction} />
              ))}
            </div>
          ) : (
            <div className="tm-control-surface-muted rounded-[24px] px-5 py-5 text-sm leading-7 text-silk-text-secondary">
              No quick actions matched this search. Try searching for a workflow category like incident, security,
              wallet, or deployment.
            </div>
          )}
        </section>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
          <div className="space-y-6">
            <SupportSection
              id="support-docs"
              eyebrow="Documentation"
              title="TrustMesh operator docs"
              description="Everything your team needs to onboard operators, stabilize deployments, and diagnose runtime drift without leaving the Explorer shell."
            >
              {filteredDocs.length > 0 ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredDocs.map((section) => (
                    <DocumentationCard
                      key={section.id}
                      title={section.title}
                      summary={section.summary}
                      readingTime={section.readingTime}
                      highlights={section.highlights}
                    />
                  ))}
                </div>
              ) : (
                <div className="tm-control-surface-muted rounded-[24px] px-5 py-5 text-sm leading-7 text-silk-text-secondary">
                  No documentation sections matched the current search. Try broader terms like node, analytics, or
                  RPC.
                </div>
              )}
            </SupportSection>

            <SupportSection
              id="support-faq"
              eyebrow="FAQ"
              title="Questions operators ask most"
              description="Answers tailored to the TrustMesh runtime, wallet flows, job lifecycle, node identity, and cluster behavior."
            >
              {filteredFaqs.length > 0 ? (
                <div className="space-y-3">
                  {filteredFaqs.map((item) => (
                    <FaqItem
                      key={item.id}
                      item={item}
                      open={expandedFaqId === item.id}
                      onToggle={() => setExpandedFaqId((currentId) => toggleAccordionItem(currentId, item.id))}
                    />
                  ))}
                </div>
              ) : (
                <div className="tm-control-surface-muted rounded-[24px] px-5 py-5 text-sm leading-7 text-silk-text-secondary">
                  No FAQ answers matched this search yet. Submit a request with the exact job, wallet, or node context
                  and we can route it through the right support workflow.
                </div>
              )}
            </SupportSection>
          </div>

          <div className="space-y-6 2xl:sticky 2xl:top-28 2xl:self-start">
            <SupportSection
              id="support-request-form"
              eyebrow="Support Request"
              title="Prepare a support handoff"
              description="Capture the operator, workload, and severity context needed for a future backend support workflow without pretending the request has already been transmitted."
            >
              {submissionState ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="tm-control-surface mb-5 rounded-[22px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-4"
                  aria-live="polite"
                >
                  <div className="text-sm font-semibold text-silk-text-primary">Support draft saved locally</div>
                  <p className="mt-2 text-sm leading-7 text-silk-text-secondary">{submissionState.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-silk-primary">
                    <span className="neo-pill">{submissionState.issueTypeLabel}</span>
                    <span className="neo-pill">{submissionState.priorityLabel}</span>
                  </div>
                </motion.div>
              ) : null}

              <form className="space-y-4" onSubmit={handleSubmit(submitRequest)} noValidate>
                <input type="hidden" {...register("attachmentName")} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="support-name" className="text-sm font-medium text-silk-text-secondary">
                      Name
                    </label>
                    <input
                      id="support-name"
                      type="text"
                      className="neo-input tm-focus-ring mt-3 rounded-[20px]"
                      placeholder="Primary operator or incident owner"
                      {...register("name")}
                    />
                    {errors.name ? (
                      <p className="mt-2 text-sm text-silk-status-revoked">{errors.name.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="support-email" className="text-sm font-medium text-silk-text-secondary">
                      Email
                    </label>
                    <input
                      id="support-email"
                      type="email"
                      className="neo-input tm-focus-ring mt-3 rounded-[20px]"
                      placeholder="operator@team.example"
                      {...register("email")}
                    />
                    {errors.email ? (
                      <p className="mt-2 text-sm text-silk-status-revoked">{errors.email.message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="support-issue-type" className="text-sm font-medium text-silk-text-secondary">
                      Issue type
                    </label>
                    <select
                      id="support-issue-type"
                      className="neo-input tm-focus-ring mt-3 rounded-[20px] pr-10"
                      {...register("issueType")}
                    >
                      {supportIssueTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-sm text-silk-text-tertiary">
                      {selectedIssueTypeHelp}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="support-priority" className="text-sm font-medium text-silk-text-secondary">
                      Priority
                    </label>
                    <select
                      id="support-priority"
                      className="neo-input tm-focus-ring mt-3 rounded-[20px] pr-10"
                      {...register("priority")}
                    >
                      {supportPriorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-sm text-silk-text-tertiary">
                      {selectedPriorityHelp}
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="support-wallet-node" className="text-sm font-medium text-silk-text-secondary">
                    Wallet address / node ID
                    <span className="ml-2 text-xs text-silk-text-tertiary">(optional)</span>
                  </label>
                  <input
                    id="support-wallet-node"
                    type="text"
                    className="neo-input tm-focus-ring mt-3 rounded-[20px] font-mono"
                    placeholder="Planner wallet, executor node id, or affected job owner"
                    {...register("walletAddressOrNodeId")}
                  />
                  {errors.walletAddressOrNodeId ? (
                    <p className="mt-2 text-sm text-silk-status-revoked">
                      {errors.walletAddressOrNodeId.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="support-description" className="text-sm font-medium text-silk-text-secondary">
                    Description
                  </label>
                  <textarea
                    id="support-description"
                    rows={6}
                    className="neo-input tm-focus-ring mt-3 rounded-[20px] resize-y"
                    placeholder="Describe the expected behavior, the actual result, what changed, and which deployment, job, or node was affected."
                    {...register("description")}
                  />
                  {errors.description ? (
                    <p className="mt-2 text-sm text-silk-status-revoked">{errors.description.message}</p>
                  ) : (
                    <p className="mt-2 text-sm text-silk-text-tertiary">
                      Include timestamps, cluster, planner node, and any wallet prompt or RPC errors you observed.
                    </p>
                  )}
                </div>

                <div className="tm-control-surface-muted rounded-[24px] px-4 py-4">
                  <label htmlFor={attachmentInputId} className="text-sm font-medium text-silk-text-secondary">
                    Attachment placeholder
                  </label>
                  <div className="mt-3 rounded-[20px] bg-white/60 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <label
                        htmlFor={attachmentInputId}
                        className="tm-focus-ring inline-flex cursor-pointer items-center justify-center rounded-full bg-silk-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
                      >
                        Choose file
                      </label>
                      <span className={cx("text-sm", attachmentLabel ? "break-all text-silk-text-primary" : "text-silk-text-tertiary")}>
                        {attachmentLabel || "No file chosen"}
                      </span>
                    </div>
                    <input
                      id={attachmentInputId}
                      type="file"
                      className="sr-only"
                      onChange={onAttachmentChange}
                    />
                    <p className="mt-3 text-sm leading-7 text-silk-text-tertiary">
                      Logs or screenshots stay local until a support upload API is connected.
                    </p>
                  </div>
                  {errors.attachmentName ? (
                    <p className="mt-2 text-sm text-silk-status-revoked">{errors.attachmentName.message}</p>
                  ) : null}
                </div>

                <div className="rounded-[24px] bg-white/60 px-4 py-4 text-sm leading-7 text-silk-text-secondary">
                  This form validates locally and prepares a future support payload. It does{" "}
                  <span className="font-semibold text-silk-text-primary">not</span> transmit data to a server in the
                  current environment.
                </div>

                <button type="submit" className="tm-button-primary w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Preparing request..." : "Submit support request"}
                </button>
              </form>
            </SupportSection>

            <div className="space-y-4">
              <ResourceCard
                icon={<InfoIcon className="h-5 w-5" />}
                title="Current system status"
              >
                <div className="grid gap-3">
                  <div className="rounded-[20px] bg-white/60 px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-silk-text-tertiary">
                      RPC endpoint
                    </div>
                    <div className="mt-2 break-all text-sm font-medium text-silk-text-primary">
                      {effectiveRpcEndpoint}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] bg-white/60 px-4 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-silk-text-tertiary">
                        Live transport
                      </div>
                      <div className="mt-2 text-sm font-medium text-silk-text-primary">
                        {runtimeConfig.enableRealtime ? "Websocket active" : "Polling only"}
                      </div>
                    </div>
                    <div className="rounded-[20px] bg-white/60 px-4 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-silk-text-tertiary">
                        Polling cadence
                      </div>
                      <div className="mt-2 text-sm font-medium text-silk-text-primary">
                        {(pollingIntervalMs / 1000).toFixed(0)} second refresh
                      </div>
                    </div>
                  </div>
                  <p className="text-sm leading-7 text-silk-text-secondary">
                    Operators using custom RPC infrastructure should keep wallet signing, mesh reads, and websocket
                    subscriptions on the same cluster to avoid split-brain diagnostics.
                  </p>
                </div>
              </ResourceCard>

              <ResourceCard
                icon={<SupportIcon className="h-5 w-5" />}
                title="SLA / response targets"
              >
                <div className="space-y-3 text-sm leading-7 text-silk-text-secondary">
                  <div className="rounded-[20px] bg-white/60 px-4 py-4">
                    <div className="font-semibold text-silk-text-primary">P1 critical incident</div>
                    <div>Initial response target: 15 minutes for production mesh outage or key compromise.</div>
                  </div>
                  <div className="rounded-[20px] bg-white/60 px-4 py-4">
                    <div className="font-semibold text-silk-text-primary">P2 degraded operations</div>
                    <div>Initial response target: 1 hour for failed deployments, stalled planners, or unsafe drift.</div>
                  </div>
                  <div className="rounded-[20px] bg-white/60 px-4 py-4">
                    <div className="font-semibold text-silk-text-primary">P3/P4 guidance</div>
                    <div>Same-day triage for integration issues and next-business-day review for documentation requests.</div>
                  </div>
                </div>
              </ResourceCard>

              <ResourceCard
                id="support-community"
                icon={<PersonIcon className="h-5 w-5" />}
                title="Community & support links"
              >
                <div className="space-y-3">
                  <div className="rounded-[20px] bg-white/60 px-4 py-4 text-sm leading-7 text-silk-text-secondary">
                    Shared operator channels are best for wallet adapter questions, rollout coordination, and release-note follow-ups. Avoid posting sensitive key material or unpatched security findings publicly.
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/explorer" className="tm-button-ghost px-5 py-3">
                      Open Explorer
                    </Link>
                    <Link to="/deploy" className="tm-button-ghost px-5 py-3">
                      Deployment Console
                    </Link>
                    <Link to="/settings" className="tm-button-ghost px-5 py-3">
                      Review RPC Settings
                    </Link>
                  </div>
                </div>
              </ResourceCard>

              <ResourceCard
                icon={<ShieldIcon className="h-5 w-5" />}
                title="Emergency contact / security disclosure"
              >
                <div className="space-y-3 text-sm leading-7 text-silk-text-secondary">
                  <div className="rounded-[20px] bg-white/60 px-4 py-4">
                    Treat leaked signer keys, unauthorized delegation, or unexplained node revocations as private disclosures.
                  </div>
                  <div className="rounded-[20px] bg-white/60 px-4 py-4">
                    Include the affected wallet or node id, blast radius, last known safe timestamp, and any signed proof that confirms reporter authority.
                  </div>
                  <div className="rounded-[20px] bg-white/60 px-4 py-4">
                    Public channels should only carry sanitized status updates after the immediate risk is contained.
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="tm-button-primary"
                      onClick={() => (securityAction ? handleQuickAction(securityAction) : scrollToSection("support-request-form"))}
                    >
                      Prepare security report
                    </button>
                  </div>
                </div>
              </ResourceCard>

              <ResourceCard
                icon={<BookIcon className="h-5 w-5" />}
                title="Operator guardrails"
              >
                <ul className="space-y-3 text-sm leading-7 text-silk-text-secondary">
                  <li className="rounded-[20px] bg-white/60 px-4 py-4">
                    Privacy masking for shared screens is currently{" "}
                    <span className="font-semibold text-silk-text-primary">
                      {privacy.maskWalletAddresses ? "enabled" : "disabled"}
                    </span>
                    ; adjust it in Settings before screen-sharing live wallet or node identifiers.
                  </li>
                  <li className="rounded-[20px] bg-white/60 px-4 py-4">
                    Keep planner rotation notes, RPC changes, and deployment ownership changes in the same incident timeline for faster triage.
                  </li>
                  <li className="rounded-[20px] bg-white/60 px-4 py-4">
                    Export logs before reconnecting a wallet or restarting a stalled deployment so the original failure evidence is preserved.
                  </li>
                </ul>
              </ResourceCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
