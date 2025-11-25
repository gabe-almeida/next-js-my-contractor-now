// Mock for isomorphic-dompurify in unit tests
module.exports = {
  sanitize: (input, config) => {
    if (typeof input !== 'string') return input;

    // If ALLOWED_TAGS is empty array, strip ALL tags and their content for dangerous tags
    if (config && Array.isArray(config.ALLOWED_TAGS) && config.ALLOWED_TAGS.length === 0) {
      let sanitized = input;

      // Strip script tags and their content
      sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

      // Strip style tags and their content
      sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

      // Strip svg tags and their content (including nested tags)
      sanitized = sanitized.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

      // Strip remaining HTML tags but keep content
      sanitized = sanitized.replace(/<[^>]*>/g, '');

      // Strip javascript: protocol
      sanitized = sanitized.replace(/javascript:/gi, '');

      // Strip event handlers (on*)
      sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

      // Strip data: URIs that could be dangerous
      sanitized = sanitized.replace(/data:text\/html[^"'\s]*/gi, '');

      return sanitized;
    }

    // Default: just strip HTML tags
    return input.replace(/<[^>]*>/g, '');
  }
};

module.exports.default = module.exports;
