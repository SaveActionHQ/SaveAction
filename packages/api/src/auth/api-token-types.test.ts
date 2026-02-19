/**
 * API Token Types Tests
 */

import { describe, it, expect } from 'vitest';
import {
  API_TOKEN_SCOPES,
  SCOPE_GROUPS,
  isValidScope,
  validateScopes,
  hasScope,
  hasAllScopes,
  hasAnyScope,
  TOKEN_PREFIX_LIVE,
  TOKEN_PREFIX_TEST,
  createTokenSchema,
  revokeTokenSchema,
  type ApiTokenScope,
} from './api-token-types.js';

describe('API_TOKEN_SCOPES', () => {
  it('should have all expected scopes', () => {
    expect(API_TOKEN_SCOPES).toContain('recordings:read');
    expect(API_TOKEN_SCOPES).toContain('recordings:write');
    expect(API_TOKEN_SCOPES).toContain('runs:read');
    expect(API_TOKEN_SCOPES).toContain('runs:execute');
    expect(API_TOKEN_SCOPES).toContain('schedules:read');
    expect(API_TOKEN_SCOPES).toContain('schedules:write');
    expect(API_TOKEN_SCOPES).toContain('webhooks:read');
    expect(API_TOKEN_SCOPES).toContain('webhooks:write');
  });

  it('should have exactly 14 scopes', () => {
    expect(API_TOKEN_SCOPES).toHaveLength(14);
  });
});

describe('SCOPE_GROUPS', () => {
  it('should have readonly group with read-only scopes', () => {
    expect(SCOPE_GROUPS.readonly).toContain('recordings:read');
    expect(SCOPE_GROUPS.readonly).toContain('runs:read');
    expect(SCOPE_GROUPS.readonly).toContain('schedules:read');
    expect(SCOPE_GROUPS.readonly).toContain('webhooks:read');
    expect(SCOPE_GROUPS.readonly).not.toContain('recordings:write');
  });

  it('should have recordings group with full recordings access', () => {
    expect(SCOPE_GROUPS.recordings).toContain('recordings:read');
    expect(SCOPE_GROUPS.recordings).toContain('recordings:write');
  });

  it('should have runs group with full runs access', () => {
    expect(SCOPE_GROUPS.runs).toContain('runs:read');
    expect(SCOPE_GROUPS.runs).toContain('runs:execute');
  });

  it('should have cicd group with typical CI/CD needs', () => {
    expect(SCOPE_GROUPS.cicd).toContain('recordings:read');
    expect(SCOPE_GROUPS.cicd).toContain('runs:read');
    expect(SCOPE_GROUPS.cicd).toContain('runs:execute');
    expect(SCOPE_GROUPS.cicd).not.toContain('recordings:write');
  });

  it('should have all group with all scopes', () => {
    expect(SCOPE_GROUPS.all).toHaveLength(API_TOKEN_SCOPES.length);
    expect(SCOPE_GROUPS.all).toEqual(expect.arrayContaining([...API_TOKEN_SCOPES]));
  });
});

describe('isValidScope', () => {
  it('should return true for valid scopes', () => {
    expect(isValidScope('recordings:read')).toBe(true);
    expect(isValidScope('runs:execute')).toBe(true);
    expect(isValidScope('webhooks:write')).toBe(true);
  });

  it('should return false for invalid scopes', () => {
    expect(isValidScope('invalid:scope')).toBe(false);
    expect(isValidScope('recordings')).toBe(false);
    expect(isValidScope('')).toBe(false);
    expect(isValidScope('RECORDINGS:READ')).toBe(false);
  });
});

describe('validateScopes', () => {
  it('should return valid for array of valid scopes', () => {
    const result = validateScopes(['recordings:read', 'runs:execute']);

    expect(result.valid).toBe(true);
    expect(result.invalid).toEqual([]);
  });

  it('should return invalid scopes', () => {
    const result = validateScopes(['recordings:read', 'invalid:scope', 'bad']);

    expect(result.valid).toBe(false);
    expect(result.invalid).toEqual(['invalid:scope', 'bad']);
  });

  it('should return valid for empty array', () => {
    const result = validateScopes([]);

    expect(result.valid).toBe(true);
    expect(result.invalid).toEqual([]);
  });
});

describe('hasScope', () => {
  it('should return true when scope exists', () => {
    const scopes = ['recordings:read', 'runs:execute'];

    expect(hasScope(scopes, 'recordings:read')).toBe(true);
    expect(hasScope(scopes, 'runs:execute')).toBe(true);
  });

  it('should return false when scope does not exist', () => {
    const scopes = ['recordings:read'];

    expect(hasScope(scopes, 'runs:execute')).toBe(false);
  });
});

