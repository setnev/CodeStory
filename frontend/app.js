// frontend/app.js

const analyzeBtn = document.getElementById('analyze-btn');
const codeInput = document.getElementById('code-input');
const languageSelect = document.getElementById('language');
const skillSelect = document.getElementById('skill-level');
const providerSelect = document.getElementById('provider');
const modelSelect = document.getElementById('model');
const outputPanel = document.getElementById('output-panel');
const summaryEl = document.getElementById('summary');
const walkthroughEl = document.getElementById('walkthrough');
const perfIssuesEl = document.getElementById('issues-performance');
const secIssuesEl = document.getElementById('issues-security');
const maintIssuesEl = document.getElementById('issues-maintainability');
const suggestionsEl = document.getElementById('suggestions');
const riskOverviewEl = document.getElementById('risk-overview');
const copySummaryBtn = document.getElementById('copy-summary-btn');
const copyRiskBtn = document.getElementById('copy-risk-btn');
const copyIssuesBtn = document.getElementById('copy-issues-btn');
const copySuggestionsBtn = document.getElementById('copy-suggestions-btn');
const copyFullReportBtn = document.getElementById('copy-full-report-btn');
const codeViewEl = document.getElementById('code-view');
let lastResult = null;      // already added earlier
let lastCodeLines = [];     // new: hold split code lines
let lineToStepIndex = {};
let canonicalAnnotations = [];

function renderIssueList(container, issues) {
  container.innerHTML = '';
  (issues || []).forEach(issue => {
    const li = document.createElement('li');

    if (typeof issue === 'string') {
      // Fallback for old responses
      li.textContent = issue;
    } else {
      const severity = (issue.severity || 'medium').toLowerCase();
      const message = issue.message || '';
      const explanation = issue.explanation || '';

      const sevTag = document.createElement('strong');
      sevTag.textContent = `[${severity.toUpperCase()}] `;
      li.appendChild(sevTag);

      const msgSpan = document.createElement('span');
      msgSpan.textContent = message;
      li.appendChild(msgSpan);

      if (explanation) {
        const expDiv = document.createElement('div');
        expDiv.textContent = ' – ' + explanation;
        li.appendChild(expDiv);
      }
    }

    container.appendChild(li);
  });
}

function computeStepRanges(numLines, numSteps) {
  if (numLines <= 0 || numSteps <= 0) return [];

  // Base number of lines per step
  const base = Math.floor(numLines / numSteps);
  let extra = numLines % numSteps;

  const ranges = [];
  let current = 1;

  for (let i = 0; i < numSteps; i++) {
    // Distribute remainder: the first `extra` steps get one extra line
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;

    const start = current;
    // Ensure the last range ends exactly at numLines
    const end = (i === numSteps - 1) ? numLines : current + size - 1;

    ranges.push({ start, end });
    current = end + 1;
  }

  return ranges;
}


function renderCodeView(code) {
  const text = String(code || '');
  const lines = text.split('\n');
  lastCodeLines = lines;

  codeViewEl.innerHTML = '';
  lineToStepIndex = {};
  canonicalAnnotations = [];

  const totalLines = lines.length;
  const numSteps = lastResult && Array.isArray(lastResult.walkthrough)
    ? lastResult.walkthrough.length
    : 0;

  // Build a cleaned, ordered annotation list and align it to step order
  if (lastResult && Array.isArray(lastResult.annotations) && totalLines > 0 && numSteps > 0) {
    const raw = lastResult.annotations
      .map(ann => {
        let start = Number(ann.start_line);
        let end = Number(ann.end_line ?? ann.start_line);

        if (!Number.isFinite(start)) start = 1;
        if (!Number.isFinite(end)) end = start;

        // clamp to valid range
        start = Math.max(1, Math.min(totalLines, start));
        end = Math.max(start, Math.min(totalLines, end));

        return { start_line: start, end_line: end, note: String(ann.note ?? '') };
      })
      .filter(ann => ann.start_line >= 1 && ann.start_line <= totalLines);

    // Sort by start_line so annotations go top-to-bottom
    raw.sort((a, b) => a.start_line - b.start_line);

    // We only care about as many annotations as we have steps
    canonicalAnnotations = raw.slice(0, numSteps);

    // Build line -> step index map based on this ordered list
    canonicalAnnotations.forEach((ann, stepIdx) => {
      for (let ln = ann.start_line; ln <= ann.end_line; ln++) {
        if (lineToStepIndex[ln] === undefined) {
          lineToStepIndex[ln] = stepIdx;
        }
      }
    });
  }

  // Render code lines with optional stepIndex mapping
  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;

    const div = document.createElement('div');
    div.className = 'code-line';
    div.dataset.line = String(lineNumber);

    const mappedStep = lineToStepIndex[lineNumber];
    if (mappedStep !== undefined) {
      div.dataset.stepIndex = String(mappedStep);
    }

    const numSpan = document.createElement('span');
    numSpan.className = 'line-number';
    numSpan.textContent = lineNumber.toString().padStart(3, ' ');

    const textSpan = document.createElement('span');
    textSpan.className = 'code-text';
    textSpan.textContent = line;

    div.appendChild(numSpan);
    div.appendChild(textSpan);

    // Hovering a code line → highlight its step + lines
    div.addEventListener('mouseenter', () => {
      const s = div.dataset.stepIndex;
      if (s !== undefined) {
        const idx = Number(s);
        highlightLinesForStep(idx);
        highlightStepElement(idx);
      }
    });

    div.addEventListener('mouseleave', () => {
      clearHighlights();
      clearStepHighlights();
    });

    codeViewEl.appendChild(div);
  });
}


