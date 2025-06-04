/*Name: Umang Goel
ASUid: 1226986269*/

// main.js
let allData, countiesTopo;
const tooltip = d3.select("#tip");
let selectedYear = null;
let selectedModel = "model1";
d3.select("#modelSelect").on("change", function() {
  selectedModel = this.value;
  drawFeatureBar(4005);  // redraw feature bar for FIPS 4005
});

// 1) LOAD CSV + COUNTY TOPOJSON IN PARALLEL
Promise.all([
  d3.csv("clean/merged_file_clean.csv", d3.autoType),
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
]).then(([rows, us]) => {
  allData      = rows;
  countiesTopo = topojson.feature(us, us.objects.counties).features;
  initFilters();
  drawAll();
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

// 2) SETUP YEAR FILTER CONTROLS
function initFilters(){
  const years = allData.map(d => d.Year);
  const minY  = d3.min(years),
        maxY  = d3.max(years);

  // Start Year
  d3.select("#yrStart")
    .attr("min", minY).attr("max", maxY).property("value", minY)
    .on("change", drawAll);

  // End Year
  d3.select("#yrEnd")
    .attr("min", minY).attr("max", maxY).property("value", maxY)
    .on("change", drawAll);

  // Preset buttons
  d3.selectAll(".preset button")
    .on("click", function(){
      const s = +this.dataset.start,
            e = +this.dataset.end;
      d3.select("#yrStart").property("value", s);
      d3.select("#yrEnd"  ).property("value", e);
      drawAll();
    });
}

// 3) UTILITY: GET FILTERED DATA
function getFiltered(){
  const s = +d3.select("#yrStart").property("value"),
        e = +d3.select("#yrEnd"  ).property("value");
  return allData.filter(d => d.Year >= s && d.Year <= e);
}

// 4) REDRAW EVERYTHING
function drawAll(){
  const data = getFiltered();
  drawHistogram(data);
  drawBarChart  (data);
  drawMap       (data);
}

// 5) HISTOGRAM: EVENTS PER YEAR

function drawHistogram(data) {
  const svg = d3.select("#yearCount"),
        W   = svg.node().clientWidth,
        H   = svg.node().clientHeight;
  svg.selectAll("*").remove();

  const byYear = d3.rollups(data, v=>v.length, d=>d.Year)
                   .sort((a,b)=>a[0] - b[0]);

  // scales
  const x = d3.scaleBand()
      .domain(byYear.map(d=>d[0]))
      .range([60, W-30]).padding(0.1);
  const y = d3.scaleLinear()
      .domain([0, d3.max(byYear, d=>d[1])]).nice()
      .range([H-40, 40]);

  // axes
  svg.append("g")
     .attr("transform", `translate(0,${H-40})`)
     .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg.append("g")
     .attr("transform", `translate(60,0)`)
     .call(d3.axisLeft(y));

  // chart title
  svg.append("text")
     .attr("class","chart-title")
     .attr("x", W/2).attr("y", 20)
     .text("Events per Year");

  // X‑axis label
  svg.append("text")
     .attr("class","axis-label")
     .attr("x", (60 + (W-30)) / 2)
     .attr("y", H - 5)
     .text("Year");

  // Y‑axis label
  svg.append("text")
     .attr("class","axis-label")
     .attr("transform","rotate(-90)")
     .attr("x", - (40 + (H-40)) / 2)
     .attr("y", 15)
     .text("Number of Events");

  svg.selectAll("rect")
    .data(byYear).join("rect")
      .attr("x",      d => x(d[0]))
      .attr("y",      d => y(d[1]))
      .attr("width",  x.bandwidth())
      .attr("height", d => H-40 - y(d[1]))
      // highlight if this is the selected year
      .attr("fill",   d => selectedYear === d[0] ? "#00ff66" : "#4e79a7")
    .on("mouseover", (e,d) => {
      tooltip
        .style("opacity", 0.9)
        .html(`<strong>${d[0]}</strong><br>${d[1]} events`)
        .style("left", (e.pageX + 10) + "px")
        .style("top",  (e.pageY - 28) + "px");
      d3.select(e.currentTarget)
        .attr("fill", "#663399"); //yelloe
    })
    .on("mouseout", (e,d) => {
      tooltip.style("opacity", 0);
      d3.select(e.currentTarget)
        .attr("fill", selectedYear === d[0] ? "#663399" : "#4e79a7");
    })
    .on("click", (e,d) => {
      // toggle selection
      selectedYear = (selectedYear === d[0] ? null : d[0]);
      drawAll();  // redraw both histogram and map
    });
}

function drawBarChart(data) {
  const svg = d3.select("#bar"),
        W   = svg.node().clientWidth,
        H   = svg.node().clientHeight;
  svg.selectAll("*").remove();

  // 1) Summarize & sort
  const byCounty = d3.rollups(
    data,
    vs => d3.sum(vs, d => d["PropertyDmg(ADJ 2023)"]),
    d  => d.CountyName
  )
  .sort((a,b) => b[1] - a[1])
  .slice(0,15);

  // 2) Margins & shrink factor
  const left   = 90,
        right  = 10,
        top    = 40,
        bottom = 40,
        shrink = 0.9;               // keep 90% of the inner width
  const innerW  = W - left - right;
  const effW    = innerW * shrink;  // effective width

  // 3) Scales
  const x = d3.scaleLinear()
      .domain([0, d3.max(byCounty, d=>d[1])])
      .range([left, left + effW]);

  const y = d3.scaleBand()
      .domain(byCounty.map(d=>d[0]))
      .range([top, H - bottom])
      .padding(0.1);

  // 4) Axes
  svg.append("g")
     .attr("transform", `translate(0,${H - bottom})`)
     .call(d3.axisBottom(x).ticks(5));

  svg.append("g")
     .attr("transform", `translate(${left},0)`)
     .call(d3.axisLeft(y));

  // 5) Title
  svg.append("text")
     .attr("class","chart-title")
     .attr("x", W/2).attr("y", top/2)
     .attr("text-anchor","middle")
     .text("Top 15 Counties by Property Damage");

  // 6) X‑axis label
  svg.append("text")
     .attr("class","axis-label")
     .attr("x", left + effW/2)
     .attr("y", H - 6)
     .text("Property Damage (Adj 2023 USD)");

  // 7) Y‑axis label
  svg.append("text")
     .attr("class","axis-label")
     .attr("transform","rotate(-90)")
     .attr("x", - (top + (H - bottom)) / 2)
     .attr("y", 14)
     .text("County");

  // 8) Bars
  svg.selectAll("rect")
    .data(byCounty).join("rect")
      .attr("x",      left)
      .attr("y",      d => y(d[0]))
      .attr("width",  d => x(d[1]) - left)
      .attr("height", y.bandwidth())
      .attr("fill",   "#3182bd")
    .on("mouseover", (e,d) => {
      tooltip
        .style("opacity", .9)
        .html(`<strong>${d[0]}</strong><br>$${d3.format(",")(d[1])}`)
        .style("left", (e.pageX+10)+"px")
        .style("top",  (e.pageY-28)+"px");
      d3.select(e.currentTarget).attr("fill","#f49e4c");
    })
    .on("mouseout", (e) => {
      tooltip.style("opacity", 0);
      d3.select(e.currentTarget).attr("fill","#3182bd");
    });
}
// 7) CHOROPLETH: COUNTIES FOR SELECTED YEAR
function drawMap(data) {
  const svg = d3.select("#map"),
        W   = svg.node().clientWidth,
        H   = svg.node().clientHeight;
  svg.selectAll("*").remove();

  // 1) Projection + path
  const proj    = d3.geoAlbersUsa()
                    .translate([W/2, H/2])
                    .scale(1100);
  const pathGen = d3.geoPath().projection(proj);

  // 2) Focus on the clicked year (or full range if none)
  const yearData = selectedYear != null
    ? allData.filter(d => d.Year === selectedYear)
    : data;

  // 3) Count events by FIPS (ensure numeric keys)
  const counts = d3.rollups(
    yearData,
    vs => vs.length,
    d  => +d.County_FIPS
  );
  const countMap = new Map(counts);

  // 4) Pick  counties for that set
  const top15Ids = new Set(
    counts
      .sort((a,b) => b[1] - a[1])
      .slice(0,18000)
      .map(d => d[0])
  );

  // 5) Build thresholds off the **max** count
  const maxCount = d3.max(counts, ([,c]) => c) || 1;
  const t1 = Math.floor(maxCount / 3);
  const t2 = Math.floor((2 * maxCount) / 3);

  // 6) Color scale: ≤t1 = yellow, ≤t2 = orange, >t2 = red
  const colorScale = d3.scaleThreshold()
    .domain([t1, t2])
    .range(["yellow","orange","red"]);

  // 7) Draw the counties
  svg.selectAll("path")
    .data(countiesTopo)
    .join("path")
      .attr("d", pathGen)
      .attr("fill", d => {
        const c = countMap.get(+d.id) || 0;
        return top15Ids.has(+d.id)
          ? colorScale(c)
          : "#eee";
      })
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .on("click", (e, d) => {
        const fips = +d.id;
        drawFeatureBar(fips);
        if (fips === 4005) {
          drawWorldMap();       // only for 4005
        } else {
          clearWorldMap();      // clear the right‐bottom pane
        }
      }).on("click", (e, countyFeature) => {
        // 1. redraw the feature bar
        drawFeatureBar(+countyFeature.id);
        // 2. draw the dynamic world map FOR THAT county
        drawWorldMap(countyFeature);
      })
    .on("mouseover", (e,d) => {
      const id = +d.id, c = countMap.get(id) || 0;
      tooltip
        .style("opacity", 0.9)
        .html(`<strong>FIPS ${id}</strong><br>${c} event${c===1?"":"s"}`)
        .style("left", (e.pageX + 10) + "px")
        .style("top",  (e.pageY - 28) + "px");
      d3.select(e.currentTarget)
        .attr("stroke", "#000")
        .attr("stroke-width", 2);
    })
    .on("mouseout", (e,d) => {
      tooltip.style("opacity", 0);
      d3.select(e.currentTarget)
        .attr("stroke", "#999")
        .attr("stroke-width", 1);
    });

  // 8) Legend (with floored thresholds)
  const legend = svg.append("g")
    .attr("transform", `translate(20, ${H - 80})`);

  const legendData = [
    { color:"yellow", label:`Low ≤ ${t1}` },
    { color:"orange", label:`Med ≤ ${t2}` },
    { color:"red",    label:`High > ${t2}` }
  ];

  legend.selectAll("rect")
    .data(legendData)
    .join("rect")
      .attr("x",   (d,i) => i * 100)
      .attr("y",     0)
      .attr("width", 20)
      .attr("height",20)
      .attr("fill",  d => d.color);

  legend.selectAll("text")
    .data(legendData)
    .join("text")
      .attr("x", (d,i) => i * 100 + 24)
      .attr("y", 14)
      .style("font-size","12px")
      .text(d => d.label);

  // 9) Dynamic title
  svg.append("text")
    .attr("x", W/2).attr("y", 36)
    .attr("text-anchor","middle")
    .style("font-weight","600")
    .text(
      selectedYear != null
        ? `Counties in ${selectedYear}`
        : "Counties Overall"
    );
}

function drawFeatureBar(fips) {
  const svg = d3.select("#bar"),
        W   = svg.node().clientWidth,
        H   = svg.node().clientHeight;
  svg.selectAll("*").remove();

  // load that county’s feature CSV
  const modelSuffix = selectedModel;  // e.g., model2
d3.csv(`features/${fips}_${modelSuffix}.csv`, d3.autoType).then(rows => {
    // sort by rank ascending (1 highest)
    rows.sort((a,b) => a.Rank - b.Rank);

    const left   = 100,
          right  = 10,
          top    = 40,
          bottom = 40;
    const innerW = W - left - right;

    const x = d3.scaleLinear()
        .domain([0, d3.max(rows, d => d.Rank)])    // ranks 1–15
        .range([left, left + innerW]);

    const y = d3.scaleBand()
        .domain(rows.map(d => d.Feature))
        .range([top, H - bottom])
        .padding(0.1);


    // Embed dropdown inside the SVG using foreignObject
svg.append("foreignObject")
.attr("x", 10)
.attr("y", 10)
.attr("width", 200)
.attr("height", 40)
.html(`
  <div xmlns="http://www.w3.org/1999/xhtml" class="model-selector">
    <label for="modelSelect" style="font-size: 0.85rem;">Select Model:</label>
    <select id="modelSelect" style="margin-left: 5px;">
      <option value="model1" ${selectedModel === "model1" ? "selected" : ""}>Model 1</option>
      <option value="model2" ${selectedModel === "model2" ? "selected" : ""}>Model 2</option>
      <option value="model3" ${selectedModel === "model3" ? "selected" : ""}>Model 3</option>
    </select>
  </div>
`);

// Rebind listener to update chart on change
d3.select("#modelSelect").on("change", function () {
selectedModel = this.value;
drawFeatureBar(fips);
});
  
    // axes

    svg.append("g")
       .attr("transform", `translate(0,${H - bottom})`)
       .call(d3.axisBottom(x).ticks(5).tickFormat(d=>`#${d}`));

    svg.append("g")
       .attr("transform", `translate(${left},0)`)
       .call(d3.axisLeft(y));

    // title
    svg.append("text")
       .attr("class","chart-title")
       .attr("x", W/2).attr("y", top/2)
       .text(`Top 15 Features of County ${fips}`);

    // bars
    svg.selectAll("rect")
      .data(rows).join("rect")
        .attr("x",      left)
        .attr("y",      d => y(d.Feature))
        .attr("width",  d => x(d.Rank) - left)
        .attr("height", y.bandwidth())
        .attr("fill",   "#3182bd")
      .on("mouseover", (e,d) => {
        tooltip
          .style("opacity", .9)
          .html(`<strong>${d.Feature}</strong><br>Rank ${d.Rank}`)
          .style("left", (e.pageX+10)+"px")
          .style("top",  (e.pageY-28)+"px");
        d3.select(e.currentTarget).attr("fill","#f49e4c");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
        d3.selectAll("#bar rect").attr("fill","#3182bd");
      });

  }).catch(err => {
    console.error("Could not load features for", fips, err);
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
  const data = getFiltered();
  drawMap(data);
  d3.select("#bar").selectAll("*").remove();
  d3.select("#layerControls").html("");
  d3.select("#worldmap").html("");
  drawHistogram(data);
}

// your existing boot call:
drawAll();
// ensure all three charts re‑render on window resize
window.addEventListener("resize", drawAll);

