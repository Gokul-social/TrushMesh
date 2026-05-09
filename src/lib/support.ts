import { z } from "zod";

export const supportIssueTypeOptions = [
  {
    value: "documentation",
    label: "Documentation gap",
    help: "Missing or unclear operator guidance for wallets, nodes, or deployments."
  },
  {
    value: "wallet-access",
    label: "Wallet / access",
    help: "Connection, signing, or authority mapping issues for operator wallets."
  },
  {
    value: "node-operations",
    label: "Node operations",
    help: "Node registration, heartbeat, revocation, or lifecycle concerns."
  },
  {
    value: "deployment-failure",
    label: "Deployment failure",
    help: "A deployment could not initialize, activate, or hand off execution."
  },
  {
    value: "job-runtime",
    label: "Active job runtime",
    help: "Running jobs are stalled, inconsistent, or showing unexpected state."
  },
  {
    value: "rpc-network",
    label: "Network / RPC",
    help: "RPC latency, websocket drift, stale state, or endpoint reachability issues."
  },
  {
    value: "security-disclosure",
    label: "Security disclosure",
    help: "Suspected compromise, unsafe delegation path, or key exposure."
  }
] as const;

export const supportPriorityOptions = [
  {
    value: "p1",
    label: "P1 - Critical",
    help: "Production mesh outage, signing compromise, or broad deployment impact."
  },
  {
    value: "p2",
    label: "P2 - High",
    help: "Major user-facing degradation with a workaround unavailable or unsafe."
  },
  {
    value: "p3",
    label: "P3 - Normal",
    help: "Operational issue with limited blast radius or a stable workaround."
  },
  {
    value: "p4",
    label: "P4 - Advisory",
    help: "Documentation questions, UI polish, or optimization requests."
  }
] as const;

export type SupportIssueType = (typeof supportIssueTypeOptions)[number]["value"];
export type SupportPriority = (typeof supportPriorityOptions)[number]["value"];

export type SupportDocSection = {
  id: string;
  title: string;
  summary: string;
  readingTime: string;
  keywords: string[];
  highlights: string[];
};

