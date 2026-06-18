export type Brand = {
  name: string;
  logoUrl: string;
  subtitle: string;
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
};

export const ACCOUNTING_BRAND: Brand = {
  name: import.meta.env.VITE_ACCOUNTING_BRAND_NAME?.trim() || 'Yagona buxgalteriya',
  logoUrl: import.meta.env.VITE_ACCOUNTING_LOGO_URL?.trim() || '',
  subtitle: import.meta.env.VITE_ACCOUNTING_BRAND_SUBTITLE?.trim() || 'Buxgalteriya kurslari',
};

export function getCourseBrand(subject?: string | null, settings?: BrandingSettings) {
  return subject?.trim().toLocaleLowerCase('uz') === 'buxgalteriya'
    ? settings?.accounting || ACCOUNTING_BRAND
    : settings?.unify || UNIFY_BRAND;
}
