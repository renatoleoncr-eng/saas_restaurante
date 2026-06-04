const { Table, Area } = require('./models');
async function run() {
    const tables = await Table.findAll({ include: [Area] });
    tables.forEach(t => {
        console.log(`Table ID: ${t.id} | Number: ${t.number} | Area: ${t.Area ? t.Area.name : 'NULL'} (ID: ${t.AreaId}) | Status: ${t.status}`);
    });
}
run();
