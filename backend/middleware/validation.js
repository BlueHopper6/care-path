const { z } = require('zod');

// ---------------------------------------------------------------------------
// Sanitization Helpers
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags from a string to mitigate stored XSS.
 * Preserves the underlying text content.
 */
function stripHtmlTags(str) {
  return str.replace(/<[^>]*>/g, '');
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const analyzeSchema = z.object({
  raw_text: z
    .string({ required_error: 'raw_text is required.' })
    .min(1, 'raw_text must not be empty.')
    .max(50000, 'raw_text exceeds the 50,000 character limit.')
    .transform((val) => stripHtmlTags(val.trim())),
  mode: z
    .enum(['default', 'simple'], {
      errorMap: () => ({ message: 'mode must be "default" or "simple".' }),
    })
    .optional()
    .default('default'),
  language: z
    .string()
    .max(50, 'language must be 50 characters or fewer.')
    .optional()
    .default('English'),
});

const saveAnalysisSchema = z.object({
  raw_text: z
    .string({ required_error: 'raw_text is required.' })
    .min(1, 'raw_text must not be empty.')
    .max(100000, 'raw_text exceeds the 100,000 character limit.')
    .transform((val) => stripHtmlTags(val.trim())),
  analysis: z.object(
    {
      summary: z.string().optional().default(''),
      action_plan: z.array(z.string()).optional().default([]),
      recurring_tasks: z.array(z.any()).optional().default([]),
      questions_for_doctor: z.array(z.string()).optional().default([]),
      warning_signs: z.array(z.string()).optional().default([]),
      confidence_level: z
        .enum(['low', 'medium', 'high'])
        .optional()
        .default('medium'),
    },
    { required_error: 'analysis object is required.' }
  ),
  mode: z.string().max(20).optional().default('default'),
  language: z.string().max(50).optional().default('English'),
});

const preferencesSchema = z.object({
  auto_save_history: z.boolean({
    required_error: 'auto_save_history is required.',
    invalid_type_error: 'auto_save_history must be a boolean.',
  }),
});

const uploadSchema = z.object({
  raw_text: z
    .string({ required_error: 'raw_text is required.' })
    .min(1, 'raw_text must not be empty.')
    .max(100000, 'raw_text exceeds the 100,000 character limit.')
    .transform((val) => stripHtmlTags(val.trim())),
});

// ---------------------------------------------------------------------------
// Middleware Factory
// ---------------------------------------------------------------------------

/**
 * Returns Express middleware that validates `req.body` against the given
 * Zod schema. On success the parsed (and transformed) body replaces
 * `req.body`. On failure a 400 is returned with field-level errors.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return res.status(400).json({
        error: 'Validation failed.',
        details: fieldErrors,
      });
    }

    // Replace body with parsed + transformed data
    req.body = result.data;
    next();
  };
}

module.exports = {
  analyzeSchema,
  saveAnalysisSchema,
  preferencesSchema,
  uploadSchema,
  validate,
};
