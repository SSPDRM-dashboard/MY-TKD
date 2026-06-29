const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/\{current\?\.points\?\.r1Blue \|\| '-'\}/g, "{current?.points?.r1Blue || ''}");
code = code.replace(/\{current\?\.points\?\.r2Blue \|\| '-'\}/g, "{current?.points?.r2Blue || ''}");
code = code.replace(/\{current\?\.points\?\.r3Blue \|\| '-'\}/g, "{current?.points?.r3Blue || ''}");
code = code.replace(/\{current\?\.points\?\.r1Red \|\| '-'\}/g, "{current?.points?.r1Red || ''}");
code = code.replace(/\{current\?\.points\?\.r2Red \|\| '-'\}/g, "{current?.points?.r2Red || ''}");
code = code.replace(/\{current\?\.points\?\.r3Red \|\| '-'\}/g, "{current?.points?.r3Red || ''}");

fs.writeFileSync('src/App.tsx', code);
console.log("Done");
