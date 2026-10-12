const LOOPBACK_HOSTS = new Set([
  "localhost",
  "::1",
  "[::1]",
]);

export function isPublicImageUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !LOOPBACK_HOSTS.has(hostname) &&
      !hostname.endsWith(".localhost") &&
      !/^127\./.test(hostname)
    );
  } catch {
    return false;
  }
}
