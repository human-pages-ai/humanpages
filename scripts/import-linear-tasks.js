// Import all Linear issues into AdminTask board
// Run: cd backend && node ../scripts/import-linear-tasks.js
const { PrismaClient } = require("@prisma/client");
const https = require("https");

const LINEAR_TOKEN = "lin_api_ebs0N963n912vT9Dcuz1K3pwl3cuRY5Hbb7GhCNa";
const TEAM = "0d926626-214a-4d9b-bd04-2f5e729f786e";

function graphql(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });
    const req = https.request("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: LINEAR_TOKEN },
    }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const prisma = new PrismaClient();

  // Fetch all Linear issues with pagination
  let all = [], cursor = null;
  while (true) {
    const after = cursor ? `, after: "${cursor}"` : "";
    const res = await graphql(`{ issues(first: 250${after}, filter: { team: { id: { eq: "${TEAM}" } } }) { pageInfo { hasNextPage endCursor } nodes { identifier title description state { name } priority labels { nodes { name } } } } }`);
    all.push(...res.data.issues.nodes);
    console.log("Fetched " + all.length + " issues");
    if (!res.data.issues.pageInfo.hasNextPage) break;
    cursor = res.data.issues.pageInfo.endCursor;
  }

  const stateMap = { Backlog: "TODO", Todo: "TODO", "In Progress": "IN_PROGRESS", Done: "DONE", Canceled: "CANCELLED", Cancelled: "CANCELLED" };
  const prioMap = { 0: "P3", 1: "P0", 2: "P1", 3: "P2", 4: "P3" };
  const prioLabels = new Set(["P0", "P0.5", "P1", "P1.5", "P2", "P2.5", "P3"]);
  const ownerLabels = new Set(["Evyatar", "Itai", "Harel", "Tal", "Mikee", "Assistant", "Unassigned", "Other", "Pratik"]);

  const tasks = all.map((issue, i) => {
    const labels = issue.labels.nodes.map((l) => l.name);
    let priority = prioMap[issue.priority] || "P2";
    for (const l of labels) {
      if (prioLabels.has(l)) { priority = l; break; }
    }
    let assignee = null;
    for (const l of labels) {
      if (ownerLabels.has(l) && l !== "Unassigned" && l !== "Other") { assignee = l; break; }
    }
    return {
      title: issue.title,
      description: (issue.description || "").slice(0, 5000) || null,
      status: stateMap[issue.state.name] || "TODO",
      priority,
      labels: labels.filter((l) => !prioLabels.has(l) && !ownerLabels.has(l)),
      assignee,
      linearId: issue.identifier,
      sortOrder: i,
    };
  });

  await prisma.adminTask.deleteMany();
  let created = 0;
  for (let i = 0; i < tasks.length; i += 50) {
    const r = await prisma.adminTask.createMany({ data: tasks.slice(i, i + 50), skipDuplicates: true });
    created += r.count;
    process.stdout.write(".");
  }
  console.log("\nImported " + created + " tasks");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
