const syncDB = require('./sync');

syncDB().then(() => {
    console.log("Done.");
});
