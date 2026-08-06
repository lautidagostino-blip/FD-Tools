// Esta función corre en el servidor de Netlify (nunca en el navegador del cliente).
// Usa tu Access Token secreto de Mercado Pago, guardado como variable de entorno
// MP_ACCESS_TOKEN en la configuración del sitio en Netlify, para crear un link de
// pago (preferencia) por el total exacto del carrito, incluyendo los datos de envío.

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Método no permitido" }) };
  }

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Falta configurar MP_ACCESS_TOKEN en Netlify" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (rawItems.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "El carrito está vacío" }) };
    }

    // Se recalculan/validan los items del lado del servidor antes de mandarlos a Mercado Pago.
    const items = rawItems.map((it) => ({
      title: String(it.title || "Producto").slice(0, 200),
      quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
      unit_price: Math.max(0, Number(it.unit_price) || 0),
      currency_id: "ARS",
    }));

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
    const shipping = body.shipping && typeof body.shipping === "object" ? body.shipping : null;

    const preference = {
      items,
      back_urls: {
        success: `${siteUrl}/?status=success`,
        failure: `${siteUrl}/?status=failure`,
        pending: `${siteUrl}/?status=pending`,
      },
      auto_return: "approved",
    };

    if (shipping) {
      const fullName = String(shipping.name || "").trim();
      const parts = fullName.split(" ").filter(Boolean);
      const firstName = parts.shift() || "";
      const lastName = parts.join(" ");

      preference.payer = {
        name: firstName || undefined,
        surname: lastName || undefined,
        phone: shipping.phone ? { number: String(shipping.phone).slice(0, 30) } : undefined,
        address: shipping.address
          ? { street_name: String(shipping.address).slice(0, 200), zip_code: String(shipping.zip || "").slice(0, 20) }
          : undefined,
      };

      preference.shipments = {
        receiver_address: {
          zip_code: String(shipping.zip || "").slice(0, 20),
          street_name: String(shipping.address || "").slice(0, 200),
          city_name: String(shipping.city || "").slice(0, 100),
          state_name: String(shipping.province || "").slice(0, 100),
        },
      };

      // Guardamos también los datos de envío en external_reference para verlos fácil en el panel de Mercado Pago.
      preference.external_reference = JSON.stringify({
        name: fullName,
        phone: shipping.phone || "",
        address: shipping.address || "",
        city: shipping.city || "",
        province: shipping.province || "",
        zip: shipping.zip || "",
      }).slice(0, 600);
    }

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Error de Mercado Pago", detail: data }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ init_point: data.init_point }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
