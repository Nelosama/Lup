import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import i18n from "../i18n";
export type Category = {
  id: string;
  slug: string;
  active: boolean;
  requiresLicense: boolean;
  position: number;
  translations: { locale: string; name: string }[];
};
export type City = {
  id: string;
  name: string;
  countryCode: string;
  regionId: string;
  timezone: string;
};
export type Country = {
  code: string;
  name: string;
  currencyCode: string;
  enabled: boolean;
  cities: City[];
  regions: { id: string; name: string }[];
};
export function useCatalog() {
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/categories"),
    staleTime: 300000,
  });
  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: () => api<Country[]>("/locations"),
    staleTime: 300000,
  });
  return {
    categories: categories.data ?? [],
    countries: locations.data ?? [],
    cities: locations.data?.flatMap((c) => c.cities) ?? [],
    loading: categories.isPending || locations.isPending,
    error: categories.error || locations.error,
  };
}
export const categoryName = (c: Category) =>
  c.translations.find((x) => x.locale === i18n.language)?.name ??
  c.translations[0]?.name ??
  c.slug;
