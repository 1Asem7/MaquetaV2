"use strict";
/* Servidor Node para la Maqueta v2 del río.
   - Sirve la maqueta desde /public (index.html).
   - Sirve three.js r128 localmente desde node_modules en /vendor/three,
     así la maqueta funciona sin internet (el CDN queda como respaldo). */
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.use("/vendor/three", express.static(path.join(__dirname, "node_modules", "three"), { maxAge: "7d" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/salud", (req, res) => {
  res.json({ ok: true, servicio: "maqueta-rio-v2", hora: new Date().toISOString() });
});

app.use((req, res) => res.status(404).send("No encontrado"));

app.listen(PORT, HOST, () => {
  console.log(`Maqueta v2 disponible en http://localhost:${PORT}`);
});
