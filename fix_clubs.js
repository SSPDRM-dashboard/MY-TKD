const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/<p className="text-\[15px\] font-bold text-slate-900 uppercase leading-none mb-1">/g, '<p className="text-[15px] font-bold text-yellow-400 uppercase leading-none mb-1">');
fs.writeFileSync('src/App.tsx', code);
