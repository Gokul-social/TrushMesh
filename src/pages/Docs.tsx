import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Highlight, themes } from "prism-react-renderer";
import { Link } from "react-router-dom";
import { CheckIcon, ChevronRightIcon, InfoIcon, RocketIcon, ShieldIcon, WarningIcon } from "../components/Icons";
import { useTheme } from "../components/ThemeProvider";
import { isDarkTheme } from "../lib/settings";
import { cx } from "../lib/utils";

type SectionKey =
  | "getting-started"
  | "core-concepts"
  | "api-reference"
  | "guides"
  | "troubleshooting";

type PageKey =
  | "quick-start"
  | "deploy-your-first-job"
  | "understanding-agents"
  | "video-tutorial"
  | "agent-identity-sol-names"
  | "delegation-logs"
  | "revocation-cascades"
  | "the-force-graph"
  | "rest-endpoints"
  | "websocket-events"
  | "agent-runtime"
  | "error-codes"
  | "portfolio-rebalancer-demo"
  | "custom-agent-types"
  | "integrating-with-protocols"
  | "security-best-practices"
  | "common-errors"
  | "rpc-issues"
  | "wallet-problems";

type DocsContext = {
  goToPage: (page: PageKey) => void;
};

type DocsPageDefinition = {
  title: string;
  render: (context: DocsContext) => ReactNode;
};

type DocsSectionDefinition = {
  id: SectionKey;
  title: string;
  pages: Array<{ id: PageKey; label: string }>;
};

type CalloutType = "info" | "warning" | "tip";

type CodeBlockProps = {
  code: string;
  language: string;
  title?: string;
};

type ApiEndpointCardProps = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  requestSchema?: string;
  responseSchema?: string;
};

const docsSections: DocsSectionDefinition[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    pages: [
      { id: "quick-start", label: "Quick Start" },
      { id: "deploy-your-first-job", label: "Deploy Your First Job" },
      { id: "understanding-agents", label: "Understanding Agents" },
      { id: "video-tutorial", label: "Video Tutorial" }
    ]
  },
  {
    id: "core-concepts",
    title: "Core Concepts",
    pages: [
      { id: "agent-identity-sol-names", label: "Agent Identity & .sol Names" },
      { id: "delegation-logs", label: "Delegation Logs" },
      { id: "revocation-cascades", label: "Revocation & Cascades" },
      { id: "the-force-graph", label: "The Force Graph" }
    ]
  },
  {
    id: "api-reference",
    title: "API Reference",
    pages: [
      { id: "rest-endpoints", label: "REST Endpoints" },
      { id: "websocket-events", label: "WebSocket Events" },
      { id: "agent-runtime", label: "Agent Runtime" },
      { id: "error-codes", label: "Error Codes" }
    ]
  },
  {
    id: "guides",
    title: "Guides",
    pages: [
      { id: "portfolio-rebalancer-demo", label: "Portfolio Rebalancer Demo" },
      { id: "custom-agent-types", label: "Custom Agent Types" },
      { id: "integrating-with-protocols", label: "Integrating with Protocols" },
      { id: "security-best-practices", label: "Security Best Practices" }
    ]
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    pages: [
      { id: "common-errors", label: "Common Errors" },
      { id: "rpc-issues", label: "RPC Issues" },
      { id: "wallet-problems", label: "Wallet Problems" }
    ]
  }
];

function DocsH2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-8 text-[20px] font-semibold tracking-tight text-silk-text-primary first:mt-0">
      {children}
    </h2>
  );
}

function DocsH3({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 id={id} className="mt-6 text-[16px] font-semibold text-silk-text-primary">
      {children}
    </h3>
  );
}

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm leading-8 text-silk-text-secondary">{children}</p>;
}

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-sm leading-7 text-silk-text-secondary">
          <span className="mt-1.5 h-2 w-2 rounded-full bg-silk-primary" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-4 space-y-3">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-sm leading-7 text-silk-text-secondary">
          <span className="neo-pill flex h-7 w-7 shrink-0 items-center justify-center px-0 py-0 text-[11px] font-bold text-silk-primary">
            {index + 1}
          </span>
          <span className="min-w-0 pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Callout({ type, children }: { type: CalloutType; children: ReactNode }) {
  const config =
    type === "warning"
      ? {
          icon: WarningIcon,
          label: "Warning",
          border: "rgb(var(--tm-color-status-warning))"
        }
      : type === "tip"
        ? {
            icon: CheckIcon,
            label: "Tip",
            border: "rgb(var(--tm-color-status-complete))"
          }
        : {
            icon: InfoIcon,
            label: "Info",
            border: "rgb(var(--tm-color-primary))"
          };
  const Icon = config.icon;

  return (
    <div
      className="neo-inset mt-5 rounded-[24px] px-5 py-5"
      style={{ borderLeft: `4px solid ${config.border}` }}
    >
      <div className="flex items-center gap-3">
        <span className="neo-pill flex h-10 w-10 items-center justify-center px-0 py-0 text-silk-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">
          {config.label}
        </div>
      </div>
      <div className="mt-3 text-sm leading-7 text-silk-text-secondary">{children}</div>
    </div>
  );
}

