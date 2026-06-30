export type Brand = {
  name: string;
  logoUrl: string;
  subtitle: string;
  receiptFooter: string;
};

export type BrandingSettings = {
  unify: Brand;
  accounting: Brand;
  updatedAt?: string;
};

export const UNIFY_BRAND: Brand = {
  name: import.meta.env.VITE_UNIFY_BRAND_NAME?.trim() || 'Unify',
  logoUrl: import.meta.env.VITE_UNIFY_LOGO_URL?.trim() || '',
  subtitle: import.meta.env.VITE_UNIFY_BRAND_SUBTITLE?.trim() || 'Boshqaruv tizimi',
  receiptFooter: import.meta.env.VITE_UNIFY_RECEIPT_FOOTER?.trim() || 'To\'lovingiz uchun rahmat',
};

export const ACCOUNTING_BRAND: Brand = {
  name: import.meta.env.VITE_ACCOUNTING_BRAND_NAME?.trim() || 'Yagona buxgalteriya',
  logoUrl: import.meta.env.VITE_ACCOUNTING_LOGO_URL?.trim() || '',
  subtitle: import.meta.env.VITE_ACCOUNTING_BRAND_SUBTITLE?.trim() || 'Buxgalteriya kurslari',
  receiptFooter: import.meta.env.VITE_ACCOUNTING_RECEIPT_FOOTER?.trim() || 'To\'lovingiz uchun rahmat',
};

export function mergeBrand(base: Brand, override?: Partial<Brand> | null): Brand {
  return { ...base, ...(override || {}) };
}

export function getCourseBrand(subject?: string | null, settings?: BrandingSettings) {
  return subject?.trim().toLocaleLowerCase('uz') === 'buxgalteriya'
    ? mergeBrand(ACCOUNTING_BRAND, settings?.accounting)
    : mergeBrand(UNIFY_BRAND, settings?.unify);
}
