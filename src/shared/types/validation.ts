/**
 * Validation Types
 * Interfaces for data validation and rule checking
 */

export interface ValidationRule<T> {
  field: keyof T;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  minValue?: number;
  maxValue?: number;
  type?: 'string' | 'number' | 'email' | 'url';
  pattern?: RegExp;
  customValidator?: (value: any) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
}