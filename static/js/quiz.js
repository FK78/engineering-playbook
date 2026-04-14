function buildSidebar(activePage) {
  const nav = {
    "Part 1: Foundations": {
      "part1.html": {
        "Layered Architecture": "layered-architecture",
        "Coupling": "coupling",
        "Fixing Tight Coupling": "fixing-tight-coupling",
        "Testing Loose Coupling": "testing-loosely-coupled-code",
        "Testing Pyramid": "are-mocks-reliable-the-testing-pyramid",
        "Cohesion": "cohesion",
        "Separation of Concerns": "separation-of-concerns",
        "DAO": "dao--data-access-object",
        "Repository Pattern": "repository-pattern",
        "DAO vs Repository": "dao-vs-repository",
        "Key Takeaways": "key-takeaways",
        "Quiz": "check-your-understanding"
      }
    },
    "Part 2: API & Domain": {
      "part2.html": {
        "REST Fundamentals": "rest-fundamentals",
        "REST in Practice": "rest-in-practice",
        "GraphQL": "graphql",
        "REST vs GraphQL": "rest-vs-graphql",
        "Domain Modeling": "domain-modeling",
        "Bounded Contexts": "bounded-contexts",
        "Key Takeaways": "key-takeaways-2",
        "Quiz": "check-your-understanding-2"
      }
    },
    "Part 3: Events & CQRS": {
      "part3.html": {}
    },
    "Part 4: Distributed Systems": {
      "part4.html": {}
    }
  };

  let html = '<h2>Architecture Learning</h2>';

  for (const [partLabel, pages] of Object.entries(nav)) {
    html += `<div class="part-label">${partLabel}</div>`;
    for (const [page, sections] of Object.entries(pages)) {
      const isActive = activePage === page;
      if (isActive && Object.keys(sections).length > 0) {
        for (const [label, anchor] of Object.entries(sections)) {
          html += `<a href="${page}#${anchor}" class="active">${label}</a>`;
        }
      } else {
        const firstSection = Object.values(sections)[0];
        const href = firstSection ? `${page}#${firstSection}` : page;
        const cls = isActive ? 'active' : '';
        const displayLabel = partLabel.replace(/Part \d+: /, '');
        html += `<a href="${href}" class="${cls}">${displayLabel}</a>`;
      }
    }
  }

  const sidebar = document.createElement('nav');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = html;
  document.body.prepend(sidebar);

  // Highlight on scroll
  if (activePage) {
    const links = sidebar.querySelectorAll('a');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(l => l.classList.remove('current'));
          const match = sidebar.querySelector(`a[href="${activePage}#${entry.target.id}"]`);
          if (match) match.classList.add('current');
        }
      });
    }, { threshold: 0.3 });

    document.querySelectorAll('h2[id], h3[id]').forEach(el => observer.observe(el));
  }
}

// Quiz engine with AI grading

const DEFAULT_MODEL = "gpt-4o-mini";

function getApiKey() {
  return localStorage.getItem("openai_api_key");
}

function getModel() {
  return localStorage.getItem("openai_model") || DEFAULT_MODEL;
}

function showKeyPrompt() {
  const existing = getApiKey() || "";
  const model = getModel();
  const overlay = document.createElement("div");
  overlay.id = "key-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:999;";
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:2rem;max-width:450px;width:90%;">
      <h3 style="color:var(--accent);margin-bottom:1rem;">OpenAI API Key</h3>
      <p style="color:var(--muted);margin-bottom:1rem;font-size:0.9rem;">Your key is stored in your browser's localStorage only. Never sent anywhere except OpenAI's API.</p>
      <input id="key-input" type="password" value="${existing}" placeholder="sk-..." style="width:100%;padding:0.6rem;background:var(--code-bg);color:var(--text);border:1px solid var(--border);border-radius:6px;font-family:monospace;margin-bottom:1rem;">
      <label style="color:var(--muted);font-size:0.85rem;display:block;margin-bottom:0.3rem;">Model</label>
      <select id="model-select" style="width:100%;padding:0.5rem;background:var(--code-bg);color:var(--text);border:1px solid var(--border);border-radius:6px;margin-bottom:1rem;">
        <option value="gpt-4o-mini" ${model==="gpt-4o-mini"?"selected":""}>gpt-4o-mini (cheapest)</option>
        <option value="gpt-4o" ${model==="gpt-4o"?"selected":""}>gpt-4o</option>
        <option value="gpt-5.4" ${model==="gpt-5.4"?"selected":""}>gpt-5.4</option>
      </select>
      <div style="display:flex;gap:0.5rem;">
        <button class="quiz-btn" onclick="saveKey()">Save</button>
        <button class="quiz-btn reveal" onclick="document.getElementById('key-overlay').remove()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("key-input").focus();
}

