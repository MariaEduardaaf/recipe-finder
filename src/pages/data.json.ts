// /recipes/data.json, prerendered: everything the finder matches against, fetched once per visit (recipes spec 10).
// Compact rows: [id, title, meal, cuisine, kind, source URL, photo file, ingredient keys (assumed ones dropped), diet].
import { recipes, counted, kind, meal, diet } from '../components/recipes/data';

const PHOTO = /^https:\/\/www\.themealdb\.com\/images\/media\/meals\/([a-z0-9]+)\.jpg$/;

export function GET() {
  const rows = recipes.map((r) => {
    const file = PHOTO.exec(r.image)?.[1];
    if (!file) throw new Error(`Unexpected photo URL for ${r.id}: ${r.image}`);
    return [r.id, r.title, meal(r), r.area, kind(r), r.sourceUrl, file, counted(r), diet(r)];
  });
  return new Response(JSON.stringify({ r: rows }), { headers: { 'Content-Type': 'application/json' } });
}
