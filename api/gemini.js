module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: { message: "Method not allowed" } });
  }

  try {
    const prompt = request.body?.contents?.[0]?.parts
      ?.map((part) => part.text || "")
      .join("\n") || "";
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      let text = "I can help you explore AI Roadmaps, Eduvo Forge, and CV Matcher Pro.";

      if (/Act as an expert Career Counselor/i.test(prompt)) {
        text = JSON.stringify({
          title: "Roadmap: Software Engineer",
          sourceGoal: "Based on your career preferences",
          steps: [
            {
              title: "Step 1: Learn the fundamentals",
              description: "Learn core programming concepts and the tools used in software engineering.",
              courses: [
                { name: "Foundational programming", platform: "FreeCodeCamp" },
                { name: "Official learning path", platform: "Google" }
              ]
            },
            {
              title: "Step 2: Build projects",
              description: "Apply your knowledge with practical projects and document your work.",
              courses: [
                { name: "Project-based learning", platform: "Coursera" },
                { name: "Hands-on tutorials", platform: "YouTube" }
              ]
            }
          ]
        });
      }

      return response.status(200).json({
        candidates: [{ content: { parts: [{ text }] } }]
      });
    }

    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" +
        encodeURIComponent(key),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body)
      }
    );
    const data = await upstream.text();

    response.setHeader("Content-Type", "application/json");
    return response.status(upstream.status).send(data);
  } catch (error) {
    return response.status(500).json({
      error: { message: error.message || "Gemini request failed" }
    });
  }
};
