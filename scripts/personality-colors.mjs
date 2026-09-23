import {writeFile, mkdir} from 'node:fs/promises';
const root=new URL('../website/assets/personality/v5/media/colors/',import.meta.url);
await mkdir(root,{recursive:true});
const colors=[['red','#dd6d68'],['yellow','#e5b84b'],['green','#7f9d82'],['blue','#789fc3']];
for(let mask=0;mask<16;mask++){
 const selected=colors.filter((_,i)=>mask&(1<<i));
 const layouts={1:[[200,160]],2:[[158,160],[242,160]],3:[[158,125],[242,125],[200,201]],4:[[158,118],[242,118],[158,202],[242,202]]};
 const circles=mask?selected.map(([name,color],i)=>{const [x,y]=layouts[selected.length][i];return `<circle cx="${x}" cy="${y}" r="63" fill="${color}" fill-opacity=".72" stroke="${color}" stroke-width="1.5"/>`;}).join(''):'<circle cx="200" cy="160" r="65" fill="#eeeae4" stroke="#9b96a4" stroke-width="2" stroke-dasharray="5 6"/>';
 const title=selected.length?selected.map(x=>x[0]).join(' + ')+' color perspectives':'Color perspectives not scored';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" role="img" aria-labelledby="title"><title id="title">${title}</title>${circles}</svg>\n`;
 await writeFile(new URL(`combination-${mask.toString(16)}.svg`,root),svg);
}
console.log('16 deterministic color images generated (15 combinations + unscored).');
