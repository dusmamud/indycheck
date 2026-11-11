/**
 * indycheck — Zod schemas.
 *
 * Optional integration: `zod` is a peer dependency (optional). Importing
 * this module requires zod to be installed; the main entry point
 * (`index.ts`) never imports zod.
 *
 * Every schema validates with the same validators as the core, and its
 * error message carries both the English and Hindi reason:
 * "<reason_en> / <reason_hi>".
 */
import { z } from "zod";
import {
  validateAadhaar,
  validateCin,
  validateEpic,
  validateGstin,
  validateIfsc,
  validateLlpin,
  validateMobile,
  validatePan,
  validatePincode,
  validateTan,
  validateUpi,
  validateVehicle,
  type ValidationResult,
} from "./index";

function refineWith(
  validator: (input: unknown) => ValidationResult,
) {
  return (value: string, ctx: z.RefinementCtx) => {
    const result = validator(value);
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${result.reason_en} / ${result.reason_hi}`,
      });
    }
  };
}

export const mobileSchema = z.string().superRefine(refineWith(validateMobile));
export const panSchema = z.string().superRefine(refineWith(validatePan));
export const aadhaarSchema = z.string().superRefine(refineWith(validateAadhaar));
export const gstinSchema = z.string().superRefine(refineWith(validateGstin));
export const ifscSchema = z.string().superRefine(refineWith(validateIfsc));
export const upiSchema = z.string().superRefine(refineWith(validateUpi));
export const pincodeSchema = z.string().superRefine(refineWith(validatePincode));
export const tanSchema = z.string().superRefine(refineWith(validateTan));
export const cinSchema = z.string().superRefine(refineWith(validateCin));
export const llpinSchema = z.string().superRefine(refineWith(validateLlpin));
export const voterSchema = z.string().superRefine(refineWith(validateEpic));
/** Alias: EPIC is the name printed on the voter ID card. */
export const epicSchema = voterSchema;
export const vehicleSchema = z.string().superRefine(refineWith(validateVehicle));
/** Alias for `vehicleSchema`. */
export const vehicleRegistrationSchema = vehicleSchema;

export type Mobile = z.infer<typeof mobileSchema>;
export type Pan = z.infer<typeof panSchema>;
export type Aadhaar = z.infer<typeof aadhaarSchema>;
export type Gstin = z.infer<typeof gstinSchema>;
export type Ifsc = z.infer<typeof ifscSchema>;
export type Upi = z.infer<typeof upiSchema>;
export type Pincode = z.infer<typeof pincodeSchema>;
export type Tan = z.infer<typeof tanSchema>;
export type Cin = z.infer<typeof cinSchema>;
export type Llpin = z.infer<typeof llpinSchema>;
export type Voter = z.infer<typeof voterSchema>;
export type Epic = z.infer<typeof epicSchema>;
export type Vehicle = z.infer<typeof vehicleSchema>;
