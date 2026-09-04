const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 4176);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "matics.json");

const DETAIL_LIBRARY = {
  imperium: {
    roles: ["Hauler", "Polisher", "Chantor", "Clerk", "Bonker"],
    chassis: ["Reliquary", "Bulwark", "Choirling", "Archivist", "Forgebud"],
    halo: ["Sun Ring", "Servo Crown", "Bell Halo", "Archive Disc"],
    wings: ["Feather Nubs", "Censer Fins", "Ribbon Wings"],
    prop: ["Sacred Crate", "Polish Kit", "Warning Bell", "Stapler Relic", "Holy Mallet"],
    temperament: ["Polite", "Fussy", "Ecstatic", "Meticulous", "Overeager"]
  },
  chaos: {
    roles: ["Hauler", "Polisher", "Chantor", "Clerk", "Bonker"],
    chassis: ["Warp Plush", "Rot Cherub", "Gleam Imp", "Ledger Fiend", "Riot Sprite"],
    halo: ["Bent Ring", "Smoke Crown", "Eye Halo", "Toothy Disc"],
    wings: ["Bat Nubs", "Smoke Wings", "Patchwork Fins"],
    prop: ["Cursed Crate", "Gleam Orb", "Prophecy Gong", "Hex Ledger", "Padded Bonker"],
    temperament: ["Mischievous", "Obsessive", "Dramatic", "Pompous", "Unhinged"]
  },
  xenos: {
    roles: ["Hauler", "Polisher", "Chantor", "Clerk", "Bonker"],
    chassis: ["Dronekin", "Crestling", "Carapace Bud", "Moon Archivist", "Orbit Hopper"],
    halo: ["Drone Halo", "Crest Ring", "Glyph Disc", "Orbit Crown"],
    wings: ["Fin Wings", "Insect Veils", "Drone Tabs"],
    prop: ["Cargo Seed", "Mirror Drone", "Signal Chime", "Data Slates", "Soft Impact Staff"],
    temperament: ["Serene", "Curious", "Analytical", "Precise", "Bold"]
  }
};

const factionSkins = {
  imperium: {
    label: "Imperium",
    accent: "#f4b53f",
    glow: "#f9db8f"
  },
  chaos: {
    label: "Chaos",
    accent: "#ff5a5f",
    glow: "#ff9e84"
  },
  xenos: {
    label: "Xenos",
    accent: "#53d9d1",
    glow: "#97fff7"
  }
};

const seededMatics = [
  {
    serial: "MAT-IMP-0001",
    name: "Pater-Load 0001",
    faction: "imperium",
    role: "Hauler",
    chassis: "Bulwark",
    halo: "Servo Crown",
    wings: "Censer Fins",
    prop: "Sacred Crate",
    temperament: "Polite",
    notes: "Strong, silent, very polite."
  },
  {
    serial: "MAT-IMP-0002",
    name: "Lustra-Gloss 0002",
    faction: "imperium",
    role: "Polisher",
    chassis: "Forgebud",
    halo: "Sun Ring",
    wings: "Ribbon Wings",
    prop: "Polish Kit",
    temperament: "Fussy",
    notes: "Makes everything shiny-shiny."
  },
  {
    serial: "MAT-IMP-0003",
    name: "Cantum-Alarm 0003",
    faction: "imperium",
    role: "Chantor",
    chassis: "Choirling",
    halo: "Bell Halo",
    wings: "Feather Nubs",
    prop: "Warning Bell",
    temperament: "Ecstatic",
    notes: "Voices of encouragement and doom."
  },
  {
    serial: "MAT-IMP-0004",
    name: "Archivum-Tack 0004",
    faction: "imperium",
    role: "Clerk",
    chassis: "Archivist",
    halo: "Archive Disc",
    wings: "Ribbon Wings",
    prop: "Stapler Relic",
    temperament: "Meticulous",
    notes: "Paperwork is sacred. So are staplers."
  },
  {
    serial: "MAT-IMP-0005",
    name: "Thumpus-Joy 0005",
    faction: "imperium",
    role: "Bonker",
    chassis: "Reliquary",
    halo: "Sun Ring",
    wings: "Censer Fins",
    prop: "Holy Mallet",
    temperament: "Overeager",
    notes: "Solves problems with extreme enthusiasm."
  }
];

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const records = seededMatics.map((item) => ({
      ...item,
      signature: buildSignature(item),
      createdAt: "2026-09-03T00:00:00.000Z"
    }));
    fs.writeFileSync(DATA_FILE, JSON.stringify({ matics: records }, null, 2));
  }
}

