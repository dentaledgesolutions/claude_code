#!/usr/bin/env node
/**
 * Execution phase: calls Claude API with skill/agent definition as system prompt,
 * then grades the output against scenario assertions using a second model call.
 *
 * Usage:
 *   node scripts/codex/run-execution-phase.js <run-dir> <target-name> <skill|agent>
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 * Only executes positive scenarios (expected_triggers/dispatches = true).
 * Can be called standalone on an existing run dir, or invoked by the skill/agent runners.
 */
const https = require('https');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

const EXEC_MODEL  = 'claude-haiku-4-5-20251001';
const GRADE_MODEL = 'claude-sonnet-4-6';

const [,, runDir, targetName, targetType] = process.argv;
const isHelp = process.argv.includes('--help') || process.argv.includes('-h');

const USAGE = [
  'Usage: node scripts/codex/run-execution-phase.js <run-dir> <target-name> <skill|agent>',
  '',
  'Calls the Claude API with the skill/agent definition as system prompt and the',
  'scenario prompt as user message, then grades output against scenario assertions.',
  '',
  'Requires: ANTHROPIC_API_KEY environment variable',
  'Only runs for positive scenarios (expected_triggers/dispatches = true).',
  '',
  'Example:',
  '  node scripts/codex/run-execution-phase.js \\',
  '    evals/codex-runs/skills/skill-eval/<run-id> skill-eval skill',
].join('\n');