function saveKey() {
  const key = document.getElementById("key-input").value.trim();
  const model = document.getElementById("model-select").value;
  if (key) localStorage.setItem("openai_api_key", key);
  localStorage.setItem("openai_model", model);
  document.getElementById("key-overlay").remove();
}

async function aiGrade(question, userAnswer, modelAnswer) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: getModel(),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are grading a software architecture quiz answer. Be encouraging but honest.

When concepts are "missing", explain WHY they matter and what the student should think about — don't just list them. If the student's answer implies a concept without stating it explicitly, give them credit.

Respond in this exact JSON format:
{"score": <0-100>, "grade": "<emoji> <short label>", "covered": ["concept 1", "concept 2"], "missing": ["concept 3"], "feedback": "<2-3 sentences: acknowledge what they got right, then explain what's missing and WHY it matters for their understanding>"}`
        },
        {
          role: "user",
          content: `Question: ${question}\n\nStudent's answer: ${userAnswer}\n\nModel answer: ${modelAnswer}\n\nGrade the student's answer. Consider meaning and intent, not exact wording.`
        }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${response.status} — ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content.trim();
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (parseErr) {
    console.error("Failed to parse AI response:", text);
    throw new Error("Could not parse AI response");
  }
}

// Fallback local grading (concept groups)
function conceptHit(input, concept) {
  return concept.some(term => {
    const t = term.toLowerCase();
    if (input.includes(t)) return true;
    const words = t.split(/\s+/);
    if (words.length > 1) return words.every(w => input.includes(w));
    if (t.length >= 4) {
      const re = new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      return re.test(input);
    }
    return false;
  });
}

function localGrade(input, concepts) {
  const results = concepts.map(c => ({ label: c.label, hit: conceptHit(input, c.terms) }));
  const hits = results.filter(r => r.hit);
  const misses = results.filter(r => !r.hit);
  const pct = Math.round((hits.length / results.length) * 100);
  return { hits, misses, pct };
}

function initQuiz(questions) {
  const container = document.getElementById('quiz-container');
  if (!container) return;

  // Settings button
  const settings = document.createElement('div');
  settings.style.cssText = 'text-align:right;margin-bottom:1rem;';
  const hasKey = getApiKey();
  settings.innerHTML = `<button class="quiz-btn" onclick="showKeyPrompt()" style="font-size:0.85rem;padding:0.4rem 0.8rem;background:${hasKey ? '#4caf50' : 'var(--accent)'};">
    ${hasKey ? '🤖 AI Grading: ' + getModel() : '⚙️ Set API Key for AI Grading'}
  </button>`;
  container.appendChild(settings);

  questions.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'quiz-card';
    div.innerHTML = `
      <h4>Question ${i + 1}</h4>
      <p>${item.q}</p>
      <textarea id="answer-${i}" placeholder="Type your answer here..."></textarea>
      <br>
      <button class="quiz-btn" onclick="checkOne(${i})">Check</button>
      <button class="quiz-btn reveal" onclick="revealOne(${i})">Reveal Answer</button>
      <div class="quiz-feedback" id="feedback-${i}"></div>
    `;
    container.appendChild(div);
  });

  window._quizQuestions = questions;
}

async function checkOne(i) {
  const input = document.getElementById('answer-' + i).value;
  const fb = document.getElementById('feedback-' + i);
  const item = window._quizQuestions[i];

  if (!input.trim()) {
    fb.className = 'quiz-feedback show';
    fb.innerHTML = '<span class="miss">Write your answer first!</span>';
    return 0;
  }

  // Try AI grading first
  if (getApiKey()) {
    fb.className = 'quiz-feedback show';
    fb.innerHTML = '<span style="color:var(--muted);">🤖 Checking with AI...</span>';

    try {
      const result = await aiGrade(item.q, input, item.answer);
      if (result) {
        let color;
        if (result.score >= 80) color = '#4caf50';
        else if (result.score >= 50) color = '#f0a500';
        else color = '#e94560';

        let html = `<div class="score" style="color:${color}">${result.grade} — ${result.score}%</div>`;
        if (result.covered?.length) html += `<p class="hit">✓ You covered: ${result.covered.join(', ')}</p>`;
        if (result.missing?.length) html += `<p class="miss">✗ Missing: ${result.missing.join(', ')}</p>`;
        if (result.feedback) html += `<p style="color:var(--text);margin-top:0.5rem;">${result.feedback}</p>`;
        html += `<div class="model-answer"><strong>Model answer:</strong> ${item.answer}</div>`;

        fb.innerHTML = html;
        return result.score;
      }
    } catch (e) {
      console.error("AI grading failed:", e);
      // Show error but still fall back to local
      let html = `<p style="color:var(--accent);margin-bottom:0.8rem;">⚠️ AI grading failed: ${e.message}<br><small style="color:var(--muted);">Using local grading instead. Check browser console (F12) for details. Make sure your API key is valid and the model name is correct.</small></p>`;

      // Fall through to local grading below
      const inputLower = input.toLowerCase();
      const { hits, misses, pct } = localGrade(inputLower, item.concepts);
      let grade, color;
      if (pct >= 80) { grade = '🟢 Excellent!'; color = '#4caf50'; }
      else if (pct >= 50) { grade = '🟡 Good, but missing some points'; color = '#f0a500'; }
      else { grade = '🔴 Needs work'; color = '#e94560'; }
      html += `<div class="score" style="color:${color}">${grade} — ${pct}% (local check)</div>`;
      if (hits.length > 0) html += `<p class="hit">✓ You covered: ${hits.map(h => h.label).join(', ')}</p>`;
      if (misses.length > 0) html += `<p class="miss">✗ Missing: ${misses.map(m => m.label).join(', ')}</p>`;
      html += `<div class="model-answer"><strong>Model answer:</strong> ${item.answer}</div>`;
      fb.className = 'quiz-feedback show';
      fb.innerHTML = html;
      return pct;
    }
  }

  // Fallback: local concept matching
  const inputLower = input.toLowerCase();
  const { hits, misses, pct } = localGrade(inputLower, item.concepts);

  let grade, color;
  if (pct >= 80) { grade = '🟢 Excellent!'; color = '#4caf50'; }
  else if (pct >= 50) { grade = '🟡 Good, but missing some points'; color = '#f0a500'; }
  else { grade = '🔴 Needs work'; color = '#e94560'; }

  let html = `<div class="score" style="color:${color}">${grade} — ${pct}% of key concepts covered</div>`;
  if (hits.length > 0) html += `<p class="hit">✓ You covered: ${hits.map(h => h.label).join(', ')}</p>`;
  if (misses.length > 0) html += `<p class="miss">✗ Missing: ${misses.map(m => m.label).join(', ')}</p>`;
  html += `<div class="model-answer"><strong>Model answer:</strong> ${item.answer}</div>`;

  fb.className = 'quiz-feedback show';
  fb.innerHTML = html;
  return pct;
}

function revealOne(i) {
  const fb = document.getElementById('feedback-' + i);
  fb.className = 'quiz-feedback show';
  fb.innerHTML = `<div class="model-answer" style="border:none;padding:0;margin:0;"><strong>Model answer:</strong> ${window._quizQuestions[i].answer}</div>`;
}

async function checkAll() {
  let total = 0, answered = 0;
  for (let i = 0; i < window._quizQuestions.length; i++) {
    const input = document.getElementById('answer-' + i).value.trim();
    if (input) {
      const score = await checkOne(i);
      total += (score || 0);
      answered++;
    } else { await checkOne(i); }
  }
  if (answered > 0) {
    const el = document.getElementById('overall-score');
    el.style.display = 'block';
    el.textContent = `Overall: ${Math.round(total / answered)}% across ${answered} question${answered > 1 ? 's' : ''}`;
  }
}

function revealAll() {
  window._quizQuestions.forEach((_, i) => revealOne(i));
}

// ===== CASE STUDY ENGINE =====

function initCaseStudies(studies) {
  const container = document.getElementById('case-studies');
  if (!container || !studies) return;

  studies.forEach((study, i) => {
    const div = document.createElement('div');
    div.className = 'case-study-card';
    div.innerHTML = `
      <div class="case-study-header">
        <span class="case-study-badge">${study.category || 'Case Study'}</span>
        <span class="case-study-difficulty">${study.difficulty || '⭐⭐'}</span>
      </div>
      <h4>${study.title}</h4>
      <div class="case-study-scenario">${study.scenario}</div>
      ${study.constraints ? `<div class="case-study-constraints"><strong>Constraints:</strong> ${study.constraints}</div>` : ''}
      <div class="case-study-prompts">
        ${study.prompts.map(p => `<div class="case-study-prompt">💡 ${p}</div>`).join('')}
      </div>
      <textarea id="case-answer-${i}" placeholder="Describe your approach, reasoning, and trade-offs..."></textarea>
      <br>
      <button class="quiz-btn" onclick="evaluateCaseStudy(${i})">Evaluate My Approach</button>
      <button class="quiz-btn reveal" onclick="revealCaseApproaches(${i})">Show Possible Approaches</button>
      <div class="case-study-feedback" id="case-feedback-${i}"></div>
    `;
    container.appendChild(div);
  });

  window._caseStudies = studies;
}

async function evaluateCaseStudy(i) {
  const input = document.getElementById('case-answer-' + i).value;
  const fb = document.getElementById('case-feedback-' + i);
  const study = window._caseStudies[i];

  if (!input.trim()) {
    fb.className = 'case-study-feedback show';
    fb.innerHTML = '<span style="color:#c62828;">Write your approach first!</span>';
    return;
  }

  const apiKey = typeof getApiKey === 'function' ? getApiKey() : null;

  if (apiKey) {
    fb.className = 'case-study-feedback show';
    fb.innerHTML = '<span style="opacity:0.6;">🤖 Evaluating your approach...</span>';

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: (typeof getModel === 'function' ? getModel() : "gpt-4o-mini"),
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are evaluating a software architecture case study response. Assess the answer across four dimensions. Be encouraging but honest. Consider that there are multiple valid approaches.

Respond in this exact JSON format:
{
  "business_insight": {"score": <0-10>, "feedback": "<1-2 sentences>"},
  "creativity": {"score": <0-10>, "feedback": "<1-2 sentences>"},
  "decision_making": {"score": <0-10>, "feedback": "<1-2 sentences>"},
  "communication": {"score": <0-10>, "feedback": "<1-2 sentences>"},
  "overall": <0-100>,
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["suggestion 1", "suggestion 2"],
  "summary": "<2-3 sentences of overall feedback>"
}`
            },
            {
              role: "user",
              content: `Case Study: ${study.title}\n\nScenario: ${study.scenario}\n${study.constraints ? 'Constraints: ' + study.constraints : ''}\n\nPrompts to consider: ${study.prompts.join('; ')}\n\nPossible approaches for reference: ${study.approaches.map(a => a.name + ': ' + a.description).join('; ')}\n\nStudent's response:\n${input}`
            }
          ]
        })
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      const text = data.choices[0].message.content.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (result) {
        fb.innerHTML = renderCaseStudyFeedback(result);
        fb.className = 'case-study-feedback show';
        return;
      }
    } catch (e) {
      console.error("AI evaluation failed:", e);
    }
  }

  // Fallback: show approaches without AI scoring
  fb.className = 'case-study-feedback show';
  fb.innerHTML = `<p style="opacity:0.6;">Set an OpenAI API key (via the quiz settings above) for AI-powered evaluation of your approach.</p>` + renderApproaches(study);
}

