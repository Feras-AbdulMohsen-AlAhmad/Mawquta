// api/geocode.js

export default async function handler(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit || 8), 12);

    if (!q || q.length < 3) {
      return res.status(200).json({ ok: true, results: [] });
    }

    const username = process.env.GEONAMES_USERNAME;
    if (!username) {
      return res.status(500).json({
        ok: false,
        error: "Missing GEONAMES_USERNAME environment variable",
      });
    }

    const url = new URL("https://secure.geonames.org/searchJSON");
    url.searchParams.set("name_startsWith", q);
    url.searchParams.set("featureClass", "P");
    url.searchParams.set("maxRows", String(limit));
    url.searchParams.set("style", "FULL");
    url.searchParams.set("lang", String(req.query.lang || "en"));
    url.searchParams.set("username", username);

    const r = await fetch(url.toString());
    if (!r.ok) {
      return res.status(502).json({
        ok: false,
        error: `GeoNames request failed: ${r.status}`,
      });
    }

    const data = await r.json();
    const items = Array.isArray(data?.geonames) ? data.geonames : [];

    const results = items
      .map((x) => {
        const city = x?.name || "";
        const country = x?.countryName || "";
        const lat = Number(x?.lat);
        const lon = Number(x?.lng);

        return {
          label: country ? `${city}, ${country}` : city,
          city,
          country,
          lat,
          lon,
        };
      })
      .filter(
        (s) =>
          s.city &&
          s.country &&
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lon),
      );

    // Simple caching (CDN) to reduce upstream calls
    res.setHeader(
      "Cache-Control",
      "s-maxage=3600, stale-while-revalidate=86400",
    );
    return res.status(200).json({ ok: true, results });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: "Unexpected server error" });
  }
}