function clearHighlights() {
  const lines = codeViewEl.querySelectorAll('.code-line.highlight');
  lines.forEach(el => el.classList.remove('highlight'));
}

function highlightLinesForStep(stepIndex) {
  clearHighlights();

  const idx = Number(stepIndex);
  if (!Array.isArray(canonicalAnnotations) || idx < 0 || idx >= canonicalAnnotations.length) {
    return;
  }

  const totalLines = lastCodeLines.length;
  const ann = canonicalAnnotations[idx];

  let start = Number(ann.start_line);
  let end = Number(ann.end_line ?? ann.start_line);

  if (!Number.isFinite(start)) start = 1;
  if (!Number.isFinite(end)) end = start;

  // Clamp to valid range
  start = Math.max(1, Math.min(totalLines, start));
  end = Math.max(start, Math.min(totalLines, end));

  // === Trim leading/trailing blank lines inside this range ===
  // Use lastCodeLines (0-based) to inspect the text.
  while (start <= end) {
    const text = (lastCodeLines[start - 1] || '').trim();
    if (text === '') {
      start++;
    } else {
      break;
    }
  }

  while (end >= start) {
    const text = (lastCodeLines[end - 1] || '').trim();
    if (text === '') {
      end--;
    } else {
      break;
    }
  }
  // ==========================================================

  for (let ln = start; ln <= end; ln++) {
    const lineEl = codeViewEl.querySelector(`.code-line[data-line="${ln}"]`);
    if (lineEl) {
      lineEl.classList.add('highlight');
    }
  }

  highlightStepElement(idx);
}