function renderCaseStudyFeedback(result) {
  const dims = [
    { key: 'business_insight', label: '📊 Business Insight', color: '#1565c0' },
    { key: 'creativity', label: '💡 Creativity', color: '#7b1fa2' },
    { key: 'decision_making', label: '⚖️ Decision Making', color: '#2e7d32' },
    { key: 'communication', label: '🗣️ Communication', color: '#e65100' }
  ];

  let html = `<div class="case-study-overall">Overall: <strong>${result.overall}%</strong></div>`;
  html += '<div class="case-study-dimensions">';
  for (const dim of dims) {
    const d = result[dim.key];
    if (!d) continue;
    const pct = d.score * 10;
    html += `<div class="case-study-dim">
      <div class="dim-header">${dim.label} <span>${d.score}/10</span></div>
      <div class="dim-bar"><div class="dim-fill" style="width:${pct}%;background:${dim.color}"></div></div>
      <div class="dim-feedback">${d.feedback}</div>
    </div>`;
  }
  html += '</div>';

  if (result.strengths?.length) {
    html += '<div class="case-strengths"><strong>Strengths:</strong> ' + result.strengths.map(s => `<span class="strength-tag">✓ ${s}</span>`).join(' ') + '</div>';
  }
  if (result.improvements?.length) {
    html += '<div class="case-improvements"><strong>Could improve:</strong> ' + result.improvements.map(s => `<span class="improve-tag">→ ${s}</span>`).join(' ') + '</div>';
  }
  if (result.summary) {
    html += `<div class="case-summary">${result.summary}</div>`;
  }
  return html;
}