if (isHelp || !runDir || !targetName || !targetType) {
  console.log(USAGE);
  process.exit(isHelp ? 0 : 1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Error: ANTHROPIC_API_KEY not set.');
  console.error('Run: export ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

const isSkill = targetType === 'skill';

// ── Load definition file ──────────────────────────────────────────────────────
const defPath = isSkill
  ? path.join('skills', targetName, 'SKILL.md')
  : path.join('.claude', 'agents', `${targetName}.md`);

if (!existsSync(defPath)) {
  console.error(`Error: ${defPath} not found.`);
  process.exit(1);
}
const defContent = readFileSync(defPath, 'utf8');

// ── Load eval-spec and evals.json ─────────────────────────────────────────────
const specPath = path.join(runDir, 'eval-spec.json');
if (!existsSync(specPath)) {
  console.error(`Error: ${specPath} not found. Run the eval first to create the run directory.`);
  process.exit(1);
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'));

const evalsPath = isSkill
  ? path.join('evals', targetName, 'evals.json')
  : path.join('evals', 'agents', targetName, 'evals.json');

if (!existsSync(evalsPath)) {
  console.error(`Error: ${evalsPath} not found. Generate seed evals first.`);
  process.exit(1);
}
const evalMap = new Map(
  JSON.parse(readFileSync(evalsPath, 'utf8')).evals.map(e => [e.id, e])
);

// ── Anthropic API helper ──────────────────────────────────────────────────────
function post(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed: ${e.message}. Body: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function extractText(res) {
  return ((res.content || []).filter(b => b.type === 'text').map(b => b.text).join(''));
}

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (m) { try { return JSON.parse(m[1]); } catch {} }
  try { return JSON.parse(text); } catch {}
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const positiveField = isSkill ? 'expected_triggers' : 'expected_dispatches';
  const positiveScenarios = spec.scenarios.filter(s => s[positiveField] === true);

  console.log(`\nExecution phase: ${positiveScenarios.length}/${spec.scenarios.length} scenarios (positive only)`);
  console.log(`Execution: ${EXEC_MODEL} | Grader: ${GRADE_MODEL}\n`);

  const results = [];

  for (const specScenario of positiveScenarios) {
    const evalScenario = evalMap.get(specScenario.id);
    if (!evalScenario) {
      console.warn(`  Scenario ${specScenario.id}: not found in evals.json — skipping`);
      continue;
    }

    const assertions = evalScenario.expected.assertions || [];
    console.log(`Scenario ${specScenario.id} (${specScenario.type})...`);

    // Step 1: execute with haiku — skill/agent def as system prompt
    let responseText = '';
    try {
      const execRes = await post({
        model: EXEC_MODEL,
        max_tokens: 1024,
        system: defContent,
        messages: [{ role: 'user', content: evalScenario.prompt }],
      });
      if (execRes.error) throw new Error(execRes.error.message || JSON.stringify(execRes.error));
      responseText = extractText(execRes);
    } catch (e) {
      console.error(`  Execution error: ${e.message}`);
      const errResult = {
        scenario_id: specScenario.id, scenario_type: specScenario.type,
        execution_model: EXEC_MODEL, grader_model: GRADE_MODEL,
        response_preview: '', assertions_result: [],
        score: 0, execution_pass: false, notes: `Execution error: ${e.message}`,
      };
      writeFileSync(path.join(specScenario.dir, 'execution-result.json'), JSON.stringify(errResult, null, 2));
      results.push(errResult);
      continue;
    }

    // Step 2: grade with sonnet
    let grade = {
      assertions_result: [],
      score: responseText.trim().length > 20 ? 8 : 2,
      notes: 'No assertions to grade — scored on response presence',
    };

    if (assertions.length > 0) {
      const assertionList = assertions.map((a, i) => `${i + 1}. ${a}`).join('\n');
      const graderPrompt = [
        `You are grading a Claude AI response against expected behavior assertions.`,
        ``,
        `The assistant had this ${isSkill ? 'skill' : 'agent'} definition as its system prompt:`,
        `Path: ${defPath}`,
        ``,
        `User prompt sent: "${evalScenario.prompt}"`,
        ``,
        `Assertions to grade:`,
        assertionList,
        ``,
        `Claude's response:`,
        `"""`,
        responseText,
        `"""`,
        ``,
        `Score rubric: 10=all assertions pass, 7-9=minor gaps, 4-6=partial, 1-3=significant issues, 0=completely wrong.`,
        ``,
        `Return ONLY valid JSON (no markdown):`,
        `{"assertions_result":[{"assertion":"...","passed":true,"notes":"..."}],"score":0,"notes":"..."}`,
      ].join('\n');

      try {
        const gradeRes = await post({
          model: GRADE_MODEL,
          max_tokens: 1024,
          messages: [{ role: 'user', content: graderPrompt }],
        });
        if (gradeRes.error) throw new Error(gradeRes.error.message || JSON.stringify(gradeRes.error));
        grade = extractJSON(extractText(gradeRes))
          || { assertions_result: [], score: 5, notes: 'Could not parse grader JSON' };
      } catch (e) {
        console.error(`  Grader error: ${e.message}`);
        grade = { assertions_result: [], score: 5, notes: `Grader error: ${e.message}` };
      }
    }

    const score = grade.score ?? 5;
    const result = {
      scenario_id: specScenario.id,
      scenario_type: specScenario.type,
      execution_model: EXEC_MODEL,
      grader_model: GRADE_MODEL,
      response_preview: responseText.slice(0, 500),
      assertions_result: grade.assertions_result || [],
      score,
      execution_pass: score >= 7,
      notes: grade.notes || '',
    };

    writeFileSync(path.join(specScenario.dir, 'execution-result.json'), JSON.stringify(result, null, 2));
    const passed = result.assertions_result.filter(a => a.passed).length;
    console.log(`  Score: ${result.score}/10 | Pass: ${result.execution_pass} | Assertions: ${passed}/${result.assertions_result.length}`);
    results.push(result);
  }

  const passCount = results.filter(r => r.execution_pass).length;
  const execPassRate = results.length > 0 ? Math.round(passCount / results.length * 100) : 0;

  writeFileSync(path.join(runDir, 'execution-aggregate.json'), JSON.stringify({
    scenarios_executed: results.length,
    scenarios_passed: passCount,
    execution_pass_rate: execPassRate,
    results,
  }, null, 2));

  console.log(`\nExecution phase complete: ${execPassRate}% pass (${passCount}/${results.length})`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
