const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const geminiKey = process.env.GEMINI_API_KEY || "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function geminiText(prompt) {
  if (/Act as an expert Career Counselor/i.test(prompt)) {
    const interest = prompt.match(/Interests:\s*(.+)/i)?.[1]?.trim() || "";
    const project = prompt.match(/Dream Project:\s*(.+)/i)?.[1]?.trim() || "";
    let title = "Software Developer";
    if (/data|analy/i.test(interest)) title = "Data Analyst";
    else if (/logic|app|ai|robot/i.test(project + " " + interest)) title = "Software Engineer";
    else if (/visual|design/i.test(interest)) title = "UI/UX Designer";
    else if (/people|help/i.test(interest)) title = "Technical Program Manager";

    return JSON.stringify({
      title: "Roadmap: " + title,
      sourceGoal: "Based on your match for " + title,
      steps: [
        { title: "Step 1: Learn the fundamentals", description: "Master the core concepts and tools used in " + title + " roles.", courses: [{ name: "Foundational course", platform: "FreeCodeCamp" }, { name: "Official learning path", platform: "Google" }] },
        { title: "Step 2: Build focused projects", description: "Create practical projects that demonstrate your strengths and make your work easier to explain.", courses: [{ name: "Project-based learning", platform: "Coursera" }, { name: "Hands-on tutorials", platform: "YouTube" }] },
        { title: "Step 3: Develop a portfolio", description: "Package your strongest work with clear outcomes, source code, and concise case studies.", courses: [{ name: "Portfolio development", platform: "Microsoft Learn" }, { name: "Version control", platform: "edX" }] },
        { title: "Step 4: Prepare for applications", description: "Tailor your resume, practice interviews, and apply consistently to relevant roles.", courses: [{ name: "Interview preparation", platform: "DataCamp" }, { name: "Career readiness", platform: "LinkedIn Learning" }] }
      ]
    });
  }
  if (/Jira ticket|JSON ticket|Create a .*ticket/i.test(prompt)) {
    const request = prompt.match(/"([^"]+)"/)?.[1] || "Improve the sample application";
    return JSON.stringify({
      title: "Build an interactive " + request.slice(0, 50),
      tech: ["HTML", "CSS", "JavaScript"],
      scenario: "Create a polished, accessible implementation that handles loading and error states.",
      criteria: ["The UI is responsive", "Core interactions are implemented", "No console errors"],
      xp: 250
    });
  }

  if (/absolute strict grader|Score 0-100/i.test(prompt)) {
    return JSON.stringify({
      score: 75,
      feedback: "The submission includes a useful implementation and addresses the ticket requirements. Improve edge-case handling and add clearer comments before final submission."
    });
  }

  if (/Applicant Tracking System|Analyze the provided Resume/i.test(prompt)) {
    return JSON.stringify({
      name: "Candidate",
      score: 72,
      verdict: "The profile has relevant strengths, with a few gaps that can be addressed by targeted projects.",
      missing_skills: ["Job-specific framework", "Measured project outcomes", "Industry tools"],
      matched_skills: ["Problem solving", "Technical communication", "Relevant coursework"],
      reasoning: "A balanced match based on the supplied resume and job description.",
      resume_tips: ["Add measurable achievements", "Use keywords from the target job description"],
      interview_prep: ["Explain a recent technical project", "Discuss how you handle production incidents"]
    });
  }

  if (/career counselor|career mentor|roadmap|Dream Project|Career/i.test(prompt)) {
    const goalMatch = prompt.match(/(?:dream job|goal|based on:)\s*(.{0,100})/i);
    const goal = goalMatch ? goalMatch[1].split("\n")[0].replace(/[".]/g, "").trim() : "Technology Career";
    return JSON.stringify({
      title: "Roadmap: " + (goal || "Technology Career"),
      sourceGoal: goal || "Technology Career",
      steps: [
        { title: "Step 1: Build the fundamentals", description: "Learn the core concepts, tools, and vocabulary used in this role.", courses: [{ name: "Foundations course", platform: "FreeCodeCamp" }, { name: "Official documentation", platform: "Google" }] },
        { title: "Step 2: Create practice projects", description: "Apply the fundamentals through small projects and document your decisions.", courses: [{ name: "Hands-on projects", platform: "Coursera" }, { name: "Developer tutorials", platform: "YouTube" }] },
        { title: "Step 3: Develop a portfolio", description: "Build polished portfolio projects that demonstrate results, reliability, and collaboration.", courses: [{ name: "Portfolio best practices", platform: "Microsoft Learn" }, { name: "Git and collaboration", platform: "edX" }] },
        { title: "Step 4: Prepare for opportunities", description: "Improve your resume, practice interviews, and apply consistently.", courses: [{ name: "Interview preparation", platform: "DataCamp" }, { name: "Career skills", platform: "LinkedIn Learning" }] }
      ]
    });
  }

  if (/ONLY "PASS" or "FAIL"/i.test(prompt)) return "PASS";
  if (/Ask ONE specific technical question/i.test(prompt)) return "Explain why you chose this implementation and how you would handle an invalid input.";
  if (/portfolio Markdown/i.test(prompt)) return "### 🚀 The Challenge\nBuilt an implementation for the selected engineering ticket.\n\n### 💡 The Solution\nUsed a structured implementation, responsive UI, and clear error handling.\n\n### 🛠️ Skills Demonstrated\nTechnical implementation, debugging, and code organization.";

  return "I can help you explore AI Roadmaps, Eduvo Forge, and CV Matcher Pro. Tell me which feature you would like to try.";
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 2_000_000) throw new Error("Request too large");
  }
  return body ? JSON.parse(body) : {};
}

async function handleGemini(request, response) {
  try {
    const payload = await readJson(request);
    const prompt = payload.contents?.[0]?.parts?.map((part) => part.text || "").join("\n") || "";

    if (geminiKey) {
      const model = "gemini-3-flash-preview";
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      const data = await upstream.text();
      response.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
      response.end(data);
      return;
    }

    const text = geminiText(prompt);
    sendJson(response, 200, { candidates: [{ content: { parts: [{ text }] } }] });
  } catch (error) {
    sendJson(response, 400, { error: { message: error.message } });
  }
}

function serveStatic(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  let filePath = path.join(root, pathname === "/" ? "index.html" : pathname);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!path.extname(filePath)) {
    const htmlPath = filePath + ".html";
    if (fs.existsSync(htmlPath)) filePath = htmlPath;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/gemini") {
    handleGemini(request, response);
  } else if (request.method === "GET") {
    serveStatic(request, response);
  } else {
    response.writeHead(405);
    response.end("Method not allowed");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Eduvo AI is running at http://localhost:${port}`);
  console.log(geminiKey ? "Gemini API: live key configured" : "Gemini API: local preview fallback active");
});