function renderApproaches(study) {
  let html = '<div class="case-approaches"><strong>Possible approaches:</strong>';
  for (const a of study.approaches) {
    html += `<div class="case-approach">
      <strong>${a.name}</strong>${a.trade_off ? ` <span style="opacity:0.6;">— ${a.trade_off}</span>` : ''}
      <p>${a.description}</p>
    </div>`;
  }
  html += '</div>';
  return html;
}

function revealCaseApproaches(i) {
  const fb = document.getElementById('case-feedback-' + i);
  fb.className = 'case-study-feedback show';
  fb.innerHTML = renderApproaches(window._caseStudies[i]);
}

// ===== INTERACTIVE CASE STUDY ENGINE =====

function initInteractiveCases(cases) {
  const container = document.getElementById('interactive-cases');
  if (!container || !cases) return;

  const apiKey = typeof getApiKey === 'function' ? getApiKey() : null;
  if (!apiKey) {
    container.innerHTML = `<div class="callout info"><strong>API key required.</strong> Interactive case studies need an OpenAI API key. Set one using the quiz settings button above.</div>`;
    return;
  }

  cases.forEach((c, i) => {
    const typeInfo = {
      'great-unknown': { icon: '🔍', label: 'The Great Unknown', color: '#7b1fa2', desc: 'Minimal information. Probe for details, build a framework as facts emerge.' },
      'parade-of-facts': { icon: '📊', label: 'The Parade of Facts', color: '#1565c0', desc: 'Heavy on details, some irrelevant. Distil what matters, analyse deeply.' },
      'back-of-envelope': { icon: '🧮', label: 'The Back of Envelope', color: '#2e7d32', desc: 'Little info, one key question. Think logically, estimate with numbers.' }
    }[c.type] || { icon: '📋', label: 'Case Study', color: '#555', desc: '' };

    const div = document.createElement('div');
    div.className = 'ic-card';
    div.style.borderLeftColor = typeInfo.color;
    div.innerHTML = `
      <div class="ic-header">
        <span class="ic-badge" style="background:${typeInfo.color}">${typeInfo.icon} ${typeInfo.label}</span>
        <span class="ic-difficulty">${c.difficulty || '⭐⭐'}</span>
      </div>
      <h4>${c.title}</h4>
      <p class="ic-type-desc">${typeInfo.desc}</p>
      <div class="ic-brief">${c.brief}</div>
      <div class="ic-chat" id="ic-chat-${i}">
        <div class="ic-msg ic-ai">${c.opening}</div>
      </div>
      <div class="ic-input-row">
        <textarea id="ic-input-${i}" placeholder="Type your response..." rows="3"></textarea>
        <button class="quiz-btn" onclick="icSend(${i})" id="ic-send-${i}">Send</button>
      </div>
      <button class="quiz-btn reveal" onclick="icEnd(${i})" id="ic-end-${i}" style="margin-top:0.5rem;">End & Get Evaluation</button>
      <div class="ic-evaluation" id="ic-eval-${i}"></div>
    `;
    container.appendChild(div);

    // Store conversation history per case
    window['_icHistory' + i] = [
      { role: 'system', content: buildICSystemPrompt(c) },
      { role: 'assistant', content: c.opening }
    ];
  });

  window._interactiveCases = cases;
}

