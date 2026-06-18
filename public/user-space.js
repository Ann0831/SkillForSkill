const app = document.querySelector("#app");
const pageTitle = document.querySelector("#page-title");
const health = document.querySelector("#health");

function encodeArgs(args = {}) {
  return encodeURIComponent(JSON.stringify(args));
}

async function readCommand(command, args = {}) {
  const response = await fetch(
    `/api/read?command=${encodeURIComponent(command)}&args=${encodeArgs(args)}`,
  );
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Request failed: ${command}`);
  }

  return payload.result;
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const payload = await response.json();

    if (!response.ok || payload.ok !== true || payload.service !== "SkillForSkill") {
      throw new Error("Unexpected service response");
    }

    health.textContent = `Connected to ${payload.service} ${payload.version}`;
    health.className = "health ok";
  } catch (error) {
    health.textContent = "SkillForSkill server not verified";
    health.className = "health error";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function basename(filePath) {
  return String(filePath).split(/[\\/]/).pop();
}

function pathParams() {
  return new URLSearchParams(window.location.search);
}

function link(path, params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function sourceForWork(work) {
  return work.isDiscarded ? "discarded_work" : "work";
}

function setTitle(title) {
  pageTitle.textContent = title;
  document.title = `${title} - SkillForSkill`;
}

function renderError(error) {
  app.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
}

function renderTasks(work) {
  if (!work.taskFiles || work.taskFiles.length === 0) {
    return `<p class="description">No tasks recorded.</p>`;
  }

  const source = sourceForWork(work);

  return `
    <div class="task-grid">
      ${work.taskFiles
        .map(
          (taskName) => `
            <a class="task-link" href="${link("/user-space/task", {
              workName: work.workName,
              taskName,
              source,
            })}">${escapeHtml(taskName)}</a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderWorkItem(work) {
  const source = sourceForWork(work);
  const potentialSkillAction = work.potentialSkillName
    ? `<a class="button-link" href="${link("/user-space/potential-skill", {
        skillName: work.potentialSkillName,
      })}">Open ${escapeHtml(work.potentialSkillName)}</a>`
    : "";
  const statusTags = [
    work.isDiscarded ? `<span class="tag discarded">discarded</span>` : "",
    work.hasPotentialSkill ? `<span class="tag">potential skill created</span>` : "",
    work.isFutureWorkUnneeded ? `<span class="tag discarded">future unneeded</span>` : "",
  ].join("");

  return `
    <article class="item">
      <div class="item-title">
        <a href="${link("/user-space/work", {
          workName: work.workName,
          source,
        })}">${escapeHtml(work.workName)}</a>
        <span class="tag">${escapeHtml(work.taskCount)} tasks</span>
      </div>
      <p class="description">${escapeHtml(work.description || "No description.")}</p>
      <div class="meta">
        ${statusTags}
        ${potentialSkillAction}
      </div>
      ${renderTasks(work)}
    </article>
  `;
}

function renderPotentialSkillItem(skillPath) {
  const skillName = basename(skillPath);

  return `
    <article class="item">
      <div class="item-title">
        <a href="${link("/user-space/potential-skill", { skillName })}">
          ${escapeHtml(skillName)}
        </a>
      </div>
      <p class="description path-text">${escapeHtml(skillPath)}</p>
    </article>
  `;
}

async function renderDashboard() {
  setTitle("Work Overview");
  app.innerHTML = `<div class="loading">Loading overview...</div>`;

  const [works, potentialSkills] = await Promise.all([
    readCommand("list-works", { includeFutureUnneededDiscardedWork: true }),
    readCommand("list-potential-skills"),
  ]);

  app.innerHTML = `
    <div class="overview-grid">
      <section class="panel">
        <h2>Works And Tasks</h2>
        <div class="list">
          ${
            works.length > 0
              ? works.map(renderWorkItem).join("")
              : `<div class="empty">No work has been recorded yet.</div>`
          }
        </div>
      </section>
      <section class="panel">
        <h2>Potential Skills</h2>
        <div class="list">
          ${
            potentialSkills.length > 0
              ? potentialSkills.map(renderPotentialSkillItem).join("")
              : `<div class="empty">No potential skills yet.</div>`
          }
        </div>
      </section>
    </div>
  `;
}

