// main.js
let allData, countiesTopo;
const tooltip = d3.select("#tip");
// ────────────────────────────────────────────────────────────────────────────────
// 1) LOAD data_features.csv + COUNTY TOPOJSON (no year filters anymore)
Promise.all([
  d3.csv("data_features.csv", d3.autoType),
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
]).then(([rows, us]) => {
  allData      = rows;  // now allData has every row from data_features.csv
  countiesTopo = topojson.feature(us, us.objects.counties).features;
  drawAll();           // jump straight to drawing—no initFilters()
})
.catch(err => console.error("Data load error:", err));



function initEE() {
  ee.data.authenticateViaPopup(() => {
    ee.initialize(null, null, () => {
      console.log("Earth Engine initialized");
    }, err => console.error("EE init error:", err));
  }, {scope: "https://www.googleapis.com/auth/earthengine.readonly"});
}
gapi.load("client:auth2", initEE);

// ---------------- Dynamic World config ------------
const DW_CLASSES = [
  'water','trees','grass','flooded_vegetation','crops',
  'shrub_and_scrub','built','bare','snow_and_ice'
]
const DW_PALETTE = [
  '419bdf','397d49','88b053','FDD163','E49635',
  'A59B8F','C4281B','D1D1D1','FFFFFF'
]

// 7) CHOROPLETH: COUNTIES FOR SELECTED YEAR
function drawMap(data) {
  const svg = d3.select("#map"),
        W   = svg.node().clientWidth,
        H   = svg.node().clientHeight;
  svg.selectAll("*").remove();

  // 1) Projection + path generator
  const proj    = d3.geoAlbersUsa()
                    .translate([W/2, H/2])
                    .scale(1100);
  const pathGen = d3.geoPath().projection(proj);

  // 2) Count how many rows per FIPS (number of events or records per county)
  const counts = d3.rollups(
    data,           // data = allData from data_features.csv
    vs => vs.length,
    d  => String(d.FIPS).padStart(5, '0')  // ensure five‐digit string
  );
  // counts = [ [ "04005", 12 ], [ "06037", 7 ], … ]

  const countMap = new Map(counts); 
  // Map { "04005" → 12, "06037" → 7, … }

  // 3) Let’s pick a single “fill color” for any county that appears at least once.
  //    If you want a heatmap by the raw count, you can replace this step with a colorScale.
  //    For now, we’ll just do: present = blue; absent = #eee.
  const presentColor = "#3182bd";  
  const absentColor  = "#eee";

  // 4) Draw every county path
  svg.selectAll("path")
    .data(countiesTopo)
    .join("path")
      .attr("d", pathGen)
      .attr("fill", d => {
        // d.id is a string or number. We’ll treat it as a zero‐padded string:
        const fips = String(d.id).padStart(5, '0');
        return countMap.has(fips)
          ? presentColor
          : absentColor;
      })
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .on("click", (e, d) => {
        // When you click a county, we want to draw its feature bar:
        const clickedFips = String(d.id).padStart(5, '0');
        drawFeatureBar(clickedFips);

        // If you still want to draw your dynamic world map, keep this block:
        drawWorldMap(d); 
        // else you can omit it.
      })
      .on("mouseover", (e, d) => {
        const fips = String(d.id).padStart(5, '0');
        const c = countMap.get(fips) || 0;
        tooltip
          .style("opacity", 0.9)
          .html(`<strong>FIPS ${fips}</strong><br>${c} record${c===1?"":"s"}`)
          .style("left", (e.pageX + 10) + "px")
          .style("top",  (e.pageY - 28) + "px");
        d3.select(e.currentTarget)
          .attr("stroke", "#000")
          .attr("stroke-width", 2);
      })
      .on("mouseout", (e, d) => {
        tooltip.style("opacity", 0);
        d3.select(e.currentTarget)
          .attr("stroke", "#999")
          .attr("stroke-width", 1);
      });

  // 5) (Optional) Legend: “Blue = county in data_features.csv; Light gray = not in data”
  const legend = svg.append("g")
    .attr("transform", `translate(20, ${H - 60})`);

  const legendData = [
    { color: presentColor, label: "County present in data" },
    { color: absentColor,  label: "County not in data" }
  ];

  legend.selectAll("rect")
    .data(legendData)
    .join("rect")
      .attr("x",   (d,i) => i * 180)
      .attr("y",     0)
      .attr("width", 20)
      .attr("height",20)
      .attr("fill",  d => d.color);

  legend.selectAll("text")
    .data(legendData)
    .join("text")
      .attr("x", (d,i) => i * 180 + 26)
      .attr("y", 14)
      .style("font-size","12px")
      .text(d => d.label);

  // 6) Title
  svg.append("text")
    .attr("x", W/2).attr("y", 32)
    .attr("text-anchor", "middle")
    .style("font-weight", "600")
    .text("All Counties (from data_features.csv)");
}