function readData() {
  ensureData();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function buildSignature(spec) {
  return [
    spec.faction,
    spec.role,
    spec.chassis,
    spec.halo,
    spec.wings,
    spec.prop,
    spec.temperament
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}

function nextSerial(records, faction) {
  const prefix = `MAT-${faction.slice(0, 3).toUpperCase()}-`;
  const max = records
    .filter((record) => record.serial.startsWith(prefix))
    .map((record) => Number(record.serial.slice(prefix.length)))
    .filter((value) => Number.isFinite(value))
    .reduce((current, value) => Math.max(current, value), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function makeName(spec, serial) {
  const a = spec.chassis.replace(/[^A-Za-z]/g, "").slice(0, 8) || "Matic";
  const b = spec.prop.replace(/[^A-Za-z]/g, "").slice(0, 8) || "Unit";
  return `${a}-${b} ${serial.slice(-4)}`;
}

function randomPick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomSpec(faction) {
  const library = DETAIL_LIBRARY[faction];
  return {
    faction,
    role: randomPick(library.roles),
    chassis: randomPick(library.chassis),
    halo: randomPick(library.halo),
    wings: randomPick(library.wings),
    prop: randomPick(library.prop),
    temperament: randomPick(library.temperament)
  };
}

function sanitizeSpec(input) {
  const faction = typeof input.faction === "string" ? input.faction.toLowerCase() : "imperium";
  const library = DETAIL_LIBRARY[faction] || DETAIL_LIBRARY.imperium;
  const spec = {
    faction,
    role: library.roles.includes(input.role) ? input.role : library.roles[0],
    chassis: library.chassis.includes(input.chassis) ? input.chassis : library.chassis[0],
    halo: library.halo.includes(input.halo) ? input.halo : library.halo[0],
    wings: library.wings.includes(input.wings) ? input.wings : library.wings[0],
    prop: library.prop.includes(input.prop) ? input.prop : library.prop[0],
    temperament: library.temperament.includes(input.temperament) ? input.temperament : library.temperament[0]
  };
  return spec;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function serveFile(res, filePath) {
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8"
    };
    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream"
    });
    res.end(content);
  });
}

function listPayload() {
  const data = readData();
  return {
    skins: factionSkins,
    detailLibrary: DETAIL_LIBRARY,
    matics: data.matics.sort((a, b) => b.serial.localeCompare(a.serial))
  };
}

function handleGenerate(req, res) {
  parseBody(req)
    .then((body) => {
      const mode = body.mode === "random" ? "random" : "manual";
      const spec = mode === "random" ? randomSpec(body.faction || "imperium") : sanitizeSpec(body.spec || {});
      const data = readData();
      const signature = buildSignature(spec);
      const existing = data.matics.find((record) => record.signature === signature);

      if (existing) {
        return json(res, 409, {
          ok: false,
          message: "This Matic configuration has already been sanctified.",
          existing
        });
      }

      const serial = nextSerial(data.matics, spec.faction);
      const record = {
        ...spec,
        serial,
        name: body.name && String(body.name).trim() ? String(body.name).trim().slice(0, 48) : makeName(spec, serial),
        notes: body.notes && String(body.notes).trim() ? String(body.notes).trim().slice(0, 160) : "",
        signature,
        createdAt: new Date().toISOString(),
        entropy: crypto.randomBytes(4).toString("hex")
      };

      data.matics.push(record);
      writeData(data);

      return json(res, 201, { ok: true, record });
    })
    .catch((error) => {
      json(res, 400, { ok: false, message: error.message || "Invalid request" });
    });
}

function handleRps(req, res) {
  parseBody(req)
    .then((body) => {
      const choice = String(body.choice || "").toLowerCase();
      const valid = ["rock", "paper", "scissors"];
      if (!valid.includes(choice)) {
        return json(res, 400, { ok: false, message: "Invalid choice" });
      }
      const matics = readData().matics;
      const opponent = matics[Math.floor(Math.random() * matics.length)] || seededMatics[0];
      const spiritChoice = valid[Math.floor(Math.random() * valid.length)];
      const result =
        choice === spiritChoice ? "draw" :
        (choice === "rock" && spiritChoice === "scissors") ||
        (choice === "paper" && spiritChoice === "rock") ||
        (choice === "scissors" && spiritChoice === "paper") ? "win" : "lose";
      return json(res, 200, {
        ok: true,
        opponent: {
          name: opponent.name,
          role: opponent.role,
          faction: opponent.faction,
          serial: opponent.serial
        },
        spiritChoice,
        result
      });
    })
    .catch((error) => {
      json(res, 400, { ok: false, message: error.message || "Invalid request" });
    });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/matics") {
    return json(res, 200, listPayload());
  }

  if (req.method === "POST" && url.pathname === "/api/matics/generate") {
    return handleGenerate(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/rps") {
    return handleRps(req, res);
  }

  const target = url.pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, url.pathname);
  return serveFile(res, target);
});

ensureData();
server.listen(PORT, HOST, () => {
  console.log(`Matic Spirits portal running on http://${HOST}:${PORT}`);
});
