const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- ALTERING TABLES ---');

db.serialize(() => {
    // Add AccountId to ProductMovements
    db.run("ALTER TABLE ProductMovements ADD COLUMN AccountId INTEGER REFERENCES Accounts(id) ON DELETE SET NULL ON UPDATE CASCADE", (err) => {
        if (err) {
            console.log("ProductMovements.AccountId already exists or error:", err.message);
        } else {
            console.log("Added AccountId to ProductMovements successfully.");
        }
    });

    // Add AccountId to IngredientMovements
    db.run("ALTER TABLE IngredientMovements ADD COLUMN AccountId INTEGER REFERENCES Accounts(id) ON DELETE SET NULL ON UPDATE CASCADE", (err) => {
        if (err) {
            console.log("IngredientMovements.AccountId already exists or error:", err.message);
        } else {
            console.log("Added AccountId to IngredientMovements successfully.");
        }
    });
});

db.close(() => {
    console.log('--- DONE ---');
});
