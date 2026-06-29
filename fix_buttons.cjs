const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/"h-7 w-7 text-\[10px\] font-black rounded-lg transition-all flex items-center justify-center"/g, '"h-7 flex-1 text-[10px] font-black rounded-lg transition-all flex items-center justify-center"');

fs.writeFileSync('src/App.tsx', code);
console.log("Done");
