/* Statische Regression: geladene JS-/CSS-Dateien müssen vorhanden sein.
 * Ausschließlich Node-Standardbibliothek, keine Schülerdaten.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const root=path.resolve(__dirname,'..');
const refs=[...html.matchAll(/<(?:script|link)\s[^>]*?(?:src|href)="([^"]+)"/g)]
 .map(x=>x[1].split('?')[0].split('#')[0]).filter(x=>/\.(js|css)$/i.test(x)&&!/^https?:\/\//i.test(x));
const missing=refs.filter(p=>!fs.existsSync(path.join(root,p)));
const duplicate=refs.filter((s,i)=>refs.indexOf(s)!==i);
const expected=[
 'schulcockpit-mein-schultag-v320-core.js',
 'schulcockpit-mein-schultag-v320.js',
 'schulcockpit-mein-schultag-v320.css'
];
const absent=expected.filter(p=>!refs.includes(p));
const position=x=>html.indexOf('"'+x);
const invalidOrder=position(expected[0])>position(expected[1]);
if(missing.length||duplicate.length||absent.length||invalidOrder){
 console.error('Fehler in der statischen Schulcockpit-Einbindung.');
 if(missing.length)console.error('Nicht vorhanden:',missing.join(', '));
 if(duplicate.length)console.error('Doppelt:',[...new Set(duplicate)].join(', '));
 if(absent.length)console.error('Fehlend in index.html:',absent.join(', '));
 if(invalidOrder)console.error('Tagesansicht vor dem Kernmodul eingebunden.');
 process.exitCode=1;
}else console.log('OK: '+refs.length+' JS-/CSS-Referenzen vorhanden, eindeutig und korrekt eingebunden.');
