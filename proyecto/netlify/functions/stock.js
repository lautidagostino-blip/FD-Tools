const { getStore } = require("@netlify/blobs");

// Stock inicial por defecto (se usa solo la primera vez, después se guarda lo que cargues en el panel).
const DEFAULT_STOCK = {
  p1: 5,
  p2: 5,
  p3: 10,
  p4: 5,
  p5: 5,
  p6: 5,
};

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const store = getStore({
    name: "fd-tools-stock",
    siteID: "9ac1e6d3-858f-49c3-8cbe-fccee3fb1314",
    token: process.env.BLOBS_TOKEN,
  });

  if (event.httpMethod === "GET") {
    const stock = (await store.get("stock", { type: "json" })) || DEFAULT_STOCK;
    return { statusCode: 200, headers, body: JSON.stringify(stock) };
  }

  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "JSON inválido" }) };
    }

    const current = (await store.get("stock", { type: "json" })) || DEFAULT_STOCK;

    // Acción: actualizar cantidades desde el panel de administración (requiere clave de admin).
    if (body.action === "set") {
      const adminKey = process.env.ADMIN_KEY;
      if (!adminKey || body.adminKey !== adminKey) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: "No autorizado" }) };
      }
      const updated = Object.assign({}, current, body.stock || {});
      await store.setJSON("stock", updated);
      return { statusCode: 200, headers, body: JSON.stringify(updated) };
    }

    // Acción: descontar stock al confirmar una compra.
    if (body.action === "decrement") {
      const items = body.items || {}; // { id: cantidad }
      for (const id in items) {
        const avail = current[id] != null ? current[id] : Infinity;
        if (avail < items[id]) {
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ error: "Sin stock suficiente", id }),
          };
        }
      }
      for (const id in items) {
        if (current[id] != null) current[id] = current[id] - items[id];
      }
      await store.setJSON("stock", current);
      return { statusCode: 200, headers, body: JSON.stringify(current) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Acción inválida" }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Método no permitido" }) };
};
