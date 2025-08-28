/**
 * Generic validation utility for consistent data validation across the application
 */
import { ValidationRule, ValidationResult } from "../../shared/types";

/**
 * Creates a validator function based on provided rules
 */
export const createValidator = <T extends Record<string, any>>(
  rules: ValidationRule<T>[]
): ((data: T) => ValidationResult) => {
  return (data: T): ValidationResult => {
    const errors: string[] = [];
    const fieldErrors: Record<string, string> = {};

    for (const rule of rules) {
      const field = String(rule.field);
      const value = data[rule.field];
      const fieldError = validateField(value, rule, field);
      
      if (fieldError) {
        errors.push(fieldError);
        fieldErrors[field] = fieldError;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      fieldErrors
    };
  };
};

/**
 * Validates a single field against a rule
 */
const validateField = <T>(value: any, rule: ValidationRule<T>, fieldName: string): string | null => {
  // Required field validation
  if (rule.required && (value === null || value === undefined || value === '')) {
    return `${fieldName} is required`;
  }

  // Skip further validation if field is empty and not required
  if (!rule.required && (value === null || value === undefined || value === '')) {
    return null;
  }

  // Type validation
  if (rule.type) {
    const typeError = validateType(value, rule.type, fieldName);
    if (typeError) return typeError;
  }

  // String length validation
  if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) {
    return `${fieldName} must be no more than ${rule.maxLength} characters`;
  }

  if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) {
    return `${fieldName} must be at least ${rule.minLength} characters`;
  }

  // Numeric range validation
  if (rule.minValue !== undefined && typeof value === 'number' && value < rule.minValue) {
    return `${fieldName} must be at least ${rule.minValue}`;
  }

  if (rule.maxValue !== undefined && typeof value === 'number' && value > rule.maxValue) {
    return `${fieldName} must be no more than ${rule.maxValue}`;
  }

  // Pattern validation
  if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
    return `${fieldName} format is invalid`;
  }

  // Custom validation
  if (rule.customValidator) {
    const customError = rule.customValidator(value);
    if (customError) {
      return `${fieldName} ${customError}`;
    }
  }

  return null;
};

/**
 * Validates type of a value
 */
const validateType = (value: any, expectedType: string, fieldName: string): string | null => {
  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        return `${fieldName} must be a string`;
      }
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `${fieldName} must be a valid number`;
      }
      break;
    case 'email':
      if (typeof value !== 'string' || !isValidEmail(value)) {
        return `${fieldName} must be a valid email address`;
      }
      break;
    case 'url':
      if (typeof value !== 'string' || !isValidUrl(value)) {
        return `${fieldName} must be a valid URL`;
      }
      break;
  }
  return null;
};

/**
 * Email validation regex
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * URL validation
 */
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Pre-configured validators for common use cases

/**
 * Transcript validation rules
 */
export const transcriptValidationRules: ValidationRule<any>[] = [
  { field: 'text', required: true, maxLength: 10000, type: 'string' },
  { field: 'wordCount', required: true, minValue: 0, type: 'number' },
  { field: 'wpm', required: true, minValue: 0, type: 'number' },
  { field: 'timestamp', required: true }
];

export const validateTranscriptData = createValidator(transcriptValidationRules);

/**
 * User profile validation rules
 */
export const userProfileValidationRules: ValidationRule<any>[] = [
  { field: 'email', required: true, type: 'email' },
  { field: 'name', required: true, minLength: 2, maxLength: 100, type: 'string' },
  { field: 'password', required: true, minLength: 8, type: 'string' }
];

export const validateUserProfile = createValidator(userProfileValidationRules);