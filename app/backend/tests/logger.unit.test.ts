import { describe, expect, it } from 'vitest';
import { logger } from '../src/shared/logger.js';

describe('Logger error serialization', () => {
  it('serializes error object with message and stack when passed under error property', () => {
    const testError = new Error('Database connection failed');
    // We inspect the serializer attached to the logger
    const serializers = (logger as any)[Symbol.for('pino.serializers')] || (logger as any).serializers;
    
    // Test the serializer function directly if registered
    expect(serializers).toBeDefined();
    expect(serializers.error).toBeDefined();
    
    const serialized = serializers.error(testError);
    expect(serialized).toHaveProperty('message', 'Database connection failed');
    expect(serialized).toHaveProperty('stack');
  });

  it('serializes error object with message and stack when passed under err property', () => {
    const testError = new Error('Generic error occurred');
    const serializers = (logger as any)[Symbol.for('pino.serializers')] || (logger as any).serializers;
    
    expect(serializers).toBeDefined();
    expect(serializers.err).toBeDefined();
    
    const serialized = serializers.err(testError);
    expect(serialized).toHaveProperty('message', 'Generic error occurred');
    expect(serialized).toHaveProperty('stack');
  });
});
