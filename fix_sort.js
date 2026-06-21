const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;
              return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });`;

const replacement = `if (typeof valA === 'number' && typeof valB === 'number') {
                if (valA !== valB) return valA - valB;
                return (a.id || '').localeCompare(b.id || '');
              }
              const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
              return comp !== 0 ? comp : (a.id || '').localeCompare(b.id || '');`;

content = content.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g'), replacement);

const target2 = `if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;
                    return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });`;

const replacement2 = `if (typeof valA === 'number' && typeof valB === 'number') {
                      if (valA !== valB) return valA - valB;
                      return (a.id || '').localeCompare(b.id || '');
                    }
                    const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
                    return comp !== 0 ? comp : (a.id || '').localeCompare(b.id || '');`;

content = content.replace(new RegExp(target2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g'), replacement2);

fs.writeFileSync('src/App.tsx', content);
