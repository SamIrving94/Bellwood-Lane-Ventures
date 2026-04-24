// Stubbed: upstream `basehub` package removed its core exports after an API
// drift. The original client wrapped basehub for a blog/legal CMS. Since
// Bellwood doesn't actually use the blog or legal pages (they're
// next-forge template remnants), we return empty data and keep the type
// shape so existing call sites still compile.
//
// If/when we wire a real CMS, replace this file with a fresh integration.

// ---------------------------------------------------------------------------
// Types (kept to match original shape)
// ---------------------------------------------------------------------------

export type PostMeta = {
  _slug: string;
  _title: string;
  authors: Array<{
    _title: string;
    avatar: ImageLike | null;
    xUrl: string | null;
  }>;
  categories: Array<{ _title: string }>;
  date: string;
  description: string;
  image: ImageLike | null;
};

export type Post = PostMeta & {
  body: {
    plainText: string;
    json: { content: unknown; toc: unknown };
    readingTime: number;
  };
};

export type LegalPostMeta = {
  _slug: string;
  _title: string;
  description: string;
};

export type LegalPost = LegalPostMeta & {
  body: {
    plainText: string;
    json: { content: unknown; toc: unknown };
    readingTime: number;
  };
};

type ImageLike = {
  url: string;
  width: number;
  height: number;
  alt: string | null;
  blurDataURL: string | null;
};

// ---------------------------------------------------------------------------
// Blog (stub)
// ---------------------------------------------------------------------------

export const blog = {
  postsQuery: {} as unknown,
  latestPostQuery: {} as unknown,
  postQuery: (_slug: string) => ({}) as unknown,

  getPosts: async (): Promise<PostMeta[]> => [],

  getLatestPost: async (): Promise<Post | null> => null,

  getPost: async (_slug: string): Promise<Post | null> => null,
};

// ---------------------------------------------------------------------------
// Legal (stub)
// ---------------------------------------------------------------------------

export const legal = {
  postsQuery: {} as unknown,
  latestPostQuery: {} as unknown,
  postQuery: (_slug: string) => ({}) as unknown,

  getPosts: async (): Promise<LegalPost[]> => [],

  getLatestPost: async (): Promise<LegalPost | null> => null,

  getPost: async (_slug: string): Promise<LegalPost | null> => null,
};