export const supportDocSections: SupportDocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    summary:
      "Prepare operator access, verify runtime connectivity, and establish a clean TrustMesh session before launching your first coordination job.",
    readingTime: "4 min read",
    keywords: ["onboarding", "first run", "operator setup", "session", "runtime"],
    highlights: [
      "Verify the configured RPC endpoint before connecting a wallet so state snapshots line up with the active cluster.",
      "Use the Settings panel to confirm polling cadence, websocket behavior, and privacy defaults for your workstation.",
      "Create your first deployment only after wallet authority, cluster, and support preferences are aligned."
    ]
  },
  {
    id: "wallet-connection",
    title: "Wallet Connection",
    summary:
      "Connect a signing wallet, confirm delegated authority visibility, and troubleshoot adapter or namespace mismatches during operator login.",
    readingTime: "5 min read",
    keywords: ["wallet", "phantom", "signing", "authority", "sol name", "authentication"],
    highlights: [
      "TrustMesh shows the active wallet, resolved Sol Name when available, and disconnect actions in the shell header.",
      "If a wallet connects but the session stays unauthenticated, verify the browser approved the signature request and the JWT has not expired.",
      "For multi-operator environments, confirm the wallet has authority over the expected deployment owner or planner node."
    ]
  },
  {
    id: "node-management",
    title: "Node Management",
    summary:
      "Operate planner and executor nodes safely, track heartbeats, and understand when to revoke, rotate, or re-register node identities.",
    readingTime: "6 min read",
    keywords: ["node", "planner", "executor", "heartbeat", "revocation", "identity"],
    highlights: [
      "Planner nodes should retain stable authority while executor nodes can be rotated when runtime posture changes.",
      "Use node status and recent action timelines to separate stale telemetry from a true revocation event.",
      "Before re-registering a node, export the previous incident context so operators can preserve audit continuity."
    ]
  },
  {
    id: "deployments",
    title: "Deployments",
    summary:
      "Launch new TrustMesh jobs with the right authority chain, validate activation, and recover from initialization or signing failures.",
    readingTime: "7 min read",
    keywords: ["deploy", "deployment", "launch", "activation", "job", "authority chain"],
    highlights: [
      "A healthy deployment moves from draft intent to signed activation without wallet prompts timing out or versioned transactions failing.",
      "If a deployment stalls before activation, capture the wallet adapter error and the target cluster used during submission.",
      "Document the planner node, owner identity, and expected executor count before escalating production deployment incidents."
    ]
  },
  {
    id: "active-jobs",
    title: "Active Jobs",
    summary:
      "Monitor live job state, interpret mesh topology changes, and investigate executor stalls without losing context across live updates.",
    readingTime: "5 min read",
    keywords: ["active jobs", "runtime", "mesh", "topology", "executor", "job detail"],
    highlights: [
      "The Explorer highlights active, revoked, and complete job states so you can spot coordination drift quickly.",
      "When a node stops progressing, compare the live graph with the event timeline before restarting a deployment path.",
      "Use job detail exports when handing an incident from operators to engineering or security reviewers."
    ]
  },
  {
    id: "analytics",
    title: "Analytics",
    summary:
      "Read throughput, breach counts, and latency trends with enough context to distinguish real incidents from sampling or polling noise.",
    readingTime: "4 min read",
    keywords: ["analytics", "telemetry", "throughput", "latency", "breaches", "metrics"],
    highlights: [
      "Track unauthorized action counts alongside deployment throughput to understand whether failures are systemic or isolated.",
      "Sampling windows should match your polling interval so apparent traffic gaps are not misread as execution downtime.",
      "Escalate analytics discrepancies when the graph, job timeline, and counters disagree for more than one refresh cycle."
    ]
  },
  {
    id: "network-rpc",
    title: "Network / RPC",
    summary:
      "Validate cluster reachability, websocket freshness, and endpoint performance for TrustMesh operators managing live coordination workloads.",
    readingTime: "6 min read",
    keywords: ["rpc", "network", "websocket", "latency", "endpoint", "cluster"],
    highlights: [
      "Use a consistent RPC source for wallet actions, job polling, and websocket updates to avoid cross-cluster confusion.",
      "High confirmation latency can present as missing graph updates even when planner nodes are still healthy.",
      "When using a custom RPC, record the provider and region in support requests so incident triage can reproduce behavior."
    ]
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    summary:
      "Work through the most common TrustMesh operator failures, from stale sessions and signer prompts to node drift and mismatched clusters.",
    readingTime: "8 min read",
    keywords: ["troubleshooting", "debug", "stuck", "retry", "errors", "diagnostics"],
    highlights: [
      "Refresh the operator session only after noting the current job state so you can tell whether behavior changed or the UI simply resynced.",
      "If live updates look stale, compare websocket diagnostics with the configured polling interval before assuming data loss.",
      "Collect wallet, node, and RPC identifiers together; isolated screenshots slow incident resolution."
    ]
  },
  {
    id: "security-best-practices",
    title: "Security Best Practices",
    summary:
      "Protect signing authority, minimize blast radius, and report suspicious delegation or node behavior with the right operational evidence.",
    readingTime: "7 min read",
    keywords: ["security", "best practices", "delegation", "keys", "disclosure", "revocation"],
    highlights: [
      "Use dedicated operator wallets for production deployments and keep experimental planners on separate authority paths.",
      "Rotate or revoke nodes immediately if delegation chains change unexpectedly or executor provenance cannot be verified.",
      "Security reports move faster when they include timestamps, affected job ids, and signed proof of wallet ownership."
    ]
  }
];

export type SupportFaqItem = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
};

