// `node --test tests/` globs the directory itself. Loading these modules
// registers every case with the runner inside that one process.
import "./arcade.test.js";
import "./bots.test.js";
import "./input.test.js";
import "./match.test.js";
import "./physics.test.js";
import "./powerups.test.js";
import "./rng.test.js";