function buildICSystemPrompt(c) {
  const typeInstructions = {
    'great-unknown': `You are a client/stakeholder presenting a vague problem. The student must ask probing questions to uncover details. 
START with minimal information. Only reveal details when the student asks good questions. 
If they jump to solutions without asking questions, gently redirect: "That's interesting, but what would you want to understand first?"
You have these hidden facts to reveal when asked: ${c.hidden_facts}
After 6-8 exchanges, start wrapping up.`,

    'parade-of-facts': `You are presenting a case with lots of data. Some facts are critical, others are red herrings.
If the student focuses on irrelevant details, let them — that's part of the test.
If they ask for clarification on key issues, provide deeper data.
Key issues they should identify: ${c.key_issues}
Red herrings in the scenario: ${c.red_herrings}
After 4-6 exchanges, start wrapping up.`,

    'back-of-envelope': `You are an interviewer testing estimation and analytical thinking.
The student should break the problem into components and estimate each.
If their approach is reasonable, provide encouragement and ask them to refine.
If they're stuck, give ONE hint, not the answer.
Reasonable answer range: ${c.answer_range}
Key assumptions to test: ${c.key_assumptions}
After 4-6 exchanges, start wrapping up.`
  };

  return `You are conducting an interactive architecture case study interview. Be conversational, realistic, and challenging but fair.

Type: ${c.type}
${typeInstructions[c.type] || ''}

RULES:
- Stay in character as the interviewer/client throughout
- Keep responses to 2-4 sentences
- Push back on weak reasoning — ask "why?" or "what if?"
- Don't give away answers — guide through questions
- Track what the student has covered well and what they've missed
- When the conversation ends, you'll be asked for a final evaluation separately`;
}

