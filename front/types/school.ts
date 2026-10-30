export type School = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  educationalDistrict?: string | null;
  province?: string | null;
  municipality?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SchoolFormValues = {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  educationalDistrict?: string;
  province?: string;
  municipality?: string;
  logoUrl?: string;
  isActive: boolean;
};
