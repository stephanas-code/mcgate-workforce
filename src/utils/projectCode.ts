/**
 * Utilities for auto-generating clean, unique project codes from project names.
 */

export function generateProjectCodeFromName(name: string): string {
  if (!name || !name.trim()) return '';

  // Remove non-alphanumeric characters, keeping spaces
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) return '';

  let base = '';
  if (words.length === 1) {
    base = words[0].toUpperCase().substring(0, 10);
  } else if (words.length === 2) {
    base = `${words[0].substring(0, 6)}-${words[1].substring(0, 6)}`.toUpperCase();
  } else {
    // 3 or more words (e.g. "StorePro Cloud Modernization" -> PRJ-STOREPRO-CM)
    if (words[0].length >= 3 && words[0].length <= 8) {
      const rest = words.slice(1, 3).map((w) => w.substring(0, 4).toUpperCase()).join('-');
      base = `${words[0].toUpperCase()}-${rest}`;
      if (base.length > 15) {
        base = `${words[0].toUpperCase()}-${words.slice(1).map((w) => w[0]).join('').toUpperCase()}`;
      }
    } else {
      base = words.map((w) => w[0]).join('').toUpperCase();
    }
  }

  // Clean hyphens
  base = base.replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `PRJ-${base || 'PROJ'}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
