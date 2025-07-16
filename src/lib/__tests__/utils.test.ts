import { 
  formatNumber, 
  formatDate, 
  isValidCIDR, 
  truncateText, 
  generateId, 
  deepClone,
  debounce
} from '../utils';

// Mock clipboard-copy since it's not available in test environment
jest.mock('clipboard-copy', () => jest.fn());

describe('Utility Functions', () => {
  describe('formatNumber', () => {
    it('should format numbers with thousands separators', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1234567)).toBe('1,234,567');
      expect(formatNumber(42)).toBe('42');
    });

    it('should handle zero and negative numbers', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(-1000)).toBe('-1,000');
    });
  });

  describe('formatDate', () => {
    it('should format valid date strings', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      expect(result).toContain('2024');
      expect(result).toContain('January');
      expect(result).toContain('15');
    });

    it('should return original string for invalid dates', () => {
      const invalidDate = 'not-a-date';
      expect(formatDate(invalidDate)).toBe(invalidDate);
    });
  });

  describe('isValidCIDR', () => {
    it('should validate IPv4 CIDR notation', () => {
      expect(isValidCIDR('192.168.1.0/24')).toBe(true);
      expect(isValidCIDR('10.0.0.0/8')).toBe(true);
      expect(isValidCIDR('172.16.0.0/12')).toBe(true);
      expect(isValidCIDR('203.0.113.0/24')).toBe(true);
    });

    it('should validate IPv6 CIDR notation', () => {
      expect(isValidCIDR('2001:db8::/32')).toBe(true);
      expect(isValidCIDR('fe80::/64')).toBe(true);
    });

    it('should reject invalid CIDR notation', () => {
      expect(isValidCIDR('192.168.1.0')).toBe(false); // Missing subnet
      expect(isValidCIDR('192.168.1.0/33')).toBe(false); // Invalid subnet
      expect(isValidCIDR('256.256.256.256/24')).toBe(false); // Invalid IP
      expect(isValidCIDR('not-an-ip')).toBe(false);
      expect(isValidCIDR('')).toBe(false);
    });
  });

  describe('truncateText', () => {
    it('should truncate text longer than max length', () => {
      const longText = 'This is a very long text that should be truncated';
      expect(truncateText(longText, 20)).toBe('This is a very long ...');
    });

    it('should not truncate text shorter than max length', () => {
      const shortText = 'Short text';
      expect(truncateText(shortText, 20)).toBe('Short text');
    });

    it('should handle exact length', () => {
      const text = 'Exactly twenty chars';
      expect(truncateText(text, 20)).toBe('Exactly twenty chars');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate alphanumeric IDs', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('deepClone', () => {
    it('should deep clone objects', () => {
      const original = {
        name: 'test',
        nested: {
          value: 42,
          array: [1, 2, 3]
        }
      };
      
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.nested).not.toBe(original.nested);
      expect(cloned.nested.array).not.toBe(original.nested.array);
    });

    it('should handle arrays', () => {
      const original = [1, { a: 2 }, [3, 4]];
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[1]).not.toBe(original[1]);
    });

    it('should handle primitive values', () => {
      expect(deepClone('string')).toBe('string');
      expect(deepClone(42)).toBe(42);
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delay function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);
      
      debouncedFn('test');
      expect(mockFn).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(1000);
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should cancel previous calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);
      
      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');
      
      jest.advanceTimersByTime(1000);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('third');
    });

    it('should handle multiple arguments', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);
      
      debouncedFn('arg1', 'arg2', 'arg3');
      jest.advanceTimersByTime(500);
      
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });
  });
}); 