async function icSend(i) {
  const input = document.getElementById('ic-input-' + i);
  const chat = document.getElementById('ic-chat-' + i);
  const btn = document.getElementById('ic-send-' + i);
  const text = input.value.trim();
  if (!text) return;

  // Add user message
  chat.innerHTML += `<div class="ic-msg ic-user">${escapeHtml(text)}</div>`;
  input.value = '';
  btn.disabled = true;
  btn.textContent = '...';

  // Add to history
  const history = window['_icHistory' + i];
  history.push({ role: 'user', content: text });

  try {
    const apiKey = getApiKey();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: (typeof getModel === 'function' ? getModel() : "gpt-4o-mini"),
        temperature: 0.4,
        messages: history
      })
    });

    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    const reply = data.choices[0].message.content;

    history.push({ role: 'assistant', content: reply });
    chat.innerHTML += `<div class="ic-msg ic-ai">${reply}</div>`;
  } catch (e) {
    chat.innerHTML += `<div class="ic-msg ic-ai" style="color:#c62828;">Error: ${e.message}</div>`;
  }

  btn.disabled = false;
  btn.textContent = 'Send';
  chat.scrollTop = chat.scrollHeight;
}

async function icEnd(i) {
  const evalDiv = document.getElementById('ic-eval-' + i);
  const c = window._interactiveCases[i];
  const history = window['_icHistory' + i];
  const endBtn = document.getElementById('ic-end-' + i);
  endBtn.disabled = true;
  evalDiv.className = 'ic-evaluation show';
  evalDiv.innerHTML = '<span style="opacity:0.6;">🤖 Generating evaluation...</span>';

  const evalPrompts = {
    'great-unknown': 'Evaluate: Did they ask probing questions before jumping to solutions? Did they uncover the key hidden facts? Did they build a structured framework?',
    'parade-of-facts': 'Evaluate: Did they identify the key issues vs red herrings? Did they go deep on what matters? Was their analysis structured?',
    'back-of-envelope': 'Evaluate: Was their estimation approach logical? Did they break it into components? Were their numbers in a reasonable range? Did they state assumptions?'
  };

  try {
    const apiKey = getApiKey();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: (typeof getModel === 'function' ? getModel() : "gpt-4o-mini"),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          ...history,
          { role: 'user', content: `The case study conversation is now over. ${evalPrompts[c.type] || ''}

Provide a final evaluation as JSON:
{
  "overall_score": <0-100>,
  "probing_skill": {"score": <0-10>, "feedback": "<what they did well/missed in questioning>"},
  "analytical_depth": {"score": <0-10>, "feedback": "<quality of their analysis>"},
  "structure": {"score": <0-10>, "feedback": "<how organized was their thinking>"},
  "business_awareness": {"score": <0-10>, "feedback": "<did they consider business impact>"},
  "strengths": ["...", "..."],
  "missed": ["...", "..."],
  "summary": "<3-4 sentence overall assessment>"
}` }
        ]
      })
    });

    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    const text = data.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (result) {
      evalDiv.innerHTML = renderICEvaluation(result);
    } else {
      evalDiv.innerHTML = '<p>Could not parse evaluation.</p>';
    }
  } catch (e) {
    evalDiv.innerHTML = `<p style="color:#c62828;">Evaluation failed: ${e.message}</p>`;
  }
  endBtn.disabled = false;
}

