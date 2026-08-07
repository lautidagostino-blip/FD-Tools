exports.handler = async function (event, context) {
  const SELLER_ID = "166260210";
    const token = process.env.MP_ACCESS_TOKEN;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

        try {
            const searchUrl = "https://api.mercadolibre.com/users/" + SELLER_ID + "/items/search?status=active&limit=100";
                const searchRes = await fetch(searchUrl, { headers });
                    const searchData = await searchRes.json();

                        if (!searchRes.ok) {
                              return {
                                      statusCode: searchRes.status,
                                              headers: { "Access-Control-Allow-Origin": "*" },
                                                      body: JSON.stringify({ step: "search", error: searchData }),
                                                      }
}                                                      

const ids = searchData.results || [];
if (ids.length === 0) {
return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ items: [] }) };
}

const chunks = [];
for (let i = 0; i < ids.length; i += 20) {
chunks.push(ids.slice(i, i + 20));
}

let items = [];
for (const chunk of chunks) {
const detailUrl = "https://api.mercadolibre.com/items?ids=" + chunk.join(",");
const detRes = await fetch(detailUrl, { headers });
const detData = await detRes.json();
if (!detRes.ok) {
return { statusCode: detRes.status, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ step: "detail", error: detData }) };
}
items = items.concat(detData);
}

const simplified = items.map(function (entry) {
const b = entry.body || {};
const pics = (b.pictures || []).map(function (p) { return p.secure_url || p.url; });
return { id: b.id, title: b.title, price: b.price, available_quantity: b.available_quantity, pictures: pics, permalink: b.permalink };
});

return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ items: simplified }) };
} catch (err) {
return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
}
};
