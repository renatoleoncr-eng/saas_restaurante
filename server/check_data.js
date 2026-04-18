const { Area, Table } = require('./models');

async function check() {
    try {
        const areas = await Area.count();
        const tables = await Table.count();
        console.log(`Areas: ${areas}, Tables: ${tables}`);
    } catch (e) {
        console.error(e);
    }
}

check();
