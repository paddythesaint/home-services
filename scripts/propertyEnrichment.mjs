// County-records enrichment for the flagship parcel — run from the
// property-enrichment workflow (Actions runners have open egress; the
// dev sandbox does not, so discovery happens here).
//
// MODE=probe   — discover what Albemarle GIS / FEMA actually expose for
//                parcel 05900-00-00-020B1; print findings. Everything
//                printed is public county record — no private data.
// MODE=apply   — write the discovered values to the 895 record as facts
//                (source "county records", auto), idempotent by fixed
//                doc ids so re-runs never duplicate.

const PIN = "05900-00-00-020B1"
const MODE = process.env.MODE || "probe"

const get = async (url) => {
  const res = await fetch(url, { headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 120)}`)
  return res.json()
}

// --- 1 · Albemarle GIS: find the parcel and read its attributes ----------
// County ArcGIS servers conventionally live under /arcgis/rest/services.
const GIS_ROOTS = [
  // The county's public ArcGIS directory (path is arcgis_public, not arcgis).
  "https://gisweb.albemarle.org/arcgis_public/rest/services",
]

async function listServices(root) {
  const top = await get(`${root}?f=json`)
  const out = [...(top.services || []).map((s) => `${s.name} (${s.type})`)]
  for (const f of top.folders || []) {
    try {
      const sub = await get(`${root}/${f}?f=json`)
      out.push(...(sub.services || []).map((s) => `${s.name} (${s.type})`))
    } catch {
      out.push(`${f}/ (unreadable)`)
    }
  }
  return { root, services: out }
}

async function queryParcel(root, service) {
  // Try each layer of the service for a PIN-ish field match.
  const svc = await get(`${root}/${service}/MapServer?f=json`)
  const layers = svc.layers || []
  const found = []
  for (const layer of layers.slice(0, 25)) {
    try {
      const meta = await get(`${root}/${service}/MapServer/${layer.id}?f=json`)
      const fields = (meta.fields || []).map((f) => f.name)
      const pinField = fields.find((f) => /^(PIN|ParcelID|PARCEL|GPIN|TMP)$/i.test(f))
      if (!pinField) continue
      const q = await get(
        `${root}/${service}/MapServer/${layer.id}/query?where=${encodeURIComponent(
          `${pinField}='${PIN}'`
        )}&outFields=*&returnGeometry=true&outSR=4326&f=json`
      )
      if ((q.features || []).length > 0) {
        found.push({ layer: `${service}/${layer.id} (${layer.name})`, pinField, feature: q.features[0] })
      }
    } catch {
      /* layer not queryable — skip */
    }
  }
  return found
}

// --- 2 · FEMA NFHL flood zone by point -----------------------------------
async function floodZone(lon, lat) {
  const geom = encodeURIComponent(JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }))
  const q = await get(
    `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=${geom}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json`
  )
  return (q.features || [])[0]?.attributes || null
}

// Parcel centroid from returned geometry rings (rough mean — fine for a
// point-in-polygon flood lookup on a 5-acre parcel).
function centroid(feature) {
  const rings = feature?.geometry?.rings?.[0]
  if (!rings?.length) return null
  const [sx, sy] = rings.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0])
  return { lon: sx / rings.length, lat: sy / rings.length }
}

// ArcGIS Online mirrors of county parcel data (UVA Library, VGIN) — solid
// TLS and cloud-friendly, unlike the county's own server.
async function findHostedParcelServices() {
  const q = encodeURIComponent('albemarle parcels type:"Feature Service"')
  const res = await get(`https://www.arcgis.com/sharing/rest/search?q=${q}&num=10&f=json`)
  return (res.results || []).map((r) => ({ title: r.title, owner: r.owner, url: r.url }))
}