function CodeBlock({ code, language, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const theme = useMemo(
    () => (isDarkTheme(resolvedTheme) ? themes.oneDark : themes.oneLight),
    [resolvedTheme]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="neo-inset mt-5 overflow-hidden rounded-[24px]">
      <div className="flex items-center justify-between border-b border-white/50 px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-silk-text-tertiary">
          {title ?? language}
        </div>
        <button
          type="button"
          className="neo-button rounded-full px-3 py-2 text-[11px] font-semibold text-silk-primary"
          onClick={() => void handleCopy()}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <Highlight theme={theme} code={code.trim()} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cx(className, "m-0 overflow-x-auto px-4 py-4 font-mono text-[13px] leading-7")}
            style={{
              ...style,
              background: "transparent"
            }}
          >
            {tokens.map((line, index) => (
              <div key={index} {...getLineProps({ line })}>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

function ApiEndpointCard({
  method,
  path,
  description,
  requestSchema,
  responseSchema
}: ApiEndpointCardProps) {
  const [expanded, setExpanded] = useState(false);
  const methodStyle =
    method === "POST"
      ? "bg-emerald-500/15 text-emerald-600"
      : method === "PATCH"
        ? "bg-amber-500/15 text-amber-600"
        : method === "DELETE"
          ? "bg-rose-500/15 text-rose-600"
          : "bg-indigo-500/15 text-indigo-600";

  return (
    <div className="tm-shell-card px-5 py-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cx(
                "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]",
                methodStyle
              )}
            >
              {method}
            </span>
            <code className="font-mono text-[13px] text-silk-text-primary">{path}</code>
          </div>
          <Paragraph>{description}</Paragraph>
        </div>
        {(requestSchema || responseSchema) ? (
          <button
            type="button"
            className="neo-button inline-flex items-center gap-2 rounded-full px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-silk-primary"
            onClick={() => setExpanded((value) => !value)}
          >
            <span>{expanded ? "Hide schema" : "View schema"}</span>
            <ChevronRightIcon className={cx("h-4 w-4 transition", expanded && "rotate-90")} />
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {requestSchema ? <CodeBlock title="Request" language="json" code={requestSchema} /> : null}
          {responseSchema ? <CodeBlock title="Response" language="json" code={responseSchema} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ComparisonTable({
  columns,
  rows
}: {
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="tm-shell-card mt-5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-white/60">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-4 text-left text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex < rows.length - 1 ? "border-b border-white/40" : ""}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className="px-4 py-4 align-top text-sm leading-7 text-silk-text-secondary"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const docPages: Record<PageKey, DocsPageDefinition> = {
  "quick-start": {
    title: "Quick Start",
    render: ({ goToPage }) => (
      <>
        <Paragraph>Get started with TrustMesh in under 5 minutes.</Paragraph>

        <DocsH2>What is TrustMesh?</DocsH2>
        <Paragraph>
          TrustMesh gives every AI agent a verified <code className="font-mono text-silk-primary">.sol</code> identity on
          Solana. Every inter-agent delegation is signed with Ed25519 and logged permanently on-chain. Humans maintain
          full control with one-click revocation that cascades to all child agents.
        </Paragraph>

        <DocsH2>Prerequisites</DocsH2>
        <BulletList
          items={[
            <>A Solana wallet (Phantom, Backpack, Solflare, etc.)</>,
            <>
              Devnet SOL for gas fees. Use{" "}
              <a
                href="https://faucet.solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-silk-primary"
              >
                Get Devnet SOL
              </a>
              .
            </>,
            <>
              Optional: A <code className="font-mono text-silk-primary">.sol</code> domain name from{" "}
              <a
                href="https://naming.bonfida.org"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-silk-primary"
              >
                SNS
              </a>
              .
            </>
          ]}
        />

        <DocsH2>Step 1: Connect Your Wallet</DocsH2>
        <Paragraph>Click <strong>Connect Wallet</strong> in the top right corner. TrustMesh will:</Paragraph>
        <NumberedList
          items={[
            <>Request wallet connection permission</>,
            <>Automatically resolve your <code className="font-mono text-silk-primary">.sol</code> name if you have one</>,
            <>Display your identity in the nav bar</>
          ]}
        />

        <DocsH2>Step 2: Navigate to Deployer</DocsH2>
        <Paragraph>
          Click <strong>Deployer</strong> in the left sidebar or use the route directly from the app shell.
        </Paragraph>

        <DocsH2>Step 3: Configure Your Job</DocsH2>
        <Paragraph>Fill in the job details:</Paragraph>
        <BulletList
          items={[
            <>
              <strong>Job Description</strong>: What should your agents accomplish? For example,{" "}
              <span className="italic">"Rebalance SOL/USDC portfolio to 60/40"</span>
            </>,
            <>
              <strong>Template</strong>: Choose from Portfolio Rebalancer, DAO Voter, or Data Fetcher.
            </>,
            <>
              <strong>Budget</strong>: Maximum SOL this job can spend. The current deployer defaults to a small Devnet-friendly
              budget.
            </>
          ]}
        />

        <DocsH2>Step 4: Assign Agent Identities</DocsH2>
        <Paragraph>Each agent gets a <code className="font-mono text-silk-primary">.sol</code> sub-name under your domain:</Paragraph>
        <BulletList
          items={[
            <>
              <strong>Planner agent</strong>: <code className="font-mono text-silk-primary">planner.yourdomain.sol</code>
            </>,
            <>
              <strong>Executor agents</strong>: <code className="font-mono text-silk-primary">executor.yourdomain.sol</code>,{" "}
              <code className="font-mono text-silk-primary">executor2.yourdomain.sol</code>, and so on
            </>
          ]}
        />

        <Paragraph>The live preview on the right side of the deployer shows your agent hierarchy as you type.</Paragraph>

        <Callout type="tip">
          Sub-names can only contain lowercase letters, numbers, and hyphens, and they must stay within 1-32 characters.
        </Callout>

        <DocsH2>Step 5: Deploy to Solana</DocsH2>
        <Paragraph>
          Click <strong>Deploy to Solana</strong>. Your wallet will prompt you to sign the job initialization transaction, then
          TrustMesh will activate the job and reconcile the planner and executor identities.
        </Paragraph>
        <NumberedList
          items={[
            <>Job initialization creates the job account on-chain.</>,
            <>Planner and executor identities are created in the backend and validated against SNS naming rules.</>,
            <>After confirmation, the UI redirects you to the Job Detail page so you can watch execution in real time.</>
          ]}
        />

        <Callout type="info">
          On Devnet this usually completes in roughly 5-10 seconds. If it takes longer, check the wallet prompt, cluster selection,
          and RPC responsiveness before retrying.
        </Callout>

        <DocsH2>What&apos;s Next?</DocsH2>
        <BulletList
          items={[
            <>
              Watch the{" "}
              <button
                type="button"
                className="font-semibold text-silk-primary"
                onClick={() => goToPage("video-tutorial")}
              >
                Video Tutorial
              </button>{" "}
              for a visual walkthrough.
            </>,
            <>
              Read{" "}
              <button
                type="button"
                className="font-semibold text-silk-primary"
                onClick={() => goToPage("understanding-agents")}
              >
                Understanding Agents
              </button>{" "}
              to learn how the hierarchy works.
            </>,
            <>
              Try the{" "}
              <button
                type="button"
                className="font-semibold text-silk-primary"
                onClick={() => goToPage("portfolio-rebalancer-demo")}
              >
                Portfolio Rebalancer Demo
              </button>{" "}
              once you are comfortable with the deployer.
            </>
          ]}
        />
      </>
    )
  },
  "deploy-your-first-job": {
    title: "Deploy Your First Job",
    render: () => (
      <>
        <Paragraph>
          The deployer is a three-step workflow that turns operator intent into an on-chain job plus a verified agent hierarchy.
        </Paragraph>

        <DocsH2>Deployment Checklist</DocsH2>
        <BulletList
          items={[
            <>Confirm your wallet is connected to the same cluster your backend and RPC are using.</>,
            <>Make sure your parent wallet resolves to a valid <code className="font-mono text-silk-primary">.sol</code> name.</>,
            <>Prepare planner and executor sub-names before starting if you want deterministic naming.</>,
            <>Keep a small budget for Devnet dry-runs before moving to larger production budgets.</>
          ]}
        />

        <DocsH2>Example Deployment Payload</DocsH2>
        <CodeBlock
          language="json"
          title="Create Job Payload"
          code={`
{
  "onchainId": "6d4e4c0f8f7bb931ef571e16db6fd0b484f80b1fcb5619392f6ab08f0f17de31",
  "description": "Rebalance SOL/USDC portfolio to 60/40 using bounded trade size and explicit confirmation.",
  "template": "PORTFOLIO_REBALANCER",
  "budgetSol": 0.05,
  "plannerSubName": "planner",
  "executorSubNames": ["executor", "confirmer"]
}
          `}
        />

        <DocsH2>Deployment Phases</DocsH2>
        <NumberedList
          items={[
            <>Configure job intent, template, and budget.</>,
            <>Validate SNS sub-names against the current owner namespace.</>,
            <>Sign the initialization transaction in the wallet.</>,
            <>Create the backend job record and reconcile agents.</>,
            <>Activate the job and open the live detail view.</>
          ]}
        />

        <DocsH2>What the UI Is Checking</DocsH2>
        <ComparisonTable
          columns={["Field", "Validation", "Why It Matters"]}
          rows={[
            ["Description", "Minimum length and non-empty intent", "Prevents ambiguous jobs and helps audit readability."],
            ["Template", "Known enum value", "Ensures the runtime understands the workflow category."],
            ["Budget", "0.01-100 SOL in the current deployer", "Keeps jobs bounded and prevents obvious misconfiguration."],
            ["Planner sub-name", "SNS-compatible, lowercase, digits, hyphens", "Guarantees deterministic identity creation."],
            ["Executor sub-names", "Same SNS validation as planner", "Prevents activation with unresolvable child identities."]
          ]}
        />

        <Callout type="tip">
          Keep your first deployment small: one planner and one executor is enough to verify wallet auth, RPC quality, and live graph updates.
        </Callout>
      </>
    )
  },
  "understanding-agents": {
    title: "Understanding Agents",
    render: () => (
      <>
        <DocsH2>What is an Agent?</DocsH2>
        <Paragraph>
          In TrustMesh, an <strong>agent</strong> is an autonomous program with:
        </Paragraph>
        <NumberedList
          items={[
            <>
              A verified <code className="font-mono text-silk-primary">.sol</code> identity registered on Solana Name Service
            </>,
            <>A unique wallet used for signing actions</>,
            <>A parent that is either a human owner or another agent</>,
            <>An action log where every decision is recorded on-chain</>
          ]}
        />

        <Paragraph>
          Agents coordinate by <strong>delegating</strong> tasks to other agents. Every delegation is signed and logged, creating
          an immutable audit trail.
        </Paragraph>

        <DocsH2>Agent Types</DocsH2>
        <ComparisonTable
          columns={["Type", "Role", "Example Actions"]}
          rows={[
            ["Planner", "Orchestrates strategy", "Fetch current portfolio balance; calculate optimal allocation"],
            ["Executor", "Performs on-chain actions", "Swap 2.5 SOL for USDC; submit governance vote"],
            ["Analyzer", "Researches and reports", "Analyze protocol risks; monitor gas prices"],
            ["Trader", "DeFi-specific execution", "Place limit order; provide liquidity"],
            ["Confirmer", "Validates results", "Verify swap completed; confirm balance updated"]
          ]}
        />

        <DocsH2>Agent Hierarchy</DocsH2>
        <Paragraph>Agents form a tree structure:</Paragraph>
        <CodeBlock
          language="text"
          title="Agent Tree"
          code={`
Human Owner (alice.sol)
  └─ Planner (planner.alice.sol)
      ├─ Executor (executor.alice.sol)
      └─ Confirmer (confirmer.alice.sol)
          `}
        />

        <BulletList
          items={[
            <>The root is always a human wallet.</>,
            <>Agents can spawn child agents for sub-tasks.</>,
            <>Revoking a parent cascades to all descendants.</>
          ]}
        />

        <DocsH2>Agent Lifecycle</DocsH2>
        <ComparisonTable
          columns={["State", "Meaning", "Operational Effect"]}
          rows={[
            ["Spawn", "Human signs a transaction creating the agent on-chain", "Identity becomes visible to the UI and runtime."],
            ["Active", "Agent can sign delegations and execute actions", "Normal operating state."],
            ["Warning", "Agent triggered a safety threshold or review condition", "Operators should inspect before continuing."],
            ["Revoked", "Agent signing authority is permanently removed", "No new actions should be accepted."],
            ["Complete", "Agent finished its job successfully", "Execution can be archived or exported."]
          ]}
        />

        <DocsH2>How Agents Communicate</DocsH2>
        <Paragraph>When Agent A delegates to Agent B:</Paragraph>
        <NumberedList
          items={[
            <>Agent A creates a message such as <span className="font-mono text-silk-primary">Fetch SOL/USDC price</span>.</>,
            <>Agent A signs the message with Ed25519 using its wallet.</>,
            <>Agent A submits a delegation log transaction to Solana.</>,
            <>The backend verifies the signature and stores the message.</>,
            <>The graph updates in real time via WebSocket.</>
          ]}
        />

        <Paragraph>Every message is immutable. Once logged, it cannot be altered or deleted.</Paragraph>

        <DocsH2>Security Model</DocsH2>
        <BulletList
          items={[
            <>Agents cannot impersonate each other because every agent has a unique wallet.</>,
            <>Agents cannot exceed their job&apos;s budget because the budget is bounded by job configuration and enforced operationally.</>,
            <>Agents cannot continue after revocation because status is verified before actions are accepted.</>,
            <>Humans can audit the full decision tree at any time from the graph and the coordination log.</>
          ]}
        />

        <Callout type="tip">
          The current deployer provisions planner and executor roles first, but the data model also supports analyzer, trader, and confirmer agents for richer runtimes.
        </Callout>
      </>
    )
  },
  "video-tutorial": {
    title: "Video Tutorial",
    render: ({ goToPage }) => (
      <>
        <Paragraph>
          Use this chapter guide while recording internal onboarding videos or walking a new operator through the product live.
        </Paragraph>

        <DocsH2>Suggested 12-Minute Walkthrough</DocsH2>
        <ComparisonTable
          columns={["Timestamp", "Focus", "Operator Outcome"]}
          rows={[
            ["00:00-01:30", "Wallet connection and identity resolution", "Understands how TrustMesh maps wallets to readable names."],
            ["01:30-04:30", "Deployer configuration", "Can create a job with a sensible description, template, and budget."],
            ["04:30-06:30", "Planner and executor naming", "Sees how sub-names create the tree structure."],
            ["06:30-09:00", "Job detail graph and coordination log", "Learns how to inspect live agent behavior."],
            ["09:00-10:30", "Revocation flow", "Understands emergency stop and cascaded shutdowns."],
            ["10:30-12:00", "Exporting logs and debugging failures", "Knows where to find evidence for incident review."]
          ]}
        />

        <DocsH2>What to Narrate Clearly</DocsH2>
        <BulletList
          items={[
            <>Why a human wallet always sits at the root of the hierarchy.</>,
            <>Why SNS-compatible sub-names matter for resolution and signature verification.</>,
            <>How to tell the difference between a UI refresh issue and a real on-chain failure.</>,
            <>Why exported logs should be captured before retrying a failed run.</>
          ]}
        />

        <Callout type="info">
          If you are making a customer-facing walkthrough, use a Devnet wallet and keep privacy masking enabled before showing live identities on screen.
        </Callout>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="tm-button-primary" onClick={() => goToPage("quick-start")}>
            Revisit Quick Start
          </button>
          <Link to="/deploy" className="tm-button-ghost">
            Open Deployer
          </Link>
        </div>
      </>
    )
  },
  "agent-identity-sol-names": {
    title: "Agent Identity & .sol Names",
    render: () => (
      <>
        <Paragraph>
          TrustMesh uses Solana Name Service to turn wallets and agent namespaces into readable identities that operators can audit quickly.
        </Paragraph>

        <DocsH2>Identity Structure</DocsH2>
        <CodeBlock
          language="text"
          title="Namespace Pattern"
          code={`
owner.sol
planner.owner.sol
executor.owner.sol
confirmer.owner.sol
          `}
        />

        <DocsH2>Naming Rules</DocsH2>
        <BulletList
          items={[
            <>Sub-names are lowercase-only.</>,
            <>Digits and hyphens are allowed.</>,
            <>Maximum length is 32 characters.</>,
            <>Planner and executor sub-names are validated before the job is created.</>
          ]}
        />

        <DocsH2>Why Readable Names Matter</DocsH2>
        <BulletList
          items={[
            <>Operators can review delegation paths without decoding raw public keys.</>,
            <>Support incidents move faster when planner and executor names are already human-readable.</>,
            <>Log exports stay meaningful after the original dashboard session ends.</>
          ]}
        />

        <Callout type="warning">
          A connected wallet without a resolvable owner name cannot complete the current deployment flow, because sub-name validation depends on the parent namespace.
        </Callout>
      </>
    )
  },
  "delegation-logs": {
    title: "Delegation Logs",
    render: () => (
      <>
        <Paragraph>
          Delegation logs are the signed message stream that explains who asked what, when it happened, and whether the backend verified the signature.
        </Paragraph>

        <DocsH2>Message Envelope</DocsH2>
        <CodeBlock
          language="json"
          title="Agent Message"
          code={`
{
  "jobId": "job_01",
  "senderSolName": "planner.alice.sol",
  "receiverSolName": "executor.alice.sol",
  "action": "Fetch SOL/USDC spot price and prepare rebalance estimate.",
  "txHash": "5wzB4...kQm2",
  "signatureHex": "d2195f93bb0c..."
}
          `}
        />

        <DocsH2>Verification Path</DocsH2>
        <NumberedList
          items={[
            <>Resolve the sender <code className="font-mono text-silk-primary">.sol</code> name to a wallet.</>,
            <>Look up the sender inside the current job.</>,
            <>Reject messages from revoked agents.</>,
            <>Verify the Ed25519 signature against the action payload.</>,
            <>Store the message and broadcast a realtime event.</>
          ]}
        />

        <DocsH2>Why Logs Matter</DocsH2>
        <BulletList
          items={[
            <>They create the audit trail behind the graph.</>,
            <>They let operators export evidence before retrying a failed action.</>,
            <>They support post-incident analysis when a planner or executor misbehaves.</>
          ]}
        />
      </>
    )
  },
  "revocation-cascades": {
    title: "Revocation & Cascades",
    render: () => (
      <>
        <Paragraph>
          Revocation is TrustMesh&apos;s emergency brake. When a parent agent is revoked, every descendant in that branch becomes invalid for future work.
        </Paragraph>

        <DocsH2>How Cascade Revocation Works</DocsH2>
        <NumberedList
          items={[
            <>Operator submits a revoke request for an active agent.</>,
            <>Backend verifies the revocation transaction against the expected wallet.</>,
            <>Selected agent is marked <strong>REVOKED</strong>.</>,
            <>All descendants are traversed and revoked in the same transaction boundary.</>,
            <>A realtime event notifies connected clients so the graph updates immediately.</>
          ]}
        />

        <DocsH2>Operational Guidance</DocsH2>
        <BulletList
          items={[
            <>Revoke the highest unsafe node in the branch to contain the whole subtree quickly.</>,
            <>Export the coordination log before issuing another deployment.</>,
            <>Treat unexplained revocations as security-sensitive until the actor and cause are known.</>
          ]}
        />

        <Callout type="warning">
          Revocation is intentionally destructive. Use it to stop unsafe authority, not as a substitute for ordinary lifecycle cleanup.
        </Callout>
      </>
    )
  },
  "the-force-graph": {
    title: "The Force Graph",
    render: () => (
      <>
        <Paragraph>
          The graph is the operator&apos;s fastest way to understand a running job. It combines hierarchy, status, and recent coordination into a single visual surface.
        </Paragraph>

        <DocsH2>What You&apos;re Seeing</DocsH2>
        <BulletList
          items={[
            <>The human owner appears at the root.</>,
            <>Planner nodes sit directly beneath the owner.</>,
            <>Executors and other child agents branch from their parent planner or parent agent.</>,
            <>Borders and labels communicate role and status.</>
          ]}
        />

        <DocsH2>How to Read It Quickly</DocsH2>
        <ComparisonTable
          columns={["Signal", "Interpretation", "Action"]}
          rows={[
            ["Tight single branch", "Simple workflow with low fan-out", "Good for first deployments and audits."],
            ["Large fan-out", "Planner is coordinating many children", "Check whether the budget and runtime can support the scale."],
            ["Revoked branch", "Authority was removed from a node or subtree", "Inspect the coordination log and incident notes."],
            ["No recent messages", "Either job is idle or realtime data is stale", "Check polling cadence and websocket health."]
          ]}
        />

        <Callout type="tip">
          Use the graph together with the coordination log. The graph tells you <em>where</em> something happened; the message stream tells you <em>what</em> happened.
        </Callout>
      </>
    )
  },
  "rest-endpoints": {
    title: "REST Endpoints",
    render: () => (
      <>
        <Paragraph>
          TrustMesh exposes authenticated REST endpoints for jobs, graph snapshots, agent details, and signed message ingestion.
        </Paragraph>

        <div className="mt-6 space-y-5">
          <ApiEndpointCard
            method="GET"
            path="/jobs"
            description="List jobs owned by the authenticated user. Filter by status to focus the explorer."
            responseSchema={`
{
  "data": [
    {
      "id": "job_01",
      "onchainId": "abc123...",
      "ownerSolName": "alice.sol",
      "description": "Rebalance SOL/USDC portfolio",
      "template": "PORTFOLIO_REBALANCER",
      "budgetSol": "0.05",
      "status": "ACTIVE",
      "agentCount": 3,
      "activeAgentCount": 2,
      "breachCount": 0
    }
  ]
}
            `}
          />
          <ApiEndpointCard
            method="POST"
            path="/jobs"
            description="Create a pending job plus planner and executor rows after validating SNS-compatible sub-names."
            requestSchema={`
{
  "onchainId": "abc123...",
  "description": "Rebalance SOL/USDC portfolio to 60/40",
  "template": "PORTFOLIO_REBALANCER",
  "budgetSol": 0.05,
  "plannerSubName": "planner",
  "executorSubNames": ["executor", "confirmer"]
}
            `}
            responseSchema={`
{
  "data": {
    "id": "job_01",
    "status": "PENDING",
    "budgetSol": "0.05"
  }
}
            `}
          />
          <ApiEndpointCard
            method="PATCH"
            path="/jobs/:id/activate"
            description="Verify the initialization transaction against the expected on-chain job id, then activate the job."
            requestSchema={`
{
  "initTxHash": "5wzB4...kQm2"
}
            `}
            responseSchema={`
{
  "data": {
    "id": "job_01",
    "status": "ACTIVE"
  }
}
            `}
          />
          <ApiEndpointCard
            method="GET"
            path="/jobs/:id"
            description="Get full job details including agent tree and message count."
            responseSchema={`
{
  "data": {
    "id": "cm4x...",
    "onchainId": "a7f3c2...",
    "description": "Rebalance SOL/USDC to 60/40",
    "status": "ACTIVE",
    "agents": [
      {
        "id": "ag1...",
        "solSubName": "planner.alice.sol",
        "type": "PLANNER",
        "status": "ACTIVE",
        "actionCount": 5
      }
    ],
    "messageCount": 12
  }
}
            `}
          />
          <ApiEndpointCard
            method="GET"
            path="/agents"
            description="List all agents with optional filtering by search query, status, and type. Supports pagination."
            responseSchema={`
{
  "data": [
    {
      "id": "ag1...",
      "solSubName": "planner.alice.sol",
      "type": "PLANNER",
      "status": "ACTIVE",
      "wallet": "FvW8...",
      "job": { "id": "cm4x...", "onchainId": "a7f3c2..." },
      "actionCount": 5,
      "spawnedAt": "2026-05-10T14:35:00Z"
    }
  ]
}
            `}
          />
          <ApiEndpointCard
            method="GET"
            path="/graph/:jobId"
            description="Return the current graph snapshot for a job, including agent nodes and delegation edges."
            responseSchema={`
{
  "data": {
    "nodes": [{ "id": "agent_01", "solSubName": "planner.alice.sol", "status": "ACTIVE", "type": "PLANNER" }],
    "edges": [{ "id": "edge_01", "source": "human-root", "target": "agent_01", "type": "DELEGATION" }]
  }
}
            `}
          />
          <ApiEndpointCard
            method="GET"
            path="/messages?jobId=:jobId&limit=25"
            description="Fetch paginated message history for a job. Cursor-based pagination allows infinite history views."
            responseSchema={`
{
  "data": {
    "items": [
      {
        "id": "msg_01",
        "senderName": "planner.alice.sol",
        "receiverName": "executor.alice.sol",
        "action": "Fetch SOL/USDC price",
        "verified": true
      }
    ],
    "nextCursor": "msg_00"
  }
}
            `}
          />
          <ApiEndpointCard
            method="GET"
            path="/agents/:id"
            description="Return an agent profile, including parent identity, last actions, and recent activity."
            responseSchema={`
{
  "data": {
    "id": "agent_01",
    "jobId": "job_01",
    "solSubName": "planner.alice.sol",
    "type": "PLANNER",
    "status": "ACTIVE",
    "actionCount": 12,
    "walletAddr": "9xQeWvG816bUb..."
  }
}
            `}
          />
          <ApiEndpointCard
            method="POST"
            path="/agents/:id/revoke"
            description="Revoke an agent and cascade revocation to all descendant agents. Requires an on-chain revocation transaction hash."
            requestSchema={`
{
  "revokeTxHash": "7Kp2..."
}
            `}
            responseSchema={`
{
  "data": {
    "revokedId": "ag1...",
    "cascadeCount": 2
  }
}
            `}
          />
          <ApiEndpointCard
            method="POST"
            path="/messages"
            description="Log a new inter-agent delegation message. The Ed25519 signature is verified against the sender's registered wallet."
            requestSchema={`
{
  "jobId": "cm4x...",
  "senderSolName": "planner.alice.sol",
  "receiverSolName": "executor.alice.sol",
  "action": "Fetch SOL/USDC price",
  "txHash": "5Zx9...",
  "signatureHex": "a3f9..."
}
            `}
            responseSchema={`
{
  "data": {
    "id": "msg1...",
    "verified": true,
    "senderName": "planner.alice.sol",
    "receiverName": "executor.alice.sol",
    "action": "Fetch SOL/USDC price"
  }
}
            `}
          />
          <ApiEndpointCard
            method="GET"
            path="/stats/global"
            description="Get global platform statistics — active job count, total agents, total messages, and unauthorized action count."
            responseSchema={`
{
  "data": {
    "activeJobs": 12,
    "totalAgents": 47,
    "totalMessages": 328,
    "unauthorizedActions": 0
  }
}
            `}
          />
        </div>
      </>
    )
  },
  "websocket-events": {
    title: "WebSocket Events",
    render: () => (
      <>
        <Paragraph>
          The realtime channel keeps the graph and coordination log current without waiting for polling refreshes.
        </Paragraph>

        <DocsH2>Event Types</DocsH2>
        <ComparisonTable
          columns={["Event", "Payload", "Typical UI Effect"]}
          rows={[
            ["SNAPSHOT", "Full node and edge list", "Initial graph hydration."],
            ["AGENT_STATUS_CHANGE", "agentId + status", "Node badge or color changes."],
            ["NEW_MESSAGE", "New message object", "Coordination log prepends a fresh event."],
            ["AGENT_SPAWNED", "Agent object", "Graph grows by one node."],
            ["AGENT_REVOKED", "agentId + cascade ids", "Branch updates to revoked state."],
            ["JOB_COMPLETE", "jobId", "Job footer and list state update."]
          ]}
        />

        <DocsH2>Example Event</DocsH2>
        <CodeBlock
          language="json"
          title="NEW_MESSAGE"
          code={`
{
  "type": "NEW_MESSAGE",
  "message": {
    "id": "msg_01",
    "jobId": "job_01",
    "senderName": "planner.alice.sol",
    "receiverName": "executor.alice.sol",
    "action": "Fetch SOL/USDC spot price",
    "txHash": "5wzB4...kQm2",
    "signatureHex": "d2195f93bb0c...",
    "verified": true,
    "createdAt": "2026-05-10T10:22:15.000Z"
  }
}
          `}
        />

        <Callout type="info">
          When realtime transport is unavailable, the explorer falls back to polling. Settings controls the fallback cadence used by the graph and message views.
        </Callout>
      </>
    )
  },
  "agent-runtime": {
    title: "Agent Runtime",
    render: () => (
      <>
        <Paragraph>
          The repo includes an agent runtime package that simulates a two-agent swarm executing a portfolio rebalancing job on Solana Devnet.
        </Paragraph>

        <DocsH2>What It Does Today</DocsH2>
        <BulletList
          items={[
            <>Spawns planner and executor agents on-chain.</>,
            <>Fetches a live SOL/USDC price from Jupiter.</>,
            <>Signs delegation messages and posts them back to the backend.</>,
            <>Keeps the frontend graph and message log current in realtime.</>
          ]}
        />

        <DocsH2>Runtime Notes</DocsH2>
        <BulletList
          items={[
            <>The backend currently provisions planner and executor rows during <code className="font-mono text-silk-primary">POST /jobs</code>.</>,
            <>The runtime reconciles those rows instead of calling a separate <code className="font-mono text-silk-primary">POST /agents</code> route.</>,
            <>The on-chain program and backend verify related but slightly different message representations, so the runtime signs both where needed.</>
          ]}
        />

        <DocsH2>Minimal Demo Flow</DocsH2>
        <CodeBlock
          language="bash"
          title="Runtime Setup"
          code={`
cp .env.example .env
solana-keygen new --outfile wallet.json
# set HUMAN_WALLET_KEYPAIR_PATH=./wallet.json
# set BACKEND_JWT from browser local storage
npm install
npm run demo
          `}
        />
      </>
    )
  },
  "error-codes": {
    title: "Error Codes",
    render: () => (
      <>
        <Paragraph>
          These are the errors you will see most often while integrating or operating the current TrustMesh stack.
        </Paragraph>

        <ComparisonTable
          columns={["Code", "Meaning", "Likely Fix"]}
          rows={[
            ["INVALID_SUB_NAME", "Planner or executor namespace failed validation", "Use lowercase letters, digits, and hyphens under a valid owner .sol domain."],
            ["OWNER_SOL_NAME_REQUIRED", "The connected wallet does not resolve to an SNS name", "Register or reconnect the correct parent identity before deploying."],
            ["JOB_ALREADY_ACTIVE", "A pending job was activated twice", "Refresh state and avoid replaying the activation step."],
            ["ONCHAIN_MISMATCH", "The submitted transaction does not match expected on-chain state", "Confirm cluster, program id, and transaction hash before retrying."],
            ["JOB_NOT_ACTIVE", "Message submission targeted a non-active job", "Activate the job first or stop sending runtime actions to it."],
            ["SNS_RESOLUTION_FAILED", "A .sol identity could not be resolved to a wallet", "Check the name, cluster, and SNS configuration."],
            ["AGENT_NOT_FOUND", "The requested sender or receiver was not found in the job", "Verify the runtime is targeting the correct job and agent namespace."],
            ["AGENT_REVOKED", "Sender is no longer active", "Stop dispatching actions and investigate the revocation source."],
            ["INVALID_SIGNATURE", "Ed25519 signature verification failed", "Ensure the signer wallet matches the resolved .sol identity and action payload."],
            ["FORBIDDEN", "Authenticated user does not own the resource", "Reconnect with the correct owner wallet."],
            ["NOT_FOUND", "Resource id does not exist or is out of scope", "Check ids, auth context, and environment."]
          ]}
        />
      </>
    )
  },
  "portfolio-rebalancer-demo": {
    title: "Portfolio Rebalancer Demo",
    render: () => (
      <>
        <Paragraph>
          This is the shortest complete TrustMesh demo: create a rebalance job, let the runtime fetch live price data, and watch the planner delegate work to executors.
        </Paragraph>

        <DocsH2>Suggested Demo Path</DocsH2>
        <NumberedList
          items={[
            <>Connect a Devnet wallet with enough SOL for a few transactions.</>,
            <>Create a Portfolio Rebalancer job with one planner and one executor.</>,
            <>Open the job detail page in a second tab.</>,
            <>Run the agent runtime so messages stream back into the graph.</>,
            <>Export the log when complete and review every delegated step.</>
          ]}
        />

        <DocsH2>What to Watch For</DocsH2>
        <BulletList
          items={[
            <>Planner should emit the first coordination messages.</>,
            <>Executor should receive work and reflect new actions in the side panel.</>,
            <>No breach counters should increase during a healthy run.</>,
            <>Revocation should immediately freeze the branch if you simulate an unsafe condition.</>
          ]}
        />
      </>
    )
  },
  "custom-agent-types": {
    title: "Custom Agent Types",
    render: () => (
      <>
        <Paragraph>
          The current deployer starts with planner and executor roles, but the underlying data model already supports analyzer, trader, and confirmer agents for richer runtimes.
        </Paragraph>

        <DocsH2>When to Add a New Role</DocsH2>
        <BulletList
          items={[
            <>You need a safety reviewer separate from an execution actor.</>,
            <>You want explicit research agents that never touch funds.</>,
            <>You need domain-specific execution policies, such as trading-only behavior.</>
          ]}
        />

        <DocsH2>Design Questions</DocsH2>
        <ComparisonTable
          columns={["Question", "Why It Matters"]}
          rows={[
            ["Who is the parent?", "Parentage determines the delegation path and cascade behavior."],
            ["What can the agent sign?", "Message scope should match the role's authority."],
            ["How is success measured?", "Completion criteria should be auditable, not implicit."],
            ["What happens on failure?", "Fallbacks should be documented before the runtime is deployed."]
          ]}
        />

        <Callout type="tip">
          Add new roles to your runtime gradually. It is easier to debug a narrow delegation tree than a wide one with overlapping responsibilities.
        </Callout>
      </>
    )
  },
  "integrating-with-protocols": {
    title: "Integrating with Protocols",
    render: () => (
      <>
        <Paragraph>
          TrustMesh works best when protocol actions stay explicit: discover state, plan a bounded action, sign the intent, then submit and verify the result.
        </Paragraph>

        <DocsH2>Integration Pattern</DocsH2>
        <NumberedList
          items={[
            <>Read protocol state from a trusted RPC or indexer.</>,
            <>Let the planner compute a bounded next step.</>,
            <>Delegate execution to a role that is allowed to submit that class of action.</>,
            <>Log the signed message before or alongside the external transaction.</>,
            <>Confirm the result and record the outcome.</>
          ]}
        />

        <DocsH2>Good First Integrations</DocsH2>
        <BulletList
          items={[
            <>Price discovery and quote retrieval.</>,
            <>Governance proposal analysis and vote preparation.</>,
            <>Safe DeFi actions with explicit spending limits and verification steps.</>
          ]}
        />

        <Callout type="warning">
          Keep wallet signing, backend verification, and protocol submission on the same cluster. Cross-cluster reads are the fastest way to create confusing incident reports.
        </Callout>
      </>
    )
  },
  "security-best-practices": {
    title: "Security Best Practices",
    render: () => (
      <>
        <Paragraph>
          TrustMesh is opinionated about operator control, but strong operational hygiene still matters. Use these defaults before running anything valuable.
        </Paragraph>

        <BulletList
          items={[
            <>Separate production operator wallets from experimental or demo wallets.</>,
            <>Use clear planner and executor naming conventions so incident review is fast.</>,
            <>Rotate or revoke agents immediately when an authority path changes unexpectedly.</>,
            <>Capture logs before retrying failed actions so the original evidence survives.</>,
            <>Prefer low budgets during integration and increase only after repeated successful dry-runs.</>
          ]}
        />

        <Callout type="warning">
          Treat leaked signer keys, unexplained revocations, and mismatched SNS resolution as private security events until you understand the blast radius.
        </Callout>
      </>
    )
  },
  "common-errors": {
    title: "Common Errors",
    render: ({ goToPage }) => (
      <>
        <Paragraph>
          Most operator issues fall into three categories: identity resolution, cluster mismatch, or runtime signing problems.
        </Paragraph>

        <DocsH2>Fast Triage Order</DocsH2>
        <NumberedList
          items={[
            <>Check the active wallet and resolved owner identity.</>,
            <>Confirm the RPC endpoint and websocket cluster match your wallet cluster.</>,
            <>Review the exact backend error code rather than guessing from the UI symptom.</>,
            <>Inspect the latest coordination messages before retrying a deployment.</>
          ]}
        />

        <DocsH2>Where to Go Next</DocsH2>
        <BulletList
          items={[
            <>
              For transaction verification issues, read{" "}
              <button
                type="button"
                className="font-semibold text-silk-primary"
                onClick={() => goToPage("error-codes")}
              >
                Error Codes
              </button>
              .
            </>,
            <>
              For cluster or RPC drift, open{" "}
              <button
                type="button"
                className="font-semibold text-silk-primary"
                onClick={() => goToPage("rpc-issues")}
              >
                RPC Issues
              </button>
              .
            </>,
            <>
              For Phantom or session failures, continue to{" "}
              <button
                type="button"
                className="font-semibold text-silk-primary"
                onClick={() => goToPage("wallet-problems")}
              >
                Wallet Problems
              </button>
              .
            </>
          ]}
        />
      </>
    )
  },
  "rpc-issues": {
    title: "RPC Issues",
    render: () => (
      <>
        <Paragraph>
          RPC drift can look like missing graph updates, late message history, or activation mismatches even when the on-chain state is healthy.
        </Paragraph>

        <DocsH2>Symptoms of RPC Trouble</DocsH2>
        <BulletList
          items={[
            <>Job activation appears stuck even after wallet confirmation.</>,
            <>Graph stops updating but messages resume after a manual refresh.</>,
            <>Explorer links show transactions on a different cluster than the app expects.</>,
            <>SNS resolution behaves inconsistently across retries.</>
          ]}
        />

        <DocsH2>Operator Response</DocsH2>
        <NumberedList
          items={[
            <>Open Settings and confirm the effective RPC endpoint.</>,
            <>Make sure wallet, backend, and websocket all target the same cluster.</>,
            <>Increase polling slightly if realtime transport is unstable.</>,
            <>Capture the failing tx hash and endpoint info before switching providers.</>
          ]}
        />
      </>
    )
  },
  "wallet-problems": {
    title: "Wallet Problems",
    render: () => (
      <>
        <Paragraph>
          Wallet issues usually show up as failed connection, stale auth state, or signing mismatches between the resolved SNS identity and the actual signer.
        </Paragraph>

        <DocsH2>Common Scenarios</DocsH2>
        <ComparisonTable
          columns={["Problem", "Meaning", "Fix"]}
          rows={[
            ["Wallet connected but deploy blocked", "Frontend session exists but auth or owner context is stale", "Reconnect, approve the message or transaction prompt, and reload the session."],
            ["Versioned transaction unsupported", "Wallet adapter cannot sign the required transaction type", "Upgrade the wallet and retry on the same cluster."],
            ["Wrong .sol name shown", "Resolved SNS name belongs to a different wallet or namespace", "Disconnect and reconnect the correct authority wallet."],
            ["Frequent prompt failures", "Browser extension or transport is unstable", "Restart the wallet extension and keep only one active cluster context."]
          ]}
        />

        <Callout type="tip">
          If you are screen sharing, switch to manual connect behavior in Settings so you can reconnect cleanly without exposing a stale wallet session.
        </Callout>
      </>
    )
  }
};

export function Docs() {
  const [activePage, setActivePage] = useState<PageKey>("quick-start");
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    "getting-started": true,
    "core-concepts": false,
    "api-reference": false,
    guides: false,
    troubleshooting: false
  });
  const contentRef = useRef<HTMLDivElement | null>(null);

  const activeSection = docsSections.find((section) => section.pages.some((page) => page.id === activePage)) ?? docsSections[0];
  const activePageDefinition = docPages[activePage];

  useEffect(() => {
    setExpandedSections((current) => ({
      ...current,
      [activeSection.id]: true
    }));
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activePage, activeSection.id]);

  return (
    <div className="min-h-[calc(100vh-5rem)] p-4 pb-24 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1560px]">
        <section className="tm-shell-card overflow-hidden px-6 py-6 md:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-center">
            <div>
              <div className="tm-kicker">Documentation</div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-silk-text-primary md:text-5xl">
                TrustMesh operator docs
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-silk-text-secondary">
                Product docs, API reference, operational guides, and runtime notes for running verified agent hierarchies on Solana.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Link to="/deploy" className="tm-button-primary gap-2">
                <RocketIcon className="h-4 w-4" />
                <span>Open Deployer</span>
              </Link>
              <Link to="/support" className="tm-button-ghost">
                Visit Support Center
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-28 xl:self-start">
            <div className="tm-shell-card silk-scrollbar max-h-[calc(100vh-8rem)] overflow-y-auto p-3">
              {docsSections.map((section) => {
                const expanded = expandedSections[section.id];
                const sectionHasActivePage = section.pages.some((page) => page.id === activePage);

                return (
                  <div key={section.id} className="mb-3 last:mb-0">
                    <button
                      type="button"
                      className="tm-focus-ring flex w-full items-center justify-between rounded-[20px] px-3 py-3 text-left"
                      onClick={() =>
                        setExpandedSections((current) => ({
                          ...current,
                          [section.id]: !expanded
                        }))
                      }
                    >
                      <span
                        className={cx(
                          "text-[11px] font-semibold uppercase tracking-[0.22em]",
                          sectionHasActivePage ? "text-silk-primary" : "text-silk-text-tertiary"
                        )}
                      >
                        {section.title}
                      </span>
                      <ChevronRightIcon className={cx("h-4 w-4 text-silk-text-tertiary transition", expanded && "rotate-90")} />
                    </button>

                    {expanded ? (
                      <div className="mt-2 space-y-2">
                        {section.pages.map((page) => {
                          const active = page.id === activePage;
                          return (
                            <button
                              key={page.id}
                              type="button"
                              className={cx(
                                "tm-focus-ring w-full rounded-full px-4 py-3 text-left text-[13px] transition",
                                active
                                  ? "neo-pill-inset font-semibold text-silk-primary"
                                  : "neo-pill font-normal text-silk-text-secondary hover:text-silk-text-primary"
                              )}
                              onClick={() => setActivePage(page.id)}
                            >
                              {page.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </aside>

          <div ref={contentRef} className="silk-scrollbar min-w-0 overflow-x-hidden">
            <motion.article
              key={activePage}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="tm-shell-card px-6 py-6 md:px-8"
            >
              <div className="text-xs text-silk-text-tertiary">
                Docs <span className="px-2">›</span> {activeSection.title} <span className="px-2">›</span>{" "}
                {activePageDefinition.title}
              </div>
              <h1 className="mt-4 text-[24px] font-semibold tracking-tight text-silk-text-primary">
                {activePageDefinition.title}
              </h1>
              <div className="mt-6">{activePageDefinition.render({ goToPage: setActivePage })}</div>
            </motion.article>
          </div>
        </div>
      </div>
    </div>
  );
}