function extractTopFeatures(row, n = 15) {
  // 1) Collect all keys that start with "necessity_"
  const featureData = [];
  Object.keys(row).forEach(key => {
    if (key.startsWith("necessity_")) {
      // Remove the "necessity_" prefix
      const featName = key.replace("necessity_", "");
      // Convert the raw string to a number
      const val = +row[key];
      featureData.push({ feature: featName, value: val });
    }
  });

  // 2) Sort descending by value
  featureData.sort((a, b) => b.value - a.value);

  // 3) Return the first n items (or fewer if there aren't n)
  return featureData.slice(0, n);
}


function drawFeatureBar(fips) {
  const svg = d3.select("#bar"),
        W   = svg.node().clientWidth,
        H   = svg.node().clientHeight;
  svg.selectAll("*").remove(); 
  
  


  // 1) Load the entire CSV of instance-level necessity scores
  d3.csv("importance_scores_v4b/instance_necessity_scores.csv", d3.autoType)
    .then(rawData => {
      // 2) Find the single row whose "c" column matches the clicked FIPS
      //    Coerce both to strings to avoid type mismatches.
      //const row = rawData.find(d => String(d.FIPS) === String(fips));
      const row = rawData.find(d => (+d.FIPS) === (+fips));
      if (!row) {
        svg.append("text")
          .attr("x",  W / 2)
          .attr("y",  H / 2)
          .attr("text-anchor", "middle")
          .style("fill", "darkred")
          .text(`No necessity‐score data for FIPS ${fips}`);
        return;
      }

      // 3) Extract the top 15 features by necessity value
      const top15 = extractTopFeatures(row, 15);
      // Now top15 is an array like:
      //   [ { feature: "transition_1_0", value: 0.87 },
      //     { feature: "News_Injuries",   value: 0.75 },
      //     … up to 15 items … ]

      // 4) If there are no "necessity_" keys at all, showing a message
      if (top15.length === 0) {
        svg.append("text")
          .attr("x",  W / 2)
          .attr("y",  H / 2)
          .attr("text-anchor", "middle")
          .style("fill", "darkred")
          .text(`No "necessity_" features found for FIPS ${fips}`);
        return;
      }

      // 5) Define margins & inner dimensions
      const margin = { top: 40, right: 20, bottom: 60, left: 100 },
            innerW = W - margin.left - margin.right,
            innerH = H - margin.top  - margin.bottom;

      // 6) Build scales based on the top15 data
      const xScale = d3.scaleLinear()
        .domain([0, d3.max(top15, d => d.value) || 1])
        .range([margin.left, margin.left + innerW]);

      const yScale = d3.scaleBand()
        .domain(top15.map(d => d.feature))
        .range([margin.top, margin.top + innerH])
        .padding(0.1);

      // 7) Draw X-axis at the bottom
      svg.append("g")
        .attr("transform", `translate(0, ${margin.top + innerH})`)
        .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format(".2f")));

      // 8) Draw Y-axis on the left
      svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(yScale));

      // 9) Chart title
      svg.append("text")
        .attr("class", "chart-title")
        .attr("x", (W / 2) - 1)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .text(`Top 15 Necessity Features for FIPS ${fips}`);

      // 10) X-axis label
      svg.append("text")
        .attr("class", "axis-label")
        .attr("x", margin.left + innerW / 2)
        .attr("y", margin.top + innerH + 50)
        .attr("text-anchor", "middle")
        .text("Necessity Value (0–1)");

      // 11) Y-axis label (vertical)
      svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", - (margin.top + innerH / 2))
        .attr("y", margin.left - 80)
        .attr("text-anchor", "middle")
        .text("Feature");

      // 12) Draw the 15 bars
      svg.selectAll("rect")
        .data(top15)
        .join("rect")
          .attr("x",      d => margin.left)
          .attr("y",      d => yScale(d.feature))
          .attr("width",  d => xScale(d.value) - margin.left)
          .attr("height", yScale.bandwidth())
          .attr("fill",   "#3182bd")
        .on("mouseover", (e, d) => {
          tooltip
            .style("opacity", 0.9)
            .html(`<strong>${d.feature}</strong><br>Value: ${d3.format(".2f")(d.value)}`)
            .style("left", (e.pageX + 8) + "px")
            .style("top",  (e.pageY - 28) + "px");
          d3.select(e.currentTarget).attr("fill", "#f49e4c");
        })
        .on("mouseout", () => {
          tooltip.style("opacity", 0);
          d3.selectAll("#bar rect").attr("fill", "#3182bd");
        });

    })
    .catch(err => {
      console.error("Could not load necessity_scores CSV:", err);
      svg.append("text")
        .attr("x",  W / 2)
        .attr("y",  H / 2)
        .attr("text-anchor", "middle")
        .style("fill", "darkred")
        .text("Error loading necessity‐score data.");
    });
}