async function copyToClipboard(text, label) {
  if (!text || !text.trim()) {
    alert(`No ${label} available to copy yet. Run an analysis first.`);
    return;
  }

  if (!navigator.clipboard) {
    // Older browser fallback
    const tmp = document.createElement('textarea');
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
    alert(`${label} copied to clipboard.`);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard.`);
  } catch (err) {
    console.error('Clipboard error:', err);
    alert(`Could not copy ${label}. Check browser permissions.`);
  }
}
function buildIssuesText(issuesByCategory) {
  let parts = [];

  const addCategory = (name, items) => {
    if (!Array.isArray(items) || items.length === 0) return;
    parts.push(`${name}:`);
    for (const item of items) {
      if (typeof item === 'string') {
        parts.push(`  - ${item}`);
      } else {
        const sev = (item.severity || 'medium').toUpperCase();
        const msg = item.message || '';
        const expl = item.explanation || '';
        if (expl) {
          parts.push(`  - [${sev}] ${msg} — ${expl}`);
        } else {
          parts.push(`  - [${sev}] ${msg}`);
        }
      }
    }
    parts.push(''); // blank line
  };

  addCategory('Performance', issuesByCategory.performance);
  addCategory('Security', issuesByCategory.security);
  addCategory('Maintainability', issuesByCategory.maintainability);

  return parts.join('\n');
}

analyzeBtn.addEventListener('click', async () => {
  const code = codeInput.value;
  const language = languageSelect.value;
  const skillLevel = skillSelect.value;
  const provider = providerSelect.value;
  const model = modelSelect.value;

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';

  try {
    const response = await fetch('http://localhost:4000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        language,
        skillLevel,
        provider,
        model,
      }),
    });
    const data = await response.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    renderResults(data);
  } catch (err) {
    console.error(err);
    alert('There was an error talking to the analyzer.');
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze Code';
  }
})
copySummaryBtn.addEventListener('click', () => {
  if (!lastResult) {
    alert('Run an analysis first.');
    return;
  }

  const text = [
    'Summary:',
    lastResult.summary || '',
  ].join('\n');
  copyToClipboard(text, 'summary');
});

copyRiskBtn.addEventListener('click', () => {
  if (!lastResult) {
    alert('Run an analysis first.');
    return;
  }

  const text = [
    'Summary:',
    lastResult.summary || '',
    '',
    'Risk overview:',
    lastResult.risk_overview || '',
  ].join('\n');
  copyToClipboard(text, 'summary + risk overview');
});

copyIssuesBtn.addEventListener('click', () => {
  if (!lastResult) {
    alert('Run an analysis first.');
    return;
  }

  const text = [
    'Issues:',
    '',
    buildIssuesText(lastResult.issues || {}),
  ].join('\n');
  copyToClipboard(text, 'issues');
});

copySuggestionsBtn.addEventListener('click', () => {
  if (!lastResult) {
    alert('Run an analysis first.');
    return;
  }

  const suggestions = Array.isArray(lastResult.suggestions)
    ? lastResult.suggestions
    : [];

  const text = [
    'Suggestions:',
    '',
    ...suggestions.map(s => `- ${s}`),
  ].join('\n');
  copyToClipboard(text, 'suggestions');
});

copyFullReportBtn.addEventListener('click', () => {
  if (!lastResult) {
    alert('Run an analysis first.');
    return;
  }

  const suggestions = Array.isArray(lastResult.suggestions)
    ? lastResult.suggestions
    : [];

  const fullText = [
    'Summary:',
    lastResult.summary || '',
    '',
    'Risk overview:',
    lastResult.risk_overview || '',
    '',
    'Step-by-step walkthrough:',
    '',
    ...(Array.isArray(lastResult.walkthrough)
      ? lastResult.walkthrough.map((step, i) => `${i + 1}. ${step}`)
      : []),
    '',
    'Issues:',
    '',
    buildIssuesText(lastResult.issues || {}),
    'Suggestions:',
    '',
    ...suggestions.map(s => `- ${s}`),
  ].join('\n');

  copyToClipboard(fullText, 'full report');
});
function clearStepHighlights() {
  const items = walkthroughEl.querySelectorAll('.walkthrough-step.highlight-step');
  items.forEach(li => li.classList.remove('highlight-step'));
}

function highlightStepElement(stepIndex) {
  const idx = Number(stepIndex);
  const items = walkthroughEl.querySelectorAll('.walkthrough-step');

  items.forEach((li, i) => {
    if (i === idx) {
      li.classList.add('highlight-step');
    } else {
      li.classList.remove('highlight-step');
    }
  });
}

function renderResults(data) {
  lastResult = data;

  summaryEl.textContent = data.summary || '';
  riskOverviewEl.textContent = data.risk_overview || '';

  // render code view based on current textarea content
  renderCodeView(codeInput.value);

  walkthroughEl.innerHTML = '';
  (data.walkthrough || []).forEach((step, idx) => {
    const li = document.createElement('li');
    li.textContent = step;
    li.dataset.stepIndex = String(idx);
    li.classList.add('walkthrough-step');

    li.addEventListener('mouseenter', () => {
      highlightLinesForStep(idx);
      highlightStepElement(idx);
    });

    li.addEventListener('mouseleave', () => {
      clearHighlights();
      clearStepHighlights();
    });

    walkthroughEl.appendChild(li);
  });

  renderIssueList(perfIssuesEl, data.issues?.performance);
  renderIssueList(secIssuesEl, data.issues?.security);
  renderIssueList(maintIssuesEl, data.issues?.maintainability);

  suggestionsEl.innerHTML = '';
  (data.suggestions || []).forEach(s => {
    const li = document.createElement('li');
    li.textContent = s;
    suggestionsEl.appendChild(li);
  });

  outputPanel.style.display = 'block';
}

