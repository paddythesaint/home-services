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

async function probe() {
  for (const root of GIS_ROOTS) {
    try {
      const { services } = await listServices(root)
      console.log(`\nGIS root OK: ${root}`)
      console.log(services.map((s) => `  - ${s}`).join("\n"))
      // Query every service whose name smells like parcels/assessment/permits.
      const interesting = services
        .map((s) => s.split(" ")[0])
        .filter((n) => /parcel|assess|property|permit|cama|base/i.test(n))
      for (const svc of interesting) {
        try {
          const hits = await queryParcel(root, svc)
          for (const h of hits) {
            console.log(`\nPARCEL HIT in ${h.layer} via ${h.pinField}:`)
            console.log(JSON.stringify(h.feature.attributes, null, 2).slice(0, 3000))
            const c = centroid(h.feature)
            if (c) {
              console.log(`centroid: ${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`)
              try {
                const fz = await floodZone(c.lon, c.lat)
                console.log(`FEMA flood zone: ${JSON.stringify(fz)}`)
              } catch (e) {
                console.log(`FEMA lookup failed: ${e.message}`)
              }
            }
          }
          if (hits.length === 0) console.log(`(no parcel match in ${svc})`)
        } catch (e) {
          console.log(`(query failed for ${svc}: ${e.message})`)
        }
      }
      return // first working root is enough
    } catch (e) {
      console.log(`GIS root failed: ${root} — ${e.message}`)
    }
  }
  console.log("No GIS root reachable — needs endpoint research.")
}

async function apply() {
  // Filled in after the probe run tells us the real field names.
  console.log("apply mode not wired yet — run probe first, then update this script")
  process.exit(1)
}

await (MODE === "apply" ? apply() : probe())
console.log("\nenrichment complete")