export const supportFaqItems: SupportFaqItem[] = [
  {
    id: "faq-wallet-signed-but-no-session",
    question: "Why does TrustMesh show my wallet as connected but still block deployment actions?",
    answer:
      "A connected wallet only confirms the adapter session. Deployment actions also require a valid authenticated session and a wallet authority that matches the deployment owner path. Reconnect the wallet, approve any pending signature prompt, and verify you are on the expected cluster before retrying.",
    keywords: ["wallet", "connected", "deployment", "authentication", "session"]
  },
  {
    id: "faq-job-stuck-active",
    question: "What should I check when a job stays Active but no executor updates are arriving?",
    answer:
      "Start with the current RPC endpoint and websocket health. If the endpoint is slow or stale, the graph can stop refreshing while the job still exists on-chain. Next confirm the planner node is still authorized, then inspect recent messages and node status changes before restarting anything.",
    keywords: ["active job", "executor", "websocket", "rpc", "stale"]
  },
  {
    id: "faq-revoked-node",
    question: "A node suddenly shows Revoked. Is that always a security event?",
    answer:
      "Not always. Revoked can also follow intentional operator action, authority rotation, or cluster confusion between environments. Treat it as a security-sensitive event until you verify who initiated the change, when it happened, and whether related deployments were impacted.",
    keywords: ["revoked", "node", "security", "rotation", "authority"]
  },
  {
    id: "faq-versioned-transaction",
    question: "How do I handle a wallet that cannot sign versioned transactions during deployment?",
    answer:
      "That usually means the wallet adapter or wallet version lacks the capability required by the deployment flow. Upgrade the wallet, reconnect, and retry on the same cluster. Include the wallet name and exact signing error in the support request if the issue persists.",
    keywords: ["versioned transaction", "wallet", "signing", "deployment"]
  },
  {
    id: "faq-analytics-breach",
    question: "Why did the analytics counters report breaches even though the job completed successfully?",
    answer:
      "Unauthorized action counters can increase during transient policy violations that were later blocked or corrected. Compare the breach count with the job timeline and exported event payloads before deciding whether the result was benign drift or a real policy incident.",
    keywords: ["analytics", "breaches", "policy", "job completed"]
  },
  {
    id: "faq-custom-rpc",
    question: "What information should I include when reporting issues on a custom RPC endpoint?",
    answer:
      "Include the endpoint region or provider, whether websockets are enabled, the observed latency window, and the job or node ids affected. That context helps separate provider-specific lag from TrustMesh application behavior.",
    keywords: ["custom rpc", "provider", "latency", "endpoint"]
  },
  {
    id: "faq-security-disclosure",
    question: "What makes a strong TrustMesh security disclosure?",
    answer:
      "A useful report includes the affected wallet or node identity, timestamps, reproduction steps, blast radius, and any signed proof that confirms you control the reporting authority. If exploitation is ongoing, mark the request P1 and avoid posting the details in shared community channels.",
    keywords: ["security", "disclosure", "p1", "authority", "report"]
  }
];

export type SupportQuickAction = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  target: "section" | "route" | "form-prefill";
  href: string;
  icon:
    | "docs"
    | "support"
    | "incident"
    | "community"
    | "security";
  keywords: string[];
  prefill?: Partial<SupportRequestFormValues>;
};

