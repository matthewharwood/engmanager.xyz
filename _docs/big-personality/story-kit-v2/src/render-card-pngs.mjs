// Optional build utility. Install sharp in your own build environment to regenerate PNGs.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('sharp');
const root=new URL('../',import.meta.url);
const deck=JSON.parse(await fs.readFile(new URL('tarot-deck.json',root),'utf8'));
for(const card of deck.cards){
  const source=await fs.readFile(new URL(card.asset.svgPath,root));
  await sharp(source).png().toFile(new URL(card.asset.pngPath,root).pathname);
}
console.log('Rendered all 78 card placeholders. Refresh the asset manifest after changing bytes.');