function renderICEvaluation(r) {
  const dims = [
    { key: 'probing_skill', label: '🔍 Probing Skill', color: '#7b1fa2' },
    { key: 'analytical_depth', label: '📊 Analytical Depth', color: '#1565c0' },
    { key: 'structure', label: '🏗️ Structure', color: '#e65100' },
    { key: 'business_awareness', label: '💼 Business Awareness', color: '#2e7d32' }
  ];

  let html = `<div class="case-study-overall">Overall: <strong>${r.overall_score}%</strong></div>`;
  html += '<div class="case-study-dimensions">';
  for (const dim of dims) {
    const d = r[dim.key];
    if (!d) continue;
    html += `<div class="case-study-dim">
      <div class="dim-header">${dim.label} <span>${d.score}/10</span></div>
      <div class="dim-bar"><div class="dim-fill" style="width:${d.score*10}%;background:${dim.color}"></div></div>
      <div class="dim-feedback">${d.feedback}</div>
    </div>`;
  }
  html += '</div>';
  if (r.strengths?.length) html += '<div class="case-strengths"><strong>Strengths:</strong> ' + r.strengths.map(s => `<span class="strength-tag">✓ ${s}</span>`).join(' ') + '</div>';
  if (r.missed?.length) html += '<div class="case-improvements"><strong>Missed:</strong> ' + r.missed.map(s => `<span class="improve-tag">→ ${s}</span>`).join(' ') + '</div>';
  if (r.summary) html += `<div class="case-summary">${r.summary}</div>`;
  return html;
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}
