// backend/services/llmClient.js
import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze a piece of source code and return a structured explanation.
 *
 * @param {Object} params
 * @param {string} params.code - The raw source code text.
 * @param {string} params.language - Language name or 'auto'.
 * @param {string} params.skillLevel - 'beginner' | 'intermediate' | 'expert'.
 * @param {string} params.provider - 'openai' | 'gemini' | 'anthropic' (etc).
 * @param {string} params.model - Model name for the provider.
 */
export async function analyzeCode({
    code,
    language,
    skillLevel,
    provider,
    model,
}) {
    const safeCode = String(code ?? '').slice(0, 20000);
    const safeLanguage = language || 'auto';
    const safeSkillLevel = skillLevel || 'beginner';
    const safeProvider = (provider || 'openai').toLowerCase();
    const safeModel = model || 'gpt-4.1-mini';

    // For now, only OpenAI is fully implemented.
    if (safeProvider !== 'openai') {
        return {
            summary: `The provider "${safeProvider}" is not configured on the server yet.`,
            walkthrough: [],
            risk_overview:
                'No analysis performed. Configure this provider on the backend to enable it.',
            issues: {
                performance: [],
                security: [],
                maintainability: [],
            },
            suggestions: [
                `Add an adapter implementation for provider "${safeProvider}" on the server.`,
                `Configure the corresponding API key as an environment variable.`,
            ],
            annotations: [],
        };
    }
    const lineCount = safeCode.split('\n').length;

    // Tone / audience behavior
    let toneInstructions;
    switch (safeSkillLevel) {
        case 'expert':
            toneInstructions = [
                `Use precise technical language.`,
                `It is okay to mention concepts like complexity, code smells, SOLID, or design patterns.`,
                `Be concise and assume the reader writes code daily.`,
                `Focus more on risks, edge cases, and design flaws than on basic syntax.`,
            ].join(' ');
            break;
        case 'intermediate':
            toneInstructions = [
                `Use a mix of plain language and technical terms.`,
                `Briefly explain any advanced concepts you introduce.`,
                `Focus on logic, data flow, and common pitfalls.`,
            ].join(' ');
            break;
        case 'beginner':
        default:
            toneInstructions = [
                `Use plain, everyday language with minimal jargon.`,
                `When you must use a technical term, define it briefly.`,
                `Focus on what the code does and why, not on formal theory.`,
            ].join(' ');
            break;
    }

    const instructions = [
        `You are an expert software engineer and teacher.`,
        `The user may not be a professional programmer, but has high technical acumen.`,
        `The users want to understand it like a realistic story of what the code does.`,
        ``,
        `Your job:`,
        `1. Explain what the code is TRYING to do overall in plain language.`,
        `2. Break it into a step-by-step walkthrough of the major phases.`,
        `3. Identify plot holes and obstacles:`,
        `   - performance issues`,
        `   - security risks`,
        `   - maintainability problems (hard to read, fragile, etc.)`,
        `4. Suggest concrete "reroutes to success" (specific improvements).`,
        `For every issue you report, assign a severity level: low, medium, high, or critical.`,
        `Use "critical" only for problems that could cause data loss, major security breaches, or production outages.`,
        `After listing issues, provide a single short "risk overview" sentence describing the overall risk level (for example: "Low", "Medium", or "High") and the main reasons.`,
        ``,
        `You are working in HIGH-LEVEL WALKTHROUGH MODE (Mode A):`,
        `- Aim for roughly 8–20 steps for typical snippets of 50–150 lines.`,
        `- Each step should describe one clear logical action or phase in the code.`,
        `- Keep each step focused; do not mix imports, configuration, and main logic into a single step unless the code is extremely small.`,
        ``,
        `For each walkthrough step, map it to the lines of code it MOSTLY describes.`,
        `Return this mapping in an "annotations" array, where each item has:`,
        `- step_index: the 0-based index into the walkthrough array,`,
        `- start_line and end_line: 1-based inclusive line numbers in the original code,`,
        `- note: a short optional comment about this mapping (can be an empty string).`,
        ``,
        `ANNOTATION RULES:`,
        `- The code between CODE START and CODE END has exactly ${lineCount} lines.`,
        `- All start_line and end_line values MUST be between 1 and ${lineCount}, inclusive.`,
        `- Keep start_line/end_line as TIGHT as possible: only include lines that are actually described by that step.`,
        `- Avoid large ranges that mix unrelated concepts. For example, do NOT include environment-variable or secret configuration lines inside an "import" step.`,
        `- Configuration of environment variables, secrets, URLs, ports, and other important settings should typically have its OWN step (and its own line range).`,
        `- It is better to have more, smaller ranges than a few giant ones that cover the whole file.`,
        `- Try to provide at least one annotation for EVERY walkthrough step; if you are uncertain, choose your best-guess line span.`,
        ``,
        `The user’s declared language is: "${safeLanguage}".`,
        `The user’s skill level is: "${safeSkillLevel}".`,
        `Adapt your explanation style according to this description:`,
        toneInstructions,
    ].join('\n');

    const response = await client.responses.create({
        model: safeModel,
        instructions,
        input: [
            {
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: [
                            'Analyze the following code and return JSON that matches the provided schema.',
                            '',
                            'CODE START',
                            safeCode,
                            'CODE END',
                        ].join('\n'),
                    },
                ],
            },
        ],
        text: {
            format: {
                type: 'json_schema',
                name: 'CodeAnalysis',
                strict: true,
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        summary: {
                            type: 'string',
                            description:
                                'A short paragraph explaining what this code is trying to do in plain language.',
                        },
                        walkthrough: {
                            type: 'array',
                            description:
                                'A step-by-step explanation of the code execution as ordered bullet points.',
                            items: { type: 'string' },
                        },
                        risk_overview: {
                            type: 'string',
                            description:
                                'Short description of the overall risk level (e.g., "Low", "Medium", or "High") and why.',
                        },
                        issues: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                performance: {
                                    type: 'array',
                                    description:
                                        'Potential performance issues or inefficiencies in the code.',
                                    items: {
                                        type: 'object',
                                        additionalProperties: false,
                                        properties: {
                                            message: {
                                                type: 'string',
                                                description:
                                                    'Short description of the performance issue.',
                                            },
                                            severity: {
                                                type: 'string',
                                                description:
                                                    'Severity level of this issue: low, medium, high, or critical.',
                                            },
                                            explanation: {
                                                type: 'string',
                                                description:
                                                    'Optional extra detail about why this is a problem.',
                                            },
                                        },
                                        required: ['message', 'severity', 'explanation'],
                                    },
                                },
                                security: {
                                    type: 'array',
                                    description:
                                        'Potential security risks, unsafe patterns, or missing validation.',
                                    items: {
                                        type: 'object',
                                        additionalProperties: false,
                                        properties: {
                                            message: {
                                                type: 'string',
                                                description:
                                                    'Short description of the security issue.',
                                            },
                                            severity: {
                                                type: 'string',
                                                description:
                                                    'Severity level of this issue: low, medium, high, or critical.',
                                            },
                                            explanation: {
                                                type: 'string',
                                                description:
                                                    'Optional extra detail about why this is a problem.',
                                            },
                                        },
                                        required: ['message', 'severity', 'explanation'],
                                    },
                                },
                                maintainability: {
                                    type: 'array',
                                    description:
                                        'Maintainability or readability problems that make the code harder to understand or change.',
                                    items: {
                                        type: 'object',
                                        additionalProperties: false,
                                        properties: {
                                            message: {
                                                type: 'string',
                                                description:
                                                    'Short description of the maintainability issue.',
                                            },
                                            severity: {
                                                type: 'string',
                                                description:
                                                    'Severity level of this issue: low, medium, high, or critical.',
                                            },
                                            explanation: {
                                                type: 'string',
                                                description:
                                                    'Optional extra detail about why this is a problem.',
                                            },
                                        },
                                        required: ['message', 'severity', 'explanation'],
                                    },
                                },
                            },
                            required: ['performance', 'security', 'maintainability'],
                        },
                        suggestions: {
                            type: 'array',
                            description:
                                'Concrete suggestions for improving the code, phrased in practical terms.',
                            items: { type: 'string' },
                        },
                        annotations: {
                            type: 'array',
                            description:
                                'Mapping from walkthrough steps to line ranges in the original code.',
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    step_index: {
                                        type: 'integer',
                                        description:
                                            '0-based index into the walkthrough array for this annotation.',
                                    },
                                    start_line: {
                                        type: 'integer',
                                        description:
                                            '1-based starting line number (inclusive) in the original code.',
                                    },
                                    end_line: {
                                        type: 'integer',
                                        description:
                                            '1-based ending line number (inclusive) in the original code.',
                                    },
                                    note: {
                                        type: 'string',
                                        description:
                                            'Short optional note about this mapping. Can be an empty string.',
                                    },
                                },
                                required: ['step_index', 'start_line', 'end_line', 'note'],
                            },
                        },
                    },
                    required: [
                        'summary',
                        'walkthrough',
                        'risk_overview',
                        'issues',
                        'suggestions',
                        'annotations',
                    ],
                },
            },
        },
        max_output_tokens: 2000,
    });

    const output = response.output?.[0];

    if (!output || !Array.isArray(output.content) || output.content.length === 0) {
        console.error('Unexpected response structure from OpenAI:', response);
        throw new Error('Could not extract analysis result from model response.');
    }

    let json = null;

    // 1) Try structured JSON if the SDK ever returns it that way
    for (const item of output.content) {
        if (item.json) {
            json = item.json;
            break;
        }
        if (item.output_json) {
            json = item.output_json;
            break;
        }
    }

    // 2) Fallback: combine ALL output_text chunks and parse as one JSON string
    if (!json) {
        const textChunks = output.content
            .filter(item => item.type === 'output_text' && typeof item.text === 'string')
            .map(item => item.text);

        if (textChunks.length > 0) {
            const combined = textChunks.join('');
            try {
                json = JSON.parse(combined);
            } catch (e) {
                console.error('Failed to parse combined output_text as JSON:', e, combined);
            }
        }
    }

    if (!json) {
        console.error('No JSON content found in model response:', output);
        throw new Error('Model did not return JSON content as expected.');
    }

    const normalizeIssueArray = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.map((item) => {
            if (typeof item === 'string') {
                return {
                    message: item,
                    severity: 'medium',
                    explanation: '',
                };
            }
            return {
                message: String(item.message ?? ''),
                severity: String(item.severity ?? 'medium'),
                explanation: item.explanation ? String(item.explanation) : '',
            };
        });
    };

    const normalizeAnnotations = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.map((item) => {
            return {
                step_index: Number(item.step_index ?? 0),
                start_line: Number(item.start_line ?? 0),
                end_line: Number(
                    item.end_line ?? item.start_line ?? 0
                ),
                note: String(item.note ?? ''),
            };
        });
    };

    const normalized = {
        summary: String(json.summary ?? ''),
        walkthrough: Array.isArray(json.walkthrough) ? json.walkthrough : [],
        risk_overview: String(json.risk_overview ?? ''),
        issues: {
            performance: normalizeIssueArray(json.issues?.performance),
            security: normalizeIssueArray(json.issues?.security),
            maintainability: normalizeIssueArray(json.issues?.maintainability),
        },
        suggestions: Array.isArray(json.suggestions) ? json.suggestions : [],
        annotations: normalizeAnnotations(json.annotations),
    };

    return normalized;
}
