interface ImportMetaEnv {
  /** The day of the build (YYYY-MM-DD), for the sitemap's `<lastmod>`. */
  readonly BUILD_DATE?: string;
  /**
   * The site's public URL (e.g. the production domain), read at build time.
   * Unset, canonical and Open Graph URLs use the origin of each request.
   */
  readonly VITE_SITE_URL?: string;
}
