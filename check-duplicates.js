const fs = require('fs');

const state = JSON.parse(fs.readFileSync('./local-monitor-state.json', 'utf8'));
const items = state.currentState.items;
const ids = items.map(i => i.id);
const uniqueIds = new Set(ids);

console.log('Total items:', items.length);
console.log('Unique IDs:', uniqueIds.size);
console.log('Duplicates:', items.length - uniqueIds.size);

if (items.length !== uniqueIds.size) {
  const counts = {};
  ids.forEach(id => counts[id] = (counts[id] || 0) + 1);
  const dups = Object.entries(counts).filter(([id, count]) => count > 1);
  console.log('\nDuplicate items:');
  dups.slice(0, 20).forEach(([id, count]) => {
    const item = items.find(i => i.id === id);
    console.log(`  ID ${id} (${item.name}): appears ${count} times`);
  });
  console.log(`\nTotal duplicate IDs: ${dups.length}`);
}