async function renderWorkPage() {
  const params = pathParams();
  const workName = params.get("workName");
  const source = params.get("source") || "work";

  setTitle(workName ? `Work: ${workName}` : "Work");
  app.innerHTML = `<div class="loading">Loading work...</div>`;

  const work = await readCommand("get-work", { workName, source });

  app.innerHTML = `
    <section class="panel">
      <h2>${escapeHtml(work.workName)}</h2>
      <p class="description">${escapeHtml(work.description || "No description.")}</p>
      <div class="meta">
        <span class="tag">${escapeHtml(work.taskCount)} tasks</span>
        <span class="tag">hasPotentialSkill: ${escapeHtml(work.hasPotentialSkill)}</span>
        ${
          work.potentialSkillName
            ? `<a class="button-link" href="${link("/user-space/potential-skill", {
                skillName: work.potentialSkillName,
              })}">Open ${escapeHtml(work.potentialSkillName)}</a>`
            : ""
        }
        <span class="tag">isSkillCandidate: ${escapeHtml(work.isSkillCandidate)}</span>
        <span class="tag">isFutureWorkUnneeded: ${escapeHtml(work.isFutureWorkUnneeded)}</span>
      </div>
    </section>
    <section class="panel">
      <h2>Tasks</h2>
      ${renderTasks(work)}
    </section>
    <section class="panel">
      <h2>State</h2>
      <pre class="pre">${escapeHtml(JSON.stringify(work.state, null, 2))}</pre>
    </section>
  `;
}

async function renderTaskPage() {
  const params = pathParams();
  const workName = params.get("workName");
  const taskName = params.get("taskName");
  const source = params.get("source") || "work";

  setTitle(taskName ? `Task: ${taskName}` : "Task");
  app.innerHTML = `<div class="loading">Loading task...</div>`;

  const task = await readCommand("get-task", { workName, taskName, source });

  app.innerHTML = `
    <section class="panel">
      <h2>${escapeHtml(task.taskName)}</h2>
      <div class="meta">
        <a class="button-link" href="${link("/user-space/work", {
          workName: task.workName,
          source: task.source,
        })}">Open work</a>
        <span class="tag">${escapeHtml(task.workName)}</span>
      </div>
    </section>
    <section class="panel">
      <h2>Content</h2>
      <pre class="pre">${escapeHtml(task.content)}</pre>
    </section>
  `;
}

async function renderPotentialSkillPage() {
  const params = pathParams();
  const skillName = params.get("skillName");

  setTitle(skillName ? `Potential Skill: ${skillName}` : "Potential Skill");
  app.innerHTML = `<div class="loading">Loading potential skill...</div>`;

  const skill = await readCommand("get-potential-skill", { skillName });

  app.innerHTML = `
    <section class="panel">
      <h2>${escapeHtml(skill.skillName)}</h2>
      <p class="description">${escapeHtml(skill.skillPath)}</p>
    </section>
    <section class="panel">
      <h2>Content</h2>
      <pre class="pre">${escapeHtml(skill.content)}</pre>
    </section>
  `;
}

async function route() {
  await checkHealth();

  try {
    if (window.location.pathname === "/user-space/work") {
      await renderWorkPage();
      return;
    }

    if (window.location.pathname === "/user-space/task") {
      await renderTaskPage();
      return;
    }

    if (window.location.pathname === "/user-space/potential-skill") {
      await renderPotentialSkillPage();
      return;
    }

    await renderDashboard();
  } catch (error) {
    renderError(error);
  }
}

route();
