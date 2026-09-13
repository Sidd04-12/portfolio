import bcrypt from "bcryptjs";
import { closeDb, db } from "./client.js";
import { adminUsers, projects } from "./schema.js";
import type { NewProject } from "./schema.js";

/**
 * Seeds the real project content and the single admin account.
 *
 * Idempotent: every insert is an upsert on a natural key, so running it against an existing
 * database refreshes content rather than duplicating or failing.
 */

const seedProjects: NewProject[] = [
  {
    slug: "sentinelcode",
    name: "sentinelcode",
    kind: "AI security code review platform",
    status: "running",
    blurb:
      "Reviews pull requests for security defects rather than style. A Spring Boot service verifies the GitHub webhook, de-duplicates the delivery through Redis and publishes to Kafka; a Python engine consumes it, indexes the repository into pgvector for whole-codebase context, scores the diff, and publishes findings back. The two services never call each other directly.",
    topology:
      "GitHub ──▶ ingestion-service (Java)\n" +
      "              │  ├─ HMAC verify\n" +
      "              │  ├─ Redis SETNX dedupe\n" +
      "              │  └─ Postgres: review PENDING\n" +
      "              ▼\n" +
      "        [ pr.review.requested ]\n" +
      "              ▼\n" +
      "         ai-review-engine (Python)\n" +
      "              │  ├─ chunk + embed ─▶ pgvector\n" +
      "              │  ├─ RAG: similar chunks, whole repo\n" +
      "              │  └─ scan diff ─▶ findings\n" +
      "              ▼\n" +
      "        [ pr.review.completed ]\n" +
      "              ▼\n" +
      "        ingestion-service persists ─▶ REST API",
    stack: ["Java 17", "Spring Boot 3", "Python 3.12", "FastAPI", "Redpanda", "Postgres", "pgvector", "Redis", "Docker"],
    meta: [
      ["Topics", "pr.review.requested · pr.review.completed"],
      ["Consumer groups", "2"],
      ["Vector dim", "384 (ivfflat/cosine)"],
      ["Risk model", "severity x confidence, capped 0-100"],
      ["Tests", "22 passing"],
    ],
    findings: [
      ["crit", "SECRET", "Hardcoded AWS access key — app/auth.py:1"],
      ["high", "AUTH", "TLS verification disabled — app/auth.py:5"],
    ],
    repoUrl: "https://github.com/Sidd04-12/sentinelcode",
    githubRepo: "Sidd04-12/sentinelcode",
    sortOrder: 10,
  },
  {
    slug: "job-scheduler",
    name: "job-scheduler",
    kind: "Distributed job scheduling system",
    status: "running",
    blurb:
      "Schedules work to run later, or in priority order, across a pool of workers that scale independently of whoever submitted the job. Submission and execution are decoupled through Kafka consumer groups. Redis sorted sets hold the pending queue — scored by run-time — so pulling the next due job stays logarithmic rather than scanning. Failures retry with exponential backoff and fall through to a dead-letter topic, with Postgres as the durable record throughout.",
    topology:
      "client ──▶ scheduler-api (Spring Boot)\n" +
      "              ├─ Postgres — durable job row\n" +
      "              └─ Redis ZSET — score = run_at millis\n" +
      "                         │\n" +
      "                    dispatcher — atomic Lua claim\n" +
      "                         ▼\n" +
      "                   [ jobs.ready ]  Kafka\n" +
      "                         ▼\n" +
      "               worker pool (consumer group)\n" +
      "                    ├─ ok      ─▶ Postgres: COMPLETED\n" +
      "                    ├─ fail    ─▶ backoff, requeue\n" +
      "                    └─ exhausted ─▶ [ jobs.dlq ]",
    stack: ["Java 17", "Spring Boot 3", "Kafka", "Redis", "PostgreSQL", "Docker"],
    meta: [
      ["Queue", "Redis ZSET, score = run_at millis"],
      ["Claim", "atomic Lua — ZRANGEBYSCORE + ZREM"],
      ["Scaling", "12 partitions / consumer group"],
      ["Retries", "exponential backoff + jitter → DLQ"],
      ["Durability", "PostgreSQL ledger + event log"],
      ["Tests", "11 passing, real Redis + Postgres"],
      ["Throughput", "not yet measured"],
    ],
    findings: [
      ["ok", "VERIFIED", "2,000 jobs, 8 concurrent dispatchers — zero double-claims"],
      ["ok", "VERIFIED", "150 rounds of cancel-vs-dispatch race — exactly one winner each"],
      ["ok", "VERIFIED", "12 partitions spread across 4 containers under scale-out"],
    ],
    repoUrl: "https://github.com/Sidd04-12/-distributed-job-scheduler",
    githubRepo: "Sidd04-12/-distributed-job-scheduler",
    sortOrder: 20,
  },
  {
    slug: "kannada-spellcheck",
    name: "kannada-spellcheck",
    kind: "LSTM spell checker for Kannada",
    status: "archived",
    blurb:
      "A spell checker for Kannada — a Dravidian language with rich agglutinative morphology and far less tooling than English, which makes dictionary-lookup approaches fall over quickly. Built as a sequence model rather than a lookup table so it can handle word forms that were never in the training vocabulary.",
    topology:
      "input token ──▶ normalise (Unicode, ZWJ/ZWNJ)\n" +
      "                    ▼\n" +
      "             LSTM sequence model\n" +
      "                    ├─ character-level context\n" +
      "                    └─ handles unseen inflections\n" +
      "                    ▼\n" +
      "            ranked correction candidates",
    stack: ["Python", "LSTM", "NLP", "MIT"],
    meta: [
      ["Family", "Dravidian, agglutinative"],
      ["Approach", "sequence model, not dictionary lookup"],
      ["Repos", "2 (baseline + LSTM)"],
      ["Status", "archived — last touched Jul 2024"],
    ],
    findings: [
      ["note", "NOTE", "Low-resource language — little existing tooling to build on"],
      ["note", "NOTE", "Accuracy not formally benchmarked"],
    ],
    repoUrl: "https://github.com/Sidd04-12/Kannada_spell_checker_LSTM",
    githubRepo: "Sidd04-12/Kannada_spell_checker_LSTM",
    sortOrder: 30,
  },
];

async function main() {
  for (const p of seedProjects) {
    await db
      .insert(projects)
      .values(p)
      .onConflictDoUpdate({
        target: projects.slug,
        set: { ...p, updatedAt: new Date() },
      });
    console.log(`  seeded project: ${p.slug}`);
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (email && password) {
    if (password.length < 12) {
      throw new Error("ADMIN_PASSWORD must be at least 12 characters");
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await db
      .insert(adminUsers)
      .values({ email, passwordHash })
      .onConflictDoUpdate({ target: adminUsers.email, set: { passwordHash } });
    console.log(`  seeded admin user: ${email}`);
  } else {
    console.log("  skipped admin user (set ADMIN_EMAIL and ADMIN_PASSWORD to create one)");
  }

  console.log("Seed complete.");
  await closeDb();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await closeDb();
  process.exit(1);
});