async function queryHosted(url) {
  const svc = await get(`${url}?f=json`)
  const layers = svc.layers || [{ id: 0 }]
  const found = []
  for (const layer of layers.slice(0, 5)) {
    try {
      const meta = await get(`${url}/${layer.id}?f=json`)
      const fields = (meta.fields || []).map((f) => f.name)
      const pinFields = fields.filter((f) => /PIN|PARCEL|GPIN|TMP|LRSN/i.test(f))
      if (pinFields.length === 0) continue
      console.log(`  layer ${layer.id} fields: ${fields.join(", ").slice(0, 600)}`)
      // Learn the layer's actual id format from a sample before matching.
      try {
        const sample = await get(
          `${url}/${layer.id}/query?where=1%3D1&outFields=${pinFields.join(",")}&resultRecordCount=3&returnGeometry=false&f=json`
        )
        console.log(
          `  sample ids: ${JSON.stringify((sample.features || []).map((f) => f.attributes))}`
        )
      } catch {
        /* sampling blocked — try matching blind */
      }
      const candidates = [
        PIN,
        PIN.replace(/-/g, ""),
        "05900-00-00-020B1",
        "059000000020B1",
        "59-20B1",
        "05900000020B1",
      ]
      for (const pinField of pinFields) {
        for (const val of candidates) {
          try {
            const q = await get(
              `${url}/${layer.id}/query?where=${encodeURIComponent(
                `UPPER(${pinField}) LIKE '%${val}%'`
              )}&outFields=*&returnGeometry=true&outSR=4326&f=json`
            )
            if ((q.features || []).length > 0) {
              found.push({ layer: `${url}/${layer.id}`, pinField, feature: q.features[0] })
              return found
            }
          } catch {
            /* string ops unsupported on this field — next */
          }
        }
      }
    } catch (e) {
      console.log(`  (layer ${layer.id} failed: ${e.message})`)
    }
  }
  return found
}

// Statewide parcels published by VGIN (Virginia's GIS clearinghouse).
const VGIN_PARCELS =
  "https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/FeatureServer"

async function probe() {
  // 1 · County server (expected to fail from cloud IPs — log the cause).
  for (const root of GIS_ROOTS) {
    try {
      const { services } = await listServices(root)
      console.log(`\nGIS root OK: ${root}`)
      console.log(services.map((s) => `  - ${s}`).join("\n"))
    } catch (e) {
      console.log(`GIS root failed: ${root} — ${e.message} (cause: ${e.cause?.code || e.cause?.message || "?"})`)
    }
  }

  // 2 · FEMA reachability with approximate coordinates (exact centroid
  //     comes later from whichever parcel source wins).
  try {
    const fz = await floodZone(-78.55, 38.08)
    console.log(`\nFEMA reachable — zone near 38.08,-78.55: ${JSON.stringify(fz)}`)
  } catch (e) {
    console.log(`\nFEMA lookup failed: ${e.message} (cause: ${e.cause?.code || "?"})`)
  }

  // 3 · Hosted mirrors: VGIN statewide first, then ArcGIS Online search.
  const sources = [{ title: "VGIN VA_Parcels", url: VGIN_PARCELS }]
  try {
    sources.push(...(await findHostedParcelServices()))
  } catch (e) {
    console.log(`ArcGIS Online search failed: ${e.message}`)
  }
  console.log(`\nCandidates:`)
  sources.forEach((s) => console.log(`  - ${s.title} ${s.url || "(no url)"}`))

  for (const s of sources) {
    if (!s.url) continue
    console.log(`\nProbing ${s.title}…`)
    try {
      const hits = await queryHosted(s.url)
      for (const h of hits) {
        console.log(`PARCEL HIT in ${h.layer} via ${h.pinField}:`)
        console.log(JSON.stringify(h.feature.attributes, null, 2).slice(0, 3500))
        const c = centroid(h.feature)
        if (c) {
          console.log(`centroid: ${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`)
          try {
            const fz = await floodZone(c.lon, c.lat)
            console.log(`FEMA flood zone at parcel: ${JSON.stringify(fz)}`)
          } catch (e) {
            console.log(`FEMA at parcel failed: ${e.message}`)
          }
        }
        return // one good source is enough
      }
      if (hits.length === 0) console.log(`(no parcel match)`)
    } catch (e) {
      console.log(`(probe failed: ${e.message})`)
    }
  }
}

