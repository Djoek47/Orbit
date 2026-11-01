/**
 * App Store Connect product-page creatives (header + search results).
 * Uses real Choremaxx coral icon / color marks + Bricolage Grotesque (via Pillow helper).
 *
 * Run: node scripts/generate-asc-product-page-creatives.mjs
 * (delegates raster work to scripts/_asc_product_page_render.py)
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const py = join(process.cwd(), 'scripts/_asc_product_page_render.py');
const r = spawnSync('python3', [py], { stdio: 'inherit' });
process.exit(r.status ?? 1);
