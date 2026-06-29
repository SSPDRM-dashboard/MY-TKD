const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/w-12 h-12 text-center border-2 border-\[#00a2e8\] transition-all font-black text-lg focus:outline-none focus:ring-2 focus:ring-\[#00a2e8\] mx-auto flex items-center justify-center rounded-full/g, "w-full h-12 text-center border-2 border-[#00a2e8] transition-all font-black text-lg focus:outline-none focus:ring-2 focus:ring-[#00a2e8] mx-auto flex items-center justify-center rounded-lg");

code = code.replace(/w-12 h-12 text-center border-2 border-\[#ed1c24\] transition-all font-black text-lg focus:outline-none focus:ring-2 focus:ring-\[#ed1c24\] mx-auto flex items-center justify-center rounded-full/g, "w-full h-12 text-center border-2 border-[#ed1c24] transition-all font-black text-lg focus:outline-none focus:ring-2 focus:ring-[#ed1c24] mx-auto flex items-center justify-center rounded-lg");

fs.writeFileSync('src/App.tsx', code);
console.log("Done");