// VGIN statewide parcels carry PTM_ID — the locality tax-map id.
async function vginParcel() {
  const q = await get(
    `${VGIN_PARCELS}/0/query?where=${encodeURIComponent(
      `LOCALITY='Albemarle County' AND PTM_ID='${PIN}'`
    )}&outFields=*&returnGeometry=true&outSR=4326&f=json`
  )
  return (q.features || [])[0] || null
}

async function apply() {
  const { initializeApp, applicationDefault } = await import("firebase-admin/app")
  const { getFirestore } = await import("firebase-admin/firestore")
  initializeApp({ credential: applicationDefault() })
  const db = getFirestore()

  const HOME_ID = "qMiuCATsw2P96T6tYaAH539V7Pd2" // 895 Old Ballard
  const home = await db.doc(`properties/${HOME_ID}`).get()
  if (!home.exists || !(home.get("address") || "").startsWith("895")) {
    throw new Error("apply REFUSED: 895 target not found — wrong property?")
  }

  // Ground truth for the flood lookup: the parcel's own centroid when VGIN
  // has it, the area point otherwise.
  let point = { lon: -78.55, lat: 38.08 }
  let pointSource = "area approximation"
  try {
    const parcel = await vginParcel()
    if (parcel) {
      const c = centroid(parcel)
      if (c) {
        point = c
        pointSource = "parcel centroid (VGIN)"
      }
      console.log(`VGIN parcel found (PTM_ID match); centroid: ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`)
    } else {
      console.log("VGIN parcel not matched — using area point for flood lookup")
    }
  } catch (e) {
    console.log(`VGIN lookup failed (${e.message}) — using area point`)
  }

  const facts = []
  try {
    const fz = await floodZone(point.lon, point.lat)
    if (fz?.FLD_ZONE) {
      const minimal = /X/.test(fz.FLD_ZONE) && /MINIMAL/i.test(fz.ZONE_SUBTY || "")
      facts.push({
        id: "enrich-floodzone",
        text: `FEMA flood zone ${fz.FLD_ZONE}${fz.ZONE_SUBTY ? ` — ${fz.ZONE_SUBTY.toLowerCase()}` : ""}${minimal ? " (no flood insurance requirement)" : ""}. Source: FEMA NFHL, ${pointSource}, July 2026.`,
        category: "Site & Hazards",
      })
    }
  } catch (e) {
    console.log(`FEMA lookup failed: ${e.message}`)
  }

  // EPA radon county classification — static federal designation.
  facts.push({
    id: "enrich-radonzone",
    text: "EPA Radon Zone 1 county (highest predicted indoor radon potential) — annual radon awareness worthwhile; the home's Airthings monitor covers this. Source: EPA Map of Radon Zones, Albemarle County.",
    category: "Air Quality",
  })

  for (const f of facts) {
    const ref = db.doc(`properties/${HOME_ID}/facts/${f.id}`)
    if ((await ref.get()).exists) {
      console.log(`fact ${f.id}: already on the record — skipped`)
      continue
    }
    await ref.set({
      text: f.text,
      category: f.category,
      source: "county records",
      confirmedBy: "auto (public records enrichment)",
      date: todayLabel(),
      order: Date.now(),
    })
    console.log(`fact ${f.id}: written`)
  }

  // Discovery for the next wave (assessment + permits): the county's GIS
  // server rejects cloud clients, but the main site may host the weekly
  // tabular extracts — list candidate download links for the next run.
  try {
    const res = await fetch(
      "https://www.albemarle.org/government/information-technology/geographic-information-system-gis-mapping/gis-data"
    )
    const html = await res.text()
    const links = [...html.matchAll(/href="([^"]+\.(?:zip|csv|txt|xlsx)[^"]*)"/gi)]
      .map((m) => m[1])
      .slice(0, 30)
    console.log(`\ncounty download links found (${links.length}):`)
    links.forEach((l) => console.log(`  - ${l}`))
  } catch (e) {
    console.log(`county downloads page unreachable: ${e.message}`)
  }
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  })
}

await (MODE === "apply" ? apply() : probe())
console.log("\nenrichment complete")
