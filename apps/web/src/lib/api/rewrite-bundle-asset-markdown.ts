/**
 * Replace relative bundle paths (e.g. `assets/price-sparkline.svg`) in markdown with presigned URLs from the API.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rewriteBundleAssetReferencesInMarkdown(
  markdownBody: string,
  bundleAssetUrls: Readonly<Record<string, string>> | null,
): string {
  if (bundleAssetUrls === null || Object.keys(bundleAssetUrls).length === 0) {
    return markdownBody;
  }
  const paths: string[] = Object.keys(bundleAssetUrls).sort((a, b) => b.length - a.length);
  let result: string = markdownBody;
  for (const path of paths) {
    const url: string = bundleAssetUrls[path];
    if (url.length === 0) continue;
    const variants: readonly string[] = [path, `./${path}`];
    for (const v of variants) {
      const e: string = escapeRegExp(v);
      result = result.replace(new RegExp(`\\]\\(${e}\\)`, 'g'), `](${url})`);
      result = result.replace(new RegExp(`(src=")${e}(")`, 'g'), `$1${url}$2`);
    }
  }
  return result;
}