function clearWorldMap() {
  d3.select("#layerControls").html("");
  d3.select("#worldmap").selectAll("*").remove();
}


// Called from your map-click handler:
function drawWorldMap(countyFeature) {
  console.log("▶️ drawWorldMap for FIPS", countyFeature.id);
  // 1) clear previous
  d3.select("#layerControls").html("");
  if (window.dwMap) {
    window.dwMap.remove();
    window.dwMap = null;
  }

  // 2) build checkboxes
  const ctrl = d3.select("#layerControls")
    .html("<strong>Toggle Layers:</strong><br/>");
  DW_CLASSES.forEach(c => {
    ctrl.append("label")
        .style("margin","0 8px 4px 0")
        .html(`<input type="checkbox" class="dw-chk" value="${c}" checked> ${c}`);
  });

  // 3) Leaflet map zoomed to county
  const [[minLon,minLat],[maxLon,maxLat]] = d3.geoBounds(countyFeature);
  const sw = [minLat, minLon], ne = [maxLat, maxLon];
  const map = L.map("worldmap", { attributionControl: false, zoomControl: false })
               .fitBounds([sw,ne]);
  window.dwMap = map;

  // 4) draw county outline
  L.geoJSON(countyFeature, {
    style: { color: "#999", weight: 1, fillColor: "#eee", fillOpacity: 1 }
  }).addTo(map);

  // 5) fetch latest DW image
  const dwImg = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
    .filterBounds(ee.Feature(countyFeature))
    .sort("system:time_start", false)
    .first()
    .select("label")
    .visualize({min:0,max:8,palette:DW_PALETTE});

  // 6) get tile URL and add layer
  ee.data.getMapId({image: dwImg, format: "png"}, info => {
    const url = info.tile_fetcher.url_format;
    const layer = L.tileLayer(url, { opacity: 0.8 }).addTo(map);

    // 7) wire up checkboxes to re-visualize
    d3.selectAll(".dw-chk").on("change", () => {
      const sel = new Set();
      d3.selectAll(".dw-chk:checked").each(function(){ sel.add(this.value); });

      // recolor: classes not selected → transparent
      const palette = DW_CLASSES.map((c,i) =>
        sel.has(c) ? DW_PALETTE[i] : "#00000000"
      );
      const newVis = dwImg.visualize({min:0,max:8,palette});
      ee.data.getMapId({image:newVis, format:"png"}, nfo => {
        layer.setUrl(nfo.tile_fetcher.url_format);
      });
    });
  }, err => console.error("getMapId error:", err));
}

// ------------- clear on year/change --------------
function drawAll() {
  drawMap(allData);
  d3.select("#bar").selectAll("*").remove();
}

// your existing boot call:
drawAll();
// ensure all three charts re‑render on window resize
window.addEventListener("resize", drawAll);

