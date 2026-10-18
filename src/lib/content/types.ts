export type ContentKind = 'recipe' | 'article' | 'page';

export interface TaxonomyTerm {
  id: number;
  name: string;
  slug: string;
  path: string;
}

export interface ImageVariant {
  src: string;
  width: number;
  height: number;
}

export interface PublicImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  variants: ImageVariant[];
}

export interface PublicSeo {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  og_title: string;
  og_description: string;
  og_image: string | null;
}

export interface Ingredient {
  id: number;
  text: string;
}

export interface IngredientGroup {
  name: string;
  items: Ingredient[];
}

export interface RecipeNutrition {
  serving_size: string | null;
  servings: string | null;
  values: Record<string, string>;
  source: string | null;
}

export interface RecipeRating {
  value: number;
  count: number;
}

export interface PublicRecipe {
  title: string;
  description: string;
  ingredients: IngredientGroup[];
  instructions: Array<{ id: string; text: string }>;
  prep_seconds: number | null;
  active_seconds: number | null;
  additional_seconds: number | null;
  total_seconds: number | null;
  yield: string | null;
  notes: string[];
  nutrition: RecipeNutrition | null;
  rating: RecipeRating | null;
}

export interface PublicContentItem {
  post_id: number;
  card_id: number | null;
  kind: ContentKind;
  path: string;
  title: string;
  excerpt: string;
  content_html: string;
  date_published: string;
  date_modified: string;
  author: { name: string };
  categories: TaxonomyTerm[];
  tags: Array<Omit<TaxonomyTerm, 'path'>>;
  image: PublicImage | null;
  seo: PublicSeo;
  comments_open: boolean;
  comments_count?: number;
  comments?: PublicComment[];
  recipe: PublicRecipe | null;
}

/** Approved public comment projection; intentionally excludes email and IP. */
export interface PublicComment {
  id: number;
  post_id: number;
  parent: number;
  author: string;
  date: string;
  content: string;
}

export interface ContentPage {
  contract_version: 1;
  revision: string;
  page: number;
  per_page: number;
  total_pages: number;
  total_records: number;
  complete: boolean;
  items: PublicContentItem[];
}

export interface ContentSnapshot {
  contract_version: 1;
  revision: string;
  source_revision?: string;
  fetched_at: string;
  items: PublicContentItem[];
}