describe('hasAllScopes', () => {
  it('should return true when all required scopes exist', () => {
    const scopes = ['recordings:read', 'runs:execute', 'runs:read'];

    expect(hasAllScopes(scopes, ['recordings:read', 'runs:execute'])).toBe(true);
  });

  it('should return false when some required scopes missing', () => {
    const scopes = ['recordings:read'];

    expect(hasAllScopes(scopes, ['recordings:read', 'runs:execute'])).toBe(false);
  });

  it('should return true for empty required scopes', () => {
    expect(hasAllScopes(['recordings:read'], [])).toBe(true);
  });
});

describe('hasAnyScope', () => {
  it('should return true when at least one scope exists', () => {
    const scopes = ['recordings:read'];

    expect(hasAnyScope(scopes, ['recordings:read', 'runs:execute'])).toBe(true);
  });

  it('should return false when no required scopes exist', () => {
    const scopes = ['webhooks:read'];

    expect(hasAnyScope(scopes, ['recordings:read', 'runs:execute'])).toBe(false);
  });

  it('should return false for empty required scopes', () => {
    expect(hasAnyScope(['recordings:read'], [])).toBe(false);
  });
});

describe('Token Prefixes', () => {
  it('should have correct live prefix', () => {
    expect(TOKEN_PREFIX_LIVE).toBe('sa_live_');
  });

  it('should have correct test prefix', () => {
    expect(TOKEN_PREFIX_TEST).toBe('sa_test_');
  });
});

describe('createTokenSchema', () => {
  it('should validate valid request', () => {
    const data = {
      name: 'CI Token',
      scopes: ['recordings:read', 'runs:execute'] as ApiTokenScope[],
    };

    const result = createTokenSchema.parse(data);

    expect(result.name).toBe('CI Token');
    expect(result.scopes).toEqual(['recordings:read', 'runs:execute']);
  });

  it('should trim name', () => {
    const data = {
      name: '  CI Token  ',
      scopes: ['recordings:read'] as ApiTokenScope[],
    };

    const result = createTokenSchema.parse(data);

    expect(result.name).toBe('CI Token');
  });

  it('should use default scopes when not provided', () => {
    const data = {
      name: 'Token',
    };

    const result = createTokenSchema.parse(data);

    expect(result.scopes).toEqual(['recordings:read', 'runs:read']);
  });

  it('should reject empty name', () => {
    const data = {
      name: '',
      scopes: ['recordings:read'] as ApiTokenScope[],
    };

    expect(() => createTokenSchema.parse(data)).toThrow();
  });

  it('should reject name too long', () => {
    const data = {
      name: 'a'.repeat(256),
      scopes: ['recordings:read'] as ApiTokenScope[],
    };

    expect(() => createTokenSchema.parse(data)).toThrow();
  });

  it('should reject invalid scopes', () => {
    const data = {
      name: 'Token',
      scopes: ['invalid:scope'],
    };

    expect(() => createTokenSchema.parse(data)).toThrow();
  });

  it('should reject empty scopes array', () => {
    const data = {
      name: 'Token',
      scopes: [],
    };

    expect(() => createTokenSchema.parse(data)).toThrow();
  });

  it('should parse expiration date', () => {
    const expiresAt = '2025-01-01T00:00:00.000Z';
    const data = {
      name: 'Token',
      scopes: ['recordings:read'] as ApiTokenScope[],
      expiresAt,
    };

    const result = createTokenSchema.parse(data);

    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt?.toISOString()).toBe(expiresAt);
  });

  it('should handle missing expiration date', () => {
    const data = {
      name: 'Token',
      scopes: ['recordings:read'] as ApiTokenScope[],
    };

    const result = createTokenSchema.parse(data);

    expect(result.expiresAt).toBeUndefined();
  });
});

describe('revokeTokenSchema', () => {
  it('should validate request with reason', () => {
    const data = {
      reason: 'Security concern',
    };

    const result = revokeTokenSchema.parse(data);

    expect(result.reason).toBe('Security concern');
  });

  it('should validate request without reason', () => {
    const data = {};

    const result = revokeTokenSchema.parse(data);

    expect(result.reason).toBeUndefined();
  });

  it('should reject reason too long', () => {
    const data = {
      reason: 'a'.repeat(256),
    };

    expect(() => revokeTokenSchema.parse(data)).toThrow();
  });
});