export const supportQuickActions: SupportQuickAction[] = [
  {
    id: "read-documentation",
    title: "Read Documentation",
    description:
      "Jump into operator runbooks covering wallet authority, deployments, node lifecycle, and RPC diagnostics.",
    ctaLabel: "Open docs map",
    target: "section",
    href: "support-docs",
    icon: "docs",
    keywords: ["docs", "runbook", "operator", "guide", "wallet", "deployment"]
  },
  {
    id: "submit-support-request",
    title: "Submit Support Request",
    description:
      "Prepare a detailed support brief with issue type, severity, node or wallet context, and diagnostic notes.",
    ctaLabel: "Open request form",
    target: "section",
    href: "support-request-form",
    icon: "support",
    keywords: ["support", "request", "ticket", "issue", "help"]
  },
  {
    id: "report-incident",
    title: "Report an Incident",
    description:
      "Escalate live mesh outages, stalled deployments, or suspicious node behavior with incident-ready guidance.",
    ctaLabel: "Escalate incident",
    target: "form-prefill",
    href: "support-request-form",
    icon: "incident",
    keywords: ["incident", "outage", "p1", "escalation", "runtime"],
    prefill: {
      issueType: "job-runtime",
      priority: "p1"
    }
  },
  {
    id: "join-community",
    title: "Join Community",
    description:
      "Find operator support channels, release-note habits, and escalation expectations before joining shared discussions.",
    ctaLabel: "View community resources",
    target: "section",
    href: "support-community",
    icon: "community",
    keywords: ["community", "operator", "release notes", "discussion", "support channels"]
  },
  {
    id: "contact-security",
    title: "Contact Security",
    description:
      "Review the disclosure checklist for compromised wallets, unsafe delegation, or suspected policy bypass.",
    ctaLabel: "Open security guidance",
    target: "form-prefill",
    href: "support-request-form",
    icon: "security",
    keywords: ["security", "disclosure", "compromise", "wallet", "delegation"],
    prefill: {
      issueType: "security-disclosure",
      priority: "p1"
    }
  }
];

export type SearchableSupportItem = {
  id: string;
  title: string;
  body: string[];
};

function includesQuery(query: string, fields: string[]) {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  return fields.some((field) => field.toLowerCase().includes(normalizedQuery));
}

export function filterSearchableItems<T extends SearchableSupportItem>(
  items: T[],
  query: string
) {
  return items.filter((item) => includesQuery(query, [item.title, ...item.body]));
}

export function getFilteredSupportDocs(query: string) {
  return filterSearchableItems(
    supportDocSections.map((section) => ({
      id: section.id,
      title: section.title,
      body: [section.summary, section.readingTime, ...section.keywords, ...section.highlights],
      section
    })),
    query
  ).map((item) => item.section);
}

export function getFilteredSupportFaqs(query: string) {
  return filterSearchableItems(
    supportFaqItems.map((item) => ({
      id: item.id,
      title: item.question,
      body: [item.answer, ...item.keywords],
      faq: item
    })),
    query
  ).map((item) => item.faq);
}

export function getFilteredSupportActions(query: string) {
  return filterSearchableItems(
    supportQuickActions.map((item) => ({
      id: item.id,
      title: item.title,
      body: [item.description, item.ctaLabel, ...item.keywords],
      action: item
    })),
    query
  ).map((item) => item.action);
}

export function toggleAccordionItem(currentId: string | null, nextId: string) {
  return currentId === nextId ? null : nextId;
}

export const supportRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the primary operator name for this request."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email for the operator or on-call owner."),
  issueType: z.enum(supportIssueTypeOptions.map((option) => option.value) as [
    SupportIssueType,
    ...SupportIssueType[]
  ]),
  priority: z.enum(supportPriorityOptions.map((option) => option.value) as [
    SupportPriority,
    ...SupportPriority[]
  ]),
  walletAddressOrNodeId: z
    .string()
    .trim()
    .max(120, "Keep the wallet address or node id under 120 characters.")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .trim()
    .min(24, "Describe what happened, what you expected, and which job or node was affected.")
    .max(2_000, "Keep the incident summary under 2,000 characters."),
  attachmentName: z
    .string()
    .trim()
    .max(180, "Attachment names should stay under 180 characters.")
    .optional()
    .or(z.literal(""))
});

export type SupportRequestFormValues = z.infer<typeof supportRequestSchema>;

export function getDefaultSupportRequestValues(): SupportRequestFormValues {
  return {
    name: "",
    email: "",
    issueType: "documentation",
    priority: "p3",
    walletAddressOrNodeId: "",
    description: "",
    attachmentName: ""
  };
}

export function validateSupportRequest(values: SupportRequestFormValues) {
  const parsed = supportRequestSchema.safeParse(values);
  if (parsed.success) {
    return {
      success: true as const,
      data: parsed.data
    };
  }

  return {
    success: false as const,
    errors: parsed.error.flatten().fieldErrors
  };
}
